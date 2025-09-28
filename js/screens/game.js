import { GAME_MODES, getAvailableDenominations } from '../game/constants.js';
import { SESSION, startSession, endSession } from '../game/state.js';
import { startRound, finishRound, stopRound } from '../game/round.js';
import { addTicket, removeTicket, clearTickets, insertCoin } from '../game/actions.js';
import { renderTickets, renderCoins, updateHud, renderHistory, showOverlay, hideOverlay } from '../game/render.js';
import { playClickFeedback, playErrorFeedback, animateFlyToScore } from '../game/effects.js';
import { recordScore } from '../storage/db.js';

const params = new URLSearchParams(window.location.search);
const player = params.get('player') || 'Guest';
const mode = params.get('mode');

startSession(player, mode);

const elements = {
  scoreDisplay: document.getElementById('score'),
  scoreCard: document.getElementById('score')?.closest('.stat-card') || null,
  timerDisplay: document.getElementById('timer'),
  needEl: document.getElementById('need'),
  paysEl: document.getElementById('pays'),
  paysCard: document.getElementById('paysCard'),
  fareEl: document.getElementById('fare'),
  pickedEl: document.getElementById('picked'),
  remainEl: document.getElementById('remain'),
  ticketsWrap: document.getElementById('tickets'),
  coinsWrap: document.getElementById('coins'),
  changeWrap: document.querySelector('.pay'),
};

const overlayElements = {
  overlay: document.getElementById('overlay'),
  box: document.getElementById('overlayBox'),
};

const clearButton = document.getElementById('clearTickets');
const closeButton = document.getElementById('closeGame');

let roundActive = false;
let finishing = false;

const ticketHandlers = {
  onAddTicket: (name, event) => {
    if (!roundActive) return;
    const button = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    const added = addTicket(SESSION, name);
    if (button) {
      if (added) {
        playClickFeedback(button);
      } else {
        playErrorFeedback(button);
      }
    }
    if (added && button && elements.scoreDisplay) {
      animateFlyToScore(button, elements.scoreDisplay);
    }
    if (added) {
      syncUI();
    }
  },
  onRemoveTicket: (name, event) => {
    if (!roundActive) return;
    const button = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    const removed = removeTicket(SESSION, name);
    if (button) {
      if (removed) {
        playClickFeedback(button);
      } else {
        playErrorFeedback(button);
      }
    }
    if (removed) {
      syncUI();
    }
  },
};

const coinHandlers = {
  getAvailableCoins: () => getAvailableDenominations(SESSION.coinOptions),
  onInsertCoin: (value, event) => {
    if (!roundActive) return;
    const button = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    const inserted = insertCoin(SESSION, value);
    if (button) {
      if (inserted) {
        playClickFeedback(button);
      } else {
        playErrorFeedback(button);
      }
    }
    if (inserted) {
      if (button && elements.scoreDisplay) {
        animateFlyToScore(button, elements.scoreDisplay);
      }
      syncUI();
    }
  },
};

function navigateToMenu() {
  window.location.href = 'index.html';
}

function syncUI() {
  const requestEntries = Object.entries(SESSION.request);
  const ticketsMatch = requestEntries.every(([name, count]) => (SESSION.selectedTickets[name] || 0) === count);
  const noExtraTickets = Object.keys(SESSION.selectedTickets).every(
    (name) => (SESSION.request[name] || 0) === SESSION.selectedTickets[name]
  );
  const ticketsComplete = requestEntries.length > 0 && ticketsMatch && noExtraTickets;
  SESSION.canPay = ticketsComplete;
  if (ticketsComplete) {
    SESSION.showPays = true;
    if (!SESSION.payRevealShown) {
      SESSION.payRevealPending = true;
      SESSION.payRevealShown = true;
    }
  } else {
    SESSION.showPays = false;
    SESSION.payRevealPending = false;
    SESSION.payRevealShown = false;
  }

  if (!ticketsComplete) {
    SESSION.payFlashPending = false;
    SESSION.payFlashShown = false;
  } else if (SESSION.changeDue === 0 && !SESSION.payFlashShown) {
    SESSION.payFlashPending = true;
    SESSION.payFlashShown = true;
  }
  renderTickets(SESSION, elements, ticketHandlers);
  renderCoins(SESSION, elements, coinHandlers);
  updateHud(SESSION, elements);
  renderHistory(SESSION, elements);
  maybeFinishRound();
}

function maybeFinishRound() {
  if (!roundActive || finishing) {
    return;
  }
  const requestEntries = Object.entries(SESSION.request);
  if (!requestEntries.length) {
    return;
  }
  const ticketsMatch = requestEntries.every(([name, count]) => (SESSION.selectedTickets[name] || 0) === count);
  const noExtraTickets = Object.keys(SESSION.selectedTickets).every((name) => (SESSION.request[name] || 0) === SESSION.selectedTickets[name]);
  const remainingChange = SESSION.changeDue - SESSION.inserted;
  const changeSettled = SESSION.changeDue === 0 ? SESSION.inserted === 0 : remainingChange <= 0.01;
  if (ticketsMatch && noExtraTickets && changeSettled) {
    finishing = true;
    roundActive = false;
    Promise.resolve(finishRound(elements, roundHandlers, 'completed'))
      .catch((error) => console.error(error))
      .finally(() => {
        finishing = false;
      });
  }
}

function handleTimeout() {
  if (!roundActive) return;
  finishing = true;
  roundActive = false;
  Promise.resolve(finishRound(elements, roundHandlers, 'timeout'))
    .catch((error) => console.error(error))
    .finally(() => {
      finishing = false;
    });
}

function handleProceed() {
  if (SESSION.round < SESSION.totalRounds) {
    roundActive = true;
    startRound(elements, roundHandlers);
    renderCoins(SESSION, elements, coinHandlers);
  } else {
    showSessionSummary();
  }
}

function showSessionSummary() {
  const summary = endSession();
  recordScore({ player: summary.player, mode: summary.mode, score: summary.score });

  const details = summary.summaries.map((item) => ({
    label: `Round ${item.round}`,
    value: `${item.points >= 0 ? '+' : ''}${item.points} pts`,
  }));

  const actions = [
    {
      label: 'Play again',
      onSelect: () => {
        hideOverlay(overlayElements.overlay);
        startSession(summary.player, summary.mode);
        roundActive = true;
        startRound(elements, roundHandlers);
        renderCoins(SESSION, elements, coinHandlers);
      },
    },
    {
      label: 'Back to Menu',
      onSelect: navigateToMenu,
    },
  ];

  showOverlay(overlayElements, {
    title: `${summary.player} — ${GAME_MODES[summary.mode].label}`,
    subtitle: `Final score: ${summary.score} pts`,
    points: summary.score,
    details,
    actions,
  });
}

const roundHandlers = {
  overlayElements,
  ticketHandlers,
  coinHandlers,
  onTimeout: handleTimeout,
  onProceed: handleProceed,
  onExit: navigateToMenu,
};

if (clearButton) {
  clearButton.addEventListener('click', () => {
    if (!roundActive) return;
    clearTickets(SESSION);
    syncUI();
  });
}

if (closeButton) {
  closeButton.addEventListener('click', () => {
    stopRound();
    navigateToMenu();
  });
}

window.addEventListener('beforeunload', () => {
  stopRound();
});

renderCoins(SESSION, elements, coinHandlers);
roundActive = true;
startRound(elements, roundHandlers);
