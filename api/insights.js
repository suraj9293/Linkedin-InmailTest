export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
      return res.status(200).json({ empty: true });
    }

    const r = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/analyses?select=seniority,score,score_label,format,message_preview,segment,rps,created_at&order=created_at.desc&limit=500`,
      {
        headers: {
          "apikey": process.env.SUPABASE_KEY,
          "Authorization": `Bearer ${process.env.SUPABASE_KEY}`
        }
      }
    );

    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(200).json({ empty: true, total: 0 });
    }

    // ── Seniority distribution
    const seniorityMap = {};
    rows.forEach(row => {
      const s = row.seniority || "Unknown";
      seniorityMap[s] = (seniorityMap[s] || 0) + 1;
    });

    // ── Score distribution buckets
    const scoreBuckets = { strong: 0, moderate: 0, weak: 0, critical: 0 };
    rows.forEach(row => {
      const s = (row.score_label || "").toLowerCase();
      if (s.includes("strong")) scoreBuckets.strong++;
      else if (s.includes("moderate")) scoreBuckets.moderate++;
      else if (s.includes("weak")) scoreBuckets.weak++;
      else if (s.includes("critical")) scoreBuckets.critical++;
    });

    // ── Format distribution
    const formatMap = { concise: 0, descriptive: 0 };
    rows.forEach(row => {
      if (row.format === "concise") formatMap.concise++;
      else if (row.format === "descriptive") formatMap.descriptive++;
    });

    // ── Segment distribution
    const segmentMap = { A: 0, B: 0, C: 0 };
    rows.forEach(row => {
      if (row.segment === "A") segmentMap.A++;
      else if (row.segment === "B") segmentMap.B++;
      else if (row.segment === "C") segmentMap.C++;
    });

    // ── Average score
    const scores = rows.map(r => r.score).filter(s => s != null && s > 0);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    // ── Message text for n-gram extraction (anonymized — text only)
    const messageTexts = rows
      .map(r => r.message_preview || "")
      .filter(t => t.length > 10)
      .map(t => ({ text: t.toLowerCase(), score: rows.find(r => r.message_preview === t)?.score || 50 }));

    // ── N-gram extraction with score weighting
    const stopWords = new Set([
      "i","me","my","we","our","you","your","the","a","an","and","or","but",
      "in","on","at","to","for","of","with","is","are","was","were","be","been",
      "have","has","had","do","did","will","would","could","should","may","might",
      "this","that","these","those","it","its","as","by","from","up","about",
      "into","through","during","before","after","above","below","hi","dear",
      "hello","hope","well","please","thank","thanks","regards","best","sincerely",
      "would","like","just","also","very","much","more","than","some","been",
      "if","so","not","no","yes","can","he","she","they","them","their","there",
      "then","when","where","who","what","how","all","any","both","each","few"
    ]);

    function tokenize(text) {
      return text.replace(/[^a-z\s]/g, " ").split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    }

    function extractNgrams(texts, n) {
      const freq = {};
      const scoreSum = {};
      texts.forEach(({ text, score }) => {
        const words = tokenize(text);
        for (let i = 0; i <= words.length - n; i++) {
          const gram = words.slice(i, i + n).join(" ");
          if (gram.trim().length < 3) continue;
          freq[gram] = (freq[gram] || 0) + 1;
          scoreSum[gram] = (scoreSum[gram] || 0) + score;
        }
      });
      return Object.entries(freq)
        .filter(([, count]) => count >= 2)
        .map(([gram, count]) => ({
          gram,
          count,
          avgScore: Math.round(scoreSum[gram] / count)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 30);
    }

    const unigrams = extractNgrams(messageTexts, 1);
    const bigrams = extractNgrams(messageTexts, 2);
    const trigrams = extractNgrams(messageTexts, 3);

    // ── Weekly trend (last 7 days)
    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const recentCount = rows.filter(r => new Date(r.created_at) > weekAgo).length;

    return res.status(200).json({
      empty: false,
      total: rows.length,
      recentCount,
      avgScore,
      seniorityMap,
      scoreBuckets,
      formatMap,
      segmentMap,
      unigrams,
      bigrams,
      trigrams
    });

  } catch(e) {
    return res.status(500).json({ error: "Server error", details: e.message });
  }
}
