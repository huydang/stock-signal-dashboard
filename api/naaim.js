export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600');

  try {
    const r = await fetch('https://naaim.org/programs/naaim-exposure-index/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research-dashboard/1.0)' },
      signal: AbortSignal.timeout(10000),
    });

    if (!r.ok) throw new Error('NAAIM fetch failed: ' + r.status);
    const html = await r.text();

    function clean(str) {
      return str.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&#[0-9]+;/g, '').trim();
    }

    // Extract current week number
    const currentMatch = html.match(/This week.*?NAAIM Exposure Index number is\*?[\s\S]*?<\/h4>\s*([\d.]+)/i);
    const current = currentMatch ? parseFloat(currentMatch[1]) : null;

    // Extract last quarter average
    const quarterMatch = html.match(/Last Quarter Average[\s\S]*?<\/h4>\s*([\d.]+)/i);
    const lastQuarterAvg = quarterMatch ? parseFloat(quarterMatch[1]) : null;

    // Extract posted date
    const dateMatch = html.match(/Posted on [^,]+,\s*([^<\n]+)/i);
    const postedDate = dateMatch ? dateMatch[1].trim() : null;

    // Extract table rows
    const tableMatch = html.match(/<table[\s\S]*?<\/table>/i);
    const rows = [];

    if (tableMatch) {
      const rowMatches = [...tableMatch[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)];
      for (const rowMatch of rowMatches.slice(1, 11)) { // skip header, take up to 10 rows
        const cells = [...rowMatch[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
          .map(m => clean(m[1]));
        if (cells.length >= 2) {
          rows.push({
            date:   cells[0],
            value:  parseFloat(cells[1]) || null,
            bearish: cells[2] || null,
            q1:     cells[3] || null,
            q2:     cells[4] || null,
            q3:     cells[5] || null,
            bullish: cells[6] || null,
          });
        }
      }
    }

    if (!current && rows.length === 0) throw new Error('Could not parse NAAIM data');

    res.status(200).json({ current, lastQuarterAvg, postedDate, rows });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
