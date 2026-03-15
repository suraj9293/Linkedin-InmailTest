export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { name, company, role } = req.body || {};
    if (!name || !company) return res.status(400).json({ error: "Name and company required" });

    if (!process.env.SERPER_KEY) {
      return res.status(200).json({ found: false, snippets: [], reason: "No Serper key" });
    }

    const queries = [
      `${name} ${company} LinkedIn`,
      `${name} ${company} ${role || ""} profile`,
      `${name} ${company} keynote OR interview OR article OR podcast`
    ];

    const snippets = [];

    for (const q of queries) {
      try {
        const r = await fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": process.env.SERPER_KEY
          },
          body: JSON.stringify({ q, num: 4 })
        });
        const data = await r.json();
        (data.organic || []).forEach(item => {
          if (item.title || item.snippet) {
            snippets.push({
              title: item.title || "",
              snippet: item.snippet || "",
              link: item.link || ""
            });
          }
        });
      } catch(e) {}
    }

    return res.status(200).json({
      found: snippets.length > 0,
      name,
      company,
      role: role || "",
      snippets,
      source: "serper"
    });

  } catch(e) {
    return res.status(500).json({ error: "Server error", details: e.message });
  }
}
