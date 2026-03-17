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
      ? `LIVE WEB INTELLIGENCE (use to calibrate silently):
${profile.snippets.map((s, i) => `[${i+1}] ${s.title}\n${s.snippet}`).join("\n\n")}`
      : `WEB INTELLIGENCE: Not available — use seniority and context only.`;

    const prompt = `You are a senior LinkedIn outreach strategist. Analyze this message and generate exactly 11 scenarios.

TARGET: ${name || "Unknown"} | ${role || "Unknown"} | ${company || "Unknown"} | ${seniority || "Unknown"} | ${context || "Cold outreach"}

${serperLayer}

SENDER: Technology Ecosystem Strategist — 9 years in competitive intelligence, partner ecosystem strategy, market positioning for B2B AI/IT services. Clients: Korcomptenz, Bitwise, Tredence, HCLTech, Mastech Digital, Ascendion, Altimetrik.

DRAFT MESSAGE: "${message}"

FORMAT DECISION RULES:
- Cold outreach to Director / VP / C-Suite / Founder → concise (2 sentences max)
- Cold outreach to Hiring Manager or Recruiter → concise by default
- Responding to their inbound → descriptive
- Referral / mutual connection → descriptive
- Following up on a post/article → concise
- Founder / Operator target → concise

IMPORTANT: Always generate real, usable scenarios. Never return PLACEHOLDER or BLOCKED. Use available information — even partial data is enough to generate calibrated outreach. If some profile data is missing, make reasonable inferences from seniority and context.

Return ONLY valid JSON, no markdown, no backticks, nothing after the closing brace:

{
  "overallScore": 45,
  "scoreLabel": "Moderate",
  "primaryVerdict": "Two sentence verdict here.",
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
    "keyInsight": "One sharp sentence about reachability.",
    "communicationStyle": "data-driven"
  },
  "formatRecommendation": {
    "recommended": "concise",
    "conciseRationale": "Specific reason for this person.",
    "descriptiveRationale": "Why longer would not work here.",
    "idealWordCount": "35-50 words",
    "openingStrategy": "Specific opening instruction for this person.",
    "whyFormat": "2-3 sentences tied to this profile specifically."
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
      "message": "Full ready-to-send message here.",
      "signals": ["signal1", "signal2"]
    }
  ],
  "strategicRules": ["Rule 1", "Rule 2", "Rule 3", "Rule 4"]
}

Generate exactly 11 scenarios covering: best version, ecosystem credibility, ultra-short 2-3 sentences, content hook, curiosity gap, inbound response, peer intelligence, challenge/insight, role adjacency, credibility drop, wildcard. Each must be unique and immediately sendable. rrColor must be green amber or red. scoreLabel must be Strong / Moderate / Weak / Critical Issues.`;

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
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) {
      return res.status(500).json({ error: "No JSON found", raw: raw.slice(0, 200) });
    }
    const parsed = JSON.parse(raw.slice(start, end + 1));

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
            data_source: "real",
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
