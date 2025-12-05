const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '../front')));

const db = mysql.createConnection({
    host: '172.29.19.53', user: 'root', password: 'root', database: 'olympiade'
});

db.connect((err) => {
    if (err) console.error('❌ Erreur MySQL :', err);
    else console.log('✅ Connecté à MySQL.');
});

// --- ROUTES API ---

// 1. Inscription (Initialise wallet et inventaire vide)
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        // On donne 0€ et un inventaire vide "[]" au départ
        const sql = `INSERT INTO users (username, password, wallet, inventory) VALUES (?, ?, 0, '[]')`;
        db.query(sql, [username, hashedPassword], (err, result) => {
            if (err) return res.status(400).json({ error: "Pseudo pris !" });
            res.json({ id: result.insertId, username });
        });
    } catch (e) { res.status(500).json({ error: "Erreur serveur" }); }
});

// 2. Connexion (Renvoie aussi le wallet et l'inventaire)
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const sql = `SELECT * FROM users WHERE username = ?`;
    db.query(sql, [username], async (err, results) => {
        if (err || results.length === 0) return res.status(400).json({ error: "Inconnu." });
        const user = results[0];
        const match = await bcrypt.compare(password, user.password);
        if (match) {
            res.json({ 
                id: user.id, 
                username: user.username,
                wallet: user.wallet,
                inventory: user.inventory || '[]',
                equipped_skin: user.equipped_skin,
                equipped_cursor: user.equipped_cursor
            });
        } else { res.status(400).json({ error: "Mauvais pass." }); }
    });
});

// 3. Sauvegarde Score & Gain d'argent
app.post('/api/score', (req, res) => {
    const { userId, score } = req.body;
    const date = new Date().toISOString().slice(0, 19).replace('T', ' ');
    
    // 1. On insère le score dans l'historique
    const sqlScore = `INSERT INTO scores (user_id, score, date) VALUES (?, ?, ?)`;
    db.query(sqlScore, [userId, score, date]);

    // 2. On ajoute l'argent au wallet de l'utilisateur
    const sqlWallet = `UPDATE users SET wallet = wallet + ? WHERE id = ?`;
    db.query(sqlWallet, [score, userId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // On renvoie le nouveau solde pour mettre à jour l'interface
        db.query(`SELECT wallet FROM users WHERE id = ?`, [userId], (err, result) => {
            res.json({ message: "Sauvegardé", newWallet: result[0].wallet });
        });
    });
});

// 4. ACHAT D'ITEM
app.post('/api/buy', (req, res) => {
    const { userId, itemId, cost } = req.body;

    // Vérifier l'argent
    db.query(`SELECT wallet, inventory FROM users WHERE id = ?`, [userId], (err, results) => {
        if (err) return res.status(500).json({ error: "Erreur DB" });
        const user = results[0];
        let inventory = JSON.parse(user.inventory || '[]');

        if (user.wallet < cost) return res.status(400).json({ error: "Pas assez d'argent !" });
        if (inventory.includes(itemId)) return res.status(400).json({ error: "Déjà acheté !" });

        // Débiter et ajouter à l'inventaire
        const newWallet = user.wallet - cost;
        inventory.push(itemId);
        
        const sqlUpdate = `UPDATE users SET wallet = ?, inventory = ? WHERE id = ?`;
        db.query(sqlUpdate, [newWallet, JSON.stringify(inventory), userId], (err) => {
            if (err) return res.status(500).json({ error: "Erreur achat" });
            res.json({ success: true, newWallet, inventory });
        });
    });
});

// 5. ÉQUIPER ITEM
app.post('/api/equip', (req, res) => {
    const { userId, type, itemId } = req.body; // type = 'skin' ou 'cursor'
    
    let column = (type === 'skin') ? 'equipped_skin' : 'equipped_cursor';
    const sql = `UPDATE users SET ${column} = ? WHERE id = ?`;
    
    db.query(sql, [itemId, userId], (err) => {
        if (err) return res.status(500).json({ error: "Erreur équipement" });
        res.json({ success: true });
    });
});

// 6. Classement (inchangé)
app.get('/api/leaderboard', (req, res) => {
    const sql = `SELECT users.username, SUM(scores.score) as total_score FROM scores JOIN users ON scores.user_id = users.id GROUP BY users.id ORDER BY total_score DESC LIMIT 10`;
    db.query(sql, (err, results) => {
        res.json(results || []);
    });
});

app.listen(PORT, '0.0.0.0', () => { console.log(`🚀 Serveur V7 sur http://172.29.19.53:${PORT}`); });