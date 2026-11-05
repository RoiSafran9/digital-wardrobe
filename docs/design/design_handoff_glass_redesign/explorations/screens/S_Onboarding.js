// Onboarding, sign-in and First 3 Pieces.
const S_ONB = [];
const reg = (arr, flow) => (id, name, C) => arr.push({ flow, id, name, C });
const rOnb = reg(S_ONB, "Onboarding & sign-in");
const rFP = reg(S_ONB, "First 3 Pieces");

rOnb("0.1", "Welcome", () => (
  <Scr><Pad top={70}>
    <div style={{ position: "relative", height: 300 }}>
      {[["shirt-outline", 30, 30, -8], ["footsteps-outline", 220, 10, 7], ["bag-handle-outline", 120, 140, -3], ["glasses-outline", 250, 180, 10], ["shirt-outline", 10, 210, 5]].map(([ic, x, y, r], k) => <div key={k} style={{ position: "absolute", left: x, top: y, ...gl({ borderRadius: 24, background: "rgba(255,255,255,0.7)" }), width: 92, height: 112, display: "flex", alignItems: "center", justifyContent: "center", transform: `rotate(${r}deg)` }}><RIcon name={ic} size={40} color={SK.mute} /></div>)}
    </div>
    <div style={skT(42, { marginTop: 10 })}>Your closet, beautifully digital.</div>
    <div style={{ fontSize: 17, color: SK.mute, marginTop: 12 }}>Photograph what you own. KIPS turns each piece into a clean catalog image.</div>
    <div style={{ marginTop: 34, display: "flex", flexDirection: "column", gap: 6 }}><Btn>Get Started</Btn><Btn kind="text">I already have an account</Btn></div>
  </Pad></Scr>
));
const INTRO = [["camera-outline", "Snap any garment", "Lay it flat or hang it. We turn it into a clean catalog image."], ["body-outline", "Or import an outfit", "A photo of you wearing it works too. We find each piece."], ["grid-outline", "Browse what you own", "Search by color, filter by type, see the back and a 360° view."]];
INTRO.forEach(([ic, t, b], k) => rOnb(`0.${k + 2}`, `Intro ${k + 1} of 3`, () => (
  <Scr><Pad top={56}>
    <div style={{ display: "flex", justifyContent: "flex-end" }}><span style={{ fontSize: 17, color: SK.tint }}>Skip</span></div>
    <Card style={{ height: 380, marginTop: 20, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 34 }}>
      {k === 2 ? <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: 220 }}>{["blue", "sneaker", "navy", "pants"].map((id) => <GImg key={id} item={rdById(id)} radius={16} style={{ aspectRatio: "4 / 5" }} />)}</div>
        : <div style={{ width: 150, height: 150, borderRadius: 75, background: "rgba(11,94,255,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}><RIcon name={ic} size={70} color={SK.tint} /></div>}
    </Card>
    <div style={skT(34, { marginTop: 28 })}>{t}</div>
    <div style={{ fontSize: 17, color: SK.mute, marginTop: 8 }}>{b}</div>
    <div style={{ display: "flex", gap: 6, marginTop: 26 }}>{[0, 1, 2].map((d) => <span key={d} style={{ width: d === k ? 22 : 7, height: 7, borderRadius: 4, background: d === k ? SK.tint : "rgba(120,120,128,0.3)" }} />)}</div>
    <div style={{ marginTop: 26 }}><Btn>{k < 2 ? "Next" : "Continue"}</Btn></div>
  </Pad></Scr>
)));
rOnb("0.5", "Sign in with email", () => (
  <Scr><Pad top={64}>
    <div style={{ display: "flex", alignItems: "center", gap: 2, color: SK.tint, fontSize: 17 }}><RIcon name="chevron-back" size={20} color={SK.tint} />Back</div>
    <div style={skT(32, { marginTop: 18 })}>Sign in with email</div>
    <div style={{ fontSize: 15, color: SK.mute, margin: "6px 0 22px" }}>We'll send you a six-digit code. No password needed.</div>
    <div style={{ ...gl({ borderRadius: 14, background: "rgba(255,255,255,0.8)", border: `2px solid ${SK.tint}` }), height: 54, padding: "0 16px", display: "flex", alignItems: "center", fontSize: 17 }}>roi@example.com<span style={{ width: 2, height: 22, background: SK.tint, marginLeft: 1 }} /></div>
    <div style={{ marginTop: 18 }}><Btn>Continue</Btn></div>
    <div style={{ fontSize: 13, color: SK.mute, textAlign: "center", marginTop: 14 }}>By continuing you agree to the Terms and Privacy.</div>
  </Pad></Scr>
));
rOnb("0.6", "Check your inbox", () => (
  <Scr><Pad top={64}>
    <div style={{ display: "flex", alignItems: "center", gap: 2, color: SK.tint, fontSize: 17 }}><RIcon name="chevron-back" size={20} color={SK.tint} />Back</div>
    <div style={skT(32, { marginTop: 18 })}>Check your inbox</div>
    <div style={{ fontSize: 15, color: SK.mute, margin: "6px 0 22px" }}>Enter the code we sent to roi@example.com.</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 8 }}>{"4829".split("").concat(["", ""]).map((d, k) => <div key={k} style={{ ...gl({ borderRadius: 14, background: "rgba(255,255,255,0.8)", border: k === 4 ? `2px solid ${SK.tint}` : "0.5px solid rgba(255,255,255,0.8)" }), height: 58, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700 }}>{d}</div>)}</div>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, marginTop: 18 }}><span style={{ color: SK.mute }}>Resend code in 42s</span><span style={{ color: SK.tint }}>Use a different email</span></div>
  </Pad></Scr>
));
rOnb("0.7", "What should we call you?", () => (
  <Scr><Pad top={64}>
    <div style={skT(32, { marginTop: 46 })}>What should we call you?</div>
    <div style={{ fontSize: 15, color: SK.mute, margin: "6px 0 22px" }}>It's how KIPS greets you on Home.</div>
    <div style={{ ...gl({ borderRadius: 14, background: "rgba(255,255,255,0.8)", border: `2px solid ${SK.tint}` }), height: 54, padding: "0 16px", display: "flex", alignItems: "center", fontSize: 17 }}>Roi</div>
    <div style={{ marginTop: 18 }}><Btn>Continue</Btn></div>
  </Pad></Scr>
));
rOnb("0.8", "A welcome gift", () => (
  <Scr><Pad top={110} style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
    <div style={{ ...gl({ borderRadius: 999, background: "rgba(31,107,255,0.12)" }), width: 190, height: 190, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}><span style={skT(64, { color: SK.tint })}>40</span><span style={{ fontSize: 15, fontWeight: 600, color: SK.tint }}>AI credits</span></div>
    <div style={skT(36, { marginTop: 26 })}>A welcome gift, Roi</div>
    <div style={{ fontSize: 15, color: SK.mute, marginTop: 8 }}>Enough for about 40 garments.</div>
    <div style={{ display: "flex", gap: 8, marginTop: 18 }}>{[["Detection", "Free"], ["Front", "1"], ["Back", "1"], ["360°", "3"]].map(([l, v]) => <span key={l} style={{ ...gl({ borderRadius: 999 }), padding: "6px 10px", fontSize: 13 }}><b>{v}</b> {l}</span>)}</div>
    <div style={{ width: "100%", marginTop: 40, display: "flex", flexDirection: "column", gap: 6 }}><Btn>Add Your First 3 Pieces</Btn><Btn kind="text">Explore first</Btn></div>
  </Pad></Scr>
));

rFP("1.1", "Start", () => (
  <Scr><TopBar /><Pad top={10}>
    <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 10 }}>{[1, 2, 3].map((n) => <div key={n} style={{ position: "relative" }}><Glyph dashed w={96} h={120} /><span style={{ position: "absolute", top: 8, left: 8, width: 24, height: 24, borderRadius: 12, background: SK.tint, color: "#fff", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</span></div>)}</div>
    <div style={skT(34, { marginTop: 30 })}>Let's add your first 3 pieces</div>
    <div style={{ fontSize: 17, color: SK.mute, marginTop: 8 }}>It takes about a minute. Finding your clothes is free.</div>
    <Card style={{ marginTop: 28 }}>
      <div style={{ fontSize: 17, fontWeight: 700 }}>Are you near your wardrobe?</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}><Btn icon="camera">Yes, I'm near it</Btn><Btn kind="soft">Not right now</Btn></div>
    </Card>
  </Pad></Scr>
));
rFP("1.2", "Your photos", () => (
  <Scr><TopBar left="back" title="Your photos" /><Pad top={10}>
    <div style={skT(30)}>3 photos added</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 16 }}>
      {["blue", "pants", "sneaker"].map((id) => <div key={id} style={{ position: "relative" }}><GImg item={rdById(id)} radius={16} style={{ aspectRatio: "3 / 4" }} /><span style={{ ...gl({ borderRadius: 12 }), position: "absolute", top: 6, right: 6, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}><RIcon name="close" size={14} color={SK.ink} /></span></div>)}
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}><Btn kind="glass" icon="camera">Take Garment Photos</Btn><Btn kind="glass" icon="images-outline">Choose Garment Photos</Btn></div>
    <Card style={{ marginTop: 16, padding: 14 }}><div style={{ fontSize: 15, fontWeight: 700 }}>Tips</div><div style={{ fontSize: 14, color: SK.mute, marginTop: 4, lineHeight: 1.45 }}>Daylight, plain floor or bed, one or a few pieces per photo.</div></Card>
    <div style={{ marginTop: 44 }}><Btn>Find My Pieces</Btn><div style={{ fontSize: 13, color: SK.mute, textAlign: "center", marginTop: 8 }}>Finding them is free</div></div>
  </Pad></Scr>
));
rFP("1.3", "Pick", () => (
  <Scr><TopBar left="back" title="We found 4 pieces" /><Pad top={6}>
    <div style={{ fontSize: 15, color: SK.mute }}>3 of 5 selected</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
      {["blue", "pants", "sneaker", "fleece"].map((id, k) => { const sel = k < 3; return <div key={id} style={{ position: "relative" }}><GImg item={rdById(id)} radius={20} style={{ aspectRatio: "4 / 5", opacity: sel ? 1 : 0.45 }} /><span style={{ ...gl({ borderRadius: 15, background: sel ? SK.tint : "rgba(255,255,255,0.7)" }), position: "absolute", top: 8, right: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center" }}>{sel ? <RIcon name="checkmark" size={18} color="#fff" /> : null}</span></div>; })}
    </div>
    <div style={{ marginTop: 18, fontSize: 13, color: SK.mute, display: "flex", justifyContent: "space-between" }}><span>Front image × 3</span><span>3 credits · 40 available</span></div>
    <div style={{ marginTop: 10 }}><Btn>Create 3 Pieces · 3 credits</Btn></div>
  </Pad></Scr>
));
rFP("1.4", "Progress", () => (
  <Scr><TopBar left="down" /><Pad top={6}>
    <div style={skT(32)}>Creating your first pieces</div>
    <div style={{ fontSize: 15, color: SK.mute, marginTop: 6 }}>You can leave this screen. They'll appear in your closet.</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
      {[["blue", "Ready", 1], ["pants", "Laying it flat…", 0.6], ["sneaker", "Finding each garment…", 0.2]].map(([id, s, p]) => (
        <Card key={id} style={{ padding: 10, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ position: "relative", width: 56, height: 68, borderRadius: 14, overflow: "hidden" }}><GImg item={rdById(id)} radius={14} style={{ width: "100%", height: "100%", filter: p < 1 ? "blur(3px)" : "none" }} />{p < 1 ? <Shim /> : null}</div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 16, fontWeight: 600 }}>{rdById(id).name}</div><div style={{ fontSize: 13, color: p === 1 ? SK.ok : SK.mute }}>{s}</div><div style={{ height: 6, borderRadius: 3, background: "rgba(120,120,128,0.14)", marginTop: 6 }}><div style={{ width: `${p * 100}%`, height: 6, borderRadius: 3, background: p === 1 ? "#23A55A" : SK.tint }} /></div></div>
        </Card>
      ))}
    </div>
  </Pad></Scr>
));
rFP("1.5", "First-success popup", () => (
  <Scr tabs="closet" overlay={
    <Sheet>
      <div style={{ position: "relative", height: 150, display: "flex", justifyContent: "center" }}>{["pants", "blue", "sneaker"].map((id, k) => <GImg key={id} item={rdById(id)} radius={18} style={{ position: "absolute", width: 96, height: 118, top: 8, left: `calc(50% - 48px + ${(k - 1) * 70}px)`, transform: `rotate(${(k - 1) * 9}deg)`, border: "3px solid #fff", boxShadow: "0 12px 24px rgba(0,0,0,0.15)" }} />)}</div>
      <div style={skT(30, { textAlign: "center", marginTop: 10 })}>Your first pieces are in!</div>
      <div style={{ fontSize: 15, color: SK.mute, textAlign: "center", marginTop: 6, marginBottom: 18 }}>Your digital closet has officially started.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}><Btn>Explore My Closet</Btn><Btn kind="text">Add More</Btn></div>
    </Sheet>
  }><Pad><div style={skT(34)}>Closet</div></Pad></Scr>
));
window.S_ONB = S_ONB;
