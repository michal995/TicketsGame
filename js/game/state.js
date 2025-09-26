import { GAME_MODES, DEFAULT_MODE, TOTAL_ROUNDS } from './constants.js';

function resolveMode(mode) {
  if (mode && GAME_MODES[mode]) {
    return mode;
  }
  return DEFAULT_MODE;
}

function baseRoundState(timeLimit) {
  return {
    available: [],
    request: {},
    ticketTotal: 0,
    pays: 0,
    selectedTickets: {},
    selectedTotal: 0,
    coinsUsed: {},
    inserted: 0,
    timeLeft: timeLimit,
    history: [],
    showChange: false,
  };
}

export const SESSION = {
  player: 'Guest',
  mode: DEFAULT_MODE,
  round: 0,
  totalRounds: TOTAL_ROUNDS,
  score: 0,
  roundSummaries: [],
  ...baseRoundState(GAME_MODES[DEFAULT_MODE].timeLimit),
};

export function startSession(player, mode) {
  const safePlayer = player?.trim() || 'Guest';
  const resolvedMode = resolveMode(mode);
  const timeLimit = GAME_MODES[resolvedMode].timeLimit;

  SESSION.player = safePlayer;
  SESSION.mode = resolvedMode;
  SESSION.round = 0;
  SESSION.score = 0;
  SESSION.roundSummaries = [];
  SESSION.totalRounds = TOTAL_ROUNDS;

  Object.assign(SESSION, baseRoundState(timeLimit));

  return SESSION;
}

export function resetRoundState() {
  const timeLimit = GAME_MODES[SESSION.mode].timeLimit;
  Object.assign(SESSION, baseRoundState(timeLimit));
}

export function endSession() {
  return {
    player: SESSION.player,
    mode: SESSION.mode,
    score: SESSION.score,
    rounds: SESSION.round,
    summaries: [...SESSION.roundSummaries],
  };
}
