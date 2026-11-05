// Me (Account) in the Glass direction.
function GlassMe({ credits, say, onReplay }) {
  const [how, setHow] = React.useState(false);
  const [mode, setMode] = React.useState("System");
  const [notify, setNotify] = React.useState(true);
  const granted = 240, used = granted - credits;
  const card = (x = {}) => ({ ...gl({ borderRadius: 22, background: "rgba(255,255,255,0.7)" }), ...x });
  const eyebrow = { fontSize: 13, fontWeight: 600, letterSpacing: "0.65px", color: "#6E6E73", padding: "0 16px 8px" };
  const row = (l, v, n, extra) => <div key={l + n} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 16px", borderTop: n ? "0.5px solid rgba(20,20,25,0.08)" : 0, fontSize: 17, ...extra }}><span>{l}</span>{v}</div>;
  return (
    <div style={{ padding: "62px 16px 130px" }}>
      <div aria-hidden="true" style={{ position: "absolute", width: 300, height: 300, borderRadius: "50%", background: "#8FB0D6", opacity: 0.28, filter: "blur(70px)", top: -60, left: -80, pointerEvents: "none" }} />
      <div style={{ position: "relative", fontSize: 34, fontWeight: 700, letterSpacing: "-0.7px", padding: "0 4px" }}>Me</div>
      <div style={{ ...card(), position: "relative", marginTop: 14, padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ width: 56, height: 56, borderRadius: 28, background: "rgba(31,107,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: GL_TINT }}>R</span>
        <div style={{ flex: 1 }}><div style={{ fontSize: 19, fontWeight: 700 }}>Roi</div><div style={{ fontSize: 15, color: "#6E6E73" }}>{`${RD_ITEMS.length} pieces · since Oct 2026`}</div></div>
        <span onClick={() => say("Edit name")} style={{ fontSize: 17, color: GL_TINT, cursor: "pointer" }}>Edit</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 24 }}><span style={eyebrow}>AI CREDITS</span><span onClick={() => setHow(true)} style={{ fontSize: 15, color: GL_TINT, cursor: "pointer", paddingRight: 16 }}>How it works</span></div>
      <div style={{ ...card(), padding: 16, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ position: "relative", width: 92, height: 92, flexShrink: 0 }}>
          <svg width="92" height="92" style={{ transform: "rotate(-90deg)" }}><circle cx="46" cy="46" r="40" fill="none" stroke="rgba(120,120,128,0.16)" strokeWidth="9" /><circle cx="46" cy="46" r="40" fill="none" stroke={GL_TINT} strokeWidth="9" strokeLinecap="round" strokeDasharray={2 * Math.PI * 40} strokeDashoffset={2 * Math.PI * 40 * (1 - credits / granted)} style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.23,1,.32,1)" }} /></svg>
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{credits}</span>
        </div>
        <div><div style={{ fontSize: 17, fontWeight: 600 }}>{`of ${granted} granted`}</div><div style={{ fontSize: 13, color: "#6E6E73", marginTop: 4, lineHeight: 1.4 }}>{`${used} used so far · enough for about ${credits} more garments`}</div></div>
      </div>

      <div style={{ ...eyebrow, marginTop: 24 }}>PRICE LIST</div>
      <div style={{ ...card(), display: "grid", gridTemplateColumns: "repeat(4,1fr)", padding: "14px 6px" }}>
        {[["scan-outline", "Detect", "Free"], ["shirt-outline", "Front", "1"], ["camera-reverse-outline", "Back", "1"], ["sync-outline", "360°", "3"]].map(([ic, l, v]) => <div key={l} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}><RIcon name={ic} size={22} color="#131315" /><span style={{ fontSize: 13, color: "#6E6E73" }}>{l}</span><span style={{ fontSize: 17, fontWeight: 700 }}>{v}</span></div>)}
      </div>

      <div style={{ ...eyebrow, marginTop: 24 }}>RECENT ACTIVITY</div>
      <div style={card({ overflow: "hidden" })}>
        {[["Front image", "Nov 5", "−2"], ["Front image", "Nov 5", "−1"], ["Welcome credits", "Oct 18", "+40"]].map(([l, d, v], n) => row(l, <span style={{ fontWeight: 600, color: v[0] === "+" ? "#1B7F45" : "#131315", fontVariantNumeric: "tabular-nums" }}>{v}</span>, n, {}))}
      </div>

      <div style={{ ...eyebrow, marginTop: 24 }}>SETTINGS</div>
      <div style={card({ overflow: "hidden" })}>
        <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 17 }}>Appearance</span>
          <div style={{ position: "relative", display: "flex", background: "rgba(120,120,128,0.12)", borderRadius: 999, padding: 3 }}>
            <span style={{ position: "absolute", top: 3, bottom: 3, width: "calc((100% - 6px) / 3)", left: `calc(3px + ${["System", "Light", "Dark"].indexOf(mode)} * (100% - 6px) / 3)`, borderRadius: 999, background: "#fff", boxShadow: "0 2px 6px rgba(0,0,0,0.12)", transition: "left 360ms cubic-bezier(.34,1.3,.64,1)" }} />
            {["System", "Light", "Dark"].map((m) => <button key={m} onClick={() => setMode(m)} style={{ flex: 1, position: "relative", border: 0, background: "none", height: 30, font: `${mode === m ? 600 : 500} 14px var(--font-system)`, cursor: "pointer" }}>{m}</button>)}
          </div>
        </div>
        {row("Notify when ready", <span onClick={() => setNotify(!notify)} style={{ width: 51, height: 31, borderRadius: 16, background: notify ? "#34C759" : "rgba(120,120,128,0.16)", position: "relative", cursor: "pointer", transition: "background 250ms" }}><span style={{ position: "absolute", top: 2, left: notify ? 22 : 2, width: 27, height: 27, borderRadius: 14, background: "#fff", boxShadow: "0 3px 8px rgba(0,0,0,0.15)", transition: "left 260ms cubic-bezier(.34,1.3,.64,1)" }} /></span>, 1)}
        {row("Help & Support", <RIcon name="chevron-forward" size={15} color="#A1A1A6" />, 1)}
        {row("Privacy", <RIcon name="chevron-forward" size={15} color="#A1A1A6" />, 1)}
      </div>
      <div style={{ ...card({ overflow: "hidden" }), marginTop: 16 }}>
        <div onClick={onReplay} style={{ padding: "13px 16px", fontSize: 17, color: GL_TINT, cursor: "pointer" }}>Replay onboarding</div>
        <div style={{ padding: "13px 16px", fontSize: 17, color: GL_TINT, borderTop: "0.5px solid rgba(20,20,25,0.08)" }}>Sign Out</div>
        <div style={{ padding: "13px 16px", fontSize: 17, color: "#D61E24", borderTop: "0.5px solid rgba(20,20,25,0.08)" }}>Delete Account</div>
      </div>
      <div style={{ textAlign: "center", fontSize: 13, color: "#6E6E73", marginTop: 16 }}>KIPS 1.0.0</div>

      {how ? (
        <GlassSheet onClose={() => setHow(false)}>
          {(c) => (
            <>
              <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 14 }}>How AI Credits work</div>
              {[["Finding garments is free", "Detecting the pieces in a photo never uses credits."], ["You pay per image created", "A front image, a back image or a 360° view each have their own price. Failed attempts cost nothing."], ["You always see the cost first", "Every AI action shows its price and your balance before anything is made."]].map(([t, b], k) => (
                <div key={t} style={{ display: "flex", gap: 12, marginBottom: 16, animation: `rd-rise 360ms cubic-bezier(.23,1,.32,1) ${k * 80}ms both` }}>
                  <span style={{ width: 26, height: 26, borderRadius: 13, background: "rgba(31,107,255,0.12)", color: GL_TINT, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{k + 1}</span>
                  <div><div style={{ fontSize: 17, fontWeight: 600 }}>{t}</div><div style={{ fontSize: 15, color: "#6E6E73" }}>{b}</div></div>
                </div>
              ))}
              <button onClick={c} style={{ width: "100%", height: 54, borderRadius: 16, border: 0, background: GL_TINT, color: "#fff", font: "600 17px var(--font-system)", cursor: "pointer", marginTop: 4 }}>Got It</button>
            </>
          )}
        </GlassSheet>
      ) : null}
    </div>
  );
}
window.GlassMe = GlassMe;
