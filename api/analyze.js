export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const b = req.body || {};
    const name = b.targetName || b.target_name || "";
    const company = b.targetCompany || b.company || "";
    const role = b.targetRole || b.role || "";
    const seniority = b.seniority || "";
    const context = b.context || b.contactContext || b.contact_context || "";
    const message = b.message || b.draftMessage || b.draft_message || "";
    const profile = b.profile || null;

    const serperLayer = profile?.snippets?.length > 0
      ? `
LIVE WEB INTELLIGENCE (from Google search — use to score target Social Eminence silently):
${profile.snippets.map((s, i) => `[${i+1}] ${s.title}\n${s.snippet}`).join("\n\n")}

Infer from above: seniority confirmation, follower tier, thought leadership, communication style, reachability. Score visibility/reputation/engagement/mentoring 0-5 each and calibrate scenario response rates.
`
      : `WEB INTELLIGENCE: Not available — base analysis on seniority and context only.`;

    const prompt = `You are a senior LinkedIn outreach strategist. Analyze this message and return ONLY a JSON object. No text before or after the JSON. No explanation. Just the raw JSON object starting with { and ending with }.

TARGET: ${name} | ${role} | ${company} | ${seniority} | ${context}

${serperLayer}

SENDER: Technology Ecosystem Strategist — 9 years in competitive intelligence, partner ecosystem strategy, market positioning for B2B AI/IT services. Clients: Korcomptenz, Bitwise, Tredence, HCLTech, Mastech Digital, Ascendion, Altimetrik.

DRAFT MESSAGE: "${message}"

Return this exact JSON structure and nothing else:

{
  "overallScore": 72,
  "scoreLabel": "Moderate",
  "primaryVerdict": "Two sentence verdict.",
  "profileUsed": true,
  "eminenceScores": {
    "visibility": 3,
    "reputation": 3,
    "engagement": 2,
    "mentoring": 2,
    "rps": 5,
    "segment": "B",
    "responseRateEstimate": "8-20%",
    "followerSignal": "medium",
    "keyInsight": "One sharp sentence about reachability",
    "communicationStyle": "data-driven"
  },
  "formatRecommendation": {
    "recommended": "concise",
    "conciseRationale": "Why short works",
    "descriptiveRationale": "Why long might not",
    "idealWordCount": "40-60 words",
    "openingStrategy": "How to open for this person"
  },
  "signalAnalysis": {
    "presentSignals": ["signal one"],
    "missingSignals": ["missing one"],
    "harmfulElements": ["harmful one"]
  },
  "scenarios": [
    {
      "id": 1,
      "name": "Scenario name",
      "type": "recommended",
      "targetContext": "Who this works for",
      "estimatedResponseRate": "25-35%",
      "rrColor": "green",
      "message": "Full ready-to-send message here",
      "signals": ["signal1", "signal2"]
    }
  ],
  "strategicRules": ["Rule 1", "Rule 2", "Rule 3", "Rule 4"]
}

Generate exactly 11 scenarios. Cover: best version, ecosystem credibility, ultra-short 2-3 sentences, content hook, curiosity gap, inbound response, peer intelligence, challenge/insight, role adjacency, credibility drop, wildcard. rrColor must be green amber or red. scoreLabel must be Strong / Moderate / Weak / Critical Issues. OUTPUT ONLY THE JSON OBJECT. NO OTHER TEXT.`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: "Anthropic error", details: data });

    const raw = (data?.content?.[0]?.text || "").trim();

    // Extract JSON block robustly — find first { and last }
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) {
      return res.status(500).json({ error: "No JSON found in response", raw: raw.slice(0, 200) });
    }
    const jsonStr = raw.slice(start, end + 1);
    const parsed = JSON.parse(jsonStr);

    // Write to Supabase
    if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
      try {
        const em = parsed.eminenceScores || {};
        await fetch(`${process.env.SUPABASE_URL}/rest/v1/analyses`, {
          method: "POST",
          headers: {
            "apikey": process.env.SUPABASE_KEY,
            "Authorization": `Bearer ${process.env.SUPABASE_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
          },
          body: JSON.stringify({
            target_name: name,
            target_company: company,
            target_role: role,
            seniority,
            message_preview: message.slice(0, 120),
            word_count: message.trim().split(/\s+/).filter(Boolean).length,
            score: parsed.overallScore,
            score_label: parsed.scoreLabel,
            format: parsed.formatRecommendation?.recommended,
            profile_used: !!(profile?.snippets?.length > 0),
            profile_source: profile?.source || null,
            rps: em.rps || null,
            segment: em.segment || null,
            response_rate: em.responseRateEstimate || null,
            key_insight: em.keyInsight || null
          })
        });
      } catch(dbErr) {
        console.error("Supabase write failed:", dbErr.message);
      }
    }

    return res.status(200).json(parsed);

  } catch(e) {
    return res.status(500).json({ error: "Server error", details: e.message });
  }
}
