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
    return { success: false };
  }
  const available = session.available.some((item) => item.name === ticketName);
  if (!available) {
    logHistory(session, `${ticket.name} inactive`, '—');
    return { success: false, reason: 'inactive', ticket };
  }

  const limit = session.request[ticketName] || 0;
  const current = session.selectedTickets[ticketName] || 0;
  if (current >= limit) {
    const reason = limit === 0 ? 'not-requested' : 'excess';
    logHistory(session, `Too many ${ticket.name}`, '–');
    return { success: false, reason, ticket, limit, current };
  }
  session.selectedTickets[ticketName] = current + 1;
  session.selectedTotal = round(session.selectedTotal + ticket.price);
  logHistory(session, `Added ${ticket.name}`, `+${currency.format(ticket.price)}`);
  return {
    success: true,
    type: 'ticket',
    ticket,
    count: session.selectedTickets[ticketName],
    need: limit,
  };
}

export function removeTicket(session, ticketName) {
  const ticket = ticketByName(ticketName);
  if (!ticket) {
    return { success: false };
  }
  const current = session.selectedTickets[ticketName] || 0;
  if (current <= 0) {
    return { success: false };
  }
  session.selectedTickets[ticketName] = current - 1;
  if (session.selectedTickets[ticketName] === 0) {
    delete session.selectedTickets[ticketName];
  }
  session.selectedTotal = round(session.selectedTotal - ticket.price);
  logHistory(session, `Removed ${ticket.name}`, `-${currency.format(ticket.price)}`);
  return {
    success: true,
    ticket,
    count: session.selectedTickets[ticketName] || 0,
  };
}

export function clearTickets(session) {
  session.selectedTickets = {};
  session.selectedTotal = 0;
  session.showPays = false;
  session.canPay = false;
  session.payFlashShown = false;
  session.payFlashPending = false;
  session.ticketsPhaseComplete = false;
  session.ticketsPhaseCompletedAt = 0;
  logHistory(session, 'Cleared tickets', '$0.00');
}

export function insertCoin(session, value) {
  const roundedValue = round(value);
  session.coinsUsed[roundedValue] = (session.coinsUsed[roundedValue] || 0) + 1;
  session.inserted = round(session.inserted + roundedValue);
  const formatted = currency.format(roundedValue);
  if (!session.showChange) {
    session.showChange = true;
  }
  logHistory(session, 'Returned', `+${formatted}`);
  return {
    success: true,
    value: roundedValue,
    inserted: session.inserted,
    changeDue: session.changeDue,
  };
}

export function resetCoins(session) {
  session.coinsUsed = {};
  session.inserted = 0;
  session.showChange = false;
  session.payFlashShown = false;
  session.payFlashPending = false;
  logHistory(session, 'Change cleared', '$0.00');
}
