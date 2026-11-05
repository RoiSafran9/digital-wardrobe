function GlassApp() {
  const [onb, setOnb] = React.useState(() => localStorage.getItem("kips-glass-onb") !== "done");
  const [tab, setTab] = React.useState(() => localStorage.getItem("kips-glass-tab") || "home");
  const [group, setGroup] = React.useState("All");
  const [items, setItems] = React.useState(RD_ITEMS);
  const [credits, setCredits] = React.useState(213);
  const [item, setItem] = React.useState(null);
  const [cap, setCap] = React.useState(false);
  const [build, setBuild] = React.useState(false);
  const [toast, say] = useRToast();
  React.useEffect(() => { localStorage.setItem("kips-glass-tab", tab); }, [tab]);
  const openItem = (it, list = items) => setItem({ list, i: Math.max(0, list.indexOf(it)) });
  const added = (ids) => {
    const fresh = ids.map((id, k) => ({ ...rdById(id), id: `${id}-n${Date.now()}${k}`, isNew: true, added: "Nov 5" }));
    setItems((all) => [...fresh, ...all]); setCredits((c) => c - ids.length);
    setGroup("All"); setTab("closet"); say(`✓ ${ids.length} pieces added · ${ids.length} credits used`);
  };
  let screen;
  if (tab === "home") screen = <HomeFinal say={say} credits={credits} items={items} onAdd={() => setCap(true)} onBuild={() => setBuild(true)} openItem={(it) => openItem(it)} openGroup={(g) => { setGroup(g); setTab("closet"); }} />;
  else if (tab === "closet") screen = <GlassCloset group={group} setGroup={setGroup} items={items} openItem={openItem} />;
  else screen = <GlassMe credits={credits} say={say} onReplay={() => setOnb(true)} />;
  return (
    <IOSDevice>
      <div data-screen-label={onb ? "Onboarding" : tab} style={{ position: "relative", height: "100%", background: "#F2F2F6", fontFamily: "var(--font-system)", color: "#131315", overflow: "hidden" }}>
        <div key={tab} style={{ position: "absolute", inset: 0, overflowY: "auto", scrollbarWidth: "none", animation: "rd-fade 260ms" }}>{screen}</div>
        <TabsCenter tab={tab} setTab={(k) => (k === "looks" ? setBuild(true) : setTab(k))} onCamera={() => setCap(true)} />
        {item ? <GlassItem list={item.list} start={item.i} onClose={() => setItem(null)} say={say} /> : null}
        {build ? <GlassBuild items={items} say={say} onClose={() => setBuild(false)} /> : null}
        {cap ? <GlassCapture credits={credits} onClose={() => setCap(false)} onAdded={added} /> : null}
        {onb ? <GlassOnboarding onDone={() => { localStorage.setItem("kips-glass-onb", "done"); setOnb(false); setTab("home"); setTimeout(() => setCap(true), 400); }} /> : null}
        {toast()}
      </div>
    </IOSDevice>
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(<GlassApp />);
