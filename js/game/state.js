import { GAME_MODES, DEFAULT_MODE, TOTAL_ROUNDS, COIN_TOGGLES } from './constants.js';

function defaultCoinOptions() {
  return { ...COIN_TOGGLES };
}

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
    ticketCount: 0,
    pays: 0,
    changeDue: 0,
    selectedTickets: {},
    selectedTotal: 0,
    coinsUsed: {},
    inserted: 0,
    timeLeft: timeLimit,
    history: [],
    showChange: false,
    showPays: false,
    canPay: false,
    payFlashPending: false,
    payFlashShown: false,
    roundStartTime: 0,
    roundBonuses: [],
    ticketsPhaseComplete: false,
    ticketsPhaseCompletedAt: 0,
    roundScore: 0,
    roundEvents: [],
  };
}

export const SESSION = {
  player: 'Guest',
  mode: DEFAULT_MODE,
  round: 0,
  totalRounds: TOTAL_ROUNDS,
  score: 0,
  roundSummaries: [],
  coinOptions: defaultCoinOptions(),
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
  SESSION.coinOptions = defaultCoinOptions();

  Object.assign(SESSION, baseRoundState(timeLimit));

  return SESSION;
}

export function resetRoundState() {
  const timeLimit = GAME_MODES[SESSION.mode].timeLimit;
  const nextState = baseRoundState(timeLimit);
  Object.assign(SESSION, nextState, { coinOptions: SESSION.coinOptions });
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
