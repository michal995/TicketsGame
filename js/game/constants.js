export const ALL_TICKETS = [
  { name: 'Normal', price: 1.2, className: 't-normal' },
  { name: 'Kid', price: 0.5, className: 't-kid' },
  { name: 'Luggage', price: 0.6, className: 't-luggage' },
  { name: 'Senior', price: 0.8, className: 't-senior' },
  { name: 'Disabled', price: 0.6, className: 't-disabled' },
  { name: 'Baby Stroller', price: 0.7, className: 't-stroller' },
  { name: 'Bike', price: 0.9, className: 't-bike' },
  { name: 'Tourist', price: 1.5, className: 't-tourist' },
];

export const COINS = [5, 2, 1, 0.5, 0.25, 0.1, 0.05, 0.01];

export const GAME_MODES = {
  TB1: { label: 'Top/Bottom 1', timeLimit: 20, description: 'Classic rush with single passenger focus.' },
  TB2: { label: 'Top/Bottom 2', timeLimit: 25, description: 'Longer time window and bigger groups.' },
  HR1: { label: 'Horizontal 1', timeLimit: 18, description: 'Quick-fire requests, perfect for warm-ups.' },
  HR2: { label: 'Horizontal 2', timeLimit: 22, description: 'Balanced challenge with varied passengers.' },
};

export const DEFAULT_MODE = 'TB1';
export const TOTAL_ROUNDS = 5;
