export const ALL_TICKETS = [
  { name: 'Normal', price: 1.2, className: 't-normal', icon: '🧍' },
  { name: 'Kid', price: 0.5, className: 't-kid', icon: '🧒' },
  { name: 'Luggage', price: 0.6, className: 't-luggage', icon: '🧳' },
  { name: 'Senior', price: 0.8, className: 't-senior', icon: '👴' },
  { name: 'Disabled', price: 0.6, className: 't-disabled', icon: '♿' },
  { name: 'Baby Stroller', price: 0.7, className: 't-stroller', icon: '👶' },
  { name: 'Bike', price: 0.9, className: 't-bike', icon: '🚲' },
  { name: 'Tourist', price: 1.5, className: 't-tourist', icon: '🧭' },
];

export const BILLS = [
  { value: 5, type: 'bill', skin: 'bill', label: '$5 bill', icon: '⑤' },
  { value: 2, type: 'bill', skin: 'bill', label: '$2 bill', icon: '②', toggleKey: 'allowTwo' },
  { value: 1, type: 'bill', skin: 'bill', label: '$1 bill', icon: '①' },
];

export const COINS = [
  { value: 0.5, type: 'coin', skin: 'gold', label: 'Half dollar', icon: '◎' },
  { value: 0.2, type: 'coin', skin: 'gold', label: 'Twenty cents', icon: '◑' },
  { value: 0.1, type: 'coin', skin: 'gold', label: 'Dime', icon: '◉' },
  { value: 0.05, type: 'coin', skin: 'gold', label: 'Nickel', icon: '◍' },
  { value: 0.01, type: 'coin', skin: 'gold', label: 'Penny', icon: '∙', toggleKey: 'allowOneCent' },
];

export const DENOMINATIONS = [...BILLS, ...COINS];

export const COIN_TOGGLES = {
  allowTwo: true,
  allowOneCent: true,
};

export function getAvailableDenominations(overrides = {}) {
  const toggles = { ...COIN_TOGGLES, ...overrides };
  return DENOMINATIONS.filter((item) => {
    if (!item.toggleKey) {
      return true;
    }
    return toggles[item.toggleKey] !== false;
  });
}

export const LAYOUTS = {
  TOP_BOTTOM: 'top-bottom',
  LEFT_RIGHT: 'left-right',
};

export const GAME_MODES = {
  TB1: { label: 'Vertical 1', timeLimit: 20, description: 'Classic rush with single passenger focus.' },
  TB2: { label: 'Vertical 2', timeLimit: 25, description: 'Longer time window and bigger groups.' },
  HR1: { label: 'Horizontal 1', timeLimit: 18, description: 'Quick-fire requests, perfect for warm-ups.' },
  HR2: { label: 'Horizontal 2', timeLimit: 22, description: 'Balanced challenge with varied passengers.' },
};

export const DEFAULT_MODE = 'TB1';
export const DEFAULT_LAYOUT = LAYOUTS.TOP_BOTTOM;
export const TOTAL_ROUNDS = 5;
