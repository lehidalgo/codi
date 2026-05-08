import { describe, it, expect } from "vitest";

import {
  readAllRows,
  readAllRowsLenient,
  SheetsError,
  type ProjectConfig,
  type SheetsClient,
} from "../lib/sheets/index.js";

// Fake client that returns a malformed UserStory row (missing required `status`).
function makeFakeClient(): SheetsClient {
  return {
    async readRange(_id: string, range: string) {
      const tabName = range.split("!")[0]?.replace(/'/g, "") ?? "";
      if (tabName === "UserStory") {
        return {
          range,
          values: [
            ["id", "as_a", "i_want", "so_that", "status", "_rev", "archived_at", "archived_by"],
            ["US-001", "user", "to sign in", "I checkout fast", "" /* empty status */, 1, "", ""],
          ],
        };
      }
      return { range, values: [] };
    },
    async batchWrite() {
      /* void */
    },
  };
}

const config: ProjectConfig = {
  project_name: "lenient-test",
  sheet_id: "SHEET_LEN",
  sheet_template_version: 1,
  created_at: "2026-05-02T00:00:00.000Z",
  created_by: "tester@local",
};

describe("readAllRows vs readAllRowsLenient — D6 regression", () => {
  it("readAllRows REJECTS a row missing required field (status)", async () => {
    await expect(
      readAllRows("UserStory", { client: makeFakeClient(), config }),
    ).rejects.toBeInstanceOf(SheetsError);
  });

  it("readAllRowsLenient SHOWS the same malformed row without throwing", async () => {
    const rows = await readAllRowsLenient("UserStory", { client: makeFakeClient(), config });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.["id"]).toBe("US-001");
    // The user can SEE the missing status to fix it — that's the whole point.
    expect(rows[0]?.["status"]).toBe("");
  });
});
