'use strict';

// Long-poll bridge between the agent's POST /api/eval request and the
// inspector running inside the page.
//
// Flow:
//   1. Agent calls POST /api/eval { js, timeoutMs }.
//      The route creates a task, pushes it onto `pending`, and waits on a
//      Promise resolved by submit().
//   2. Inspector long-polls GET /__inspect/eval-pull.
//      next() resolves with the oldest pending task (or null after
//      LONG_POLL_MS).
//   3. Inspector runs the JS, POSTs the result to /__inspect/eval-push.
//      submit() resolves the waiting agent request.
//
// If the inspector is not connected (no pull waiting, no client recently
// ingesting) the agent request times out after `timeoutMs`.

const LONG_POLL_MS = 25_000;
const DEFAULT_EVAL_TIMEOUT_MS = 10_000;

let allowEval = true;
let nextId = 1;
const pending = [];          // FIFO of tasks not yet delivered to a puller
const waitingPullers = [];   // FIFO of puller callbacks waiting for work
const inflight = new Map();  // taskId -> { resolve, timer }

function configure(opts) {
  if (opts && typeof opts.allowEval === 'boolean') allowEval = opts.allowEval;
}

function isEnabled() {
  return allowEval;
}

function createTask(js, timeoutMs) {
  if (!allowEval) {
    return Promise.resolve({ status: 403, body: { ok: false, error: 'eval is disabled' } });
  }
  if (typeof js !== 'string' || !js.trim()) {
    return Promise.resolve({ status: 400, body: { ok: false, error: 'js must be a non-empty string' } });
  }
  const id = nextId++;
  const effectiveTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0
    ? Math.min(timeoutMs, 120_000)
    : DEFAULT_EVAL_TIMEOUT_MS;
  const task = { id, js, timeoutMs: effectiveTimeout };

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (inflight.has(id)) {
        inflight.delete(id);
        const idx = pending.findIndex((t) => t.id === id);
        if (idx >= 0) pending.splice(idx, 1);
        resolve({ status: 504, body: { ok: false, error: 'eval timed out — inspector did not respond' } });
      }
    }, effectiveTimeout);

    inflight.set(id, { resolve, timer });

    // Hand to a waiting puller if one is already parked.
    const puller = waitingPullers.shift();
    if (puller) {
      puller.resolve(task);
    } else {
      pending.push(task);
    }
  });
}

function next() {
  // Called by GET /__inspect/eval-pull
  if (!allowEval) {
    return Promise.resolve(null);
  }
  const task = pending.shift();
  if (task) return Promise.resolve(task);

  return new Promise((resolve) => {
    const entry = { resolve };
    const timer = setTimeout(() => {
      const idx = waitingPullers.indexOf(entry);
      if (idx >= 0) waitingPullers.splice(idx, 1);
      resolve(null);
    }, LONG_POLL_MS);
    entry.timer = timer;
    waitingPullers.push(entry);
  });
}

function submit(id, payload) {
  // Called by POST /__inspect/eval-push
  const entry = inflight.get(id);
  if (!entry) return false;
  clearTimeout(entry.timer);
  inflight.delete(id);
  const ok = payload && payload.ok !== false;
  entry.resolve({
    status: 200,
    body: {
      ok,
      result: ok ? (payload && payload.result) : undefined,
      error: ok ? undefined : (payload && payload.error) || 'unknown error',
    },
  });
  return true;
}

function stats() {
  return {
    allowEval,
    pending: pending.length,
    waitingPullers: waitingPullers.length,
    inflight: inflight.size,
  };
}

module.exports = {
  configure,
  isEnabled,
  createTask,
  next,
  submit,
  stats,
  LONG_POLL_MS,
};
