const API_URL = "http://172.29.19.53:3001/api";

const SHOP_ITEMS = [
    { id: 'skin_matrix', name: 'Fond Matrix', type: 'skin', price: 2000, desc: 'Soyez l\'élu.' },
    { id: 'skin_xp', name: 'Windows XP', type: 'skin', price: 1500, desc: 'Nostalgie.' },
    { id: 'skin_pink', name: 'Vaporwave', type: 'skin', price: 1000, desc: 'Aesthetic.' },
    { id: 'cursor_pizza', name: 'Curseur Pizza', type: 'cursor', price: 800, desc: 'Miam.' },
    { id: 'cursor_gold', name: 'Curseur Rebelle', type: 'cursor', price: 3000, desc: 'Un beau doigt.' },
    { id: 'power_coffee', name: 'Caféine', type: 'powerup', price: 5000, desc: 'Snake ralenti.' },
    { id: 'power_ears', name: 'Oreille Bionique', type: 'powerup', price: 5000, desc: 'Radar Patron.' }
];

// --- RANGS ---
const RANKS = [
    { name: 'Stagiaire', limit: 0 },
    { name: 'CDD Précaire', limit: 1000 },
    { name: 'Employé Modèle', limit: 5000 },
    { name: 'Cadre Sup', limit: 15000 },
    { name: 'PDG (Le Boss)', limit: 50000 }
];

// --- MAILS JEU ---
const MAILS = [
    { from: "Patron", subject: "URGENT", body: "Le dossier X est en retard !!", type: "BOSS" },
    { from: "RH", subject: "Note de service", body: "Merci de ne pas manger au bureau.", type: "TRASH" },
    { from: "Prince", subject: "Héritage", body: "Cliquez pour 1M€.", type: "TRASH" },
    { from: "IT Support", subject: "Mise à jour", body: "Ne pas éteindre à 18h.", type: "TRASH" },
    { from: "Client", subject: "Devis", body: "Est-ce que c'est prêt ?", type: "WORK" },
    { from: "Maman", subject: "Coucou", body: "Tu rentres ce soir ?", type: "TRASH" },
    { from: "Patron", subject: "Réunion", body: "Salle 3 maintenant.", type: "BOSS" },
    { from: "Collègue", subject: "Blague", body: "C'est l'histoire d'un dev...", type: "TRASH" }
];

let currentUser = null;
let currentWallet = 0;
let totalScoreLifetime = 0;
let userInventory = []; 
let currentGame = null; 
let score = 0;
let multiplier = 1;
let gameActive = false;
let isPaused = false;
let gameInterval;
let bossTimer;
let safeTimer;
let isBossMode = false;
let isSafeToReturn = false;
let missClicks = 0; 
let currentMail = null;

setInterval(() => {
    const now = new Date();
    document.getElementById('clock').innerText = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
}, 1000);

// --- AUTH ---
async function login() {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    try {
        const res = await fetch(`${API_URL}/login`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: u, password: p}) });
        const data = await res.json();
        if(res.ok) { 
            currentUser = data; 
            currentWallet = data.wallet;
            totalScoreLifetime = data.total_score || 0; // Récupéré du back V8
            userInventory = JSON.parse(data.inventory);
            startOS(data.equipped_skin, data.equipped_cursor); 
        } else { document.getElementById('auth-message').innerText = "❌ " + data.error; }
    } catch(e) { alert("Erreur connexion 3001"); }
}

async function register() {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    try {
        const res = await fetch(`${API_URL}/register`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: u, password: p}) });
        if(res.ok) alert("✅ Inscrit !"); else alert("❌ Erreur");
    } catch(e) { alert("Erreur serveur"); }
}

function startOS(skin, cursor) {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('desktop-screen').classList.remove('hidden');
    document.getElementById('display-username').innerText = currentUser.username;
    updateWalletDisplay();
    applyCosmetics(skin, cursor);
    initDraggableWindows();
    startBossMechanic(); 
}

function logout() { location.reload(); }

function updateWalletDisplay() {
    document.getElementById('wallet-display').innerText = currentWallet;
    document.getElementById('shop-wallet').innerText = currentWallet;
    
    // Calcul Rang
    let currentRank = "Stagiaire";
    for (let r of RANKS) {
        if (totalScoreLifetime >= r.limit) currentRank = r.name;
    }
    document.getElementById('rank-display').innerText = currentRank;
}

// --- BOUTIQUE ---
function renderShop() {
    const grid = document.getElementById('shop-items');
    grid.innerHTML = '';
    SHOP_ITEMS.forEach(item => {
        const owned = userInventory.includes(item.id);
        const div = document.createElement('div');
        div.className = `shop-item ${owned ? 'owned' : ''}`;
        let btnHtml = owned 
            ? (item.type !== 'powerup' ? `<button class="shop-btn" onclick="equipItem('${item.type}', '${item.id}')">ÉQUIPER</button>` : `<button class="shop-btn" disabled>ACTIF</button>`)
            : `<button class="shop-btn" onclick="buyItem('${item.id}', ${item.price})">ACHETER (${item.price}€)</button>`;
        div.innerHTML = `<h4>${item.name}</h4><p>${item.desc}</p>${btnHtml}`;
        grid.appendChild(div);
    });
}
async function buyItem(itemId, price) {
    if(currentWallet < price) return alert("Pas assez d'argent !");
    try {
        const res = await fetch(`${API_URL}/buy`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, itemId, cost: price }) });
        const data = await res.json();
        if(data.success) { currentWallet = data.newWallet; userInventory = data.inventory; updateWalletDisplay(); renderShop(); alert("Acheté !"); }
    } catch(e) { alert("Erreur achat"); }
}
async function equipItem(type, itemId) {
    try {
        await fetch(`${API_URL}/equip`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, type, itemId }) });
        if(type === 'skin') applyCosmetics(itemId, null);
        if(type === 'cursor') applyCosmetics(null, itemId);
        alert("Équipé !");
    } catch(e) {}
}
function applyCosmetics(skin, cursor) {
    if(skin) { document.body.className = document.body.className.replace(/bg-\w+/g, ""); document.body.classList.add(skin.replace('skin_', 'bg-')); if(skin === 'default') document.body.classList.add('bg-default'); }
    if(cursor) { document.body.className = document.body.className.replace(/cursor-\w+/g, ""); document.body.classList.add(cursor); if(cursor === 'default') document.body.classList.add('cursor-default'); }
}

// --- BOSS ---
function startBossMechanic() {
    let minTime = 8000;
    if(userInventory.includes('power_ears')) minTime = 15000;
    const randomTime = Math.random() * 32000 + minTime; 
    bossTimer = setTimeout(triggerBossAlert, randomTime);
}
function triggerBossAlert() {
    if(!gameActive || isBossMode) { startBossMechanic(); return; }
    document.getElementById('boss-alert').classList.remove('hidden');
    let reactTime = userInventory.includes('power_ears') ? 5000 : 3000;
    const failTimer = setTimeout(() => {
        if(!isBossMode) { 
            document.getElementById('boss-alert').classList.add('hidden');
            gameOver("LE PATRON T'A SURPRIS ! (-500€)");
            score = Math.max(0, score - 500); 
        }
    }, reactTime);
    const handler = (e) => {
        if(e.code === 'Space') { clearTimeout(failTimer); document.removeEventListener('keydown', handler); toggleBossScreen(true); }
    };
    document.addEventListener('keydown', handler);
}
function toggleBossScreen(show) {
    const screen = document.getElementById('boss-screen');
    const alertBox = document.getElementById('boss-alert');
    if(show) {
        isBossMode = true; isPaused = true; isSafeToReturn = false;
        screen.classList.remove('hidden'); alertBox.classList.add('hidden');
        document.getElementById('boss-safe-text').style.color="red";
        document.getElementById('boss-safe-text').innerText="NE REVENEZ PAS !";
        setTimeout(() => {
            isSafeToReturn = true;
            document.getElementById('boss-safe-text').style.color="#0f0";
            document.getElementById('boss-safe-text').innerText="VOUS POUVEZ REPRENDRE (ESPACE)";
        }, Math.random() * 5000 + 3000);
    } else {
        if(!isSafeToReturn) return gameOver("REVENU TROP TÔT !");
        isBossMode = false; isPaused = false; screen.classList.add('hidden');
        if(currentGame==='typer') document.getElementById('typer-input').focus();
        startBossMechanic();
    }
}
document.addEventListener('keydown', (e) => { if(e.code==='Space' && isBossMode) toggleBossScreen(false); });

// --- WINDOW MANAGER ---
function openWindow(id) {
    document.querySelectorAll('.os-window').forEach(el=>el.style.zIndex=10);
    const w = document.getElementById('window-'+id);
    if(w) { w.classList.remove('hidden'); w.style.zIndex=20; }
    if(id==='leaderboard') loadLeaderboard();
    if(id==='shop') renderShop();
}
function closeWindow(id) {
    document.getElementById('window-'+id).classList.add('hidden');
    if(currentGame===id) stopGameLogic();
}
function stopGameLogic() {
    gameActive=false; isPaused=false; clearInterval(gameInterval); clearTimeout(gameInterval); currentGame=null;
    // UI RESET
    document.getElementById('game-area-popup').innerHTML='';
    document.getElementById('btn-start-popup').classList.remove('hidden');
    document.getElementById('btn-stop-popup').classList.add('hidden');
    document.getElementById('snake-grid').innerHTML='';
    document.getElementById('btn-start-snake').classList.remove('hidden');
    document.getElementById('typer-input').disabled=true;
    document.getElementById('btn-start-typer').classList.remove('hidden');
    document.getElementById('btn-start-mail').classList.remove('hidden');
    document.getElementById('mail-content').classList.add('hidden');
}
function initDraggableWindows() { 
    document.querySelectorAll('.os-window').forEach(win => {
        const header = win.querySelector('.window-header');
        let isDragging = false, startX, startY, initL, initT;
        header.onmousedown = (e) => {
            if(e.target.tagName==='BUTTON') return;
            e.preventDefault();
            document.querySelectorAll('.os-window').forEach(el => el.style.zIndex = 10);
            win.style.zIndex = 20;
            isDragging = true; startX = e.clientX; startY = e.clientY;
            initL = win.offsetLeft; initT = win.offsetTop;
            document.onmousemove = (ev) => { if(!isDragging)return; win.style.left=(initL+ev.clientX-startX)+"px"; win.style.top=(initT+ev.clientY-startY)+"px"; };
            document.onmouseup = () => { isDragging=false; document.onmousemove=null; };
        };
    });
}
function updateHUD(id) {
    document.getElementById('score-'+id).innerText = Math.floor(score);
    document.getElementById('mult-'+id).innerText = multiplier.toFixed(1);
}

// --- JEU 1: POPUP ---
function startPopupGame() {
    gameActive=true; score=0; multiplier=0.5; currentGame='popup'; missClicks=0;
    document.getElementById('miss-count').innerText = "0";
    document.getElementById('btn-start-popup').classList.add('hidden');
    document.getElementById('btn-stop-popup').classList.remove('hidden');
    
    const area = document.getElementById('game-area-popup');
    area.innerHTML = '';
    const newArea = area.cloneNode(true);
    area.parentNode.replaceChild(newArea, area);
    newArea.onclick = (e) => {
        if(isPaused || !gameActive) return;
        if(e.target.id === 'game-area-popup') {
            missClicks++;
            document.getElementById('miss-count').innerText = missClicks;
            multiplier = 0.5; updateHUD('popup');
            newArea.style.backgroundColor = "#ffcccc"; setTimeout(()=>newArea.style.backgroundColor="white", 100);
            if(missClicks >= 3) gameOver("3 ERREURS DE CLIC !");
        }
    };
    popupLoop(2000);
}
function popupLoop(speed) {
    if(!gameActive) return;
    if(isPaused) { setTimeout(()=>popupLoop(speed),100); return; }
    const area = document.getElementById('game-area-popup');
    const p = document.createElement('div');
    p.classList.add('popup');
    p.style.left=Math.floor(Math.random()*(area.clientWidth-150))+'px';
    p.style.top=Math.floor(Math.random()*(area.clientHeight-80))+'px';
    p.innerHTML=`<div class="popup-header">Alert</div><div style="padding:5px;">URGENT</div>`;
    p.onmousedown = (e) => { 
        e.stopPropagation(); 
        if(gameActive && !isPaused) { p.remove(); multiplier+=0.1; score+=10*multiplier; updateHUD('popup'); }
    };
    area.appendChild(p);
    if(document.querySelectorAll('.popup').length>=10) gameOver("TROP DE FENÊTRES !");
    else setTimeout(()=>popupLoop(Math.max(500, speed-50)), speed);
}
function manualStopGame() { gameOver("PAUSE CAFÉ (Arrêt volontaire)"); }

// --- JEU 2: TYPER ---
const WORDS=["PROJET","ASAP","DEADLINE","BOSS","ARGENT","LEAD","TEAM","ZOOM","BRIEF","CLIENT","API","DEV","MERGE","TICKET","BUG","PLAN","SLA","DEPLOY","TASK","BOARD","STANDUP","SPRINT","OFFICE","SERVER","REVIEW","PATCH","BUILD","AGILE","CLOUD","DATA","BACKUP","JENKINS","PIPELINE","KPI","RELEASE","PROD","DOCKER","SCRUM","BUDGET","PROCESS","REFACTOR","DASHBOARD","WORKFLOW","CACHING","BACKEND","FRONTEND","FRAMEWORK","MEETING","FEEDBACK","COMPLIANCE","CONTRACT","DELIVERY"];
let curWord="", timer=100;
function startTyperGame() {
    gameActive=true; score=0; multiplier=1; currentGame='typer'; timer=100;
    document.getElementById('btn-start-typer').classList.add('hidden');
    const inp=document.getElementById('typer-input'); inp.disabled=false; inp.value=""; inp.focus();
    nextWord();
    gameInterval=setInterval(()=>{ if(!gameActive||isPaused)return; timer-=1.5; document.getElementById('timer-progress').style.width=timer+'%'; if(timer<=0)gameOver("TROP LENT"); },100);
    inp.oninput=()=>{
        if(isPaused)return;
        if(inp.value.toUpperCase()===curWord){ multiplier+=0.2; score+=100*multiplier; updateHUD('typer'); timer=Math.min(timer+25,100); inp.value=""; nextWord(); }
        else if(inp.value.length>0 && !curWord.startsWith(inp.value.toUpperCase())) { multiplier=1; updateHUD('typer'); inp.style.borderColor="red"; setTimeout(()=>inp.style.borderColor="#0f0",200); }
    };
}
function nextWord(){ curWord=WORDS[Math.floor(Math.random()*WORDS.length)]; document.getElementById('word-display').innerText=curWord; }

// --- JEU 3: SNAKE ---
let snake=[], dir='right', food={x:0,y:0};
function startSnakeGame() {
    gameActive=true; score=0; multiplier=1; currentGame='snake'; snake=[{x:5,y:5}];
    document.getElementById('btn-start-snake').classList.add('hidden');
    spawnFood();
    let speed = userInventory.includes('power_coffee') ? 200 : 150;
    gameInterval=setInterval(snakeLoop, speed);
    document.addEventListener('keydown', changeDir);
}
function changeDir(e){ 
    if(isPaused)return; 
    if(e.key==='ArrowUp'&&dir!=='down')dir='up';
    if(e.key==='ArrowDown'&&dir!=='up')dir='down';
    if(e.key==='ArrowLeft'&&dir!=='right')dir='left';
    if(e.key==='ArrowRight'&&dir!=='left')dir='right';
}
function spawnFood(){ food={x:Math.floor(Math.random()*20), y:Math.floor(Math.random()*15)}; }
function snakeLoop(){
    if(!gameActive||isPaused)return;
    const head={...snake[0]};
    if(dir==='right')head.x++; if(dir==='left')head.x--; if(dir==='up')head.y--; if(dir==='down')head.y++;
    if(head.x<0||head.x>=20||head.y<0||head.y>=15 || snake.some(s=>s.x===head.x&&s.y===head.y)) return gameOver("CRASH MUR/QUEUE");
    snake.unshift(head);
    if(head.x===food.x&&head.y===food.y){ multiplier+=0.1; score+=75*multiplier; updateHUD('snake'); spawnFood(); }
    else snake.pop();
    drawSnake();
}
function drawSnake(){
    const g=document.getElementById('snake-grid'); g.innerHTML='';
    for(let y=0;y<15;y++)for(let x=0;x<20;x++){
        const c=document.createElement('div'); c.className='cell';
        if(snake.some(s=>s.x===x&&s.y===y)) c.classList.add('snake-body');
        if(food.x===x&&food.y===y) c.classList.add('snake-food');
        g.appendChild(c);
    }
}

// --- JEU 4: MAIL (OUTLOOK) ---
function startMailGame() {
    gameActive=true; score=0; multiplier=1; currentGame='mail';
    document.getElementById('btn-start-mail').classList.add('hidden');
    document.getElementById('mail-content').classList.remove('hidden');
    nextMail();
    updateHUD('mail');
}
function nextMail() {
    currentMail = MAILS[Math.floor(Math.random() * MAILS.length)];
    document.getElementById('mail-sender').innerText = currentMail.from;
    document.getElementById('mail-subject').innerText = currentMail.subject;
    document.getElementById('mail-body').innerText = currentMail.body;
}
function handleMailAction(action) {
    if(!gameActive || isPaused) return;
    let isCorrect = false;
    if(action === 'reply' && (currentMail.type === 'BOSS' || currentMail.type === 'WORK')) isCorrect = true;
    if(action === 'trash' && currentMail.type === 'TRASH') isCorrect = true;

    if(isCorrect) { multiplier += 0.2; score += 100 * multiplier; document.getElementById('mail-content').style.borderColor = "green"; } 
    else { multiplier = 1; score -= 50; if(currentMail.type === 'BOSS') score -= 200; document.getElementById('mail-content').style.borderColor = "red"; }
    
    updateHUD('mail');
    setTimeout(() => { document.getElementById('mail-content').style.borderColor = "gray"; nextMail(); }, 200);
}

// --- GLOBAL GAME OVER ---
async function gameOver(reason) {
    stopGameLogic();
    const finalScore = Math.floor(score);
    alert(`❌ FINI : ${reason}\n💰 Gain : ${finalScore} €`);
    try {
        const res = await fetch(`${API_URL}/score`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:currentUser.id, score:finalScore}) });
        const data = await res.json();
        if(data.newWallet) { 
            currentWallet = data.newWallet; 
            totalScoreLifetime = data.newTotal; // Update Rank
            updateWalletDisplay(); 
        }
    } catch(e){}
    openWindow('leaderboard');
    startBossMechanic();
}

async function loadLeaderboard() {
    const l=document.getElementById('leaderboard-list'); l.innerHTML='Chargement...';
    try {
        const r=await fetch(`${API_URL}/leaderboard`); const d=await r.json();
        l.innerHTML=d.map((s,i)=>`<li>#${i+1} <b>${s.username}</b> : ${s.total_score} pts</li>`).join('');
    } catch(e) { l.innerText="Erreur"; }
}