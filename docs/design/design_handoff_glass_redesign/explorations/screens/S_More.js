// Garment details, Account, Build My Look.
const S_MORE = [];
const rI = reg(S_MORE, "Garment details");
const rM = reg(S_MORE, "Me (Account)");
const rB = reg(S_MORE, "Build My Look");
const IT = () => rdById("gray");

function ItemS({ side = "front", stage, overlay, toast, item }) {
  const it = item || IT();
  return (
    <Scr blobs={false} overlay={<>{overlay}{toast ? <ToastPill>{toast}</ToastPill> : null}</>}>
      <div style={{ position: "relative", height: 480, background: "#F3F2EF", overflow: "hidden" }}>
        {stage || <img src={it.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0 }}><TopBar left="down" right={<span style={{ ...gl({ borderRadius: 999 }), height: 40, padding: "0 16px", display: "flex", alignItems: "center", font: `600 15px ${HF}`, color: SK.tint }}>Edit</span>} /></div>
        <span style={{ ...gl({ borderRadius: 999 }), position: "absolute", top: 62, left: "50%", transform: "translateX(-50%)", padding: "7px 12px", fontSize: 13, fontWeight: 600 }}>5 / 8</span>
        <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", ...gl({ borderRadius: 999 }), display: "flex", padding: 4 }}>{[["front", "Front"], ["back", "Back"], ["360", "360°"]].map(([k, l]) => <span key={k} style={{ borderRadius: 999, padding: "8px 18px", background: side === k ? "#fff" : "transparent", boxShadow: side === k ? "0 2px 8px rgba(0,0,0,0.12)" : "none", font: `${side === k ? 600 : 500} 15px ${HF}` }}>{l}</span>)}</div>
      </div>
      <Pad top={18}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={skT(28)}>{it.name}</span><span style={{ padding: "3px 10px", borderRadius: 999, background: "#F3E8CF", color: "#7A5A12", fontSize: 13, fontWeight: 600 }}>{it.tier}</span></div>
        <div style={{ fontSize: 15, color: SK.mute, marginTop: 4 }}>{`${it.group} · ${it.cat} · Added ${it.added}`}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>{[it.color, it.pattern, it.details, it.text ? `“${it.text}”` : null].filter(Boolean).map((c, k) => <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", borderRadius: 999, background: "#fff", fontSize: 15 }}>{k === 0 ? <span style={{ width: 12, height: 12, borderRadius: 6, background: it.hex, border: "1px solid rgba(0,0,0,0.1)" }} /> : null}{c}</span>)}</div>
        <List style={{ marginTop: 16 }} rows={[["Add back image", "1 credit"], ["Generate 360° view", "3 credits"], ["Remove from closet", "", SK.red]]} />
      </Pad>
    </Scr>
  );
}
const stageBox = (children) => <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>;

rI("6.1", "Front", () => <ItemS />);
rI("6.2", "Back · none yet", () => <ItemS side="back" stage={stageBox(<div style={{ position: "absolute", inset: "100px 36px 80px", borderRadius: 28, border: "1.5px dashed #C7C7CC", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, textAlign: "center", padding: 20 }}><RIcon name="camera-reverse-outline" size={30} color={SK.mute} /><span style={{ fontSize: 17, fontWeight: 600 }}>No back image yet</span><span style={{ fontSize: 13, color: SK.mute }}>Take a photo of the back and we'll create a matching catalog image.</span><Btn h={44} style={{ padding: "0 16px", marginTop: 4 }}>Add Back Image · 1 credit</Btn></div>)} />);
rI("6.3", "Back · creating", () => <ItemS side="back" stage={stageBox(<><Shim /><div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}><Spin /><span style={{ fontSize: 15, fontWeight: 600 }}>Creating back image…</span></div></>)} />);
rI("6.4", "360° · none yet", () => <ItemS side="360" stage={stageBox(<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "0 30px", textAlign: "center" }}><div style={{ display: "flex", gap: 6 }}>{[1, 0.7, 0.45, 0.25].map((o, k) => <GImg key={k} item={IT()} radius={12} style={{ width: 54, height: 66, opacity: o }} />)}</div><span style={{ fontSize: 17, fontWeight: 600 }}>See it from every angle</span><span style={{ fontSize: 13, color: SK.mute }}>Four AI views on an invisible body, about a minute. Labelled as AI.</span><Btn h={44} icon="sync-outline" style={{ padding: "0 16px" }}>Generate 360° · 3 credits</Btn></div>)} />);
rI("6.5", "360° · ready", () => <ItemS item={rdById("white")} side="360" toast="✓ 360° view ready · 3 credits used" stage={<><img src={rdById("white").img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", animation: "rd-turn 3.2s ease-in-out infinite" }} /><span style={{ ...gl({ borderRadius: 999 }), position: "absolute", bottom: 72, left: "50%", transform: "translateX(-50%)", padding: "5px 10px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>Front · Drag to rotate · AI view</span></>} />);
rI("6.6", "Cost sheet", () => <ItemS side="360" overlay={<Sheet title="Generate 360° view"><div style={{ fontSize: 15, color: SK.mute, marginBottom: 14 }}>Four AI views on an invisible body, about a minute. Labelled as AI.</div><Quote lines={[["360° view", "3 credits"]]} total="3 credits" before={213} after={210} /><Btn>Generate · 3 credits</Btn><Btn kind="text" h={44}>Cancel</Btn></Sheet>} />);
rI("6.7", "Not enough credits", () => <ItemS side="360" overlay={<Sheet><div style={{ display: "flex", alignItems: "baseline", gap: 6 }}><span style={skT(54)}>2</span><span style={{ fontSize: 17, color: SK.mute }}>/ 3 credits needed</span></div><div style={{ height: 8, borderRadius: 4, background: "rgba(120,120,128,0.14)", margin: "14px 0" }}><div style={{ width: "66%", height: 8, borderRadius: 4, background: SK.warn }} /></div><div style={{ fontSize: 22, fontWeight: 700 }}>Not enough credits</div><div style={{ fontSize: 15, color: SK.mute, margin: "6px 0 18px" }}>You have 2 credits left. Ask the app owner for more credits.</div><Btn>OK</Btn><Btn kind="text" h={44}>View Price List</Btn></Sheet>} />);
rI("6.8", "Remove from closet?", () => <ItemS overlay={<Sheet title="Remove from closet?"><div style={{ fontSize: 15, color: SK.mute, marginBottom: 18 }}>It leaves your closet. You can't undo this in the app. Credits used for its images are not returned.</div><Btn kind="danger" style={{ background: "rgba(214,30,36,0.10)" }}>Remove</Btn><Btn kind="text" h={44}>Cancel</Btn></Sheet>} />);
rI("6.9", "Edit", () => (
  <Scr blobs={false}><TopBar left={null} title="Editing" right={<span style={{ fontSize: 17, fontWeight: 600, color: SK.tint }}>Save</span>} /><Pad top={4}>
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}><GImg item={IT()} radius={16} style={{ width: 72, height: 88 }} /><div style={{ flex: 1 }}><div style={{ ...skEye, fontSize: 11 }}>Name</div><div style={{ ...gl({ borderRadius: 12, background: "#fff" }), height: 44, display: "flex", alignItems: "center", padding: "0 12px", marginTop: 4, fontSize: 17, color: "#A1A1A6" }}>Gray t-shirt</div></div></div>
    <div style={{ ...skEye, fontSize: 11, marginTop: 18 }}>Type</div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>{["T-shirt", "Shirt", "Sweater", "Hoodie", "Jacket"].map((c, k) => <span key={c} style={{ height: 34, padding: "0 14px", borderRadius: 17, display: "flex", alignItems: "center", background: k === 0 ? SK.ink : "rgba(120,120,128,0.12)", color: k === 0 ? "#fff" : SK.ink, fontSize: 15, fontWeight: 500 }}>{c}</span>)}</div>
    <div style={{ ...skEye, fontSize: 11, marginTop: 18 }}>Colors</div>
    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>{["black", "white", "gray", "navy", "blue", "red", "beige", "brown"].map((c) => <span key={c} style={{ width: 35, height: 35, borderRadius: 18, border: c === "gray" ? `1.5px solid ${SK.ink}` : "1.5px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}><span style={{ width: 28, height: 28, borderRadius: 14, background: `var(--swatch-${c})`, border: `1px solid ${SK.sep}` }} /></span>)}</div>
    <div style={{ ...skEye, fontSize: 11, marginTop: 18 }}>Pattern</div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>{["Solid", "Striped", "Graphic", "Plaid", "Floral"].map((c, k) => <span key={c} style={{ height: 34, padding: "0 14px", borderRadius: 17, display: "flex", alignItems: "center", background: k === 0 ? SK.ink : "rgba(120,120,128,0.12)", color: k === 0 ? "#fff" : SK.ink, fontSize: 15 }}>{c}</span>)}</div>
    <List style={{ marginTop: 18 }} rows={[["Details", "Crew neck collar"], ["Text", "“UNIQLO”"]]} />
    <Btn kind="text" style={{ marginTop: 10 }}>Cancel</Btn>
  </Pad></Scr>
));

rM("7.1", "Me", () => <Scr tabs="me"><GlassMe credits={213} say={noop} onReplay={noop} /></Scr>);
rM("7.2", "How AI Credits work", () => (
  <Scr tabs="me" overlay={<Sheet title="How AI Credits work">{[["Finding garments is free", "Detecting the pieces in a photo never uses credits."], ["You pay per image created", "A front image, a back image or a 360° view each have their own price. Failed attempts cost nothing."], ["You always see the cost first", "Every AI action shows its price and your balance before anything is made."]].map(([t, b], k) => <div key={t} style={{ display: "flex", gap: 12, marginBottom: 16 }}><span style={{ width: 26, height: 26, borderRadius: 13, background: "rgba(31,107,255,0.12)", color: SK.tint, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{k + 1}</span><div><div style={{ fontSize: 17, fontWeight: 600 }}>{t}</div><div style={{ fontSize: 15, color: SK.mute }}>{b}</div></div></div>)}<Btn>Got It</Btn></Sheet>}><GlassMe credits={213} say={noop} onReplay={noop} /></Scr>
));
rM("7.3", "Running low", () => (
  <Scr tabs="me"><Pad top={60}>
    <div style={skT(34)}>Me</div>
    <div style={{ ...skEye, marginTop: 24, padding: "0 16px 8px" }}>AI credits</div>
    <Card style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ position: "relative", width: 92, height: 92 }}><svg width="92" height="92" style={{ transform: "rotate(-90deg)" }}><circle cx="46" cy="46" r="40" fill="none" stroke="rgba(120,120,128,0.16)" strokeWidth="9" /><circle cx="46" cy="46" r="40" fill="none" stroke={SK.warn} strokeWidth="9" strokeLinecap="round" strokeDasharray={251} strokeDashoffset={251 * (1 - 2 / 40)} /></svg><span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700 }}>2</span></div>
      <div><div style={{ fontSize: 17, fontWeight: 600 }}>of 40 granted</div><div style={{ fontSize: 13, color: SK.warnT, marginTop: 4 }}>Running low. Ask the app owner for more credits.</div></div>
    </Card>
  </Pad></Scr>
));
const page = (title, sections) => () => (
  <Scr blobs={false}><TopBar left="back" title={title} /><Pad top={6}>
    {sections.map(([h, b]) => <div key={h} style={{ marginTop: 16 }}><div style={{ fontSize: 19, fontWeight: 700 }}>{h}</div><div style={{ fontSize: 15, color: "#3A3A3F", marginTop: 4, lineHeight: 1.5 }}>{b}</div></div>)}
  </Pad></Scr>
);
rM("7.4", "Help & Support", page("Help & Support", [["Garment photos", "Lay pieces flat on a bed or the floor, or hang them. Each piece becomes its own item; a pair of shoes counts as one."], ["Outfit photos", "A photo of someone wearing the clothes. We find each piece and you choose which to create."], ["Back and 360°", "Add a back image or a 360° view to any piece from its details."], ["Credits", "Finding garments is free. Each image you create has a price, shown before anything is made."], ["Editing", "Tap Edit on any piece to correct its name, type, colors, pattern, details or text."]]));
rM("7.5", "Privacy", page("Privacy", [["What is stored", "Your photos, the catalog images made from them, and the facts about each piece."], ["Who can see it", "Only you. Every wardrobe is private to its account."], ["AI processing", "Photos are sent to an AI model to find and recreate pieces. They aren't used to train it."], ["Removing and deleting", "Removed pieces leave your closet. Deleting your account removes your closet, photos and credits for good."]]));
rM("7.6", "Sign out?", () => <Scr tabs="me" overlay={<Sheet title="Sign out?"><div style={{ fontSize: 15, color: SK.mute, marginBottom: 18 }}>You'll need a new email code to sign back in.</div><Btn kind="danger" style={{ background: "rgba(214,30,36,0.10)" }}>Sign Out</Btn><Btn kind="text" h={44}>Cancel</Btn></Sheet>}><GlassMe credits={213} say={noop} onReplay={noop} /></Scr>);
rM("7.7", "Delete your account?", () => <Scr tabs="me" overlay={<Sheet title="Delete your account?"><div style={{ fontSize: 15, color: SK.mute, marginBottom: 18 }}>Your closet, photos and AI credits are removed for good. This can't be undone.</div><Btn kind="danger" style={{ background: "rgba(214,30,36,0.10)" }}>Delete Account</Btn><Btn kind="text" h={44}>Cancel</Btn></Sheet>}><GlassMe credits={213} say={noop} onReplay={noop} /></Scr>);

const bmlHead = (n, title, sel, opts) => () => (
  <Scr><TopBar left={n ? "back" : "close"} right={<span style={{ width: 40 }} />} title="" /><Pad top={10}>
    <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>{[0, 1, 2].map((k) => <span key={k} style={{ width: k === n ? 22 : 7, height: 7, borderRadius: 4, background: k <= n ? SK.tint : "rgba(120,120,128,0.3)" }} />)}</div>
    <div style={skEye}>{`Build My Look · ${n + 1} of 3`}</div>
    <div style={skT(32, { marginTop: 6 })}>{title}</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 22 }}>{opts.map(([l, ic]) => <div key={l} style={{ ...gl({ borderRadius: 20, background: l === sel ? SK.ink : "rgba(255,255,255,0.62)" }), height: 86, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}><RIcon name={ic} size={26} color={l === sel ? "#fff" : SK.ink} /><span style={{ fontSize: 15, fontWeight: 500, color: l === sel ? "#fff" : SK.ink }}>{l}</span></div>)}</div>
    <div style={{ marginTop: 250 }}><Btn>{n < 2 ? "Next" : "Build Looks"}</Btn><div style={{ textAlign: "center", fontSize: 13, color: SK.mute, marginTop: 10 }}>Made only from your 32 pieces</div></div>
  </Pad></Scr>
);
BL_Q.forEach((q, n) => rB(`8.${n + 1}`, q.title, bmlHead(n, q.title, ["Work", "Minimal", "Mild"][n], q.opts)));
rB("8.4", "Looks", () => (
  <Scr><TopBar title="" right={<span style={{ ...gl({ borderRadius: 999 }), padding: "7px 12px", fontSize: 13, fontWeight: 600 }}>Work · Minimal · Mild</span>} /><Pad top={10}>
    <div style={skT(30)}>4 looks for you</div>
    <div style={{ fontSize: 15, color: SK.mute, marginTop: 2 }}>Swipe right to save, left for the next one.</div>
    <div style={{ position: "relative", height: 360, marginTop: 14 }}>
      {[2, 1].map((k) => <div key={k} style={{ position: "absolute", inset: 0, transform: `translateY(${k * 12}px) scale(${1 - k * 0.05})`, background: "#fff", borderRadius: 30, boxShadow: "0 18px 40px rgba(0,0,0,0.08)" }} />)}
      <div style={{ position: "absolute", inset: 0, background: "#fff", borderRadius: 30, padding: 10, boxSizing: "border-box", display: "flex", flexDirection: "column", boxShadow: "0 18px 40px rgba(0,0,0,0.10)" }}><div style={{ flex: 1, position: "relative", minHeight: 0 }}><LookCollage look={RD_LOOKS[1]} radius={20} /></div><div style={{ padding: "12px 6px 4px", display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 19, fontWeight: 700 }}>Evening layers</span><span style={{ fontSize: 13, color: SK.mute }}>4 pieces</span></div></div>
    </div>
    <div style={{ ...skEye, marginTop: 28 }}>Tap a piece to swap it</div>
    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>{RD_LOOKS[1].items.map((id) => <div key={id} style={{ ...gl({ borderRadius: 16 }), padding: 4 }}><GImg item={rdById(id)} radius={12} style={{ width: 56, height: 66 }} /></div>)}</div>
  </Pad></Scr>
));
rB("8.5", "Swap a piece", () => (
  <Scr overlay={<Sheet><div style={{ fontSize: 22, fontWeight: 700 }}>Swap tops</div><div style={{ fontSize: 15, color: SK.mute, margin: "2px 0 14px" }}>4 in your closet</div><div style={{ display: "flex", gap: 10, overflow: "hidden" }}>{["navy", "blue", "gray", "white"].map((id, k) => <div key={id} style={{ flexShrink: 0, textAlign: "center" }}><GImg item={rdById(id)} radius={18} style={{ width: 96, height: 118, outline: k === 0 ? `2.5px solid ${SK.tint}` : "none", outlineOffset: 2 }} /><div style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>{rdById(id).name}</div></div>)}</div><Btn kind="text" h={44} style={{ marginTop: 8 }}>Keep this one</Btn></Sheet>}><Pad><div style={skT(30)}>4 looks for you</div></Pad></Scr>
));
window.S_MORE = S_MORE;
