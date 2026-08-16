// csv.js — dependency-free CSV parsing/writing, used by Settings for
// bulk import (keywords/backlinks/content calendar) and collection export.
const CSV = (() => {
  /**
   * Parses raw CSV text into an array of row arrays, handling quoted
   * fields with embedded commas, newlines, and escaped quotes ("").
   * @param {string} text
   * @returns {Array<Array<string>>}
   */
  function parseRows(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    const src = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (inQuotes) {
        if (ch === '"') {
          if (src[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field); field = '';
      } else if (ch === '\n') {
        row.push(field); rows.push(row); row = []; field = '';
      } else {
        field += ch;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
  }

  /**
   * Parses CSV text into an array of objects keyed by the header row.
   * @param {string} text
   * @returns {Array<Object<string,string>>}
   */
  function parseWithHeaders(text) {
    const rows = parseRows(text);
    if (!rows.length) return [];
    const headers = rows[0].map((h) => h.trim());
    return rows.slice(1)
      .filter((r) => r.some((c) => (c || '').trim() !== ''))
      .map((r) => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = (r[i] ?? '').trim(); });
        return obj;
      });
  }

  function escapeField(value) {
    const str = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  }

  /**
   * @param {Array<Object>} rows
   * @param {Array<string>} headers column order
   * @returns {string} CSV text
   */
  function toCsv(rows, headers) {
    const lines = [headers.map(escapeField).join(',')];
    rows.forEach((r) => lines.push(headers.map((h) => escapeField(r[h])).join(',')));
    return lines.join('\n');
  }

  /**
   * Triggers a browser download of text content.
   * @param {string} filename
   * @param {string} content
   * @param {string} [mime]
   */
  function download(filename, content, mime = 'text/csv;charset=utf-8') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return { parseRows, parseWithHeaders, toCsv, download };
})();
