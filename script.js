let players = [];
let timerInterval = null;
let announceTimeout = null;

const DEFAULT_MINUTES = 5;
const DEFAULT_SECONDS = 0;

/* ═══════════════════════════════════════
   AUDIO GRAVEYARD — Web Audio API
   ═══════════════════════════════════════ */
let audioCtx = null;

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

/* 1. LAST 10 SECONDS — "Death Clock" tick
   Sharp digital Geiger-counter tick that fires every second during danger */
function playTick() {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.07, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
}

/* 2. TIME'S UP — "Grave Bell" alarm
   Low sawtooth wail that drops like a dying church bell */
function playAlarm() {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    for (let i = 0; i < 4; i++) {
        const t = now + i * 0.18;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(700, t);
        osc.frequency.exponentialRampToValueAtTime(180, t + 0.15);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.22);
    }
}

/* 3. BUTTON CLICK — "Tombstone Chisel"
   Short dry stone-clack / bone-snap. Retro, mechanical, graveyard-themed. */
function playClick() {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
}

/* ═══════════════════════════════════════ */

function formatTime(seconds) {
    if (seconds <= 0) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

function getState(p) {
    if (p.finished) return 'finished';
    if (p.running) return 'running';
    if (p.remaining === p.originalTime) return 'ready';
    return 'paused';
}

/* ─── Setup ─── */
function startGame() {
    playClick();
    players = [];
    for (let i = 0; i < 4; i++) {
        const name = document.getElementById(`name${i+1}`).value.trim() || `Player ${i+1}`;
        const mins = parseInt(document.getElementById(`min${i+1}`).value) || 0;
        const secs = parseInt(document.getElementById(`sec${i+1}`).value) || 0;
        const total = mins * 60 + secs;

        players.push({
            name: name,
            originalTime: total,
            remaining: total,
            running: false,
            finished: false
        });

        document.getElementById(`name-${i}`).textContent = name;
        document.getElementById(`replace-name-${i}`).value = '';
        document.getElementById(`replace-${i}`).style.display = 'none';
        document.getElementById(`actions-${i}`).style.display = 'flex';
        document.getElementById(`replace-min-${i}`).value = DEFAULT_MINUTES;
        document.getElementById(`replace-sec-${i}`).value = DEFAULT_SECONDS;
    }

    hideAnnouncement();
    hideFullscreenOverlay();
    document.getElementById('setup').style.display = 'none';
    document.getElementById('game').style.display = 'flex';
    updateAll();
}

function resetGame() {
    playClick();
    stopTimer();
    hideAnnouncement();
    hideFullscreenOverlay();
    document.getElementById('game').style.display = 'none';
    document.getElementById('setup').style.display = 'flex';
}

/* ─── Display ─── */
function updateAll() {
    for (let i = 0; i < 4; i++) updateDisplay(i);
}

function updateDisplay(i) {
    const p = players[i];
    const state = getState(p);
    const card = document.getElementById(`card-${i}`);
    const timerEl = document.getElementById(`timer-${i}`);
    const statusEl = document.getElementById(`status-${i}`);
    const actionsEl = document.getElementById(`actions-${i}`);

    timerEl.textContent = formatTime(p.remaining);
    document.getElementById(`name-${i}`).textContent = p.name;

    card.className = 'player-card ' + state;

    if (p.remaining <= 10 && p.remaining > 0) {
        card.classList.add('danger');
    }

    switch(state) {
        case 'ready':
            statusEl.textContent = 'Ready — Tap untuk mulai';
            actionsEl.innerHTML = '';
            break;
        case 'running':
            statusEl.textContent = 'Waktu berjalan';
            actionsEl.innerHTML = `<button class="btn btn-small btn-success" onclick="event.stopPropagation(); finishEarly(${i})">SELESAI</button>`;
            break;
        case 'paused':
            statusEl.textContent = 'Paused — Tap untuk melanjutkan';
            actionsEl.innerHTML = `<button class="btn btn-small btn-success" onclick="event.stopPropagation(); finishEarly(${i})">SELESAI</button>`;
            break;
        case 'finished':
            statusEl.textContent = p.remaining === 0 ? 'Waktu Habis' : 'Selesai';
            actionsEl.innerHTML = `<button class="btn btn-small btn-secondary" onclick="event.stopPropagation(); showReplace(${i})">Player Baru</button>`;
            break;
    }
}

/* ─── Controls ─── */
function handleCardClick(i) {
    const p = players[i];
    if (p.finished) return;
    p.running = !p.running;
    updateDisplay(i);
    if (p.running && !timerInterval) startTimerLoop();
}

function finishEarly(i) {
    playClick();
    const p = players[i];
    p.finished = true;
    p.running = false;
    updateDisplay(i);
}

/* ─── Replace Player ─── */
function showReplace(i) {
    playClick();
    document.getElementById(`actions-${i}`).style.display = 'none';
    document.getElementById(`replace-${i}`).style.display = 'flex';
    document.getElementById(`replace-name-${i}`).focus();
}

function cancelReplace(i) {
    playClick();
    document.getElementById(`replace-${i}`).style.display = 'none';
    document.getElementById(`actions-${i}`).style.display = 'flex';
    document.getElementById(`replace-name-${i}`).value = '';
}

function confirmReplace(i) {
    playClick();
    const nameInput = document.getElementById(`replace-name-${i}`);
    const minInput = document.getElementById(`replace-min-${i}`);
    const secInput = document.getElementById(`replace-sec-${i}`);

    const newName = nameInput.value.trim() || `Player ${i+1}`;
    const mins = parseInt(minInput.value) || 0;
    const secs = parseInt(secInput.value) || 0;
    const total = mins * 60 + secs;

    players[i].name = newName;
    players[i].originalTime = total;
    players[i].remaining = total;
    players[i].finished = false;
    players[i].running = false;

    nameInput.value = '';
    minInput.value = DEFAULT_MINUTES;
    secInput.value = DEFAULT_SECONDS;

    cancelReplace(i);
    updateDisplay(i);
}

/* ─── Announcements ─── */
function showAnnouncement(text) {
    const el = document.getElementById('announcement');
    el.textContent = text + ' — click to dismiss';
    el.style.display = 'block';

    if (announceTimeout) clearTimeout(announceTimeout);
    announceTimeout = setTimeout(() => hideAnnouncement(), 5000);
}

function hideAnnouncement() {
    playClick();
    const el = document.getElementById('announcement');
    el.style.display = 'none';
    if (announceTimeout) {
        clearTimeout(announceTimeout);
        announceTimeout = null;
    }
}

function showFullscreenOverlay(playerName) {
    const el = document.getElementById('fullscreen-overlay');
    document.getElementById('overlay-player').textContent = playerName;
    el.classList.add('active');
}

function hideFullscreenOverlay() {
    playClick();
    document.getElementById('fullscreen-overlay').classList.remove('active');
}

/* ─── Timer Engine ─── */
function startTimerLoop() {
    if (timerInterval) return;
    timerInterval = setInterval(() => {
        let anyRunning = false;
        for (let i = 0; i < 4; i++) {
            const p = players[i];
            if (p.running && !p.finished) {
                anyRunning = true;
                p.remaining--;

                /* 🔊 Death Clock tick during last 10 seconds */
                if (p.remaining <= 10 && p.remaining > 0) {
                    playTick();
                }

                if (p.remaining <= 0) {
                    p.remaining = 0;
                    p.finished = true;
                    p.running = false;
                    playAlarm(); // 🔊 Grave Bell
                    showFullscreenOverlay(p.name);
                }
                updateDisplay(i);
            }
        }
        if (!anyRunning) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

/* ─── Keyboard ─── */
document.addEventListener('keydown', (e) => {
    if (document.getElementById('game').style.display === 'none') return;
    if (document.activeElement.tagName === 'INPUT') {
        if (e.key === 'Enter') document.activeElement.blur();
        return;
    }
    if (e.key >= '1' && e.key <= '4') {
        handleCardClick(parseInt(e.key) - 1);
    }
});