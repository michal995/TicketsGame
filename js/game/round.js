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

let timerId = null;

function clearTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
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
  SESSION.pays = rollPayment(SESSION.ticketTotal);
  SESSION.history = [];
  SESSION.showChange = false;

  hideOverlay(handlers.overlayElements.overlay);

  renderTickets(SESSION, elements, handlers.ticketHandlers);
  renderCoins(SESSION, elements, handlers.coinHandlers);
  renderHistory(SESSION, elements);
  updateHud(SESSION, elements);

  startCountdown(elements, handlers.onTimeout);
}

export function finishRound(elements, handlers, reason) {
  clearTimer();
  renderHistory(SESSION, elements);
  updateHud(SESSION, elements);

  const perfectTickets = requestsMatch(SESSION.request, SESSION.selectedTickets);
  const ticketValueMatch = Math.abs(SESSION.selectedTotal - SESSION.ticketTotal) < 0.01;
  const paymentDelta = roundValue(SESSION.inserted - SESSION.pays);

  let points = 0;
  if (perfectTickets) {
    points += 70;
  } else if (ticketValueMatch) {
    points += 30;
  } else {
    points -= 20;
  }

  if (Math.abs(paymentDelta) < 0.01) {
    points += 30;
  } else if (paymentDelta > 0) {
    points += 10;
  } else {
    points -= 30;
  }

  points += Math.round(SESSION.timeLeft / 2);

  SESSION.score = Math.max(0, SESSION.score + points);
  SESSION.roundSummaries.push({
    round: SESSION.round,
    points,
    perfectTickets,
    ticketValueMatch,
    paymentDelta,
    timeLeft: SESSION.timeLeft,
    reason,
  });

  const details = [
    {
      label: 'Tickets',
      value: perfectTickets ? 'Perfect match' : ticketValueMatch ? 'Value matched' : 'Mismatch',
    },
    {
      label: 'Payment',
      value:
        paymentDelta === 0
          ? 'Exact'
          : paymentDelta > 0
          ? `${formatMoney(paymentDelta)} change`
          : `${formatMoney(paymentDelta)} missing`,
    },
    {
      label: 'Time left',
      value: `${Math.round(SESSION.timeLeft)} s`,
    },
  ];

  const overlayContent = {
    title: `Round ${SESSION.round}/${SESSION.totalRounds}`,
    subtitle: reason === 'timeout' ? 'Time is up!' : 'Round finished',
    points,
    details,
    actions: [],
  };

  const proceed = () => {
    handlers.onProceed();
  };

  const backToMenu = () => {
    handlers.onExit();
  };

  if (SESSION.round < SESSION.totalRounds) {
    overlayContent.actions.push({ label: 'Next round', onSelect: proceed });
  } else {
    overlayContent.actions.push({ label: 'Summary', onSelect: proceed });
  }

  overlayContent.actions.push({ label: 'Back to Menu', onSelect: backToMenu });

  showOverlay(handlers.overlayElements, overlayContent);
}

export function stopRound() {
  clearTimer();
}
