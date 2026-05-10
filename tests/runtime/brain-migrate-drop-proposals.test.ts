import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { applyMigrations } from "#src/runtime/brain/index.js";

describe("brain migration: drop proposals table", () => {
  it("removes proposals table when present", () => {
    const db = new Database(":memory:");
    db.exec(
      "CREATE TABLE proposals (proposal_id INTEGER PRIMARY KEY, title TEXT, deleted_at INTEGER)",
    );
    db.exec("CREATE INDEX idx_proposals_status_created ON proposals(title)");
    applyMigrations(db);
    const tableRow = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='proposals'")
      .get();
    expect(tableRow).toBeUndefined();
    const idxRow = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_proposals_status_created'",
      )
      .get();
    expect(idxRow).toBeUndefined();
    db.close();
  });

  it("is idempotent when proposals table absent", () => {
    const db = new Database(":memory:");
    expect(() => applyMigrations(db)).not.toThrow();
    expect(() => applyMigrations(db)).not.toThrow();
    const tableRow = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='proposals'")
      .get();
    expect(tableRow).toBeUndefined();
    db.close();
  });

  it("fresh DB after migration does not contain proposals table", () => {
    const db = new Database(":memory:");
    applyMigrations(db);
    const tableRow = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='proposals'")
      .get();
    expect(tableRow).toBeUndefined();
    db.close();
  });
});
