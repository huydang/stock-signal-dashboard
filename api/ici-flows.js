export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600');

  try {
    const proxyUrl = 'https://corsproxy.io/?url=' + encodeURIComponent('https://www.ici.org/research/stats/combined_flows');
    const r = await fetch(proxyUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research-dashboard/1.0)' },
      signal: AbortSignal.timeout(12000),
    });

    if (!r.ok) throw new Error('ICI fetch failed: ' + r.status);
    const html = await r.text();

    // Extract the table block
    const tableMatch = html.match(/<table[\s\S]*?<\/table>/i);
    if (!tableMatch) throw new Error('Table not found in ICI page');
    const table = tableMatch[0];

    // Extract all rows
    const rowMatches = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)];

    // Helper: strip HTML tags and decode entities
    function clean(str) {
      return str
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&#[0-9]+;/g, '')
        .replace(/,/g, '')
        .trim();
    }

    // Parse header row for dates
    const headerRow = rowMatches[0]?.[0] || '';
    const headerCells = [...headerRow.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)]
      .map(m => clean(m[1]))
      .filter(Boolean);
    // headerCells[0] is empty label col, rest are dates
    const dates = headerCells.slice(1, 6);

    // Row labels we want and whether they're indented
    const WANTED = [
      { label: 'Equity',    indent: false, bold: false },
      { label: 'Domestic',  indent: true,  bold: false },
      { label: 'World',     indent: true,  bold: false },
      { label: 'Hybrid',    indent: false, bold: false },
      { label: 'Bond',      indent: false, bold: false },
      { label: 'Taxable',   indent: true,  bold: false },
      { label: 'Municipal', indent: true,  bold: false },
      { label: 'Commodity', indent: false, bold: false },
      { label: 'Total',     indent: false, bold: true  },
    ];

    const rows = [];

    for (const rowMatch of rowMatches.slice(1)) {
      const rowHTML = rowMatch[0];
      const cells = [...rowHTML.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map(m => clean(m[1]));

      if (cells.length < 2) continue;
      const labelRaw = cells[0].trim();

      const wanted = WANTED.find(w =>
        labelRaw.toLowerCase() === w.label.toLowerCase()
      );
      if (!wanted) continue;

      const values = cells.slice(1, 6).map(v => {
        const n = parseFloat(v.replace(/[^0-9.\-]/g, ''));
        return isNaN(n) ? null : n;
      });

      rows.push({ label: wanted.label, indent: wanted.indent, bold: wanted.bold, values });
    }

    if (rows.length === 0) throw new Error('No matching rows parsed from table');

    res.status(200).json({ dates, rows });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
