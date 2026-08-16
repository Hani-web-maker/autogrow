// components/charts.js — tiny dependency-free canvas charts.
const Charts = (() => {
  function setupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || canvas.clientWidth || 300;
    const h = rect.height || canvas.clientHeight || 120;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx, w, h };
  }

  // Rank chart: lower rank = better, so the y-axis is inverted (rank 1 at top).
  function rankLineChart(canvas, history, { color = '#0C4A73' } = {}) {
    if (!history || history.length === 0) return;
    const { ctx, w, h } = setupCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    const pad = { top: 10, right: 12, bottom: 20, left: 28 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    const ranks = history.map((p) => p.rank);
    const minRank = Math.max(1, Math.min(...ranks) - 3);
    const maxRank = Math.max(...ranks) + 3;

    const x = (i) => pad.left + (i / Math.max(1, history.length - 1)) * plotW;
    const y = (rank) => pad.top + ((rank - minRank) / (maxRank - minRank)) * plotH;

    // gridlines
    ctx.strokeStyle = 'rgba(148,163,184,0.25)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 2; i++) {
      const gy = pad.top + (plotH / 2) * i;
      ctx.beginPath(); ctx.moveTo(pad.left, gy); ctx.lineTo(w - pad.right, gy); ctx.stroke();
    }

    // line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    history.forEach((p, i) => {
      const px = x(i), py = y(p.rank);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // area fill
    ctx.lineTo(x(history.length - 1), pad.top + plotH);
    ctx.lineTo(x(0), pad.top + plotH);
    ctx.closePath();
    ctx.fillStyle = color + '18';
    ctx.fill();

    // points
    ctx.fillStyle = color;
    history.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(x(i), y(p.rank), i === history.length - 1 ? 3.5 : 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // axis labels (min/max rank)
    ctx.fillStyle = '#64748b';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`#${minRank}`, 2, pad.top + plotH + 4);
    ctx.fillText(`#${maxRank}`, 2, pad.top + 8);
  }

  function barChart(canvas, data, { color = '#0C4A73', horizontal = true } = {}) {
    const { ctx, w, h } = setupCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    if (!data.length) return;
    const max = Math.max(1, ...data.map((d) => d.value));
    const pad = { top: 8, right: 30, bottom: 8, left: 90 };
    const rowH = (h - pad.top - pad.bottom) / data.length;

    ctx.font = '11px Inter, sans-serif';
    data.forEach((d, i) => {
      const barY = pad.top + i * rowH + rowH * 0.2;
      const barH = rowH * 0.6;
      const barW = ((w - pad.left - pad.right) * d.value) / max;
      ctx.fillStyle = '#334155';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(d.label, pad.left - 8, barY + barH / 2);
      ctx.fillStyle = d.color || color;
      roundRect(ctx, pad.left, barY, Math.max(2, barW), barH, 3);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'left';
      ctx.fillText(String(d.value), pad.left + barW + 6, barY + barH / 2);
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  return { rankLineChart, barChart };
})();
