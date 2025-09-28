import { GAME_MODES, DEFAULT_MODE } from '../game/constants.js';
import { rememberUser, getUsers } from '../storage/db.js';

const nameInput = document.getElementById('playerName');
const modeSelect = document.getElementById('modeSelect');
const startButton = document.getElementById('startBtn');
const closeMenuButton = document.getElementById('closeMenu');

function populatePlayers() {
  const users = getUsers();
  if (!users.length || !nameInput) {
    return;
  }
  nameInput.setAttribute('list', 'players');
  let dataList = document.getElementById('players');
  if (!dataList) {
    dataList = document.createElement('datalist');
    dataList.id = 'players';
    document.body.appendChild(dataList);
  }
  dataList.innerHTML = users.map((user) => `<option value="${user}"></option>`).join('');
}

function populateModes() {
  Object.entries(GAME_MODES).forEach(([value, config]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = config.label;
    modeSelect.appendChild(option);
  });
  modeSelect.value = DEFAULT_MODE;
}

function startGame() {
  const nick = nameInput.value.trim() || 'Guest';
  const mode = modeSelect.value || DEFAULT_MODE;
  rememberUser(nick);
  const url = new URL('game.html', window.location.href);
  url.searchParams.set('player', nick);
  url.searchParams.set('mode', mode);
  window.location.href = url.toString();
}

if (modeSelect && startButton) {
  populateModes();
  populatePlayers();
  startButton.addEventListener('click', startGame);
  nameInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      startGame();
    }
  });
}

if (closeMenuButton) {
  closeMenuButton.addEventListener('click', () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    const fallback = new URL('index.html', window.location.href);
    window.location.href = fallback.toString();
  });
}
