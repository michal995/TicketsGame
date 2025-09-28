import { preventIOSZoom } from './util/ios.js';
import { initMenuScreen } from './screens/menu.js';
import { initGameScreen } from './screens/game.js';

preventIOSZoom();

const menuScreen = document.getElementById('menu-screen');
const gameScreen = document.getElementById('game-screen');

function showMenu() {
  menuScreen?.classList.remove('is-hidden');
  menuScreen?.setAttribute('aria-hidden', 'false');
  gameScreen?.classList.add('is-hidden');
  gameScreen?.setAttribute('aria-hidden', 'true');
}

function showGame() {
  menuScreen?.classList.add('is-hidden');
  menuScreen?.setAttribute('aria-hidden', 'true');
  gameScreen?.classList.remove('is-hidden');
  gameScreen?.setAttribute('aria-hidden', 'false');
}

let menuControls;

const gameControls = initGameScreen({
  onNavigateToMenu: (details = {}) => {
    showMenu();
    if (details.player || details.mode) {
      menuControls?.setValues(details);
    }
    menuControls?.refreshPlayers();
    menuControls?.focus();
  },
});

menuControls = initMenuScreen({
  onStart: ({ player, mode }) => {
    showGame();
    gameControls.start({ player, mode });
  },
});

showMenu();
