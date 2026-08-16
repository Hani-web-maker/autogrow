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
                  <td class="row-actions"><button class="icon-btn-sm" data-act="delete-report" data-id="${r.id}" aria-label="Delete report">🗑</button></td>
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
    const issuesResolved = (report.content.issuesResolved || []).map((id) => DB.get('issues', id)).filter(Boolean);
    const issuesOpened = (report.content.issuesOpened || []).map((id) => DB.get('issues', id)).filter(Boolean);
    const keywordChanges = report.content.keywordChanges;
    const keywordsTrackedTotal = report.content.keywordsTrackedTotal ?? DB.all('keywords').filter((k) => k.clientId === report.clientId).length;
    const preparedBy = report.preparedBy || DB.currentUser()?.name || '';

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
          <button class="btn btn-primary" id="rp-print">Export as PDF</button>
        </div>
      </div>

      <div class="report-sheet" id="report-sheet">
        <div class="print-header-fixed" style="display:none;">${Brand.markImg()}<span>${Utils.escapeHtml(client?.name || '')} — ${Brand.NAME} Report</span></div>
        <div class="print-footer-fixed" style="display:none;"><span>${Brand.NAME} — ${Brand.TAGLINE}</span><span class="pagenum"></span></div>
        <div class="report-cover-page">
          <div class="report-cover-logo">${Brand.fullLogoImg('report-logo-img')}</div>
          <div class="report-cover-kicker">Client Performance Report</div>
          <h1 class="report-cover-client">${Utils.escapeHtml(client?.name || 'Unknown client')}</h1>
          <div class="report-cover-meta">
            <div><span>Report period</span><strong>${Utils.formatDate(report.period.start, { weekday: 'long' })} – ${Utils.formatDate(report.period.end, { weekday: 'long' })}</strong></div>
            <div><span>Prepared by</span><strong>${Utils.escapeHtml(preparedBy || '—')}</strong></div>
            <div><span>Frequency</span><strong class="text-capitalize">${Utils.escapeHtml(report.frequency)}</strong></div>
          </div>
        </div>

        <section class="report-section report-exec-summary">
          <h2>Executive Summary</h2>
          <p class="report-exec-auto">${buildExecutiveSummary({ tasksCompleted, keywordChanges, newBacklinks, contentPublished, issuesResolved, issuesOpened })}</p>
          <label class="report-notes-label no-print" for="rp-notes">Agency notes <span class="text-muted">(shown on the report, editable any time)</span></label>
          <textarea id="rp-notes" class="report-notes-input" rows="3" placeholder="Add context for the client — e.g. upcoming priorities, blockers, wins to call out…">${Utils.escapeHtml(report.notes || '')}</textarea>
          <p class="report-notes-print">${report.notes ? Utils.escapeHtml(report.notes) : ''}</p>
        </section>

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
          </table>` : keywordsTrackedTotal === 0 ? '<p class="report-empty">Tracking starts once keywords are added for this client.</p>' : '<p class="report-empty">No keyword rank movement recorded this period.</p>'}
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
          <h2>Issues Resolved / Opened This Period (${issuesResolved.length} / ${issuesOpened.length})</h2>
          ${issuesResolved.length || issuesOpened.length ? `<ul class="report-list">
            ${issuesResolved.map((i) => `<li>✓ <strong>${Utils.escapeHtml(i.title)}</strong> — resolved ${Utils.formatDate(i.resolvedDate)}</li>`).join('')}
            ${issuesOpened.map((i) => `<li>＋ <strong>${Utils.escapeHtml(i.title)}</strong> — opened, ${i.severity} severity</li>`).join('')}
          </ul>` : '<p class="report-empty">No issue activity this period.</p>'}
        </section>

        <section class="report-section">
          <h2>Currently Open Issues (${openIssues.length})</h2>
          ${openIssues.length ? `<ul class="report-list">${openIssues.map((i) => `<li><strong>${Utils.escapeHtml(i.title)}</strong> — ${i.severity} severity, ${i.status}</li>`).join('')}</ul>` : '<p class="report-empty">No open issues.</p>'}
        </section>

        <div class="report-footer">
          <span>${Brand.NAME} — ${Brand.TAGLINE}</span>
          <span>Generated ${Utils.formatDate(report.createdAt.slice(0, 10))}</span>
        </div>
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
    document.getElementById('rp-notes').addEventListener('change', (e) => {
      DB.update('reports', report.id, { notes: e.target.value });
      Toast.success('Notes saved');
      Utils.qs('.report-notes-print', outlet).textContent = e.target.value;
    });
    document.getElementById('rp-copy').addEventListener('click', async () => {
      const text = reportAsText(report, client, { tasksCompleted, keywordChanges, newBacklinks, contentPublished, openIssues, keywordsTrackedTotal });
      try {
        await navigator.clipboard.writeText(text);
        Toast.success('Report copied to clipboard');
      } catch {
        Toast.error('Could not copy — clipboard access blocked');
      }
    });
  }

  /**
   * Auto-generates a short executive summary paragraph from real deltas —
   * never placeholder numbers. Returns an honest "nothing tracked yet"
   * sentence when a period has no activity at all.
   */
  function buildExecutiveSummary(d) {
    const improved = d.keywordChanges.filter((k) => k.change > 0).length;
    const declined = d.keywordChanges.filter((k) => k.change < 0).length;
    const parts = [];
    if (d.tasksCompleted.length) parts.push(`completed ${d.tasksCompleted.length} task${d.tasksCompleted.length === 1 ? '' : 's'}`);
    if (d.newBacklinks.length) parts.push(`acquired ${d.newBacklinks.length} new backlink${d.newBacklinks.length === 1 ? '' : 's'}`);
    if (d.contentPublished.length) parts.push(`published ${d.contentPublished.length} piece${d.contentPublished.length === 1 ? '' : 's'} of content`);
    if (improved || declined) parts.push(`saw ${improved} keyword${improved === 1 ? '' : 's'} improve in rank${declined ? ` and ${declined} decline` : ''}`);
    if (d.issuesResolved.length) parts.push(`resolved ${d.issuesResolved.length} site issue${d.issuesResolved.length === 1 ? '' : 's'}`);
    if (d.issuesOpened.length) parts.push(`identified ${d.issuesOpened.length} new issue${d.issuesOpened.length === 1 ? '' : 's'}`);

    if (!parts.length) return 'No tracked activity was recorded for this client during this period.';
    const last = parts.pop();
    const sentence = parts.length ? `${parts.join(', ')}, and ${last}` : last;
    return `This period, we ${sentence}.`;
  }

  function reportAsText(report, client, d) {
    const lines = [];
    lines.push(`${client?.name || 'Client'} — SEO Performance Report`);
    lines.push(`${Utils.formatDate(report.period.start)} – ${Utils.formatDate(report.period.end)}`);
    lines.push(`Prepared by ${report.preparedBy || DB.currentUser()?.name || '—'}`);
    lines.push('');
    lines.push('EXECUTIVE SUMMARY');
    lines.push(buildExecutiveSummary({ ...d, issuesResolved: d.issuesResolved || [], issuesOpened: d.issuesOpened || [] }));
    if (report.notes) { lines.push(''); lines.push(`Agency notes: ${report.notes}`); }
    lines.push('');
    lines.push(`TASKS COMPLETED (${d.tasksCompleted.length})`);
    d.tasksCompleted.forEach((t) => lines.push(`- ${t.title} (completed ${Utils.formatDate(t.completedAt?.slice(0, 10))})`));
    if (!d.tasksCompleted.length) lines.push('- None this period');
    lines.push('');
    lines.push(`KEYWORD RANK CHANGES (${d.keywordChanges.length})`);
    d.keywordChanges.forEach((k) => lines.push(`- ${k.keyword}: #${k.from} → #${k.to} (${k.change > 0 ? '+' : ''}${k.change})`));
    if (!d.keywordChanges.length) lines.push(d.keywordsTrackedTotal === 0 ? '- Tracking starts once keywords are added' : '- No movement recorded');
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
