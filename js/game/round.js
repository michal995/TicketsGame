import { SESSION, resetRoundState } from './state.js';
import { GAME_MODES } from './constants.js';
import { rollBusConfig, rollRequest, fareOf, rollPayment } from './rng.js';
import { renderTickets, renderCoins, updateHud, renderHistory, showOverlay, hideOverlay } from './render.js';

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

function countTickets(request) {
  return Object.values(request).reduce((sum, count) => sum + count, 0);
}

function minimalDenominationCount(amount, denominations = []) {
  const cents = toCents(amount);
  if (cents === 0) {
    return 0;
  }
  const values = Array.from(new Set(denominations.map((item) => toCents(item.value)))).filter((value) => value > 0);
  if (!values.length) {
    return Number.POSITIVE_INFINITY;
  }
  values.sort((a, b) => a - b);
  const dp = new Array(cents + 1).fill(Number.POSITIVE_INFINITY);
  dp[0] = 0;
  for (const value of values) {
    for (let i = value; i <= cents; i += 1) {
      if (dp[i - value] + 1 < dp[i]) {
        dp[i] = dp[i - value] + 1;
      }
    }
  }
  return dp[cents];
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

function getScoreAnchor(elements) {
  if (typeof HTMLElement === 'undefined') {
    return null;
  }
  if (elements.scoreCard instanceof HTMLElement) {
    return elements.scoreCard;
  }
  if (elements.scoreDisplay instanceof HTMLElement) {
    return elements.scoreDisplay.closest('.stat-card');
  }
  return null;
}

function showBonusToast(anchor, text) {
  return new Promise((resolve) => {
    if (!anchor) {
      resolve();
      return;
    }
    const toast = document.createElement('div');
    toast.className = 'score-bonus-toast';
    toast.textContent = text;
    anchor.appendChild(toast);
    const cleanup = () => {
      toast.removeEventListener('animationend', cleanup);
      toast.remove();
      resolve();
    };
    toast.addEventListener('animationend', cleanup, { once: true });
  });
}

async function applyBonuses(bonuses, elements) {
  if (!bonuses.length) {
    return 0;
  }
  const anchor = getScoreAnchor(elements);
  let total = 0;
  for (const bonus of bonuses) {
    await showBonusToast(anchor, bonus.toast || `+${bonus.label}`);
    SESSION.score = Math.max(0, SESSION.score + bonus.points);
    updateHud(SESSION, elements);
    total += bonus.points;
  }
  return total;
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

  hideOverlay(handlers.overlayElements.overlay);

  renderTickets(SESSION, elements, handlers.ticketHandlers);
  renderCoins(SESSION, elements, handlers.coinHandlers);
  renderHistory(SESSION, elements);
  updateHud(SESSION, elements);

  startCountdown(elements, handlers.onTimeout);
}

const BONUS_POINTS = {
  speed: 35,
  perfect: 40,
  time: 20,
};

export async function finishRound(elements, handlers, reason) {
  clearTimer();
  clearOverlayCountdown();
  renderHistory(SESSION, elements);
  updateHud(SESSION, elements);

  const perfectTickets = requestsMatch(SESSION.request, SESSION.selectedTickets);
  const ticketValueMatch = Math.abs(SESSION.selectedTotal - SESSION.ticketTotal) < 0.01;
  const changeDelta = roundValue(SESSION.inserted - SESSION.changeDue);
  const totalCoinsUsed = Object.values(SESSION.coinsUsed).reduce((sum, count) => sum + count, 0);
  const uniqueCoinsUsed = Object.keys(SESSION.coinsUsed).filter((key) => SESSION.coinsUsed[key] > 0).length;
  const availableDenoms =
    typeof handlers.coinHandlers?.getAvailableCoins === 'function'
      ? handlers.coinHandlers.getAvailableCoins()
      : handlers.coinHandlers?.availableCoins || [];
  const changeExact = Math.abs(changeDelta) < 0.01;
  const minimalCount = minimalDenominationCount(SESSION.changeDue, availableDenoms);
  const perfectChangeCombo = changeExact && Number.isFinite(minimalCount) && totalCoinsUsed === minimalCount;
  const elapsedSeconds = Math.max(0, (getNow() - (SESSION.roundStartTime || getNow())) / 1000);
  const ticketCount = SESSION.ticketCount || countTickets(SESSION.request);

  let basePoints = 0;
  if (perfectTickets) {
    basePoints += 70;
  } else if (ticketValueMatch) {
    basePoints += 30;
  } else {
    basePoints -= 20;
  }

  if (perfectChangeCombo) {
    basePoints += 30;
  } else if (changeExact) {
    basePoints += 12;
  } else if (changeDelta > 0) {
    basePoints += 6;
  } else {
    basePoints -= 30;
  }

  basePoints += Math.round(SESSION.timeLeft / 2);

  SESSION.score = Math.max(0, SESSION.score + basePoints);
  updateHud(SESSION, elements);

  const completed = reason === 'completed';
  const bonuses = [];

  if (completed && ticketCount > 0 && elapsedSeconds < ticketCount * 0.75) {
    bonuses.push({ id: 'speed', label: 'Speed Bonus!', toast: '+Speed Bonus!', points: BONUS_POINTS.speed });
  }

  if (completed && perfectChangeCombo) {
    bonuses.push({ id: 'perfect', label: 'Perfect Change!', toast: '+Perfect Change!', points: BONUS_POINTS.perfect });
  }

  if (completed && SESSION.timeLeft > 5) {
    bonuses.push({ id: 'time', label: 'Time Bonus!', toast: '+Time Bonus!', points: BONUS_POINTS.time });
  }

  SESSION.roundBonuses = bonuses.map((bonus) => ({ id: bonus.id, label: bonus.label, points: bonus.points }));

  const bonusPoints = await applyBonuses(bonuses, elements);
  const totalPoints = basePoints + bonusPoints;

  const details = [
    {
      label: 'Tickets',
      value: perfectTickets ? 'Perfect match' : ticketValueMatch ? 'Value matched' : 'Mismatch',
    },
    {
      label: 'Change',
      value: changeExact
        ? perfectChangeCombo
          ? 'Perfect change'
          : 'Exact'
        : changeDelta > 0
        ? `${formatMoney(changeDelta)} extra`
        : `${formatMoney(Math.abs(changeDelta))} missing`,
    },
    {
      label: 'Time left',
      value: `${Math.round(SESSION.timeLeft)} s`,
    },
    {
      label: 'Coins used',
      value: `${totalCoinsUsed} (${uniqueCoinsUsed} types)`,
    },
  ];

  SESSION.roundSummaries.push({
    round: SESSION.round,
    points: totalPoints,
    basePoints,
    bonuses: [...SESSION.roundBonuses],
    perfectTickets,
    ticketValueMatch,
    changeDelta,
    timeLeft: SESSION.timeLeft,
    elapsedSeconds,
    reason,
    coinsUsed: totalCoinsUsed,
    ticketCount,
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

  const overlayContent = {
    title: `Round ${SESSION.round}/${SESSION.totalRounds}`,
    subtitle: reason === 'timeout' ? 'Time is up!' : 'Round finished',
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
