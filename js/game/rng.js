import { ALL_TICKETS } from './constants.js';

const ALWAYS_INCLUDED = new Set(['Normal', 'Kid']);

function triangular(min, max, mode) {
  if (max <= min) {
    return min;
  }
  const clampedMode = Math.min(Math.max(mode, min), max);
  const u = Math.random();
  const c = (clampedMode - min) / (max - min);
  if (u === c) {
    return clampedMode;
  }
  if (u < c) {
    return min + Math.sqrt(u * (max - min) * (clampedMode - min));
  }
  return max - Math.sqrt((1 - u) * (max - min) * (max - clampedMode));
}

function triangularInt(min, max, mode) {
  return Math.round(triangular(min, max, mode));
}

function clampInt(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function roundToCents(value) {
  return Math.round(value * 100) / 100;
}

export function rollBusConfig() {
  const minTypes = 2;
  const maxTypes = Math.min(7, ALL_TICKETS.length);
  const desired = clampInt(triangularInt(minTypes, maxTypes, 4), minTypes, maxTypes);

  const base = ALL_TICKETS.filter((ticket) => ALWAYS_INCLUDED.has(ticket.name));
  const others = shuffle(ALL_TICKETS.filter((ticket) => !ALWAYS_INCLUDED.has(ticket.name)));
  const result = [...base];

  for (const ticket of others) {
    if (result.length >= desired) {
      break;
    }
    result.push(ticket);
  }

  return shuffle(result);
}

export function rollRequest(available) {
  const pool = shuffle(available);
  const minTypes = Math.min(2, pool.length);
  const maxTypes = Math.min(7, pool.length);
  const desired = clampInt(triangularInt(minTypes, maxTypes, Math.min(5, maxTypes)), minTypes, maxTypes);

  const requestTickets = [];
  const remaining = [...pool];

  for (let i = remaining.length - 1; i >= 0; i -= 1) {
    const ticket = remaining[i];
    if (ALWAYS_INCLUDED.has(ticket.name) && !requestTickets.some((item) => item.name === ticket.name)) {
      requestTickets.push(ticket);
      remaining.splice(i, 1);
    }
  }

  while (requestTickets.length < desired && remaining.length) {
    requestTickets.push(remaining.shift());
  }

  const request = {};
  requestTickets.forEach((ticket) => {
    const count = clampInt(triangularInt(2, 7, 4), 2, 7);
    request[ticket.name] = count;
  });
  return request;
}

export function fareOf(request) {
  return Object.entries(request).reduce((total, [name, count]) => {
    const ticket = ALL_TICKETS.find((item) => item.name === name);
    if (!ticket) {
      return total;
    }
    return total + ticket.price * count;
  }, 0);
}

export function rollPayment(fare) {
  const minChange = 0.16;
  const maxChange = 7;
  const preferredMode = 0.84;
  const change = clampInt(roundToCents(triangular(minChange, maxChange, preferredMode)), minChange, maxChange);
  const pays = roundToCents(fare + change);
  return {
    pays,
    change,
  };
}
