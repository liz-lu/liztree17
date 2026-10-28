import { groups } from './data.js?v=6f8b49917bc4';

// This is a tab-session reading trail, not an account, analytics or proof of
// reading. An item counts when its content is displayed; completion requires
// a separate, explicit return-to-tree action after all three items were shown.
export const TYPES = Object.freeze(['campus', 'internships', 'projects']);
const KEY = 'liz.treeJourney.v1';
const ids = Object.fromEntries(TYPES.map(type => [type, groups[type].layers.map(layer => layer.id)]));
const fresh = (round = 1) => ({ version: 1, round, futureVisited: false, started: false, viewed: Object.fromEntries(TYPES.map(type => [type, []])), completed: [], pendingBloom: null, lastGroup: null });
const clone = state => JSON.parse(JSON.stringify(state));
let memory = fresh();
let persistent = true;

function sanitize(value) {
  const state = fresh();
  if (!value || typeof value !== 'object' || value.version !== 1) return state;
  state.round = Number.isSafeInteger(value.round) && value.round > 0 ? value.round : 1;
  state.started = value.started === true;
  for (const type of TYPES) {
    const seen = Array.isArray(value.viewed?.[type]) ? value.viewed[type] : [];
    state.viewed[type] = ids[type].filter(id => seen.includes(id));
  }
  state.completed = TYPES.filter(type => Array.isArray(value.completed)
    && value.completed.includes(type) && state.viewed[type].length === ids[type].length);
  state.futureVisited = value.futureVisited === true && state.completed.length === TYPES.length;
  state.pendingBloom = state.completed.includes(value.pendingBloom) ? value.pendingBloom : null;
  state.lastGroup = TYPES.includes(value.lastGroup) ? value.lastGroup : null;
  return state;
}

export function loadProgress() {
  if (persistent) {
    let raw;
    try { raw = sessionStorage.getItem(KEY); }
    catch { persistent = false; return clone(memory); }
    try { memory = raw ? sanitize(JSON.parse(raw)) : fresh(); }
    catch { memory = fresh(); }
  }
  return clone(memory);
}

function update(change) {
  memory = loadProgress();
  change(memory);
  memory = sanitize(memory);
  if (persistent) {
    try { sessionStorage.setItem(KEY, JSON.stringify(memory)); }
    catch { persistent = false; }
  }
  return clone(memory);
}

export const isProgressPersistent = () => persistent;
export const markStarted = () => update(state => { state.started = true; });
export function startVisit(type) {
  if (!TYPES.includes(type)) return loadProgress();
  return update(state => { state.started = true; state.lastGroup = type; });
}
export function markViewed(type, id) {
  if (!TYPES.includes(type) || !ids[type].includes(id)) return loadProgress();
  return update(state => {
    state.started = true;
    state.lastGroup = type;
    if (!state.viewed[type].includes(id)) state.viewed[type].push(id);
  });
}
export function finishVisit(type) {
  if (!TYPES.includes(type)) return loadProgress();
  return update(state => {
    state.lastGroup = type;
    if (state.viewed[type].length === ids[type].length && !state.completed.includes(type)) {
      state.completed.push(type);
      state.pendingBloom = type;
    }
  });
}
export function consumeBloom() {
  let bloom = null;
  update(state => { bloom = state.pendingBloom; state.pendingBloom = null; });
  return bloom;
}

// Arrival alone is not a completed round. The tree consumes the restart only
// when all three branches were completed and the visitor then reached future.
export function visitFuture() {
  return update(state => {
    if (state.completed.length === TYPES.length) state.futureVisited = true;
  });
}
export function consumeRoundRestart() {
  let restart = false;
  update(state => {
    if (state.completed.length === TYPES.length && state.futureVisited) {
      const nextRound = Math.min(Number.MAX_SAFE_INTEGER, state.round + 1);
      Object.assign(state, fresh(nextRound));
      restart = true;
    }
  });
  return restart;
}
