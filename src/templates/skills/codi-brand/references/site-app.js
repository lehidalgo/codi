/* ===== LANG TOGGLE ===== */
var TRANSLATIONS = {
  en: {
    "nav.features": "Features",
    "nav.solo-teams": "Solo & Teams",
    "nav.quickstart": "Quick Start",
    "nav.install": "Install",
    "hero.badge": "v{version} \u2014 works with {agents} agents",
    "hero.h1": 'Your AI knowledge,<br><span class="gradient-text">in one place.</span>',
    "hero.sub":
      "You use Claude Code. Your teammate uses Cursor. Your CI runs Codex. None of them share the same rules, so they all behave a little differently. Codi fixes that \u2014 one <code>.codi/</code> folder, tracked with git, that generates the right config for every agent. No more drift.",
    "hero.cta1": "Quick Start \u2192",
    "hero.cta2": "View on GitHub",
    "hero.stat1": "AI agents in sync",
    "hero.stat2": "Ready-to-use templates",
    "hero.stat3": "Share as a preset",
    "hero.stat4": "Configs out of sync",
    "why.label": "The problem",
    "why.h2": 'Your agents don\u2019t<br><span class="gradient-text">share the same rules.</span>',
    "why.sub":
      "Every tool has its own config. Every new hire has to set up from scratch. Every teammate uses slightly different rules.",
    "why.problem-badge": "Without Codi",
    "why.problem-h3": "The problem with multiple AI tools",
    "why.problem-p":
      "You add a security rule to Claude Code. Your teammate\u2019s Cursor doesn\u2019t know about it. Your CI runs Codex with whatever rules it had two weeks ago.",
    "why.problem-li1": "Every agent has a different config format",
    "why.problem-li2": "New teammate? Set up from scratch again",
    "why.problem-li3": "Rules drift the moment someone edits directly",
    "why.problem-li4": "No way to enforce team-wide standards",
    "why.solution-badge": "With Codi",
    "why.solution-h3": "Write once, works everywhere",
    "why.solution-p":
      "Drop your rules in <code>.codi/</code> and run <code>codi generate</code>. Every agent gets updated instantly, always in sync.",
    "why.solution-li1": "One folder drives all 6 agents",
    "why.solution-li2": "New teammate runs <code>codi init</code> and inherits everything",
    "why.solution-li3": "Git-tracked \u2014 every change is auditable",
    "why.solution-li4": "Lock rules your team can\u2019t override",
    "feat.label": "Features",
    "feat.sub":
      "Everything to keep your AI agents in sync — from first setup to team-wide enforcement.",
    "feat.h2": 'All you need.<br><span class="gradient-text">Nothing you don\u2019t.</span>',
    "feat.multi-h4": "One folder, {agents} agents",
    "feat.multi-p":
      "Everything lives in <code>.codi/</code>. Codi reads it and writes the right config for each agent \u2014 Claude Code, Cursor, Codex, Windsurf, and Cline.",
    "feat.templates-h4": "Don't start from scratch",
    "feat.templates-p":
      "There are {templates}+ templates already there for common languages, frameworks, security, and testing patterns. Pick what fits, skip what doesn\u2019t.",
    "feat.drift-h4": "Drift detection",
    "feat.drift-p":
      "If a generated file gets edited directly, Codi notices. You\u2019ll always know when something\u2019s out of sync.",
    "feat.presets-h4": "Share your setup",
    "feat.presets-p":
      "Pack your rules, skills, and agents into a preset and push it to GitHub. Everyone on your team installs it with one command \u2014 same config, same agent behavior, no setup time.",
    "feat.flags-h4": "Locked flags",
    "feat.flags-p":
      "Three layers: preset, repo, user. As a tech lead you can lock the rules your team can\u2019t change \u2014 things like security checks or test coverage requirements.",
    "feat.hooks-h4": "{hooks} hook types",
    "feat.hooks-p":
      "Auto-detects Husky, pre-commit, and Lefthook. Secret scanning and type checking come out of the box.",
    "feat.watch-h4": "Watch + revert",
    "feat.watch-p":
      "Leave it running while you work. It regenerates on every save and keeps snapshots you can roll back to if something breaks.",
    "feat.onboard-h4": "AI onboarding",
    "feat.onboard-p":
      "<code>codi onboard</code> reads your codebase and suggests a config that fits your stack.",
    "feat.verify-h4": "Verification tokens",
    "feat.verify-p":
      "Every generated file gets a SHA-256 hash. Run <code>codi verify</code> to make sure nothing\u2019s been changed by hand.",
    "who.label": "Who it's for",
    "who.h2": 'Works for solo devs<br><span class="gradient-text">and teams alike</span>',
    "who.sub":
      "Same tool, different payoffs depending on whether you\u2019re working alone or with a team.",
    "who.solo-badge": "Solo Developer",
    "who.solo-h3": "Gets better the more you use it",
    "who.solo-p":
      "Start from a preset. Each time an agent does something you don\u2019t like, write a rule. Over time your <code>.codi/</code> becomes a pretty accurate picture of how you like to work \u2014 and any new AI tool you pick up just inherits it.",
    "who.solo-li1": "Running in 60 seconds with a built-in preset",
    "who.solo-li2": "Noticed a pattern the agent keeps missing? Write a rule.",
    "who.solo-li3": "<code>codi onboard</code> suggests a config based on your actual codebase",
    "who.solo-li4": "Watch mode + snapshots \u2014 safe to experiment",
    "who.solo-li5": "Each sprint, your agents know your code a little better",
    "who.team-badge": "Engineering Teams",
    "who.team-h3": "Everyone works from the same rules",
    "who.team-p":
      "Right now every developer on your team probably has their own AI setup, and those configs don\u2019t talk to each other. Someone adds a rule, nobody else gets it. New hire joins \u2014 they start from zero. With Codi, the tech lead sets things up once and everyone installs the same preset. New hires are up and running in minutes.",
    "who.team-li1": "Set it up once, share it with the whole team",
    "who.team-li2": "Lock the rules that matter \u2014 security, testing, whatever your team needs",
    "who.team-li3": "Drift detection keeps everyone on the same page",
    "who.team-li4": "<code>codi verify</code> in CI catches anything changed by hand",
    "who.team-li5": "New hire runs <code>codi init</code> and gets everything",
    "improve.label": "The compounding effect",
    "improve.h2":
      'The more rules you write,<br><span class="gradient-text">the better your agents get</span>',
    "improve.sub":
      "You already know what good code looks like in your project. Your agents don\u2019t \u2014 not yet. Every rule you write is a bit of that knowledge going into Codi, and from that point on, every agent knows it too.",
    "improve.step1-h4": "Use your agents normally",
    "improve.step1-p":
      "Ship stuff. Notice where your agents miss the mark \u2014 wrong naming, wrong patterns, inconsistent output.",
    "improve.step2-h4": "Write a rule",
    "improve.step2-p":
      "Takes a few minutes. Captures exactly what was off. From that point on, every agent follows it.",
    "improve.step3-h4": "Regenerate",
    "improve.step3-p":
      "Run <code>codi generate</code>. All {agents} agents pick up the new rule right away.",
    "improve.step4-h4": "Better output next sprint",
    "improve.step4-p":
      "The rule applies from the next prompt. That issue doesn\u2019t come back. Do it again \u2014 and your agents keep getting better.",
    "improve.before-label": "Sprint 1 \u2014 Unconfigured agent",
    "improve.vs-iters": "20 iterations",
    "improve.after-label": "Sprint 20 \u2014 Your tuned agent",
    "improve.footer":
      "Every rule you write makes your agents a little smarter. <strong>It adds up fast.</strong>",
    "agents.label": "Works with your tools \u2014 and keeps growing",
    "agents.soon": "soon",
    "qs.label": "Quick Start",
    "qs.sub": "Three commands. No manual config. Every agent in sync from the start.",
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
      "The industry moves fast. I\u2019ve gone through Claude Code, Codex, Windsurf, and Cursor \u2014 and my team kept adding new ones. Every agent had its own config, its own format, its own rules. And it wasn\u2019t just engineers \u2014 designers, product people, and business folks were using these tools too, each with completely different needs. Keeping everyone\u2019s knowledge in sync, across all these tools, was a real problem. That\u2019s why Codi exists \u2014 and why it keeps growing.",
    "contact.label": "Get in touch",
    "contact.h2": 'Questions? <span class="gradient-text">Say hello.</span>',
    "contact.sub":
      "Drop me a message \u2014 questions, ideas, or just to talk shop about AI agents.",
    "bar.total": "Total artifacts",
    "bar.skills": "Skills",
    "bar.rules": "Rules",
    "bar.agents": "Agents",
    "bar.mcp": "MCP servers",
    "modal.multi.label": "Multi-Agent",
    "modal.multi.title": "One folder. {agents} agents.",
    "modal.multi.desc":
      "Every AI coding agent expects a different config file. Codi is the adapter layer \u2014 write rules once in <code>.codi/</code> and it generates the correct native format for each agent automatically. Change one file, all agents sync.",
    "modal.multi.terminal-footer": "{agents} agents synced. Zero drift.",
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
      "A preset is your configuration packaged and versioned. Build one from your own rules and skills, share it with your team via GitHub or ZIP, and let others install it in seconds. The community grows richer every time someone contributes.",
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
    "nav.install": "Instalar",
    "hero.badge": "v{version} \u2014 funciona con {agents} agentes",
    "hero.h1": 'Tu conocimiento de IA,<br><span class="gradient-text">en un solo lugar.</span>',
    "hero.sub":
      "Usas Claude Code. Tu compa\u00f1ero usa Cursor. Tu CI corre Codex. Ninguno comparte las mismas reglas, as\u00ed que todos se comportan un poco distinto. Codi lo arregla \u2014 una carpeta <code>.codi/</code>, versionada con git, que genera la config correcta para cada agente. Sin m\u00e1s desincronizaci\u00f3n.",
    "hero.cta1": "Inicio r\u00e1pido \u2192",
    "hero.cta2": "Ver en GitHub",
    "hero.stat1": "Agentes IA sincronizados",
    "hero.stat2": "Plantillas listas para usar",
    "hero.stat3": "Comparte como preset",
    "hero.stat4": "Configs desincronizadas",
    "why.label": "El problema",
    "why.h2": 'Tus agentes no<br><span class="gradient-text">comparten las mismas reglas.</span>',
    "why.sub":
      "Cada herramienta tiene su propia config. Cada nuevo miembro arranca de cero. Cada compa\u00f1ero usa reglas ligeramente distintas.",
    "why.problem-badge": "Sin Codi",
    "why.problem-h3": "El problema de tener varios agentes de IA",
    "why.problem-p":
      "A\u00f1ades una regla de seguridad en Claude Code. El Cursor de tu compa\u00f1ero no sabe nada de eso. Tu CI corre Codex con las reglas de hace dos semanas.",
    "why.problem-li1": "Cada agente tiene un formato de config distinto",
    "why.problem-li2": "\u00bfNuevo compa\u00f1ero? A configurar desde cero otra vez",
    "why.problem-li3": "Las reglas se desincroniz\u00e1n en cuanto alguien edita directamente",
    "why.problem-li4": "No hay forma de imponer est\u00e1ndares en todo el equipo",
    "why.solution-badge": "Con Codi",
    "why.solution-h3": "Escribe una vez, funciona en todos lados",
    "why.solution-p":
      "Dejas tus reglas en <code>.codi/</code> y ejecutas <code>codi generate</code>. Todos los agentes se actualizan al instante, siempre sincronizados.",
    "why.solution-li1": "Una sola carpeta controla los 6 agentes",
    "why.solution-li2": "El nuevo compa\u00f1ero ejecuta <code>codi init</code> y hereda todo",
    "why.solution-li3": "En git \u2014 cada cambio queda auditado",
    "why.solution-li4": "Bloquea reglas que el equipo no puede cambiar",
    "feat.label": "Caracter\u00edsticas",
    "feat.sub":
      "Todo lo que necesitas para mantener tus agentes de IA sincronizados, desde la primera instalaci\u00f3n hasta la aplicaci\u00f3n de est\u00e1ndares en todo el equipo.",
    "feat.h2": 'Todo lo que necesitas.<br><span class="gradient-text">Nada m\u00e1s.</span>',
    "feat.multi-h4": "Una carpeta, {agents} agentes",
    "feat.multi-p":
      "Todo vive en <code>.codi/</code>. Codi lo lee y escribe la config correcta para cada agente \u2014 Claude Code, Cursor, Codex, Windsurf y Cline.",
    "feat.templates-h4": "No empieces desde cero",
    "feat.templates-p":
      "Ya hay {templates}+ plantillas para los lenguajes, frameworks, seguridad y patrones de testing m\u00e1s comunes. Usa lo que te sirve, ignora lo que no.",
    "feat.drift-h4": "Detecci\u00f3n de cambios",
    "feat.drift-p":
      "Si alguien edita un archivo generado directamente, Codi lo detecta. Siempre sabes cuando algo est\u00e1 desincronizado.",
    "feat.presets-h4": "Comparte tu configuraci\u00f3n",
    "feat.presets-p":
      "Empaqueta tus reglas, skills y agentes en un preset y s\u00fabelo a GitHub. Todo el equipo lo instala con un comando \u2014 misma config, mismo comportamiento, sin tiempo de setup.",
    "feat.flags-h4": "Flags bloqueados",
    "feat.flags-p":
      "Tres capas: preset, repo, usuario. Como tech lead puedes bloquear las reglas que el equipo no puede tocar \u2014 controles de seguridad, cobertura de tests, lo que necesites.",
    "feat.hooks-h4": "{hooks} tipos de hooks",
    "feat.hooks-p":
      "Detecta solo Husky, pre-commit y Lefthook. Escaneo de secretos y chequeo de tipos incluidos desde el primer momento.",
    "feat.watch-h4": "Watch + revertir",
    "feat.watch-p":
      "D\u00e9jalo corriendo mientras trabajas. Regenera en cada guardado y guarda snapshots para volver atr\u00e1s si algo se rompe.",
    "feat.onboard-h4": "Onboarding con IA",
    "feat.onboard-p":
      "<code>codi onboard</code> lee tu codebase y sugiere una config que se adapta a tu stack.",
    "feat.verify-h4": "Tokens de verificaci\u00f3n",
    "feat.verify-p":
      "Cada archivo generado lleva un hash SHA-256. Ejecuta <code>codi verify</code> para asegurarte de que nadie lo ha tocado.",
    "who.label": "Para qui\u00e9n es",
    "who.h2": 'Funciona solo<br><span class="gradient-text">o con todo un equipo</span>',
    "who.sub":
      "La misma herramienta, distintos beneficios seg\u00fan si trabajas solo o en equipo.",
    "who.solo-badge": "Desarrollador Solo",
    "who.solo-h3": "Mejora cuanto m\u00e1s lo usas",
    "who.solo-p":
      "Empieza desde un preset. Cada vez que un agente haga algo que no te gusta, escribe una regla. Con el tiempo tu <code>.codi/</code> empieza a reflejar bien c\u00f3mo te gusta trabajar \u2014 y cualquier herramienta de IA nueva que a\u00f1adas lo hereda sin m\u00e1s.",
    "who.solo-li1": "En marcha en 60 segundos con un preset incluido",
    "who.solo-li2": "\u00bfNotas un patr\u00f3n que el agente siempre falla? Escribe una regla.",
    "who.solo-li3": "<code>codi onboard</code> sugiere una config basada en tu codebase real",
    "who.solo-li4": "Modo watch + snapshots \u2014 puedes experimentar sin miedo",
    "who.solo-li5": "Sprint a sprint, tus agentes conocen mejor tu c\u00f3digo",
    "who.team-badge": "Equipos de Ingenier\u00eda",
    "who.team-h3": "Todos trabajan con las mismas reglas",
    "who.team-p":
      "Ahora mismo cada dev en tu equipo probablemente tiene su propio setup de IA, y esos setups no hablan entre s\u00ed. Alguien agrega una regla, el resto no se entera. Se suma alguien nuevo \u2014 arranca de cero. Con Codi, el tech lead configura todo una vez y todos instalan el mismo preset. Los que se suman est\u00e1n operativos en minutos.",
    "who.team-li1": "Configura una vez, comparte con todo el equipo",
    "who.team-li2":
      "Bloquea las reglas que importan \u2014 seguridad, testing, lo que necesite tu equipo",
    "who.team-li3": "La detecci\u00f3n de cambios mantiene a todos en la misma p\u00e1gina",
    "who.team-li4": "<code>codi verify</code> en CI detecta cualquier cambio manual",
    "who.team-li5": "El nuevo integrante corre <code>codi init</code> y tiene todo",
    "improve.label": "El efecto acumulativo",
    "improve.h2":
      'Cuantas m\u00e1s reglas escribes,<br><span class="gradient-text">mejor se vuelven tus agentes</span>',
    "improve.sub":
      "Ya sabes c\u00f3mo luce el buen c\u00f3digo en tu proyecto. Tus agentes todav\u00eda no. Cada regla que escribes es un poco de ese conocimiento en Codi, y a partir de ah\u00ed todos los agentes lo saben tambi\u00e9n.",
    "improve.step1-h4": "Usa tus agentes con normalidad",
    "improve.step1-p":
      "Entrega cosas. F\u00edjate d\u00f3nde tus agentes fallan \u2014 naming incorrecto, patrones equivocados, output inconsistente.",
    "improve.step2-h4": "Escribe una regla",
    "improve.step2-p":
      "Unos minutos. Captura exactamente lo que estaba mal. A partir de ah\u00ed, todos los agentes la siguen.",
    "improve.step3-h4": "Regenera",
    "improve.step3-p":
      "Ejecuta <code>codi generate</code>. Los {agents} agentes recogen la nueva regla enseguida.",
    "improve.step4-h4": "Mejor output el pr\u00f3ximo sprint",
    "improve.step4-p":
      "La regla aplica desde el siguiente prompt. Ese problema no vuelve. Rep\u00edetelo \u2014 y tus agentes siguen mejorando.",
    "improve.before-label": "Sprint 1 \u2014 Agente sin configurar",
    "improve.vs-iters": "20 iteraciones",
    "improve.after-label": "Sprint 20 \u2014 Tu agente ajustado",
    "improve.footer":
      "Cada regla que escribes hace a tus agentes un poco m\u00e1s inteligentes. <strong>Se acumula r\u00e1pido.</strong>",
    "agents.label": "Funciona con tus herramientas \u2014 y sigue creciendo",
    "agents.soon": "pronto",
    "qs.label": "Inicio r\u00e1pido",
    "qs.sub":
      "Tres comandos. Sin configuraci\u00f3n manual. Todos los agentes sincronizados desde el primer momento.",
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
      "La industria avanza r\u00e1pido. He pasado por Claude Code, Codex, Windsurf y Cursor \u2014 y mi equipo segu\u00eda sumando herramientas nuevas. Cada agente ten\u00eda su propia config, su propio formato, sus propias reglas. Y no era solo ingenieros \u2014 dise\u00f1adores, gente de producto y de negocio tambi\u00e9n usaban estas herramientas, cada uno con necesidades completamente distintas. Mantener el conocimiento de todos sincronizado, entre tantas herramientas, era un problema real. Por eso existe Codi \u2014 y por eso sigue creciendo.",
    "contact.label": "Contacto",
    "contact.h2": '\u00bfPreguntas? <span class="gradient-text">Escr\u00edbeme.</span>',
    "contact.sub":
      "Manda un mensaje \u2014 preguntas, ideas, o simplemente para charlar sobre agentes de IA.",
    "bar.total": "Artefactos totales",
    "bar.skills": "Skills",
    "bar.rules": "Reglas",
    "bar.agents": "Agentes",
    "bar.mcp": "Servidores MCP",
    "modal.multi.label": "Multi-Agente",
    "modal.multi.title": "Una carpeta. {agents} agentes.",
    "modal.multi.desc":
      "Cada agente de IA espera un archivo de config diferente. Codi es la capa adaptadora \u2014 escribe las reglas una vez en <code>.codi/</code> y genera el formato correcto para cada agente autom\u00e1ticamente. Cambia un archivo, todos se sincronizan.",
    "modal.multi.terminal-footer": "{agents} agentes sincronizados. Sin desincronizaci\u00f3n.",
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
      "Un preset es tu configuraci\u00f3n empaquetada y versionada. Crea uno con tus propias reglas y skills, comp\u00e1rtelo con tu equipo v\u00eda GitHub o ZIP, y que otros lo instalen en segundos. La comunidad crece con cada aportaci\u00f3n.",
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
