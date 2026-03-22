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
    const senderBackground = b.senderBackground || "Technology Ecosystem Strategist — 9 years in competitive intelligence, partner ecosystem strategy, market positioning for B2B AI/IT services. Clients: Korcomptenz, Bitwise, Tredence, HCLTech, Mastech Digital, Ascendion, Altimetrik.";

    const serperLayer = profile?.snippets?.length > 0
      ? `LIVE WEB INTELLIGENCE (use to calibrate silently):
${profile.snippets.map((s, i) => `[${i+1}] ${s.title}\n${s.snippet}`).join("\n\n")}`
      : `WEB INTELLIGENCE: Not available — use seniority and context only.`;

    const prompt = `You are a senior LinkedIn outreach strategist. Analyze this message and generate exactly 11 scenarios.

TARGET: ${name || "Unknown"} | ${role || "Unknown"} | ${company || "Unknown"} | ${seniority || "Unknown"} | ${context || "Cold outreach"}

${serperLayer}

SENDER: ${senderBackground}

DRAFT MESSAGE: "${message}"

FORMAT DECISION RULES:
- Cold outreach to Director / VP / C-Suite / Founder → concise (2 sentences max)
- Cold outreach to Hiring Manager or Recruiter → concise by default
- Responding to their inbound → descriptive
- Referral / mutual connection → descriptive
- Following up on a post/article → concise
- Founder / Operator target → concise

INTENT INFERENCE — silently detect from the draft message:
- intent: one of ecosystem_intel / sales_conversation / peer_exchange / partnership / opportunity_exploration / community
- desired_outcome: one of call_scheduled / reply_received / intro_made / awareness / meeting_booked

Use detected intent to shape scenario framing:
- ecosystem_intel → lead with curiosity and peer observation
- sales_conversation → include a commercial signal naturally
- opportunity_exploration → reframe as market research not job-seeking
- peer_exchange → lead with what sender brings, not what they want
- partnership → lead with mutual value
- community → low-friction ask, long horizon

IMPORTANT: Always generate real, usable scenarios. Never return PLACEHOLDER or BLOCKED. Use available information — even partial data is enough. If profile data is missing, infer from seniority and context.

Return ONLY valid JSON, no markdown, no backticks, nothing after the closing brace:

{
  "overallScore": 45,
  "scoreLabel": "Moderate",
  "primaryVerdict": "Two sentence verdict here.",
  "profileUsed": true,
  "intent": "ecosystem_intel",
  "desiredOutcome": "call_scheduled",
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

Generate exactly 11 scenarios covering: best version, ecosystem credibility, ultra-short 2-3 sentences, content hook, curiosity gap, inbound response, peer intelligence, challenge/insight, role adjacency, credibility drop, wildcard. Each unique and immediately sendable. rrColor must be green amber or red. scoreLabel must be Strong / Moderate / Weak / Critical Issues.`;

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

    let parsed;
    try {
      parsed = JSON.parse(raw.slice(start, end + 1));
    } catch(parseErr) {
      return res.status(500).json({ error: "JSON parse failed", details: parseErr.message });
    }

    // ── Write to Supabase BEFORE response with 3s timeout ──
    if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
      try {
        const em = parsed?.eminenceScores || {};
        const inferredIntent = parsed?.intent || null;
        const inferredOutcome = parsed?.desiredOutcome || null;
        const sa = parsed?.signalAnalysis || {};
        const fr = parsed?.formatRecommendation || {};
        const snippetCount = profile?.snippets?.length || 0;

        const dbPayload = {
          target_name: name || null,
          target_company: company || null,
          target_role: role || null,
          seniority: seniority || null,
          message_preview: message ? message.slice(0, 120) : null,
          word_count: message ? message.trim().split(/\s+/).filter(Boolean).length : null,
          score: parsed?.overallScore || null,
          score_label: parsed?.scoreLabel || null,
          format: fr?.recommended || null,
          profile_used: snippetCount > 0,
          profile_source: profile?.source || null,
          data_source: "real",
          rps: em?.rps || null,
          segment: em?.segment || null,
          response_rate: em?.responseRateEstimate || null,
          key_insight: em?.keyInsight || null,
          communication_style: em?.communicationStyle || null,
          follower_signal: em?.followerSignal || null,
          serper_snippet_count: snippetCount,
          primary_signal: sa?.presentSignals?.[0] || null,
          missing_signal: sa?.missingSignals?.[0] || null,
          harmful_element: sa?.harmfulElements?.[0] || null,
          opening_strategy: fr?.openingStrategy || null,
          intent: inferredIntent,
          desired_outcome: inferredOutcome,
          sender_name: null,
          sender_company: null,
          message_full: null,
          consent_storage: false
        };

        // 3 second timeout — never blocks user
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("DB timeout")), 3000)
        );
        const writeOp = fetch(`${process.env.SUPABASE_URL}/rest/v1/analyses`, {
          method: "POST",
          headers: {
            "apikey": process.env.SUPABASE_KEY,
            "Authorization": `Bearer ${process.env.SUPABASE_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
          },
          body: JSON.stringify(dbPayload)
        });

        await Promise.race([writeOp, timeout]);
      } catch(dbErr) {
        console.error("Supabase write failed:", dbErr.message);
      }
    }

    // ── Return result after DB write completes or times out ──
    return res.status(200).json(parsed);

  } catch(e) {
    return res.status(500).json({ error: "Server error", details: e.message });
  }
}
