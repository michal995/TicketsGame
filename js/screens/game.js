import { GAME_MODES, getAvailableDenominations } from '../game/constants.js';
import { SESSION, startSession, endSession } from '../game/state.js';
import { startRound, finishRound, stopRound } from '../game/round.js';
import { addTicket, removeTicket, clearTickets, insertCoin } from '../game/actions.js';
import { renderTickets, renderCoins, updateHud, renderHistory, showOverlay, hideOverlay } from '../game/render.js';
import { playClickFeedback, flyScoreLabel, applyCorrectFeedback, applyErrorFeedback } from '../game/effects.js';
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

const NEGATIVE_SIGN = '\u2013';
const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const getNow = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());

function formatPoints(points) {
  const absolute = Math.abs(points);
  if (points > 0) {
    return `+${absolute}`;
  }
  if (points < 0) {
    return `${NEGATIVE_SIGN}${absolute}`;
  }
  return '0';
}

function logScoreEvent(message, points) {
  SESSION.history.push({ message, value: `${formatPoints(points)} pts` });
}

function recordRoundEvent({ type, label, points, source, tone, displayText }) {
  SESSION.roundEvents.push({ type, label, points });
  SESSION.roundScore += points;
  SESSION.score += points;
  updateHud(SESSION, elements);
  if (source && elements.scoreDisplay) {
    flyScoreLabel({
      source,
      target: elements.scoreDisplay,
      text: displayText ?? formatPoints(points),
      tone: tone ?? (points >= 0 ? 'positive' : 'negative'),
      duration: 780,
    });
  }
}

function resetCoinProgress() {
  SESSION.coinsUsed = {};
  SESSION.inserted = 0;
  SESSION.showChange = false;
}

function lockTicketPhase({ resetCoins = false } = {}) {
  SESSION.ticketsPhaseComplete = false;
  SESSION.ticketsPhaseCompletedAt = 0;
  SESSION.canPay = false;
  SESSION.showPays = false;
  SESSION.payFlashPending = false;
  SESSION.payFlashShown = false;
  if (resetCoins) {
    resetCoinProgress();
  }
}

function completeTicketPhase() {
  if (SESSION.ticketsPhaseComplete) {
    return;
  }
  SESSION.ticketsPhaseComplete = true;
  SESSION.ticketsPhaseCompletedAt = getNow();
  SESSION.showPays = true;
  SESSION.canPay = true;
  SESSION.payFlashPending = true;
  SESSION.payFlashShown = true;
}

function ticketsAreComplete() {
  const requestEntries = Object.entries(SESSION.request);
  if (!requestEntries.length) {
    return false;
  }
  return requestEntries.every(([name, count]) => (SESSION.selectedTickets[name] || 0) === count);
}

function ensureTicketPhaseState() {
  if (ticketsAreComplete()) {
    completeTicketPhase();
  } else if (SESSION.ticketsPhaseComplete || SESSION.showPays || SESSION.canPay) {
    lockTicketPhase({ resetCoins: true });
  }
}

function getScoreSourceFallback() {
  return elements.scoreCard || elements.scoreDisplay;
}

const ticketHandlers = {
  onAddTicket: (name, event) => {
    if (!roundActive) return;
    const button = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    const result = addTicket(SESSION, name);
    if (result.success) {
      if (button) {
        playClickFeedback(button);
        applyCorrectFeedback(button);
      }
      logScoreEvent(`Ticket — ${name}`, 10);
      recordRoundEvent({
        type: 'ticket',
        label: `Ticket — ${name}`,
        points: 10,
        source: button || getScoreSourceFallback(),
        tone: 'positive',
        displayText: formatPoints(10),
      });
      ensureTicketPhaseState();
    } else if (result.reason) {
      if (button) {
        playClickFeedback(button);
        applyErrorFeedback(button);
      }
      logScoreEvent(`Penalty — ${name}`, -25);
      recordRoundEvent({
        type: 'penalty',
        label: `Ticket penalty (${name})`,
        points: -25,
        source: button || getScoreSourceFallback(),
        tone: 'negative',
        displayText: formatPoints(-25),
      });
    }
    syncUI();
  },
  onRemoveTicket: (name, event) => {
    if (!roundActive) return;
    const button = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    const result = removeTicket(SESSION, name);
    if (result.success) {
      if (button) {
        playClickFeedback(button);
      }
      lockTicketPhase({ resetCoins: true });
    }
    syncUI();
  },
};

const coinHandlers = {
  getAvailableCoins: () => getAvailableDenominations(SESSION.coinOptions),
  onInsertCoin: (value, event) => {
    if (!roundActive) return;
    const button = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    if (button) {
      playClickFeedback(button);
    }
    const result = insertCoin(SESSION, value);
    if (!result?.success) {
      syncUI();
      return;
    }

    const epsilon = 0.009;
    const overpay = result.changeDue === 0 ? result.inserted > epsilon : result.inserted - result.changeDue > epsilon;

    if (overpay) {
      if (button) {
        applyErrorFeedback(button);
      }
      logScoreEvent('Penalty — change exceeded', -60);
      recordRoundEvent({
        type: 'penalty',
        label: 'Change exceeded',
        points: -60,
        source: button || getScoreSourceFallback(),
        tone: 'negative',
        displayText: formatPoints(-60),
      });
      syncUI();
      if (!finishing) {
        finishing = true;
        roundActive = false;
        Promise.resolve(finishRound(elements, roundHandlers, 'overpay'))
          .catch((error) => console.error(error))
          .finally(() => {
            finishing = false;
          });
      }
      return;
    }

    if (button) {
      applyCorrectFeedback(button);
    }
    logScoreEvent(`Coin ${currency.format(result.value)}`, 5);
    recordRoundEvent({
      type: 'coin',
      label: `Coin ${currency.format(result.value)}`,
      points: 5,
      source: button || getScoreSourceFallback(),
      tone: 'positive',
      displayText: formatPoints(5),
    });
    syncUI();
  },
};

function navigateToMenu() {
  window.location.href = 'index.html';
}

function syncUI() {
  ensureTicketPhaseState();
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
  if (!SESSION.ticketsPhaseComplete) {
    return;
  }
  const changeDue = Number(SESSION.changeDue) || 0;
  const inserted = Number(SESSION.inserted) || 0;
  const settled = changeDue === 0 ? Math.abs(inserted) < 0.01 : Math.abs(changeDue - inserted) < 0.01;
  if (!settled) {
    return;
  }
  finishing = true;
  roundActive = false;
  Promise.resolve(finishRound(elements, roundHandlers, 'completed'))
    .catch((error) => console.error(error))
    .finally(() => {
      finishing = false;
    });
}

function handleTimeout() {
  if (!roundActive || finishing) return;
  logScoreEvent('Penalty — timeout', -80);
  recordRoundEvent({
    type: 'penalty',
    label: 'Timeout',
    points: -80,
    source: elements.timerDisplay || getScoreSourceFallback(),
    tone: 'negative',
    displayText: formatPoints(-80),
  });
  roundActive = false;
  finishing = true;
  syncUI();
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
    resetCoinProgress();
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
