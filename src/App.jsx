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

// ── N-GRAM WORD CLOUD ─────────────────────────────────────────────────────────
function NgramCloud({ items, maxCount }) {
  if (!items || items.length === 0) return <div style={{color:"var(--text-3)",fontSize:12,padding:"20px 0",textAlign:"center"}}>Not enough data yet</div>;
  return (
    <div style={{display:"flex",flexWrap:"wrap",gap:8,padding:"4px 0"}}>
      {items.slice(0,25).map((item, i) => {
        const size = 11 + Math.round((item.count / maxCount) * 10);
        const score = item.avgScore || 50;
        const heat = score >= 70 ? "#f59e0b" : score >= 50 ? "#94a3b8" : "#475569";
        const bg = score >= 70 ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.04)";
        return (
          <span key={i} style={{
            fontSize: size,
            color: heat,
            background: bg,
            border: `1px solid ${score >= 70 ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.08)"}`,
            borderRadius: 20,
            padding: "3px 10px",
            fontWeight: score >= 70 ? 600 : 400,
            transition: "all 0.2s",
            cursor: "default",
            fontFamily: "var(--font-main)"
          }}>
            {item.gram}
            <span style={{fontSize:9,color:"var(--text-3)",marginLeft:4,fontFamily:"var(--font-mono)"}}>{item.count}</span>
          </span>
        );
      })}
    </div>
  );
}

// ── SENIORITY HEATMAP ─────────────────────────────────────────────────────────
function SeniorityHeatmap({ seniorityMap, total }) {
  const entries = Object.entries(seniorityMap).sort((a,b) => b[1]-a[1]);
  const max = Math.max(...entries.map(([,v]) => v));
  return (
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      {entries.map(([label, count], i) => {
        const pct = Math.round((count/total)*100);
        const intensity = count/max;
        return (
          <div key={i} style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{fontSize:11,color:"var(--text-2)",width:160,flexShrink:0,fontFamily:"var(--font-main)"}}>{label.split(" /")[0]}</div>
            <div style={{flex:1,height:6,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden"}}>
              <div style={{
                height:"100%",
                width:`${pct}%`,
                background:`rgba(245,158,11,${0.2 + intensity*0.8})`,
                borderRadius:3,
                transition:"width 0.8s ease"
              }}/>
            </div>
            <div style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--text-3)",width:30,textAlign:"right"}}>{count}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── INSIGHTS PANEL ────────────────────────────────────────────────────────────
function InsightsPanel({ insights, compact }) {
  const [ngramTab, setNgramTab] = useState("bigrams");
  if (!insights || insights.empty) {
    return (
      <div style={{textAlign:"center",padding:"40px 20px",color:"var(--text-3)"}}>
        <div style={{fontFamily:"var(--font-mono)",fontSize:10,letterSpacing:".12em",marginBottom:8}}>NO DATA YET</div>
        <div style={{fontSize:12}}>Community intelligence builds as more messages are analyzed.</div>
      </div>
    );
  }

  const currentGrams = insights[ngramTab] || [];
  const maxCount = Math.max(...currentGrams.map(g => g.count), 1);

  const card = {background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding: compact ? "14px" : "18px",marginBottom:12};
  const sectionLabel = {fontFamily:"var(--font-mono)",fontSize:9,letterSpacing:".16em",color:"var(--text-3)",textTransform:"uppercase",marginBottom:compact?8:12};

  return (
    <div>
      {/* Header stats */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
        {[
          {val:insights.total,lbl:"Analyses",col:"var(--amber)"},
          {val:insights.avgScore||"—",lbl:"Avg Score",col:insights.avgScore>=60?"var(--green)":"var(--red)"},
          {val:insights.recentCount||0,lbl:"This Week",col:"var(--blue)"},
        ].map((k,i)=>(
          <div key={i} style={{...card,marginBottom:0,textAlign:"center",padding:"12px 8px"}}>
            <div style={{fontFamily:"var(--font-mono)",fontSize:compact?18:22,fontWeight:600,color:k.col,lineHeight:1}}>{k.val}</div>
            <div style={{fontSize:10,color:"var(--text-3)",marginTop:4,textTransform:"uppercase",letterSpacing:".06em"}}>{k.lbl}</div>
          </div>
        ))}
      </div>

      {/* Seniority heatmap */}
      <div style={card}>
        <div style={sectionLabel}>Targeting patterns</div>
        <SeniorityHeatmap seniorityMap={insights.seniorityMap} total={insights.total}/>
      </div>

      {/* Score distribution */}
      <div style={card}>
        <div style={sectionLabel}>Message quality distribution</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
          {[
            {label:"Strong",val:insights.scoreBuckets?.strong||0,col:"var(--green)"},
            {label:"Moderate",val:insights.scoreBuckets?.moderate||0,col:"var(--amber)"},
            {label:"Weak",val:insights.scoreBuckets?.weak||0,col:"var(--red)"},
            {label:"Critical",val:insights.scoreBuckets?.critical||0,col:"rgba(244,63,94,0.5)"},
          ].map((item,i)=>(
            <div key={i} style={{background:"rgba(0,0,0,0.2)",borderRadius:6,padding:"8px 10px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:11,color:"var(--text-2)"}}>{item.label}</span>
              <span style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:600,color:item.col}}>{item.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* N-gram panel */}
      <div style={card}>
        <div style={sectionLabel}>Message intelligence · resonance heatmap</div>
        <div style={{display:"flex",gap:4,marginBottom:12,background:"rgba(0,0,0,0.2)",borderRadius:6,padding:3}}>
          {["unigrams","bigrams","trigrams"].map(t=>(
            <button key={t} onClick={()=>setNgramTab(t)} style={{
              flex:1,padding:"6px 4px",borderRadius:4,border:"none",
              background:ngramTab===t?"rgba(255,255,255,0.1)":"transparent",
              color:ngramTab===t?"var(--text)":"var(--text-3)",
              fontSize:11,fontFamily:"var(--font-main)",fontWeight:600,
              cursor:"pointer",letterSpacing:".04em",textTransform:"capitalize",
              transition:"all .2s"
            }}>{t}</button>
          ))}
        </div>
        <NgramCloud items={currentGrams} maxCount={maxCount}/>
        <div style={{marginTop:10,display:"flex",gap:12,alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:8,height:8,borderRadius:2,background:"rgba(245,158,11,0.5)"}}/>
            <span style={{fontSize:10,color:"var(--text-3)"}}>High scoring</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:8,height:8,borderRadius:2,background:"rgba(255,255,255,0.15)"}}/>
            <span style={{fontSize:10,color:"var(--text-3)"}}>Neutral</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:8,height:8,borderRadius:2,background:"rgba(71,85,105,0.5)"}}/>
            <span style={{fontSize:10,color:"var(--text-3)"}}>Low scoring</span>
          </div>
        </div>
      </div>

      {/* Format split */}
      <div style={card}>
        <div style={sectionLabel}>Recommended format split</div>
        <div style={{display:"flex",gap:10}}>
          {[
            {label:"Concise",val:insights.formatMap?.concise||0,col:"var(--amber)"},
            {label:"Descriptive",val:insights.formatMap?.descriptive||0,col:"var(--blue)"},
          ].map((item,i)=>{
            const total = (insights.formatMap?.concise||0)+(insights.formatMap?.descriptive||0);
            const pct = total ? Math.round((item.val/total)*100) : 0;
            return (
              <div key={i} style={{flex:1,background:"rgba(0,0,0,0.2)",borderRadius:6,padding:"10px 12px",textAlign:"center"}}>
                <div style={{fontFamily:"var(--font-mono)",fontSize:20,fontWeight:600,color:item.col}}>{pct}%</div>
                <div style={{fontSize:10,color:"var(--text-3)",marginTop:3}}>{item.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
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
  const [senderBg, setSenderBg] = useState('');
  const [showSenderSetup, setShowSenderSetup] = useState(false);
  const [profileStatus, setProfileStatus] = useState("idle");
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
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
    fetchInsights();
      const saved = localStorage.getItem('sender_background');
      if (saved) setSenderBg(saved);
  }, []);

  async function fetchInsights() {
    setInsightsLoading(true);
    try {
      const r = await fetch("/api/insights");
      const data = await r.json();
      setInsights(data);
    } catch(e) {}
    setInsightsLoading(false);
  }

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
        if (data && data.found !== undefined) { setProfile(data); setProfileStatus(data.found ? "ready" : "failed"); }
        else setProfileStatus("failed");
      } catch(e) { setProfileStatus("failed"); }
    }, 3000);
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
    // Fetch fresh insights while analyzing
    fetchInsights();
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
          senderBackground: senderBg || null,
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
      // Refresh insights after analysis completes
      fetchInsights();
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

  const profileIndicator = {
    idle: null,
    loading: { text: "Scanning profile...", color: "var(--text-3)" },
    ready: { text: `◈ Profile scan complete · ${profile?.snippets?.length || 0} signals found`, color: "var(--green)" },
    failed: { text: "Profile scan incomplete — analyzing from form inputs", color: "var(--amber)" }
  }[profileStatus];

  return (
    <>
      <div className="gradient-canvas"/>
      <div className="app">
        <div className="hd">
          <div className="brand">
            <div className="brand-logo">MI</div>
            <div className="brand-name">Message Intelligence</div>
          </div>
          <div className="hd-pre">Message Intelligence Engine</div>
          <div className="hd-title">Should you write <span>2 lines</span><br/>or 2 paragraphs?</div>
          <div className="hd-sub">Paste your draft. Get 11 scenarios, a format verdict, and response probability scoring — calibrated to your target's Social Eminence profile.</div>
        </div>

        <div className="tabs">
          <button className={`tab ${tab==="analyze"?"on":""}`} onClick={()=>setTab("analyze")}>Analyze</button>
          <button className={`tab ${tab==="result"?"on":""}`} onClick={()=>setTab("result")} disabled={!result}>Results</button>
          <button className={`tab ${tab==="intel"?"on":""}`} onClick={()=>setTab("intel")}>My Data</button>
          <button className={`tab ${tab==="community"?"on":""}`} onClick={()=>{setTab("community");fetchInsights();}}>Intelligence</button>
        </div>

        {/* ── ANALYZE TAB ── */}
        {tab==="analyze" && !loading && (
          <div className="fade-in">
            <div className="field-row">
              <div className="field">
                <div className="flabel">Target Name</div>
                <input placeholder="Full name" value={form.targetName} onChange={e=>setField("targetName",e.target.value)} />
              </div>
              <div className="field">
                <div className="flabel">Company</div>
                <input placeholder="Company name" value={form.targetCompany} onChange={e=>setField("targetCompany",e.target.value)} />
              </div>
            </div>

            {profileIndicator && (
              <div style={{marginTop:-4,marginBottom:12,padding:"7px 12px",borderRadius:6,background:"rgba(0,0,0,0.25)",border:`1px solid ${profileIndicator.color}25`,display:"flex",alignItems:"center",gap:8}}>
                {profileStatus==="loading" && <div style={{width:7,height:7,borderRadius:"50%",border:"1.5px solid var(--text-3)",borderTopColor:"var(--amber)",animation:"spin 0.7s linear infinite",flexShrink:0}}/>}
                <span style={{fontFamily:"var(--font-mono)",fontSize:10,color:profileIndicator.color,letterSpacing:".08em"}}>{profileIndicator.text}</span>
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
              <textarea placeholder="Paste your message here. Write it exactly as you would send it." value={form.message} onChange={e=>setField("message",e.target.value)} rows={7}/>
            </div>

            <div style={{marginBottom:14}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:showSenderSetup?10:0,cursor:'pointer'}} onClick={()=>setShowSenderSetup(s=>!s)}>
                <span style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text-3)',letterSpacing:'.14em',textTransform:'uppercase'}}>
                  {senderBg ? '◈ About you · set' : '◈ About you · not set'}
                </span>
                <span style={{fontSize:10,color:'var(--text-3)'}}>{showSenderSetup?'▲':'▼'}</span>
              </div>
              {showSenderSetup && (
                <div style={{marginTop:8}}>
                  <textarea
                    rows={3}
                    placeholder="Describe yourself in 2-3 sentences. Include your role, what you do, and 2-3 named clients or firms you've worked with."
                    value={senderBg}
                    onChange={e=>{setSenderBg(e.target.value);localStorage.setItem('sender_background',e.target.value);}}
                    style={{fontSize:13,lineHeight:1.6}}
                  />
                  <div style={{fontSize:11,color:'var(--text-3)',marginTop:5}}>Stored locally. Used to personalize every analysis.</div>
                </div>
              )}
            </div>
            <button className="analyze-btn" onClick={analyze} disabled={loading || !form.message.trim() || !form.targetName.trim()}>
              {profileStatus==="ready" ? "▶ Analyze with Profile Intelligence" : "▶ Analyze Message + Generate Scenarios"}
            </button>

            {error && <div style={{marginTop:14,padding:"12px 14px",background:"rgba(244,63,94,.08)",border:"1px solid rgba(244,63,94,.25)",borderRadius:8,fontSize:12,color:"var(--red)"}}>{error}</div>}
          </div>
        )}

        {/* ── SPLIT LOADING STATE ── */}
        {loading && (
          <div className="fade-in" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,alignItems:"start"}}>
            {/* Left — progress */}
            <div style={{paddingTop:20}}>
              <div style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--text-3)",letterSpacing:".12em",textTransform:"uppercase",marginBottom:20}}>Processing</div>
              {loadingSteps.map((step,i)=>{
                const current = loadingSteps.indexOf(loadingStep);
                const done = i < current;
                const active = i === current;
                return (
                  <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
                    <div style={{
                      width:18,height:18,borderRadius:"50%",flexShrink:0,
                      background:done?"var(--green)":active?"var(--amber)":"transparent",
                      border:`1px solid ${done?"var(--green)":active?"var(--amber)":"rgba(255,255,255,0.12)"}`,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:9,color:"#08090d",fontWeight:700
                    }}>
                      {done?"✓":active?<div style={{width:6,height:6,borderRadius:"50%",background:"#08090d"}}/>:""}
                    </div>
                    <span style={{fontSize:12,color:active?"var(--text)":done?"var(--text-2)":"var(--text-3)",fontWeight:active?600:400}}>{step}</span>
                  </div>
                );
              })}
              <div style={{marginTop:20,height:1,background:"var(--border)",overflow:"hidden",borderRadius:1}}>
                <div className="loading-fill"/>
              </div>
            </div>

            {/* Right — live intelligence preview */}
            <div>
              <div style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--amber)",letterSpacing:".12em",textTransform:"uppercase",marginBottom:16}}>◈ Live Community Intelligence</div>
              {insightsLoading && !insights ? (
                <div style={{color:"var(--text-3)",fontSize:12,textAlign:"center",padding:20}}>Loading intelligence...</div>
              ) : (
                <InsightsPanel insights={insights} compact={true}/>
              )}
            </div>
          </div>
        )}

        {/* ── RESULTS TAB ── */}
        {tab==="result" && result && (
          <div className="fade-in">
            {profile && profile.found && (
              <div style={{background:"rgba(16,185,129,.04)",border:"1px solid rgba(16,185,129,.18)",borderRadius:10,padding:"14px 16px",marginBottom:14}}>
                <div style={{fontFamily:"var(--font-mono)",fontSize:9,color:"var(--green)",letterSpacing:".16em",textTransform:"uppercase",marginBottom:10}}>◈ Profile Intelligence Used</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                  {[
                    ["RPS Score",result.eminenceScores?.rps,"var(--amber)"],
                    ["Segment",result.eminenceScores?.segment,result.eminenceScores?.segment==="A"?"var(--green)":result.eminenceScores?.segment==="B"?"var(--amber)":"var(--red)"],
                    ["Est. Response",result.eminenceScores?.responseRateEstimate,"var(--text)"],
                    ["Follower Tier",result.eminenceScores?.followerSignal,"var(--text)"],
                  ].map(([l,v,c],i)=>(
                    <div key={i} style={{background:"rgba(0,0,0,.3)",borderRadius:6,padding:"8px 10px"}}>
                      <div style={{fontSize:10,color:"var(--text-3)",marginBottom:2}}>{l}</div>
                      <div style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:600,color:c}}>{v||"—"}</div>
                    </div>
                  ))}
                </div>
                {result.eminenceScores?.keyInsight && <div style={{fontSize:12,color:"#94a3b8",lineHeight:1.65,borderTop:"1px solid rgba(16,185,129,.12)",paddingTop:8}}><strong style={{color:"var(--green)"}}>Key insight:</strong> {result.eminenceScores.keyInsight}</div>}
                {result.eminenceScores?.communicationStyle && <div style={{fontSize:12,color:"#94a3b8",lineHeight:1.65,marginTop:4}}><strong style={{color:"var(--blue)"}}>Style:</strong> {result.eminenceScores.communicationStyle}</div>}
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
{result.formatRecommendation.whyFormat && (
  <div style={{marginTop:10,padding:'11px 14px',background:'rgba(245,158,11,.04)',border:'1px solid rgba(245,158,11,.12)',borderRadius:8}}>
    <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--amber)',letterSpacing:'.12em',textTransform:'uppercase',marginBottom:5}}>▸ Why this format for {form.targetName||'this profile'}</div>
    <div style={{fontSize:12,color:'#94a3b8',lineHeight:1.65}}>{result.formatRecommendation.whyFormat}</div>
  </div>
)}
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

        {/* ── MY DATA TAB ── */}
        {tab==="intel" && (
          <div className="fade-in">
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
              {[
                {val:totalAnalyzed,lbl:"Analyses Run",col:"var(--amber)"},
                {val:avgScore||"—",lbl:"Avg Score",col:avgScore>=60?"var(--green)":"var(--red)"},
                {val:history.filter(h=>h.profileUsed).length,lbl:"With AI Profile",col:"var(--blue)"},
              ].map((k,i)=>(
                <div key={i} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"12px 10px",textAlign:"center"}}>
                  <div style={{fontFamily:"var(--font-mono)",fontSize:22,fontWeight:600,color:k.col,lineHeight:1}}>{k.val}</div>
                  <div style={{fontSize:10,color:"var(--text-3)",marginTop:4,textTransform:"uppercase",letterSpacing:".06em"}}>{k.lbl}</div>
                </div>
              ))}
            </div>

            {history.length === 0 ? (
              <div style={{textAlign:"center",padding:"40px 0",color:"var(--text-3)"}}>
                <div style={{fontFamily:"var(--font-mono)",fontSize:11,letterSpacing:".12em",marginBottom:8}}>NO DATA YET</div>
                <div style={{fontSize:12}}>Run your first analysis to start building your personal model.</div>
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
                      <div style={{color:"var(--text-3)",fontSize:10,fontFamily:"var(--font-mono)"}}>{h.format==="concise"?"Short":"Full"}</div>
                      <div style={{fontFamily:"var(--font-mono)",fontSize:10,color:h.profileUsed?"var(--green)":"var(--text-3)"}}>{h.profileUsed?"◈":"—"}</div>
                    </div>
                  ))}
                </div>
                <button style={{width:"100%",marginTop:12,padding:"10px",borderRadius:8,border:"1px solid rgba(255,255,255,0.08)",background:"transparent",color:"var(--red)",fontSize:11,fontFamily:"var(--font-mono)",letterSpacing:".08em",cursor:"pointer",textTransform:"uppercase"}}
                  onClick={async()=>{setHistory([]);try{await window.storage.delete("outreach_history");}catch(e){}}}>
                  Clear My Data
                </button>
              </>
            )}
          </div>
        )}

        {/* ── COMMUNITY INTELLIGENCE TAB ── */}
        {tab==="community" && (
          <div className="fade-in">
            <div style={{fontFamily:"var(--font-mono)",fontSize:9,color:"var(--amber)",letterSpacing:".18em",textTransform:"uppercase",marginBottom:16}}>
              ◈ Anonymized · Patterns only · No identifiable data
            </div>
            {insightsLoading ? (
              <div style={{textAlign:"center",padding:40,color:"var(--text-3)"}}>
                <div className="loading-bar" style={{margin:"0 auto",maxWidth:200}}><div className="loading-fill"/></div>
                <div style={{fontSize:12,marginTop:12,fontFamily:"var(--font-mono)"}}>Loading intelligence...</div>
              </div>
            ) : (
              <InsightsPanel insights={insights} compact={false}/>
            )}
          </div>
        )}
      </div>
    </>
  );
}
