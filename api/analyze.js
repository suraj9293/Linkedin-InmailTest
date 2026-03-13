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

    const prompt = `You are a LinkedIn outreach expert. Analyze this message and return ONLY a valid JSON object, no markdown, no backticks.

JSON structure required:
{
  "overallScore": 72,
  "scoreLabel": "Moderate",
  "primaryVerdict": "Two sentence verdict here.",
  "formatRecommendation": {
    "recommended": "concise",
    "conciseRationale": "Why short works",
    "descriptiveRationale": "Why long might not",
    "idealWordCount": "40-60 words",
    "openingStrategy": "How to open this message"
  },
  "signalAnalysis": {
    "presentSignals": ["signal one", "signal two"],
    "missingSignals": ["missing one", "missing two"],
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

Generate exactly 11 scenarios. rrColor must be green, amber, or red only.

TARGET: ${name} | ${role} | ${company} | ${seniority} | ${context}
DRAFT: ${message}`;

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

  } catch (e) {
    return res.status(500).json({ error: "Server error", details: e.message });
  }
}
