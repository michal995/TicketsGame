import { GAME_MODES, DEFAULT_MODE } from '../game/constants.js';
import { rememberUser, getUsers } from '../storage/db.js';

export function initMenuScreen({ onStart } = {}) {
  const nameInput = document.getElementById('playerName');
  const modeSelect = document.getElementById('modeSelect');
  const startButton = document.getElementById('startBtn');

  function populatePlayers() {
    const list = document.getElementById('players');
    if (!list || !nameInput) {
      return;
    }
    const users = getUsers();
    list.innerHTML = users.map((user) => `<option value="${user}"></option>`).join('');
    nameInput.setAttribute('list', 'players');
  }

  function populateModes() {
    if (!modeSelect) {
      return;
    }
    if (!modeSelect.children.length) {
      Object.entries(GAME_MODES).forEach(([value, config]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = config.label;
        modeSelect.appendChild(option);
      });
    }
    if (!modeSelect.value) {
      modeSelect.value = DEFAULT_MODE;
    }
  }

  function getSelectedMode() {
    if (!modeSelect) {
      return DEFAULT_MODE;
    }
    return modeSelect.value && GAME_MODES[modeSelect.value]
      ? modeSelect.value
      : DEFAULT_MODE;
  }

  function startGame() {
    const nick = nameInput?.value.trim() || 'Guest';
    const mode = getSelectedMode();
    rememberUser(nick);
    if (typeof onStart === 'function') {
      onStart({ player: nick, mode });
    }
  }

  populateModes();
  populatePlayers();

  startButton?.addEventListener('click', startGame);
  nameInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      startGame();
    }
  });

  return {
    focus() {
      nameInput?.focus();
    },
    setValues({ player, mode } = {}) {
      if (nameInput && typeof player === 'string' && player.length) {
        nameInput.value = player;
      }
      if (modeSelect && mode && GAME_MODES[mode]) {
        modeSelect.value = mode;
      }
    },
    refreshPlayers: populatePlayers,
  };
}
