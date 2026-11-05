// Static screen kit for the "All Screens" board — Glass direction, Bricolage Grotesque.
const SK = { tint: "#0B5EFF", ink: "#131315", mute: "#6E6E73", bg: "#F2F2F6", sep: "rgba(20,20,25,0.08)", ok: "#1B7F45", warn: "#E8A33D", warnT: "#98610E", red: "#D61E24" };
const skT = (size, x = {}) => ({ fontFamily: HF, fontSize: size, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.04, ...x });
const skEye = { fontSize: 13, fontWeight: 600, letterSpacing: "0.6px", color: SK.mute, textTransform: "uppercase" };

function Scr({ children, bg = SK.bg, dark = false, tabs, blobs = true, overlay }) {
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: "relative", height: "100%", background: bg, fontFamily: HF, color: dark ? "#fff" : SK.ink, overflow: "hidden" }}>
        {blobs && !dark ? <>{hBlob("#8FB0D6", "-90px", "-80px", 320)}{hBlob("#E8C9A8", "220px", "420px", 260, 0.22)}</> : null}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>{children}</div>
        {tabs ? <TabsCenter tab={tabs} setTab={() => {}} onCamera={() => {}} /> : null}
        {overlay || null}
      </div>
    </IOSDevice>
  );
}
function Pad({ children, top = 60, x = 20, gap, style }) { return <div style={{ position: "relative", padding: `${top}px ${x}px 0`, display: gap !== undefined ? "flex" : "block", flexDirection: "column", gap, ...style }}>{children}</div>; }
function Btn({ children, kind = "primary", icon, h = 54, style }) {
  const look = { primary: { background: SK.tint, color: "#fff" }, ink: { background: SK.ink, color: "#fff" }, glass: { ...gl({ borderRadius: 16 }), color: SK.ink }, text: { background: "none", color: SK.tint }, danger: { background: "none", color: SK.red }, soft: { background: "rgba(120,120,128,0.12)", color: SK.ink } }[kind];
  return <div style={{ height: h, borderRadius: h >= 50 ? 16 : 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, font: `600 ${h >= 50 ? 17 : 15}px ${HF}`, ...look, ...style }}>{icon ? <RIcon name={icon} size={18} color={look.color} /> : null}{children}</div>;
}
function Card({ children, style, tint }) { return <div style={{ ...gl({ borderRadius: 24, background: tint || "rgba(255,255,255,0.66)" }), padding: 16, boxSizing: "border-box", ...style }}>{children}</div>; }
function List({ rows, header, style }) {
  return (
    <div style={style}>
      {header ? <div style={{ ...skEye, padding: "0 16px 8px" }}>{header}</div> : null}
      <div style={{ ...gl({ borderRadius: 22, background: "rgba(255,255,255,0.7)" }), overflow: "hidden" }}>
        {rows.map(([l, v, c], n) => <div key={n} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, minHeight: 48, padding: "12px 16px", boxSizing: "border-box", borderTop: n ? `0.5px solid ${SK.sep}` : 0, fontSize: 17, color: c || SK.ink }}><span>{l}</span>{typeof v === "string" ? <span style={{ color: SK.mute, textAlign: "right" }}>{v}</span> : v}</div>)}
      </div>
    </div>
  );
}
function Chev() { return <RIcon name="chevron-forward" size={15} color="#A1A1A6" />; }
function TopBar({ left = "close", title, right, dark }) {
  const c = dark ? "#fff" : SK.ink;
  return (
    <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "56px 16px 6px", zIndex: 3 }}>
      {left ? <span style={{ ...(dark ? { background: "rgba(255,255,255,0.16)", borderRadius: 20 } : gl({ borderRadius: 20 })), width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}><RIcon name={left === "back" ? "chevron-back" : left === "down" ? "chevron-down" : "close"} size={20} color={c} /></span> : <span style={{ width: 40 }} />}
      {title ? <span style={{ fontSize: 15, fontWeight: 600, color: c }}>{title}</span> : <span />}
      {right || <span style={{ width: 40 }} />}
    </div>
  );
}
function Sheet({ children, title, floating = true }) {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 70, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.32)" }} />
      <div style={{ ...gl({ borderRadius: floating ? 34 : "34px 34px 0 0", background: "rgba(255,255,255,0.9)" }), position: "relative", margin: floating ? "0 10px 10px" : 0, padding: "8px 20px 20px", fontFamily: HF }}>
        <div style={{ width: 36, height: 5, borderRadius: 3, background: "rgba(60,60,67,0.3)", margin: "0 auto 14px" }} />
        {title ? <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>{title}</div> : null}
        {children}
      </div>
    </div>
  );
}
function Quote({ lines, total, before, after, note }) {
  return (
    <>
      <div style={{ background: "rgba(120,120,128,0.10)", borderRadius: 18, padding: "0 16px" }}>
        {lines.map(([l, v]) => <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", fontSize: 17 }}><span>{l}</span><span>{v}</span></div>)}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", fontSize: 17, fontWeight: 600, borderTop: `0.5px solid ${SK.sep}` }}><span>Total</span><span>{total}</span></div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, margin: "12px 0 18px" }}><span style={{ color: SK.mute }}>{`Balance ${before} → ${after}`}</span>{note ? <span style={{ color: SK.ok }}>{note}</span> : null}</div>
    </>
  );
}
function ToastPill({ children, top = 58 }) { return <div style={{ position: "absolute", top, left: "50%", transform: "translateX(-50%)", zIndex: 90, background: SK.ink, color: "#fff", borderRadius: 999, padding: "10px 16px", font: `600 14px ${HF}`, whiteSpace: "nowrap" }}>{children}</div>; }
function Spin({ c = SK.mute, s = 20 }) { return <span style={{ display: "inline-block", width: s, height: s, borderRadius: s, border: `2px solid ${c}`, borderRightColor: "transparent", animation: "kips-spin .8s linear infinite" }} />; }
function Glyph({ icon, w = 74, h = 92, r = 0, dashed }) { return <div style={{ width: w, height: h, borderRadius: 20, background: "#F3F2EF", display: "flex", alignItems: "center", justifyContent: "center", transform: `rotate(${r}deg)`, boxSizing: "border-box", ...(dashed ? { border: "1.5px dashed #C7C7CC" } : { boxShadow: "0 10px 22px rgba(0,0,0,0.08)" }) }}>{icon ? <RIcon name={icon} size={Math.round(Math.min(w, h) * 0.42)} color={SK.mute} /> : null}</div>; }
function Shim() { return <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden" }}><div style={{ position: "absolute", top: 0, bottom: 0, width: "60%", background: "rgba(255,255,255,0.5)", animation: "kips-shimmer 1.6s ease-in-out infinite" }} /></div>; }
function Person({ h = 300, boxes = [], c = SK.tint }) {
  return (
    <div style={{ position: "relative", height: h, borderRadius: 26, background: "#2A2A2E", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <RIcon name="body" size={h * 0.9} color="#4A4A50" />
      {boxes.map(([x, y, w, bh, n, sel], k) => <span key={k} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${bh}%`, borderRadius: 10, border: sel ? `2px solid ${c}` : "2px dashed rgba(255,255,255,0.8)", background: sel ? "rgba(11,94,255,0.18)" : "transparent", boxSizing: "border-box" }}><span style={{ position: "absolute", top: -10, left: -10, width: 22, height: 22, borderRadius: 11, background: sel ? c : "#fff", color: sel ? "#fff" : SK.ink, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</span></span>)}
    </div>
  );
}
Object.assign(window, { SK, skT, skEye, Scr, Pad, Btn, Card, List, Chev, TopBar, Sheet, Quote, ToastPill, Spin, Glyph, Shim, Person });
