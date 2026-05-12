# Phase: intent

Confirm the analysis scope, choose execution mode, and locate the team-brains directory. HARD GATE — no DB reads until the user confirms all three.

## Process

Ask the user three questions, one at a time:

1. **Scope.** "Which sprint, time window, or topic should this consolidation cover? Any filters on dev names?"
2. **Mode.** "Sequential mode (one agent reads all brains in order) or parallel mode (one sub-agent per dev folder, results aggregated)? Sequential is simpler and uses one context. Parallel is faster for >5 devs but uses sub-agents."
3. **Brains path.** "Where is the team-brains directory? Provide an absolute path. The expected layout is `<path>/<dev-name>/<repo>.db` per dev."

Validate the path exists with `ls "<path>"` before transitioning.

## Exit criterion

- [ ] User stated scope (string).
- [ ] User chose mode (`sequential` or `parallel`).
- [ ] User provided absolute path to brains directory; path exists.

## Gates emitted

- `scope_described`
- `mode_chosen`
- `brains_path_known`

## Anti-patterns

- Defaulting to a convention path like `~/.codi/team-brains/`. Always require explicit path. Convention defaults cause silent bugs ("ups, analyzed empty folder").
- Choosing parallel mode for 1-2 devs. Overhead exceeds benefit; recommend sequential.
- Skipping path existence check. Empty or missing dir wastes downstream work.
