// Home, final combination: 4b layout + 5a Add hero + Build My Look hero (replaces the color stats) + 5c raised-center tab bar.
function HomeFinal({ say, items = RD_ITEMS, credits = 213, onAdd, onBuild, openGroup, openItem }) {
  const n = items.length;
  const add = onAdd || ((m) => say("Camera · " + m));
  const groups = RD_GROUPS.map((g) => [g, items.filter((i) => i.group === g)]).filter(([, l]) => l.length);
  const lookIds = RD_LOOKS[1].items;
  const fresh = items.filter((i) => i.isNew);
  return (
    <div style={{ position: "relative", padding: "56px 16px 150px", fontFamily: HF }}>
      <div style={{ padding: "0 4px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={hEyebrow}>Good evening, Roi</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}><span style={hTitle(64, { fontVariantNumeric: "tabular-nums" })}>{n}</span><span style={hTitle(24, { color: "#6E6E73" })}>{n === 1 ? "piece" : "pieces"}</span></div>
        </div>
        <span style={{ ...gl({ borderRadius: 999 }), display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", fontSize: 15, fontWeight: 600, fontVariantNumeric: "tabular-nums", marginBottom: 10 }}><span style={{ width: 7, height: 7, borderRadius: 4, background: GL_TINT }} />{credits}</span>
      </div>

      <div style={{ ...gl({ borderRadius: 28, background: "rgba(11,94,255,0.9)", border: "0.5px solid rgba(255,255,255,0.4)" }), marginTop: 10, padding: 14, color: "#fff", position: "relative", overflow: "hidden" }}>
        <span aria-hidden="true" style={{ position: "absolute", right: -30, top: -30, width: 140, height: 140, borderRadius: 70, background: "rgba(255,255,255,0.14)" }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 46, height: 46, borderRadius: 23, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, animation: "rd-breathe 3s ease-in-out infinite" }}><RIcon name="camera" size={24} color={GL_TINT} /></span>
          <div><div style={hTitle(24, { letterSpacing: "-0.02em" })}>Add clothes</div><div style={{ fontSize: 13, opacity: 0.88 }}>Finding pieces is free · 1 credit per piece</div></div>
        </div>
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
          {[["layers-outline", "Laid flat", "flat"], ["body-outline", "Worn", "worn"]].map(([ic, l, m]) => <button key={l} onClick={() => add(m)} style={{ height: 44, borderRadius: 14, border: 0, background: "rgba(255,255,255,0.2)", color: "#fff", font: `600 15px ${HF}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" }}><RIcon name={ic} size={18} color="#fff" />{l}</button>)}
        </div>
      </div>

      <div onClick={onBuild || (() => say("Build My Look"))} style={{ ...gl({ borderRadius: 28 }), marginTop: 10, padding: 14, height: 132, boxSizing: "border-box", display: "flex", gap: 12, alignItems: "stretch", cursor: "pointer", overflow: "hidden" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "2px 0 2px 4px" }}>
          <div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 999, background: "rgba(11,94,255,0.12)", color: GL_TINT, fontSize: 12, fontWeight: 700 }}><RIcon name="sparkles" size={12} color={GL_TINT} />AI stylist</span>
            <div style={hTitle(24, { marginTop: 8 })}>Build My Look</div>
            <div style={{ fontSize: 13, color: "#3A3A3F", marginTop: 2 }}>{`Outfits from your ${n} pieces`}</div>
          </div>
        </div>
        <div style={{ position: "relative", width: 150, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0 }}>
          <span style={{ position: "absolute", right: 0, bottom: 0, width: 34, height: 34, borderRadius: 17, background: "#131315", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4 }}><RIcon name="arrow-forward" size={16} color="#fff" /></span>
          {lookIds.slice(0, 3).map((id, k) => <GImg key={id} item={rdById(id)} radius={14} style={{ position: "absolute", width: 68, height: 84, right: [86, 44, 6][k], top: [4, 14, 0][k], transform: `rotate(${[-6, 7, -2][k]}deg)`, border: "2px solid #fff", boxShadow: "0 10px 20px rgba(0,0,0,0.14)", animation: `rd-float 2.6s ease-in-out ${k * 300}ms infinite alternate` }} />)}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
        {groups.map(([g, list]) => {
          const ids = list.slice(0, 3);
          return (
            <div key={g} onClick={() => (openGroup ? openGroup(g) : say(g))} style={{ ...gl({ borderRadius: 24 }), height: 132, padding: 14, boxSizing: "border-box", position: "relative", overflow: "hidden", cursor: "pointer" }}>
              <div style={{ position: "absolute", right: -4, bottom: -12, display: "flex" }}>{ids.map((it, k) => <GImg key={it.id} item={it} radius={14} style={{ width: 62, height: 78, marginLeft: k ? -30 : 0, transform: `rotate(${(k - (ids.length - 1) / 2) * 9}deg) translateY(${k * 4}px)`, boxShadow: "0 8px 16px rgba(0,0,0,0.12)", border: "2px solid #fff" }} />)}</div>
              <div style={hTitle(21)}>{g}</div>
              <div style={{ fontSize: 14, color: "#6E6E73", fontVariantNumeric: "tabular-nums" }}>{list.length}</div>
            </div>
          );
        })}
      </div>

      {fresh.length ? <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "24px 4px 10px" }}><span style={hTitle(22)}>New this week</span><span style={{ fontSize: 15, color: "#6E6E73" }}>{fresh.length}</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, animation: "rd-rise 420ms cubic-bezier(.23,1,.32,1)" }}>
        {fresh.slice(0, 4).map((it) => <div key={it.id} onClick={() => openItem && openItem(it)} style={{ cursor: "pointer" }}><GImg item={it} radius={14} style={{ aspectRatio: "4 / 5" }} /></div>)}
      </div></> : null}
    </div>
  );
}

// 5c tab bar, wired: Home · Closet · [camera] · Looks · Me
function TabsCenter({ tab, setTab, onCamera }) {
  const t = [["home", "Home", "home-outline", "home"], ["closet", "Closet", "grid-outline", "grid"], ["add"], ["looks", "Looks", "sparkles-outline", "sparkles"], ["me", "Me", "person-circle-outline", "person-circle"]];
  return (
    <div style={{ position: "absolute", left: 16, right: 16, bottom: 26, zIndex: 30, ...gl({ borderRadius: 999 }), height: 62, display: "flex", alignItems: "center", padding: "0 4px", fontFamily: HF }}>
      {t.map(([k, l, ic, icOn]) => k === "add" ? (
        <button key={k} onClick={onCamera} aria-label="Add clothes" style={{ flex: 1.2, border: 0, background: "none", cursor: "pointer", display: "flex", justifyContent: "center" }}>
          <span style={{ width: 72, height: 72, marginTop: -26, borderRadius: 36, background: GL_TINT, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 12px 26px rgba(11,94,255,0.4), 0 0 0 5px rgba(255,255,255,0.85)", animation: "rd-breathe 3s ease-in-out infinite" }}><RIcon name="camera" size={30} color="#fff" /></span>
        </button>
      ) : (
        <button key={k} onClick={() => setTab(k)} style={{ flex: 1, border: 0, background: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <RIcon name={tab === k ? icOn : ic} size={23} color={tab === k ? GL_TINT : "#3A3A3F"} /><span style={{ fontSize: 10.5, fontWeight: 600, color: tab === k ? GL_TINT : "#3A3A3F" }}>{l}</span>
        </button>
      ))}
    </div>
  );
}

function HomeFinalDemo() {
  return <HShell tabs={(say) => <TabsCenter tab="home" setTab={(k) => k !== "home" && say(k)} onCamera={() => say("Camera opens")} />}>{(say) => <HomeFinal say={say} />}</HShell>;
}
Object.assign(window, { HomeFinal, TabsCenter, HomeFinalDemo });
