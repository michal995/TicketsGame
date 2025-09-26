import { ALL_TICKETS, COINS } from './constants.js';

export function rollBusConfig() {
  const minTotal = 2;
  const maxTotal = 6;
  const base = ALL_TICKETS.filter((ticket) => ticket.name === 'Normal' || ticket.name === 'Kid');
  const others = ALL_TICKETS.filter((ticket) => ticket.name !== 'Normal' && ticket.name !== 'Kid');
  const howMany = Math.floor(Math.random() * (maxTotal - minTotal + 1)) + minTotal;
  const shuffled = others
    .map((ticket) => ({ sort: Math.random(), ticket }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ ticket }) => ticket);
  return [...base, ...shuffled.slice(0, Math.max(0, howMany - base.length))];
}

export function rollRequest(available) {
  const pool = [...available];
  const unique = Math.min(pool.length, Math.floor(Math.random() * 2) + 1);
  const request = {};
  for (let i = 0; i < unique; i += 1) {
    const index = Math.floor(Math.random() * pool.length);
    const ticket = pool.splice(index, 1)[0];
    const count = Math.floor(Math.random() * 3) + 1;
    request[ticket.name] = count;
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

export function uniqCoins(coinsUsed) {
  return Object.keys(coinsUsed).filter((key) => coinsUsed[key] > 0).length;
}

function pickRandomCoin() {
  const index = Math.floor(Math.random() * COINS.length);
  return COINS[index];
}

export function rollPayment(fare) {
  const minTarget = Math.max(0, fare);
  let amount = 0;
  let coins = 0;
  while (amount < minTarget || (amount === minTarget && coins < 2)) {
    amount = Math.round((amount + pickRandomCoin()) * 100) / 100;
    coins += 1;
    if (coins > 24) {
      break;
    }
  }

  // Occasionally add extra change to keep things interesting.
  if (Math.random() < 0.5) {
    amount = Math.round((amount + pickRandomCoin()) * 100) / 100;
  }

  return Number(amount.toFixed(2));
}
