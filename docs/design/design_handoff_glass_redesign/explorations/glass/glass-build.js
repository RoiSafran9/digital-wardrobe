// Build My Look in the Glass direction: 3 questions on glass option tiles → building → swipe deck with piece swap.
const BL_Q = [
  { key: "occasion", title: "Where are you going?", opts: [["Any", "shuffle-outline"], ["Everyday", "cafe-outline"], ["Work", "briefcase-outline"], ["Date", "heart-outline"], ["Going Out", "wine-outline"], ["Formal", "ribbon-outline"]] },
  { key: "style", title: "What's the vibe?", opts: [["Any", "shuffle-outline"], ["Minimal", "ellipse-outline"], ["Street", "footsteps-outline"], ["Classic", "star-outline"], ["Bold", "flash-outline"], ["Sporty", "walk-outline"]] },
  { key: "weather", title: "And the weather?", opts: [["Any", "shuffle-outline"], ["Hot", "sunny"], ["Warm", "sunny-outline"], ["Mild", "partly-sunny-outline"], ["Cold", "snow-outline"], ["Rain", "rainy-outline"]] },
];

function BlTile({ label, icon, selected, onClick, delay }) {
  const [d, setD] = React.useState(false);
  return (
    <button onClick={onClick} onPointerDown={() => setD(true)} onPointerUp={() => setD(false)} onPointerLeave={() => setD(false)}
      style={{ ...gl({ borderRadius: 20, background: selected ? "#131315" : "rgba(255,255,255,0.62)" }), height: 86, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", transform: d ? "scale(0.96)" : "none", transition: "transform 160ms, background 220ms", animation: `rd-pop 420ms cubic-bezier(.2,.8,.2,1) ${delay}ms both` }}>
      <span key={String(selected)} style={{ display: "flex", animation: selected ? "rd-pop 380ms cubic-bezier(.34,1.6,.64,1)" : undefined }}><RIcon name={icon} size={26} color={selected ? "#fff" : "#131315"} /></span>
      <span style={{ font: "500 15px var(--font-system)", color: selected ? "#fff" : "#131315" }}>{label}</span>
    </button>
  );
}

function GlassBuild({ onClose, say, items }) {
  const [q, setQ] = React.useState(0);
  const [ans, setAns] = React.useState({ occasion: "Any", style: "Any", weather: "Any" });
  const [phase, setPhase] = React.useState("ask");
  const [looks, setLooks] = React.useState(RD_LOOKS.map((l) => ({ ...l, items: [...l.items] })));
  const [cur, setCur] = React.useState(0);
  const [swap, setSwap] = React.useState(null);
  const [on, setOn] = React.useState(false);
  React.useEffect(() => { requestAnimationFrame(() => setOn(true)); }, []);
  const close = () => { setOn(false); setTimeout(onClose, 320); };
  const build = () => { setPhase("building"); setTimeout(() => setPhase("looks"), 1600); };
  const Q = BL_Q[q];
  const look = looks.find((l) => l.id === RD_LOOKS[cur % RD_LOOKS.length].id);
  const pickSwap = (slot, id) => { setLooks(looks.map((l) => (l.id === look.id ? { ...l, items: l.items.map((x, k) => (k === slot ? id : x)) } : l))); setSwap(null); say("Swapped"); };
  const summary = Object.values(ans).filter((v) => v !== "Any").join(" · ") || "Anything goes";
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 60, background: "#F2F2F6", fontFamily: "var(--font-system)", color: "#131315", transform: on ? "none" : "translateY(100%)", transition: "transform 420ms cubic-bezier(.2,.8,.2,1)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div aria-hidden="true" style={{ position: "absolute", width: 320, height: 320, borderRadius: "50%", background: "#8FB0D6", opacity: 0.3, filter: "blur(70px)", top: -80, right: -120 }} />
      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "56px 16px 6px" }}>
        <button onClick={phase === "ask" && q > 0 ? () => setQ(q - 1) : close} aria-label="Back" style={{ ...gl({ borderRadius: 20 }), width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><RIcon name={phase === "ask" && q > 0 ? "chevron-back" : "close"} size={20} color="#131315" /></button>
        {phase === "ask" ? <div style={{ display: "flex", gap: 6 }}>{BL_Q.map((_, k) => <span key={k} style={{ width: k === q ? 22 : 7, height: 7, borderRadius: 4, background: k <= q ? GL_TINT : "rgba(120,120,128,0.3)", transition: "all 300ms cubic-bezier(.34,1.4,.64,1)" }} />)}</div> : <span style={{ ...gl({ borderRadius: 999 }), padding: "7px 12px", fontSize: 13, fontWeight: 600 }}>{summary}</span>}
        <span style={{ width: 40 }} />
      </div>

      {phase === "ask" ? (
        <div key={q} style={{ position: "relative", flex: 1, padding: "18px 20px 34px", display: "flex", flexDirection: "column", animation: "rd-rise 360ms cubic-bezier(.23,1,.32,1)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.65px", color: "#6E6E73" }}>BUILD MY LOOK · {q + 1} OF 3</div>
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.6px", marginTop: 6 }}>{Q.title}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 22 }}>
            {Q.opts.map(([l, ic], k) => <BlTile key={l} label={l} icon={ic} delay={k * 40} selected={ans[Q.key] === l} onClick={() => setAns({ ...ans, [Q.key]: l })} />)}
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={() => (q < 2 ? setQ(q + 1) : build())} style={{ height: 54, borderRadius: 16, border: 0, background: GL_TINT, color: "#fff", font: "600 17px var(--font-system)", cursor: "pointer" }}>{q < 2 ? "Next" : "Build Looks"}</button>
          <div style={{ textAlign: "center", fontSize: 13, color: "#6E6E73", marginTop: 10 }}>{`Made only from your ${items.length} pieces`}</div>
        </div>
      ) : null}

      {phase === "building" ? (
        <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, animation: "rd-fade 300ms" }}>
          <div style={{ display: "flex", gap: 8 }}>{["blue", "navy", "pants", "sneaker"].map((id, k) => <GImg key={id} item={rdById(id)} radius={16} style={{ width: 64, height: 80, animation: `rd-float 1.2s ease-in-out ${k * 150}ms infinite alternate`, boxShadow: "0 10px 20px rgba(0,0,0,0.1)" }} />)}</div>
          <div style={{ fontSize: 17, fontWeight: 600 }}>Putting looks together…</div>
        </div>
      ) : null}

      {phase === "looks" && look ? (
        <div style={{ position: "relative", flex: 1, padding: "14px 20px 30px", display: "flex", flexDirection: "column", animation: "rd-fade 300ms" }}>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.6px" }}>4 looks for you</div>
          <div style={{ fontSize: 15, color: "#6E6E73", marginTop: 2, marginBottom: 14 }}>Swipe right to save, left for the next one.</div>
          <SwipeDeck looks={looks} height={360} onSwipe={(l, d) => { setCur((c) => c + 1); if (d > 0) say(`Saved “${l.name}”`); }}
            renderCard={(lk, { like, pass }) => (
              <div style={{ height: "100%", background: "#fff", borderRadius: 30, padding: 10, boxSizing: "border-box", boxShadow: "0 18px 40px rgba(0,0,0,0.10)", display: "flex", flexDirection: "column" }}>
                <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
                  <LookCollage look={lk} radius={20} />
                  <span style={{ ...gl({ borderRadius: 999 }), position: "absolute", top: 12, left: 12, padding: "7px 12px", fontSize: 14, fontWeight: 700, color: "#1B7F45", opacity: like }}>Save ✓</span>
                  <span style={{ ...gl({ borderRadius: 999 }), position: "absolute", top: 12, right: 12, padding: "7px 12px", fontSize: 14, fontWeight: 700, color: "#6E6E73", opacity: pass }}>Next</span>
                </div>
                <div style={{ padding: "12px 6px 4px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><span style={{ fontSize: 19, fontWeight: 700 }}>{lk.name}</span><span style={{ fontSize: 13, color: "#6E6E73" }}>{`${lk.items.length} pieces`}</span></div>
              </div>
            )}
          />
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.65px", color: "#6E6E73", marginTop: 18 }}>TAP A PIECE TO SWAP IT</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {look.items.map((id, slot) => <div key={slot + id} onClick={() => setSwap(slot)} style={{ ...gl({ borderRadius: 16 }), padding: 4, cursor: "pointer", position: "relative" }}><GImg item={rdById(id)} radius={12} style={{ width: 56, height: 66 }} /><span style={{ ...gl({ borderRadius: 10, background: "#fff" }), position: "absolute", right: -4, bottom: -4, width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center" }}><RIcon name="swap-horizontal" size={12} color="#131315" /></span></div>)}
          </div>
        </div>
      ) : null}

      {swap !== null && look ? (
        <GlassSheet onClose={() => setSwap(null)}>
          {(c) => {
            const curIt = rdById(look.items[swap]);
            const alts = items.filter((x) => x.group === curIt.group);
            return (
              <>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{`Swap ${curIt.group.toLowerCase()}`}</div>
                <div style={{ fontSize: 15, color: "#6E6E73", margin: "2px 0 14px" }}>{`${alts.length} in your closet`}</div>
                <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, scrollbarWidth: "none" }}>
                  {alts.map((a) => <div key={a.id} onClick={() => { pickSwap(swap, a.id); }} style={{ flexShrink: 0, cursor: "pointer", textAlign: "center" }}><GImg item={a} radius={18} style={{ width: 104, height: 128, outline: a.id === curIt.id ? `2.5px solid ${GL_TINT}` : "none", outlineOffset: 2 }} /><div style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>{a.name}</div></div>)}
                </div>
                <button onClick={c} style={{ width: "100%", height: 44, border: 0, background: "none", color: GL_TINT, font: "600 17px var(--font-system)", cursor: "pointer", marginTop: 8 }}>Keep this one</button>
              </>
            );
          }}
        </GlassSheet>
      ) : null}
    </div>
  );
}
window.GlassBuild = GlassBuild;
