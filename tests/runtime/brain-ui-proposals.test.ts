/**
 * Proposals HTTP API (Sprint 5).
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildApp } from "#src/runtime/brain-ui/index.js";
import { applyMigrations, openBrain } from "#src/runtime/brain/index.js";
import { insertProposal } from "#src/runtime/consolidate/index.js";

function tmpFixture() {
  const dir = mkdtempSync(join(tmpdir(), "codi-prop-"));
  const dbPath = join(dir, "brain.db");
  {
    const seed = openBrain({ dbPath });
    applyMigrations(seed.raw);
    insertProposal(seed.raw, {
      patternCode: "P1",
      proposalType: "PROMOTE_TO_RULE",
      artifactKind: "rule",
      artifactName: null,
      title: "test proposal A",
      rationale: "because",
      patch: null,
      evidence: [{ id: 1, source: "captures" }],
    });
    insertProposal(seed.raw, {
      patternCode: "P5",
      proposalType: "CREATE_NEW_ARTIFACT",
      artifactKind: "rule",
      artifactName: null,
      title: "test proposal B",
      rationale: "because2",
      patch: { proposed_rule_body: "x" },
      evidence: [{ id: 2, source: "captures" }],
    });
    seed.close();
  }
  const handle = buildApp({ brainPath: dbPath });
  return {
    handle,
    cleanup: () => {
      handle.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

describe("/api/v1/proposals", () => {
  it("lists pending proposals", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request("/api/v1/proposals");
      const body = (await res.json()) as { data: { title: string; status: string }[] };
      expect(body.data).toHaveLength(2);
      expect(body.data.every((p) => p.status === "pending")).toBe(true);
    } finally {
      t.cleanup();
    }
  });

  it("returns one proposal by id", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request("/api/v1/proposals/1");
      const body = (await res.json()) as { data: { title: string } };
      expect(body.data.title).toBe("test proposal A");
    } finally {
      t.cleanup();
    }
  });

  it("returns 404 for unknown id", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request("/api/v1/proposals/9999");
      expect(res.status).toBe(404);
    } finally {
      t.cleanup();
    }
  });

  it("accepts a pending proposal", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request("/api/v1/proposals/1/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "looks right" }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { status: string; decisionReason: string };
      };
      expect(body.data.status).toBe("accepted");
      expect(body.data.decisionReason).toBe("looks right");
    } finally {
      t.cleanup();
    }
  });

  it("rejects a pending proposal", async () => {
    const t = tmpFixture();
    try {
      const res = await t.handle.app.request("/api/v1/proposals/2/reject", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "false positive" }),
      });
      const body = (await res.json()) as { data: { status: string } };
      expect(body.data.status).toBe("rejected");
    } finally {
      t.cleanup();
    }
  });

  it("returns 409 when accepting an already-decided proposal", async () => {
    const t = tmpFixture();
    try {
      await t.handle.app.request("/api/v1/proposals/1/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const res = await t.handle.app.request("/api/v1/proposals/1/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      expect(res.status).toBe(409);
    } finally {
      t.cleanup();
    }
  });

  it("filters list by status", async () => {
    const t = tmpFixture();
    try {
      await t.handle.app.request("/api/v1/proposals/1/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const accepted = await t.handle.app.request("/api/v1/proposals?status=accepted");
      const acceptedBody = (await accepted.json()) as { data: { title: string }[] };
      expect(acceptedBody.data).toHaveLength(1);
      expect(acceptedBody.data[0]!.title).toBe("test proposal A");
    } finally {
      t.cleanup();
    }
  });
});
