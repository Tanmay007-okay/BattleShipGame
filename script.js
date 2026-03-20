





'use strict';

/* ── Difficulty Config ───────────────────────────────────────── */
const DIFFICULTIES = {
  easy:   { cols: 4, ships: 5,  clicks: 10, label: 'Easy'   },
  medium: { cols: 6, ships: 8,  clicks: 15, label: 'Medium' },
  hard:   { cols: 8, ships: 12, clicks: 20, label: 'Hard'   },
};

/* ── Game State ──────────────────────────────────────────────── */
let currentDiff = 'easy';
let board       = [];
let clicksUsed  = 0;
let shipsFound  = 0;
let gameOver    = false;
let timerSecs   = 0;
let timerID     = null;
let currentScore = 0;
let isMuted     = false;

/* ── Audio Context (Web Audio API) ──────────────────────────── */
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

/**
 * playTone — generates a beep/sweep using Web Audio API.
 * @param {string} type  - 'hit' | 'miss' | 'win' | 'lose'
 */
function playSound(type) {
  if (isMuted) return;
  try {
    const ctx = getAudioCtx();

    const configs = {
      hit: [
        { freq: 440, endFreq: 880, duration: 0.18, gain: 0.35, wave: 'square'   },
        { freq: 660, endFreq: 990, duration: 0.12, gain: 0.25, wave: 'sawtooth', delay: 0.15 },
      ],
      miss: [
        { freq: 300, endFreq: 180, duration: 0.22, gain: 0.2,  wave: 'sine'     },
      ],
      win: [
        { freq: 523, endFreq: 523, duration: 0.15, gain: 0.3,  wave: 'square',  delay: 0    },
        { freq: 659, endFreq: 659, duration: 0.15, gain: 0.3,  wave: 'square',  delay: 0.18 },
        { freq: 784, endFreq: 784, duration: 0.15, gain: 0.3,  wave: 'square',  delay: 0.36 },
        { freq: 1046,endFreq:1046, duration: 0.28, gain: 0.35, wave: 'square',  delay: 0.54 },
      ],
      lose: [
        { freq: 392, endFreq: 220, duration: 0.3,  gain: 0.28, wave: 'sawtooth', delay: 0    },
        { freq: 330, endFreq: 180, duration: 0.3,  gain: 0.28, wave: 'sawtooth', delay: 0.28 },
        { freq: 261, endFreq: 130, duration: 0.45, gain: 0.3,  wave: 'sawtooth', delay: 0.54 },
      ],
    };

    const notes = configs[type] || configs.miss;
    const now   = ctx.currentTime;

    notes.forEach(({ freq, endFreq, duration, gain, wave, delay = 0 }) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();

      osc.connect(env);
      env.connect(ctx.destination);

      osc.type = wave;
      osc.frequency.setValueAtTime(freq, now + delay);
      osc.frequency.linearRampToValueAtTime(endFreq, now + delay + duration);

      env.gain.setValueAtTime(0, now + delay);
      env.gain.linearRampToValueAtTime(gain, now + delay + 0.01);
      env.gain.linearRampToValueAtTime(0, now + delay + duration);

      osc.start(now + delay);
      osc.stop(now + delay + duration + 0.05);
    });

  } catch (e) {
    // Silently ignore audio errors (e.g. Safari quirks)
  }
}

/* ── DOM Refs ────────────────────────────────────────────────── */
const gridEl        = document.getElementById('game-grid');
const clicksEl      = document.getElementById('clicks-left');
const shipsEl       = document.getElementById('ships-found');
const timerEl       = document.getElementById('timer-display');
const scoreEl       = document.getElementById('score-display');
const overlay       = document.getElementById('result-overlay');
const resultEmoji   = document.getElementById('result-emoji');
const resultTitle   = document.getElementById('result-title');
const resultSub     = document.getElementById('result-sub');
const finalScoreEl  = document.getElementById('final-score');
const finalTimeEl   = document.getElementById('final-time');
const finalShipsEl  = document.getElementById('final-ships');
const newBestEl     = document.getElementById('new-best');
const muteBtn       = document.getElementById('mute-btn');

/* ── Timer Helpers ───────────────────────────────────────────── */
function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function startTimer() {
  stopTimer();
  timerSecs = 0;
  timerEl.textContent = '0:00';
  timerID = setInterval(() => {
    timerSecs++;
    timerEl.textContent = formatTime(timerSecs);
  }, 1000);
}

function stopTimer() {
  clearInterval(timerID);
  timerID = null;
}

/* ── Score Calculation ───────────────────────────────────────── */
function calcScore(shipsHit, clicksSpent, seconds, totalShips, maxClicks) {
  if (shipsHit === 0) return 0;
  const shipBonus   = shipsHit * 100;
  const clickPenalty = Math.max(0, (clicksSpent - shipsHit)) * 10;
  const timeBonus   = Math.max(0, 300 - seconds * 2);   // up to +300 for speed
  const winBonus    = shipsHit === totalShips ? 200 : 0; // bonus for full clear
  return Math.max(0, shipBonus - clickPenalty + timeBonus + winBonus);
}

/* ── Best Scores (localStorage) ─────────────────────────────── */
function getBestScores() {
  try {
    return JSON.parse(localStorage.getItem('bship_best') || '{}');
  } catch { return {}; }
}

function saveBestScore(diff, score) {
  const bests = getBestScores();
  const isNew = !bests[diff] || score > bests[diff];
  if (isNew) {
    bests[diff] = score;
    try { localStorage.setItem('bship_best', JSON.stringify(bests)); } catch {}
  }
  return isNew;
}

function renderBestScores() {
  const bests = getBestScores();
  ['easy', 'medium', 'hard'].forEach(d => {
    const el = document.getElementById(`best-${d}`);
    if (el) el.textContent = bests[d] ? bests[d].toLocaleString() : '—';
  });
}

/* ── Init / Reset ────────────────────────────────────────────── */
function initGame() {
  stopTimer();
  const cfg  = DIFFICULTIES[currentDiff];
  const size = cfg.cols * cfg.cols;

  board       = Array(size).fill('water');
  clicksUsed  = 0;
  shipsFound  = 0;
  gameOver    = false;
  currentScore = 0;

  // Place ships randomly
  let placed = 0;
  while (placed < cfg.ships) {
    const idx = Math.floor(Math.random() * size);
    if (board[idx] !== 'ship') { board[idx] = 'ship'; placed++; }
  }

  // Set CSS variable for grid columns
  gridEl.style.setProperty('--cols', cfg.cols);

  renderGrid();
  updateHUD();
  overlay.classList.remove('show');
  renderBestScores();
}

/* ── Render Grid ─────────────────────────────────────────────── */
function renderGrid() {
  gridEl.innerHTML = '';
  const cfg = DIFFICULTIES[currentDiff];

  board.forEach((type, idx) => {
    const cell  = document.createElement('div');
    cell.className   = 'cell';
    cell.dataset.idx = idx;
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-label', `Cell ${idx + 1}`);

    const front = document.createElement('div');
    front.className = 'cell-front';

    const back  = document.createElement('div');
    back.className  = 'cell-back';
    //  hidden image revealed on click
    back.textContent = type === 'ship' ? '🚢' : '🌊';

    cell.appendChild(front);
    cell.appendChild(back);
    cell.addEventListener('click', () => handleClick(cell, idx));
    gridEl.appendChild(cell);
  });
}

/* ── Handle Cell Click ───────────────────────────────────────── */
function handleClick(cell, idx) {
  if (gameOver || cell.classList.contains('revealed')) return;

  // Start timer on first click
  if (clicksUsed === 0) startTimer();

  clicksUsed++;
  const type = board[idx];
  cell.classList.add('revealed', type);

  if (type === 'ship') {
    shipsFound++;
    playSound('hit');
    cell.classList.add('hit-anim');
  } else {
    playSound('miss');
    cell.classList.add('miss-anim');
  }

  updateHUD();
  checkWinLose();
}

/* ── Update HUD ──────────────────────────────────────────────── */
function updateHUD() {
  const cfg  = DIFFICULTIES[currentDiff];
  const left = cfg.clicks - clicksUsed;

  // Clicks left
  clicksEl.textContent = left;
  clicksEl.className   =
    'hud-value' + (left <= 2 ? ' danger' : left <= Math.floor(cfg.clicks * 0.4) ? ' warning' : '');

  // Ships
  shipsEl.textContent = `${shipsFound}/${cfg.ships}`;

  // Live score
  currentScore = calcScore(shipsFound, clicksUsed, timerSecs, cfg.ships, cfg.clicks);
  scoreEl.textContent = currentScore.toLocaleString();

  // Pulse score on ship hit
  if (board[/* last idx */ clicksUsed - 1] === 'ship') {
    scoreEl.classList.remove('pulse');
    void scoreEl.offsetWidth;
    scoreEl.classList.add('pulse');
  }
}

/* ── Win / Lose Check ────────────────────────────────────────── */
function checkWinLose() {
  const cfg          = DIFFICULTIES[currentDiff];
  const allFound     = shipsFound === cfg.ships;
  const outOfClicks  = clicksUsed >= cfg.clicks;

  if (allFound) {
    stopTimer();
    gameOver = true;
    playSound('win');
    setTimeout(() => showResult('won'), 380);
  } else if (outOfClicks) {
    stopTimer();
    gameOver = true;
    revealAll();
    playSound('lose');
    setTimeout(() => showResult('lost'), 650);
  }
}

/* ── Reveal All on Loss ──────────────────────────────────────── */
function revealAll() {
  document.querySelectorAll('.cell:not(.revealed)').forEach(cell => {
    const idx  = parseInt(cell.dataset.idx);
    const type = board[idx];
    cell.classList.add('revealed', type);
    cell.style.opacity = '0.5';
  });
}

/* ── Show Result Overlay ─────────────────────────────────────── */
function showResult(outcome) {
  const cfg    = DIFFICULTIES[currentDiff];
  const score  = calcScore(shipsFound, clicksUsed, timerSecs, cfg.ships, cfg.clicks);
  const isNew  = outcome === 'won' ? saveBestScore(currentDiff, score) : false;

  //  Win / Lose messages
  if (outcome === 'won') {
    resultEmoji.textContent = '🎉';
    resultTitle.textContent = 'You Won!';
    resultTitle.className   = 'result-title won';
    resultSub.textContent   =
      `You cleared ${cfg.label} in ${clicksUsed} click${clicksUsed !== 1 ? 's' : ''}!`;
  } else {
    resultEmoji.textContent = '💥';
    resultTitle.textContent = 'You Lost!';
    resultTitle.className   = 'result-title lost';
    resultSub.textContent   =
      `${shipsFound} of ${cfg.ships} ships found — try again!`;
  }

  finalScoreEl.textContent = score.toLocaleString();
  finalTimeEl.textContent  = formatTime(timerSecs);
  finalShipsEl.textContent = `${shipsFound}/${cfg.ships}`;

  newBestEl.hidden = !isNew;
  renderBestScores();
  overlay.classList.add('show');
}

/* ── Difficulty Buttons ──────────────────────────────────────── */
document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
    currentDiff = btn.dataset.diff;
    initGame();
  });
});

/* ── Mute Button ─────────────────────────────────────────────── */
muteBtn.addEventListener('click', () => {
  isMuted = !isMuted;
  muteBtn.textContent = isMuted ? '🔇' : '🔊';
  muteBtn.classList.toggle('muted', isMuted);
});

/* ── Reset + Play Again ──────────────────────────────────────── */
document.getElementById('reset-btn').addEventListener('click', initGame);
document.getElementById('play-again-btn').addEventListener('click', initGame);

/* ── Boot ────────────────────────────────────────────────────── */
initGame();
