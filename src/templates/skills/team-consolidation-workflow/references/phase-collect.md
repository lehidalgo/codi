# Phase: collect

List all candidate brain.db files in the team-brains directory and validate each is a real Codi brain. HARD GATE — invalid files MUST be skipped before transitioning.

## Process

1. **Enumerate candidates.** Run `find "<brains_path>" -name "*.db" -type f` to find all .db files. Group by parent directory (the dev_id).
2. **Validate each.** For each candidate path:

   ```bash
   sqlite3 "<path>" "SELECT version FROM _codi_schema_version ORDER BY version DESC LIMIT 1"
   ```

   Expected: a positive integer. If the query fails (file is not SQLite, table missing, etc.), skip the file with a logged warning.

3. **Build inventory.** For each valid brain, record:
   - `dev_id` — basename of the parent directory
   - `db_path` — absolute path
   - `project_count` — `sqlite3 "<path>" "SELECT COUNT(*) FROM projects"`
   - `session_count` — `sqlite3 "<path>" "SELECT COUNT(*) FROM sessions"`
4. **Surface inventory to user.** Show the table:

   ```
   | dev_id | brain                  | projects | sessions |
   |--------|------------------------|----------|----------|
   | alice  | fintech-api.db         | 1        | 47       |
   | alice  | fintech-admin.db       | 1        | 12       |
   | bob    | fintech-frontend.db    | 1        | 33       |
   ```

   Confirm with user before proceeding.

## Exit criterion

- [ ] At least one valid brain found (zero brains → abandoned phase).
- [ ] Invalid files logged with reason and skipped.
- [ ] Inventory surfaced to user, user confirmed.

## Gates emitted

- `brains_listed`
- `dev_layout_validated`

## Anti-patterns

- Treating non-SQLite files as brains. The schema-version check is the contract.
- Failing the whole phase on one bad file. Log + skip + continue.
- Inferring dev_id from filename instead of dirname. Dirname is the convention.
