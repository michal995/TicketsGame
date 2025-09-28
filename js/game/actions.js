import { ALL_TICKETS } from './constants.js';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const round = (value) => Math.round(value * 100) / 100;

function ticketByName(name) {
  return ALL_TICKETS.find((ticket) => ticket.name === name);
}

function logHistory(session, message, value) {
  session.history.push({ message, value });
}

export function addTicket(session, ticketName) {
  const ticket = ticketByName(ticketName);
  if (!ticket) {
    return false;
  }
  const limit = session.request[ticketName] || Infinity;
  const current = session.selectedTickets[ticketName] || 0;
  if (current >= limit) {
    return false;
  }
  session.selectedTickets[ticketName] = current + 1;
  session.selectedTotal = round(session.selectedTotal + ticket.price);
  logHistory(session, `Added ${ticket.name}`, `+${currency.format(ticket.price)}`);
  return true;
}

export function removeTicket(session, ticketName) {
  const ticket = ticketByName(ticketName);
  if (!ticket) {
    return false;
  }
  const current = session.selectedTickets[ticketName] || 0;
  if (current <= 0) {
    return false;
  }
  session.selectedTickets[ticketName] = current - 1;
  if (session.selectedTickets[ticketName] === 0) {
    delete session.selectedTickets[ticketName];
  }
  session.selectedTotal = round(session.selectedTotal - ticket.price);
  session.payFlashShown = false;
  session.payFlashPending = false;
  logHistory(session, `Removed ${ticket.name}`, `-${currency.format(ticket.price)}`);
  return true;
}

export function clearTickets(session) {
  session.selectedTickets = {};
  session.selectedTotal = 0;
  session.showPays = false;
  session.payRevealPending = false;
  session.payRevealShown = false;
  session.canPay = false;
  session.payFlashShown = false;
  session.payFlashPending = false;
  logHistory(session, 'Cleared tickets', '$0.00');
}

export function insertCoin(session, value) {
  if (!session.canPay) {
    return false;
  }
  const roundedValue = round(value);
  const changeDue = Number(session.changeDue) || 0;
  const totalIfInserted = round(session.inserted + roundedValue);

  if (changeDue <= 0 && roundedValue > 0) {
    return false;
  }

  if (changeDue > 0 && totalIfInserted - changeDue > 0.009) {
    return false;
  }

  const previousInserted = session.inserted;
  session.coinsUsed[roundedValue] = (session.coinsUsed[roundedValue] || 0) + 1;
  session.inserted = totalIfInserted;
  const formatted = currency.format(roundedValue);
  if (!session.showChange) {
    session.showChange = true;
  }
  logHistory(session, 'Returned', `+${formatted}`);

  const updatedChangeDue = Number(session.changeDue) || 0;
  const wasSettled =
    updatedChangeDue === 0
      ? previousInserted === 0
      : Math.abs(updatedChangeDue - previousInserted) < 0.01 || previousInserted > updatedChangeDue;
  const nowSettled =
    updatedChangeDue === 0
      ? session.inserted === 0
      : Math.abs(updatedChangeDue - session.inserted) < 0.01 || session.inserted > updatedChangeDue;

  if (!wasSettled && nowSettled) {
    session.payFlashPending = true;
    session.payFlashShown = true;
  }
  return true;
}

export function resetCoins(session) {
  session.coinsUsed = {};
  session.inserted = 0;
  session.showChange = false;
  session.payFlashShown = false;
  session.payFlashPending = false;
  logHistory(session, 'Change cleared', '$0.00');
}
