import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import "./PaftFlowchart.css";

/* ---------- data ---------- */
const R = {
  BRO: ["Branch Relationship Officer", "f"],
  BA: ["Branch Administrator", "f"],
  B: ["Branch Manager", "f"],
  CM: ["Cluster Manager", "f"],
  ZM: ["Zonal Manager", "f"],
  "BR STAFF": ["Branch Staff", "f"],
  M: ["MIS Dept", "m"],
  FI: ["Finance Dept", "n"],
  F: ["Federal Bank", "d"],
  C: ["Credit Dept", "c"],
  IA: ["Audit Dept", "c"],
};

const D4 = "Day 4 · depends on bank working day";
const DA = D4 + " and availability of customer and nominee";
const CD = "On collection days";
const LI = "Within 5 days after last installment";

// [number, title, roles, device ("tab" | "web" | ""), timeline]
const S = [
  [1, "Mandal village creation", ["M"], "web", "Based on expansion plan"],
  [2, "Village survey", ["BRO"], "tab", "Based on expansion plan"],
  [3, "Village survey authentication", ["M"], "web", "Based on expansion plan"],
  [4, "Enrollment", ["BRO"], "tab", "Day 1 · based on business target"],
  [5, "Data verification", ["C"], "web", "Day 2 · based on credit timeline"],
  [6, "House verification", ["B"], "tab", "Day 3 · starts once all prospects of a centre reach this stage"],
  [7, "Group recognition test", ["B"], "tab", "Day 3 · conducted after house verification"],
  [8, "Pre sanction", ["C"], "web", "Day 4 · based on credit timeline"],
  [9, "Sanction", ["F"], "web", DA],
  [10, "E-sign process and documentation", ["B", "BA"], "web", DA],
  [11, "Fund transfer request", ["M"], "web", D4],
  [12, "Fund transfer authentication", ["F"], "web", D4],
  [13, "Verification of documents and fund transfer", ["F"], "", D4],
  [14, "Loan utilisation check", ["B"], "", "After disbursement · within 25 days"],
  [15, "Collection demand generation", ["M"], "web", CD],
  [16, "Field / digital collection", ["BRO"], "", CD],
  [17, "Transfer of collection amount to Federal Bank", ["FI"], "", CD],
  [18, "Generation of demand collection balance (DCB)", ["M"], "", CD],
  [19, "Review as shown in Note 3", ["ZM"], "", "Based on Note 3"],
  [20, "Pre-close check · CI = MI-1", ["M"], "", LI],
  [21, "Member appraisal", ["BR STAFF"], "", LI],
  [22, "Not eligible members", [], "", "FOIR above 50% or credit terms violation · failed appraisal (indisciplined members) · outside age limit"],
  [23, "Review", ["BRO"], "", "Can also be taken at CI = MI-1 if possible"],
];

const PH = [
  ["Full flow", 1, 23],
  ["Village setup", 1, 7],
  ["Sanction", 8, 14],
  ["Collection", 15, 19],
  ["Review", 20, 23],
];

// grid position [column, row]; "x" is the Exit node
const POS = {
  1: [0, 0], 2: [0, 1], 3: [0, 2], 4: [0, 3], 5: [0, 4], 6: [0, 5], 7: [0, 6], 8: [0, 7],
  9: [2, 7], 10: [2, 6], 11: [2, 5], 12: [2, 4], 13: [2, 3], 14: [2, 2], 15: [2, 1],
  16: [3, 1], 17: [4, 1], 18: [4, 2], 19: [4, 3], 20: [4, 4], 21: [4, 5],
  22: [1, 4], 23: [1, 3], x: [1, 2],
};
const X = [30, 320, 610, 900, 1190];
const W = 250, H = 84, Y0 = 40, P = 120;
const WORLD_W = 1470, WORLD_H = 1020;
const HEX = new Set([4, 5, 6, 20, 22]);

const box = (id) => {
  if (id === "x") return { x: X[1] + 40, y: Y0 + 2 * P + 14, w: 170, h: 56 };
  const [c, r] = POS[id];
  return { x: X[c], y: Y0 + r * P, w: W, h: H };
};
const pt = (id, side) => {
  const b = box(id);
  return side === "T" ? [b.x + b.w / 2, b.y]
    : side === "B" ? [b.x + b.w / 2, b.y + b.h]
    : side === "L" ? [b.x, b.y + b.h / 2]
    : [b.x + b.w, b.y + b.h / 2];
};
const cy = (id) => { const b = box(id); return b.y + b.h / 2; };
const kindOf = (s) => (s[2].length ? R[s[2][0]][1] : "x");

// edges: type "" = normal, "p" = pass, "f" = fail, "c" = conditional (dashed)
const buildEdges = () => {
  const ed = [
    [1, "B", 2, "T"], [2, "B", 3, "T"], [3, "B", 4, "T"], [4, "B", 5, "T", "p"],
    [5, "B", 6, "T", "p"], [6, "B", 7, "T", "p"], [7, "B", 8, "T"], [8, "R", 9, "L"],
    [9, "T", 10, "B"], [10, "T", 11, "B"], [11, "T", 12, "B"], [12, "T", 13, "B"],
    [13, "T", 14, "B"], [14, "T", 15, "B"], [15, "R", 16, "L"], [16, "R", 17, "L"],
    [17, "B", 18, "T"], [18, "B", 19, "T"], [19, "B", 20, "T"], [20, "B", 21, "T", "p"],
    [22, "T", 23, "B"], [23, "L", 4, "R", "p"], [23, "T", "x", "B", "f"],
  ].map(([a, sa, b, sb, t]) => ({ a, b, t: t || "", pts: [pt(a, sa), pt(b, sb)] }));

  const r4 = box(4), r6 = box(6);
  const l22 = pt(22, "L")[0], y22 = cy(22), bus = 300;
  ed.push(
    { a: 4, b: 22, t: "f", pts: [[r4.x + W - 15, cy(4) + 20], [bus, cy(4) + 20], [bus, y22], [l22, y22]] },
    { a: 5, b: 22, t: "f", pts: [pt(5, "R"), [l22, y22]] },
    { a: 6, b: 22, t: "f", pts: [[r6.x + W - 15, cy(6) - 20], [bus, cy(6) - 20], [bus, y22], [l22, y22]] },
    { a: 20, b: 15, t: "f", pts: [pt(20, "L"), [1025, cy(20)], [1025, 262], [810, 262], [810, Y0 + P + H]] },
    { a: 21, b: 22, t: "c", pts: [pt(21, "B"), [X[4] + W / 2, 994], [X[1] + W / 2, 994], pt(22, "B")] }
  );
  return ed;
};
const EDGES = buildEdges();

const nameOf = (t) => (t === "x" ? "Exit" : `Step ${t} · ${S[t - 1][1]}`);

const NOTES = {
  "Reading the chart": [
    "MI = max installment, CI = current installment.",
    "A slash (/) means OR, a comma (,) means AND. CGT is compulsory group training.",
    "Pass moves to the next step, fail sends the member to step 22, conditional is a decision.",
  ],
  "Special cases": [
    "A client taking the next cycle loan goes directly to booking after steps 2, 3 and 4.",
    "Step 22 holds members with FOIR above 50% or a credit terms violation, members who failed appraisal (indisciplined), and members outside the age limit.",
    "Step 23 can also be taken at CI = MI-1 if possible.",
  ],
  "Operational review": [
    "Demand collection balance: repayment quality of loanees. Review at the end of every day.",
    "Sales: target achievement and the scope for monthly retention of existing and old loanees. Review at the end of the month.",
    "Cash management, death claims and quality: reviewed as per regulatory policies, at the end of the month.",
    "Efficiency enhancement: approved strategy and idea implementations in the field. Review in a timely manner.",
  ],
  Timeline: [
    ["1-3", "Based on expansion plan"],
    ["4", "Day 1 · based on business target"],
    ["5", "Day 2 · based on credit timeline"],
    ["6-7", "Day 3 · starts once all prospects of a centre reach house verification, then the test is conducted"],
    ["8", "Day 4 · based on credit timeline"],
    ["9-13", "Day 4 · depends on bank working day and availability of customer and nominee"],
    ["14", "After disbursement · within 25 days"],
    ["15-18", "On collection days"],
    ["19", "Based on Note 3"],
    ["20-21", "Within 5 days after last installment"],
  ],
  "Role codes": Object.entries(R).map(([c, [n]]) => [c, n]),
};

const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

/* ---------- small components ---------- */
const Chip = ({ code }) => (
  <i className={`chip k-${R[code][1]}`} title={R[code][0]}>{code}</i>
);

/* ---------- main component ---------- */
export default function PaftFlowchart() {
  const [ph, setPh] = useState(0);
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("Reading the chart");
  const [theme, setTheme] = useState(null); // null = follow system
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const [anim, setAnim] = useState(false);
  const [dragging, setDragging] = useState(false);

  const stageRef = useRef(null);
  const searchRef = useRef(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const drag = useRef(null);
  const moved = useRef(false);

  /* visibility of a node under current phase + search */
  const isOn = useCallback(
    (n) => {
      if (n === "x") return ph === 0 || ph === 4;
      const [, a, b] = PH[ph];
      const s = S[n - 1];
      const t = q.trim().toLowerCase();
      return (
        n >= a && n <= b &&
        (!t ||
          s[1].toLowerCase().includes(t) ||
          String(n) === t ||
          s[2].some((c) => c.toLowerCase() === t || R[c][0].toLowerCase().includes(t)))
      );
    },
    [ph, q]
  );

  const count = useMemo(() => S.filter((s) => isOn(s[0])).length, [isOn]);

  /* pan / zoom */
  const apply = (v, animate) => { setAnim(!!animate); setView(v); };

  const fit = useCallback(
    (animate = true, phase = ph) => {
      const st = stageRef.current;
      if (!st) return;
      const [, a, b] = PH[phase];
      const ids = Object.keys(POS).filter((k) =>
        k === "x" ? phase === 0 || phase === 4 : +k >= a && +k <= b
      );
      let x0 = 1e9, y0 = 1e9, x1 = 0, y1 = 0;
      ids.forEach((k) => {
        const o = box(k === "x" ? k : +k);
        x0 = Math.min(x0, o.x); y0 = Math.min(y0, o.y);
        x1 = Math.max(x1, o.x + o.w); y1 = Math.max(y1, o.y + o.h);
      });
      const pad = 36, cw = st.clientWidth, ch = st.clientHeight;
      const k = clamp(Math.min((cw - pad * 2) / (x1 - x0), (ch - pad * 2) / (y1 - y0)), 0.15, 1.2);
      apply({ k, x: (cw - (x1 - x0) * k) / 2 - x0 * k, y: (ch - (y1 - y0) * k) / 2 - y0 * k }, animate);
    },
    [ph]
  );

  const zoomAt = (px, py, f) => {
    const v = viewRef.current;
    const k = clamp(v.k * f, 0.15, 2.2);
    apply({ k, x: px - ((px - v.x) * k) / v.k, y: py - ((py - v.y) * k) / v.k }, true);
  };
  const zoomMid = (f) => {
    const st = stageRef.current;
    zoomAt(st.clientWidth / 2, st.clientHeight / 2, f);
  };

  // fit on mount, phase change and resize
  const firstFit = useRef(true);
  useEffect(() => {
    fit(!firstFit.current); // animate on phase change, snap on first load
    firstFit.current = false;
    const onResize = () => fit(false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fit]);

  // ctrl / cmd + wheel zoom (needs a non-passive listener)
  useEffect(() => {
    const st = stageRef.current;
    const onWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const r = st.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.1 : 1 / 1.1);
    };
    st.addEventListener("wheel", onWheel, { passive: false });
    return () => st.removeEventListener("wheel", onWheel);
  }, []);

  // drag to pan
  useEffect(() => {
    const move = (e) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) { moved.current = true; setDragging(true); }
      if (moved.current) apply({ ...viewRef.current, x: d.vx + dx, y: d.vy + dy }, false);
    };
    const up = () => { drag.current = null; setDragging(false); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  const onPointerDown = (e) => {
    if (e.target.closest(".pn")) return;
    const v = viewRef.current;
    drag.current = { x: e.clientX, y: e.clientY, vx: v.x, vy: v.y };
    moved.current = false;
  };

  /* selection */
  const pick = useCallback((n) => {
    setSel(n);
    const st = stageRef.current, v = viewRef.current, b = box(n);
    const pw = window.innerWidth > 700 ? 380 : 0;
    if (
      b.x * v.k + v.x < 0 ||
      (b.x + b.w) * v.k + v.x > st.clientWidth - pw ||
      b.y * v.k + v.y < 0 ||
      (b.y + b.h) * v.k + v.y > st.clientHeight
    ) {
      apply({
        k: v.k,
        x: (st.clientWidth - pw) / 2 - (b.x + b.w / 2) * v.k,
        y: st.clientHeight / 2 - (b.y + b.h / 2) * v.k,
      }, true);
    }
  }, []);

  const onNodeClick = (n) => {
    if (moved.current) { moved.current = false; return; }
    pick(n);
  };

  const reset = () => { setPh(0); setQ(""); setSel(null); fit(true, 0); };

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const inInput = e.target.tagName === "INPUT";
      if (e.key === "/" && !inInput) { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === "Escape") { if (inInput) e.target.blur(); setSel(null); }
      else if (!inInput && sel && e.key === "ArrowRight" && sel < 23) pick(sel + 1);
      else if (!inInput && sel && e.key === "ArrowLeft" && sel > 1) pick(sel - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel, pick]);

  const toggleTheme = () => {
    const dark = theme
      ? theme === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next = dark ? "light" : "dark";
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // no View Transitions support (or reduced motion): switch instantly
    if (!document.startViewTransition || reduce) { setTheme(next); return; }

    const root = document.documentElement;
    root.classList.add("pf-theming");
    const t = document.startViewTransition(() => flushSync(() => setTheme(next)));
    t.ready.then(() => {
      // new theme is revealed as a wipe moving from top to bottom
      root.animate(
        { clipPath: ["inset(0 0 100% 0)", "inset(0 0 0 0)"] },
        { duration: 900, easing: "cubic-bezier(.65, 0, .35, 1)", pseudoElement: "::view-transition-new(root)" }
      );
    });
    t.finished.finally(() => root.classList.remove("pf-theming"));
  };

  /* panel content */
  const s = sel ? S[sel - 1] : null;
  const panelKind = s ? kindOf(s) : "x";
  const outs = sel ? EDGES.filter((e) => e.a === sel) : [];
  const phaseName = sel ? PH.slice(1).find((p) => sel >= p[1] && sel <= p[2])[0] : "";

  const notesData = NOTES[tab];
  const isList = typeof notesData[0] === "string";

  return (
    <div className="pf" data-theme={theme || undefined}>
      <div className="wrap">
        <header className="top">
          <a className="brand" href="#top">
            <span className="logo">P</span>
            <span><b>PAFT BC</b><small>Growing together</small></span>
          </a>
          <div className="acts">
            <button className="t" onClick={toggleTheme} aria-label="Toggle theme">◐ Theme</button>
            <button className="t pri" onClick={() => window.print()}>Export PDF</button>
          </div>
        </header>

        <section className="hero" id="top">
          <div>
            <h1>Micro Finance <span>Activity Flowchart</span></h1>
            <p>
              The complete PAFT BC process, from village creation to member review. Select any
              step to see its role, timeline and where it leads.
            </p>
          </div>
          <div className="stats">
            <div className="stat"><b>23</b><span>Steps</span></div>
            <div className="stat"><b>4</b><span>Phases</span></div>
            <div className="stat"><b>11</b><span>Role codes</span></div>
          </div>
        </section>

        <div className="bar">
          <div className="seg" role="group" aria-label="Filter by phase">
            {PH.map((p, i) => (
              <button key={p[0]} className={i === ph ? "on" : ""} onClick={() => setPh(i)}>
                {p[0]}
              </button>
            ))}
          </div>
          <div className="sr">
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search steps or roles"
              aria-label="Search steps"
            />
            <kbd>/</kbd>
          </div>
          <span className="cnt">{count} of 23 steps</span>
          <div className="zm">
            <button className="t" onClick={() => zoomMid(0.8)} aria-label="Zoom out">−</button>
            <button className="t" onClick={() => fit()}>Fit</button>
            <button className="t" onClick={() => zoomMid(1.25)} aria-label="Zoom in">+</button>
            <button className="t" onClick={reset}>Reset</button>
          </div>
        </div>

        <div
          ref={stageRef}
          className={`stage${dragging ? " drag" : ""}`}
          onPointerDown={onPointerDown}
        >
          <div
            className={`world${anim ? " anim" : ""}`}
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
          >
            <svg className="ed" width={WORLD_W} height={WORLD_H} viewBox={`0 0 ${WORLD_W} ${WORLD_H}`} aria-hidden="true">
              <defs>
                {["", "p", "f"].map((t) => (
                  <marker key={t} id={`m${t}`} viewBox="0 0 10 10" refX="8" refY="5"
                    markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M0 0L10 5L0 10z"
                      style={{ fill: `var(--${t === "p" ? "ok" : t === "f" ? "no" : "edge"})` }} />
                  </marker>
                ))}
              </defs>
              {EDGES.map((e, i) => {
                const hi = sel && (e.a === sel || e.b === sel);
                return (
                  <path
                    key={i}
                    className={`e ${e.t}${hi ? " hi" : ""}${sel && !hi ? " lo" : ""}`}
                    d={`M${e.pts.map((p) => p.join(",")).join(" L")}`}
                    markerEnd={`url(#m${e.t === "c" ? "" : e.t})`}
                  />
                );
              })}
              <text className="lb" x="1033" y="528">Back to step 15 · next collection</text>
            </svg>

            {Object.keys(POS).map((key) => {
              const b = box(key === "x" ? key : +key);
              const style = { left: b.x, top: b.y, width: b.w, height: b.h };
              if (key === "x") {
                return (
                  <div key="x" className={`nd ex${isOn("x") ? "" : " dim"}`} style={style}>Exit</div>
                );
              }
              const n = +key, st = S[n - 1], hex = HEX.has(n);
              return (
                <button
                  key={n}
                  type="button"
                  className={`nd k-${kindOf(st)}${hex ? " hex" : ""}${isOn(n) ? "" : " dim"}${sel === n ? " sel" : ""}`}
                  style={style}
                  onClick={() => onNodeClick(n)}
                >
                  {hex && (
                    <svg className="hx" viewBox="0 0 250 84" preserveAspectRatio="none">
                      <polygon points="28,1 222,1 249,42 222,83 28,83 1,42" />
                    </svg>
                  )}
                  <span className="num">{n}</span>
                  <span className="tx">
                    <b>{st[1]}</b>
                    {(st[2].length > 0 || st[3]) && (
                      <span className="ch">
                        {st[2].map((c) => <Chip key={c} code={c} />)}
                        {st[3] && <em>{st[3] === "tab" ? "Tab" : "Web"}</em>}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="hint">Drag to pan · Ctrl or ⌘ + scroll to zoom · Select a step</div>

          {s && (
            <aside className={`pn k-${panelKind}`} aria-live="polite">
              <button className="x" onClick={() => setSel(null)} aria-label="Close">×</button>
              <div className="pt">
                <span className={`num big k-${panelKind}`}>{sel}</span>
                <h3>{s[1]}</h3>
              </div>
              <dl>
                <dt>Owner</dt>
                <dd>
                  {s[2].length
                    ? s[2].map((c) => (
                        <span className="ow" key={c}><Chip code={c} /> {R[c][0]}</span>
                      ))
                    : "Reviewed after appraisal"}
                </dd>
                {s[3] && (<><dt>Works in</dt><dd>{s[3] === "tab" ? "Tablet in the field" : "Web portal"}</dd></>)}
                <dt>Timeline</dt><dd>{s[4]}</dd>
                <dt>Phase</dt><dd>{phaseName}</dd>
                {outs.map((e, i) => (
                  <div key={i}>
                    <dt>
                      {e.t === "p" ? "If it passes"
                        : e.t === "f" ? (sel === 20 ? "If not yet" : "If it fails")
                        : "Next"}
                    </dt>
                    <dd className={e.t === "c" ? "" : e.t}>{nameOf(e.b)}</dd>
                  </div>
                ))}
              </dl>
              <div className="pnav">
                <button disabled={sel === 1} onClick={() => pick(sel - 1)}>Previous</button>
                <button disabled={sel === 23} onClick={() => pick(sel + 1)}>Next step</button>
              </div>
            </aside>
          )}
        </div>

        <div className="lg">
          <span className="k-f"><i />Field role</span>
          <span className="k-n"><i />Finance role</span>
          <span className="k-m"><i />MIS role</span>
          <span className="k-d"><i />Federal role</span>
          <span className="k-c"><i />Credit / Audit</span>
          <span style={{ color: "var(--ok)" }}><s />Pass</span>
          <span style={{ color: "var(--no)" }}><s />Fail</span>
          <span>⬡ Hexagon = decision · Tab / Web = where it is done</span>
        </div>

        <section className="notes">
          <div className="tabs" role="tablist">
            {Object.keys(NOTES).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t}
                className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </div>
          {isList ? (
            <ul className="nl">{notesData.map((x) => <li key={x}>{x}</li>)}</ul>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{tab === "Timeline" ? "Steps" : "Code"}</th>
                  <th>{tab === "Timeline" ? "When" : "Role"}</th>
                </tr>
              </thead>
              <tbody>
                {notesData.map((r) => <tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td></tr>)}
              </tbody>
            </table>
          )}
        </section>

        <footer>
          <span>© PAFT BC · Micro finance operations</span>
          <span>Based on the PAFT_BC process flowchart. Check operational rules against your approved SOP.</span>
        </footer>
      </div>
    </div>
  );
}