import { GAME_MODES, DEFAULT_MODE, LAYOUTS, DEFAULT_LAYOUT } from '../game/constants.js';
import { rememberUser, getUsers } from '../storage/db.js';

const MODE_LAYOUTS = {
  TB1: LAYOUTS.TOP_BOTTOM,
  TB2: LAYOUTS.TOP_BOTTOM,
  HR1: LAYOUTS.LEFT_RIGHT,
  HR2: LAYOUTS.LEFT_RIGHT,
};

export function initMenuScreen({ onStart, onLayoutChange } = {}) {
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

  function normalizeLayout(value) {
    return value === LAYOUTS.LEFT_RIGHT || value === LAYOUTS.TOP_BOTTOM ? value : DEFAULT_LAYOUT;
  }

  function getLayoutForMode(mode) {
    return normalizeLayout(MODE_LAYOUTS[mode] || DEFAULT_LAYOUT);
  }

  function notifyLayoutChange(value) {
    const layout = normalizeLayout(value);
    if (typeof onLayoutChange === 'function') {
      onLayoutChange(layout);
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
    const layout = getLayoutForMode(mode);
    rememberUser(nick);
    if (typeof onStart === 'function') {
      onStart({ player: nick, mode, layout });
    }
  }

  populateModes();
  populatePlayers();

  notifyLayoutChange(getLayoutForMode(getSelectedMode()));

  startButton?.addEventListener('click', startGame);
  nameInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      startGame();
    }
  });

  modeSelect?.addEventListener('change', (event) => {
    const selectedMode = event.target?.value || DEFAULT_MODE;
    notifyLayoutChange(getLayoutForMode(selectedMode));
  });

  return {
    focus() {
      nameInput?.focus();
    },
    setValues({ player, mode, layout } = {}) {
      if (nameInput && typeof player === 'string' && player.length) {
        nameInput.value = player;
      }
      if (modeSelect && mode && GAME_MODES[mode]) {
        modeSelect.value = mode;
      }
      if (layout) {
        const resolved = normalizeLayout(layout);
        notifyLayoutChange(resolved);
      } else {
        notifyLayoutChange(getLayoutForMode(getSelectedMode()));
      }
    },
    refreshPlayers: populatePlayers,
  };
}
