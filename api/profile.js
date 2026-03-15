export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { name, company, role } = req.body || {};
    if (!name || !company) return res.status(400).json({ error: "Name and company required" });

    const prompt = `You are a Social Eminence intelligence analyst. Search the web for information about this person and build an accurate profile.

Person: ${name}
Company: ${company}
Role: ${role || "Unknown"}

Search for:
1. "${name} ${company}" — background, current role, general presence
2. "${name} LinkedIn" — LinkedIn signals, followers, headline
3. "${name} keynote OR podcast OR panel OR interview OR article" — thought leadership
4. "${name} ${company} news" — recent media, press coverage

Based on what you find, return ONLY valid JSON, no markdown, no backticks:

{
  "found": true,
  "displayName": "",
  "currentRole": "",
  "company": "",
  "linkedinSnippet": "",
  "followerSignal": "low",
  "mediaPresence": [],
  "thoughtLeadership": [],
  "recentActivity": "",
  "communicationStyle": "",
  "scores": {
    "visibility": 2,
    "reputation": 2,
    "engagement": 2,
    "mentoring": 2
  },
  "rps": 5,
  "segment": "B",
  "responseRateEstimate": "8-20%",
  "keyInsight": "",
  "messagingImplication": ""
}

Scoring rules:
- visibility 0-5: follower count mentions, Top Voice badge, media frequency
- reputation 0-5: firm prestige, publications, cited expertise, executive level
- engagement 0-5: post frequency, community responses, comment activity
- mentoring 0-5: advisory roles, coaching signals, community building
- rps = engagement + mentoring + (reputation/2) - visibility_penalty
  where visibility_penalty = 0 if visibility < 2, 1 if 2-3, 2 if >= 4
- segment: A if rps >= 9, B if rps 6-8, C if rps <= 5
- followerSignal: low (<1000), medium (1k-10k), high (10k+), unknown
- communicationStyle: infer from their content — data-driven, narrative, tactical, conceptual etc
- keyInsight: one sharp sentence about what makes this person reachable or not
- messagingImplication: exact tactical advice for opening a message to this person`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: "API error", details: data });

    const textBlock = data.content?.find(b => b.type === "text");
    const raw = (textBlock?.text || "").trim();
    const cleaned = raw.replace(/```json|```/g, "").trim();

    try {
      const profile = JSON.parse(cleaned);
      return res.status(200).json(profile);
    } catch(e) {
      return res.status(200).json({
        found: false,
        scores: { visibility: 2, reputation: 2, engagement: 2, mentoring: 2 },
        rps: 5, segment: "B", responseRateEstimate: "8-20%",
        followerSignal: "unknown", keyInsight: "Profile data unavailable",
        messagingImplication: "Use ecosystem credibility framing as default"
      });
    }

  } catch(e) {
    return res.status(500).json({ error: "Server error", details: e.message });
  }
}
