// Onboarding in the Glass direction: welcome → email → code → name → welcome credits.
function ObFloat() {
  const tiles = [["shirt-outline", 30, 40, -8, 0], ["footsteps-outline", 220, 20, 7, 300], ["bag-handle-outline", 120, 150, -3, 600], ["glasses-outline", 260, 190, 10, 150], ["shirt-outline", 20, 230, 5, 450]];
  return (
    <div aria-hidden="true" style={{ position: "relative", height: 320 }}>
      {tiles.map(([ic, x, y, r, d], k) => (
        <div key={k} style={{ position: "absolute", left: x, top: y, animation: `rd-float 2.4s ease-in-out ${d}ms infinite alternate` }}>
          <div style={{ ...gl({ borderRadius: 24, background: "rgba(255,255,255,0.7)" }), width: 92, height: 112, display: "flex", alignItems: "center", justifyContent: "center", transform: `rotate(${r}deg)`, animation: `rd-pop 600ms cubic-bezier(.2,.8,.2,1) ${k * 120}ms both` }}>
            <RIcon name={ic} size={40} color="#6E6E73" />
          </div>
        </div>
      ))}
    </div>
  );
}

function GlassOnboarding({ onDone }) {
  const [step, setStep] = React.useState(0);
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [count, setCount] = React.useState(0);
  const codeRef = React.useRef(null);
  React.useEffect(() => { if (step === 2) setTimeout(() => codeRef.current && codeRef.current.focus(), 300); }, [step]);
  React.useEffect(() => { if (code.length === 6) setTimeout(() => setStep(3), 450); }, [code]);
  React.useEffect(() => {
    if (step !== 4) return;
    let v = 0; const t = setInterval(() => { v += 2; setCount(Math.min(40, v)); if (v >= 40) clearInterval(t); }, 28);
    return () => clearInterval(t);
  }, [step]);
  const btn = (label, on, ok = true) => <button disabled={!ok} onClick={on} style={{ width: "100%", height: 54, borderRadius: 16, border: 0, background: GL_TINT, color: "#fff", font: "600 17px var(--font-system)", cursor: ok ? "pointer" : "default", opacity: ok ? 1 : 0.4, transition: "opacity 200ms" }}>{label}</button>;
  const field = (v, set, ph, type = "text") => <input autoFocus value={v} onChange={(e) => set(e.target.value)} placeholder={ph} type={type} style={{ ...gl({ borderRadius: 14, background: "rgba(255,255,255,0.75)" }), width: "100%", height: 54, padding: "0 16px", boxSizing: "border-box", font: "17px var(--font-system)", outline: "none", color: "#131315" }} />;
  const back = <button onClick={() => setStep(step - 1)} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 2, border: 0, background: "none", padding: 0, color: GL_TINT, font: "17px var(--font-system)", cursor: "pointer" }}><RIcon name="chevron-back" size={20} color={GL_TINT} />Back</button>;
  const head = (t, s) => <><div style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.64px", marginTop: 18 }}>{t}</div><div style={{ fontSize: 15, color: "#6E6E73", marginTop: 6, marginBottom: 22 }}>{s}</div></>;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 90, background: "#F2F2F6", fontFamily: "var(--font-system)", color: "#131315", overflow: "hidden" }}>
      <div aria-hidden="true" style={{ position: "absolute", width: 360, height: 360, borderRadius: "50%", background: "#8FB0D6", opacity: 0.35, filter: "blur(80px)", top: -100, right: -140 }} />
      <div aria-hidden="true" style={{ position: "absolute", width: 300, height: 300, borderRadius: "50%", background: "#E8C9A8", opacity: 0.3, filter: "blur(80px)", top: 260, left: -140 }} />
      <div key={step} style={{ position: "absolute", inset: 0, padding: "64px 24px 40px", display: "flex", flexDirection: "column", animation: "rd-rise 420ms cubic-bezier(.23,1,.32,1)" }}>
        {step === 0 ? (
          <>
            <ObFloat />
            <div style={{ fontFamily: "var(--font-display)", fontSize: 42, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.04, marginTop: 10 }}>Your own clothes, beautifully catalogued.</div>
            <div style={{ fontSize: 17, color: "#6E6E73", marginTop: 12 }}>Photograph what you own. KIPS turns each piece into a clean catalog image.</div>
            <div style={{ flex: 1 }} />
            {btn("Continue with Email", () => setStep(1))}
            <div style={{ textAlign: "center", fontSize: 13, color: "#6E6E73", marginTop: 12 }}>Friends & family beta</div>
          </>
        ) : null}
        {step === 1 ? (
          <>
            {back}{head("Sign in with email", "We'll send you a 6-digit code. No password.")}
            {field(email, setEmail, "you@example.com", "email")}
            <div style={{ flex: 1 }} />
            {btn("Send Code", () => setStep(2), /.+@.+\..+/.test(email))}
          </>
        ) : null}
        {step === 2 ? (
          <>
            {back}{head("Enter the code", `Sent to ${email || "your email"}.`)}
            <div onClick={() => codeRef.current && codeRef.current.focus()} style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 8 }}>
              <input ref={codeRef} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" style={{ position: "absolute", inset: 0, opacity: 0 }} />
              {[0, 1, 2, 3, 4, 5].map((k) => (
                <div key={k} style={{ ...gl({ borderRadius: 14, background: "rgba(255,255,255,0.75)", border: k === code.length ? `2px solid ${GL_TINT}` : "0.5px solid rgba(255,255,255,0.8)" }), height: 58, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 600, transition: "border 150ms" }}>
                  {code[k] ? <span style={{ animation: "rd-pop 260ms cubic-bezier(.34,1.6,.64,1)" }}>{code[k]}</span> : null}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 13, color: "#6E6E73", marginTop: 14 }}>Demo: type any 6 digits. <span onClick={() => setCode("482913")} style={{ color: GL_TINT, cursor: "pointer" }}>Paste code</span></div>
          </>
        ) : null}
        {step === 3 ? (
          <>
            {head("What should we call you?", "It's how KIPS greets you on Home.")}
            {field(name, setName, "Your name")}
            <div style={{ flex: 1 }} />
            {btn("Continue", () => setStep(4), name.trim().length > 0)}
          </>
        ) : null}
        {step === 4 ? (
          <>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
              <div style={{ ...gl({ borderRadius: 999, background: "rgba(31,107,255,0.12)" }), width: 190, height: 190, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", animation: "rd-pop 700ms cubic-bezier(.34,1.5,.64,1)" }}>
                <span style={{ fontSize: 64, fontWeight: 700, color: GL_TINT, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{count}</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: GL_TINT, marginTop: 4 }}>AI credits</span>
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, marginTop: 28 }}>{`A welcome gift, ${name.trim() || "friend"}`}</div>
              <div style={{ fontSize: 15, color: "#6E6E73", marginTop: 10, maxWidth: 300 }}>Enough for about 40 pieces. Finding garments in a photo is always free.</div>
            </div>
            {btn("Add My First Pieces", () => onDone(name.trim()))}
          </>
        ) : null}
      </div>
    </div>
  );
}
window.GlassOnboarding = GlassOnboarding;
