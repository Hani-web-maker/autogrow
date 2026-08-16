// views/reports.js — Report Builder: list, generate, print/export, copy-as-text.
(() => {
  function renderList() {
    const outlet = document.getElementById('view-outlet');
    const clients = DB.all('clients');
    const reports = [...DB.all('reports')].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    outlet.innerHTML = `
      <div class="view-header">
        <div><h1>Reports</h1><p class="view-subtitle">Auto-generated client reporting, solved for Friday</p></div>
      </div>

      <div class="panel">
        <div class="panel-header"><h3>Generate a report now</h3></div>
        <div class="panel-body">
          <div class="inline-form-row">
            <select id="rp-client-select" class="input">${clients.map((c) => `<option value="${c.id}">${Utils.escapeHtml(c.name)}</option>`).join('')}</select>
            <select id="rp-period-select" class="input">
              <option value="weekly">This week</option>
              <option value="monthly">This month</option>
            </select>
            <button class="btn btn-primary" id="rp-generate-btn">Generate Report</button>
          </div>
          <p class="hint-text">Clients with a recurring schedule automatically get a fresh draft each period when the workspace loads.</p>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><h3>Recurring schedules</h3></div>
        <div class="panel-body">
          ${clients.map((c) => `
            <div class="workload-row">
              <span class="workload-name">${Utils.escapeHtml(c.name)}</span>
              <span class="badge ${c.reportSchedule?.frequency === 'none' ? 'status-paused' : 'status-active'}">${scheduleLabel(c.reportSchedule)}</span>
            </div>`).join('')}
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><h3>All reports</h3></div>
        <div class="panel-body">
          <table class="data-table">
            <thead><tr><th>Client</th><th>Period</th><th>Frequency</th><th>Status</th><th>Created</th><th></th></tr></thead>
            <tbody>
              ${reports.length ? reports.map((r) => {
                const client = DB.get('clients', r.clientId);
                return `
                <tr class="clickable-row" data-id="${r.id}">
                  <td>${Utils.escapeHtml(client?.name || 'Unknown client')}</td>
                  <td>${Utils.formatDateShort(r.period.start)} – ${Utils.formatDateShort(r.period.end)}</td>
                  <td>${r.frequency}</td>
                  <td><span class="badge status-${r.status}">${r.status}</span></td>
                  <td>${Utils.formatDate(r.createdAt.slice(0, 10))}</td>
                  <td class="row-actions"><button class="icon-btn-sm" data-act="delete-report" data-id="${r.id}">🗑</button></td>
                </tr>`;
              }).join('') : `<tr><td colspan="6"><div class="empty-inline-panel">No reports yet. Generate one above.</div></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('rp-generate-btn').addEventListener('click', () => {
      const clientId = document.getElementById('rp-client-select').value;
      const freq = document.getElementById('rp-period-select').value;
      const range = freq === 'weekly' ? Utils.weekRange() : Utils.monthRange();
      const existing = DB.all('reports').find((r) => r.clientId === clientId && r.period.start === range.start && r.period.end === range.end);
      if (existing) {
        Toast.info('A report for this period already exists — opening it.');
        Router.navigate(`/reports/${existing.id}`);
        return;
      }
      const report = DB.buildReportDraft(clientId, range.start, range.end, freq);
      DB.insert('reports', report);
      DB.logActivity('report', `Report generated for ${DB.get('clients', clientId)?.name}`, { reportId: report.id });
      Toast.success('Report generated');
      App.refreshChrome();
      Router.navigate(`/reports/${report.id}`);
    });

    Utils.qsa('.clickable-row', outlet).forEach((row) => {
      row.addEventListener('click', (e) => { if (!e.target.closest('button')) Router.navigate(`/reports/${row.dataset.id}`); });
    });
    Utils.qsa('[data-act="delete-report"]', outlet).forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const ok = await ModalManager.confirmDialog({ title: 'Delete report', message: 'Delete this report draft?', confirmLabel: 'Delete', danger: true });
        if (ok) { DB.remove('reports', btn.dataset.id); App.refreshChrome(); renderList(); }
      });
    });
  }

  function scheduleLabel(schedule) {
    if (!schedule || schedule.frequency === 'none') return 'Not scheduled';
    if (schedule.frequency === 'weekly') return 'Weekly — every Friday';
    if (schedule.frequency === 'monthly') return 'Monthly — 1st';
    return schedule.frequency;
  }

  function renderDetail(params) {
    const outlet = document.getElementById('view-outlet');
    const report = DB.get('reports', params.id);
    if (!report) { outlet.innerHTML = `<div class="empty-state"><h3>Report not found</h3><a href="#/reports">Back to reports</a></div>`; return; }
    const client = DB.get('clients', report.clientId);

    const tasksCompleted = report.content.tasksCompleted.map((id) => DB.get('tasks', id)).filter(Boolean);
    const newBacklinks = report.content.newBacklinks.map((id) => DB.get('backlinks', id)).filter(Boolean);
    const contentPublished = report.content.contentPublished.map((id) => DB.get('contentItems', id)).filter(Boolean);
    const openIssues = report.content.openIssues.map((id) => DB.get('issues', id)).filter(Boolean);
    const keywordChanges = report.content.keywordChanges;

    outlet.innerHTML = `
      <div class="view-header no-print">
        <div>
          <a href="#/reports" class="back-link">← All reports</a>
          <h1>Report — ${Utils.escapeHtml(client?.name || 'Unknown client')}</h1>
          <p class="view-subtitle">${Utils.formatDate(report.period.start)} – ${Utils.formatDate(report.period.end)}</p>
        </div>
        <div class="view-header-actions">
          <span class="badge status-${report.status}">${report.status}</span>
          <button class="btn btn-ghost" id="rp-regenerate">Refresh Data</button>
          ${report.status === 'draft' ? '<button class="btn btn-ghost" id="rp-finalize">Mark Final</button>' : ''}
          <button class="btn btn-ghost" id="rp-copy">Copy as Text</button>
          <button class="btn btn-primary" id="rp-print">Print / Export PDF</button>
        </div>
      </div>

      <div class="report-sheet" id="report-sheet">
        <div class="report-sheet-header">
          <div class="report-brand">SEOFlow — Client Performance Report</div>
          <h1>${Utils.escapeHtml(client?.name || 'Unknown client')}</h1>
          <p>${Utils.formatDate(report.period.start, { weekday: 'long' })} – ${Utils.formatDate(report.period.end, { weekday: 'long' })}</p>
        </div>

        <section class="report-section">
          <h2>Tasks Completed This Period (${tasksCompleted.length})</h2>
          ${tasksCompleted.length ? `<ul class="report-list">${tasksCompleted.map((t) => `<li><strong>${Utils.escapeHtml(t.title)}</strong> — completed ${Utils.formatDate(t.completedAt?.slice(0, 10))}</li>`).join('')}</ul>` : '<p class="report-empty">No tasks completed this period.</p>'}
        </section>

        <section class="report-section">
          <h2>Keyword Rank Changes (${keywordChanges.length})</h2>
          ${keywordChanges.length ? `
          <table class="report-table">
            <thead><tr><th>Keyword</th><th>Start Rank</th><th>End Rank</th><th>Change</th></tr></thead>
            <tbody>
              ${keywordChanges.map((k) => `<tr><td>${Utils.escapeHtml(k.keyword)}</td><td>#${k.from}</td><td>#${k.to}</td><td>${k.change > 0 ? `▲ ${k.change}` : k.change < 0 ? `▼ ${Math.abs(k.change)}` : '— 0'}</td></tr>`).join('')}
            </tbody>
          </table>` : '<p class="report-empty">No keyword rank movement recorded this period.</p>'}
        </section>

        <section class="report-section">
          <h2>New Backlinks Acquired (${newBacklinks.length})</h2>
          ${newBacklinks.length ? `
          <table class="report-table">
            <thead><tr><th>Source Domain</th><th>DA</th><th>DR</th><th>Anchor Text</th><th>Status</th></tr></thead>
            <tbody>
              ${newBacklinks.map((b) => `<tr><td>${Utils.escapeHtml(b.sourceDomain)}</td><td>${b.da}</td><td>${b.dr}</td><td>${Utils.escapeHtml(b.anchorText)}</td><td>${b.status}</td></tr>`).join('')}
            </tbody>
          </table>` : '<p class="report-empty">No new backlinks acquired this period.</p>'}
        </section>

        <section class="report-section">
          <h2>Content Published (${contentPublished.length})</h2>
          ${contentPublished.length ? `<ul class="report-list">${contentPublished.map((c) => `<li><strong>${Utils.escapeHtml(c.title)}</strong> — published ${Utils.formatDate(c.publishDate)}</li>`).join('')}</ul>` : '<p class="report-empty">No content published this period.</p>'}
        </section>

        <section class="report-section">
          <h2>Open Issues (${openIssues.length})</h2>
          ${openIssues.length ? `<ul class="report-list">${openIssues.map((i) => `<li><strong>${Utils.escapeHtml(i.title)}</strong> — ${i.severity} severity, ${i.status}</li>`).join('')}</ul>` : '<p class="report-empty">No open issues.</p>'}
        </section>

        <div class="report-footer">Generated ${Utils.formatDate(report.createdAt.slice(0, 10))} by SEOFlow</div>
      </div>
    `;

    document.getElementById('rp-print').addEventListener('click', () => window.print());
    document.getElementById('rp-regenerate').addEventListener('click', () => {
      DB.regenerateReportContent(report.id);
      Toast.success('Report data refreshed');
      renderDetail(params);
    });
    document.getElementById('rp-finalize')?.addEventListener('click', () => {
      DB.update('reports', report.id, { status: 'final' });
      Toast.success('Report marked final');
      App.refreshChrome();
      renderDetail(params);
    });
    document.getElementById('rp-copy').addEventListener('click', async () => {
      const text = reportAsText(report, client, { tasksCompleted, keywordChanges, newBacklinks, contentPublished, openIssues });
      try {
        await navigator.clipboard.writeText(text);
        Toast.success('Report copied to clipboard');
      } catch {
        Toast.error('Could not copy — clipboard access blocked');
      }
    });
  }

  function reportAsText(report, client, d) {
    const lines = [];
    lines.push(`${client?.name || 'Client'} — SEO Performance Report`);
    lines.push(`${Utils.formatDate(report.period.start)} – ${Utils.formatDate(report.period.end)}`);
    lines.push('');
    lines.push(`TASKS COMPLETED (${d.tasksCompleted.length})`);
    d.tasksCompleted.forEach((t) => lines.push(`- ${t.title} (completed ${Utils.formatDate(t.completedAt?.slice(0, 10))})`));
    if (!d.tasksCompleted.length) lines.push('- None this period');
    lines.push('');
    lines.push(`KEYWORD RANK CHANGES (${d.keywordChanges.length})`);
    d.keywordChanges.forEach((k) => lines.push(`- ${k.keyword}: #${k.from} → #${k.to} (${k.change > 0 ? '+' : ''}${k.change})`));
    if (!d.keywordChanges.length) lines.push('- No movement recorded');
    lines.push('');
    lines.push(`NEW BACKLINKS (${d.newBacklinks.length})`);
    d.newBacklinks.forEach((b) => lines.push(`- ${b.sourceDomain} (DA ${b.da}/DR ${b.dr}) — "${b.anchorText}" — ${b.status}`));
    if (!d.newBacklinks.length) lines.push('- None acquired this period');
    lines.push('');
    lines.push(`CONTENT PUBLISHED (${d.contentPublished.length})`);
    d.contentPublished.forEach((c) => lines.push(`- ${c.title} (${Utils.formatDate(c.publishDate)})`));
    if (!d.contentPublished.length) lines.push('- None this period');
    lines.push('');
    lines.push(`OPEN ISSUES (${d.openIssues.length})`);
    d.openIssues.forEach((i) => lines.push(`- ${i.title} [${i.severity}] — ${i.status}`));
    if (!d.openIssues.length) lines.push('- None open');
    return lines.join('\n');
  }

  Router.register('/reports', renderList);
  Router.register('/reports/:id', renderDetail);
})();
