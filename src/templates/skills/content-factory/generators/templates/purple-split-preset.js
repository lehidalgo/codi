// Purple Split preset — 6-slide social carousel
// Violet/purple alternating with photo-placeholder splits
// Palette: #1e1b4b, #5b21b6, #7c3aed, #ede9fe, #ffffff, #a78bfa

const _PURPLE_SPLIT_PRESET = {
  id: "purple-split",
  name: "Purple Split",
  type: "social",
  format: { w: 1080, h: 1080 },
  desc: "Deep purple base, alternating full-bleed and split-panel layouts with photo placeholders",
  css: [
    "*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}",
    "body{background:#0d0a1a;font-family:'Outfit',sans-serif;color:#fff}",
    ".c{width:100%;height:100%;overflow:hidden;display:flex;flex-direction:column;background:#1e1b4b;position:relative}",
    ".split{display:flex;flex-direction:row;flex:1;min-height:0}",
    ".ph{flex-shrink:0;width:540px;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:linear-gradient(160deg,#5b21b6,#1e1b4b)}",
    ".ph-lbl{font-family:'Geist Mono',monospace;font-size:14px;letter-spacing:.15em;text-transform:uppercase;color:rgba(255,255,255,.40)}",
    ".tc{flex:1;background:#fff;padding:60px 52px;display:flex;flex-direction:column;height:100%}",
    ".fbar{display:flex;align-items:center;justify-content:space-between;padding:0 60px;height:72px;border-top:1px solid rgba(255,255,255,.12);flex-shrink:0}",
    ".fbar-h{font-family:'Geist Mono',monospace;font-size:18px;color:rgba(255,255,255,.55)}",
    ".fbar-n{font-family:'Geist Mono',monospace;font-size:14px;color:rgba(167,139,250,.70)}",
    ".fbar-hd{font-family:'Geist Mono',monospace;font-size:15px;color:rgba(91,33,182,.55);margin-top:24px;flex-shrink:0}",
    ".snum{font-family:'Geist Mono',monospace;font-size:14px;color:#5b21b6;letter-spacing:.12em;margin-bottom:28px;flex-shrink:0}",
    ".sh{font-size:64px;font-weight:900;line-height:1.1;letter-spacing:-.03em;color:#1e1b4b;margin-bottom:24px;flex-shrink:0}",
    ".sb{font-size:20px;font-weight:400;line-height:1.55;color:#374151;flex:1}",
    ".blist{list-style:none;padding:0;margin:16px 0 0}",
    ".blist li{display:flex;align-items:center;gap:14px;font-size:20px;color:#374151;line-height:1.55;margin-bottom:14px}",
    ".blist li::before{content:'';display:inline-block;width:6px;height:6px;border-radius:50%;background:#5b21b6;flex-shrink:0}",
    ".cam-icon{stroke:rgba(255,255,255,.35);fill:none;stroke-width:1.1;stroke-linecap:round;stroke-linejoin:round}",
  ].join(""),
  slides: [
    {
      dataType: "cover",
      dataIndex: "01",
      html: '<div class="c" style="background:#1e1b4b"><div style="position:absolute;top:52px;left:60px;width:30px;height:30px;border-radius:50%;background:rgba(91,33,182,.50)"></div><div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 80px"><h1 style="font-family:\'Outfit\',sans-serif;font-size:94px;font-weight:900;line-height:1.05;letter-spacing:-.04em;color:#fff;margin-bottom:28px">ONE CODEBASE.<br>ALL YOUR AI<br>IN SYNC.</h1><p style="font-family:\'Outfit\',sans-serif;font-size:24px;font-weight:400;color:#a78bfa;line-height:1.5;max-width:700px">Rules, skills, and agents — one source of truth for every AI tool.</p></div><div class="fbar"><span class="fbar-h">@handle</span><span class="fbar-n">01 / 06</span></div></div>',
    },
    {
      dataType: "content",
      dataIndex: "02",
      html: '<div class="c" style="flex-direction:column"><div class="split"><div class="ph" style="background:linear-gradient(160deg,#5b21b6,#1e1b4b)"><svg width="72" height="72" viewBox="0 0 24 24" class="cam-icon"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg><span class="ph-lbl">Image / Video</span></div><div class="tc"><div class="snum">02</div><div class="sh">Write rules.<br>Get results.</div><div class="sb">Define coding standards once in <code style="font-family:\'Geist Mono\',monospace;font-size:17px;background:#ede9fe;color:#5b21b6;padding:2px 6px;border-radius:4px">.codi/</code> and every AI tool follows them automatically.</div><div class="fbar-hd">@handle</div></div></div></div>',
    },
    {
      dataType: "content",
      dataIndex: "03",
      html: '<div class="c" style="background:#5b21b6"><div style="position:absolute;top:0;left:0;right:0;bottom:72px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:80px"><div style="font-family:\'Outfit\',sans-serif;font-size:200px;font-weight:900;line-height:.8;color:rgba(255,255,255,.15);align-self:flex-start;padding-left:40px;margin-bottom:-40px">"</div><blockquote style="font-family:\'Outfit\',sans-serif;font-size:42px;font-weight:700;font-style:italic;line-height:1.3;color:#fff;max-width:820px;margin-bottom:36px">The best AI coding setup is the one every teammate uses the same way.</blockquote><p style="font-family:\'Geist Mono\',monospace;font-size:16px;color:rgba(255,255,255,.60);letter-spacing:.08em">— codi team · github.com/lehidalgo/codi</p></div><div class="fbar"><span class="fbar-h">@handle</span><span class="fbar-n">03 / 06</span></div></div>',
    },
    {
      dataType: "content",
      dataIndex: "04",
      html: '<div class="c" style="flex-direction:column"><div class="split"><div class="tc"><div class="snum">04</div><div class="sh">One config.<br>Every tool.</div><div class="sb">codi syncs your standards across Claude, Cursor, Copilot, and more.<ul class="blist"><li>Rules propagate automatically</li><li>Skills follow your workflow</li><li>Agents stay consistent</li></ul></div><div class="fbar-hd">@handle</div></div><div class="ph" style="background:linear-gradient(160deg,#7c3aed,#5b21b6)"><svg width="72" height="72" viewBox="0 0 24 24" class="cam-icon"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg><span class="ph-lbl">Image / Video</span></div></div></div>',
    },
    {
      dataType: "stat",
      dataIndex: "05",
      html: '<div class="c" style="background:#2d1b69"><div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px"><div style="display:flex;flex-direction:row;align-items:stretch;width:100%;max-width:900px;margin-bottom:52px"><div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:12px;padding:0 32px"><span style="font-family:\'Outfit\',sans-serif;font-size:80px;font-weight:900;line-height:1;color:#fff">5+</span><span style="font-family:\'Geist Mono\',monospace;font-size:18px;color:#a78bfa;letter-spacing:.06em;text-align:center">AI tools synced</span></div><div style="width:1px;background:rgba(167,139,250,.25);flex-shrink:0;margin:12px 0"></div><div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:12px;padding:0 32px"><span style="font-family:\'Outfit\',sans-serif;font-size:80px;font-weight:900;line-height:1;color:#fff">1</span><span style="font-family:\'Geist Mono\',monospace;font-size:18px;color:#a78bfa;letter-spacing:.06em;text-align:center">source of truth</span></div><div style="width:1px;background:rgba(167,139,250,.25);flex-shrink:0;margin:12px 0"></div><div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:12px;padding:0 32px"><span style="font-family:\'Outfit\',sans-serif;font-size:80px;font-weight:900;line-height:1;color:#fff">30s</span><span style="font-family:\'Geist Mono\',monospace;font-size:18px;color:#a78bfa;letter-spacing:.06em;text-align:center">to get started</span></div></div><p style="font-family:\'Outfit\',sans-serif;font-size:24px;font-weight:400;line-height:1.55;color:rgba(255,255,255,.80);text-align:center;max-width:760px">Stop maintaining separate configs for every AI tool. Set it once, use it everywhere.</p></div><div class="fbar"><span class="fbar-h">@handle</span><span class="fbar-n">05 / 06</span></div></div>',
    },
    {
      dataType: "cta",
      dataIndex: "06",
      html: '<div class="c" style="background:#1e1b4b"><div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 80px;gap:32px"><div style="width:80px;height:2px;background:#7c3aed;border-radius:2px"></div><h2 style="font-family:\'Outfit\',sans-serif;font-size:100px;font-weight:900;line-height:1.0;letter-spacing:-.04em;color:#fff">FOLLOW<br>FOR MORE.</h2><p style="font-family:\'Outfit\',sans-serif;font-size:22px;font-weight:400;color:rgba(255,255,255,.60);line-height:1.5">Content about AI, dev tools, and productivity.</p><div style="border:2px solid rgba(124,58,237,.60);padding:20px 48px;border-radius:8px"><span style="font-family:\'Geist Mono\',monospace;font-size:18px;color:#a78bfa;letter-spacing:.04em">github.com/lehidalgo/codi</span></div></div><div class="fbar"><span class="fbar-h">@handle</span><span class="fbar-n">06 / 06</span></div></div>',
    },
  ],
};
