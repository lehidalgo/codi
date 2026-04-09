/* ===== LANG TOGGLE ===== */
var TRANSLATIONS = {
  en: {
    "nav.features": "Features",
    "nav.solo-teams": "Solo & Teams",
    "nav.quickstart": "Quick Start",
    "nav.docs": "Docs",
    "nav.install": "Install",
    "hero.badge": "Open source \u00b7 MIT \u00b7 v{version}",
    "hero.h1": 'Your AI coding configs<br><span class="gradient-text">in one place.</span>',
    "hero.sub":
      "You use Claude Code. Your teammate uses Cursor. Your CI runs Codex. Each tool has its own config format, its own rules, its own agents. The result: nobody shares the same instructions, so they all behave differently. Codi manages your rules, skills, agents, and MCPs in a single <code>.codi/</code> folder and automatically generates the correct native config for every coding agent.",
    "hero.cta1": "Install now \u2192",
    "hero.cta2": "View on GitHub",
    "hero.stat1": "AI agents in sync",
    "hero.stat2": "Ready-to-use templates",
    "hero.stat3": "Share as a preset",
    "hero.stat4": "Configs out of sync",
    "why.label": "Why Codi exists",
    "why.h2": 'More tools. More devs.<br><span class="gradient-text">More drift.</span>',
    "why.sub":
      "Imagine you add a security rule in Claude Code. Your teammate\u2019s Cursor won\u2019t load it \u2014 and your CI is still running with outdated rules.",
    "why.problem-badge": "Without Codi",
    "why.problem-h3": "Different coding agents, different configs. Zero coordination.",
    "why.problem-p":
      "Every tool uses a different file \u2014 CLAUDE.md, .cursorrules, AGENTS.md. Update one, but the others stay behind.",
    "why.problem-li1": "Five tools, five different file formats to maintain separately",
    "why.problem-li2": "Update one agent\u2019s rules \u2014 the others don\u2019t get it",
    "why.problem-li3": "New developer joins with no shared baseline \u2014 sets up from zero",
    "why.problem-li4": "No way to enforce the same standards across every tool and every developer",
    "why.solution-badge": "With Codi",
    "why.solution-h3": "One folder. Every agent in sync.",
    "why.solution-p":
      "Define your rules, skills, agents, and MCPs once in <code>.codi/</code> \u2014 Codi generates the native format each tool understands. Publish as a preset and your team installs the full setup with one command.",
    "why.solution-li1": "One source generates all agent configs \u2014 CLAUDE.md, .cursorrules, AGENTS.md, and more",
    "why.solution-li2": "New teammate runs <code>codi init</code> \u2014 full team setup, instantly",
    "why.solution-li3": "Git-tracked \u2014 every artifact change is versioned and auditable",
    "why.solution-li4": "Lock rules the team can\u2019t accidentally override",
    "feat.label": "Features",
    "feat.sub":
      "One adapter layer that syncs all artifacts to every agent at once. Hash-based drift detection. A 3-layer config system where tech leads lock standards the team can\u2019t bypass.",
    "feat.h2": 'What does <span class="gradient-text">Codi</span> bring you?',
    "feat.multi-h4": "One source. Every agent.",
    "feat.multi-p":
      "Write your rules, skills, agents, and MCPs once in <code>.codi/</code>. Codi generates CLAUDE.md, .cursorrules, AGENTS.md, .windsurfrules, .clinerules \u2014 every tool, every time.",
    "feat.templates-h4": "{templates}+ ready-made artifacts",
    "feat.templates-p":
      "28 rules, 67 skills, and 22 agents ready to install. Pick what fits your stack.",
    "feat.drift-h4": "Drift detection built in",
    "feat.drift-p":
      "SHA-256 hash on every generated file. Manual edit, bad merge, accidental overwrite \u2014 <code>codi status</code> catches it instantly.",
    "feat.presets-h4": "Tech lead defines it. Team installs it.",
    "feat.presets-p":
      "Bundle your rules, skills, agents, and MCPs into a preset and push to GitHub. Your team runs <code>codi init</code> and inherits the full setup from day one.",
    "feat.flags-h4": "Lock what matters",
    "feat.flags-p":
      "Three layers: preset \u2192 repo \u2192 user. Mark any flag as locked and it can\u2019t be overridden by individual developers \u2014 security checks and coding standards stay enforced across every machine.",
    "feat.hooks-h4": "{hooks} pre-commit hook types",
    "feat.hooks-p":
      "Auto-detects Husky, pre-commit, and Lefthook. Secret scanning and type checking included \u2014 nothing to configure.",
    "feat.watch-h4": "Watch mode with rollback",
    "feat.watch-p":
      "Runs in the background while you work. Regenerates on every save and keeps timestamped snapshots \u2014 roll back to any of them with one command.",
    "feat.onboard-h4": "AI-guided first setup",
    "feat.onboard-p":
      "<code>codi onboard</code> scans your codebase, detects your stack, and proposes which templates to use. No guessing which rules apply to your project.",
    "feat.verify-h4": "Verify integrity in CI",
    "feat.verify-p":
      "Every generated file gets an embedded SHA-256 token. Add <code>codi verify</code> to CI and it fails the build if anything was modified outside of Codi.",
    "who.label": "Solo or team. Same tool, different payoff.",
    "who.h2": 'Solo developer or for your Team',
    "who.sub":
      "The problem is the same whether you work alone or with twenty people \u2014 your AI tools don\u2019t share artifacts.",
    "who.solo-badge": "Solo Developer",
    "who.solo-h3": "Switch tools any time. Your artifacts come with you.",
    "who.solo-p":
      "Your Claude quota runs out and you switch to Codex \u2014 your rules, skills, and agents are already there. Whichever tool you open, it reads from the same <code>.codi/</code> folder.",
    "who.solo-li1": "Up and running in 60 seconds with a built-in preset",
    "who.solo-li2": "Switch tools any time \u2014 your setup travels with you",
    "who.solo-li3": "<code>codi onboard</code> proposes a config based on your actual codebase",
    "who.solo-li4": "Watch mode + snapshots \u2014 experiment without risk",
    "who.solo-li5": "Each sprint, your artifacts improve. So does every agent.",
    "who.team-badge": "Engineering Teams",
    "who.team-h3": "Tech lead defines the setup. Team inherits it.",
    "who.team-p":
      "The tech lead defines a preset once \u2014 rules, skills, agents, and MCPs for the project. Every developer installs it and is up to speed from day one.",
    "who.team-li1": "Tech lead defines the preset once \u2014 team installs with <code>codi init</code>",
    "who.team-li2": "Worth it from two developers \u2014 drift starts the moment you\u2019re not the only one",
    "who.team-li3": "Lock the rules that matter \u2014 security, testing, whatever the project requires",
    "who.team-li4": "<code>codi verify</code> in CI catches anything modified outside Codi",
    "who.team-li5": "New developers inherit the full team setup on day one",
    "improve.label": "How it gets better over time",
    "improve.h2":
      'Your artifacts improve over time.<br><span class="gradient-text">So does every agent.</span>',
    "improve.sub":
      "Every time your agent gets it wrong, Codi makes it easy to update your artifacts \u2014 ensuring continuous improvement.",
    "improve.step1-h4": "Use your agents normally",
    "improve.step1-p":
      "Ship features. Notice where agents miss your conventions, use the wrong patterns, or produce output that isn\u2019t quite right.",
    "improve.step2-h4": "Encode what you learned",
    "improve.step2-p":
      "Add a rule, update a skill, or refine an agent. Applies to every tool from that point on.",
    "improve.step3-h4": "Regenerate",
    "improve.step3-p":
      "Run <code>codi generate</code>. All {agents} agents pick up the change immediately.",
    "improve.step4-h4": "Never fix it again",
    "improve.step4-p":
      "The artifact applies from the next prompt. Do it regularly \u2014 the gap between sprint\u00a01 and sprint\u00a020 becomes visible.",
    "improve.before-label": "Sprint 1 \u2014 Default agent",
    "improve.vs-iters": "20 sprints",
    "improve.after-label": "Sprint 20 \u2014 Agent tuned to your work",
    "improve.footer":
      "Every artifact you improve makes every agent a little better. <strong>It compounds fast.</strong>",
    "agents.label": "Works with your tools \u2014 and keeps growing",
    "agents.soon": "soon",
    "qs.label": "Quick Start",
    "qs.sub": "Three commands. Every agent configured. No manual setup.",
    "qs.h2": 'Up and running <span class="gradient-text">in 60 seconds.</span>',
    "qs.step1-h4": "Install",
    "qs.step2-h4": "Initialize",
    "qs.step2-note":
      "Picks a preset, scaffolds <code>.codi/</code>, and generates all agent configs automatically.",
    "qs.step3-h4": "Verify",
    "qs.step3-note":
      "After editing <code>.codi/</code> files, run <code>codi generate</code> to resync.",
    "about.label": "Who made this",
    "about.role": "AI Engineer",
    "about.bio":
      "Four AI coding agents, four different configs \u2014 they always drifted. When my Claude quota ran out and I switched to Codex, nothing was in sync. Codi was what I needed.",
    "contact.label": "Get in touch",
    "contact.h2": 'Found a bug? Have feedback?<br><span class="gradient-text">I want to hear it.</span>',
    "contact.sub":
      "Drop me a message \u2014 bug reports, feature requests, or questions about AI coding agents.",
    "bar.total": "Total artifacts",
    "bar.skills": "Skills",
    "bar.rules": "Rules",
    "bar.agents": "Agents",
    "bar.mcp": "MCP servers",
    "modal.multi.label": "Multi-Agent",
    "modal.multi.title": "One folder. {agents} agents.",
    "modal.multi.desc":
      "Write once in <code>.codi/</code>. Codi generates the correct native format for every agent automatically.",
    "modal.multi.terminal-footer": "Sync guaranteed.",
    "modal.templates.label": "Built-in Library",
    "modal.templates.title": "Start from a strong baseline, not a blank file",
    "modal.templates.desc":
      "Codi ships with a curated library of rules, skills, and agents covering the most common development contexts. Install what you need, ignore what you don't, and extend with your own.",
    "modal.templates.section1": "What's included",
    "modal.templates.li1": "Security, testing, performance, documentation",
    "modal.templates.li2":
      "11 languages: TypeScript, Python, Go, Rust, Java, Kotlin, Swift, C#, Django, Spring Boot, Next.js",
    "modal.templates.li3": "Debugging, git workflow, architecture, code style",
    "modal.templates.li4": "Brainstorming, TDD, CI/CD, code review workflows",
    "modal.templates.section2": "Pick what fits",
    "modal.drift.label": "Drift Detection",
    "modal.drift.title": "Know the instant your configs drift",
    "modal.drift.desc":
      "Codi stores a SHA-256 hash of every generated file in <code>state.json</code>. Any manual edit, merge conflict, or accidental overwrite is detected immediately \u2014 before it causes inconsistent agent behavior across your team.",
    "modal.drift.section1": "Three states",
    "modal.drift.li1":
      "<strong>Synced</strong> \u2014 file matches the hash stored at generation time",
    "modal.drift.li2":
      "<strong>Drifted</strong> \u2014 file was modified after generation (manually or via merge)",
    "modal.drift.li3": "<strong>Missing</strong> \u2014 file was deleted or was never generated",
    "modal.presets.label": "Presets",
    "modal.presets.title": "Build your own preset. Share it anywhere.",
    "modal.presets.desc":
      "Package your rules, skills, agents, and MCPs into a preset. Share via GitHub or ZIP \u2014 your team installs in seconds.",
    "modal.presets.section1": "Create & publish",
    "modal.presets.section2": "Install from anywhere",
    "modal.flags.label": "Config Layers",
    "modal.flags.title": "3-layer config with locked flags",
    "modal.flags.desc":
      "Codi resolves configuration in three layers. Tech leads can lock specific flags so teams cannot accidentally override critical governance settings \u2014 security rules, testing standards, or deployment guards.",
    "modal.flags.layer1-name": "Preset",
    "modal.flags.layer1-desc": "Community or team baseline \u2014 lowest priority",
    "modal.flags.layer2-name": "Repo",
    "modal.flags.layer2-desc": "Project-level overrides \u2014 locked flags enforced here",
    "modal.flags.layer3-name": "User",
    "modal.flags.layer3-desc": "Personal preferences \u2014 cannot override locked flags",
    "modal.hooks.label": "Pre-commit Hooks",
    "modal.hooks.title": "14 hook types, zero manual config",
    "modal.hooks.desc":
      "Codi auto-detects your hook manager (Husky, pre-commit, or Lefthook) and configures all your hooks in one command. No YAML wrangling, no version conflicts.",
    "modal.watch.label": "Watch Mode",
    "modal.watch.title": "Live regeneration and instant rollback",
    "modal.watch.desc":
      "Watch mode monitors your <code>.codi/</code> directory and regenerates all agent configs the moment you save a change. Every regeneration creates a timestamped backup \u2014 revert to any snapshot with one command.",
    "modal.watch.section1": "Revert to any snapshot",
    "modal.onboard.label": "AI Onboarding",
    "modal.onboard.title": "Zero manual setup",
    "modal.onboard.desc":
      "Run <code>codi onboard</code> and your AI agent explores the entire codebase, detects the tech stack, identifies existing conventions, and proposes a tailored Codi configuration. Review, approve, and you're done.",
    "modal.verify.label": "Verification",
    "modal.verify.title": "Tamper-proof generated files",
    "modal.verify.desc":
      "Every file Codi generates contains an embedded SHA-256 verification token. Run <code>codi verify</code> in CI or locally to confirm that no generated file has been modified outside of Codi.",
    "modal.verify.section1": "Verify in CI",
  },
  es: {
    "nav.features": "Caracter\u00edsticas",
    "nav.solo-teams": "Solo y Equipos",
    "nav.quickstart": "Inicio r\u00e1pido",
    "nav.docs": "Docs",
    "nav.install": "Instalar",
    "hero.badge": "C\u00f3digo abierto \u00b7 MIT \u00b7 v{version}",
    "hero.h1": 'Tus configs de IA<br><span class="gradient-text">en un solo lugar.</span>',
    "hero.sub":
      "T\u00fa usas Claude Code. Tu compa\u00f1ero usa Cursor. Tu CI corre Codex. Cada herramienta tiene su propio formato de config, sus propias reglas, sus propios agentes. El resultado: nadie comparte las mismas instrucciones, as\u00ed que todos se comportan de forma distinta. Codi gestiona tus reglas, skills, agentes y MCPs en una sola carpeta <code>.codi/</code> y genera autom\u00e1ticamente la configuraci\u00f3n nativa correcta para cada agente de c\u00f3digo.",
    "hero.cta1": "Instalar ahora \u2192",
    "hero.cta2": "Ver en GitHub",
    "hero.stat1": "Agentes IA sincronizados",
    "hero.stat2": "Plantillas listas para usar",
    "hero.stat3": "Comparte como preset",
    "hero.stat4": "Configs desincronizadas",
    "why.label": "Por qu\u00e9 existe Codi",
    "why.h2": 'M\u00e1s herramientas. M\u00e1s devs.<br><span class="gradient-text">M\u00e1s desincronizaci\u00f3n.</span>',
    "why.sub":
      "Imagina que a\u00f1ades una regla de seguridad en Claude Code. El Cursor de tu compa\u00f1ero no la va a cargar \u2014 y tu CI sigue corriendo con reglas desactualizadas.",
    "why.problem-badge": "Sin Codi",
    "why.problem-h3": "Diferentes Agentes de C\u00f3digo, diferente configuraci\u00f3n. Cero coordinaci\u00f3n.",
    "why.problem-p":
      "Cada herramienta usa un archivo diferente \u2014 CLAUDE.md, .cursorrules, AGENTS.md. Actualizas uno, pero los dem\u00e1s se quedan atr\u00e1s.",
    "why.problem-li1": "Cinco herramientas, cinco formatos distintos que mantener por separado",
    "why.problem-li2": "Actualizas las reglas de un agente \u2014 los dem\u00e1s no lo reciben",
    "why.problem-li3": "Nuevo desarrollador sin base compartida \u2014 configura desde cero",
    "why.problem-li4": "Sin forma de aplicar los mismos est\u00e1ndares en todas las herramientas y todo el equipo",
    "why.solution-badge": "Con Codi",
    "why.solution-h3": "Una carpeta. Todos los agentes sincronizados.",
    "why.solution-p":
      "Define tus reglas, skills, agentes y MCPs una vez en <code>.codi/</code> \u2014 Codi genera el formato nativo que cada herramienta entiende. Publ\u00edcalo como preset y tu equipo instala el setup completo con un solo comando.",
    "why.solution-li1": "Una fuente genera todas las configs \u2014 CLAUDE.md, .cursorrules, AGENTS.md y m\u00e1s",
    "why.solution-li2": "El nuevo compa\u00f1ero ejecuta <code>codi init</code> \u2014 setup completo del equipo, al instante",
    "why.solution-li3": "En git \u2014 cada cambio de artefacto queda versionado y auditado",
    "why.solution-li4": "Bloquea las reglas que el equipo no puede ignorar por accidente",
    "feat.label": "Caracter\u00edsticas",
    "feat.sub":
      "Una capa adaptadora que sincroniza todos tus artefactos con todos los agentes a la vez. Detecci\u00f3n de desincronizaci\u00f3n por hash. Un sistema de config en 3 capas donde los tech leads bloquean est\u00e1ndares que el equipo no puede saltarse.",
    "feat.h2": '\u00bfQu\u00e9 te ofrece <span class="gradient-text">Codi</span>?',
    "feat.multi-h4": "Una fuente. Todos los agentes.",
    "feat.multi-p":
      "Escribe tus reglas, skills, agentes y MCPs una vez en <code>.codi/</code>. Codi genera CLAUDE.md, .cursorrules, AGENTS.md, .windsurfrules, .clinerules \u2014 todas las herramientas, siempre.",
    "feat.templates-h4": "{templates}+ artefactos listos para usar",
    "feat.templates-p":
      "28 reglas, 67 skills y 22 agentes listos para instalar. Elige lo que encaja en tu stack.",
    "feat.drift-h4": "Detecci\u00f3n de desincronizaci\u00f3n integrada",
    "feat.drift-p":
      "Hash SHA-256 en cada archivo generado. Edici\u00f3n manual, merge incorrecto, sobreescritura accidental \u2014 <code>codi status</code> lo detecta al instante.",
    "feat.presets-h4": "El tech lead lo define. El equipo lo instala.",
    "feat.presets-p":
      "Empaqueta tus reglas, skills, agentes y MCPs en un preset y s\u00fabelo a GitHub. Tu equipo ejecuta <code>codi init</code> y hereda el setup completo desde el primer d\u00eda.",
    "feat.flags-h4": "Bloquea lo que importa",
    "feat.flags-p":
      "Tres capas: preset \u2192 repo \u2192 usuario. Marca cualquier flag como bloqueado y no puede ser sobreescrito por desarrolladores individuales \u2014 los controles de seguridad y est\u00e1ndares se aplican en todas las m\u00e1quinas.",
    "feat.hooks-h4": "{hooks} tipos de hook pre-commit",
    "feat.hooks-p":
      "Detecta autom\u00e1ticamente Husky, pre-commit y Lefthook \u2014 escaneo de secretos y chequeo de tipos incluidos. Sin configuraci\u00f3n manual.",
    "feat.watch-h4": "Modo watch con rollback",
    "feat.watch-p":
      "Corre en segundo plano mientras trabajas. Regenera en cada guardado y guarda snapshots con timestamp \u2014 vuelve a cualquiera con un comando.",
    "feat.onboard-h4": "Primera configuraci\u00f3n con IA",
    "feat.onboard-p":
      "<code>codi onboard</code> analiza tu codebase, detecta tu stack y propone qu\u00e9 plantillas usar. Sin adivinar qu\u00e9 reglas aplican a tu proyecto.",
    "feat.verify-h4": "Verifica la integridad en CI",
    "feat.verify-p":
      "Cada archivo generado lleva un token SHA-256 embebido. A\u00f1ade <code>codi verify</code> al CI y fallar\u00e1 el build si algo fue modificado fuera de Codi.",
    "who.label": "Solo o en equipo. La misma herramienta, distinto impacto.",
    "who.h2": 'Para ti o para tu equipo',
    "who.sub":
      "El problema es el mismo tanto si trabajas solo como con veinte personas \u2014 tus herramientas de IA no comparten artefactos.",
    "who.solo-badge": "Desarrollador Solo",
    "who.solo-h3": "Cambia de herramienta cuando quieras. Tus artefactos van contigo.",
    "who.solo-p":
      "Se te acaba la cuota de Claude y cambias a Codex \u2014 tus reglas, skills y agentes ya est\u00e1n ah\u00ed. Cualquier herramienta que abras lee la misma carpeta <code>.codi/</code>.",
    "who.solo-li1": "Operativo en 60 segundos con un preset incluido",
    "who.solo-li2": "Cambia de herramienta cuando quieras \u2014 tu setup viaja contigo",
    "who.solo-li3": "<code>codi onboard</code> propone una config basada en tu codebase real",
    "who.solo-li4": "Modo watch + snapshots \u2014 experimenta sin riesgo",
    "who.solo-li5": "Sprint a sprint, tus artefactos mejoran. Igual que cada agente.",
    "who.team-badge": "Equipos de Ingenier\u00eda",
    "who.team-h3": "El tech lead define el setup. El equipo lo hereda.",
    "who.team-p":
      "El tech lead define el preset \u2014 reglas, skills, agentes y MCPs para el proyecto. Cada desarrollador lo instala y lo adopta desde el primer d\u00eda.",
    "who.team-li1": "El tech lead define el preset una vez \u2014 el equipo instala con <code>codi init</code>",
    "who.team-li2": "Vale la pena desde dos desarrolladores \u2014 la desincronizaci\u00f3n empieza en cuanto no eres el \u00fanico",
    "who.team-li3": "Bloquea las reglas que importan \u2014 seguridad, testing, lo que el proyecto requiera",
    "who.team-li4": "<code>codi verify</code> en CI detecta cualquier cambio hecho fuera de Codi",
    "who.team-li5": "Los nuevos desarrolladores heredan el setup completo del equipo desde el primer d\u00eda",
    "improve.label": "C\u00f3mo mejora con el tiempo",
    "improve.h2":
      'Tus artefactos mejoran con el tiempo.<br><span class="gradient-text">Igual que cada agente.</span>',
    "improve.sub":
      "Cada vez que tu agente se equivoca, Codi te facilita actualizar los artefactos \u2014 garantizando as\u00ed una mejora continua.",
    "improve.step1-h4": "Usa tus agentes con normalidad",
    "improve.step1-p":
      "Entrega funcionalidades. F\u00edjate d\u00f3nde los agentes fallan tus convenciones, usan patrones incorrectos o producen output que no es del todo correcto.",
    "improve.step2-h4": "Registra lo que aprendiste",
    "improve.step2-p":
      "A\u00f1ade una regla, actualiza una skill o refina un agente. Aplica a todas las herramientas a partir de ese momento.",
    "improve.step3-h4": "Regenera",
    "improve.step3-p":
      "Ejecuta <code>codi generate</code>. Los {agents} agentes recogen el cambio de inmediato.",
    "improve.step4-h4": "No vuelves a corregirlo",
    "improve.step4-p":
      "El artefacto aplica desde el siguiente prompt. Ese patr\u00f3n no vuelve. H\u00e1zlo con regularidad \u2014 y la diferencia entre el sprint\u00a01 y el sprint\u00a020 se vuelve visible.",
    "improve.before-label": "Sprint 1 \u2014 Agente por defecto",
    "improve.vs-iters": "20 sprints",
    "improve.after-label": "Sprint 20 \u2014 Agente ajustado a tu trabajo",
    "improve.footer":
      "Cada artefacto que mejoras hace a cada agente un poco mejor. <strong>Se acumula r\u00e1pido.</strong>",
    "agents.label": "Funciona con tus herramientas \u2014 y sigue creciendo",
    "agents.soon": "pronto",
    "qs.label": "Inicio r\u00e1pido",
    "qs.sub":
      "Tres comandos. Todos los agentes configurados. Sin setup manual.",
    "qs.h2": 'Operativo <span class="gradient-text">en 60 segundos.</span>',
    "qs.step1-h4": "Instalar",
    "qs.step2-h4": "Inicializar",
    "qs.step2-note":
      "Elige un preset, genera el directorio <code>.codi/</code> y crea todos los archivos de config autom\u00e1ticamente.",
    "qs.step3-h4": "Verificar",
    "qs.step3-note":
      "Tras editar archivos en <code>.codi/</code>, ejecuta <code>codi generate</code> para resincronizar.",
    "about.label": "Qui\u00e9n lo hizo",
    "about.role": "Ingeniero de IA",
    "about.bio":
      "Cuatro herramientas de IA, cuatro configs separadas \u2014 siempre se desincronizaban. Cuando se me acab\u00f3 la cuota de Claude y cambi\u00e9 a Codex, nada estaba en sincron\u00eda. Codi era lo que necesitaba.",
    "contact.label": "Contacto",
    "contact.h2": '\u00bfEncontraste un bug? \u00bfTienes feedback?<br><span class="gradient-text">Quiero escucharlo.</span>',
    "contact.sub":
      "Manda un mensaje \u2014 bugs, ideas o preguntas sobre agentes de IA para programar.",
    "bar.total": "Artefactos totales",
    "bar.skills": "Skills",
    "bar.rules": "Reglas",
    "bar.agents": "Agentes",
    "bar.mcp": "Servidores MCP",
    "modal.multi.label": "Multi-Agente",
    "modal.multi.title": "Una carpeta. {agents} agentes.",
    "modal.multi.desc":
      "Escribe una vez en <code>.codi/</code>. Codi genera el formato nativo correcto para cada agente autom\u00e1ticamente.",
    "modal.multi.terminal-footer": "Sincronizaci\u00f3n garantizada.",
    "modal.templates.label": "Biblioteca incluida",
    "modal.templates.title": "Empieza con una base s\u00f3lida, no desde cero",
    "modal.templates.desc":
      "Codi viene con una biblioteca de reglas, skills y agentes para los contextos de desarrollo m\u00e1s comunes. Instala lo que necesites, ignora lo que no, y ampl\u00eda con los tuyos.",
    "modal.templates.section1": "Qu\u00e9 incluye",
    "modal.templates.li1": "Seguridad, testing, rendimiento, documentaci\u00f3n",
    "modal.templates.li2":
      "11 lenguajes: TypeScript, Python, Go, Rust, Java, Kotlin, Swift, C#, Django, Spring Boot, Next.js",
    "modal.templates.li3": "Debugging, flujo de git, arquitectura, estilo de c\u00f3digo",
    "modal.templates.li4": "Brainstorming, TDD, CI/CD, flujos de revisi\u00f3n de c\u00f3digo",
    "modal.templates.section2": "Elige lo que encaja",
    "modal.drift.label": "Detecci\u00f3n de cambios",
    "modal.drift.title": "Sabes al instante cuando tus configs se desincronizaron",
    "modal.drift.desc":
      "Codi almacena un hash SHA-256 de cada archivo generado en <code>state.json</code>. Cualquier edici\u00f3n manual, conflicto de merge o sobreescritura accidental se detecta de inmediato \u2014 antes de que cause comportamientos inconsistentes en tu equipo.",
    "modal.drift.section1": "Tres estados",
    "modal.drift.li1":
      "<strong>Sincronizado</strong> \u2014 el archivo coincide con el hash guardado en el momento de la generaci\u00f3n",
    "modal.drift.li2":
      "<strong>Desviado</strong> \u2014 el archivo fue modificado despu\u00e9s de generarse (manualmente o por un merge)",
    "modal.drift.li3":
      "<strong>Faltante</strong> \u2014 el archivo fue borrado o nunca se gener\u00f3",
    "modal.presets.label": "Presets",
    "modal.presets.title": "Crea tu propio preset. Comp\u00e1rtelo donde quieras.",
    "modal.presets.desc":
      "Empaqueta tus reglas, skills, agentes y MCPs en un preset. Comp\u00e1rtelo v\u00eda GitHub o ZIP \u2014 tu equipo lo instala en segundos.",
    "modal.presets.section1": "Crea y publica",
    "modal.presets.section2": "Instala desde cualquier lado",
    "modal.flags.label": "Capas de config",
    "modal.flags.title": "Config de 3 capas con flags bloqueadas",
    "modal.flags.desc":
      "Codi resuelve la configuraci\u00f3n en tres capas. Los tech leads pueden bloquear flags espec\u00edficas para que el equipo no pueda sobreescribir ajustes cr\u00edticos \u2014 reglas de seguridad, est\u00e1ndares de testing o guardas de despliegue.",
    "modal.flags.layer1-name": "Preset",
    "modal.flags.layer1-desc": "Base del equipo o la comunidad \u2014 prioridad m\u00e1s baja",
    "modal.flags.layer2-name": "Repo",
    "modal.flags.layer2-desc":
      "Overrides a nivel de proyecto \u2014 flags bloqueadas se aplican aqu\u00ed",
    "modal.flags.layer3-name": "Usuario",
    "modal.flags.layer3-desc":
      "Preferencias personales \u2014 no puede sobreescribir flags bloqueadas",
    "modal.hooks.label": "Hooks pre-commit",
    "modal.hooks.title": "14 tipos de hook, sin config manual",
    "modal.hooks.desc":
      "Codi detecta autom\u00e1ticamente tu gestor de hooks (Husky, pre-commit o Lefthook) y configura todos tus hooks con un solo comando. Sin liar con YAML, sin conflictos de versiones.",
    "modal.watch.label": "Modo watch",
    "modal.watch.title": "Regeneraci\u00f3n en vivo y rollback instant\u00e1neo",
    "modal.watch.desc":
      "El modo watch monitoriza tu directorio <code>.codi/</code> y regenera todas las configs de los agentes en cuanto guardas un cambio. Cada regeneraci\u00f3n crea un backup con timestamp \u2014 revierte a cualquier snapshot con un solo comando.",
    "modal.watch.section1": "Revierte a cualquier snapshot",
    "modal.onboard.label": "Onboarding con IA",
    "modal.onboard.title": "Sin configuraci\u00f3n manual",
    "modal.onboard.desc":
      "Ejecuta <code>codi onboard</code> y tu agente de IA explora todo el repositorio, detecta el stack, identifica las convenciones existentes y propone una configuraci\u00f3n de Codi a medida. Rev\u00edsala, apru\u00e9bala y listo.",
    "modal.verify.label": "Verificaci\u00f3n",
    "modal.verify.title": "Archivos generados a prueba de modificaciones",
    "modal.verify.desc":
      "Cada archivo que genera Codi contiene un token de verificaci\u00f3n SHA-256 embebido. Ejecuta <code>codi verify</code> en CI o en local para confirmar que ning\u00fan archivo generado ha sido modificado fuera de Codi.",
    "modal.verify.section1": "Verificar en CI",
  },
};

/* ── Stats: loaded from stats.json (generated from source at build time) ── */
var STATS = {};

function resolveStats(str) {
  return str.replace(/\{(\w+)\}/g, function (_, key) {
    return STATS[key] !== undefined ? STATS[key] : "{" + key + "}";
  });
}

function applyStats() {
  // Update standalone number elements
  document.querySelectorAll("[data-stat]").forEach(function (el) {
    var key = el.getAttribute("data-stat");
    if (STATS[key] === undefined) return;
    el.textContent = key === "version" ? "v" + STATS[key] : String(STATS[key]);
  });
  // Re-render translations so {placeholder} strings resolve with real values
  applyLang(currentLang);
}

fetch("stats.json")
  .then(function (r) {
    return r.json();
  })
  .then(function (data) {
    STATS = data;
    applyStats();
  })
  .catch(function () {
    /* stats.json unavailable — hardcoded fallbacks remain */
  });

/* ── i18n ── */

function setHtml(el, markup) {
  el.replaceChildren(document.createRange().createContextualFragment(markup));
}

function applyLang(lang, root) {
  root = root || document;
  var t = TRANSLATIONS[lang];
  if (!t) return;
  root.querySelectorAll("[data-i18n]").forEach(function (el) {
    var key = el.getAttribute("data-i18n");
    if (t[key] !== undefined) el.textContent = resolveStats(t[key]);
  });
  root.querySelectorAll("[data-i18n-html]").forEach(function (el) {
    var key = el.getAttribute("data-i18n-html");
    if (t[key] !== undefined) setHtml(el, resolveStats(t[key]));
  });
}

var currentLang = localStorage.getItem("codi-lang") || "en";
document.documentElement.lang = currentLang;

document.querySelectorAll(".lang-btn").forEach(function (btn) {
  btn.classList.toggle("lang-active", btn.dataset.lang === currentLang);
  btn.addEventListener("click", function () {
    currentLang = btn.dataset.lang;
    localStorage.setItem("codi-lang", currentLang);
    document.documentElement.lang = currentLang;
    applyLang(currentLang);
    document.querySelectorAll(".lang-btn").forEach(function (b) {
      b.classList.toggle("lang-active", b.dataset.lang === currentLang);
    });
  });
});

if (currentLang !== "en") applyLang(currentLang);

/* ===== REVEAL ON SCROLL ===== */
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.08, rootMargin: "0px 0px -36px 0px" },
);

document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

/* ===== NAV SCROLL STATE ===== */
const nav = document.getElementById("nav");
window.addEventListener(
  "scroll",
  () => {
    nav.classList.toggle("scrolled", window.scrollY > 24);
  },
  { passive: true },
);

/* ===== MOBILE NAV TOGGLE ===== */
const hamburger = document.getElementById("hamburger");
const navLinks = document.getElementById("nav-links");

hamburger.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  hamburger.setAttribute("aria-expanded", open);
  const spans = hamburger.querySelectorAll("span");
  if (open) {
    spans[0].style.transform = "translateY(7px) rotate(45deg)";
    spans[1].style.opacity = "0";
    spans[2].style.transform = "translateY(-7px) rotate(-45deg)";
  } else {
    spans.forEach((s) => {
      s.style.transform = "";
      s.style.opacity = "";
    });
  }
});

navLinks.querySelectorAll("a").forEach((a) => {
  a.addEventListener("click", () => {
    navLinks.classList.remove("open");
    hamburger.setAttribute("aria-expanded", "false");
    hamburger.querySelectorAll("span").forEach((s) => {
      s.style.transform = "";
      s.style.opacity = "";
    });
  });
});

/* ===== COPY TO CLIPBOARD ===== */
// Static SVG strings — never derived from user input
const ICON_COPY =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const ICON_CHECK =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

document.querySelectorAll(".copy-btn").forEach((btn) => {
  // Initialise with known-safe static icon
  btn.innerHTML = ICON_COPY;

  btn.addEventListener("click", async () => {
    const text = btn.dataset.copy;
    try {
      await navigator.clipboard.writeText(text);
      btn.classList.add("copied");
      btn.innerHTML = ICON_CHECK;
      setTimeout(() => {
        btn.classList.remove("copied");
        btn.innerHTML = ICON_COPY;
      }, 2200);
    } catch {
      // Fallback: select the command text
      const cmd = btn.previousElementSibling;
      if (cmd) {
        const range = document.createRange();
        range.selectNodeContents(cmd);
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    }
  });
});

// ── Hero orbit visualization ──
(function initOrbit() {
  var stage = document.getElementById("orbit-stage");
  if (!stage) return;

  var INNER_R = 100;
  var OUTER_R = 168;
  var INNER_SZ = 44;
  var OUTER_SZ = 36;

  var supported = [
    {
      id: "claude",
      label: "Claude Code",
      img: "https://unpkg.com/@lobehub/icons-static-png@latest/dark/claude.png",
      phase: 0,
    },
    {
      id: "cursor",
      label: "Cursor",
      img: "https://unpkg.com/@lobehub/icons-static-png@latest/dark/cursor.png",
      phase: (2 * Math.PI) / 5,
    },
    {
      id: "codex",
      label: "Codex",
      img: "https://unpkg.com/@lobehub/icons-static-png@latest/dark/openai.png",
      phase: (4 * Math.PI) / 5,
    },
    {
      id: "windsurf",
      label: "Windsurf",
      img: "https://unpkg.com/@lobehub/icons-static-png@latest/dark/windsurf.png",
      phase: (6 * Math.PI) / 5,
    },
    {
      id: "cline",
      label: "Cline",
      img: "https://unpkg.com/@lobehub/icons-static-png@latest/dark/cline.png",
      phase: (8 * Math.PI) / 5,
    },
  ];

  var soon = [
    {
      id: "copilot",
      label: "GitHub Copilot CLI",
      img: "https://unpkg.com/@lobehub/icons-static-png@latest/dark/copilot.png",
      phase: Math.PI / 6,
    },
    {
      id: "gemini",
      label: "Gemini CLI",
      img: "https://unpkg.com/@lobehub/icons-static-png@latest/dark/gemini.png",
      phase: Math.PI / 6 + (2 * Math.PI) / 3,
    },
    {
      id: "antigravity",
      label: "Antigravity",
      img: "https://unpkg.com/@lobehub/icons-static-png@latest/dark/antigravity.png",
      phase: Math.PI / 6 + (4 * Math.PI) / 3,
    },
  ];

  // Orbit rings
  function makeRing(r, cls) {
    var el = document.createElement("div");
    el.className = "orbit-ring " + cls;
    el.style.width = r * 2 + "px";
    el.style.height = r * 2 + "px";
    stage.appendChild(el);
  }
  makeRing(INNER_R, "orbit-ring--inner");
  makeRing(OUTER_R, "orbit-ring--outer");

  // Center node — code icon with brand gradient
  var center = document.createElement("div");
  center.className = "orbit-center";
  center.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="url(#og)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><defs><linearGradient id="og" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#56b6c2"/><stop offset="100%" stop-color="#61afef"/></linearGradient></defs><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>';
  stage.appendChild(center);

  // Icon nodes
  function makeNode(item, size, isSupported) {
    var el = document.createElement("div");
    el.className = "o-icon" + (isSupported ? " o-icon--supported" : " o-icon--soon");
    el.style.width = size + "px";
    el.style.height = size + "px";

    var inner = document.createElement("div");
    inner.className = "o-icon-inner";

    if (item.img) {
      var img = document.createElement("img");
      img.src = item.img;
      img.alt = "";
      img.draggable = false;
      inner.appendChild(img);
    } else {
      var txt = document.createElement("span");
      txt.className = "o-icon-text";
      txt.textContent = item.label.slice(0, 2).toUpperCase();
      inner.appendChild(txt);
    }
    el.appendChild(inner);

    if (isSupported) {
      var check = document.createElement("span");
      check.className = "o-check";
      check.textContent = "\u2713";
      el.appendChild(check);
    } else {
      var badge = document.createElement("span");
      badge.className = "o-soon-badge";
      badge.setAttribute("data-i18n", "agents.soon");
      badge.textContent = "soon";
      el.appendChild(badge);
    }

    var tip = document.createElement("span");
    tip.className = "o-tooltip";
    tip.textContent = item.label;
    el.appendChild(tip);

    stage.appendChild(el);
    item.el = el;
  }

  supported.forEach(function (item) {
    makeNode(item, INNER_SZ, true);
  });
  soon.forEach(function (item) {
    makeNode(item, OUTER_SZ, false);
  });

  // rAF animation
  var t = 0;
  var lastTs = null;
  var _rafId = null;
  var paused = false;

  function setPositions() {
    supported.forEach(function (item) {
      var angle = t * 0.38 + item.phase;
      var x = Math.cos(angle) * INNER_R;
      var y = Math.sin(angle) * INNER_R;
      item.el.style.transform = "translate(calc(" + x + "px - 50%), calc(" + y + "px - 50%))";
    });
    soon.forEach(function (item) {
      var angle = t * -0.24 + item.phase;
      var x = Math.cos(angle) * OUTER_R;
      var y = Math.sin(angle) * OUTER_R;
      item.el.style.transform = "translate(calc(" + x + "px - 50%), calc(" + y + "px - 50%))";
    });
  }

  function tick(ts) {
    if (!paused) {
      if (lastTs !== null) {
        var dt = Math.min((ts - lastTs) / 1000, 0.05);
        t += dt;
      }
      lastTs = ts;
      setPositions();
    }
    _rafId = requestAnimationFrame(tick);
  }

  stage.addEventListener("mouseenter", function () {
    paused = true;
    lastTs = null;
  });
  stage.addEventListener("mouseleave", function () {
    paused = false;
  });

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    setPositions(); // static layout only
  } else {
    _rafId = requestAnimationFrame(tick);
  }
})();

// ── Feature modal ──
(function () {
  var overlay = document.getElementById("feature-modal");
  var closeBtn = document.getElementById("modal-close");
  var slot = document.getElementById("modal-slot");
  if (!overlay || !closeBtn || !slot) return;

  function openFeature(id) {
    var tpl = document.getElementById("tpl-" + id);
    if (!tpl) return;
    slot.replaceChildren(tpl.content.cloneNode(true));
    applyLang(currentLang, slot);
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    closeBtn.focus();
  }

  function closeFeature() {
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  document.querySelector(".features-grid").addEventListener("click", function (e) {
    var card = e.target.closest("[data-feature]");
    if (card) openFeature(card.dataset.feature);
  });

  document.querySelector(".features-grid").addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      var card = e.target.closest("[data-feature]");
      if (card) {
        e.preventDefault();
        openFeature(card.dataset.feature);
      }
    }
  });

  closeBtn.addEventListener("click", closeFeature);

  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeFeature();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay.classList.contains("is-open")) closeFeature();
  });
})();
