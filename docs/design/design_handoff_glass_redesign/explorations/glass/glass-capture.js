// Add Clothes in the Glass direction: kind → camera → free scan → pick pieces → cost → making → added.
function GlassSheet({ children, onClose, floating = true }) {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => { requestAnimationFrame(() => setOn(true)); }, []);
  const close = () => { setOn(false); setTimeout(onClose, 300); };
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 70, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={close} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.32)", opacity: on ? 1 : 0, transition: "opacity 300ms" }} />
      <div style={{ ...gl({ borderRadius: floating ? 34 : "34px 34px 0 0", background: "rgba(255,255,255,0.86)" }), position: "relative", margin: floating ? "0 10px 10px" : 0, padding: "8px 20px 20px", transform: on ? "none" : "translateY(110%)", transition: "transform 380ms cubic-bezier(.2,.8,.2,1)" }}>
        <div style={{ width: 36, height: 5, borderRadius: 3, background: "rgba(60,60,67,0.3)", margin: "0 auto 14px" }} />
        {typeof children === "function" ? children(close) : children}
      </div>
    </div>
  );
}

const GC_FOUND = ["blue", "pants", "sneaker"];

function GlassCapture({ credits, onClose, onAdded }) {
  const [step, setStep] = React.useState("aim");
  const [mode, setMode] = React.useState("flat");
  const [picked, setPicked] = React.useState(GC_FOUND);
  const [cost, setCost] = React.useState(false);
  const [made, setMade] = React.useState(0);
  const [on, setOn] = React.useState(false);
  React.useEffect(() => { requestAnimationFrame(() => setOn(true)); }, []);
  const close = () => { setOn(false); setTimeout(onClose, 280); };
  const shoot = () => { setStep("flash"); setTimeout(() => setStep("scan"), 160); setTimeout(() => setStep("pick"), 1700); };
  React.useEffect(() => {
    if (step !== "making") return;
    setMade(0);
    const ts = picked.map((_, k) => setTimeout(() => setMade(k + 1), 900 + k * 800));
    const end = setTimeout(() => setStep("done"), 900 + picked.length * 800 + 300);
    return () => { ts.forEach(clearTimeout); clearTimeout(end); };
  }, [step]);
  const found = GC_FOUND.map(rdById);
  const n = picked.length;
  const dark = step === "aim" || step === "flash" || step === "scan";
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 80, background: dark ? "#000" : "#F2F2F6", color: dark ? "#fff" : "#131315", fontFamily: "var(--font-system)", opacity: on ? 1 : 0, transform: on ? "none" : "scale(1.04)", transition: "opacity 280ms, transform 380ms cubic-bezier(.2,.8,.2,1), background 400ms, color 400ms", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "58px 20px 12px" }}>
        <button onClick={close} aria-label="Close" style={{ ...(dark ? { background: "rgba(255,255,255,0.16)", border: 0 } : gl({ borderRadius: 18 })), width: 36, height: 36, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><RIcon name="close" size={20} color={dark ? "#fff" : "#131315"} /></button>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{{ aim: mode === "flat" ? "Clothes by themselves" : "Someone wearing them", flash: "", scan: "Finding pieces…", pick: "Pick what to add", making: "Creating catalog images", done: "Added to your closet" }[step]}</span>
        <span style={{ width: 36 }} />
      </div>

      {dark ? (
        <>
          <div style={{ position: "relative", flex: 1, margin: "0 12px", borderRadius: 28, overflow: "hidden", background: "#1C1C1E" }}>
            {step === "aim" ? (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, textAlign: "center", padding: 40 }}>
                <RIcon name={mode === "flat" ? "layers-outline" : "body-outline"} size={40} color="rgba(255,255,255,0.6)" />
                <span style={{ fontSize: 15, color: "rgba(255,255,255,0.75)" }}>{mode === "flat" ? "Lay pieces flat, shoot from above. Shoes from a low side angle." : "Frame the whole outfit, head to shoes."}</span>
              </div>
            ) : (
              <div style={{ position: "absolute", inset: 18, display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 10 }}>
                <GImg item={found[0]} radius={14} style={{ height: "100%" }} />
                <div style={{ display: "grid", gap: 10 }}>{found.slice(1).map((it) => <GImg key={it.id} item={it} radius={14} style={{ height: "100%" }} />)}</div>
              </div>
            )}
            {step === "scan" ? <div style={{ position: "absolute", left: 0, right: 0, height: 90, background: "linear-gradient(180deg, transparent, rgba(11,94,255,0.4), transparent)", animation: "rd-scan 1.4s ease-in-out" }} /> : null}
            {step === "flash" ? <div style={{ position: "absolute", inset: 0, background: "#fff" }} /> : null}
          </div>
          <div style={{ height: 196, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
            <div style={{ display: "flex", background: "rgba(255,255,255,0.14)", borderRadius: 999, padding: 3, opacity: step === "aim" ? 1 : 0.3 }}>
              {[["flat", "Flat lay"], ["worn", "Worn"]].map(([k, l]) => <button key={k} onClick={() => setMode(k)} style={{ border: 0, borderRadius: 999, padding: "7px 16px", cursor: "pointer", background: mode === k ? "#fff" : "transparent", color: mode === k ? "#000" : "#fff", font: "600 14px var(--font-system)", transition: "all 200ms" }}>{l}</button>)}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 46 }}>
              <button onClick={shoot} aria-label="Library" style={{ width: 44, height: 44, borderRadius: 12, border: "1.5px solid rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><RIcon name="images-outline" size={20} color="#fff" /></button>
              <button onClick={shoot} aria-label="Shutter" style={{ width: 76, height: 76, borderRadius: 38, border: "4px solid #fff", background: "transparent", padding: 4, cursor: "pointer" }}><span style={{ display: "block", width: "100%", height: "100%", borderRadius: 34, background: "#fff" }} /></button>
              <span style={{ width: 44, fontSize: 12, color: "rgba(255,255,255,0.7)", textAlign: "center" }}>Free scan</span>
            </div>
          </div>
        </>
      ) : null}

      {step === "pick" ? (
        <div style={{ flex: 1, padding: "8px 20px 0", display: "flex", flexDirection: "column", animation: "rd-fade 300ms" }}>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.6px" }}>3 pieces found</div>
          <div style={{ fontSize: 15, color: "#6E6E73", marginTop: 4 }}>Finding them was free. Choose which ones to create.</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 18 }}>
            {found.map((it, k) => {
              const sel = picked.includes(it.id);
              return (
                <div key={it.id} onClick={() => setPicked(sel ? picked.filter((x) => x !== it.id) : [...picked, it.id])} style={{ position: "relative", cursor: "pointer", animation: `rd-pop 420ms cubic-bezier(.2,.8,.2,1) ${k * 90}ms both` }}>
                  <GImg item={it} radius={22} style={{ aspectRatio: "4 / 5", opacity: sel ? 1 : 0.45, transition: "opacity 200ms", boxShadow: "0 10px 22px rgba(0,0,0,0.08)" }} />
                  <span style={{ ...gl({ borderRadius: 15, background: sel ? GL_TINT : "rgba(255,255,255,0.7)" }), position: "absolute", top: 10, right: 10, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 200ms" }}>{sel ? <RIcon name="checkmark" size={18} color="#fff" /> : null}</span>
                  <div style={{ fontSize: 15, fontWeight: 600, marginTop: 8 }}>{it.name}</div>
                  <div style={{ fontSize: 13, color: "#6E6E73" }}>{`${it.group} · ${it.color}`}</div>
                </div>
              );
            })}
            <div style={{ borderRadius: 22, border: "1.5px dashed #C7C7CC", aspectRatio: "4 / 5", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, color: "#6E6E73", fontSize: 15 }}><RIcon name="add" size={24} color="#6E6E73" />Mark a missed piece</div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ padding: "16px 0 34px" }}>
            <button disabled={!n} onClick={() => setCost(true)} style={{ width: "100%", height: 54, borderRadius: 16, border: 0, background: GL_TINT, color: "#fff", font: "600 17px var(--font-system)", cursor: "pointer", opacity: n ? 1 : 0.4 }}>{n ? `Create ${n} piece${n > 1 ? "s" : ""} · ${n} credit${n > 1 ? "s" : ""}` : "Pick at least one"}</button>
            <div style={{ textAlign: "center", fontSize: 13, color: "#6E6E73", marginTop: 10 }}>{`Balance: ${credits} credits`}</div>
          </div>
        </div>
      ) : null}

      {step === "making" || step === "done" ? (
        <div style={{ flex: 1, padding: "8px 20px 34px", display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.6px" }}>{step === "done" ? `${n} new piece${n > 1 ? "s" : ""}` : `${made} of ${n} ready`}</div>
          <div style={{ fontSize: 15, color: "#6E6E73", marginTop: 4 }}>{step === "done" ? "They're in your closet now." : "About 15–60 seconds a photo. You can leave this screen."}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 18 }}>
            {picked.map(rdById).map((it, k) => (
              <div key={it.id} style={{ position: "relative", borderRadius: 22, overflow: "hidden", aspectRatio: "4 / 5", background: "#F3F2EF", boxShadow: "0 10px 22px rgba(0,0,0,0.08)" }}>
                {k < made || step === "done" ? <GImg item={it} radius={22} style={{ position: "absolute", inset: 0, animation: "rd-pop 600ms cubic-bezier(.2,.8,.2,1)" }} /> : (
                  <><Shimmer /><div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ width: 20, height: 20, borderRadius: 10, border: "2px solid #6E6E73", borderRightColor: "transparent", animation: "kips-spin .8s linear infinite" }} /></div></>
                )}
              </div>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          {step === "done" ? <button onClick={() => { onAdded(picked); close(); }} style={{ width: "100%", height: 54, borderRadius: 16, border: 0, background: GL_TINT, color: "#fff", font: "600 17px var(--font-system)", cursor: "pointer", animation: "rd-pop 400ms" }}>See them in your closet</button> : null}
        </div>
      ) : null}

      {cost ? (
        <GlassSheet onClose={() => setCost(false)}>
          {(c) => (
            <>
              <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Create catalog images</div>
              <div style={{ background: "rgba(120,120,128,0.10)", borderRadius: 18, padding: "0 16px" }}>
                {[["Garment detection", "Free"], ["Front image × " + n, `${n} credit${n > 1 ? "s" : ""}`]].map(([l, v]) => <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", fontSize: 17 }}><span>{l}</span><span>{v}</span></div>)}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", fontSize: 17, fontWeight: 600, borderTop: "0.5px solid rgba(20,20,25,0.08)" }}><span>Total</span><span>{`${n} credit${n > 1 ? "s" : ""}`}</span></div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, margin: "12px 0 20px" }}><span style={{ color: "#6E6E73", fontVariantNumeric: "tabular-nums" }}>{`Balance ${credits} → ${credits - n}`}</span><span style={{ color: "#1B7F45" }}>Detection was free</span></div>
              <button onClick={() => { c(); setTimeout(() => setStep("making"), 300); }} style={{ width: "100%", height: 54, borderRadius: 16, border: 0, background: GL_TINT, color: "#fff", font: "600 17px var(--font-system)", cursor: "pointer" }}>{`Create · ${n} credit${n > 1 ? "s" : ""}`}</button>
              <button onClick={c} style={{ width: "100%", height: 44, border: 0, background: "none", color: GL_TINT, font: "600 17px var(--font-system)", cursor: "pointer", marginTop: 4 }}>Cancel</button>
            </>
          )}
        </GlassSheet>
      ) : null}
    </div>
  );
}

function Shimmer() {
  return <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden" }}><div style={{ position: "absolute", top: 0, bottom: 0, width: "60%", background: "rgba(255,255,255,0.5)", animation: "kips-shimmer 1.6s ease-in-out infinite" }} /></div>;
}
Object.assign(window, { GlassSheet, GlassCapture, Shimmer });
