// 1a — Liquid Glass: floating glass tab capsule + separate camera, shelves on Home, full-bleed item with glass controls.
const gl = (x = {}) => ({ background: "rgba(255,255,255,0.58)", backdropFilter: "blur(22px) saturate(180%)", WebkitBackdropFilter: "blur(22px) saturate(180%)", border: "0.5px solid rgba(255,255,255,0.8)", boxShadow: "0 10px 30px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.9)", ...x });
const GL_TINT = "#0B5EFF";

function GlassTabs({ tab, setTab, onCamera, say }) {
  const tabs = [["home", "Today", "home-outline", "home"], ["closet", "Closet", "grid-outline", "grid"], ["me", "Me", "person-circle-outline", "person-circle"]];
  const i = tabs.findIndex((t) => t[0] === tab);
  return (
    <div style={{ position: "absolute", left: 16, right: 16, bottom: 26, zIndex: 30, display: "flex", gap: 10 }}>
      <div style={{ ...gl({ borderRadius: 999 }), flex: 1, height: 62, display: "flex", position: "relative", padding: 4, boxSizing: "border-box" }}>
        <div style={{ position: "absolute", top: 4, bottom: 4, left: `calc(4px + ${i} * (100% - 8px) / 3)`, width: "calc((100% - 8px) / 3)", borderRadius: 999, background: "rgba(11,94,255,0.12)", transition: "left 420ms cubic-bezier(.34,1.4,.64,1)" }} />
        {tabs.map(([k, l, ic, icOn]) => {
          const on = tab === k, c = on ? GL_TINT : "#3A3A3F";
          return (
            <button key={k} onClick={() => setTab(k)} style={{ flex: 1, border: 0, background: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, position: "relative" }}>
              <RIcon name={on ? icOn : ic} size={23} color={c} />
              <span style={{ fontSize: 10.5, fontWeight: 600, color: c }}>{l}</span>
            </button>
          );
        })}
      </div>
      <button onClick={onCamera} aria-label="Add with camera" style={{ ...gl({ borderRadius: 31, background: "rgba(11,94,255,0.88)", border: "0.5px solid rgba(255,255,255,0.4)" }), width: 62, height: 62, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
        <RIcon name="camera" size={26} color="#fff" />
      </button>
    </div>
  );
}

function GlassHome({ openItem, openGroup, say, onBuild, credits = 213, items = RD_ITEMS }) {
  const [worn, setWorn] = React.useState(null);
  return (
    <div style={{ padding: "62px 20px 130px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.65px", color: "#6E6E73" }}>THURSDAY, NOV 5</span>
        <span style={{ ...gl({ borderRadius: 999 }), display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", fontSize: 15, fontWeight: 600 }}><span style={{ width: 7, height: 7, borderRadius: 4, background: GL_TINT }} />{credits}</span>
      </div>
      <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.7px", marginTop: 6 }}>Good evening, Roi</div>
      {onBuild ? (
        <div onClick={onBuild} style={{ ...gl({ borderRadius: 22, background: "rgba(11,94,255,0.10)" }), marginTop: 16, padding: 14, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
          <span style={{ width: 40, height: 40, borderRadius: 20, background: GL_TINT, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><RIcon name="sparkles" size={20} color="#fff" /></span>
          <div style={{ flex: 1 }}><div style={{ fontSize: 17, fontWeight: 600 }}>Build My Look</div><div style={{ fontSize: 13, color: "#6E6E73" }}>Pick the occasion, get looks from your closet.</div></div>
          <RIcon name="chevron-forward" size={16} color="#6E6E73" />
        </div>
      ) : null}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 22, marginBottom: 12 }}>
        <span style={{ fontSize: 20, fontWeight: 700 }}>Today's looks</span>
        <span style={{ fontSize: 13, color: "#6E6E73" }}>Swipe right to wear</span>
      </div>
      <SwipeDeck looks={RD_LOOKS} height={352}
        onSwipe={(l, dir) => { if (dir > 0) { setWorn(l); say(`Wearing “${l.name}” today`); } }}
        renderCard={(look, { like, pass }) => (
          <div style={{ height: "100%", background: "#fff", borderRadius: 30, padding: 10, boxSizing: "border-box", boxShadow: "0 18px 40px rgba(0,0,0,0.10)", display: "flex", flexDirection: "column" }}>
            <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
              <LookCollage look={look} radius={20} />
              <span style={{ ...gl({ borderRadius: 999 }), position: "absolute", top: 12, left: 12, padding: "7px 12px", fontSize: 14, fontWeight: 700, color: "#1B7F45", opacity: like, transform: `scale(${0.8 + like * 0.2})` }}>Wear ✓</span>
              <span style={{ ...gl({ borderRadius: 999 }), position: "absolute", top: 12, right: 12, padding: "7px 12px", fontSize: 14, fontWeight: 700, color: "#6E6E73", opacity: pass, transform: `scale(${0.8 + pass * 0.2})` }}>Skip</span>
            </div>
            <div style={{ padding: "12px 6px 4px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 19, fontWeight: 700 }}>{look.name}</span>
              <span style={{ fontSize: 13, color: "#6E6E73" }}>{`${look.items.length} pieces · ${look.why}`}</span>
            </div>
          </div>
        )}
        renderControls={(swipe) => (
          <div style={{ display: "flex", justifyContent: "center", gap: 18, marginTop: 18 }}>
            <button onClick={() => swipe(-1)} aria-label="Skip" style={{ ...gl({ borderRadius: 28 }), width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><RIcon name="close" size={26} color="#3A3A3F" /></button>
            <button onClick={() => swipe(1)} aria-label="Wear" style={{ ...gl({ borderRadius: 28, background: "rgba(11,94,255,0.9)" }), width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><RIcon name="checkmark" size={28} color="#fff" /></button>
          </div>
        )}
      />
      {worn ? (
        <div style={{ marginTop: 18, background: "#fff", borderRadius: 20, padding: 12, display: "flex", alignItems: "center", gap: 12, animation: "rd-pop 480ms cubic-bezier(.2,.8,.2,1)" }}>
          <div style={{ display: "flex" }}>{worn.items.slice(0, 3).map((id, i) => <GImg key={id} item={rdById(id)} radius={12} style={{ width: 38, height: 46, marginLeft: i ? -10 : 0, border: "2px solid #fff" }} />)}</div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 600 }}>Wearing today</div><div style={{ fontSize: 13, color: "#6E6E73" }}>{worn.name}</div></div>
          <span onClick={() => setWorn(null)} style={{ fontSize: 15, color: GL_TINT, cursor: "pointer" }}>Change</span>
        </div>
      ) : null}
      {RD_GROUPS.map((g) => {
        const list = items.filter((i) => i.group === g);
        return (
          <div key={g} style={{ marginTop: 26 }}>
            <div onClick={() => openGroup(g)} style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10, cursor: "pointer" }}>
              <span style={{ fontSize: 20, fontWeight: 700 }}>{g}</span>
              <span style={{ fontSize: 15, color: "#6E6E73" }}>{list.length}</span>
              <span style={{ flex: 1 }} />
              <RIcon name="chevron-forward" size={16} color="#6E6E73" />
            </div>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", margin: "0 -20px", padding: "4px 20px 14px", scrollbarWidth: "none" }}>
              {list.map((it) => <div key={it.id} onClick={() => openItem(it)} style={{ flexShrink: 0, cursor: "pointer" }}><GImg item={it} radius={20} style={{ width: 112, height: 140, boxShadow: "0 10px 22px rgba(0,0,0,0.08)" }} /></div>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GlassCloset({ group, setGroup, openItem, items = RD_ITEMS }) {
  const groups = ["All", ...RD_GROUPS];
  const gi = groups.indexOf(group);
  const [q, setQ] = React.useState("");
  const sw = useHSwipe(() => setGroup(groups[Math.min(groups.length - 1, gi + 1)]), () => setGroup(groups[Math.max(0, gi - 1)]));
  const list = items.filter((i) => (group === "All" || i.group === group) && (!q || (i.name + i.color + i.details).toLowerCase().includes(q.toLowerCase())));
  return (
    <div>
      <div style={{ position: "sticky", top: 0, zIndex: 5, ...gl({ borderRadius: 0, border: 0, borderBottom: "0.5px solid rgba(0,0,0,0.06)", boxShadow: "none", background: "rgba(242,242,246,0.72)" }), padding: "58px 20px 12px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.7px" }}>Closet</span>
          <span style={{ fontSize: 15, color: "#6E6E73" }}>{`${items.length} pieces`}</span>
        </div>
        <div style={{ ...gl({ borderRadius: 14 }), display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 12px", marginTop: 10 }}>
          <RIcon name="search" size={16} color="#6E6E73" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, color, details" style={{ flex: 1, border: 0, outline: 0, background: "none", font: "17px var(--font-system)" }} />
        </div>
        <div style={{ position: "relative", display: "flex", marginTop: 10, background: "rgba(120,120,128,0.12)", borderRadius: 999, padding: 3 }}>
          <div style={{ position: "absolute", top: 3, bottom: 3, left: `calc(3px + ${gi} * (100% - 6px) / ${groups.length})`, width: `calc((100% - 6px) / ${groups.length})`, borderRadius: 999, background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", transition: "left 380ms cubic-bezier(.34,1.3,.64,1)" }} />
          {groups.map((g) => <button key={g} onClick={() => setGroup(g)} style={{ flex: 1, position: "relative", border: 0, background: "none", height: 30, cursor: "pointer", font: `${g === group ? 600 : 500} 13px var(--font-system)`, color: "#131315" }}>{g}</button>)}
        </div>
      </div>
      <div {...sw.bind} style={{ ...sw.bind.style, padding: "16px 20px 130px", minHeight: 500 }}>
        <div key={group} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, transform: `translateX(${sw.dx * 0.4}px)`, transition: sw.dx ? "none" : "transform 300ms", animation: "rd-rise 360ms cubic-bezier(.23,1,.32,1)" }}>
          {list.map((it, i) => (
            <div key={it.id} onClick={() => !sw.dragged.current && openItem(it, list)} style={{ position: "relative", cursor: "pointer", animation: `rd-rise 360ms cubic-bezier(.23,1,.32,1) ${i * 40}ms both` }}>
              <GImg item={it} radius={24} style={{ aspectRatio: "4 / 5", boxShadow: "0 12px 26px rgba(0,0,0,0.08)" }} />
              {it.isNew ? <span style={{ position: "absolute", top: 8, right: 8, padding: "3px 8px", borderRadius: 999, background: GL_TINT, color: "#fff", fontSize: 11, fontWeight: 700 }}>NEW</span> : null}
              <span style={{ ...gl({ borderRadius: 999 }), position: "absolute", left: 8, bottom: 8, maxWidth: "calc(100% - 16px)", padding: "5px 10px", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", boxSizing: "border-box" }}>{it.name}</span>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", fontSize: 13, color: "#6E6E73", marginTop: 20 }}>Swipe sideways to change category</div>
      </div>
    </div>
  );
}

function GlassItem({ list, start, onClose, say }) {
  const [i, setI] = React.useState(start);
  const [side, setSide] = React.useState("front");
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => { requestAnimationFrame(() => setShown(true)); }, []);
  const it = list[i];
  const close = () => { setShown(false); setTimeout(onClose, 320); };
  const sw = useHSwipe(() => { if (i < list.length - 1) { setI(i + 1); setSide("front"); } }, () => { if (i > 0) { setI(i - 1); setSide("front"); } });
  const chips = [it.color, it.pattern, it.details, it.text ? `“${it.text}”` : null].filter(Boolean);
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 40, background: "#F2F2F6", transform: shown ? "none" : "translateY(100%)", transition: "transform 420ms cubic-bezier(.2,.8,.2,1)", overflowY: "auto", scrollbarWidth: "none" }}>
      <div {...sw.bind} style={{ ...sw.bind.style, position: "relative", height: 500, background: it.white ? "#fff" : "#F3F2EF", overflow: "hidden" }}>
        <div key={it.id + side} style={{ position: "absolute", inset: 0, transform: `translateX(${sw.dx}px)`, transition: sw.dx ? "none" : "transform 300ms", animation: "rd-fade 320ms" }}>
          {side === "back" ? (
            <div style={{ position: "absolute", inset: "110px 40px 110px", borderRadius: 28, border: "1.5px dashed #C7C7CC", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <RIcon name="camera-reverse-outline" size={30} color="#6E6E73" />
              <span style={{ fontSize: 17, fontWeight: 600 }}>No back image yet</span>
              <button onClick={() => say("Confirm · 1 credit · 213 → 212")} style={{ ...gl({ borderRadius: 999 }), padding: "9px 16px", font: "600 15px var(--font-system)", cursor: "pointer" }}>Add Back · 1 credit</button>
            </div>
          ) : <img src={it.img} alt={it.name} draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", animation: side === "360" ? "rd-turn 3.2s ease-in-out infinite" : undefined }} />}
        </div>
        <div style={{ position: "absolute", top: 54, left: 16, right: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={close} aria-label="Close" style={{ ...gl({ borderRadius: 20 }), width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><RIcon name="chevron-down" size={22} color="#131315" /></button>
          <span style={{ ...gl({ borderRadius: 999 }), padding: "7px 12px", fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{`${i + 1} / ${list.length}`}</span>
          <button onClick={() => say("Edit opens here")} style={{ ...gl({ borderRadius: 999 }), height: 40, padding: "0 16px", font: "600 15px var(--font-system)", color: GL_TINT, cursor: "pointer" }}>Edit</button>
        </div>
        {side === "360" ? <span style={{ ...gl({ borderRadius: 999 }), position: "absolute", top: 104, left: "50%", transform: "translateX(-50%)", padding: "5px 10px", fontSize: 12, fontWeight: 600 }}>AI view · drag to rotate</span> : null}
        <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", ...gl({ borderRadius: 999 }), display: "flex", padding: 4 }}>
          {[["front", "Front"], ["back", "Back"], ["360", "360°"]].map(([k, l]) => <button key={k} onClick={() => setSide(k)} style={{ border: 0, borderRadius: 999, padding: "8px 18px", cursor: "pointer", background: side === k ? "#fff" : "transparent", boxShadow: side === k ? "0 2px 8px rgba(0,0,0,0.12)" : "none", font: `${side === k ? 600 : 500} 15px var(--font-system)`, transition: "all 220ms" }}>{l}</button>)}
        </div>
      </div>
      <div style={{ padding: "20px 20px 60px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.5px" }}>{it.name}</span>
          <span style={{ padding: "3px 10px", borderRadius: 999, background: it.tier === "Great" ? "#E3EBDD" : "#F3E8CF", color: it.tier === "Great" ? "#3B5530" : "#7A5A12", fontSize: 13, fontWeight: 600 }}>{it.tier}</span>
        </div>
        <div style={{ fontSize: 15, color: "#6E6E73", marginTop: 4 }}>{`${it.group} · ${it.cat} · Added ${it.added}`}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
          {chips.map((c, k) => <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", borderRadius: 999, background: "#fff", fontSize: 15 }}>{k === 0 ? <span style={{ width: 12, height: 12, borderRadius: 6, background: it.hex, border: "1px solid rgba(0,0,0,0.1)" }} /> : null}{c}</span>)}
        </div>
        <div style={{ marginTop: 22, background: "#fff", borderRadius: 20, overflow: "hidden" }}>
          {[["Add back image", "1 credit"], ["Generate 360° view", "3 credits"]].map(([l, v]) => (
            <div key={l} onClick={() => say(`Confirm · ${v}`)} style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", borderBottom: "0.5px solid rgba(20,20,25,0.08)", fontSize: 17, cursor: "pointer" }}><span>{l}</span><span style={{ color: "#6E6E73" }}>{v}</span></div>
          ))}
          <div style={{ padding: "14px 16px", fontSize: 17, color: "#D61E24" }}>Remove from closet</div>
        </div>
      </div>
    </div>
  );
}

function DirGlass() {
  const [tab, setTab] = React.useState("home");
  const [group, setGroup] = React.useState("All");
  const [item, setItem] = React.useState(null);
  const [cap, setCap] = React.useState(false);
  const [toast, say] = useRToast();
  const openItem = (it, list = RD_ITEMS) => setItem({ list, i: list.indexOf(it) });
  return (
    <IOSDevice>
      <div style={{ position: "relative", height: "100%", background: "#F2F2F6", fontFamily: "var(--font-system)", color: "#131315", overflow: "hidden" }}>
        <div key={tab} style={{ position: "absolute", inset: 0, overflowY: "auto", scrollbarWidth: "none", animation: "rd-fade 260ms" }}>
          {tab === "home" ? <GlassHome say={say} openItem={(it) => openItem(it)} openGroup={(g) => { setGroup(g); setTab("closet"); }} /> : <GlassCloset group={group} setGroup={setGroup} openItem={openItem} />}
        </div>
        <GlassTabs tab={tab} setTab={(k) => (k === "me" ? say("Account stays as it is in this pass") : setTab(k))} onCamera={() => setCap(true)} say={say} />
        {item ? <GlassItem list={item.list} start={item.i} onClose={() => setItem(null)} say={say} /> : null}
        {cap ? <CaptureOverlay onClose={() => setCap(false)} onDone={() => say("Creating 3 pieces…")} /> : null}
        {toast()}
      </div>
    </IOSDevice>
  );
}
window.DirGlass = DirGlass;
