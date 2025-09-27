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
  const request = { Normal: 1, Kid: 1 };
  const included = new Set(Object.keys(request));
  const totalTickets = clampInt(triangularInt(2, 8, 5), 2, 8);
  let remaining = totalTickets - included.size;

  const optionalCandidates = pool.filter((ticket) => !ALWAYS_INCLUDED.has(ticket.name));

  for (let i = 0; i < optionalCandidates.length && remaining > 0; i += 1) {
    if (Math.random() < 0.55) {
      const ticket = optionalCandidates.splice(i, 1)[0];
      request[ticket.name] = 1;
      included.add(ticket.name);
      remaining -= 1;
      i -= 1;
    }
  }

  while (remaining > 0) {
    const nextIndex = optionalCandidates.findIndex((ticket) => !included.has(ticket.name));
    if (nextIndex !== -1 && Math.random() < 0.35) {
      const ticket = optionalCandidates.splice(nextIndex, 1)[0];
      request[ticket.name] = 1;
      included.add(ticket.name);
      remaining -= 1;
      continue;
    }
    const names = Array.from(included);
    const pick = names[Math.floor(Math.random() * names.length)];
    request[pick] += 1;
    remaining -= 1;
  }

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
