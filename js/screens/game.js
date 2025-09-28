import { GAME_MODES, getAvailableDenominations, LAYOUTS, DEFAULT_LAYOUT } from '../game/constants.js';
import { SESSION, startSession, endSession } from '../game/state.js';
import { startRound, finishRound, stopRound, pauseCountdown, resumeCountdown } from '../game/round.js';
import { addTicket, removeTicket, clearTickets, insertCoin } from '../game/actions.js';
import { renderTickets, renderCoins, updateHud, renderHistory, showOverlay, hideOverlay } from '../game/render.js';
import { playClickFeedback, flyScoreLabel, applyCorrectFeedback, applyErrorFeedback } from '../game/effects.js';
import { recordScore } from '../storage/db.js';

let initialized = false;
let menuCallback = null;

const elements = {
  root: null,
  scoreDisplay: null,
  scoreCard: null,
  timerDisplay: null,
  needEl: null,
  paysEl: null,
  paysCard: null,
  fareEl: null,
  pickedEl: null,
  remainEl: null,
  ticketsWrap: null,
  coinsWrap: null,
  changeWrap: null,
  modeLabel: null,
};

const overlayElements = {
  overlay: null,
  box: null,
};

let roundHandlers = null;
let clearButton = null;
let closeButton = null;

let roundActive = false;
let finishing = false;
let paused = false;

const NEGATIVE_SIGN = '\u2013';
const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const getNow = () =>
  (typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now());

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

function normalizeLayout(value) {
  return value === LAYOUTS.LEFT_RIGHT || value === LAYOUTS.TOP_BOTTOM ? value : DEFAULT_LAYOUT;
}

function applyLayoutSetting(layout) {
  const resolved = normalizeLayout(layout ?? SESSION.layout);
  SESSION.layout = resolved;
  if (elements.root) {
    elements.root.dataset.layout = resolved;
  }
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
    if (!roundActive || paused) return;
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
    if (!roundActive || paused) return;
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
    if (!roundActive || paused) return;
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
    const overpay =
      result.changeDue === 0 ? result.inserted > epsilon : result.inserted - result.changeDue > epsilon;

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

function updateModeLabel(modeValue) {
  if (!elements.modeLabel) {
    return;
  }
  const activeMode = modeValue && GAME_MODES[modeValue] ? modeValue : SESSION.mode;
  const label = activeMode && GAME_MODES[activeMode] ? GAME_MODES[activeMode].label : '';
  elements.modeLabel.textContent = label;
}

function syncUI() {
  ensureTicketPhaseState();
  renderTickets(SESSION, elements, ticketHandlers);
  renderCoins(SESSION, elements, coinHandlers);
  updateHud(SESSION, elements);
  renderHistory(SESSION, elements);
  if (!paused) {
    maybeFinishRound();
  }
}

function maybeFinishRound() {
  if (!roundActive || finishing || paused) {
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
        stopGameSession();
        beginSession(summary.player, summary.mode, SESSION.layout);
      },
    },
    {
      label: 'Back to Menu',
      onSelect: () =>
        navigateToMenu({ player: summary.player, mode: summary.mode, layout: SESSION.layout }),
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

function resumeGame() {
  hideOverlay(overlayElements.overlay);
  paused = false;
  roundActive = true;
  resumeCountdown(elements);
  syncUI();
}

function restartGame() {
  const { player, mode, layout } = SESSION;
  stopGameSession();
  beginSession(player, mode, layout);
}

function stopGameSession({ keepOverlay = false } = {}) {
  stopRound();
  roundActive = false;
  paused = false;
  finishing = false;
  if (!keepOverlay) {
    hideOverlay(overlayElements.overlay);
  }
}

function beginSession(player, mode, layout = SESSION.layout) {
  const resolvedLayout = normalizeLayout(layout);
  startSession(player, mode, resolvedLayout);
  applyLayoutSetting(resolvedLayout);
  updateModeLabel(SESSION.mode);
  resetCoinProgress();
  hideOverlay(overlayElements.overlay);
  paused = false;
  finishing = false;
  roundActive = true;
  renderCoins(SESSION, elements, coinHandlers);
  startRound(elements, roundHandlers);
}

function startGameSession({ player, mode, layout }) {
  stopGameSession();
  beginSession(player, mode, layout ?? SESSION.layout);
}

function navigateToMenu(details) {
  const payload =
    details ||
    (SESSION.player
      ? { player: SESSION.player, mode: SESSION.mode, layout: SESSION.layout }
      : undefined);
  stopGameSession();
  if (typeof menuCallback === 'function') {
    menuCallback(payload);
  }
}

function exitToMenu() {
  navigateToMenu({ player: SESSION.player, mode: SESSION.mode, layout: SESSION.layout });
}

function showPauseOverlay() {
  if (paused || finishing || !roundActive) {
    return;
  }
  paused = true;
  roundActive = false;
  pauseCountdown();

  const stats = document.createElement('div');
  stats.className = 'pause-stats';
  const roundLabel = Math.max(SESSION.round, 1);
  stats.innerHTML = `
    <div class="pause-row">
      <span class="pause-label">Score</span>
      <span class="pause-value">${Math.round(SESSION.score)} pts</span>
    </div>
    <div class="pause-row">
      <span class="pause-label">Time left</span>
      <span class="pause-value">${Math.max(0, Math.ceil(SESSION.timeLeft))} s</span>
    </div>
  `;

  showOverlay(overlayElements, {
    title: 'Game paused',
    subtitle: `Round ${roundLabel}/${SESSION.totalRounds}`,
    body: stats,
    actions: [
      { label: 'Resume game', onSelect: resumeGame },
      { label: 'Restart game', onSelect: restartGame },
      { label: 'Main menu', onSelect: exitToMenu },
    ],
  });
}

function handleClearTickets() {
  if (!roundActive || paused) {
    return;
  }
  clearTickets(SESSION);
  resetCoinProgress();
  syncUI();
}

export function initGameScreen({ onNavigateToMenu } = {}) {
  menuCallback = typeof onNavigateToMenu === 'function' ? onNavigateToMenu : null;

  elements.root = elements.root || document.getElementById('game-screen');

  if (!initialized) {
    elements.scoreDisplay = document.getElementById('score');
    elements.scoreCard = document.getElementById('score')?.closest('.stat-card') || null;
    elements.timerDisplay = document.getElementById('timer');
    elements.needEl = document.getElementById('need');
    elements.paysEl = document.getElementById('pays');
    elements.paysCard = document.getElementById('paysCard');
    elements.fareEl = document.getElementById('fare');
    elements.pickedEl = document.getElementById('picked');
    elements.remainEl = document.getElementById('remain');
    elements.ticketsWrap = document.getElementById('tickets');
    elements.coinsWrap = document.getElementById('coins');
    elements.changeWrap = document.querySelector('.pay');
    elements.modeLabel = document.getElementById('modeLabel');

    overlayElements.overlay = document.getElementById('overlay');
    overlayElements.box = document.getElementById('overlayBox');

    clearButton = document.getElementById('clearTickets');
    closeButton = document.getElementById('closeGame');

    clearButton?.addEventListener('click', handleClearTickets);
    closeButton?.addEventListener('click', showPauseOverlay);

    window.addEventListener('beforeunload', () => {
      stopRound();
    });

    roundHandlers = {
      overlayElements,
      ticketHandlers,
      coinHandlers,
      onTimeout: handleTimeout,
      onProceed: handleProceed,
      onExit: () => navigateToMenu(),
    };

    initialized = true;
  } else if (roundHandlers) {
    roundHandlers.overlayElements = overlayElements;
    roundHandlers.ticketHandlers = ticketHandlers;
    roundHandlers.coinHandlers = coinHandlers;
    roundHandlers.onTimeout = handleTimeout;
    roundHandlers.onProceed = handleProceed;
    roundHandlers.onExit = () => navigateToMenu();
  }

  applyLayoutSetting(SESSION.layout);

  return {
    start: startGameSession,
    stop: stopGameSession,
    applyLayout: applyLayoutSetting,
  };
}
