import { GAME_MODES, DEFAULT_MODE, LAYOUTS, DEFAULT_LAYOUT } from '../game/constants.js';
import { rememberUser, getUsers, rememberLayout, getPreferredLayout } from '../storage/db.js';

const LAYOUT_LABELS = {
  [LAYOUTS.TOP_BOTTOM]: 'Top/Bottom',
  [LAYOUTS.LEFT_RIGHT]: 'Left/Right',
};

export function initMenuScreen({ onStart, onLayoutChange } = {}) {
  const nameInput = document.getElementById('playerName');
  const modeSelect = document.getElementById('modeSelect');
  const startButton = document.getElementById('startBtn');
  const layoutSelect = document.getElementById('layoutSelect');

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

  function populateLayouts() {
    if (!layoutSelect) {
      return;
    }
    if (!layoutSelect.children.length) {
      Object.values(LAYOUTS).forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = LAYOUT_LABELS[value] ?? value;
        layoutSelect.appendChild(option);
      });
    }
    const preferred = normalizeLayout(getPreferredLayout());
    layoutSelect.value = preferred;
    notifyLayoutChange(layoutSelect.value);
  }

  function getSelectedLayout() {
    if (!layoutSelect) {
      return DEFAULT_LAYOUT;
    }
    return normalizeLayout(layoutSelect.value);
  }

  function notifyLayoutChange(value) {
    const layout = normalizeLayout(value);
    rememberLayout(layout);
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
    const layout = getSelectedLayout();
    rememberUser(nick);
    rememberLayout(layout);
    if (typeof onStart === 'function') {
      onStart({ player: nick, mode, layout });
    }
  }

  populateModes();
  populateLayouts();
  populatePlayers();

  startButton?.addEventListener('click', startGame);
  nameInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      startGame();
    }
  });

  layoutSelect?.addEventListener('change', (event) => {
    notifyLayoutChange(event.target?.value || DEFAULT_LAYOUT);
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
      if (layoutSelect && layout) {
        const resolved = normalizeLayout(layout);
        layoutSelect.value = resolved;
        notifyLayoutChange(resolved);
      }
    },
    refreshPlayers: populatePlayers,
  };
}
