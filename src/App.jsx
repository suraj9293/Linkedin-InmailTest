import { useState, useEffect, useRef } from "react";

// ─── STYLES ──────────────────────────────────────────────────────────────────
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;1,400&display=swap');`;

const CSS = `
*{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#07080c;--surface:#0d0f16;--surface2:#111420;--border:#181d2e;--border2:#1f263d;
  --amber:#f59e0b;--green:#10b981;--red:#f43f5e;--blue:#38bdf8;--purple:#a78bfa;
  --text:#e8eaf0;--muted:#4a5568;--dim:#2d3554;
}
body{background:var(--bg);font-family:'Syne',sans-serif;}
.app{min-height:100vh;background:var(--bg);color:var(--text);padding:20px 16px 80px;}

/* HEADER */
.hd{margin-bottom:28px;}
.hd-pre{font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:.22em;color:var(--amber);text-transform:uppercase;margin-bottom:6px;display:flex;align-items:center;gap:8px;}
.hd-pre::before{content:'';display:inline-block;width:18px;height:1px;background:var(--amber);}
.hd-title{font-size:24px;font-weight:800;line-height:1.15;color:#fff;letter-spacing:-.02em;}
.hd-title span{color:var(--amber);}
.hd-sub{font-size:12px;color:var(--muted);margin-top:6px;line-height:1.6;}

/* TABS */
.tabs{display:flex;gap:2px;background:var(--surface);border-radius:8px;padding:3px;margin-bottom:24px;border:1px solid var(--border);}
.tab{flex:1;padding:8px 4px;border-radius:6px;border:none;background:transparent;color:var(--muted);
  font-size:11px;font-family:'Syne',sans-serif;font-weight:600;cursor:pointer;transition:all .2s;letter-spacing:.02em;}
.tab.on{background:var(--surface2);color:var(--amber);border:1px solid var(--border2);}

/* FORM */
.field{margin-bottom:14px;}
.flabel{font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:.16em;color:var(--muted);text-transform:uppercase;margin-bottom:6px;display:flex;justify-content:space-between;}
.fcount{color:var(--dim);}
.fcount.warn{color:var(--amber);}
.fcount.over{color:var(--red);}
input,select,textarea{
  width:100%;background:var(--surface);border:1px solid var(--border2);border-radius:8px;
  color:var(--text);font-size:13px;font-family:'Syne',sans-serif;padding:10px 12px;outline:none;
  transition:border-color .2s;resize:none;
}
input:focus,select:focus,textarea:focus{border-color:var(--amber);}
select option{background:#1a1f2e;}
textarea{line-height:1.65;min-height:120px;}

.field-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;}

/* ANALYZE BUTTON */
.analyze-btn{
  width:100%;padding:14px;border-radius:8px;border:none;
  background:var(--amber);color:#07080c;
  font-size:12px;font-weight:700;font-family:'IBM Plex Mono',monospace;
  letter-spacing:.1em;cursor:pointer;text-transform:uppercase;
  transition:all .2s;margin-top:4px;position:relative;overflow:hidden;
}
.analyze-btn::after{content:'';position:absolute;inset:0;background:rgba(255,255,255,.1);opacity:0;transition:opacity .2s;}
.analyze-btn:hover::after{opacity:1;}
.analyze-btn:disabled{opacity:.3;cursor:not-allowed;}

/* LOADING */
.loading{padding:40px 0;text-align:center;}
.loading-text{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--muted);letter-spacing:.1em;margin-bottom:16px;}
.loading-bar{height:2px;background:var(--border2);border-radius:1px;overflow:hidden;margin:0 20px;}
.loading-fill{height:100%;background:linear-gradient(90deg,transparent,var(--amber),transparent);
  width:60%;animation:sweep 1.4s ease-in-out infinite;}
@keyframes sweep{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}

/* VERDICT CARD */
.verdict{
  background:var(--surface);border:1px solid var(--border2);border-radius:12px;
  overflow:hidden;margin-bottom:14px;
}
.verdict-header{
  padding:14px 16px;border-bottom:1px solid var(--border);
  display:flex;justify-content:space-between;align-items:center;
  background:linear-gradient(135deg,var(--surface2),var(--surface));
}
.verdict-label{font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:.16em;color:var(--muted);text-transform:uppercase;}
.verdict-title{font-size:15px;font-weight:700;margin-top:2px;}
.score-ring{
  width:54px;height:54px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  flex-direction:column;border:2px solid;flex-shrink:0;
}
.score-num{font-family:'IBM Plex Mono',monospace;font-size:17px;font-weight:600;line-height:1;}
.score-lbl{font-size:8px;color:var(--muted);margin-top:1px;letter-spacing:.08em;}
.verdict-body{padding:14px 16px;}
.verdict-row{display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;}
.verdict-row:last-child{margin-bottom:0;}
.v-icon{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--muted);flex-shrink:0;margin-top:1px;}
.v-text{font-size:12px;color:#a0aec0;line-height:1.65;}
.v-text strong{color:var(--text);}

/* FORMAT RECOMMENDATION */
.format-rec{
  background:var(--surface);border:1px solid var(--border2);border-radius:12px;
  padding:16px;margin-bottom:14px;
}
.format-label{font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:.16em;color:var(--muted);text-transform:uppercase;margin-bottom:12px;}
.format-toggle{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;}
.format-opt{
  padding:12px 10px;border-radius:8px;border:1px solid var(--border);
  text-align:center;transition:all .2s;
}
.format-opt.rec{border-color:var(--amber);background:rgba(245,158,11,.06);}
.format-opt.not{opacity:.4;}
.fo-title{font-size:12px;font-weight:700;margin-bottom:3px;}
.fo-desc{font-size:10px;color:var(--muted);line-height:1.5;}
.fo-badge{
  display:inline-block;margin-top:6px;padding:2px 8px;border-radius:10px;
  font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:600;
  background:rgba(245,158,11,.15);color:var(--amber);border:1px solid rgba(245,158,11,.3);
}

/* SCENARIOS */
.scenarios{margin-bottom:14px;}
.sc-title{font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:.16em;color:var(--muted);text-transform:uppercase;margin-bottom:10px;}
.sc-card{
  background:var(--surface);border:1px solid var(--border);border-radius:10px;
  margin-bottom:8px;overflow:hidden;transition:border-color .2s;cursor:pointer;
}
.sc-card:hover{border-color:var(--border2);}
.sc-card.expanded{border-color:var(--amber);}
.sc-header{padding:12px 14px;display:flex;justify-content:space-between;align-items:center;}
.sc-left{display:flex;align-items:center;gap:10px;}
.sc-num{font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--dim);width:20px;}
.sc-name{font-size:12px;font-weight:600;color:var(--text);}
.sc-sub{font-size:10px;color:var(--muted);margin-top:1px;}
.sc-right{display:flex;align-items:center;gap:8px;flex-shrink:0;}
.rr-pill{
  padding:2px 8px;border-radius:10px;font-family:'IBM Plex Mono',monospace;
  font-size:10px;font-weight:600;
}
.sc-arrow{font-size:10px;color:var(--muted);transition:transform .2s;}
.sc-arrow.open{transform:rotate(180deg);}
.sc-body{padding:0 14px 14px;display:none;}
.sc-card.expanded .sc-body{display:block;}
.sc-msg{
  font-size:12px;color:#94a3b8;line-height:1.75;font-style:italic;
  background:rgba(0,0,0,.3);padding:12px 13px;border-radius:6px;
  border-left:2px solid var(--border2);margin-bottom:10px;
  white-space:pre-wrap;
}
.sc-signals{display:flex;flex-wrap:wrap;gap:5px;}
.sig{padding:2px 8px;border-radius:10px;font-size:9px;font-family:'IBM Plex Mono',monospace;
  background:rgba(16,185,129,.1);color:var(--green);border:1px solid rgba(16,185,129,.25);}

/* INTEL TABLE */
.intel-card{background:var(--surface);border:1px solid var(--border2);border-radius:12px;overflow:hidden;margin-bottom:12px;}
.intel-header{padding:12px 16px;border-bottom:1px solid var(--border);background:var(--surface2);}
.intel-label{font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:.16em;color:var(--muted);text-transform:uppercase;}
.intel-count{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--amber);float:right;}
.intel-row{
  display:grid;grid-template-columns:1.4fr .6fr .6fr .6fr;
  padding:9px 14px;border-bottom:1px solid rgba(24,29,46,.6);
  font-size:11px;transition:background .15s;
}
.intel-row:hover{background:rgba(17,20,32,.8);}
.intel-row:last-child{border-bottom:none;}
.ir-head{background:var(--surface2);font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--dim);letter-spacing:.08em;text-transform:uppercase;}
.ir-name{color:#cbd5e1;font-size:12px;}
.ir-role{color:var(--muted);font-size:10px;margin-top:1px;}
.ir-score{font-family:'IBM Plex Mono',monospace;font-weight:600;}
.ir-format{font-family:'IBM Plex Mono',monospace;font-size:10px;}
.ir-result{font-family:'IBM Plex Mono',monospace;font-size:10px;}

/* INSIGHTS */
.insight-panel{background:var(--surface);border:1px solid var(--border2);border-left:3px solid var(--amber);border-radius:8px;padding:14px 16px;margin-top:10px;}
.ip-title{font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--amber);letter-spacing:.14em;text-transform:uppercase;margin-bottom:10px;}
.ip-line{font-size:12px;color:#94a3b8;line-height:1.65;padding:5px 0;border-bottom:1px solid rgba(24,29,46,.6);}
.ip-line:last-child{border-bottom:none;}

/* ANIMATE */
.fade-in{animation:fi .35s ease forwards;}
@keyframes fi{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
.stagger>*{opacity:0;animation:fi .3s ease forwards;}
.stagger>*:nth-child(1){animation-delay:.05s}
.stagger>*:nth-child(2){animation-delay:.1s}
.stagger>*:nth-child(3){animation-delay:.15s}
.stagger>*:nth-child(4){animation-delay:.2s}
.stagger>*:nth-child(5){animation-delay:.25s}
.stagger>*:nth-child(6){animation-delay:.3s}
`;

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const SENIORITY_OPTS = ["Recruiter / TA Lead","Hiring Manager","Director","Senior Director / VP","C-Suite / Partner","Analyst / Researcher","Founder / Operator"];
const CONTEXT_OPTS = ["Cold outreach — no prior contact","Responding to their inbound","Following up on a post/article they wrote","Referral / mutual connection","Reconnecting after an event"];

function wordCount(t){ return t.trim().split(/\s+/).filter(Boolean).length; }

// ─── SYSTEM PROMPT ───────────────────────────────────────────────────────────
function buildPrompt(input){
  return `You are a senior LinkedIn outreach strategist specializing in Social Eminence theory and response probability modeling. Your job is to analyze a LinkedIn InMail and return precise, tactical intelligence.

TARGET PROFILE:
- Name: ${input.targetName}
- Role/Title: ${input.targetRole}
- Company: ${input.targetCompany}
- Seniority Level: ${input.seniority}
- Contact Context: ${input.context}

SENDER'S DRAFT MESSAGE (${wordCount(input.message)} words):
"${input.message}"

SENDER BACKGROUND:
Technology Ecosystem Strategist — 9 years experience in competitive intelligence, partner ecosystem strategy, and market positioning for B2B AI/IT services firms. Clients include Korcomptenz, Bitwise, Tredence, HCLTech, Mastech Digital, Ascendion, Altimetrik.

---

Analyze this and respond in valid JSON only. No markdown, no explanation, no backticks. Exactly this structure:

{
  "overallScore": <integer 0-100>,
  "scoreLabel": "<one of: Strong / Moderate / Weak / Critical Issues>",
  "primaryVerdict": "<2 sentence sharp diagnosis of what this message gets right or wrong>",
  "formatRecommendation": {
    "recommended": "<'concise' or 'descriptive'>",
    "conciseRationale": "<why 2-3 sentences might work or not for this target>",
    "descriptiveRationale": "<why a fuller message might work or not for this target>",
    "idealWordCount": "<e.g. '40-60 words' or '80-120 words'>",
    "openingStrategy": "<specific instruction: how to open this message for this person>"
  },
  "signalAnalysis": {
    "presentSignals": ["<signal found in message>"],
    "missingSignals": ["<signal absent but needed>"],
    "harmfulElements": ["<elements that hurt response probability>"]
  },
  "scenarios": [
    {
      "id": 1,
      "name": "<scenario name e.g. 'Ecosystem Peer Signal'>",
      "type": "<'recommended' / 'alternative' / 'test'>",
      "targetContext": "<who this works best for>",
      "estimatedResponseRate": "<e.g. '28-38%'>",
      "rrColor": "<'green' / 'amber' / 'red'>",
      "message": "<full rewritten message, max 120 words, ready to send>",
      "signals": ["<signal1>", "<signal2>", "<signal3>"]
    }
  ],
  "strategicRules": [
    "<rule 1 specific to this target profile>",
    "<rule 2>",
    "<rule 3>",
    "<rule 4>"
  ]
}

Generate exactly 11 scenarios. Cover: best version of their message, ecosystem credibility version, ultra-short (2-3 sentences), content hook version, curiosity gap version, inbound response version, peer intelligence version, challenge/insight version, role adjacency version, credibility drop version, and one wildcard. Each scenario must be unique and immediately usable. Be brutally honest about what's weak.`;
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("analyze");
  const [form, setForm] = useState({ targetName:"", targetRole:"", targetCompany:"", seniority:"Hiring Manager", context:"Cold outreach — no prior contact", message:"" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [loadingStep, setLoadingStep] = useState("Analyzing profile signals...");
  const loadingSteps = ["Analyzing profile signals...","Scoring message structure...","Modeling response probability...","Generating 11 scenarios...","Building strategic rules..."];
  const stepRef = useRef(null);

  // Load history from storage on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await window.storage.get("outreach_history");
        if (stored) setHistory(JSON.parse(stored.value));
      } catch(e) {}
    })();
  }, []);

  const wc = wordCount(form.message);
  const wcColor = wc > 150 ? "over" : wc > 120 ? "warn" : "";

  function setField(k,v){ setForm(f=>({...f,[k]:v})); }

  async function saveToHistory(entry) {
    const updated = [entry, ...history].slice(0, 50);
    setHistory(updated);
    try { await window.storage.set("outreach_history", JSON.stringify(updated)); } catch(e){}
  }

    async function analyze() {
      if (!form.message.trim() || !form.targetName.trim()) return;
      setLoading(true);
      setResult(null);
      setError(null);
      setExpanded(null);

      let si = 0;
      stepRef.current = setInterval(() => {
        si = (si + 1) % loadingSteps.length;
        setLoadingStep(loadingSteps[si]);
      }, 900);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_name: form.targetName,
          company: form.targetCompany,
          role: form.targetRole,
          seniority: form.seniority,
          contact_context: form.context,
          draft_message: form.message
         })
        });

        clearInterval(stepRef.current);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "Request failed");
        }

        setResult(data);

        const entry = {
          id: Date.now(),
          date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
          targetName: form.targetName,
          targetRole: form.targetRole,
          targetCompany: form.targetCompany,
          seniority: form.seniority,
          messagePreview: form.message.slice(0, 80) + "...",
          score: data.score,
          scoreLabel: data.verdict,
          format: data.format_decision,
          wordCount: wc,
        };

        await saveToHistory(entry);

      } catch (e) {
        clearInterval(stepRef.current);
        setError("Analysis failed. Check your message and try again.");
      }

      setLoading(false);
    }

  function scoreColor(s){ return s>=70?"var(--green)":s>=45?"var(--amber)":"var(--red)"; }
  function rrPillStyle(color){
    const map={green:"rgba(16,185,129,.15) border-color: rgba(16,185,129,.35); color: var(--green)",amber:"rgba(245,158,11,.15) border-color: rgba(245,158,11,.35); color: var(--amber)",red:"rgba(244,63,94,.15) border-color: rgba(244,63,94,.35); color: var(--red)"};
    const c={green:{bg:"rgba(16,185,129,.12)",border:"rgba(16,185,129,.3)",col:"var(--green)"},amber:{bg:"rgba(245,158,11,.12)",border:"rgba(245,158,11,.3)",col:"var(--amber)"},red:{bg:"rgba(244,63,94,.12)",border:"rgba(244,63,94,.3)",col:"var(--red)"}};
    return c[color]||c.amber;
  }

  // ── INTEL model stats from history
  const totalAnalyzed = history.length;
  const avgScore = history.length ? Math.round(history.reduce((a,b)=>a+b.score,0)/history.length) : 0;
  const conciseCount = history.filter(h=>h.format==="concise").length;
  const descriptiveCount = history.filter(h=>h.format==="descriptive").length;

  return (
    <>
      <style>{FONTS+CSS}</style>
      <div className="app">
        <div className="hd">
          <div className="hd-pre">Message Intelligence Engine</div>
          <div className="hd-title">Should you write <span>2 lines</span><br/>or 2 paragraphs?</div>
          <div className="hd-sub">Paste your draft. Get 11 scenarios, a format verdict, and response probability scoring — all calibrated to your target's Social Eminence profile.</div>
        </div>

        <div className="tabs">
          <button className={`tab ${tab==="analyze"?"on":""}`} onClick={()=>setTab("analyze")}>Analyze</button>
          <button className={`tab ${tab==="result"?"on":""}`} onClick={()=>setTab("result")} disabled={!result}>Results</button>
          <button className={`tab ${tab==="intel"?"on":""}`} onClick={()=>setTab("intel")}>Data Model</button>
        </div>

        {/* ── ANALYZE TAB ── */}
        {tab==="analyze" && (
          <div className="fade-in">
            <div className="field-row">
              <div className="field">
                <div className="flabel">Target Name</div>
                <input placeholder="e.g. Ashwin Venkatesan" value={form.targetName} onChange={e=>setField("targetName",e.target.value)} />
              </div>
              <div className="field">
                <div className="flabel">Company</div>
                <input placeholder="e.g. HFS Research" value={form.targetCompany} onChange={e=>setField("targetCompany",e.target.value)} />
              </div>
            </div>

            <div className="field">
              <div className="flabel">Role / Title</div>
              <input placeholder="e.g. VP Research & Insights" value={form.targetRole} onChange={e=>setField("targetRole",e.target.value)} />
            </div>

            <div className="field-row">
              <div className="field">
                <div className="flabel">Seniority Level</div>
                <select value={form.seniority} onChange={e=>setField("seniority",e.target.value)}>
                  {SENIORITY_OPTS.map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="field">
                <div className="flabel">Contact Context</div>
                <select value={form.context} onChange={e=>setField("context",e.target.value)}>
                  {CONTEXT_OPTS.map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
            </div>

            <div className="field">
              <div className="flabel">
                <span>Your Draft Message</span>
                <span className={`fcount ${wcColor}`}>{wc}/150 words</span>
              </div>
              <textarea
                placeholder="Paste your message here. Write it exactly as you would send it — the model needs your real draft to give accurate feedback."
                value={form.message}
                onChange={e=>setField("message",e.target.value)}
                rows={7}
              />
            </div>

            <button className="analyze-btn" onClick={analyze}
              disabled={loading || !form.message.trim() || !form.targetName.trim()}>
              {loading ? "Analyzing..." : "▶ Analyze Message + Generate Scenarios"}
            </button>

            {loading && (
              <div className="loading fade-in" style={{marginTop:20}}>
                <div className="loading-text">{loadingStep}</div>
                <div className="loading-bar"><div className="loading-fill"/></div>
              </div>
            )}
            {error && <div style={{marginTop:14,padding:"12px 14px",background:"rgba(244,63,94,.08)",border:"1px solid rgba(244,63,94,.25)",borderRadius:8,fontSize:12,color:"var(--red)"}}>{error}</div>}
          </div>
        )}

        {/* ── RESULTS TAB ── */}
        {tab==="result" && result && (
          <div className="fade-in">
            {/* VERDICT */}
            <div className="verdict">
              <div className="verdict-header">
                <div>
                  <div className="verdict-label">Overall Assessment</div>
                 <div className="verdict-title" style={{color:scoreColor(result.score)}}>{result.verdict}</div>
                </div>
                <div className="score-ring" style={{borderColor:scoreColor(result.overallScore)}}>
                  <div className="score-num" style={{color:scoreColor(result.overallScore)}}>{result.overallScore}</div>
                  <div className="score-lbl">/ 100</div>
                </div>
              </div>
              <div className="verdict-body">
                <div className="verdict-row">
                  <div className="v-icon">◈</div>
                  <div className="v-text">{result.format_rationale}</div>
                </div>
                {result.signalAnalysis?.missingSignals?.length > 0 && (
                  <div className="verdict-row">
                    <div className="v-icon" style={{color:"var(--red)"}}>✗</div>
                    <div className="v-text"><strong>Missing:</strong> {result.signalAnalysis.missingSignals.join(" · ")}</div>
                  </div>
                )}
                {result.signalAnalysis?.harmfulElements?.length > 0 && (
                  <div className="verdict-row">
                    <div className="v-icon" style={{color:"var(--amber)"}}>⚠</div>
                    <div className="v-text"><strong>Flagged:</strong> {result.signalAnalysis.harmfulElements.join(" · ")}</div>
                  </div>
                )}
                {result.signalAnalysis?.presentSignals?.length > 0 && (
                  <div className="verdict-row">
                    <div className="v-icon" style={{color:"var(--green)"}}>✓</div>
                    <div className="v-text"><strong>Working:</strong> {result.signalAnalysis.presentSignals.join(" · ")}</div>
                  </div>
                )}
              </div>
            </div>

            {/* FORMAT RECOMMENDATION */}
            {result.format_decision && (
              <div className="format-rec fade-in">
                <div className="format-label">Format Verdict · {result.ideal_word_count} ideal</div>
                <div className="format-toggle">
                 {["concise","descriptive"].map(f=>(
                  <div key={f} className={`format-opt ${result.format_decision===f?"rec":"not"}`}>
                    <div className="fo-title">{f==="concise"?"2–3 Sentences":"Full Message"}</div>
                    <div className="fo-desc">
                      {result.format_rationale}
                  </div>
                  {result.format_decision===f && <div className="fo-badge">▸ Recommended</div>}
                </div>
               ))}
              </div>
              <div style={{padding:"10px 12px",background:"rgba(0,0,0,.3)",borderRadius:8,fontSize:12,color:"#94a3b8",lineHeight:1.65,borderLeft:"2px solid var(--amber)"}}>
                <strong style={{color:"var(--amber)"}}>Opening strategy:</strong> {result.opening_strategy}
              </div>
            </div>
)}


            {/* SCENARIOS */}
            {result.scenarios?.length > 0 && (
              <div className="scenarios fade-in">
                <div className="sc-title">▸ {result.scenarios.length} Message Scenarios · Tap to expand</div>
                <div className="stagger">
                  {result.scenarios.map((sc,i)=>{
                    const rr = rrPillStyle("amber");
                    const isOpen = expanded===i;
                    return (
                      <div key={i} className={`sc-card ${isOpen?"expanded":""}`} onClick={()=>setExpanded(isOpen?null:i)}>
                        <div className="sc-header">
                          <div className="sc-left">
                            <div className="sc-num">{String(i + 1).padStart(2,"0")}</div>
                            <div>
                              <div className="sc-name">{sc.variant_title || sc.variant_type}</div>
                              <div className="sc-sub">{sc.variant_type}</div>
                            </div>
                          </div>
                          <div className="sc-right">
                            <div className="rr-pill" style={{background:rr.bg,border:`1px solid ${rr.border}`,color:rr.col}}>{sc.estimated_response_rate}</div>
                            <div className={`sc-arrow ${isOpen?"open":""}`}>▼</div>
                          </div>
                        </div>
                        {isOpen && (
                          <div className="sc-body fade-in">
                            <div className="sc-msg">{sc.variant_message}</div>
                            <div className="sc-signals">{sc.signals?.map((s,j)=><span key={j} className="sig">{s}</span>)}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STRATEGIC RULES */}
            {result.strategic_rules?.length > 0 && (
              <div className="insight-panel fade-in">
                <div className="ip-title">▸ Strategic rules for {form.targetName || "this profile"}</div>
                {result.strategic_rules.map((r,i)=><div key={i} className="ip-line">{r}</div>)}
              </div>
            )}
          </div>
        )}

        {/* ── DATA MODEL TAB ── */}
        {tab==="intel" && (
          <div className="fade-in">
            {/* Model stats */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
              {[
                {val:totalAnalyzed,lbl:"Analyses Run",col:"var(--amber)"},
                {val:avgScore||"—",lbl:"Avg Score",col:avgScore>=60?"var(--green)":"var(--red)"},
                {val:`${conciseCount}:${descriptiveCount}`,lbl:"Short:Long",col:"var(--blue)"},
              ].map((k,i)=>(
                <div key={i} style={{background:"var(--surface)",border:"1px solid var(--border2)",borderRadius:10,padding:"12px 10px",textAlign:"center"}}>
                  <div style={{fontFamily:"IBM Plex Mono",fontSize:22,fontWeight:600,color:k.col,lineHeight:1}}>{k.val}</div>
                  <div style={{fontSize:10,color:"var(--muted)",marginTop:4,textTransform:"uppercase",letterSpacing:".06em"}}>{k.lbl}</div>
                </div>
              ))}
            </div>

            {history.length === 0 ? (
              <div style={{textAlign:"center",padding:"40px 0",color:"var(--muted)"}}>
                <div style={{fontFamily:"IBM Plex Mono",fontSize:11,letterSpacing:".12em",marginBottom:8}}>NO DATA YET</div>
                <div style={{fontSize:12}}>Run your first analysis to start building the model.</div>
              </div>
            ) : (
              <>
                <div className="intel-card">
                  <div className="intel-header">
                    <span className="intel-label">Analysis History</span>
                    <span className="intel-count">{history.length} records</span>
                  </div>
                  <div className="intel-row ir-head">
                    <div>Profile</div><div>Score</div><div>Format</div><div>Result</div>
                  </div>
                  {history.map((h,i)=>(
                    <div key={i} className="intel-row">
                      <div>
                        <div className="ir-name">{h.targetName}</div>
                        <div className="ir-role">{h.targetCompany} · {h.seniority?.split(" ")[0]}</div>
                      </div>
                      <div className="ir-score" style={{color:scoreColor(h.score)}}>{h.score}</div>
                      <div className="ir-format" style={{color:"var(--muted)",fontSize:10}}>{h.format==="concise"?"Short":"Full"}</div>
                      <div className="ir-result" style={{color:h.score>=70?"var(--green)":h.score>=45?"var(--amber)":"var(--red)"}}>
                        {h.scoreLabel?.split(" ")[0]}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Dynamic pattern insights */}
                {history.length >= 3 && (
                  <div className="insight-panel">
                    <div className="ip-title">▸ Emerging patterns · {history.length} data points</div>
                    {[
                      avgScore < 50 ? "⚠ Average message quality below 50 — ecosystem credibility signals consistently missing across drafts" : "✓ Message quality trending above threshold — signal density improving",
                      conciseCount > descriptiveCount ? `Model recommends short format in ${conciseCount}/${history.length} cases — match target seniority with brevity` : `Full messages recommended more often — target profiles skew toward context-heavy engagement`,
                      history.filter(h=>h.score<40).length > 0 ? `${history.filter(h=>h.score<40).length} messages flagged critical — review for job-seeker framing and generic openers` : "No critical-score messages in history — baseline quality holding",
                      `Most analyzed seniority: ${(() => { const counts={}; history.forEach(h=>{counts[h.seniority]=(counts[h.seniority]||0)+1;}); return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0]||"—"; })()}`,
                    ].map((l,i)=><div key={i} className="ip-line">{l}</div>)}
                  </div>
                )}

                <button style={{width:"100%",marginTop:12,padding:"10px",borderRadius:8,border:"1px solid var(--border2)",background:"transparent",color:"var(--red)",fontSize:11,fontFamily:"IBM Plex Mono",letterSpacing:".08em",cursor:"pointer",textTransform:"uppercase"}}
                  onClick={async()=>{setHistory([]);try{await window.storage.delete("outreach_history");}catch(e){}}}>
                  Clear Model Data
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
