// 👇 CONFIGURATION DU PORT
const API_URL = "http://172.29.19.53:3001/api";

// --- DATA BOUTIQUE ---
const SHOP_ITEMS = [
    { id: 'skin_matrix', name: 'Fond d\'écran Matrix', type: 'skin', price: 2000, desc: 'Soyez l\'élu.' },
    { id: 'skin_xp', name: 'Windows XP Bliss', type: 'skin', price: 1500, desc: 'Nostalgie pure.' },
    { id: 'skin_pink', name: 'Vaporwave Pink', type: 'skin', price: 1000, desc: 'Aesthetic.' },
    { id: 'cursor_pizza', name: 'Curseur Pizza', type: 'cursor', price: 800, desc: 'Miam.' },
    { id: 'cursor_gold', name: 'Curseur Rebelle', type: 'cursor', price: 3000, desc: 'Un beau doigt.' },
    { id: 'power_coffee', name: 'Caféine (Snake)', type: 'powerup', price: 5000, desc: 'Snake va moins vite (-20%).' },
    { id: 'power_ears', name: 'Oreille Bionique', type: 'powerup', price: 5000, desc: 'Boss détecté + tôt.' }
];

// --- VARIABLES ---
let currentUser = null;
let currentWallet = 0;
let userInventory = []; // Liste des IDs possédés
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

// --- CLOCK ---
setInterval(() => {
    const now = new Date();
    document.getElementById('clock').innerText = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
}, 1000);

// --- AUTH & INIT ---
async function login() {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    try {
        const res = await fetch(`${API_URL}/login`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: u, password: p}) });
        const data = await res.json();
        if(res.ok) { 
            currentUser = data; 
            currentWallet = data.wallet;
            userInventory = JSON.parse(data.inventory);
            startOS(data.equipped_skin, data.equipped_cursor); 
        } else {
            document.getElementById('auth-message').innerText = "❌ " + data.error;
        }
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
}

// --- BOUTIQUE LOGIC ---
function renderShop() {
    const grid = document.getElementById('shop-items');
    grid.innerHTML = '';
    
    SHOP_ITEMS.forEach(item => {
        const owned = userInventory.includes(item.id);
        const div = document.createElement('div');
        div.className = `shop-item ${owned ? 'owned' : ''}`;
        
        let btnHtml = '';
        if (owned) {
            if(item.type !== 'powerup') {
                btnHtml = `<button class="shop-btn" onclick="equipItem('${item.type}', '${item.id}')">ÉQUIPER</button>`;
            } else {
                btnHtml = `<button class="shop-btn" disabled>ACTIF</button>`;
            }
        } else {
            btnHtml = `<button class="shop-btn" onclick="buyItem('${item.id}', ${item.price})">ACHETER (${item.price}€)</button>`;
        }

        div.innerHTML = `
            <h4>${item.name}</h4>
            <p>${item.desc}</p>
            ${btnHtml}
        `;
        grid.appendChild(div);
    });
}

async function buyItem(itemId, price) {
    if(currentWallet < price) return alert("Pas assez d'argent !");
    
    try {
        const res = await fetch(`${API_URL}/buy`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId: currentUser.id, itemId, cost: price })
        });
        const data = await res.json();
        if(data.success) {
            currentWallet = data.newWallet;
            userInventory = data.inventory;
            updateWalletDisplay();
            renderShop(); // Refresh boutons
            alert("Acheté !");
        }
    } catch(e) { alert("Erreur achat"); }
}

async function equipItem(type, itemId) {
    try {
        await fetch(`${API_URL}/equip`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId: currentUser.id, type, itemId })
        });
        // Appliquer immédiatement
        if(type === 'skin') applyCosmetics(itemId, null);
        if(type === 'cursor') applyCosmetics(null, itemId);
        alert("Équipé !");
    } catch(e) {}
}

function applyCosmetics(skin, cursor) {
    if(skin) {
        document.body.className = document.body.className.replace(/bg-\w+/g, ""); // Remove old bg
        document.body.classList.add(skin.replace('skin_', 'bg-'));
        if(skin === 'default') document.body.classList.add('bg-default');
    }
    if(cursor) {
        document.body.className = document.body.className.replace(/cursor-\w+/g, ""); // Remove old cursor
        document.body.classList.add(cursor);
        if(cursor === 'default') document.body.classList.add('cursor-default');
    }
}

// --- MÉCANIQUE PATRON (BOSS KEY) AMÉLIORÉE ---
function startBossMechanic() {
    let minTime = 1600;
    // Powerup Oreilles Bioniques : Patron vient moins souvent
    if(userInventory.includes('power_ears')) minTime = 15000;

    const randomTime = Math.random() * 32000 + minTime; 
    bossTimer = setTimeout(triggerBossAlert, randomTime);
}

function triggerBossAlert() {
    if(!gameActive || isBossMode) { startBossMechanic(); return; }

    const alertBox = document.getElementById('boss-alert');
    alertBox.classList.remove('hidden');
    
    // Temps de réaction (augmenté si powerup)
    let reactionTime = userInventory.includes('power_ears') ? 5000 : 3000;
    
    const failTimer = setTimeout(() => {
        if(!isBossMode) { 
            alertBox.classList.add('hidden');
            gameOver("LE PATRON T'A SURPRIS ! (-500€)");
            score = Math.max(0, score - 500); 
        }
    }, reactionTime);

    const keyHandler = (e) => {
        if(e.code === 'Space') {
            clearTimeout(failTimer);
            document.removeEventListener('keydown', keyHandler);
            toggleBossScreen(true);
        }
    };
    document.addEventListener('keydown', keyHandler);
}

function toggleBossScreen(show) {
    const screen = document.getElementById('boss-screen');
    const alertBox = document.getElementById('boss-alert');
    const statusText = document.getElementById('boss-status-text');
    const safeText = document.getElementById('boss-safe-text');
    
    if(show) {
        // --- ON SE CACHE ---
        isBossMode = true;
        isPaused = true; 
        isSafeToReturn = false; 
        
        screen.classList.remove('hidden');
        alertBox.classList.add('hidden');
        
        statusText.innerText = "Installation : 12% (Le patron rode...)";
        safeText.innerText = "⛔ NE REVENEZ PAS TOUT DE SUITE !";
        safeText.style.color = "red";

        const waitTime = Math.random() * 5000 + 3000;
        
        safeTimer = setTimeout(() => {
            isSafeToReturn = true; 
            statusText.innerText = "Installation : 12% (Le patron est parti à la machine à café)";
            safeText.innerText = "✅ VOUS POUVEZ REPRENDRE (ESPACE)";
            safeText.style.color = "#0f0";
        }, waitTime);

    } else {
        // --- ON TENTE DE REVENIR ---
        if(!isSafeToReturn) {
            screen.classList.add('hidden');
            gameOver("TU ES REVENU TROP TÔT ! Le patron était encore là !");
            return;
        }

        isBossMode = false;
        isPaused = false; 
        screen.classList.add('hidden');
        if(currentGame === 'typer') document.getElementById('typer-input').focus();
        startBossMechanic();
    }
}

document.addEventListener('keydown', (e) => {
    if(e.code === 'Space' && isBossMode) {
        toggleBossScreen(false);
    }
});

// --- WINDOW MANAGER (CORRIGÉ) ---
function openWindow(appId) {
    document.querySelectorAll('.os-window').forEach(el => el.style.zIndex = 10);
    const win = document.getElementById(`window-${appId}`);
    if(win) { win.classList.remove('hidden'); win.style.zIndex = 20; }
    if(appId === 'leaderboard') loadLeaderboard();
    if(appId === 'shop') renderShop(); // Charger la boutique
}

function closeWindow(appId) {
    document.getElementById(`window-${appId}`).classList.add('hidden');
    if (currentGame === appId) {
        stopGameLogic();
    }
}

function stopGameLogic() {
    gameActive = false;
    isPaused = false;
    clearInterval(gameInterval);
    clearTimeout(gameInterval);
    currentGame = null;

    // Reset UI
    document.getElementById('btn-start-snake').classList.remove('hidden');
    document.getElementById('snake-grid').innerHTML = '';
    document.getElementById('btn-start-popup').classList.remove('hidden');
    document.getElementById('game-area-popup').innerHTML = '';
    document.getElementById('btn-start-typer').classList.remove('hidden');
    document.getElementById('typer-input').disabled = true;
    document.getElementById('typer-input').value = '';
    document.getElementById('word-display').innerText = "PRÊT ?";
}

function initDraggableWindows() {
    document.querySelectorAll('.os-window').forEach(win => {
        const header = win.querySelector('.window-header');
        let isDragging = false, startX, startY, initL, initT;
        header.onmousedown = (e) => {
            if(e.target.tagName === 'BUTTON') return; 
            e.preventDefault();
            document.querySelectorAll('.os-window').forEach(el => el.style.zIndex = 10);
            win.style.zIndex = 20;
            isDragging = true; startX = e.clientX; startY = e.clientY;
            initL = win.offsetLeft; initT = win.offsetTop;
            document.onmousemove = (ev) => {
                if(!isDragging) return;
                win.style.left = (initL + ev.clientX - startX) + "px";
                win.style.top = (initT + ev.clientY - startY) + "px";
            };
            document.onmouseup = () => { isDragging = false; document.onmousemove = null; };
        };
    });
}

function updateScoreDisplay(id) {
    document.getElementById(`score-${id}`).innerText = Math.floor(score);
    document.getElementById(`mult-${id}`).innerText = multiplier.toFixed(1);
}

// --- JEU 1: POPUP ---
function startPopupGame() {
    gameActive = true; score = 0; multiplier = 0.5;
    currentGame = 'popup';
    updateScoreDisplay('popup');
    document.getElementById('btn-start-popup').classList.add('hidden');
    document.getElementById('game-area-popup').innerHTML = '';
    popupLoop(2000);
}

function popupLoop(speed) {
    if(!gameActive) return;
    if(isPaused) { setTimeout(() => popupLoop(speed), 100); return; }

    const area = document.getElementById('game-area-popup');
    const p = document.createElement('div');
    p.classList.add('popup');
    p.style.left = Math.floor(Math.random()*(area.clientWidth-150))+'px';
    p.style.top = Math.floor(Math.random()*(area.clientHeight-80))+'px';
    const texts = ["URGENT", "Réunion", "Café ?", "Erreur", "Boss"];
    p.innerHTML = `<div class="popup-header">Alerte</div><div style="padding:5px;">${texts[Math.floor(Math.random()*texts.length)]}</div>`;
    p.onmousedown = () => { 
        if(gameActive && !isPaused) { 
            p.remove(); 
            // ✅ Multiplicateur augmente doucement
            multiplier += 0.1;
            score += 10 * multiplier; 
            updateScoreDisplay('popup');
        }
    };
    area.appendChild(p);
    
    if(document.querySelectorAll('.popup').length >= 10) gameOver("Trop de fenêtres !");
    else gameInterval = setTimeout(() => popupLoop(Math.max(500, speed-50)), speed);
}

// --- JEU 2: TYPER ---
const WORDS = [
  "CODE","BRIEF","CLIENT","API","TEAM","DEV","MERGE","TICKET","BUG","PLAN","SLA",
  "DEPLOY","TASK","BOARD","STANDUP","SPRINT","OFFICE","SERVER","REVIEW","PATCH",
  "BUILD","AGILE","CLOUD","DATA","PROJET","BACKUP","JENKINS","PIPELINE","KPI",
  "RELEASE","PROD","DOCKER","SCRUM","BUDGET","DEADLINE","PROCESS","REFACTOR",
  "DASHBOARD","WORKFLOW","CACHING","BACKEND","FRONTEND","FRAMEWORK","MEETING",
  "FEEDBACK","COMPLIANCE","CONTRACT","DELIVERY","TEAMLEAD","ARCHITECTURE",
  "MIGRATION","SCALABILITY","MICROSERVICE","REFACTORING","AUTOMATION","DEBUG",
  "ROADMAP","INTEGRATION","SYNCHRONISATION","WORKLOAD","BENCHMARK","OPTIMISATION",
  "ALGORITHM","INTERFACE","ENVIRONMENT","TASKFORCE","REFACTOR","MONITORING",
  "LATENCY","PRODUCTIVITY","CONFERENCE","COWORKING","COMMUNICATION","PRESENTATION",
  "VERSIONNING","REQUIREMENTS","DEVELOPMENT","DOCUMENTATION","VALIDATION",
  "ESTIMATION","INNOVATION","REPORTING","ANALYTICS","AUTHENTICATION","ENCRYPTION",
  "CONNECTION","AUTORISATION","REBOOT","RESTART","CLUSTER","SECURITY","PERFORMANCE",
  "STAGING","PRODUCTION","OVERTIME","SOLUTION","SYNERGIE","LEADERSHIP","FEASIBILITY",
  "STRATEGY","OPERATIONNEL","KICKOFF","PLANNING","INDICATEUR","ALLOCATION",
  "RETROSPECTIVE","CONTEXT","DELIVERABLE","SCHEMA","DATABASE","QUERY","DEPLOYMENT",
  "CONFLICT","REPOSITORY","VERSION","STORY","BACKLOG","HOTFIX","TEMPLATE","UX",
  "UI","INTERN","MANAGER","MENTORING","COACHING","RECRUITING","ONBOARDING",
  "PRIORITY","FEATURE","MODULE","INSTANCE","CRITICAL","TROUBLESHOOT","INVENTORY",
  "STORAGE","BRANDING","MARKETING","RUNBOOK","PLAYBOOK","SCHEDULE","TIMELINE",
  "FORECAST","MEGASPRINT","LOADBALANCING","CAPACITÉ","REQUIREMENT","SCENARIO",
  "HOMOLOGATION","REFACTORISE","AUTOSCALING","SHADOWING","FAILOVER","CONTAINER",
  "ITERATION","PROTOTYPE","WIRE FRAME","MAQUETTE","REFACTOR","CALL","ZOOM","BUREAU",
  "ESPACE","ASSISTANCE","SUPPORT","RELANCE","POLICY","GOVERNANCE","DIRECTIVE",
  "CIBLAGE","SEGMENTATION","WORKSHOP","BRAINSTORM","IDEATION","MINDMAP","KANBAN",
  "FLOW","JOURNAL","INBOX","PRIORISATION","DEMANDE","BID","BRANCH","HOTLINE",
  "WORKSTATION","NOTEBOOK","LAPTOP","DESKTOP","OPTIMIZED","UIDESIGN","PIPE",
  "DEVOPS","MICROCONTROLLER","AUTOMATISATION","LOADTEST","STRESSTEST","RETENTION",
  "CONVERSION","FUNNEL","PRODUCT OWNER","SOFTWARE","HARDWARE","MAINTENANCE",
  "REPORT","TRENDS","INSIGHTS","CIBLEDATA","SCORING","MONITOR","AUDIT",
  "COMPTABILITÉ","FREELANCE","ENTREPRISE","FUSION","ACQUISITION","BRAINSTORMING",
  "DELIBERATION","COORDINATION","SUIVI","GANTT","TABLEUR","DOSSIER","ORGANISATION"
];

let currentWord="", timer=100;

function startTyperGame() {
    gameActive=true; score=0; timer=100; multiplier = 1.0;
    currentGame = 'typer';
    updateScoreDisplay('typer');
    document.getElementById('btn-start-typer').classList.add('hidden');
    const input = document.getElementById('typer-input');
    input.disabled=false; input.value=""; input.focus();
    nextWord();
    
    gameInterval = setInterval(() => {
        if(!gameActive || isPaused) return;
        timer-=1.5; 
        document.getElementById('timer-progress').style.width=timer+'%';
        if(timer<=0) gameOver("Trop lent !");
    }, 100);

    input.oninput = () => {
        if(isPaused) return;
        if(input.value.toUpperCase()===currentWord) {
            // ✅ Multiplicateur augmente à chaque mot
            multiplier += 0.2;
            score += 100 * multiplier; 
            updateScoreDisplay('typer');
            
            timer=Math.min(timer+25, 100); input.value=""; nextWord();
        } else if (input.value.length > 0 && !currentWord.startsWith(input.value.toUpperCase())) {
            // ❌ Erreur de frappe = Perte de combo
            multiplier = 1.0;
            updateScoreDisplay('typer');
            input.style.borderColor = "red";
            setTimeout(() => input.style.borderColor = "#0f0", 200);
        }
    };
}
function nextWord() { currentWord=WORDS[Math.floor(Math.random()*WORDS.length)]; document.getElementById('word-display').innerText=currentWord; }

// --- JEU 3: SNAKE EXCEL ---
let snake=[], direction='right', food={x:0, y:0};

function startSnakeGame() {
    gameActive=true; score=0; snake=[{x:10, y:7}, {x:9, y:7}]; direction='right';
    multiplier = 1.0;
    currentGame = 'snake';
    updateScoreDisplay('snake');
    document.getElementById('btn-start-snake').classList.add('hidden');
    spawnFood();
    // Powerup Caféine : Snake va à 200ms au lieu de 150ms
    let speed = userInventory.includes('power_coffee') ? 200 : 150;
    gameInterval = setInterval(snakeLoop, speed);
    document.addEventListener('keydown', changeDirection);
}

function changeDirection(e) {
    if(isPaused) return;
    if(e.key==='ArrowUp' && direction!=='down') direction='up';
    if(e.key==='ArrowDown' && direction!=='up') direction='down';
    if(e.key==='ArrowLeft' && direction!=='right') direction='left';
    if(e.key==='ArrowRight' && direction!=='left') direction='right';
}

function spawnFood() { food = {x: Math.floor(Math.random()*20), y: Math.floor(Math.random()*15)}; }

function snakeLoop() {
    if(!gameActive || isPaused) return;

    const head = { ...snake[0] };
    if(direction==='right') head.x++; if(direction==='left') head.x--;
    if(direction==='up') head.y--; if(direction==='down') head.y++;

    if(head.x<0 || head.x>=20 || head.y<0 || head.y>=15) return gameOver("Mur heurté");
    if(snake.some(s => s.x===head.x && s.y===head.y)) return gameOver("Queue mordue");

    snake.unshift(head);
    if(head.x===food.x && head.y===food.y) {
        // ✅ Multiplicateur Serpent
        multiplier += 0.1;
        score += 75 * multiplier;
        updateScoreDisplay('snake');
        spawnFood();
    } else {
        snake.pop();
    }
    drawSnake();
}

function drawSnake() {
    const grid = document.getElementById('snake-grid');
    grid.innerHTML = '';
    for(let y=0; y<15; y++) {
        for(let x=0; x<20; x++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            if(snake.some((s,i) => s.x===x && s.y===y)) {
                cell.classList.add('snake-body');
                if(snake[0].x===x && snake[0].y===y) cell.classList.add('snake-head');
            }
            if(food.x===x && food.y===y) cell.classList.add('snake-food');
            grid.appendChild(cell);
        }
    }
}

// --- GLOBAL GAME OVER ---
async function gameOver(reason) {
    stopGameLogic();
    alert(`❌ FINI : ${reason}\n💰 Salaire volé : ${Math.floor(score)} €`);
    
    try {
        await fetch(`${API_URL}/score`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, score: Math.floor(score) }) });
        
        // Mettre à jour le portefeuille localement après la fin du jeu si possible
        // (Idéalement le backend renvoie le nouveau solde, sinon on ajoute localement)
        currentWallet += Math.floor(score);
        updateWalletDisplay();

    } catch(e) {}
    
    openWindow('leaderboard');
    startBossMechanic(); 
}

async function loadLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = "Calcul des primes...";
    try {
        const res = await fetch(`${API_URL}/leaderboard`);
        const data = await res.json();
        list.innerHTML = data.map((s, i) => `<li>#${i+1} <b>${s.username}</b> : ${s.total_score} € cumulés</li>`).join('');
    } catch(e) { list.innerHTML = "Erreur RH"; }
}