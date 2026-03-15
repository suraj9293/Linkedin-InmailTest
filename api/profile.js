export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { name, company, role } = req.body || {};
    if (!name || !company) return res.status(400).json({ error: "Name and company required" });

    // ── STAGE 1: Claude web_search ──────────────────────────────
    const claudeProfile = await runClaudeSearch(name, company, role);

    if (claudeProfile.found === true && claudeProfile.followerSignal !== "unknown") {
      return res.status(200).json({ ...claudeProfile, source: "claude" });
    }

    // ── STAGE 2: Serper fallback ────────────────────────────────
    if (process.env.SERPER_KEY) {
      const snippets = await runSerperSearch(name, company);
      if (snippets.length > 0) {
        const enriched = await scoreFromSnippets(snippets, name, company, role);
        if (enriched.found) {
          return res.status(200).json({ ...enriched, source: "serper" });
        }
      }
    }

    // ── FINAL FALLBACK ──────────────────────────────────────────
    return res.status(200).json({
      found: false,
      source: "fallback",
      displayName: name,
      currentRole: role,
      company,
      linkedinSnippet: "",
      followerSignal: "unknown",
      mediaPresence: [],
      thoughtLeadership: [],
      recentActivity: "Unknown",
      communicationStyle: "Unknown",
      scores: { visibility: 2, reputation: 2, engagement: 2, mentoring: 2 },
      rps: 5,
      segment: "B",
      responseRateEstimate: "8-20%",
      keyInsight: "No public profile data found — defaulting to seniority-based scoring",
      messagingImplication: "Use ecosystem credibility framing as default approach"
    });

  } catch(e) {
    return res.status(500).json({ error: "Server error", details: e.message });
  }
}

// ── CLAUDE WEB_SEARCH ─────────────────────────────────────────────────────────
async function runClaudeSearch(name, company, role) {
  const prompt = `You are a Social Eminence intelligence analyst. Search the web for this person and build an accurate profile.

Person: ${name}
Company: ${company}
Role: ${role || "Unknown"}

Search for:
1. "${name} ${company}" — background, current role
2. "${name} LinkedIn" — LinkedIn signals, followers, headline
3. "${name} keynote OR podcast OR panel OR interview" — thought leadership
4. "${name} ${company} news" — recent media coverage

Return ONLY valid JSON, no markdown, no backticks:

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
  "scores": { "visibility": 2, "reputation": 2, "engagement": 2, "mentoring": 2 },
  "rps": 5,
  "segment": "B",
  "responseRateEstimate": "8-20%",
  "keyInsight": "",
  "messagingImplication": ""
}

Scoring:
- visibility 0-5: follower count, Top Voice badge, media frequency
- reputation 0-5: firm prestige, publications, executive seniority
- engagement 0-5: post frequency, community interaction
- mentoring 0-5: advisory roles, coaching, community building
- rps = engagement + mentoring + floor(reputation/2) - visibility_penalty
  visibility_penalty: 0 if visibility<2, 1 if 2-3, 2 if >=4
- segment: A if rps>=9, B if rps 6-8, C if rps<=5
- followerSignal: low(<1k), medium(1k-10k), high(10k+), unknown
- If you cannot confidently identify this person set found: false`;

  try {
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
    if (!r.ok) return { found: false };

    const textBlock = data.content?.find(b => b.type === "text");
    const raw = (textBlock?.text || "").trim();
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch(e) {
    return { found: false };
  }
}

// ── SERPER SEARCH ─────────────────────────────────────────────────────────────
async function runSerperSearch(name, company) {
  const queries = [
    `${name} ${company} LinkedIn`,
    `${name} ${company} VP OR Director OR Manager`,
    `${name} ${company} keynote OR interview OR article`
  ];

  const results = [];

  for (const q of queries) {
    try {
      const r = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": process.env.SERPER_KEY
        },
        body: JSON.stringify({ q, num: 5 })
      });
      const data = await r.json();
      const organic = data.organic || [];
      organic.forEach(item => {
        if (item.title || item.snippet) {
          results.push({
            title: item.title || "",
            snippet: item.snippet || "",
            link: item.link || ""
          });
        }
      });
    } catch(e) {}
  }

  return results;
}

// ── SCORE FROM SERPER SNIPPETS ────────────────────────────────────────────────
async function scoreFromSnippets(snippets, name, company, role) {
  const snippetText = snippets
    .map((s, i) => `[${i+1}] ${s.title}\n${s.snippet}\n${s.link}`)
    .join("\n\n");

  const prompt = `You are a Social Eminence analyst. Based on these Google search result snippets, build a profile for ${name} at ${company}.

SEARCH RESULTS:
${snippetText}

Return ONLY valid JSON, no markdown, no backticks:

{
  "found": true,
  "displayName": "",
  "currentRole": "",
  "company": "",
  "linkedinSnippet": "",
  "followerSignal": "unknown",
  "mediaPresence": [],
  "thoughtLeadership": [],
  "recentActivity": "",
  "communicationStyle": "",
  "scores": { "visibility": 2, "reputation": 2, "engagement": 2, "mentoring": 2 },
  "rps": 5,
  "segment": "B",
  "responseRateEstimate": "8-20%",
  "keyInsight": "",
  "messagingImplication": ""
}

Extract follower count if visible in snippets (e.g. "4,800 followers" = medium).
If snippets don't match this person clearly, set found: false.
Scoring rules same as before:
- rps = engagement + mentoring + floor(reputation/2) - visibility_penalty
- segment A>=9, B 6-8, C<=5`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await r.json();
    if (!r.ok) return { found: false };

    const textBlock = data.content?.find(b => b.type === "text");
    const raw = (textBlock?.text || "").trim();
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch(e) {
    return { found: false };
  }
}
