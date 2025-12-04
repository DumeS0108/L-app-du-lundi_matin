const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3001;

// --- CONFIGURATION ---
app.use(express.json());
app.use(cors());

// On sert les fichiers du dossier "front" qui est au même niveau que "back"
app.use(express.static(path.join(__dirname, '../front')));

// --- CONNEXION MYSQL ---
const db = mysql.createConnection({
    host: '172.29.19.53',      
    user: 'root',           
    password: 'root',       
    database: 'olympiade'   
});

db.connect((err) => {
    if (err) {
        console.error('❌ Erreur MySQL :', err);
        return;
    }
    console.log('✅ Connecté à MySQL.');
});

// --- ROUTES API ---

// 1. Inscription
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = `INSERT INTO users (username, password) VALUES (?, ?)`;
        
        db.query(sql, [username, hashedPassword], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: "Pseudo déjà pris !" });
                return res.status(500).json({ error: err.message });
            }
            res.json({ id: result.insertId, username });
        });
    } catch (e) {
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// 2. Connexion
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const sql = `SELECT * FROM users WHERE username = ?`;
    
    db.query(sql, [username], async (err, results) => {
        if (err || results.length === 0) return res.status(400).json({ error: "Inconnu au bataillon." });
        
        const user = results[0];
        const match = await bcrypt.compare(password, user.password);
        
        if (match) {
            res.json({ id: user.id, username: user.username });
        } else {
            res.status(400).json({ error: "Mauvais mot de passe." });
        }
    });
});

// 3. Enregistrer un score (S'ajoute à l'historique)
app.post('/api/score', (req, res) => {
    const { userId, score } = req.body;
    const date = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const sql = `INSERT INTO scores (user_id, score, date) VALUES (?, ?, ?)`;
    
    db.query(sql, [userId, score, date], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Score sauvegardé." });
    });
});

// 4. Classement CUMULÉ (Correction demandée)
app.get('/api/leaderboard', (req, res) => {
    // On additionne tous les scores d'un même joueur (SUM) et on groupe par ID
    const sql = `
        SELECT users.username, SUM(scores.score) as total_score 
        FROM scores 
        JOIN users ON scores.user_id = users.id 
        GROUP BY users.id 
        ORDER BY total_score DESC 
        LIMIT 10
    `;
    
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// --- DÉMARRAGE ---
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Serveur lancé sur http://172.29.19.53:${PORT}`);
});