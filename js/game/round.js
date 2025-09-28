import { SESSION, resetRoundState } from './state.js';
import { GAME_MODES } from './constants.js';
import { rollBusConfig, rollRequest, fareOf, rollPayment } from './rng.js';
import { renderTickets, renderCoins, updateHud, renderHistory, showOverlay, hideOverlay } from './render.js';
import { flyScoreLabel } from './effects.js';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const roundValue = (value) => Math.round(value * 100) / 100;

function formatMoney(value) {
  return currency.format(Number.isFinite(value) ? Math.abs(value) : 0);
}

const getNow = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
const toCents = (value) => Math.round(Math.max(0, value) * 100);

const NEGATIVE_SIGN = '\u2013';

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

function logBonusHistory(label, points) {
  SESSION.history.push({ message: label, value: `${formatPoints(points)} pts` });
}

function awardBonus({ id, label, points, text }, elements) {
  if (!points) {
    return 0;
  }
  SESSION.roundEvents.push({ type: 'bonus', label, points });
  SESSION.roundBonuses.push({ id, label, points });
  SESSION.roundScore += points;
  SESSION.score += points;
  logBonusHistory(label, points);
  updateHud(SESSION, elements);
  const source = elements.scoreCard || elements.scoreDisplay;
  if (source && elements.scoreDisplay) {
    flyScoreLabel({
      source,
      target: elements.scoreDisplay,
      text: text ?? `+${label}`,
      tone: 'bonus',
      duration: 840,
    });
  }
  return points;
}

function countTickets(request) {
  return Object.values(request).reduce((sum, count) => sum + count, 0);
}

let timerId = null;
let overlayIntervalId = null;
let overlayTimeoutId = null;

function clearTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function clearOverlayCountdown() {
  if (overlayIntervalId) {
    clearInterval(overlayIntervalId);
    overlayIntervalId = null;
  }
  if (overlayTimeoutId) {
    clearTimeout(overlayTimeoutId);
    overlayTimeoutId = null;
  }
}

function startCountdown(elements, onTimeout) {
  const duration = GAME_MODES[SESSION.mode].timeLimit;
  SESSION.timeLeft = duration;
  updateHud(SESSION, elements);

  clearTimer();
  timerId = setInterval(() => {
    SESSION.timeLeft = Math.max(0, SESSION.timeLeft - 1);
    updateHud(SESSION, elements);
    if (SESSION.timeLeft <= 0) {
      clearTimer();
      onTimeout();
    }
  }, 1000);
}

function requestsMatch(request, selected) {
  const selectedKeys = Object.keys(selected);
  for (const [name, count] of Object.entries(request)) {
    if ((selected[name] || 0) !== count) {
      return false;
    }
  }
  return selectedKeys.every((name) => (request[name] || 0) === selected[name]);
}

export function startRound(elements, handlers) {
  resetRoundState();
  SESSION.round += 1;
  SESSION.available = rollBusConfig();
  SESSION.request = rollRequest(SESSION.available);
  SESSION.ticketTotal = Number(fareOf(SESSION.request).toFixed(2));
  const payment = rollPayment(SESSION.ticketTotal);
  SESSION.pays = payment.pays;
  SESSION.changeDue = Number(payment.change.toFixed(2));
  SESSION.history = [];
  SESSION.showChange = false;
  SESSION.showPays = false;
  SESSION.ticketCount = countTickets(SESSION.request);
  SESSION.roundStartTime = getNow();
  SESSION.roundBonuses = [];
  SESSION.roundScore = 0;
  SESSION.roundEvents = [];
  SESSION.ticketsPhaseComplete = false;
  SESSION.ticketsPhaseCompletedAt = 0;
  SESSION.payFlashPending = false;
  SESSION.payFlashShown = false;

  hideOverlay(handlers.overlayElements.overlay);

  renderTickets(SESSION, elements, handlers.ticketHandlers);
  renderCoins(SESSION, elements, handlers.coinHandlers);
  renderHistory(SESSION, elements);
  updateHud(SESSION, elements);

  startCountdown(elements, handlers.onTimeout);
}

export async function finishRound(elements, handlers, reason) {
  clearTimer();
  clearOverlayCountdown();
  renderHistory(SESSION, elements);
  updateHud(SESSION, elements);

  const completed = reason === 'completed';
  const ticketsMatch = requestsMatch(SESSION.request, SESSION.selectedTickets);
  const ticketCount = SESSION.ticketCount || countTickets(SESSION.request);
  const elapsedSeconds = Math.max(0, (getNow() - (SESSION.roundStartTime || getNow())) / 1000);
  const ticketPhaseSeconds = SESSION.ticketsPhaseCompletedAt
    ? Math.max(0, (SESSION.ticketsPhaseCompletedAt - (SESSION.roundStartTime || SESSION.ticketsPhaseCompletedAt)) / 1000)
    : Number.POSITIVE_INFINITY;
  const changeDelta = roundValue(SESSION.inserted - SESSION.changeDue);
  const changeExact = Math.abs(changeDelta) < 0.01;
  const totalCoinsUsed = Object.values(SESSION.coinsUsed).reduce((sum, count) => sum + count, 0);
  const uniqueCoinsUsed = Object.keys(SESSION.coinsUsed).filter((key) => SESSION.coinsUsed[key] > 0).length;

  SESSION.roundBonuses = [];

  if (completed) {
    if (ticketCount > 0 && Number.isFinite(ticketPhaseSeconds) && ticketPhaseSeconds < ticketCount * 0.75) {
      awardBonus({ id: 'speed', label: 'Speed Bonus!', points: 20, text: '+Speed Bonus!' }, elements);
    }
    if (changeExact && totalCoinsUsed >= 3) {
      awardBonus({ id: 'perfect', label: 'Perfect Change!', points: 15, text: '+Perfect Change!' }, elements);
    }
    if (SESSION.timeLeft > 5) {
      awardBonus({ id: 'time', label: 'Time Bonus!', points: 10, text: '+Time Bonus!' }, elements);
    }
  }

  renderHistory(SESSION, elements);

  const totalPoints = SESSION.roundScore;
  const remainingTime = Math.max(0, Math.round(SESSION.timeLeft));
  const changeLabel = changeExact
    ? SESSION.changeDue > 0
      ? 'Exact change'
      : 'No change due'
    : changeDelta > 0
    ? `${formatMoney(changeDelta)} extra`
    : `${formatMoney(Math.abs(changeDelta))} short`;

  const details = [
    { label: 'Tickets', value: ticketsMatch ? 'All served' : 'Needs review' },
    { label: 'Change', value: changeLabel },
    { label: 'Coins used', value: `${totalCoinsUsed} (${uniqueCoinsUsed} types)` },
    { label: 'Time left', value: `${remainingTime} s` },
  ];

  if (reason === 'overpay') {
    details.unshift({ label: 'Penalty', value: 'Change exceeded' });
  } else if (reason === 'timeout') {
    details.unshift({ label: 'Penalty', value: 'Time expired' });
  }

  SESSION.roundSummaries.push({
    round: SESSION.round,
    points: totalPoints,
    bonuses: [...SESSION.roundBonuses],
    reason,
    timeLeft: SESSION.timeLeft,
    elapsedSeconds,
    coinsUsed: totalCoinsUsed,
    ticketCount,
    changeDelta,
    ticketsComplete: ticketsMatch,
    events: [...SESSION.roundEvents],
  });

  const overlayCountdown = 5;
  let proceeded = false;

  const proceed = () => {
    if (proceeded) {
      return;
    }
    proceeded = true;
    clearOverlayCountdown();
    hideOverlay(handlers.overlayElements.overlay);
    handlers.onProceed();
  };

  const backToMenu = () => {
    proceeded = true;
    clearOverlayCountdown();
    hideOverlay(handlers.overlayElements.overlay);
    handlers.onExit();
  };

  let subtitle = 'Round finished';
  if (reason === 'timeout') {
    subtitle = 'Time is up!';
  } else if (reason === 'overpay') {
    subtitle = 'Change exceeded!';
  }

  const overlayContent = {
    title: `Round ${SESSION.round}/${SESSION.totalRounds}`,
    subtitle,
    points: totalPoints,
    details,
    bonuses: SESSION.roundBonuses,
    countdown: overlayCountdown,
    countdownLabel: SESSION.round < SESSION.totalRounds ? 'Next passenger in…' : 'Summary in…',
    actions: [],
    onRender: ({ countdownEl }) => {
      let remaining = overlayCountdown;
      if (countdownEl) {
        countdownEl.textContent = String(remaining);
      }
      overlayIntervalId = setInterval(() => {
        remaining -= 1;
        if (countdownEl) {
          countdownEl.textContent = String(Math.max(0, remaining));
        }
        if (remaining <= 0) {
          proceed();
        }
      }, 1000);
      overlayTimeoutId = setTimeout(proceed, overlayCountdown * 1000);
    },
  };

  if (SESSION.round < SESSION.totalRounds) {
    overlayContent.actions.push({ label: 'Skip countdown', onSelect: proceed });
  } else {
    overlayContent.actions.push({ label: 'Show summary', onSelect: proceed });
  }

  overlayContent.actions.push({ label: 'Back to Menu', onSelect: backToMenu });

  showOverlay(handlers.overlayElements, overlayContent);
}

export function stopRound() {
  clearTimer();
  clearOverlayCountdown();
}
