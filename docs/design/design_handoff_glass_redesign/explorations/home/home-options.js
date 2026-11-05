// Four Home alternatives in the Glass direction, set in Bricolage Grotesque.
const HF = "'Bricolage Grotesque', var(--font-system)";
const hTitle = (size, x = {}) => ({ fontFamily: HF, fontSize: size, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.02, ...x });
const hEyebrow = { fontSize: 13, fontWeight: 600, letterSpacing: "0.6px", color: "#6E6E73", textTransform: "uppercase" };
const hBlob = (c, x, y, s, o = 0.3) => <span aria-hidden="true" style={{ position: "absolute", left: x, top: y, width: s, height: s, borderRadius: "50%", background: c, opacity: o, filter: "blur(70px)", pointerEvents: "none" }} />;

function HShell({ children, bg = "#F2F2F6", blobs = true, tabs, onScroll }) {
  const [tab, setTab] = React.useState("home");
  const [toast, say] = useRToast();
  return (
    <IOSDevice>
      <div style={{ position: "relative", height: "100%", background: bg, fontFamily: HF, color: "#131315", overflow: "hidden" }}>
        {blobs ? <>{hBlob("#8FB0D6", "-90px", "-80px", 320)}{hBlob("#E8C9A8", "220px", "380px", 260, 0.25)}</> : null}
        <div onScroll={onScroll} style={{ position: "absolute", inset: 0, overflowY: "auto", scrollbarWidth: "none" }}>{typeof children === "function" ? children(say) : children}</div>
        {tabs ? tabs(say) : <GlassTabs tab={tab} setTab={(k) => { if (k !== "home") say("Home options only"); }} onCamera={() => say("Camera opens")} say={say} />}
        {toast({ fontFamily: HF })}
      </div>
    </IOSDevice>
  );
}

// 4a — One look, full stage. The day's outfit is the whole top of the screen.
function HomeStage() {
  const [i, setI] = React.useState(0);
  const look = RD_LOOKS[i % RD_LOOKS.length];
  const sw = useHSwipe(() => setI(i + 1), () => setI(i + RD_LOOKS.length - 1));
  return (
    <HShell>
      {(say) => (
        <div style={{ position: "relative", paddingBottom: 130 }}>
          <div {...sw.bind} style={{ ...sw.bind.style, position: "relative", height: 560, overflow: "hidden" }}>
            <div key={look.id} style={{ position: "absolute", inset: 0, padding: "0 0 0 0", transform: `translateX(${sw.dx}px)`, transition: sw.dx ? "none" : "transform 320ms", animation: "rd-fade 420ms" }}>
              <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 3 }}>
                <GImg item={rdById(look.items[0])} radius={0} style={{ height: "100%" }} />
                <div style={{ display: "grid", gridTemplateRows: `repeat(${look.items.length - 1},minmax(0,1fr))`, gap: 3 }}>{look.items.slice(1).map((id) => <GImg key={id} item={rdById(id)} radius={0} style={{ height: "100%", minHeight: 0 }} />)}</div>
              </div>
            </div>
            <div style={{ position: "absolute", top: 54, left: 16, right: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ ...gl({ borderRadius: 999 }), padding: "7px 12px", fontSize: 13, fontWeight: 600 }}>Thu, Nov 5</span>
              <span style={{ ...gl({ borderRadius: 999 }), display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", fontSize: 15, fontWeight: 600 }}><span style={{ width: 7, height: 7, borderRadius: 4, background: GL_TINT }} />213</span>
            </div>
            <div style={{ position: "absolute", left: 12, right: 12, bottom: 12, ...gl({ borderRadius: 28, background: "rgba(255,255,255,0.7)" }), padding: 16 }}>
              <div style={{ ...hEyebrow }}>{`Tonight's look · ${(i % RD_LOOKS.length) + 1} of ${RD_LOOKS.length}`}</div>
              <div style={hTitle(34, { marginTop: 4 })}>{look.name}</div>
              <div style={{ fontSize: 14, color: "#3A3A3F", marginTop: 4 }}>{look.items.map((id) => rdById(id).name).join(" · ")}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button onClick={() => setI(i + 1)} style={{ ...gl({ borderRadius: 16 }), flex: 1, height: 48, font: `600 16px ${HF}`, cursor: "pointer" }}>Another one</button>
                <button onClick={() => say(`Wearing ${look.name}`)} style={{ flex: 1.3, height: 48, borderRadius: 16, border: 0, background: GL_TINT, color: "#fff", font: `600 16px ${HF}`, cursor: "pointer" }}>Wear this</button>
              </div>
            </div>
          </div>
          <div style={{ padding: "20px 20px 0" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {[["sparkles", "Build a look"], ["search", "Search"], ["shirt-outline", "Closet"]].map(([ic, l]) => <div key={l} onClick={() => say(l)} style={{ ...gl({ borderRadius: 20 }), height: 82, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" }}><RIcon name={ic} size={22} color="#131315" /><span style={{ fontSize: 14, fontWeight: 600 }}>{l}</span></div>)}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 24 }}><span style={hTitle(22)}>Just added</span><span style={{ fontSize: 15, color: GL_TINT }}>All 32</span></div>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", margin: "10px -20px 0", padding: "0 20px 10px", scrollbarWidth: "none" }}>{RD_ITEMS.map((it) => <GImg key={it.id} item={it} radius={18} style={{ width: 96, height: 120, flexShrink: 0 }} />)}</div>
          </div>
        </div>
      )}
    </HShell>
  );
}

// 4b — Closet at a glance. Home is the wardrobe itself: composition, categories, what's new.
function HomeGlance() {
  const colors = ["Blue", "Navy", "Gray", "White", "Black", "Brown"].map((c) => [c, RD_ITEMS.filter((x) => x.color === c)]).filter(([, l]) => l.length);
  return (
    <HShell>
      {(say) => (
        <div style={{ position: "relative", padding: "60px 16px 130px" }}>
          <div style={{ padding: "0 4px" }}>
            <div style={hEyebrow}>Good evening, Roi</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}><span style={hTitle(76, { fontVariantNumeric: "tabular-nums" })}>32</span><span style={hTitle(28, { color: "#6E6E73" })}>pieces</span></div>
          </div>
          <div style={{ ...gl({ borderRadius: 24 }), padding: 14, marginTop: 12 }}>
            <div style={{ display: "flex", height: 16, borderRadius: 8, overflow: "hidden", gap: 2 }}>{colors.map(([c, l]) => <span key={c} style={{ flex: l.length, background: l[0].hex }} />)}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginTop: 10 }}>{colors.map(([c, l]) => <span key={c} style={{ fontSize: 13, color: "#3A3A3F", display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: l[0].hex, border: "1px solid rgba(0,0,0,0.1)" }} />{c}</span>)}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
            {[["Tops", 20, ["blue", "navy", "white"]], ["Outerwear", 1, ["fleece"]], ["Bottoms", 9, ["pants"]], ["Shoes", 2, ["sneaker", "sandals"]]].map(([g, n, ids]) => (
              <div key={g} onClick={() => say(g)} style={{ ...gl({ borderRadius: 24 }), height: 168, padding: 14, boxSizing: "border-box", position: "relative", overflow: "hidden", cursor: "pointer" }}>
                <div style={{ position: "absolute", right: -6, bottom: -10, display: "flex" }}>{ids.map((id, k) => <GImg key={id} item={rdById(id)} radius={16} style={{ width: 74, height: 92, marginLeft: k ? -36 : 0, transform: `rotate(${(k - (ids.length - 1) / 2) * 9}deg) translateY(${k * 4}px)`, boxShadow: "0 8px 16px rgba(0,0,0,0.12)", border: "2px solid #fff" }} />)}</div>
                <div style={hTitle(22)}>{g}</div>
                <div style={{ fontSize: 15, color: "#6E6E73", fontVariantNumeric: "tabular-nums" }}>{n}</div>
              </div>
            ))}
          </div>
          <div onClick={() => say("Build My Look")} style={{ ...gl({ borderRadius: 24, background: "rgba(11,94,255,0.88)", border: "0.5px solid rgba(255,255,255,0.4)" }), marginTop: 10, padding: 16, color: "#fff", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
            <RIcon name="sparkles" size={24} color="#fff" />
            <div style={{ flex: 1 }}><div style={hTitle(20, { letterSpacing: "-0.02em" })}>Build My Look</div><div style={{ fontSize: 13, opacity: 0.85 }}>Outfit ideas from these 32 pieces</div></div>
            <RIcon name="arrow-forward" size={20} color="#fff" />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "24px 4px 10px" }}><span style={hTitle(22)}>New this week</span><span style={{ fontSize: 15, color: "#6E6E73" }}>4</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>{RD_ITEMS.slice(0, 4).map((it) => <GImg key={it.id} item={it} radius={14} style={{ aspectRatio: "4 / 5" }} />)}</div>
        </div>
      )}
    </HShell>
  );
}

// 4c — Stories + feed. Category rings on top, then a mixed feed of things worth doing.
function HomeFeed() {
  const rings = [["New", "white", true], ["Tops", "blue"], ["Layers", "fleece"], ["Bottoms", "pants"], ["Shoes", "sneaker"]];
  return (
    <HShell>
      {(say) => (
        <div style={{ position: "relative", padding: "60px 0 130px" }}>
          <div style={{ padding: "0 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={hTitle(34)}>Hey Roi</span>
            <span style={{ ...gl({ borderRadius: 999 }), display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", fontSize: 15, fontWeight: 600 }}><span style={{ width: 7, height: 7, borderRadius: 4, background: GL_TINT }} />213</span>
          </div>
          <div style={{ display: "flex", gap: 14, overflowX: "auto", padding: "16px 20px 6px", scrollbarWidth: "none" }}>
            {rings.map(([l, id, hot]) => (
              <div key={l} onClick={() => say(l)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer", flexShrink: 0 }}>
                <span style={{ width: 70, height: 70, borderRadius: 35, padding: 3, boxSizing: "border-box", background: hot ? GL_TINT : "rgba(120,120,128,0.25)" }}><span style={{ display: "block", width: "100%", height: "100%", borderRadius: "50%", padding: 2, background: "#F2F2F6", boxSizing: "border-box" }}><GImg item={rdById(id)} radius={999} style={{ width: "100%", height: "100%" }} /></span></span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{l}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: "12px 16px 0", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ ...gl({ borderRadius: 28 }), padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "4px 6px 10px" }}><span style={hTitle(22)}>Easy Thursday</span><span style={hEyebrow}>Tonight</span></div>
              <div style={{ position: "relative", height: 230 }}><LookCollage look={RD_LOOKS[0]} radius={18} /></div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={() => say("Next look")} style={{ flex: 1, height: 44, borderRadius: 14, border: 0, background: "rgba(120,120,128,0.12)", font: `600 15px ${HF}`, cursor: "pointer" }}>Next</button>
                <button onClick={() => say("Wearing it")} style={{ flex: 1, height: 44, borderRadius: 14, border: 0, background: GL_TINT, color: "#fff", font: `600 15px ${HF}`, cursor: "pointer" }}>Wear it</button>
              </div>
            </div>
            <div style={{ ...gl({ borderRadius: 24 }), padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
              <GImg item={rdById("gray")} radius={14} style={{ width: 60, height: 72 }} />
              <div style={{ flex: 1 }}><div style={{ fontSize: 16, fontWeight: 700 }}>3 tees have no back image</div><div style={{ fontSize: 13, color: "#6E6E73" }}>1 credit each · see the print on the back</div></div>
              <button onClick={() => say("Add back images")} style={{ ...gl({ borderRadius: 999 }), padding: "8px 12px", font: `600 14px ${HF}`, color: GL_TINT, cursor: "pointer" }}>Add</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ ...gl({ borderRadius: 24 }), padding: 10 }}><GImg item={rdById("white")} radius={16} style={{ aspectRatio: "1 / 1", animation: "rd-turn 3.2s ease-in-out infinite" }} /><div style={{ fontSize: 15, fontWeight: 700, marginTop: 8 }}>360° ready</div><div style={{ fontSize: 13, color: "#6E6E73" }}>White t-shirt</div></div>
              <div onClick={() => say("Camera opens")} style={{ ...gl({ borderRadius: 24, background: "rgba(11,94,255,0.88)" }), padding: 14, color: "#fff", display: "flex", flexDirection: "column", justifyContent: "space-between", cursor: "pointer" }}><RIcon name="camera" size={28} color="#fff" /><div><div style={hTitle(22, { letterSpacing: "-0.02em" })}>Add pieces</div><div style={{ fontSize: 13, opacity: 0.85 }}>Finding them is free</div></div></div>
            </div>
          </div>
        </div>
      )}
    </HShell>
  );
}

// 4d — Capture first. One giant action; the closet waits in a drawer you pull up.
function HomeCapture() {
  const [mode, setMode] = React.useState("flat");
  const [open, setOpen] = React.useState(false);
  return (
    <HShell blobs={false} bg="#EEF2F9">
      {(say) => (
        <div style={{ position: "relative", height: "100%", minHeight: 820 }}>
          {hBlob("#0B5EFF", "60px", "170px", 300, 0.18)}
          <div style={{ position: "relative", padding: "64px 22px 0" }}>
            <div style={hEyebrow}>Thursday, Nov 5 · 213 credits</div>
            <div style={hTitle(52, { marginTop: 8 })}>What did you<br />bring home?</div>
          </div>
          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", marginTop: 34 }}>
            <button onClick={() => say(mode === "flat" ? "Camera · flat lay" : "Camera · worn")} aria-label="Take photo" style={{ ...gl({ borderRadius: 999, background: "rgba(255,255,255,0.55)" }), width: 210, height: 210, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", animation: "rd-breathe 3s ease-in-out infinite" }}>
              <span style={{ width: 150, height: 150, borderRadius: 75, background: GL_TINT, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 20px 40px rgba(11,94,255,0.35)" }}><RIcon name="camera" size={58} color="#fff" /></span>
            </button>
            <div style={{ ...gl({ borderRadius: 999 }), display: "flex", padding: 4, marginTop: 24, position: "relative" }}>
              <span style={{ position: "absolute", top: 4, bottom: 4, width: "calc(50% - 4px)", left: mode === "flat" ? 4 : "50%", borderRadius: 999, background: "#131315", transition: "left 360ms cubic-bezier(.34,1.3,.64,1)" }} />
              {[["flat", "Laid flat"], ["worn", "Worn"]].map(([k, l]) => <button key={k} onClick={() => setMode(k)} style={{ position: "relative", width: 120, height: 38, border: 0, background: "none", font: `600 15px ${HF}`, color: mode === k ? "#fff" : "#131315", cursor: "pointer", transition: "color 300ms" }}>{l}</button>)}
            </div>
            <div style={{ fontSize: 14, color: "#6E6E73", marginTop: 12 }}>Finding pieces is free · 1 credit per piece</div>
            <span onClick={() => say("Photo library")} style={{ fontSize: 15, fontWeight: 600, color: GL_TINT, marginTop: 8, cursor: "pointer" }}>or choose from your photos</span>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: open ? 120 : 640, bottom: 0, ...gl({ borderRadius: "34px 34px 0 0", background: "rgba(255,255,255,0.82)" }), transition: "top 480ms cubic-bezier(.2,.8,.2,1)", padding: "10px 20px 0", zIndex: 5 }}>
            <div onClick={() => setOpen(!open)} style={{ cursor: "pointer" }}>
              <div style={{ width: 36, height: 5, borderRadius: 3, background: "rgba(60,60,67,0.3)", margin: "0 auto 12px" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={hTitle(24)}>Your closet</span>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 15, color: "#6E6E73" }}>32 pieces<RIcon name={open ? "chevron-down" : "chevron-up"} size={16} color="#6E6E73" /></span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, overflow: "hidden" }}>{RD_ITEMS.slice(0, 5).map((it) => <GImg key={it.id} item={it} radius={14} style={{ width: 62, height: 76, flexShrink: 0 }} />)}</div>
            {open ? <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 14, animation: "rd-rise 360ms cubic-bezier(.23,1,.32,1)" }}>{RD_ITEMS.map((it) => <GImg key={it.id} item={it} radius={14} style={{ aspectRatio: "4 / 5" }} />)}</div> : null}
          </div>
        </div>
      )}
    </HShell>
  );
}
Object.assign(window, { HomeStage, HomeGlance, HomeFeed, HomeCapture });

// Round 5 — 4b with a louder Add.
function GlanceBody({ say, variant }) {
  const colors = ["Blue", "Navy", "Gray", "White", "Black", "Brown"].map((c) => [c, RD_ITEMS.filter((x) => x.color === c)]).filter(([, l]) => l.length);
  const addHero = (
    <div style={{ ...gl({ borderRadius: 28, background: "rgba(11,94,255,0.9)", border: "0.5px solid rgba(255,255,255,0.4)" }), marginTop: 12, padding: 16, color: "#fff", position: "relative", overflow: "hidden" }}>
      <span aria-hidden="true" style={{ position: "absolute", right: -30, top: -30, width: 140, height: 140, borderRadius: 70, background: "rgba(255,255,255,0.14)" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 52, height: 52, borderRadius: 26, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, animation: "rd-breathe 3s ease-in-out infinite" }}><RIcon name="camera" size={26} color={GL_TINT} /></span>
        <div><div style={hTitle(26, { letterSpacing: "-0.02em" })}>Add clothes</div><div style={{ fontSize: 13, opacity: 0.88 }}>Finding pieces is free · 1 credit per piece</div></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
        {[["layers-outline", "Laid flat"], ["body-outline", "Worn"]].map(([ic, l]) => <button key={l} onClick={() => say("Camera · " + l)} style={{ height: 46, borderRadius: 14, border: 0, background: "rgba(255,255,255,0.2)", color: "#fff", font: `600 15px ${HF}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" }}><RIcon name={ic} size={18} color="#fff" />{l}</button>)}
      </div>
    </div>
  );
  return (
    <div style={{ position: "relative", padding: "60px 16px 150px" }}>
      <div style={{ padding: "0 4px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={hEyebrow}>Good evening, Roi</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}><span style={hTitle(76, { fontVariantNumeric: "tabular-nums" })}>32</span><span style={hTitle(28, { color: "#6E6E73" })}>pieces</span></div>
        </div>
        {variant === "c" ? <button onClick={() => say("Camera opens")} style={{ height: 44, padding: "0 16px 0 12px", borderRadius: 22, border: 0, background: GL_TINT, color: "#fff", font: `700 16px ${HF}`, display: "flex", alignItems: "center", gap: 4, marginBottom: 14, cursor: "pointer", boxShadow: "0 8px 18px rgba(11,94,255,0.3)" }}><RIcon name="add" size={22} color="#fff" />Add</button> : null}
      </div>
      {variant === "a" ? addHero : null}
      <div style={{ ...gl({ borderRadius: 24 }), padding: 14, marginTop: 12 }}>
        <div style={{ display: "flex", height: 16, borderRadius: 8, overflow: "hidden", gap: 2 }}>{colors.map(([c, l]) => <span key={c} style={{ flex: l.length, background: l[0].hex }} />)}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginTop: 10 }}>{colors.map(([c, l]) => <span key={c} style={{ fontSize: 13, color: "#3A3A3F", display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: l[0].hex, border: "1px solid rgba(0,0,0,0.1)" }} />{c}</span>)}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
        {[["Tops", 20, ["blue", "navy", "white"]], ["Outerwear", 1, ["fleece"]], ["Bottoms", 9, ["pants"]], ["Shoes", 2, ["sneaker", "sandals"]]].map(([g, n, ids]) => (
          <div key={g} onClick={() => say(g)} style={{ ...gl({ borderRadius: 24 }), height: 168, padding: 14, boxSizing: "border-box", position: "relative", overflow: "hidden", cursor: "pointer" }}>
            <div style={{ position: "absolute", right: -6, bottom: -10, display: "flex" }}>{ids.map((id, k) => <GImg key={id} item={rdById(id)} radius={16} style={{ width: 74, height: 92, marginLeft: k ? -36 : 0, transform: `rotate(${(k - (ids.length - 1) / 2) * 9}deg) translateY(${k * 4}px)`, boxShadow: "0 8px 16px rgba(0,0,0,0.12)", border: "2px solid #fff" }} />)}</div>
            <div style={hTitle(22)}>{g}</div>
            <div style={{ fontSize: 15, color: "#6E6E73", fontVariantNumeric: "tabular-nums" }}>{n}</div>
            {variant === "c" ? <span onClick={(e) => { e.stopPropagation(); say("Add to " + g); }} style={{ ...gl({ borderRadius: 16, background: "rgba(255,255,255,0.9)" }), position: "absolute", left: 12, bottom: 12, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}><RIcon name="add" size={18} color={GL_TINT} /></span> : null}
          </div>
        ))}
      </div>
      <div onClick={() => say("Build My Look")} style={{ ...gl({ borderRadius: 24 }), marginTop: 10, padding: 14, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
        <span style={{ width: 40, height: 40, borderRadius: 20, background: "rgba(11,94,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}><RIcon name="sparkles" size={20} color={GL_TINT} /></span>
        <div style={{ flex: 1 }}><div style={{ fontSize: 17, fontWeight: 700 }}>Build My Look</div><div style={{ fontSize: 13, color: "#6E6E73" }}>Outfit ideas from these 32 pieces</div></div>
        <RIcon name="chevron-forward" size={16} color="#6E6E73" />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "24px 4px 10px" }}><span style={hTitle(22)}>New this week</span><span style={{ fontSize: 15, color: "#6E6E73" }}>4</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        {variant === "c" ? <div onClick={() => say("Camera opens")} style={{ aspectRatio: "4 / 5", borderRadius: 14, border: `1.5px dashed ${GL_TINT}`, background: "rgba(11,94,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><RIcon name="add" size={24} color={GL_TINT} /></div> : null}
        {RD_ITEMS.slice(0, variant === "c" ? 3 : 4).map((it) => <GImg key={it.id} item={it} radius={14} style={{ aspectRatio: "4 / 5" }} />)}
      </div>
    </div>
  );
}

function TabsNoCam({ say, center }) {
  const t = [["home", "Home", "home"], ["closet", "Closet", "grid-outline"], center ? ["add", "", "add"] : null, ["looks", "Looks", "sparkles-outline"], ["me", "Me", "person-circle-outline"]].filter(Boolean);
  return (
    <div style={{ position: "absolute", left: 16, right: 16, bottom: 26, zIndex: 30, ...gl({ borderRadius: 999 }), height: 62, display: "flex", alignItems: "center", padding: "0 4px" }}>
      {t.map(([k, l, ic]) => k === "add" ? (
        <button key={k} onClick={() => say("Camera opens")} aria-label="Add clothes" style={{ flex: 1.2, border: 0, background: "none", cursor: "pointer", display: "flex", justifyContent: "center" }}>
          <span style={{ width: 72, height: 72, marginTop: -26, borderRadius: 36, background: GL_TINT, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 12px 26px rgba(11,94,255,0.4), 0 0 0 5px rgba(255,255,255,0.85)", animation: "rd-breathe 3s ease-in-out infinite" }}><RIcon name="camera" size={30} color="#fff" /></span>
        </button>
      ) : (
        <button key={k} onClick={() => say(l)} style={{ flex: 1, border: 0, background: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <RIcon name={ic} size={23} color={k === "home" ? GL_TINT : "#3A3A3F"} /><span style={{ fontSize: 10.5, fontWeight: 600, color: k === "home" ? GL_TINT : "#3A3A3F" }}>{l}</span>
        </button>
      ))}
    </div>
  );
}

function GlanceA() { return <HShell>{(say) => <GlanceBody say={say} variant="a" />}</HShell>; }
function GlanceB() {
  const [small, setSmall] = React.useState(false);
  return (
    <HShell onScroll={(e) => setSmall(e.currentTarget.scrollTop > 60)} tabs={(say) => (
      <>
        <button onClick={() => say("Camera opens")} style={{ position: "absolute", zIndex: 31, bottom: 104, right: small ? 20 : "50%", transform: small ? "none" : "translateX(50%)", height: 60, width: small ? 60 : 236, borderRadius: 30, border: 0, background: GL_TINT, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, overflow: "hidden", whiteSpace: "nowrap", cursor: "pointer", boxShadow: "0 14px 30px rgba(11,94,255,0.42)", transition: "all 420ms cubic-bezier(.34,1.3,.64,1)", font: `700 18px ${HF}` }}>
          <RIcon name="camera" size={26} color="#fff" />{small ? null : <span>Add clothes</span>}
        </button>
        <TabsNoCam say={say} />
      </>
    )}>{(say) => <GlanceBody say={say} variant="b" />}</HShell>
  );
}
function GlanceC() { return <HShell tabs={(say) => <TabsNoCam say={say} center />}>{(say) => <GlanceBody say={say} variant="c" />}</HShell>; }
Object.assign(window, { GlanceA, GlanceB, GlanceC });
