const STORAGE_KEY = 'ticket-rush';

function defaultStore() {
  return {
    users: [],
    scores: [],
    stats: {
      gamesPlayed: 0,
      bestScore: 0,
    },
  };
}

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultStore();
    }
    const parsed = JSON.parse(raw);
    return {
      ...defaultStore(),
      ...parsed,
    };
  } catch (error) {
    console.warn('TicketsGame: unable to read localStorage, resetting.', error);
    return defaultStore();
  }
}

function saveStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    console.warn('TicketsGame: unable to persist localStorage.', error);
  }
}

export function rememberUser(name) {
  const store = loadStore();
  if (name && !store.users.includes(name)) {
    store.users.push(name);
    saveStore(store);
  }
}

export function getUsers() {
  const store = loadStore();
  return store.users.slice().sort((a, b) => a.localeCompare(b));
}

export function recordScore(entry) {
  const store = loadStore();
  store.scores.push({ ...entry, timestamp: Date.now() });
  if (entry.score > store.stats.bestScore) {
    store.stats.bestScore = entry.score;
  }
  store.stats.gamesPlayed += 1;
  saveStore(store);
}

export function getStats() {
  const store = loadStore();
  return { ...store.stats };
}
