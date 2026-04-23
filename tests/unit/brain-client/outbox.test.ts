import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { writeToOutbox, drainOutbox, type OutboxEntry } from "#src/brain-client/outbox.js";

describe("outbox", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "codi-brain-outbox-"));
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("writes a unique file per entry (session+timestamp+random)", async () => {
    const a = await writeToOutbox(tmp, {
      method: "POST",
      path: "/notes",
      body: { title: "a" },
      sessionId: "sess-1",
    });
    const b = await writeToOutbox(tmp, {
      method: "POST",
      path: "/notes",
      body: { title: "b" },
      sessionId: "sess-1",
    });
    expect(a).not.toBe(b);
    const files = await fs.readdir(path.join(tmp, ".codi/brain-outbox"));
    expect(files.length).toBe(2);
  });

  it("drainOutbox calls flushOne per file and deletes on ok:true", async () => {
    await writeToOutbox(tmp, {
      method: "POST",
      path: "/notes",
      body: { x: 1 },
      sessionId: "s1",
    });
    await writeToOutbox(tmp, {
      method: "PUT",
      path: "/hot",
      body: { body: "b" },
      sessionId: "s1",
    });
    const seen: OutboxEntry[] = [];
    const result = await drainOutbox(tmp, async (entry) => {
      seen.push(entry);
      return { ok: true };
    });
    expect(seen.length).toBe(2);
    expect(result.drained).toBe(2);
    expect(result.failed).toBe(0);
    const remaining = await fs.readdir(path.join(tmp, ".codi/brain-outbox"));
    expect(remaining).toEqual([]);
  });

  it("keeps files on ok:false", async () => {
    await writeToOutbox(tmp, {
      method: "POST",
      path: "/notes",
      body: { x: 1 },
      sessionId: "s1",
    });
    const result = await drainOutbox(tmp, async () => ({
      ok: false,
      retryable: true,
    }));
    expect(result.drained).toBe(0);
    expect(result.failed).toBe(1);
    const remaining = await fs.readdir(path.join(tmp, ".codi/brain-outbox"));
    expect(remaining.length).toBe(1);
  });

  it("quarantines corrupted JSON files", async () => {
    const outboxDir = path.join(tmp, ".codi/brain-outbox");
    await fs.mkdir(outboxDir, { recursive: true });
    await fs.writeFile(path.join(outboxDir, "bad_s1.json"), "not-json");
    const result = await drainOutbox(tmp, async () => ({ ok: true }));
    expect(result.drained).toBe(0);
    expect(result.quarantined).toBe(1);
    const q = await fs.readdir(path.join(tmp, ".codi/brain-outbox/quarantine"));
    expect(q.length).toBe(1);
  });

  it("returns zeros when outbox dir does not exist", async () => {
    const result = await drainOutbox(tmp, async () => ({ ok: true }));
    expect(result).toEqual({ drained: 0, failed: 0, quarantined: 0 });
  });
});
