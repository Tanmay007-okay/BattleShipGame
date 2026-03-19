
// ── Constants ────────────────────────────────────────────────
const GRID_SIZE   = 4;   // 4×4 board
const TOTAL_SHIPS = 5;
const MAX_CLICKS  = 8;

// ── State ────────────────────────────────────────────────────
let board      = [];
let clicksUsed = 0;
let shipsFound = 0;
let gameOver   = false;

// ── DOM References ───────────────────────────────────────────
const gridEl       = document.getElementById('game-grid');
const clicksEl     = document.getElementById('clicks-left');
const shipsEl      = document.getElementById('ships-found');
const overlay      = document.getElementById('result-overlay');
const resultEmoji  = document.getElementById('result-emoji');
const resultTitle  = document.getElementById('result-title');
const resultSub    = document.getElementById('result-sub');

// ── Initialise / Reset ───────────────────────────────────────
function initGame() {
  board      = Array(GRID_SIZE * GRID_SIZE).fill('water');
  clicksUsed = 0;
  shipsFound = 0;
  gameOver   = false;

  // Place TOTAL_SHIPS ships at random positions
  let placed = 0;
  while (placed < TOTAL_SHIPS) {
    const idx = Math.floor(Math.random() * board.length);
    if (board[idx] !== 'ship') {
      board[idx] = 'ship';
      placed++;
    }
  }

  renderGrid();
  updateStats();
  overlay.classList.remove('show');
}

// ──  Render the 4×4 grid ───────────────────────
function renderGrid() {
  gridEl.innerHTML = '';

  board.forEach((type, idx) => {
    // Cell container
    const cell = document.createElement('div');
    cell.className    = 'cell';
    cell.dataset.idx  = idx;

    // Front face (ocean surface)
    const front = document.createElement('div');
    front.className = 'cell-front';

    // Back face (revealed ship or water)
    const back = document.createElement('div');
    back.className  = 'cell-back';
    back.textContent = type === 'ship' ? '🚢' : '🌊'; // Task 03: hidden image

    cell.appendChild(front);
    cell.appendChild(back);

    //  click reveals the cell
    cell.addEventListener('click', () => handleClick(cell, idx));

    gridEl.appendChild(cell);
  });
}

// ──  Handle cell click ───────────────────────────────
function handleClick(cell, idx) {
  if (gameOver || cell.classList.contains('revealed')) return;

  clicksUsed++;
  const type = board[idx];

  cell.classList.add('revealed', type); // reveals ship or water

  if (type === 'ship') shipsFound++;

  updateStats();
  checkWinLose();
}

// ── Update stat counters ─────────────────────────────────────
function updateStats() {
  const left = MAX_CLICKS - clicksUsed;

  clicksEl.textContent = left;
  clicksEl.className   =
    'stat-value' +
    (left <= 2 ? ' danger' : left <= 4 ? ' warning' : '');

  shipsEl.textContent = `${shipsFound} / ${TOTAL_SHIPS}`;
}

// ──  Win / Lose check ────────────────────────────────
function checkWinLose() {
  const allShipsFound = shipsFound === TOTAL_SHIPS;
  const outOfClicks   = clicksUsed >= MAX_CLICKS;

  if (allShipsFound) {
    gameOver = true;
    setTimeout(() => showResult('won', clicksUsed), 350);
  } else if (outOfClicks) {
    gameOver = true;
    revealAll();
    setTimeout(() => showResult('lost', clicksUsed), 600);
  }
}

// ── Reveal remaining cells on loss ──────────────────────────
function revealAll() {
  document.querySelectorAll('.cell:not(.revealed)').forEach(cell => {
    const idx  = parseInt(cell.dataset.idx);
    const type = board[idx];
    cell.classList.add('revealed', type);
    cell.style.opacity = '0.55'; // dim unrevealed cells
  });
}

// ──  Show result overlay ────────────────────────────
function showResult(outcome, clicks) {
  if (outcome === 'won') {
    resultEmoji.textContent = '🎉';
    resultTitle.textContent = 'You Won!';
    resultTitle.className   = 'result-title won';
    resultSub.textContent   =
      `You found all 5 ships in ${clicks} click${clicks !== 1 ? 's' : ''}!`;
  } else {
    resultEmoji.textContent = '💥';
    resultTitle.textContent = 'You Lost!';
    resultTitle.className   = 'result-title lost';
    resultSub.textContent   =
      `You used all ${MAX_CLICKS} clicks but only found ${shipsFound} of 5 ships.`;
  }
  overlay.classList.add('show');
}

// ── Button Listeners ─────────────────────────────────────────
document.getElementById('reset-btn').addEventListener('click', initGame);
document.getElementById('play-again-btn').addEventListener('click', initGame);

// ── Start the game ───────────────────────────────────────────
initGame();
