
  whatsapp bot skill   

  integrate superpowers into codi


  
Experience 1
export a modified preset to a zip
then clean and reinit codi in the repo
then import from zip or update from zip

Experience 2
export a modified preset to a github repo
then clean and reinit codi in the repo
then import from github or update from github

Please check this, I have noticed that in the wizard we are not seeing all the artifacts we have available in the codi repo, this is like the wizards is not getting all we have in the         
templates to allow the user select and install them, check the registry and all the codebase interatively and with care please


as part of codi selfimprovement feature, add checking the autosaved memories to make an skill that integrate all user requests into the rules


  Verdict: DEFER — Adding merge support requires architectural changes (storing base content at install time) that are out of scope for this audit. The current accept/skip + diff visibility  
  is adequate for short markdown artifacts. A merge option should be tracked as a future enhancement.                                                                                          
                                                         

the codi skill artifact creator must always check first if the artifact already exists in the registry before creating a new one, if it exists it should prompt the user to update it instead of creating a new one, this will help to keep the registry clean and avoid duplicates.


codi generate must generate from the npm codi installation and check the diff with the local user applied to the .codi artifacts and display the diff experience to allow the user to decide if they want to accept the new generated content, skip it, or merge it with their local changes. This will help to keep the user's customizations while still benefiting from the latest updates from codi.

Check this, in the whole codebase we are trying to get rid of this practice of deep imporso please check how we usualy do and remove    
  all these please considering all codebase and test scripts (ALL): "../../../../src/core/security/scan-prompt.js"  

when we do codi init and we already have config files like the one codi will install codi must handle the diff to avoid losing information the user already have and in this case the use manage the incoming changes

check the merge implementation to be able to combined the incomming and the current changes

---

❯ we got this: $ cd /tmp/codi-multi-* && node /Users/O006783/myprojects/codi/dist/cli.js preset install github:lehidalgo/codi-e2e-test-preset                                                     
[INF] Cloning preset from https://github.com/lehidalgo/codi-e2e-test-preset.git (ref: main)...                                                                                                    
│                                                                                                                                                                                                 
◇  Found 2 presets — which one to install?                                                                                                                                                        
│  qa-export                                                                                                                                                                                      
[INF] Installed preset "qa-export" from GitHub.                                                                                                                                                   
[INF] Applied: 0 added, 0 updated, 0 skipped                                                                                                                                                      
[OK] preset install                                                                                                                                                                               
{                                                                                                                                                                                                 
  "action": "install",                                                                                                                                                                            
  "name": "qa-export"                                                                                                                                                                             
}\                                                                                                                                                                                                
\                                                                                                                                                                                                 
But whne we import (incoming operations) we must follow the same funnel of the init, we must see what this is incoming, we can select what install, what not, the diff if confilcts etc, this     
must not be a separate experience. FOr tthe user we mus thave almost the same, the same workflow in experience and visually for the incoming operations (imports, init) and the same experience   
and visually for outcoming operations (export, contribution, etc) 


--- UX REACT CLI

Great!Please using your skills that apply lets analyze how we could improve the ux/ui of codi wizard getting inpired in examples like   
claude code interface: https://github.com/anthropics/claude-code\                                                                         
\                                                                                                                                         
But keep the light blue cyan brand color of codi                                                                                          

⏺ Skill(superpowers:brainstorming)
  ⎿  Successfully loaded skill

⏺ Using the brainstorming skill to design UX/UI improvements for the codi wizard.

  Let me start by exploring the current state of the wizard and Claude Code's interface for reference.

⏺ Let me explore both the current codi wizard and Claude Code's interface patterns in parallel.

⏺ 3 Explore agents finished (ctrl+o to expand)
   ├─ Explore codi wizard UI code · 0 tool uses
   │  ⎿  Done
   ├─ Research Claude Code CLI UX · 0 tool uses
   │  ⎿  Done
   └─ Explore CLI UI dependencies · 0 tool uses
      ⎿  Done

⏺ Now let me also look at Claude Code's actual CLI UX for reference.

⏺ Fetch(https://github.com/anthropics/claude-code)
  ⎿  Received 296.7KB (200 OK)

⏺ Fetch(https://www.npmjs.com/package/@anthropic-ai/claude-code)
  ⎿  Error: Request failed with status code 403

⏺ Let me also look at some modern CLI UX patterns and the @clack/prompts capabilities that codi could leverage better.

⏺ Fetch(https://github.com/bombshell-dev/clack)
  ⎿  Received 292.3KB (200 OK)

⏺ Fetch(https://github.com/anthropics/claude-code/blob/main/package.json)
  ⎿  Error: Request failed with status code 404

⏺ Fetch(https://bomb.sh/docs/clack/basics/getting-started)
  ⎿  Received 179.9KB (200 OK)

⏺ Excellent! This is very valuable. @clack/prompts has several components codi isn't using yet: progress(), tasks(), taskLog(), box(),
  autocomplete(), groupMultiselect(). Let me now read the current banner and key wizard files to understand the visual baseline.

  Read 3 files (ctrl+o to expand)

⏺ Good. Now I have a comprehensive picture. Before I jump into approaches, let me offer the visual companion and ask the first clarifying
  question.

  ---
  Some of what we're working on might be easier to explain if I can show it to you in a web browser. I can put together mockups, diagrams,
   comparisons, and other visuals as we go. This feature is still new and can be token-intensive. Want to try it? (Requires opening a
✻ Sautéed for 3m 24s

❯ no lets do it here in the chat                                                                                                          

⏺ Got it, we'll keep everything text-based in the chat.

  Let me start with my first clarifying question. Based on the exploration, here's what I found about the current state:

  Current codi wizard stack:
  - @clack/prompts for all interactive prompts (but only using ~40% of its capabilities)
  - picocolors for cyan brand color + basic styling
  - Static ASCII art banner, no animations
  - No step progress indicators ("Step 2 of 4")
  - No tasks(), progress(), box(), autocomplete(), or groupMultiselect() from clack
  - No spinners except for npm install
  - Flat command center menu with 20+ items

  What "scope" are you thinking about? Specifically:

  - A) Full CLI UX overhaul — Banner, wizard flows, command center hub, output formatting, error display, success screens, everything
  - B) Wizard-focused — Just the init wizard, add wizard, preset wizard, and skill-export wizard interactions
  - C) Visual layer only — Keep the same flows but upgrade the visual presentation (colors, progress, spinners, boxes, step indicators)

  Which resonates most, or is it a mix?

❯ A                                                                                                                                       

⏺ Great — Option A: Full CLI UX overhaul. That gives us the most impact.

  Next question. The current codi CLI uses @clack/prompts which has a specific visual style (the vertical line with dots). Claude Code's
  interface uses a different approach — more like Ink (React for CLI) with richer layouts, markdown rendering, and custom components.

  How far do you want to go on the library side?

  - A) Stay with @clack/prompts — Maximize what we already have (use tasks(), progress(), box(), groupMultiselect(), autocomplete() that
  are currently unused). Lowest risk, fastest to ship.
  - B) @clack/prompts + complementary libraries — Keep clack for prompts but add targeted libraries for specific needs (e.g., cli-table3
  for tables, gradient-string for the banner, log-update for dynamic output). Medium effort.
  - C) Replace with Ink — Full React-for-CLI approach like Claude Code. Most flexible but biggest rewrite, new paradigm for the team.

  My recommendation would be B — it respects the existing investment in clack while adding punch where it matters most (banner, output
  formatting, progress visualization). What's your take?

❯ C                                                                                                                                       
  ⎿  ⧉ Selected 201 lines from ../../.claude/plans/goofy-snacking-pancake.md in Visual Studio Code

⏺ Interesting — you want to go full Ink (React for CLI). That's the most ambitious path but gives the most design freedom.

  Before I commit to designing around Ink, let me ask the key follow-up question:

  What's the migration strategy you'd prefer?

  - A) Big bang — Replace all CLI rendering at once. One large effort, clean break, no hybrid state. Higher risk but no tech debt from
  mixing paradigms.
  - B) Incremental / strangler fig — Introduce Ink for new or high-visibility surfaces first (banner, init wizard, command center hub),
  keep clack for lower-priority flows (skill-export, contribute). Migrate the rest over time. Lower risk but temporary hybrid.
  - C) Ink shell + clack internals — Use Ink as the outer rendering framework (layout, colors, progress, boxes) but keep @clack/prompts
  for the actual interactive prompts (select, multiselect, text input) since they work well. Best of both worlds, but requires careful
  integration.

  My recommendation here would be B — start with the highest-traffic flows (init wizard, hub, banner) in Ink, prove the pattern works,
❯ A                                                                                                                                       

⏺ Bold move — Big bang with Ink. Clean break, no hybrid state.

  Next question. What's your priority ranking for these UX improvements? This helps me design the right thing first.

  Rank these 1-5 (or tell me if any should be dropped):

  1. Banner & branding — Animated/gradient cyan banner, version display, detected stack visualization
  2. Wizard step tracking — Visual progress bar ("Step 2 of 4"), breadcrumbs, clear phase transitions
  3. Command center (hub) — Grouped menu with visual sections, search/filter, keyboard navigation
  4. Output & feedback — Rich success/error screens, spinners for all async ops, task lists with checkmarks, colored diffs
  5. Markdown rendering — Render skill descriptions, rule content, and help text as formatted markdown in the terminal

  Or would you rather I design all five as equal priorities since we're doing a full overhaul anyway?

❯ think this, we are implementing a diff git like using jsdiff for the feature of update presets or artifacts from zip or github, how     
this complement with ink? Does ink have feature to display this beautifully? or can we go with jsdiff?                                    

⏺ Great question — they're complementary, not competing:

  - jsdiff = computes the diff (the data: what lines changed, added, removed)
  - Ink = renders the diff beautifully (colored output, boxes, interactive accept/reject per hunk)

  Think of it like: jsdiff is the engine, Ink is the UI layer on top. You'd do something like:

  jsdiff.diffLines(currentRule, incomingRule)
    → Array of changes [{added: true, value: "..."}, {removed: true, value: "..."}]
      → Ink <DiffView> component renders each hunk with:
         - Red background for removals
         - Green background for additions
         - Cyan accent for file headers
         - Interactive [Accept] [Keep Mine] [Accept All] buttons per file

  This is actually one of the strongest arguments for Ink — rendering an interactive git-style diff with per-file action buttons is
  trivial with React components but painful with raw ANSI strings or clack.

  Now — this connects directly to your other plan (the preset import diff/merge UX). So the architecture would be:

  ┌──────────────────┬─────────────────────────────┬──────────────────────────────┐
  │      Layer       │           Library           │             Role             │
  ├──────────────────┼─────────────────────────────┼──────────────────────────────┤
  │ Diff computation │ jsdiff                      │ Compute line-by-line changes │
  ├──────────────────┼─────────────────────────────┼──────────────────────────────┤
  │ Diff rendering   │ Ink <DiffView> component    │ Colored hunks, file headers  │
  ├──────────────────┼─────────────────────────────┼──────────────────────────────┤
  │ Interaction      │ Ink <SelectInput> or custom │ Accept/Keep/Skip per file    │
  ├──────────────────┼─────────────────────────────┼──────────────────────────────┤
  │ Layout           │ Ink <Box>, <Text>           │ Borders, padding, alignment  │
  └──────────────────┴─────────────────────────────┴──────────────────────────────┘

  Does this answer your question? Shall I continue with the brainstorming — I still have one more clarifying question about the visual
  style direction before I move to proposing approaches.

❯ ok then lets go the plan                                                                                                                

⏺ Let me explore the codebase more deeply to inform the plan — specifically the CLI rendering surface area, Ink integration patterns, and
  the diff utility that already exists.

⏺ 3 Explore agents finished (ctrl+o to expand)
   ├─ Explore all CLI rendering files · 32 tool uses · 87.0k tokens
   │  ⎿  Done
   ├─ Explore Ink library capabilities · 21 tool uses · 50.5k tokens
   │  ⎿  Done
   └─ Explore wizard flow files deeply · 9 tool uses · 68.1k tokens
      ⎿  Done

⏺ Now let me launch a Plan agent to design the implementation approach.

⏺ Plan(Design Ink migration plan)
  ⎿  Done (40 tool uses · 80.4k tokens · 3m 58s)
  (ctrl+o to expand)

⏺ Good, comprehensive plan from the agents. Let me verify a few critical details before writing the final plan.

  Read 3 files (ctrl+o to expand)

⏺ Good. Now let me check the tsconfig for current JSX settings and read the preset-applier to understand the existing conflict resolution
  UI.
  Read 2 files (ctrl+o to expand)

⏺ Excellent. Now I have all the details I need. Let me write the final plan.

⏺ Updated plan
  ⎿  /plan to preview

──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Ready to code?

 Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 Plan: Migrate Codi CLI from @clack/prompts to Ink (React for CLI)

 Context

 The codi CLI wizard UX is functional but visually basic — static ASCII banner, no step progress indicators, no spinners for async
 operations, flat command menus, and plain-text diffs. The goal is a full UX overhaul inspired by modern CLI tools like Claude Code,
 using Ink (React for CLI) as the rendering framework while keeping the cyan/light blue brand color.

 This is a big-bang migration: replace all @clack/prompts + picocolors usage with Ink components in a single branch. The existing diff
 npm package stays for computation; Ink handles the rendering. The commander CLI framework stays for argument parsing.

 Key motivations:
 - Step tracking ("Step 2 of 4") and progress bars for all wizards
 - Gradient animated banner with cyan branding
 - Interactive diff/merge UI for preset imports (jsdiff + Ink rendering)
 - Grouped command center menu with visual sections
 - Rich success/error screens with checkmarks and spinners
 - Consistent theme system instead of scattered pc.cyan() calls

 Migration Surface


 ┌──────────────────────────────────────┬───────┬─────────────┬────────────────────────┐
 │                 File                 │ Lines │ Clack Calls │       Complexity       │
 ├──────────────────────────────────────┼───────┼─────────────┼────────────────────────┤
 │ src/cli/init-wizard-paths.ts         │ 644   │ 24          │ HIGH — must split      │
 ├──────────────────────────────────────┼───────┼─────────────┼────────────────────────┤
 │ src/cli/hub-handlers.ts              │ 478   │ 45+         │ HIGH — 23 stdout.write │
 ├──────────────────────────────────────┼───────┼─────────────┼────────────────────────┤
 │ src/cli/preset-handlers.ts           │ 671   │ 8           │ HIGH                   │
 ├──────────────────────────────────────┼───────┼─────────────┼────────────────────────┤
 │ src/cli/contribute.ts                │ 555   │ 7           │ HIGH                   │
 ├──────────────────────────────────────┼───────┼─────────────┼────────────────────────┤
 │ src/cli/hub.ts                       │ 322   │ 6           │ MEDIUM                 │
 ├──────────────────────────────────────┼───────┼─────────────┼────────────────────────┤
 │ src/core/preset/preset-applier.ts    │ 281   │ 5           │ MEDIUM — diff UI       │
 ├──────────────────────────────────────┼───────┼─────────────┼────────────────────────┤
 │ src/cli/preset-wizard.ts             │ 233   │ 10          │ MEDIUM                 │
 ├──────────────────────────────────────┼───────┼─────────────┼────────────────────────┤
 │ src/cli/init-wizard.ts               │ 166   │ 7           │ MEDIUM                 │
 ├──────────────────────────────────────┼───────┼─────────────┼────────────────────────┤
 │ src/cli/skill-export-wizard.ts       │ 162   │ 6           │ LOW                    │
 ├──────────────────────────────────────┼───────┼─────────────┼────────────────────────┤
 │ src/cli/add-wizard.ts                │ 142   │ 8           │ LOW                    │
 ├──────────────────────────────────────┼───────┼─────────────┼────────────────────────┤
 │ src/core/hooks/hook-dep-installer.ts │ 131   │ 4           │ LOW                    │
 ├──────────────────────────────────────┼───────┼─────────────┼────────────────────────┤
 │ src/core/security/scan-prompt.ts     │ 90    │ 2           │ LOW                    │
 ├──────────────────────────────────────┼───────┼─────────────┼────────────────────────┤
 │ src/cli/banner.ts                    │ 60    │ 0           │ LOW — picocolors       │
 ├──────────────────────────────────────┼───────┼─────────────┼────────────────────────┤
 │ src/utils/diff.ts                    │ 109   │ 0           │ LOW — picocolors       │
 └──────────────────────────────────────┴───────┴─────────────┴────────────────────────┘

 Total: 14 files, ~100+ prompt calls, 23 process.stdout.write calls

 Dependencies

 Add

 ┌──────────────────────────────┬──────────────────────────┐
 │           Package            │         Purpose          │
 ├──────────────────────────────┼──────────────────────────┤
 │ ink (^5.2.0)                 │ React renderer for CLI   │
 ├──────────────────────────────┼──────────────────────────┤
 │ react (^18.3.0)              │ JSX runtime              │
 ├──────────────────────────────┼──────────────────────────┤
 │ ink-select-input (^6.0.0)    │ Select component         │
 ├──────────────────────────────┼──────────────────────────┤
 │ ink-text-input (^6.0.0)      │ Text input               │
 ├──────────────────────────────┼──────────────────────────┤
 │ ink-spinner (^5.0.0)         │ Loading spinners         │
 ├──────────────────────────────┼──────────────────────────┤
 │ ink-gradient (^3.0.0)        │ Gradient text for banner │
 ├──────────────────────────────┼──────────────────────────┤
 │ ink-big-text (^2.0.0)        │ Large ASCII text         │
 ├──────────────────────────────┼──────────────────────────┤
 │ @types/react (^18.3.0)       │ React types (dev)        │
 ├──────────────────────────────┼──────────────────────────┤
 │ ink-testing-library (^4.0.0) │ Test renderer (dev)      │
 └──────────────────────────────┴──────────────────────────┘

 Remove

 ┌────────────────┬──────────────────────────────┐
 │    Package     │            Reason            │
 ├────────────────┼──────────────────────────────┤
 │ @clack/prompts │ Replaced by Ink components   │
 ├────────────────┼──────────────────────────────┤
 │ picocolors     │ Replaced by Ink <Text color> │
 └────────────────┴──────────────────────────────┘

 Keep

 ┌───────────┬────────────────────────────────────────────────────┐
 │  Package  │                       Reason                       │
 ├───────────┼────────────────────────────────────────────────────┤
 │ commander │ CLI argument parsing (unchanged)                   │
 ├───────────┼────────────────────────────────────────────────────┤
 │ diff      │ Diff computation (Ink replaces only the rendering) │
 └───────────┴────────────────────────────────────────────────────┘

 Build Config Changes

 tsconfig.json

 {
   "compilerOptions": {
     // ADD these two:
     "jsx": "react-jsx",
     "jsxImportSource": "react"
   }
 }

 tsup.config.ts

 // Add to defineConfig:
 esbuildOptions(options) {
   options.jsx = "automatic";
 }

 vitest.config.ts

 // Extend include/coverage to .tsx:
 include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"]
 coverage: { include: ["src/**/*.ts", "src/**/*.tsx"] }

 Architecture

 File Structure

 src/ink/
   theme.tsx              -- ThemeProvider context, useTheme hook, brand tokens
   render.tsx             -- renderApp() bridge: commander -> Ink
   types.ts               -- WizardState, StepProps, shared Ink types
   components/
     Banner.tsx           -- Gradient ASCII art banner (replaces banner.ts)
     CompactBanner.tsx    -- One-line header for sub-commands
     Select.tsx           -- Themed single-select (wraps ink-select-input)
     MultiSelect.tsx      -- Multi-select with space toggle
     TextInput.tsx        -- Validated text input (wraps ink-text-input)
     Confirm.tsx          -- Yes/No prompt
     Spinner.tsx          -- Themed spinner (wraps ink-spinner)
     ProgressBar.tsx      -- "Step 2 of 4" + visual bar
     TaskList.tsx         -- Checkmark list (completed/pending/failed)
     DiffViewer.tsx       -- Colored unified diff (replaces renderColoredDiff)
     DiffMerge.tsx        -- Interactive per-file accept/reject/keep-mine
     StatusLine.tsx       -- Dot + label + value (stack/agent detection)
     Section.tsx          -- Visual section divider
     ResultScreen.tsx     -- Success/error display with structured output
     GroupedMenu.tsx      -- Hub menu with visual group headers
     KeyboardHints.tsx    -- Bottom bar showing available shortcuts
   apps/
     CommandCenter.tsx    -- Hub: banner + grouped menu + action routing
     InitWizard.tsx       -- 4-step init wizard with WizardShell
     PresetPath.tsx       -- Preset sub-wizard (from init-wizard-paths)
     CustomPath.tsx       -- Custom sub-wizard (from init-wizard-paths)
     ImportPath.tsx       -- ZIP + GitHub sub-wizards
     FlagEditor.tsx       -- Flag editing (extracted from init-wizard-paths)
     AddWizard.tsx        -- Add artifact wizard
     PresetWizard.tsx     -- Preset creation wizard
     PresetEditor.tsx     -- Preset edit flow
     PresetMenu.tsx       -- Preset action sub-menu
     SkillExportWizard.tsx
     ContributeWizard.tsx
     ConflictResolver.tsx -- Preset apply conflict resolution
     HookInstaller.tsx    -- Dep install prompt + spinner
     SecurityPrompt.tsx   -- Security findings + confirm

 Theme System (src/ink/theme.tsx)

 React context providing semantic color tokens:
 interface CodiTheme {
   colors: {
     brand: "cyan"
     brandBright: "cyanBright"
     success: "green"
     error: "red"
     warning: "yellow"
     muted: "gray"
     diffAdd: "green"
     diffRemove: "red"
     diffHunk: "cyan"
   }
   noColor: boolean
 }

 All components consume useTheme() instead of hardcoding colors. When --no-color is passed, all <Text color> props are omitted.

 Commander-to-Ink Bridge (src/ink/render.tsx)

 async function renderApp<T>(
   component: React.ReactElement,
   options: { json?: boolean; quiet?: boolean }
 ): Promise<T>

 - --json / --quiet: skip Ink entirely, use existing formatJson/formatHuman
 - Otherwise: render(component) from Ink, resolve promise when app signals done
 - Only one Ink instance at a time (commander finishes parsing before Ink mounts)

 Wizard Architecture

 Replace imperative while(step >= 0) switch(step) loops with declarative React:

 - WizardShell manages step state, renders ProgressBar, handles Escape/back
 - Each step is a component that calls onComplete(data) or onBack()
 - State persists in React state (same behavior as current savedLanguages, savedAgents variables)
 - Async operations wrapped in Spinner component between steps

 DiffMerge UI (flagship feature)

 DiffMerge.tsx
   Props: conflicts: ConflictFile[]
   Renders per file:
     - Header: "File 3 of 7: rules/security.md (+12 -3)"
     - DiffViewer (colored hunks from buildUnifiedDiff)
     - Action bar: [A]ccept incoming  [K]eep mine  [S]kip  Accept A[l]l  Skip Al[l]
     - Summary footer: "4 accepted, 1 kept, 2 remaining"
   Returns: Map<string, 'accept' | 'skip'>

 buildUnifiedDiff() and countChanges() stay in src/utils/diff.ts (pure computation). Only renderColoredDiff() is replaced by the Ink
 DiffViewer component.

 Implementation Phases

 Phase 1: Foundation

 1. Install npm dependencies (ink, react, ink-select-input, ink-text-input, ink-spinner, ink-gradient, ink-big-text, @types/react,
 ink-testing-library)
 2. Update tsconfig.json (jsx, jsxImportSource)
 3. Update tsup.config.ts (esbuildOptions jsx)
 4. Update vitest.config.ts (.tsx includes)
 5. Create src/ink/theme.tsx — ThemeProvider + useTheme
 6. Create src/ink/render.tsx — renderApp bridge
 7. Create src/ink/types.ts — shared types
 8. Verify: npm run build succeeds, node dist/cli.js --help works

 Phase 2: Primitive Components

 9. Banner.tsx + CompactBanner.tsx — gradient ASCII art, responsive width
 10. Select.tsx — themed ink-select-input wrapper
 11. MultiSelect.tsx — space toggle, a for all, themed
 12. TextInput.tsx — validation callback, error display
 13. Confirm.tsx — Y/N with theme colors
 14. Spinner.tsx — themed ink-spinner wrapper
 15. ProgressBar.tsx — "Step N of M" + visual segments
 16. StatusLine.tsx + Section.tsx + KeyboardHints.tsx
 17. TaskList.tsx — checkmark/spinner/cross per item
 18. ResultScreen.tsx — success/error with structured output
 19. DiffViewer.tsx — colored diff rendering
 20. GroupedMenu.tsx — grouped select with section headers

 Phase 3: Wizard Shell + Simple Apps

 21. WizardShell.tsx — step management, progress, back navigation
 22. SecurityPrompt.tsx — replaces scan-prompt.ts
 23. HookInstaller.tsx — replaces hook-dep-installer.ts
 24. AddWizard.tsx — replaces add-wizard.ts
 25. SkillExportWizard.tsx — replaces skill-export-wizard.ts
 26. PresetWizard.tsx — replaces preset-wizard.ts

 Phase 4: Complex Apps

 27. DiffMerge.tsx — interactive per-file conflict resolution
 28. ConflictResolver.tsx — replaces preset-applier.ts interactive section
 29. FlagEditor.tsx — extracted from init-wizard-paths.ts editPresetFlags
 30. PresetPath.tsx — replaces handlePresetPath (9-step sub-wizard)
 31. CustomPath.tsx — replaces handleCustomPath (8-step sub-wizard)
 32. ImportPath.tsx — replaces handleZipPath + handleGithubPath
 33. InitWizard.tsx — replaces init-wizard.ts (orchestrates paths)
 34. ContributeWizard.tsx — replaces contribute.ts wizard sections
 35. PresetEditor.tsx — replaces preset-handlers.ts edit flow
 36. PresetMenu.tsx — replaces hub-handlers.ts handlePresetMenu

 Phase 5: Hub + Integration

 37. CommandCenter.tsx — replaces hub.ts runCommandCenter
 38. Rewrite hub-handlers.ts — use Ink apps instead of p.* calls
 39. Update cli.ts bare command — use renderApp(CommandCenter)
 40. Update remaining commander action files that use p.*
 41. Remove all @clack/prompts and picocolors imports

 Phase 6: Cleanup + Tests

 42. Delete src/cli/banner.ts (replaced by Banner.tsx)
 43. Update src/utils/diff.ts — remove renderColoredDiff, keep buildUnifiedDiff + countChanges
 44. Write unit tests for all primitive components (ink-testing-library)
 45. Rewrite 6+ existing test files that mock @clack/prompts
 46. Add integration tests for wizard flows (stdin simulation)
 47. Remove @clack/prompts + picocolors from package.json
 48. Verify --json and --quiet modes end-to-end

 Key Files to Modify

 ┌──────────────────────────────────────┬────────────────────────────────────────────────────────┐
 │                 File                 │                         Action                         │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
 │ tsconfig.json                        │ Add jsx + jsxImportSource                              │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
 │ tsup.config.ts                       │ Add esbuildOptions jsx                                 │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
 │ vitest.config.ts                     │ Add .tsx includes                                      │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
 │ package.json                         │ Add/remove dependencies                                │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
 │ src/cli/banner.ts                    │ Delete (replaced by Banner.tsx)                        │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
 │ src/cli/init-wizard.ts               │ Rewrite as InitWizard.tsx                              │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
 │ src/cli/init-wizard-paths.ts         │ Split into PresetPath/CustomPath/ImportPath/FlagEditor │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
 │ src/cli/add-wizard.ts                │ Rewrite as AddWizard.tsx                               │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
 │ src/cli/preset-wizard.ts             │ Rewrite as PresetWizard.tsx                            │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
 │ src/cli/skill-export-wizard.ts       │ Rewrite as SkillExportWizard.tsx                       │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
 │ src/cli/hub.ts                       │ Rewrite as CommandCenter.tsx                           │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
 │ src/cli/hub-handlers.ts              │ Remove p.* calls, use Ink apps                         │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
 │ src/cli/contribute.ts                │ Rewrite wizard sections as ContributeWizard.tsx        │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
 │ src/cli/preset-handlers.ts           │ Rewrite edit flow as PresetEditor.tsx                  │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
 │ src/cli/shared.ts                    │ Update printBanner/printSection to use Ink             │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
 │ src/core/preset/preset-applier.ts    │ Replace interactive section with ConflictResolver.tsx  │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
 │ src/core/hooks/hook-dep-installer.ts │ Replace with HookInstaller.tsx                         │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
 │ src/core/security/scan-prompt.ts     │ Replace with SecurityPrompt.tsx                        │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
 │ src/utils/diff.ts                    │ Remove renderColoredDiff (keep pure functions)         │
 └──────────────────────────────────────┴────────────────────────────────────────────────────────┘

 Existing Code to Reuse

 ┌──────────────────────────────┬──────────────────────────────────────┬──────────────────────────────────────┐
 │             What             │                Where                 │                 How                  │
 ├──────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┤
 │ buildUnifiedDiff()           │ src/utils/diff.ts:8                  │ Keep as-is, called by DiffViewer.tsx │
 ├──────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┤
 │ countChanges()               │ src/utils/diff.ts:61                 │ Keep as-is, called by DiffMerge.tsx  │
 ├──────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┤
 │ ConflictFile interface       │ src/core/preset/preset-applier.ts:26 │ Move to shared types                 │
 ├──────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┤
 │ CommandResult<T>             │ src/core/output/types.ts             │ ResultScreen renders this            │
 ├──────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┤
 │ formatHuman() / formatJson() │ src/core/output/formatter.ts         │ Fallback for --json mode             │
 ├──────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┤
 │ Logger singleton             │ src/core/output/logger.ts            │ Unchanged, writes to stderr          │
 ├──────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┤
 │ HUB_ACTIONS array            │ src/cli/hub.ts:47                    │ GroupedMenu consumes this            │
 ├──────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┤
 │ PROJECT_* constants          │ src/constants.ts                     │ Banner/theme consume these           │
 ├──────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┤
 │ WizardResult interface       │ src/cli/init-wizard.ts:14            │ InitWizard returns this              │
 ├──────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┤
 │ CODI_ASCII_ART               │ src/cli/banner.ts:5                  │ Move to Banner.tsx                   │
 └──────────────────────────────┴──────────────────────────────────────┴──────────────────────────────────────┘

 Risks and Mitigations

 ┌───────────────────────────┬──────────────────────────────────────────────────────────────────────────────────────┐
 │           Risk            │                                      Mitigation                                      │
 ├───────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
 │ TSX build breakage        │ Only src/ink/ uses .tsx; test build in Phase 1 before proceeding                     │
 ├───────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
 │ 700-line limit            │ init-wizard-paths.ts already split into 4 components + FlagEditor                    │
 ├───────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
 │ Test coverage regression  │ Write new Ink tests alongside components; don't delete old tests until new ones pass │
 ├───────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
 │ Ink stdin/stdout conflict │ Only mount Ink after commander parsing completes; one Ink instance at a time         │
 ├───────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
 │ ESM + React interop       │ Ink v5 + React 18.3 are ESM-native; test import in Phase 1                           │
 ├───────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
 │ Branch drift              │ Rebase onto main daily; migration mostly touches src/cli/ and new src/ink/           │
 ├───────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
 │ --json/--quiet regression │ renderApp() skips Ink for these modes; dedicated tests in Phase 6                    │
 └───────────────────────────┴──────────────────────────────────────────────────────────────────────────────────────┘

 Verification

 1. npm run build succeeds with no TSX errors
 2. node dist/cli.js --help shows all commands
 3. node dist/cli.js --json init outputs valid JSON (no Ink rendering)
 4. node dist/cli.js launches CommandCenter with gradient banner
 5. node dist/cli.js init shows step progress, themed prompts, back navigation
 6. node dist/cli.js add shows themed wizard with step tracking
 7. Preset import with conflicts shows interactive DiffMerge UI
 8. npm test passes with >= 80% coverage
 9. All 14 migrated files have zero @clack/prompts or picocolors imports
