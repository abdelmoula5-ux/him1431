import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { Sequelize, DataTypes } from 'sequelize';
import * as dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

// -----------------------------------------------------------------
// CONFIGURATION AZURE SQL (SEQUELIZE)
// -----------------------------------------------------------------
// Variables d'environnement à configurer sur Azure App Service
const sqlServer = process.env.AZURE_SQL_SERVER || 'localhost';
const sqlDatabase = process.env.AZURE_SQL_DATABASE || 'poll_db';
const sqlUser = process.env.AZURE_SQL_USER || 'sa';
const sqlPassword = process.env.AZURE_SQL_PASSWORD || 'Secret123!';

const sequelize = new Sequelize(sqlDatabase, sqlUser, sqlPassword, {
  host: sqlServer,
  dialect: 'mssql', // Pilote pour Microsoft SQL Server (Azure SQL)
  dialectOptions: {
    options: {
      encrypt: true, // Requis par Azure SQL
      trustServerCertificate: false
    }
  },
  logging: false // Mettre à console.log pour voir les requêtes SQL
});

sequelize.authenticate()
  .then(() => console.log('✅ Base de données Azure SQL connectée !'))
  .catch(err => console.error('❌ Erreur de connexion Azure SQL :', err));

// -----------------------------------------------------------------
// MODÈLES RELATIONNELS (TABLES)
// -----------------------------------------------------------------
const Poll = sequelize.define('Poll', {
  question: { type: DataTypes.STRING, allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
});

const Option = sequelize.define('Option', {
  text: { type: DataTypes.STRING, allowNull: false }
});

const Vote = sequelize.define('Vote', {
  participantName: { type: DataTypes.STRING, allowNull: false }
});

// Relations SQL ! 
Poll.hasMany(Option, { as: 'options', onDelete: 'CASCADE' });
Option.belongsTo(Poll);

Option.hasMany(Vote, { as: 'participants', onDelete: 'CASCADE' });
Vote.belongsTo(Option);

// Création virtuelle des Tables si elles n'existent pas
sequelize.sync({ alter: true }).then(() => {
  console.log('✅ Tables SQL synchronisées (Polls, Options, Votes)');
}).catch(err => console.error('❌ Erreur de synchro SQL:', err));

// Utilitaire : Transformer le résultat relationnel pour le Frontend via l'Azure Function
const getActivePollFormatted = async () => {
  const poll = await Poll.findOne({
    where: { isActive: true },
    order: [['createdAt', 'DESC']],
    // On charge seulement les options de base. La logique de comptabilisation des votes
    // est externalisée vers l'AZURE FUNCTION selon l'architecture demandée.
    include: [{ model: Option, as: 'options' }]
  });

  if (!poll) return null;

  // CAHIER DES CHARGES : Calcul des résultats en temps réel via Azure Function
  const functionUrl = process.env.AZURE_FUNCTION_URL;
  let optionsPonderees = [];

  if (functionUrl) {
    try {
      console.log(`🚀 Délégation du calcul à l'Azure Function: ${functionUrl}`);
      // Node.js 18+ supporte fetch nativement
      const reqCalc = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pollId: poll.id })
      });
      const data = await reqCalc.json();
      optionsPonderees = data.options || [];
    } catch (err) {
      console.error("❌ Erreur Appel Azure Function :", err);
    }
  } else {
    // Mode dégradé si la Function n'est pas encore déployée (Calcul local SQL direct)
    const optionsWithParticipants = await Option.findAll({
      where: { PollId: poll.id },
      include: [{ model: Vote, as: 'participants' }]
    });
    optionsPonderees = optionsWithParticipants.map(o => ({
      id: o.id.toString(),
      votes: o.participants ? o.participants.length : 0
    }));
  }

  return {
    id: poll.id.toString(),
    question: poll.question,
    options: poll.options.map(opt => {
      const calcOpt = optionsPonderees.find(o => o.id === opt.id.toString());
      return {
        id: opt.id.toString(),
        text: opt.text,
        votes: calcOpt ? calcOpt.votes : 0 // Résultat calculé par la Function !
      };
    })
  };
};

// -----------------------------------------------------------------
// ROUTES API (REST)
// -----------------------------------------------------------------

app.get('/api/poll', async (req, res) => {
  try {
    const formatted = await getActivePollFormatted();
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: 'Erreur Serveur SQL' });
  }
});

app.post('/api/poll', async (req, res) => {
  const { question, options } = req.body;
  
  if (!question || !options || !Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ error: 'Données invalides' });
  }

  try {
    // 1. Désactiver les anciens
    await Poll.update({ isActive: false }, { where: { isActive: true } });

    // 2. Créer le sondage
    const newPoll = await Poll.create({ question });
    
    // 3. Créer les options associées
    const optionsData = options.map(opt => ({ text: opt, PollId: newPoll.id }));
    await Option.bulkCreate(optionsData);
    
    const formatted = await getActivePollFormatted();
    
    // 4. Émettre aux navigateurs
    io.emit('poll_updated', formatted);
    res.status(201).json(formatted);
  } catch (error) {
    console.error("Erreur de création:", error);
    res.status(500).json({ error: 'Impossible de sauvegarder le sondage en DB' });
  }
});

// -----------------------------------------------------------------
// SOCKETS TEMPS RÉEL (VOTES & PARTICIPANTS)
// -----------------------------------------------------------------

io.on('connection', async (socket) => {
  console.log(`📡 Nouveau client connecté: ${socket.id}`);

  try {
    const formatted = await getActivePollFormatted();
    if (formatted) socket.emit('poll_updated', formatted);
  } catch (e) {}

  socket.on('submit_vote', async (data) => {
    try {
      const { optionId, pseudo } = data; // Le client fournit désormais un pseudo !
      
      const option = await Option.findByPk(optionId, {
        include: [{ model: Poll, where: { isActive: true } }]
      });
      
      if (option && option.Poll) {
        // Enregistrer la personne DANS la table SQL "Votes"
        await Vote.create({
          participantName: pseudo || "Anonyme",
          OptionId: option.id
        });
        
        // Diffuser les pourcentages actualisés
        const formatted = await getActivePollFormatted();
        io.emit('poll_updated', formatted);
      }
    } catch (error) {
      console.error('Erreur lors du vote SQL :', error);
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client déconnecté: ${socket.id}`);
  });
});

// -----------------------------------------------------------------
// ENVIRONNEMENT DE PRODUCTION & VITE FRONTEND
// -----------------------------------------------------------------
if (process.env.NODE_ENV === 'production' || process.env.WEBSITE_SITE_NAME) {
  app.use(express.static(path.join(__dirname, 'client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/dist/index.html'));
  });
}

const PORT = process.env.PORT || process.env.WEBSITES_PORT || 3001;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur Node.js/Azure SQL actif sur ${PORT}`);
});
