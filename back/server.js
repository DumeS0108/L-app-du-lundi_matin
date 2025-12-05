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

// 1. Inscription
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        // On initialise wallet et total_score à 0
        const sql = `INSERT INTO users (username, password, wallet, total_score, inventory) VALUES (?, ?, 0, 0, '[]')`;
        db.query(sql, [username, hashedPassword], (err, result) => {
            if (err) return res.status(400).json({ error: "Pseudo pris !" });
            res.json({ id: result.insertId, username });
        });
    } catch (e) { res.status(500).json({ error: "Erreur serveur" }); }
});

// 2. Connexion
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
                total_score: user.total_score, // On renvoie le total pour le rang
                inventory: user.inventory || '[]',
                equipped_skin: user.equipped_skin,
                equipped_cursor: user.equipped_cursor
            });
        } else { res.status(400).json({ error: "Mauvais pass." }); }
    });
});

// 3. Sauvegarde Score
app.post('/api/score', (req, res) => {
    const { userId, score } = req.body;
    const sql = `UPDATE users SET wallet = wallet + ?, total_score = total_score + ? WHERE id = ?`;
    db.query(sql, [score, score, userId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        db.query(`SELECT wallet, total_score FROM users WHERE id = ?`, [userId], (err, result) => {
            res.json({ message: "Sauvegardé", newWallet: result[0].wallet, newTotal: result[0].total_score });
        });
    });
});

// 4. Achat
app.post('/api/buy', (req, res) => {
    const { userId, itemId, cost } = req.body;
    db.query(`SELECT wallet, inventory FROM users WHERE id = ?`, [userId], (err, results) => {
        if (err) return res.status(500).json({ error: "Erreur DB" });
        const user = results[0];
        let inventory = JSON.parse(user.inventory || '[]');

        if (user.wallet < cost) return res.status(400).json({ error: "Pas assez d'argent !" });
        if (inventory.includes(itemId)) return res.status(400).json({ error: "Déjà acheté !" });

        const newWallet = user.wallet - cost;
        inventory.push(itemId);
        
        const sqlUpdate = `UPDATE users SET wallet = ?, inventory = ? WHERE id = ?`;
        db.query(sqlUpdate, [newWallet, JSON.stringify(inventory), userId], (err) => {
            if (err) return res.status(500).json({ error: "Erreur achat" });
            res.json({ success: true, newWallet, inventory });
        });
    });
});

// 5. Équiper
app.post('/api/equip', (req, res) => {
    const { userId, type, itemId } = req.body;
    let column = (type === 'skin') ? 'equipped_skin' : 'equipped_cursor';
    const sql = `UPDATE users SET ${column} = ? WHERE id = ?`;
    db.query(sql, [itemId, userId], (err) => {
        if (err) return res.status(500).json({ error: "Erreur équipement" });
        res.json({ success: true });
    });
});

// 6. Classement
app.get('/api/leaderboard', (req, res) => {
    const sql = `SELECT username, total_score FROM users ORDER BY total_score DESC LIMIT 10`;
    db.query(sql, (err, results) => { res.json(results || []); });
});

app.listen(PORT, '0.0.0.0', () => { console.log(`🚀 Serveur V8 sur http://172.29.19.53:${PORT}`); });