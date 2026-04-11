// minimal-carousel — preset entry
// Drop this object into PRESETS[] in presets.js to register the template.
// Root element class is `.c` (matches app.js rendering convention).

const _MINIMAL_CAROUSEL_PRESET = {
  id: "minimal-carousel",
  name: "Minimal Carousel",
  type: "social",
  format: { w: 1080, h: 1080 },
  desc: "Clean alternating layout — photo splits, teal quote cards, stat cards",
  css: [
    "*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}",
    "body{background:#e8ecf0;font-family:'Outfit',sans-serif;color:#0f172a}",
    // base card
    ".c{width:100%;height:100%;overflow:hidden;display:flex;flex-direction:column;position:relative}",
    // bottom bar
    ".bar{flex-shrink:0;height:76px;display:flex;align-items:center;padding:0 56px;gap:16px}",
    ".bar-t{background:rgba(0,0,0,0.10);border-top:1px solid rgba(255,255,255,0.20)}",
    ".bar-w{background:rgba(244,246,248,0.70);border-top:1px solid rgba(20,184,166,0.12)}",
    // handle
    ".hn{font-family:'Geist Mono',monospace;font-size:20px;font-weight:400;color:#64748b;line-height:1}",
    ".hn-w{color:rgba(255,255,255,0.75)}",
    // spacer
    ".sp{flex:1}",
    // cover
    ".cb{flex:1;padding:64px 64px 48px 80px;display:flex;flex-direction:column;justify-content:space-between}",
    ".ca{position:absolute;top:0;left:0;width:4px;height:100%;background:#14b8a6}",
    ".cn{font-family:'Geist Mono',monospace;font-size:22px;font-weight:400;color:#14b8a6;letter-spacing:.04em}",
    ".ch{font-family:'Outfit',sans-serif;font-size:112px;font-weight:900;line-height:1.0;letter-spacing:-.04em;color:#0f172a;text-transform:uppercase}",
    ".csw{font-family:'Geist Mono',monospace;font-size:18px;font-weight:400;color:#64748b;letter-spacing:.05em}",
    // split layout
    ".sw{flex:1;display:flex;min-height:0}",
    ".ic{flex-shrink:0;width:45%;position:relative;background:#f4f6f8}",
    ".ic-in{position:absolute;inset:32px;border:2px dashed #cbd5e1;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px}",
    ".ic-ico{font-size:48px;color:#94a3b8;line-height:1}",
    ".ic-lbl{font-family:'Geist Mono',monospace;font-size:16px;color:#94a3b8;letter-spacing:.06em;text-transform:uppercase}",
    ".cc{flex:1;display:flex;flex-direction:column;justify-content:center;padding:56px 56px 40px 52px;gap:20px}",
    ".ccr{flex:1;display:flex;flex-direction:column;justify-content:center;padding:56px 52px 40px 56px;gap:20px}",
    ".sn{font-family:'Geist Mono',monospace;font-size:20px;color:#14b8a6;letter-spacing:.04em}",
    ".sh{font-family:'Outfit',sans-serif;font-size:56px;font-weight:800;line-height:1.1;letter-spacing:-.03em;color:#0f172a}",
    ".sb{font-size:20px;font-weight:400;color:#64748b;line-height:1.6}",
    // quote
    ".qb{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:72px 96px 32px;text-align:center}",
    ".qm{font-family:'Outfit',sans-serif;font-size:180px;font-weight:900;line-height:.75;color:rgba(255,255,255,0.25);margin-bottom:24px}",
    ".qt{font-family:'Outfit',sans-serif;font-size:38px;font-weight:700;font-style:italic;line-height:1.35;color:#ffffff;max-width:800px}",
    ".qc{font-family:'Geist Mono',monospace;font-size:18px;color:rgba(255,255,255,0.55);letter-spacing:.06em}",
    // stat
    ".stb{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:64px 80px 32px;text-align:center;gap:16px}",
    ".stn{font-family:'Outfit',sans-serif;font-size:160px;font-weight:900;line-height:1.0;letter-spacing:-.04em;color:#14b8a6}",
    ".stl{font-family:'Outfit',sans-serif;font-size:32px;font-weight:700;line-height:1.2;color:#0f172a}",
    ".std{font-size:22px;font-weight:400;color:#64748b;line-height:1.55;max-width:680px}",
    ".stc{font-family:'Geist Mono',monospace;font-size:18px;color:#64748b;letter-spacing:.06em}",
    // cta
    ".ctab{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:72px 80px 32px;text-align:center;gap:20px}",
    ".ctah{font-family:'Outfit',sans-serif;font-size:90px;font-weight:900;line-height:1.0;letter-spacing:-.04em;color:#ffffff;text-transform:uppercase}",
    ".ctas{font-size:24px;font-weight:400;color:rgba(255,255,255,0.70);line-height:1.5}",
    ".ctaf{font-family:'Geist Mono',monospace;font-size:20px;color:rgba(255,255,255,0.75);letter-spacing:.06em;text-transform:uppercase}",
  ].join(""),
  slides: [
    {
      dataType: "cover",
      dataIndex: "01",
      html: '<div class="c" style="background:#f4f6f8"><div class="ca"></div><div class="cb"><div style="display:flex;justify-content:flex-end"><span class="cn">01</span></div><h1 class="ch">YOUR<br>CONTENT<br><span style="color:#14b8a6">FINALLY</span><br>WORKS</h1><div style="display:flex;align-items:center;justify-content:space-between"><span class="hn">@handle</span><span class="csw">SWIPE →</span></div></div></div>',
    },
    {
      dataType: "content",
      dataIndex: "02",
      html: '<div class="c" style="background:#ffffff"><div class="sw"><div class="ic"><div class="ic-in"><div class="ic-ico">📷</div><span class="ic-lbl">Photo / Video</span></div></div><div class="cc"><span class="sn">02</span><h2 class="sh">The story<br>starts here.</h2><p class="sb">Drop your photo or video on the left. This text block sits opposite — clean, readable, on brand.</p></div></div><div class="bar bar-w"><span class="hn">@handle</span></div></div>',
    },
    {
      dataType: "content",
      dataIndex: "03",
      html: '<div class="c" style="background:#14b8a6"><div class="qb"><div class="qm">&ldquo;</div><p class="qt">The best content is the kind that makes someone stop scrolling and actually think.</p></div><div class="bar bar-t" style="justify-content:space-between"><span class="hn hn-w">@handle</span><span class="qc">03 / 06</span></div></div>',
    },
    {
      dataType: "content",
      dataIndex: "04",
      html: '<div class="c" style="background:#ffffff"><div class="sw"><div class="ccr"><span class="sn">04</span><h2 class="sh">Flip the<br>layout here.</h2><p class="sb">Alternating sides keeps the carousel moving. Your audience stays curious card after card.</p></div><div class="ic"><div class="ic-in"><div class="ic-ico">📷</div><span class="ic-lbl">Photo / Video</span></div></div></div><div class="bar bar-w"><span class="hn">@handle</span></div></div>',
    },
    {
      dataType: "stat",
      dataIndex: "05",
      html: '<div class="c" style="background:#f4f6f8"><div class="stb"><div class="stn">10×</div><div class="stl">More productive</div><p class="std">Teams who batch their content creation ship 10x more posts with the same effort — without sacrificing quality.</p></div><div class="bar bar-w" style="justify-content:flex-end"><span class="stc">05 / 06</span></div></div>',
    },
    {
      dataType: "cta",
      dataIndex: "06",
      html: '<div class="c" style="background:#14b8a6"><div class="ctab"><h2 class="ctah">THANKS<br>FOR<br>READING!</h2><p class="ctas">Follow for more tips, templates, and tools.</p></div><div class="bar bar-t" style="justify-content:space-between"><span class="hn hn-w">@handle</span><span class="ctaf">FOLLOW →</span></div></div>',
    },
  ],
};
