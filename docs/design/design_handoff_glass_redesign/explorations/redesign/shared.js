// Shared data + interaction primitives for the redesign exploration.
const RG = (n) => `../../assets/garments/${n}.png`;
const RD_ITEMS = [
  { id: "blue", name: "Blue t-shirt", group: "Tops", cat: "T-shirt", color: "Blue", hex: "#8FB0D6", img: RG("blue-tshirt"), pattern: "Solid", details: "Crew neck", added: "Oct 22", tier: "Great" },
  { id: "navy", name: "Washed navy tee", group: "Tops", cat: "T-shirt", color: "Navy", hex: "#4C6A8D", img: RG("navy-graphic-tshirt"), pattern: "Graphic", details: "Chest print", added: "Oct 20", tier: "OK" },
  { id: "gray", name: "Gray t-shirt", group: "Tops", cat: "T-shirt", color: "Gray", hex: "#B5B5C8", img: RG("gray-tshirt-stage"), pattern: "Solid", details: "Crew neck collar", text: "UNIQLO", added: "Oct 20", tier: "OK" },
  { id: "white", name: "White t-shirt", group: "Tops", cat: "T-shirt", color: "White", hex: "#E9E7E1", img: RG("white-graphic-tshirt"), pattern: "Graphic", details: "Crew neck", text: "体育 90 EASTERN DIVISION", added: "Oct 16", tier: "OK", white: true },
  { id: "fleece", name: "Gray fleece", group: "Outerwear", cat: "Fleece", color: "Gray", hex: "#A3A5A2", img: RG("thumb-outerwear"), pattern: "Colorblock", details: "Half zip", added: "Oct 18", tier: "Great" },
  { id: "pants", name: "Black pants", group: "Bottoms", cat: "Trousers", color: "Black", hex: "#262522", img: RG("thumb-bottoms"), pattern: "Solid", details: "Straight leg", added: "Oct 18", tier: "Great" },
  { id: "sneaker", name: "Brown sneaker", group: "Shoes", cat: "Sneakers", color: "Brown", hex: "#6E5E47", img: RG("brown-sneaker"), pattern: "Striped", details: "Three stripes, gum sole", added: "Oct 19", tier: "Great" },
  { id: "sandals", name: "Gray sandals", group: "Shoes", cat: "Sandals", color: "Gray", hex: "#4E5664", img: RG("gray-sandals"), pattern: "Solid", details: "Two buckle straps", added: "Oct 21", tier: "Great" },
];
const rdById = (id) => RD_ITEMS.find((i) => i.id === id);
const RD_GROUPS = ["Tops", "Outerwear", "Bottoms", "Shoes"];
const RD_LOOKS = [
  { id: "l1", name: "Easy Thursday", why: "Light and simple", items: ["blue", "pants", "sneaker"] },
  { id: "l2", name: "Evening layers", why: "A layer for later", items: ["navy", "fleece", "pants", "sneaker"] },
  { id: "l3", name: "Weekend errands", why: "Graphic tee, open shoes", items: ["white", "pants", "sandals"] },
  { id: "l4", name: "Quiet gray", why: "Tonal, low effort", items: ["gray", "pants", "sneaker"] },
];

function rdMix(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * amt));
  return `rgb(${c.join(",")})`;
}

function RIcon({ name, size = 20, color = "currentColor", style }) {
  const url = `url(https://unpkg.com/ionicons@7.4.0/dist/svg/${name}.svg)`;
  return <span aria-hidden="true" style={{ display: "inline-block", flexShrink: 0, width: size, height: size, backgroundColor: color, WebkitMaskImage: url, maskImage: url, WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center", ...style }} />;
}

function GImg({ item, radius = 16, style, fit = "cover" }) {
  return (
    <div style={{ borderRadius: radius, overflow: "hidden", background: item.white ? "#fff" : "#F3F2EF", ...style }}>
      <img src={item.img} alt={item.name} draggable={false} style={{ width: "100%", height: "100%", objectFit: fit, display: "block", pointerEvents: "none" }} />
    </div>
  );
}

function LookCollage({ look, radius = 16, gap = 6 }) {
  const its = look.items.map(rdById);
  const rest = its.slice(1);
  return (
    <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "1.35fr 1fr", gridTemplateRows: "minmax(0,1fr)", gap }}>
      <GImg item={its[0]} radius={radius} style={{ height: "100%", minHeight: 0 }} />
      <div style={{ display: "grid", gridTemplateRows: `repeat(${rest.length},minmax(0,1fr))`, gap, minHeight: 0 }}>
        {rest.map((i) => <GImg key={i.id} item={i} radius={radius} style={{ height: "100%", minHeight: 0 }} />)}
      </div>
    </div>
  );
}

// Tinder-style deck of looks. Drag the top card or call swipe(±1) from the controls.
function SwipeDeck({ looks, height, renderCard, renderControls, onSwipe, onChange, threshold = 90 }) {
  const [idx, setIdx] = React.useState(0);
  const [d, setD] = React.useState({ x: 0, y: 0 });
  const [dragging, setDragging] = React.useState(false);
  const [fly, setFly] = React.useState(0);
  const st = React.useRef(null);
  const n = looks.length;
  const at = (k) => looks[(idx + k) % n];
  React.useEffect(() => { onChange && onChange(at(0)); }, [idx]);
  const swipe = (dir) => {
    if (fly) return;
    setDragging(false); setFly(dir);
    setTimeout(() => { onSwipe && onSwipe(at(0), dir); setIdx((i) => i + 1); setFly(0); setD({ x: 0, y: 0 }); }, 300);
  };
  const down = (e) => { st.current = { x: e.clientX, y: e.clientY }; setDragging(true); e.currentTarget.setPointerCapture(e.pointerId); };
  const move = (e) => { if (st.current) setD({ x: e.clientX - st.current.x, y: e.clientY - st.current.y }); };
  const up = () => { if (!st.current) return; st.current = null; if (Math.abs(d.x) > threshold) swipe(d.x > 0 ? 1 : -1); else { setDragging(false); setD({ x: 0, y: 0 }); } };
  const progress = fly || Math.max(-1, Math.min(1, d.x / threshold));
  const p = Math.abs(progress);
  return (
    <div>
      <div style={{ position: "relative", height }}>
        {[2, 1, 0].map((k) => {
          const look = at(k), top = k === 0, kk = Math.max(0, k - p);
          const tf = top
            ? fly ? `translate(${fly * 520}px, ${d.y * 0.3}px) rotate(${fly * 24}deg)` : `translate(${d.x}px, ${d.y * 0.3}px) rotate(${d.x / 16}deg)`
            : `translateY(${kk * 12}px) scale(${1 - kk * 0.05})`;
          return (
            <div key={idx + k} onPointerDown={top ? down : undefined} onPointerMove={top ? move : undefined} onPointerUp={top ? up : undefined} onPointerCancel={top ? up : undefined}
              style={{ position: "absolute", inset: 0, transform: tf, transformOrigin: "50% 90%", transition: top && dragging ? "none" : "transform 340ms cubic-bezier(.2,.8,.2,1)", zIndex: 10 - k, touchAction: "none", cursor: top ? "grab" : "default", userSelect: "none" }}>
              {renderCard(look, { top, like: top ? Math.max(0, progress) : 0, pass: top ? Math.max(0, -progress) : 0 })}
            </div>
          );
        })}
      </div>
      {renderControls ? renderControls(swipe, at(0)) : null}
    </div>
  );
}

// Horizontal swipe that leaves taps alone: captures only after 8px of sideways movement.
function useHSwipe(onNext, onPrev, th = 60) {
  const s = React.useRef(null);
  const dragged = React.useRef(false);
  const [dx, setDx] = React.useState(0);
  const bind = {
    onPointerDown: (e) => { s.current = { x: e.clientX, id: e.pointerId, cap: false }; dragged.current = false; },
    onPointerMove: (e) => {
      if (!s.current) return;
      const v = e.clientX - s.current.x;
      if (!s.current.cap && Math.abs(v) > 8) { s.current.cap = true; dragged.current = true; e.currentTarget.setPointerCapture(e.pointerId); }
      if (s.current.cap) setDx(v);
    },
    onPointerUp: () => { if (!s.current) return; const v = dx; s.current = null; setDx(0); if (v < -th) onNext(); else if (v > th) onPrev(); setTimeout(() => { dragged.current = false; }, 0); },
    onPointerCancel: () => { s.current = null; setDx(0); },
    style: { touchAction: "pan-y" },
  };
  return { dx, bind, dragged };
}

function useRToast() {
  const [m, setM] = React.useState(null);
  const last = React.useRef("");
  if (m) last.current = m;
  React.useEffect(() => { if (!m) return; const t = setTimeout(() => setM(null), 2200); return () => clearTimeout(t); }, [m]);
  const node = (style = {}) => (
    <div style={{ position: "absolute", top: 58, left: "50%", transform: `translate(-50%, ${m ? 0 : -12}px)`, opacity: m ? 1 : 0, transition: "all 300ms cubic-bezier(.23,1,.32,1)", zIndex: 95, background: "#131315", color: "#fff", borderRadius: 999, padding: "10px 16px", font: "600 14px var(--font-system)", whiteSpace: "nowrap", pointerEvents: "none", ...style }}>{last.current}</div>
  );
  return [node, setM];
}

// One-tap capture: dark camera, flat lay / worn switch, shutter → free scan → pieces found.
function CaptureOverlay({ onClose, onDone, accent = "#0B5EFF", radius = 28 }) {
  const [shown, setShown] = React.useState(false);
  const [mode, setMode] = React.useState("flat");
  const [stage, setStage] = React.useState("aim");
  React.useEffect(() => { requestAnimationFrame(() => setShown(true)); }, []);
  const close = () => { setShown(false); setTimeout(onClose, 280); };
  const shoot = () => { setStage("flash"); setTimeout(() => setStage("scan"), 160); setTimeout(() => setStage("found"), 1700); };
  const found = ["blue", "pants", "sneaker"].map(rdById);
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 80, background: "#000", color: "#fff", fontFamily: "var(--font-system)", opacity: shown ? 1 : 0, transform: shown ? "none" : "scale(1.04)", transition: "opacity 280ms, transform 380ms cubic-bezier(.2,.8,.2,1)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "58px 20px 12px" }}>
        <button onClick={close} style={{ width: 36, height: 36, borderRadius: 18, border: 0, background: "rgba(255,255,255,0.16)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><RIcon name="close" size={20} color="#fff" /></button>
        <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.8 }}>Finding pieces is free</span>
        <span style={{ width: 36 }} />
      </div>
      <div style={{ position: "relative", flex: 1, margin: "0 12px", borderRadius: radius, overflow: "hidden", background: "#1C1C1E" }}>
        {stage === "aim" ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 40, fontSize: 15, color: "rgba(255,255,255,0.7)" }}>
            {mode === "flat" ? "Lay pieces flat and shoot from above" : "Frame the whole outfit, head to shoes"}
          </div>
        ) : (
          <div style={{ position: "absolute", inset: 18, display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 10 }}>
            <GImg item={found[0]} radius={14} style={{ height: "100%", animation: stage === "found" ? "rd-pop 500ms cubic-bezier(.2,.8,.2,1) both" : undefined, outline: stage === "found" ? `2px solid ${accent}` : "none", outlineOffset: 3 }} />
            <div style={{ display: "grid", gap: 10 }}>
              {found.slice(1).map((it, i) => <GImg key={it.id} item={it} radius={14} style={{ height: "100%", animation: stage === "found" ? `rd-pop 500ms cubic-bezier(.2,.8,.2,1) ${120 * (i + 1)}ms both` : undefined, outline: stage === "found" ? `2px solid ${accent}` : "none", outlineOffset: 3 }} />)}
            </div>
          </div>
        )}
        {stage === "scan" ? <div style={{ position: "absolute", left: 0, right: 0, height: 90, background: `linear-gradient(180deg, transparent, ${accent}55, transparent)`, animation: "rd-scan 1.4s ease-in-out" }} /> : null}
        {stage === "flash" ? <div style={{ position: "absolute", inset: 0, background: "#fff" }} /> : null}
        {["0,0", "1,0", "0,1", "1,1"].map((c) => { const [x, y] = c.split(","); return <span key={c} style={{ position: "absolute", width: 26, height: 26, [x === "0" ? "left" : "right"]: 14, [y === "0" ? "top" : "bottom"]: 14, borderStyle: "solid", borderColor: "rgba(255,255,255,0.8)", borderWidth: `${y === "0" ? 3 : 0}px ${x === "1" ? 3 : 0}px ${y === "1" ? 3 : 0}px ${x === "0" ? 3 : 0}px`, borderRadius: 6 }} />; })}
      </div>
      <div style={{ height: 196, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
        {stage === "found" ? (
          <>
            <span style={{ fontSize: 17, fontWeight: 600 }}>3 pieces found</span>
            <button onClick={() => { onDone && onDone(); close(); }} style={{ height: 54, padding: "0 28px", borderRadius: 16, border: 0, background: accent, color: "#fff", font: "600 17px var(--font-system)", cursor: "pointer" }}>Create 3 pieces · 3 credits</button>
            <span onClick={() => setStage("aim")} style={{ fontSize: 15, opacity: 0.7, cursor: "pointer" }}>Retake</span>
          </>
        ) : (
          <>
            <div style={{ display: "flex", background: "rgba(255,255,255,0.14)", borderRadius: 999, padding: 3 }}>
              {[["flat", "Flat lay"], ["worn", "Worn"]].map(([k, l]) => <button key={k} onClick={() => setMode(k)} style={{ border: 0, borderRadius: 999, padding: "7px 16px", cursor: "pointer", background: mode === k ? "#fff" : "transparent", color: mode === k ? "#000" : "#fff", font: "600 14px var(--font-system)", transition: "all 200ms" }}>{l}</button>)}
            </div>
            <button onClick={shoot} aria-label="Shutter" style={{ width: 76, height: 76, borderRadius: 38, border: "4px solid #fff", background: "transparent", padding: 4, cursor: "pointer" }}><span style={{ display: "block", width: "100%", height: "100%", borderRadius: 34, background: "#fff" }} /></button>
          </>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { RD_ITEMS, RD_GROUPS, RD_LOOKS, rdById, rdMix, RIcon, GImg, LookCollage, SwipeDeck, useHSwipe, useRToast, CaptureOverlay });
