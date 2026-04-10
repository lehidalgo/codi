/* eslint-disable @typescript-eslint/no-unused-vars */
// ====== Presets — style templates with full slide decks ======
// Browser-served globals: PRESETS and FONTS_LINK are consumed by app.js via script concatenation.
// Each preset has type (social | slides | document), native format, and 3-4 slides.

const FONTS_LINK =
  '<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Geist+Mono:wght@300;400;500&display=swap" rel="stylesheet">';

const PRESETS = [
  {
    id: "dark-editorial",
    name: "Dark Editorial",
    type: "social",
    format: { w: 1080, h: 1080 },
    desc: "Deep dark base, gradient italic accents, progress track",
    css: [
      "body{background:#070a0f;font-family:'Outfit',sans-serif;color:#e6edf3}",
      ".c{width:100%;height:100%;display:flex;flex-direction:column;padding:52px;position:relative;background:#070a0f}",
      ".tag{font-family:'Geist Mono',monospace;font-size:22px;color:#56b6c2;margin-bottom:24px;letter-spacing:.08em}",
      ".h{font-size:80px;font-weight:800;line-height:1.05;letter-spacing:-.03em;margin-bottom:28px}",
      "em{font-style:italic;display:inline-block;padding-bottom:0.06em;background:linear-gradient(135deg,#56b6c2,#61afef);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}",
      ".b{font-size:32px;font-weight:300;color:rgba(230,237,243,.7);line-height:1.5;flex:1}",
      ".bar{position:absolute;bottom:0;left:0;right:0;height:80px;background:rgba(0,0,0,.28);border-top:1px solid rgba(255,255,255,.07);display:flex;align-items:center;padding:0 52px;gap:12px}",
      ".hn{font-family:'Geist Mono',monospace;font-size:22px;color:#e6edf3}",
      ".dots{display:flex;gap:8px;margin-left:auto}",
      ".dot{width:28px;height:6px;border-radius:3px;background:rgba(255,255,255,.12)}",
      ".dot.on{background:linear-gradient(135deg,#56b6c2,#61afef)}",
    ].join(""),
    slides: [
      {
        dataType: "cover",
        dataIndex: "01",
        html: '<div class="c"><div class="tag">01 · INTRO</div><div class="h">Your rules,<br><em>your agents</em></div><div class="b">One config source.<br>All AI tools, in sync.</div><div class="bar"><span class="hn">@handle</span><div class="dots"><div class="dot on"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div></div>',
      },
      {
        dataType: "content",
        dataIndex: "02",
        html: '<div class="c"><div class="tag">02 · PROBLEM</div><div class="h">5 configs.<br><em>One mess.</em></div><div class="b">Claude, Cursor, Copilot, Gemini — each needs its own rules file. Manually synced.</div><div class="bar"><span class="hn">@handle</span><div class="dots"><div class="dot"></div><div class="dot on"></div><div class="dot"></div><div class="dot"></div></div></div></div>',
      },
      {
        dataType: "content",
        dataIndex: "03",
        html: '<div class="c"><div class="tag">03 · SOLUTION</div><div class="h">codi<br><em>fixes this.</em></div><div class="b">Write once in .codi/<br>Generate config for every tool.</div><div class="bar"><span class="hn">@handle</span><div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot on"></div><div class="dot"></div></div></div></div>',
      },
      {
        dataType: "cta",
        dataIndex: "04",
        html: '<div class="c"><div class="tag">04 · START</div><div class="h">Ship<br><em>today.</em></div><div class="b">npm install -g codi-cli<br>codi init</div><div class="bar"><span class="hn">@handle</span><div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot on"></div></div></div></div>',
      },
    ],
  },

  {
    id: "minimal-mono",
    name: "Minimal Mono",
    type: "social",
    format: { w: 1080, h: 1080 },
    desc: "Monospace type, thin accent border, high contrast hierarchy",
    css: [
      "body{background:#0a0e13;font-family:'Geist Mono',monospace;color:#e6edf3}",
      ".c{width:100%;height:100%;display:flex;flex-direction:column;padding:60px;border:1px solid rgba(86,182,194,.18);background:#0a0e13}",
      ".tag{font-size:18px;font-weight:300;color:rgba(86,182,194,.7);margin-bottom:auto;letter-spacing:.12em;text-transform:uppercase}",
      ".h{font-size:100px;font-weight:300;line-height:1.0;letter-spacing:-.04em;margin-bottom:24px}",
      ".ac{color:#56b6c2}",
      ".b{font-size:26px;font-weight:300;color:rgba(230,237,243,.5);line-height:1.6;margin-bottom:48px}",
      ".foot{display:flex;justify-content:space-between;align-items:flex-end}",
      ".hn{font-size:20px;color:rgba(86,182,194,.5)}",
      ".num{font-size:80px;font-weight:200;color:rgba(86,182,194,.1);line-height:1}",
    ].join(""),
    slides: [
      {
        dataType: "cover",
        dataIndex: "01",
        html: '<div class="c"><div class="tag">INTRODUCING</div><div class="h">codi<span class="ac">.</span></div><div class="b">Unified config platform<br>for AI coding agents</div><div class="foot"><span class="hn">@handle</span><span class="num">01</span></div></div>',
      },
      {
        dataType: "content",
        dataIndex: "02",
        html: '<div class="c"><div class="tag">FEATURES</div><div class="h">one<span class="ac">/</span>all</div><div class="b">· rules &amp; skills<br>· agents &amp; tools<br>· every AI tool</div><div class="foot"><span class="hn">@handle</span><span class="num">02</span></div></div>',
      },
      {
        dataType: "cta",
        dataIndex: "03",
        html: '<div class="c"><div class="tag">GET STARTED</div><div class="h">npm<span class="ac">.</span></div><div class="b">npm i -g codi-cli<br>codi init</div><div class="foot"><span class="hn">@handle</span><span class="num">03</span></div></div>',
      },
    ],
  },

  {
    id: "poster-bold",
    name: "Poster Bold",
    type: "social",
    format: { w: 1080, h: 1080 },
    desc: "Oversized type, maximum graphic impact, full-bleed layout",
    css: [
      "body{background:#070a0f;font-family:'Outfit',sans-serif;color:#e6edf3;overflow:hidden}",
      ".c{width:100%;height:100%;display:flex;flex-direction:column;justify-content:space-between;padding:60px 60px 0}",
      ".h{font-size:156px;font-weight:900;line-height:1.0;letter-spacing:-.05em}",
      "em{font-style:italic;display:inline-block;padding-bottom:0.06em;background:linear-gradient(135deg,#56b6c2,#61afef);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}",
      ".sub{font-size:36px;font-weight:300;color:rgba(230,237,243,.45)}",
      ".bar{height:100px;background:linear-gradient(90deg,rgba(86,182,194,.1),transparent);border-top:2px solid rgba(86,182,194,.25);display:flex;align-items:center;padding:0 60px;margin:0 -60px}",
      ".hn{font-family:'Geist Mono',monospace;font-size:24px;color:rgba(86,182,194,.6)}",
      ".mark{font-family:'Geist Mono',monospace;font-size:24px;font-weight:500;background:linear-gradient(135deg,#56b6c2,#61afef);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-left:auto}",
    ].join(""),
    slides: [
      {
        dataType: "cover",
        dataIndex: "01",
        html: '<div class="c"><div><div class="h">One<br><em>config.</em></div><div class="sub">Every AI tool.</div></div><div class="bar"><span class="hn">@handle</span><span class="mark">codi</span></div></div>',
      },
      {
        dataType: "stat",
        dataIndex: "02",
        html: '<div class="c"><div><div class="h"><em>5x</em><br>faster.</div><div class="sub">Config sync across all agents.</div></div><div class="bar"><span class="hn">@handle</span><span class="mark">codi</span></div></div>',
      },
      {
        dataType: "cta",
        dataIndex: "03",
        html: '<div class="c"><div><div class="h">Start<br><em>now.</em></div><div class="sub">npm install -g codi-cli</div></div><div class="bar"><span class="hn">@handle</span><span class="mark">codi</span></div></div>',
      },
    ],
  },

  {
    id: "clean-slides",
    name: "Clean Slides",
    type: "slides",
    format: { w: 1280, h: 720 },
    desc: "16:9 presentation deck, dark base, accent headlines",
    css: [
      "body{background:#0d1117;font-family:'Outfit',sans-serif;color:#e6edf3;margin:0;overflow:hidden}",
      ".c{width:1280px;height:720px;display:flex;flex-direction:column;padding:64px 80px;position:relative;background:#0d1117}",
      ".tag{font-family:'Geist Mono',monospace;font-size:16px;color:rgba(86,182,194,.6);margin-bottom:20px;letter-spacing:.1em;text-transform:uppercase}",
      ".h{font-size:72px;font-weight:800;line-height:1.0;letter-spacing:-.03em;margin-bottom:20px}",
      "em{font-style:italic;display:inline-block;padding-bottom:0.06em;background:linear-gradient(135deg,#56b6c2,#61afef);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}",
      ".b{font-size:26px;font-weight:300;color:rgba(230,237,243,.65);line-height:1.5;flex:1}",
      ".bar{position:absolute;bottom:0;left:0;right:0;height:60px;background:rgba(0,0,0,.3);border-top:1px solid rgba(255,255,255,.06);display:flex;align-items:center;padding:0 80px}",
      ".hn{font-family:'Geist Mono',monospace;font-size:16px;color:rgba(230,237,243,.45)}",
      ".num{font-family:'Geist Mono',monospace;font-size:16px;color:rgba(86,182,194,.35);margin-left:auto}",
      "ul{list-style:none;padding:0;font-size:26px;font-weight:300;color:rgba(230,237,243,.7);line-height:1.9}",
      "li::before{content:'→ ';color:#56b6c2}",
    ].join(""),
    slides: [
      {
        dataType: "title",
        dataIndex: "01",
        html: '<div class="c"><div class="tag">CODI</div><div class="h">Your rules,<br><em>your agents</em></div><div class="b">One config source — all AI tools in sync</div><div class="bar"><span class="hn">@handle</span><span class="num">01</span></div></div>',
      },
      {
        dataType: "content",
        dataIndex: "02",
        html: '<div class="c"><div class="tag">THE PROBLEM</div><div class="h">Too many<br><em>configs.</em></div><ul><li>Claude, Cursor, Copilot</li><li>Each needs its own rules file</li><li>Manually synced — or drifted</li></ul><div class="bar"><span class="hn">@handle</span><span class="num">02</span></div></div>',
      },
      {
        dataType: "closing",
        dataIndex: "03",
        html: '<div class="c"><div class="tag">SHIP TODAY</div><div class="h">npm i -g<br><em>codi-cli</em></div><div class="b">codi init · codi generate · done</div><div class="bar"><span class="hn">@handle</span><span class="num">03</span></div></div>',
      },
    ],
  },

  {
    id: "doc-article",
    name: "Doc Article",
    type: "document",
    format: { w: 794, h: 1123 },
    desc: "A4 document layout, clean editorial, print-ready",
    css: [
      "body{background:#fff;font-family:'Outfit',sans-serif;color:#0d1117;margin:0;overflow:hidden}",
      ".c{width:794px;height:1123px;display:flex;flex-direction:column;padding:72px;position:relative;background:#fff}",
      ".accent{height:4px;background:linear-gradient(90deg,#56b6c2,#61afef);margin:-72px -72px 56px;width:calc(100% + 144px)}",
      ".tag{font-family:'Geist Mono',monospace;font-size:13px;color:rgba(86,182,194,.75);margin-bottom:16px;letter-spacing:.1em;text-transform:uppercase}",
      ".h{font-size:52px;font-weight:800;line-height:1.05;letter-spacing:-.02em;margin-bottom:24px;color:#0d1117}",
      "em{font-style:italic;display:inline-block;padding-bottom:0.06em;background:linear-gradient(135deg,#56b6c2,#61afef);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}",
      ".b{font-size:19px;font-weight:300;color:#444d56;line-height:1.75;flex:1}",
      "p{margin:0 0 18px}",
      "code{font-family:'Geist Mono',monospace;font-size:15px;background:#f1f3f5;padding:2px 8px;border-radius:4px;color:#0d1117}",
      ".foot{font-family:'Geist Mono',monospace;font-size:12px;color:rgba(86,182,194,.5);padding-top:20px;border-top:1px solid #e1e4e8;display:flex;justify-content:space-between}",
    ].join(""),
    slides: [
      {
        dataType: "cover",
        dataIndex: "01",
        html: '<div class="c"><div class="accent"></div><div class="tag">ARTICLE</div><div class="h">Your rules,<br><em>your agents</em></div><div class="b"><p>One config source. All AI coding tools, in sync.</p><p>codi manages rules, skills, and agent configuration across Claude, Cursor, Copilot, and more — from a single source of truth.</p></div><div class="foot"><span>@handle</span><span>01 / 03</span></div></div>',
      },
      {
        dataType: "content",
        dataIndex: "02",
        html: '<div class="c"><div class="accent"></div><div class="tag">THE PROBLEM</div><div class="h">Config<br><em>sprawl</em></div><div class="b"><p>Every AI coding tool ships with its own config format. Claude uses CLAUDE.md, Cursor uses .cursorrules, Copilot uses its own instructions file.</p><p>Teams end up manually maintaining 5 separate config files with duplicate rules, diverging conventions, and no single source of truth.</p></div><div class="foot"><span>@handle</span><span>02 / 03</span></div></div>',
      },
      {
        dataType: "cta",
        dataIndex: "03",
        html: '<div class="c"><div class="accent"></div><div class="tag">GET STARTED</div><div class="h">Ship<br><em>today</em></div><div class="b"><p>Getting started takes two commands:</p><p><code>npm install -g codi-cli</code><br><code>codi init</code></p><p>codi detects your project stack, generates starter rules, and sets up config for every AI tool you use.</p></div><div class="foot"><span>@handle</span><span>03 / 03</span></div></div>',
      },
    ],
  },
];
