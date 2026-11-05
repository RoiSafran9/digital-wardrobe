// Home, Closet, Add (garment flow) and Outfit flow.
const S_MAIN = [];
const rH = reg(S_MAIN, "Home");
const rC = reg(S_MAIN, "Closet");
const rA = reg(S_MAIN, "Add · garment photo");
const rO = reg(S_MAIN, "Add · outfit photo");
const noop = () => {};

rH("2.1", "Home", () => <Scr tabs="home"><HomeFinal say={noop} /></Scr>);
rH("2.2", "Home · creating pieces", () => (
  <Scr tabs="home"><HomeFinal say={noop} />
    <div style={{ position: "absolute", left: 16, right: 16, top: 54, zIndex: 5, ...gl({ borderRadius: 20, background: "rgba(255,255,255,0.86)" }), padding: 10, display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ position: "relative", width: 40, height: 48, borderRadius: 10, overflow: "hidden" }}><GImg item={rdById("navy")} radius={10} style={{ width: "100%", height: "100%", filter: "blur(2px)" }} /><Shim /></div>
      <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 700 }}>Creating your pieces…</div><div style={{ fontSize: 13, color: SK.mute }}>2 of 3 ready</div></div><Chev />
    </div>
  </Scr>
));
rH("2.3", "Home · empty closet", () => (
  <Scr tabs="home"><Pad top={56}>
    <div style={skEye}>Good evening, Roi</div>
    <div style={skT(40, { marginTop: 6 })}>Your closet starts here</div>
    <div style={{ display: "flex", gap: 8, marginTop: 18 }}>{["shirt-outline", "body-outline", "footsteps-outline"].map((ic, k) => <Glyph key={k} icon={ic} dashed w={108} h={120} />)}</div>
    <div style={{ ...gl({ borderRadius: 28, background: "rgba(11,94,255,0.9)" }), marginTop: 16, padding: 16, color: "#fff" }}>
      <div style={skT(24, { letterSpacing: "-0.02em" })}>Add your first 3 pieces</div>
      <div style={{ fontSize: 13, opacity: 0.88, marginTop: 2 }}>About a minute · finding them is free</div>
      <div style={{ height: 44, borderRadius: 14, background: "#fff", color: SK.tint, font: `700 15px ${HF}`, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 14 }}>Get Started</div>
    </div>
    <List style={{ marginTop: 14 }} rows={[["Garment photo", <span style={{ display: "flex", gap: 6 }}><Btn h={34} style={{ padding: "0 12px", fontSize: 13, borderRadius: 17 }}>Camera</Btn><Btn kind="soft" h={34} style={{ padding: "0 12px", fontSize: 13, borderRadius: 17 }}>Library</Btn></span>], ["Outfit photo", <Btn kind="soft" h={34} style={{ padding: "0 12px", fontSize: 13, borderRadius: 17 }}>Choose Photo</Btn>]]} />
  </Pad></Scr>
));
rC("3.1", "Closet", () => <Scr tabs="closet"><GlassCloset group="All" setGroup={noop} openItem={noop} /></Scr>);
rC("3.2", "Closet · empty", () => (
  <Scr tabs="closet"><Pad top={60}>
    <div style={skT(34)}>Closet</div><div style={{ fontSize: 15, color: SK.mute, marginTop: 2 }}>0 pieces</div>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginTop: 100 }}>
      <Glyph icon="shirt-outline" dashed w={120} h={150} />
      <div style={skT(26, { marginTop: 22 })}>Your closet is empty</div>
      <div style={{ fontSize: 17, color: SK.mute, marginTop: 6, maxWidth: 300 }}>Photograph a piece and it'll land here as a clean catalog image.</div>
      <div style={{ marginTop: 22, width: 220 }}><Btn icon="camera">Add Clothes</Btn></div>
    </div>
  </Pad></Scr>
));
rC("3.3", "Closet · no matches", () => (
  <Scr tabs="closet"><Pad top={60}>
    <div style={skT(34)}>Closet</div>
    <div style={{ ...gl({ borderRadius: 14 }), display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 12px", marginTop: 12 }}><RIcon name="search" size={16} color={SK.mute} /><span style={{ fontSize: 17 }}>yellow dress</span></div>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginTop: 120 }}>
      <RIcon name="search" size={40} color="#A1A1A6" />
      <div style={skT(26, { marginTop: 16 })}>No matches</div>
      <div style={{ fontSize: 17, color: SK.mute, marginTop: 6 }}>Nothing in your closet fits these filters.</div>
      <div style={{ marginTop: 20, width: 200 }}><Btn kind="glass" h={48}>Clear Filters</Btn></div>
    </div>
  </Pad></Scr>
));

const camView = (label, inner, dark = true) => (
  <Scr dark bg="#000" blobs={false}><TopBar dark title={label} />
    <div style={{ position: "absolute", top: 106, left: 12, right: 12, bottom: 206, borderRadius: 28, overflow: "hidden", background: "#1C1C1E" }}>{inner}
      {["0,0", "1,0", "0,1", "1,1"].map((c) => { const [x, y] = c.split(","); return <span key={c} style={{ position: "absolute", width: 26, height: 26, [x === "0" ? "left" : "right"]: 14, [y === "0" ? "top" : "bottom"]: 14, borderStyle: "solid", borderColor: "rgba(255,255,255,0.8)", borderWidth: `${y === "0" ? 3 : 0}px ${x === "1" ? 3 : 0}px ${y === "1" ? 3 : 0}px ${x === "0" ? 3 : 0}px`, borderRadius: 6 }} />; })}
    </div>
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 34, height: 170, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
      <div style={{ display: "flex", background: "rgba(255,255,255,0.14)", borderRadius: 999, padding: 3 }}>{["Garments", "Outfit"].map((l, k) => <span key={l} style={{ borderRadius: 999, padding: "7px 16px", background: k === 0 ? "#fff" : "transparent", color: k === 0 ? "#000" : "#fff", font: `600 14px ${HF}` }}>{l}</span>)}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 46 }}><span style={{ width: 44, height: 44, borderRadius: 12, border: "1.5px solid rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}><RIcon name="images-outline" size={20} color="#fff" /></span><span style={{ width: 76, height: 76, borderRadius: 38, border: "4px solid #fff", padding: 4, boxSizing: "border-box" }}><span style={{ display: "block", width: "100%", height: "100%", borderRadius: 34, background: "#fff" }} /></span><span style={{ width: 44 }} /></div>
    </div>
  </Scr>
);
const laid = <div style={{ position: "absolute", inset: 18, display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 10 }}><GImg item={rdById("blue")} radius={14} style={{ height: "100%" }} /><div style={{ display: "grid", gap: 10 }}>{["pants", "sneaker"].map((id) => <GImg key={id} item={rdById(id)} radius={14} style={{ height: "100%" }} />)}</div></div>;
rA("4.1", "Camera", () => camView("", <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 20 }}><span style={{ background: "rgba(0,0,0,0.5)", color: "#fff", borderRadius: 999, padding: "7px 14px", fontSize: 14 }}>Lay pieces flat · shoot from above</span></div>));
rA("4.2", "Preview · free scan", () => camView("Finding the pieces…", <>{laid}<div style={{ position: "absolute", left: 0, right: 0, top: "40%", height: 90, background: "linear-gradient(180deg, transparent, rgba(11,94,255,0.45), transparent)" }} /></>));
rA("4.3", "Preview · pieces found", () => (
  <Scr><TopBar left="back" title="3 garments found" /><Pad top={6}>
    <div style={{ position: "relative", height: 300, borderRadius: 26, overflow: "hidden", background: "#1C1C1E" }}>{laid}
      {[[6, 7, 52, 86, 1], [61, 7, 34, 41, 2], [61, 52, 34, 41, 3]].map(([x, y, w, h, n]) => <span key={n} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`, border: `2px solid ${SK.tint}`, borderRadius: 12, boxSizing: "border-box" }}><span style={{ position: "absolute", top: -9, left: -9, width: 22, height: 22, borderRadius: 11, background: SK.tint, color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</span></span>)}
    </div>
    <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>{["1 · T-shirt", "2 · Pants", "3 · Sneakers"].map((c) => <span key={c} style={{ ...gl({ borderRadius: 999 }), padding: "7px 12px", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>{c}<RIcon name="close" size={12} color={SK.mute} /></span>)}</div>
    <List style={{ marginTop: 14 }} rows={[["Front catalog image × 3", "3 credits"], ["Balance after", "210"]]} />
    <div style={{ marginTop: 14 }}><Btn>Generate 3 Items · 3 credits</Btn></div>
  </Pad></Scr>
));
rA("4.4", "Processing", () => (
  <Scr><TopBar left="down" /><Pad top={6}>
    <div style={{ position: "relative", height: 300, borderRadius: 28, overflow: "hidden" }}><div style={{ position: "absolute", inset: 0, filter: "blur(6px)", background: "#1C1C1E" }}>{laid}</div><Shim /><span style={{ ...gl({ borderRadius: 999 }), position: "absolute", top: 12, left: 12, padding: "6px 12px", fontSize: 13, fontWeight: 700 }}>2 of 3</span></div>
    <div style={skT(28, { marginTop: 18 })}>Laying them flat</div>
    <div style={{ height: 8, borderRadius: 4, background: "rgba(120,120,128,0.14)", marginTop: 12 }}><div style={{ width: "68%", height: 8, borderRadius: 4, background: SK.tint }} /></div>
    <Card style={{ marginTop: 16, padding: "6px 16px" }}>
      {[["Finding each garment", 2], ["Separating the pieces", 2], ["Laying them flat", 1], ["Adding final details", 0]].map(([l, s], n) => <div key={l} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: n ? `0.5px solid ${SK.sep}` : 0, fontSize: 16, color: s ? SK.ink : SK.mute }}>{s === 2 ? <RIcon name="checkmark-circle" size={20} color="#23A55A" /> : s === 1 ? <Spin c={SK.tint} s={18} /> : <span style={{ width: 18, height: 18, borderRadius: 9, border: "1.5px solid #C7C7CC" }} />}{l}</div>)}
    </Card>
    <div style={{ fontSize: 13, color: SK.mute, textAlign: "center", marginTop: 14 }}>You can leave this screen — your pieces will appear in your closet.</div>
  </Pad></Scr>
));
rA("4.5", "Generation paused", () => (
  <Scr><TopBar left="down" /><Pad top={6}>
    <div style={{ position: "relative", height: 300, borderRadius: 28, overflow: "hidden", background: "#1C1C1E" }}><div style={{ position: "absolute", inset: 0, filter: "grayscale(1)", opacity: 0.4 }}>{laid}</div><span style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 56, height: 56, borderRadius: 28, background: SK.red, display: "flex", alignItems: "center", justifyContent: "center" }}><RIcon name="alert" size={30} color="#fff" /></span></div>
    <div style={skT(28, { marginTop: 18 })}>Generation paused</div>
    <div style={{ fontSize: 15, color: SK.mute, marginTop: 6, lineHeight: 1.45 }}>The photo is too dark to see the edges. Try again in daylight. Credits for unfinished items were returned to your balance.</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 22 }}><Btn>Try Again</Btn><Btn kind="text">Back to Preview</Btn></div>
  </Pad></Scr>
));
rA("4.6", "Results", () => (
  <Scr><TopBar left="down" /><Pad top={6}>
    <div style={{ fontSize: 13, fontWeight: 700, color: SK.ok, letterSpacing: "0.6px" }}>✓ READY</div>
    <div style={skT(30, { marginTop: 4 })}>3 pieces created</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
      {[["blue", "high"], ["pants", "high"], ["sneaker", "medium"]].map(([id, t], k) => <div key={id}><div style={{ position: "relative" }}><GImg item={rdById(id)} radius={20} style={{ aspectRatio: "4 / 5", opacity: k === 2 ? 0.4 : 1 }} /><span style={{ ...gl({ borderRadius: 15, background: k === 2 ? "rgba(255,255,255,0.7)" : SK.tint }), position: "absolute", top: 8, right: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center" }}>{k === 2 ? null : <RIcon name="checkmark" size={18} color="#fff" />}</span></div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}><span style={{ fontSize: 15, fontWeight: 600 }}>{rdById(id).name}</span><span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: t === "high" ? "#E3EBDD" : "#F3E8CF", color: t === "high" ? "#3B5530" : "#7A5A12" }}>{t === "high" ? "Great" : "OK"}</span></div></div>)}
    </div>
    <div style={{ marginTop: 14 }}><Btn>Add 2 to Closet</Btn><div style={{ fontSize: 13, color: SK.mute, textAlign: "center", marginTop: 8 }}>Credits for removed pieces are not returned.</div></div>
  </Pad></Scr>
));
rA("4.7", "Added to your closet", () => (
  <Scr><Pad top={130} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
    <div style={{ position: "relative", width: 260, height: 190 }}>{["pants", "blue", "sneaker"].map((id, k) => <GImg key={id} item={rdById(id)} radius={20} style={{ position: "absolute", width: 112, height: 138, top: 20, left: 74 + (k - 1) * 70, transform: `rotate(${(k - 1) * 9}deg)`, border: "3px solid #fff", boxShadow: "0 14px 28px rgba(0,0,0,0.15)" }} />)}<span style={{ position: "absolute", left: "50%", bottom: 0, transform: "translateX(-50%)", width: 46, height: 46, borderRadius: 23, background: "#23A55A", display: "flex", alignItems: "center", justifyContent: "center", border: "3px solid #fff" }}><RIcon name="checkmark" size={24} color="#fff" /></span></div>
    <div style={skT(36, { marginTop: 24 })}>Added to your closet</div>
    <div style={{ fontSize: 15, color: SK.mute, marginTop: 6 }}>3 new pieces · 3 credits used</div>
    <div style={{ width: "100%", marginTop: 40, display: "flex", flexDirection: "column", gap: 6 }}><Btn>View Closet</Btn><Btn kind="text">Add More Clothes</Btn></div>
  </Pad></Scr>
));

rO("5.1", "Detecting", () => (
  <Scr><TopBar left="back" title="Finding garments…" /><Pad top={6}>
    <div style={{ position: "relative" }}><Person h={520} boxes={[[30, 18, 40, 28, 1, true]]} /><div style={{ position: "absolute", left: 0, right: 0, top: "46%", height: 90, background: "linear-gradient(180deg, transparent, rgba(11,94,255,0.45), transparent)" }} /><span style={{ ...gl({ borderRadius: 999 }), position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", padding: "6px 12px", fontSize: 13, fontWeight: 700 }}>Detection is free</span></div>
  </Pad></Scr>
));
rO("5.2", "Select garments", () => (
  <Scr><TopBar left="back" title="Select garments" /><Pad top={6}>
    <Person h={280} boxes={[[30, 14, 40, 30, 1, true], [32, 46, 36, 36, 2, true], [30, 84, 40, 12, 3, false]]} />
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
      {[["blue", "T-shirt", "Tops · Clear match", true], ["pants", "Trousers", "Bottoms · Clear match", true], ["sneaker", "Sneakers", "Not sure — please check", false]].map(([id, t, s, sel]) => <Card key={id} style={{ padding: 8, display: "flex", alignItems: "center", gap: 10 }}><GImg item={rdById(id)} radius={12} style={{ width: 52, height: 62 }} /><div style={{ flex: 1 }}><div style={{ fontSize: 16, fontWeight: 600 }}>{t}</div><div style={{ fontSize: 13, color: sel ? SK.mute : SK.warnT }}>{s}</div></div><span style={{ fontSize: 15, color: SK.tint, marginRight: 6 }}>Edit</span><span style={{ width: 26, height: 26, borderRadius: 13, background: sel ? SK.tint : "transparent", border: sel ? 0 : "1.5px solid #C7C7CC", display: "flex", alignItems: "center", justifyContent: "center" }}>{sel ? <RIcon name="checkmark" size={15} color="#fff" /> : null}</span></Card>)}
    </div>
    <div style={{ fontSize: 15, color: SK.tint, marginTop: 10 }}>+ Mark a missed garment</div>
  </Pad>
  <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, ...gl({ borderRadius: 0, background: "rgba(255,255,255,0.86)" }), padding: "12px 20px 30px", display: "flex", alignItems: "center", gap: 12 }}><div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 700 }}>2 selected</div><div style={{ fontSize: 13, color: SK.mute }}>2 credits · 213 available</div></div><Btn h={48} style={{ padding: "0 22px" }}>Generate</Btn></div>
  </Scr>
));
rO("5.3", "Review 1 of 2", () => (
  <Scr><TopBar left="back" title="Review 1 of 2" right={<span style={{ fontSize: 17, color: SK.tint }}>Later</span>} /><Pad top={6}>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 10 }}><div><div style={{ ...skEye, fontSize: 11, marginBottom: 6 }}>Your photo</div><div style={{ height: 250, borderRadius: 20, background: "#2A2A2E", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}><RIcon name="body" size={220} color="#4A4A50" /></div></div><div><div style={{ ...skEye, fontSize: 11, marginBottom: 6 }}>Catalog image</div><GImg item={rdById("blue")} radius={20} style={{ height: 250 }} /></div></div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}><span style={skT(26)}>Blue t-shirt</span><span style={{ padding: "3px 10px", borderRadius: 999, background: "#E3EBDD", color: "#3B5530", fontSize: 13, fontWeight: 600 }}>Great</span></div>
    <List style={{ marginTop: 14 }} rows={[["Keep", <span style={{ width: 51, height: 31, borderRadius: 16, background: "#34C759", position: "relative" }}><span style={{ position: "absolute", top: 2, left: 22, width: 27, height: 27, borderRadius: 14, background: "#fff" }} /></span>], ["↻ Regenerate", "1 credit", SK.tint]]} />
    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>{["blue", "pants"].map((id, k) => <GImg key={id} item={rdById(id)} radius={12} style={{ width: 48, height: 58, outline: k === 0 ? `2px solid ${SK.tint}` : "none", outlineOffset: 2 }} />)}</div>
    <div style={{ display: "flex", gap: 8, marginTop: 14 }}><Btn kind="glass" style={{ flex: 1 }}>Back</Btn><Btn style={{ flex: 1 }}>Next</Btn></div>
  </Pad></Scr>
));
window.S_MAIN = S_MAIN;
