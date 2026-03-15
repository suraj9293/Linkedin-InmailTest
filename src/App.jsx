import { useState, useEffect, useRef } from "react";
import "./App.css";

const SENIORITY_OPTS = ["Recruiter / TA Lead","Hiring Manager","Director","Senior Director / VP","C-Suite / Partner","Analyst / Researcher","Founder / Operator"];
const CONTEXT_OPTS = ["Cold outreach — no prior contact","Responding to their inbound","Following up on a post/article they wrote","Referral / mutual connection","Reconnecting after an event"];

function wordCount(t){ return t.trim().split(/\s+/).filter(Boolean).length; }

function normalizeResult(data) {
  if (!data) return null;
  if (data.overallScore !== undefined) return data;
  const recommended = typeof data.format_decision === "string" && data.format_decision.toLowerCase().includes("concise") ? "concise" : "descriptive";
  return {
    overallScore: data.score ?? 0,
    scoreLabel: data.verdict ?? "—",
    primaryVerdict: data.format_rationale ?? "",
    profileUsed: false,
    formatRecommendation: {
      recommended,
      conciseRationale: recommended === "concise" ? (data.format_rationale ?? "") : "",
      descriptiveRationale: recommended === "descriptive" ? (data.format_rationale ?? "") : "",
      idealWordCount: data.ideal_word_count != null ? String(data.ideal_word_count) : "",
      openingStrategy: data.opening_strategy ?? ""
    },
    signalAnalysis: data.signalAnalysis ?? { presentSignals: [], missingSignals: [], harmfulElements: [] },
    scenarios: (data.scenarios || []).map((sc, i) => ({
      id: sc.id ?? i + 1,
      name: sc.name || sc.variant_title || `Scenario ${i + 1}`,
      type: sc.type || "alternative",
      targetContext: sc.targetContext || "",
      estimatedResponseRate: sc.estimatedResponseRate || sc.estimated_response_rate || "—",
      rrColor: sc.rrColor || "amber",
      message: sc.message || sc.variant_message || "",
      signals: Array.isArray(sc.signals) ? sc.signals : sc.signals ? [sc.signals] : []
    })),
    strategicRules: data.strategicRules || data.strategic_rules || []
  };
}

export default function App() {
  const [tab, setTab] = useState("analyze");
  const [form, setForm] = useState({ targetName:"", targetRole:"", targetCompany:"", seniority:"Hiring Manager", context:"Cold outreach — no prior contact", message:"" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [loadingStep, setLoadingStep] = useState("Analyzing profile signals...");
  const [profile, setProfile] = useState(null);
  const [profileStatus, setProfileStatus] = useState("idle");
  const profileDebounce = useRef(null);
  const stepRef = useRef(null);
  const loadingSteps = ["Analyzing profile signals...","Scoring message structure...","Modeling response probability...","Generating 11 scenarios...","Building strategic rules..."];

  useEffect(() => {
    (async () => {
      try {
        const stored = await window.storage.get("outreach_history");
        if (stored) setHistory(JSON.parse(stored.value));
      } catch(e) {}
    })();
  }, []);

  useEffect(() => {
    clearTimeout(profileDebounce.current);
    if (form.targetName.trim().length < 2 || form.targetCompany.trim().length < 2) {
      setProfile(null); setProfileStatus("idle"); return;
    }
    setProfileStatus("loading");
    profileDebounce.current = setTimeout(async () => {
      try {
        const r = await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: form.targetName, company: form.targetCompany, role: form.targetRole })
        });
        const data = await r.json();
        if (data && data.scores) { setProfile(data); setProfileStatus("ready"); }
        else setProfileStatus("failed");
      } catch(e) { setProfileStatus("failed"); }
    }, 1500);
  }, [form.targetName, form.targetCompany, form.targetRole]);

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
    setLoading(true); setResult(null); setError(null); setExpanded(null);
    let si = 0;
    stepRef.current = setInterval(() => { si=(si+1)%loadingSteps.length; setLoadingStep(loadingSteps[si]); }, 900);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetName: form.targetName, targetCompany: form.targetCompany,
          targetRole: form.targetRole, seniority: form.seniority,
          context: form.context, message: form.message,
          profile: profile || null
        })
      });
      clearInterval(stepRef.current);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Request failed");
      const parsed = normalizeResult(data);
      setResult(parsed);
      await saveToHistory({
        id: Date.now(),
        date: new Date().toLocaleDateString("en-GB", { day:"numeric", month:"short" }),
        targetName: form.targetName, targetRole: form.targetRole,
        targetCompany: form.targetCompany, seniority: form.seniority,
        messagePreview: form.message.slice(0,80)+"...",
        score: parsed.overallScore, scoreLabel: parsed.scoreLabel,
        format: parsed.formatRecommendation?.recommended,
        wordCount: wc, profileUsed: !!profile
      });
      setTab("result");
    } catch(e) {
      clearInterval(stepRef.current);
      setError("Analysis failed. Check your message and try again.");
    }
    setLoading(false);
  }

  function scoreColor(s){ return s>=70?"var(--green)":s>=45?"var(--amber)":"var(--red)"; }
  function rrPillStyle(color){
    const c={green:{bg:"rgba(16,185,129,.12)",border:"rgba(16,185,129,.3)",col:"var(--green)"},amber:{bg:"rgba(245,158,11,.12)",border:"rgba(245,158,11,.3)",col:"var(--amber)"},red:{bg:"rgba(244,63,94,.12)",border:"rgba(244,63,94,.3)",col:"var(--red)"}};
    return c[color]||c.amber;
  }

  const totalAnalyzed = history.length;
  const avgScore = history.length ? Math.round(history.reduce((a,b)=>a+b.score,0)/history.length) : 0;
  const conciseCount = history.filter(h=>h.format==="concise").length;
  const descriptiveCount = history.filter(h=>h.format==="descriptive").length;

  const profileIndicator = {
    idle: null,
    loading: { text: "Scanning profile intelligence...", color: "var(--muted)" },
    ready: { text: `◈ Intelligence ready · RPS ${profile?.rps || "—"} · Segment ${profile?.segment || "—"} · ${profile?.responseRateEstimate || "—"} est. response`, color: "var(--green)" },
    failed: { text: "Profile scan incomplete — will analyze from form inputs", color: "var(--amber)" }
  }[profileStatus];

  return (
    <>
      <div className="app">
        <div className="hd">
          <div className="brand">
            <div className="brand-logo">MI</div>
            <div className="brand-name">Message Intelligence</div>
          </div>
          <div className="hd-pre">Message Intelligence Engine</div>
          <div className="hd-title">Should you write <span>2 lines</span><br/>or 2 paragraphs?</div>
          <div className="hd-sub">Paste your draft. Get 11 scenarios, a format verdict, and response probability scoring — all calibrated to your target's Social Eminence profile.</div>
        </div>

        <div className="tabs">
          <button className={`tab ${tab==="analyze"?"on":""}`} onClick={()=>setTab("analyze")}>Analyze</button>
          <button className={`tab ${tab==="result"?"on":""}`} onClick={()=>setTab("result")} disabled={!result}>Results</button>
          <button className={`tab ${tab==="intel"?"on":""}`} onClick={()=>setTab("intel")}>Data Model</button>
        </div>

        {tab==="analyze" && (
          <div className="fade-in">
            <div className="field-row">
              <div className="field">
                <div className="flabel">Target Name</div>
                <input placeholder="e.g. Target Full Name" value={form.targetName} onChange={e=>setField("targetName",e.target.value)} />
              </div>
              <div className="field">
                <div className="flabel">Company</div>
                <input placeholder="e.g. Company Name" value={form.targetCompany} onChange={e=>setField("targetCompany",e.target.value)} />
              </div>
            </div>

            {profileIndicator && (
              <div style={{marginTop:-4,marginBottom:12,padding:"7px 12px",borderRadius:6,background:"rgba(0,0,0,.25)",border:`1px solid ${profileIndicator.color}25`,display:"flex",alignItems:"center",gap:8}}>
                {profileStatus==="loading" && (
                  <div style={{width:8,height:8,borderRadius:"50%",border:"1.5px solid var(--muted)",borderTopColor:"var(--amber)",animation:"spin 0.7s linear infinite",flexShrink:0}}/>
                )}
                <span style={{fontFamily:"IBM Plex Mono",fontSize:10,color:profileIndicator.color,letterSpacing:".08em"}}>{profileIndicator.text}</span>
              </div>
            )}

            <div className="field">
              <div className="flabel">Role / Title</div>
              <input placeholder="e.g. VP of Marketing" value={form.targetRole} onChange={e=>setField("targetRole",e.target.value)} />
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
              <textarea placeholder="Paste your message here. Write it exactly as you would send it — the model needs your real draft to give accurate feedback." value={form.message} onChange={e=>setField("message",e.target.value)} rows={7}/>
            </div>

            <button className="analyze-btn" onClick={analyze} disabled={loading || !form.message.trim() || !form.targetName.trim()}>
              {loading ? loadingStep : profileStatus==="ready" ? "▶ Analyze with Profile Intelligence" : "▶ Analyze Message + Generate Scenarios"}
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

        {tab==="result" && result && (
          <div className="fade-in">

            {profile && (
              <div style={{background:"rgba(16,185,129,.04)",border:"1px solid rgba(16,185,129,.18)",borderRadius:10,padding:"14px 16px",marginBottom:14}}>
                <div style={{fontFamily:"IBM Plex Mono",fontSize:9,color:"var(--green)",letterSpacing:".16em",textTransform:"uppercase",marginBottom:10}}>◈ Social Eminence Profile Used</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                  {[
                    ["RPS Score", profile.rps, "var(--amber)"],
                    ["Segment", profile.segment, profile.segment==="A"?"var(--green)":profile.segment==="B"?"var(--amber)":"var(--red)"],
                    ["Est. Response Rate", profile.responseRateEstimate, "var(--text)"],
                    ["Follower Tier", profile.followerSignal, "var(--text)"]
                  ].map(([l,v,c],i)=>(
                    <div key={i} style={{background:"rgba(0,0,0,.3)",borderRadius:6,padding:"8px 10px"}}>
                      <div style={{fontSize:10,color:"var(--muted)",marginBottom:2}}>{l}</div>
                      <div style={{fontFamily:"IBM Plex Mono",fontSize:13,fontWeight:600,color:c}}>{v||"—"}</div>
                    </div>
                  ))}
                </div>
                {profile.keyInsight && <div style={{fontSize:12,color:"#94a3b8",lineHeight:1.65,borderTop:"1px solid rgba(16,185,129,.12)",paddingTop:10}}><strong style={{color:"var(--green)"}}>Key insight:</strong> {profile.keyInsight}</div>}
                {profile.messagingImplication && <div style={{fontSize:12,color:"#94a3b8",lineHeight:1.65,marginTop:6}}><strong style={{color:"var(--amber)"}}>Messaging implication:</strong> {profile.messagingImplication}</div>}
                {profile.communicationStyle && <div style={{fontSize:12,color:"#94a3b8",lineHeight:1.65,marginTop:6}}><strong style={{color:"var(--blue)"}}>Communication style:</strong> {profile.communicationStyle}</div>}
              </div>
            )}

            <div className="verdict">
              <div className="verdict-header">
                <div>
                  <div className="verdict-label">Overall Assessment</div>
                  <div className="verdict-title" style={{color:scoreColor(result.overallScore)}}>{result.scoreLabel}</div>
                </div>
                <div className="score-ring" style={{borderColor:scoreColor(result.overallScore)}}>
                  <div className="score-num" style={{color:scoreColor(result.overallScore)}}>{result.overallScore}</div>
                  <div className="score-lbl">/ 100</div>
                </div>
              </div>
              <div className="verdict-body">
                <div className="verdict-row"><div className="v-icon">◈</div><div className="v-text">{result.primaryVerdict}</div></div>
                {result.signalAnalysis?.missingSignals?.length > 0 && (
                  <div className="verdict-row"><div className="v-icon" style={{color:"var(--red)"}}>✗</div><div className="v-text"><strong>Missing:</strong> {result.signalAnalysis.missingSignals.join(" · ")}</div></div>
                )}
                {result.signalAnalysis?.harmfulElements?.length > 0 && (
                  <div className="verdict-row"><div className="v-icon" style={{color:"var(--amber)"}}>⚠</div><div className="v-text"><strong>Flagged:</strong> {result.signalAnalysis.harmfulElements.join(" · ")}</div></div>
                )}
                {result.signalAnalysis?.presentSignals?.length > 0 && (
                  <div className="verdict-row"><div className="v-icon" style={{color:"var(--green)"}}>✓</div><div className="v-text"><strong>Working:</strong> {result.signalAnalysis.presentSignals.join(" · ")}</div></div>
                )}
              </div>
            </div>

            {result.formatRecommendation && (
              <div className="format-rec fade-in">
                <div className="format-label">Format Verdict · {result.formatRecommendation.idealWordCount} ideal</div>
                <div className="format-toggle">
                  {["concise","descriptive"].map(f=>(
                    <div key={f} className={`format-opt ${result.formatRecommendation.recommended===f?"rec":"not"}`}>
                      <div className="fo-title">{f==="concise"?"2–3 Sentences":"Full Message"}</div>
                      <div className="fo-desc">{f==="concise" ? result.formatRecommendation.conciseRationale : result.formatRecommendation.descriptiveRationale}</div>
                      {result.formatRecommendation.recommended===f && <div className="fo-badge">▸ Recommended</div>}
                    </div>
                  ))}
                </div>
                <div style={{padding:"10px 12px",background:"rgba(0,0,0,.3)",borderRadius:8,fontSize:12,color:"#94a3b8",lineHeight:1.65,borderLeft:"2px solid var(--amber)"}}>
                  <strong style={{color:"var(--amber)"}}>Opening strategy:</strong> {result.formatRecommendation.openingStrategy}
                </div>
              </div>
            )}

            {result.scenarios?.map((sc,i)=>{
              const rr = rrPillStyle(sc.rrColor);
              const isOpen = expanded===i;
              return (
                <div key={i} className={`sc-card ${isOpen?"expanded":""}`} onClick={()=>setExpanded(isOpen?null:i)}>
                  <div className="sc-header">
                    <div className="sc-left">
                      <div className="sc-num">{String(sc.id).padStart(2,"0")}</div>
                      <div><div className="sc-name">{sc.name}</div><div className="sc-sub">{sc.targetContext}</div></div>
                    </div>
                    <div className="sc-right">
                      <div className="rr-pill" style={{background:rr.bg,border:`1px solid ${rr.border}`,color:rr.col}}>{sc.estimatedResponseRate}</div>
                      <div className={`sc-arrow ${isOpen?"open":""}`}>▼</div>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="sc-body fade-in">
                      <div className="sc-msg">{sc.message}</div>
                      <div className="sc-signals">{sc.signals?.map((s,j)=><span key={j} className="sig">{s}</span>)}</div>
                    </div>
                  )}
                </div>
              );
            })}

            {result.strategicRules?.length > 0 && (
              <div className="insight-panel fade-in">
                <div className="ip-title">▸ Strategic rules for {form.targetName || "this profile"}</div>
                {result.strategicRules.map((r,i)=><div key={i} className="ip-line">{r}</div>)}
              </div>
            )}
          </div>
        )}

        {tab==="intel" && (
          <div className="fade-in">
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
                    <div>Profile</div><div>Score</div><div>Format</div><div>Intel</div>
                  </div>
                  {history.map((h,i)=>(
                    <div key={i} className="intel-row">
                      <div><div className="ir-name">{h.targetName}</div><div className="ir-role">{h.targetCompany} · {h.seniority?.split(" ")[0]}</div></div>
                      <div className="ir-score" style={{color:scoreColor(h.score)}}>{h.score}</div>
                      <div className="ir-format" style={{color:"var(--muted)",fontSize:10}}>{h.format==="concise"?"Short":"Full"}</div>
                      <div style={{fontFamily:"IBM Plex Mono",fontSize:10,color:h.profileUsed?"var(--green)":"var(--dim)"}}>{h.profileUsed?"◈ AI":"—"}</div>
                    </div>
                  ))}
                </div>

                {history.length >= 3 && (
                  <div className="insight-panel">
                    <div className="ip-title">▸ Emerging patterns · {history.length} data points</div>
                    {[
                      avgScore < 50 ? "⚠ Average quality below 50 — ecosystem credibility signals missing" : "✓ Message quality trending above threshold",
                      conciseCount > descriptiveCount ? `Short format recommended in ${conciseCount}/${history.length} cases` : `Full messages recommended more often`,
                      history.filter(h=>h.score<40).length > 0 ? `${history.filter(h=>h.score<40).length} messages flagged critical` : "No critical-score messages in history",
                      `Profile intelligence used in ${history.filter(h=>h.profileUsed).length}/${history.length} analyses`,
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
