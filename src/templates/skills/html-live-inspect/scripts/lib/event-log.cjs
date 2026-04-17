'use strict';

// Ring buffer of user interaction events with a monotonic sequence number.
// Agents poll with ?since=<lastSeq> to get only new events.

let buffer = [];
let nextSeq = 1;
let capacity = 500;
let dropped = 0;

function configure(opts) {
  if (opts && Number.isFinite(opts.capacity) && opts.capacity > 0) {
    capacity = Math.floor(opts.capacity);
  }
}

function record(event) {
  if (!event || typeof event !== 'object') return null;
  const entry = {
    seq: nextSeq++,
    timestamp: Date.now(),
    type: String(event.type || 'unknown'),
    selector: event.selector || null,
    tag: event.tag || null,
    id: event.id || null,
    text: event.text || null,
    value: event.value != null ? String(event.value).slice(0, 500) : null,
    pageUrl: event.pageUrl || null,
    scrollY: Number.isFinite(event.scrollY) ? event.scrollY : null,
    extra: event.extra || null,
  };
  buffer.push(entry);
  if (buffer.length > capacity) {
    const overflow = buffer.length - capacity;
    dropped += overflow;
    buffer = buffer.slice(overflow);
  }
  return entry;
}

function since(seq, limit) {
  const s = Number.isFinite(seq) ? seq : 0;
  const lim = Number.isFinite(limit) && limit > 0 ? Math.min(limit, capacity) : capacity;
  const filtered = buffer.filter((e) => e.seq > s).slice(0, lim);
  return {
    events: filtered,
    nextSeq: nextSeq,
    dropped,
  };
}

function clear() {
  buffer = [];
  dropped = 0;
}

function size() {
  return buffer.length;
}

module.exports = {
  configure,
  record,
  since,
  clear,
  size,
};
