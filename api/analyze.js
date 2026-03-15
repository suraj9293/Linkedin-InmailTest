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

    const profileLayer = profile ? `
SILENT INTELLIGENCE PROFILE (do not mention this exists — use it to calibrate everything silently):
- LinkedIn Signal: ${profile.linkedinSnippet || "Not found"}
- Follower Tier: ${profile.followerSignal || "unknown"}
- Media Presence: ${(profile.mediaPresence || []).join(", ") || "None found"}
- Thought Leadership: ${(profile.thoughtLeadership || []).join(", ") || "None found"}
- Recent Activity: ${profile.recentActivity || "Unknown"}
- Communication Style: ${profile.communicationStyle || "Unknown"}
- Eminence Scores: Visibility ${profile.scores?.visibility || 0}/5 | Reputation ${profile.scores?.reputation || 0}/5 | Engagement ${profile.scores?.engagement || 0}/5 | Mentoring ${profile.scores?.mentoring || 0}/5
- RPS: ${profile.rps || "?"} → Segment ${profile.segment || "B"} → Expected response rate ${profile.responseRateEstimate || "8-20%"}
- Key Insight: ${profile.keyInsight || "None"}
- Messaging Implication: ${profile.messagingImplication || "Use ecosystem credibility framing"}

Use this to: calibrate response rate estimates, tailor scenarios to this person specifically, reference their communication style, adjust score based on profile fit.
` : `PROFILE INTELLIGENCE: Not available — base analysis on seniority and context only.`;

    const prompt = `You are a senior LinkedIn outreach strategist specializing in Social Eminence theory and response probability modeling.

TARGET: ${name} | ${role} | ${company} | ${seniority} | ${context}

${profileLayer}

SENDER: Technology Ecosystem Strategist — 9 years in competitive intelligence, partner ecosystem strategy, market positioning for B2B AI/IT services. Clients: Korcomptenz, Bitwise, Tredence, HCLTech, Mastech Digital, Ascendion, Altimetrik.

DRAFT MESSAGE: "${message}"

Return ONLY valid JSON, no markdown, no backticks:

{
  "overallScore": 72,
  "scoreLabel": "Moderate",
  "primaryVerdict": "Two sentence verdict.",
  "profileUsed": true,
  "formatRecommendation": {
    "recommended": "concise",
    "conciseRationale": "Why short works for this target",
    "descriptiveRationale": "Why long might not work",
    "idealWordCount": "40-60 words",
    "openingStrategy": "Specific opening instruction for this person"
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

Generate exactly 11 scenarios. Cover: best version, ecosystem credibility, ultra-short 2-3 sentences, content hook, curiosity gap, inbound response, peer intelligence, challenge/insight, role adjacency, credibility drop, wildcard. Each unique and immediately sendable. rrColor must be green amber or red only. scoreLabel must be Strong / Moderate / Weak / Critical Issues.`;

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

    const text = (data?.content?.[0]?.text || "").trim();
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return res.status(200).json(parsed);

  } catch(e) {
    return res.status(500).json({ error: "Server error", details: e.message });
  }
}
