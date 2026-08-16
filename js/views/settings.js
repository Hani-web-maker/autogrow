// views/settings.js — agency profile, security (login gate), sample/backup
// data management, and CSV import/export. Every mutation goes through DB;
// this file never touches localStorage directly.
(() => {
  const IMPORTERS = {
    keywords: {
      label: 'Keywords',
      required: ['keyword', 'clientName'],
      optional: ['targetUrl', 'searchVolume', 'rank'],
      example: 'keyword,clientName,targetUrl,searchVolume,rank\nfamily dentist denver,Brightleaf Dental,/services/family-dentistry,880,14',
      mapRow(row) {
        const client = DB.findByName('clients', row.clientName);
        if (!client) return { error: `Unknown client "${row.clientName}"` };
        const history = row.rank ? [{ date: Utils.todayISO(), rank: Number(row.rank) || 1 }] : [];
        return {
          record: {
            id: Utils.uid('k'),
            clientId: client.id,
            projectId: null,
            keyword: row.keyword,
            targetUrl: row.targetUrl || '',
            searchVolume: Number(row.searchVolume) || 0,
            history,
          },
        };
      },
    },
    backlinks: {
      label: 'Backlinks',
      required: ['sourceDomain', 'clientName'],
      optional: ['da', 'dr', 'anchorText', 'status', 'dateAcquired', 'targetUrl'],
      example: 'sourceDomain,clientName,da,dr,anchorText,status,dateAcquired,targetUrl\ndenverhealthblog.com,Brightleaf Dental,52,48,family dentist denver,Live,2026-06-01,/services/family-dentistry',
      mapRow(row) {
        const client = DB.findByName('clients', row.clientName);
        if (!client) return { error: `Unknown client "${row.clientName}"` };
        return {
          record: {
            id: Utils.uid('bl'),
            clientId: client.id,
            sourceDomain: row.sourceDomain.replace(/^https?:\/\//, '').replace(/\/$/, ''),
            da: Number(row.da) || 0,
            dr: Number(row.dr) || 0,
            anchorText: row.anchorText || '',
            status: ['Live', 'Pending', 'Lost'].includes(row.status) ? row.status : 'Pending',
            dateAcquired: row.dateAcquired || Utils.todayISO(),
            targetUrl: row.targetUrl || '',
          },
        };
      },
    },
    contentCalendar: {
      label: 'Content Calendar',
      required: ['title', 'clientName', 'publishDate'],
      optional: ['status', 'writerName', 'targetKeyword'],
      example: 'title,clientName,publishDate,status,writerName,targetKeyword\nBest Family Dentist in Denver,Brightleaf Dental,2026-09-01,Idea,Priya Nair,family dentist denver',
      mapRow(row) {
        const client = DB.findByName('clients', row.clientName);
        if (!client) return { error: `Unknown client "${row.clientName}"` };
        const writer = row.writerName ? DB.findByName('team', row.writerName) : null;
        return {
          record: {
            id: Utils.uid('ci'),
            clientId: client.id,
            projectId: null,
            title: row.title,
            status: window.ContentCalendarView?.STATUSES.includes(row.status) ? row.status : 'Idea',
            writerId: writer ? writer.id : null,
            targetKeyword: row.targetKeyword || '',
            publishDate: row.publishDate,
          },
        };
      },
    },
  };

  function render() {
    const outlet = document.getElementById('view-outlet');
    const settings = DB.settings();
    outlet.innerHTML = `
      <div class="view-header">
        <div><h1>Settings</h1><p class="view-subtitle">Workspace, security, and data management</p></div>
      </div>

      <div class="panel">
        <div class="panel-header"><h3>Agency profile</h3></div>
        <div class="panel-body">
          <div class="task-field-grid">
            <div class="task-field">
              <label for="st-agency-name">Agency name</label>
              <input type="text" id="st-agency-name" value="${Utils.escapeHtml(settings.agencyName || '')}" />
            </div>
          </div>
          <button class="btn btn-primary btn-sm" id="st-save-agency">Save</button>
        </div>
      </div>

      <div class="panel" id="st-security-panel"></div>

      <div class="panel">
        <div class="panel-header"><h3>Sample data &amp; reset</h3></div>
        <div class="panel-body">
          <p class="hint-text">Sample data is for demos and sales pitches only — it never loads automatically. Both actions below ask for confirmation and cannot be undone except by restoring a backup.</p>
          <div class="settings-action-row">
            <div>
              <strong>Load sample data</strong>
              <p class="text-muted">Fills the workspace with fictional demo clients, projects, keywords, and reports.</p>
            </div>
            <button class="btn btn-ghost" id="st-load-sample">Load Sample Data</button>
          </div>
          <div class="settings-action-row">
            <div>
              <strong>Clear all data</strong>
              <p class="text-muted">Permanently deletes every client, project, task, and report. Your agency name and login stay intact.</p>
            </div>
            <button class="btn btn-danger" id="st-clear-all">Clear All Data</button>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><h3>Backup &amp; restore</h3></div>
        <div class="panel-body">
          <p class="hint-text">GrowMark stores everything in this browser only. Export a backup regularly — clearing browser data or switching devices loses everything otherwise.</p>
          <div class="settings-action-row">
            <div>
              <strong>Export full backup</strong>
              <p class="text-muted">Downloads every collection as a single JSON file.</p>
            </div>
            <button class="btn btn-primary" id="st-export-backup">Export Full Backup</button>
          </div>
          <div class="settings-action-row">
            <div>
              <strong>Restore from backup</strong>
              <p class="text-muted">Replaces the entire current workspace with a previously exported backup file.</p>
            </div>
            <label class="btn btn-ghost file-btn">Choose Backup File<input type="file" id="st-restore-input" accept="application/json" hidden /></label>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><h3>CSV export</h3></div>
        <div class="panel-body">
          <p class="hint-text">Export any collection to CSV for backup or to feed into Google Sheets.</p>
          <div class="csv-export-grid" id="st-export-grid"></div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><h3>CSV import</h3></div>
        <div class="panel-body">
          <p class="hint-text">Bulk-add rows from a spreadsheet export. Client names must match an existing client exactly.</p>
          <div id="st-import-list"></div>
        </div>
      </div>
    `;

    renderSecurityPanel();
    renderExportGrid();
    renderImportList();
    bindTopLevelActions();
  }

  // ---------- Agency profile ----------
  function bindTopLevelActions() {
    document.getElementById('st-save-agency').addEventListener('click', () => {
      const name = document.getElementById('st-agency-name').value.trim();
      DB.updateSettings({ agencyName: name });
      Toast.success('Agency profile saved');
    });

    document.getElementById('st-load-sample').addEventListener('click', async () => {
      const ok = await ModalManager.confirmDialog({
        title: 'Load sample data?',
        message: 'This replaces your current clients, projects, tasks, keywords, backlinks, and reports with fictional demo data. Your agency name and login are kept. This cannot be undone unless you have a backup.',
        confirmLabel: 'Load Sample Data',
      });
      if (!ok) return;
      DB.loadSampleData();
      Toast.success('Sample data loaded');
      App.refreshChrome();
      render();
    });

    document.getElementById('st-clear-all').addEventListener('click', async () => {
      const ok = await ModalManager.confirmDialog({
        title: 'Clear all data?',
        message: 'This permanently deletes every client, project, task, keyword, backlink, and report in this workspace. Your agency name and login stay intact. This cannot be undone unless you have a backup.',
        confirmLabel: 'Clear All Data',
        danger: true,
      });
      if (!ok) return;
      DB.clearAllData();
      Toast.success('All data cleared');
      App.refreshChrome();
      render();
    });

    document.getElementById('st-export-backup').addEventListener('click', () => {
      const json = DB.exportBackup();
      const stamp = Utils.todayISO();
      CSV.download(`growmark-backup-${stamp}.json`, json, 'application/json');
      Toast.success('Backup downloaded');
    });

    document.getElementById('st-restore-input').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      let text;
      try {
        text = await file.text();
      } catch (err) {
        Toast.error('Could not read that file');
        return;
      }
      const ok = await ModalManager.confirmDialog({
        title: 'Restore from backup?',
        message: `This replaces everything currently in your workspace with the contents of "${file.name}". This cannot be undone.`,
        confirmLabel: 'Restore',
        danger: true,
      });
      if (!ok) return;
      try {
        DB.restoreBackup(text);
        Toast.success('Backup restored');
        App.refreshChrome();
        render();
      } catch (err) {
        Toast.error(err.message || 'Restore failed');
      }
    });
  }

  // ---------- Security ----------
  function renderSecurityPanel() {
    const panel = document.getElementById('st-security-panel');
    const auth = DB.settings().auth;
    panel.innerHTML = `
      <div class="panel-header"><h3>Security — device login gate</h3></div>
      <div class="panel-body">
        <p class="hint-text">A local device lock only — a username + PIN kept as a salted hash in this browser. It stops a shared machine or screen-share from exposing client data at a glance. It is not account-level security.</p>
        ${auth ? `
          <div class="kv-row"><span>Username</span><strong>${Utils.escapeHtml(auth.username)}</strong></div>
          <div class="kv-row"><span>Session timeout</span><strong>${auth.sessionTimeoutMinutes} minutes</strong></div>
          <div class="settings-action-row">
            <div><strong>Change username / PIN</strong></div>
            <button class="btn btn-ghost btn-sm" id="st-change-auth">Change</button>
          </div>
          <div class="settings-action-row">
            <div><strong>Session timeout</strong><p class="text-muted">How long a device stays signed in when idle.</p></div>
            <select id="st-timeout-select" class="input">
              ${[15, 30, 60, 120].map((m) => `<option value="${m}" ${auth.sessionTimeoutMinutes === m ? 'selected' : ''}>${m} minutes</option>`).join('')}
            </select>
          </div>
          <div class="settings-action-row">
            <div><strong>Disable login gate</strong><p class="text-muted">Workspace becomes open-access on this browser.</p></div>
            <button class="btn btn-danger btn-sm" id="st-disable-auth">Disable</button>
          </div>
        ` : `
          <div class="settings-action-row">
            <div><strong>Not enabled</strong><p class="text-muted">Anyone with access to this browser can open the workspace.</p></div>
            <button class="btn btn-primary btn-sm" id="st-enable-auth">Enable Login Gate</button>
          </div>
        `}
      </div>`;

    document.getElementById('st-enable-auth')?.addEventListener('click', () => openAuthForm());
    document.getElementById('st-change-auth')?.addEventListener('click', () => openAuthForm(auth));
    document.getElementById('st-timeout-select')?.addEventListener('change', (e) => {
      DB.updateSettings({ auth: { ...auth, sessionTimeoutMinutes: Number(e.target.value) } });
      Toast.success('Session timeout updated');
    });
    document.getElementById('st-disable-auth')?.addEventListener('click', async () => {
      const ok = await ModalManager.confirmDialog({
        title: 'Disable login gate?',
        message: 'Anyone with access to this browser will be able to open the workspace without signing in.',
        confirmLabel: 'Disable',
        danger: true,
      });
      if (ok) {
        Auth.disable();
        Toast.success('Login gate disabled');
        App.boot();
      }
    });
  }

  function openAuthForm(existing) {
    const html = `
      <div class="modal-header"><h3>${existing ? 'Change username / PIN' : 'Enable login gate'}</h3><button class="icon-btn" data-act="close" aria-label="Close">&times;</button></div>
      <div class="modal-body">
        <div class="task-field"><label>Username</label><input type="text" id="af-username" value="${Utils.escapeHtml(existing?.username || '')}" autocomplete="username" /></div>
        <div class="task-field"><label>New PIN / password</label><input type="password" id="af-pin" autocomplete="new-password" placeholder="At least 4 characters" /></div>
        <div class="task-field">
          <label>Session timeout</label>
          <select id="af-timeout">${[15, 30, 60, 120].map((m) => `<option value="${m}" ${(existing?.sessionTimeoutMinutes || 30) === m ? 'selected' : ''}>${m} minutes</option>`).join('')}</select>
        </div>
        <div class="auth-error" id="af-error" hidden></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" data-act="close">Cancel</button>
        <button class="btn btn-primary" id="af-save">Save</button>
      </div>`;
    const panel = ModalManager.open(html, { size: 'sm' });
    Utils.qsa('[data-act="close"]', panel).forEach((b) => b.addEventListener('click', () => ModalManager.close()));
    Utils.qs('#af-save', panel).addEventListener('click', async () => {
      const username = Utils.qs('#af-username', panel).value.trim();
      const pin = Utils.qs('#af-pin', panel).value;
      const timeout = Number(Utils.qs('#af-timeout', panel).value);
      const errBox = Utils.qs('#af-error', panel);
      try {
        await Auth.setup(username, pin, timeout);
        Toast.success('Login gate saved — sign in to confirm your new PIN works');
        ModalManager.close();
        App.boot();
      } catch (err) {
        errBox.textContent = err.message;
        errBox.hidden = false;
      }
    });
  }

  // ---------- CSV export ----------
  const EXPORTERS = {
    clients: {
      label: 'Clients',
      headers: ['name', 'contactName', 'contactEmail', 'contactPhone', 'website', 'contractType', 'status', 'reportFrequency', 'createdAt'],
      rows: () => DB.all('clients').map((c) => ({ ...c, reportFrequency: c.reportSchedule?.frequency || 'none' })),
    },
    projects: {
      label: 'Projects',
      headers: ['name', 'clientName', 'deliverableType', 'startDate', 'status', 'teamMembers'],
      rows: () => DB.all('projects').map((p) => ({
        ...p,
        clientName: DB.get('clients', p.clientId)?.name || '',
        teamMembers: p.teamIds.map((id) => DB.get('team', id)?.name).filter(Boolean).join('; '),
      })),
    },
    keywords: {
      label: 'Keywords',
      headers: ['keyword', 'clientName', 'targetUrl', 'searchVolume', 'currentRank', 'lastUpdated'],
      rows: () => DB.all('keywords').map((k) => ({
        ...k,
        clientName: DB.get('clients', k.clientId)?.name || '',
        currentRank: k.history[k.history.length - 1]?.rank ?? '',
        lastUpdated: k.history[k.history.length - 1]?.date ?? '',
      })),
    },
    backlinks: {
      label: 'Backlinks',
      headers: ['sourceDomain', 'clientName', 'da', 'dr', 'anchorText', 'status', 'dateAcquired', 'targetUrl'],
      rows: () => DB.all('backlinks').map((b) => ({ ...b, clientName: DB.get('clients', b.clientId)?.name || '' })),
    },
    tasks: {
      label: 'Tasks',
      headers: ['title', 'clientName', 'projectName', 'assignees', 'status', 'priority', 'dueDate', 'tags'],
      rows: () => DB.all('tasks').filter((t) => !t.recurrence).map((t) => ({
        ...t,
        clientName: DB.get('clients', t.clientId)?.name || '',
        projectName: DB.get('projects', t.projectId)?.name || '',
        assignees: t.assigneeIds.map((id) => DB.get('team', id)?.name).filter(Boolean).join('; '),
        tags: (t.tags || []).join('; '),
      })),
    },
    reports: {
      label: 'Reports',
      headers: ['clientName', 'periodStart', 'periodEnd', 'frequency', 'status', 'createdAt'],
      rows: () => DB.all('reports').map((r) => ({
        clientName: DB.get('clients', r.clientId)?.name || '',
        periodStart: r.period.start,
        periodEnd: r.period.end,
        frequency: r.frequency,
        status: r.status,
        createdAt: r.createdAt,
      })),
    },
  };

  function renderExportGrid() {
    const grid = document.getElementById('st-export-grid');
    grid.innerHTML = Object.entries(EXPORTERS).map(([key, cfg]) => `
      <button class="btn btn-ghost btn-sm" data-export="${key}">${cfg.label} (${cfg.rows().length})</button>
    `).join('');
    Utils.qsa('[data-export]', grid).forEach((btn) => {
      btn.addEventListener('click', () => {
        const cfg = EXPORTERS[btn.dataset.export];
        const csv = CSV.toCsv(cfg.rows(), cfg.headers);
        CSV.download(`growmark-${btn.dataset.export}-${Utils.todayISO()}.csv`, csv);
        Toast.success(`${cfg.label} exported`);
      });
    });
  }

  // ---------- CSV import ----------
  function renderImportList() {
    const list = document.getElementById('st-import-list');
    list.innerHTML = Object.entries(IMPORTERS).map(([key, cfg]) => `
      <div class="settings-action-row csv-import-row">
        <div>
          <strong>${cfg.label}</strong>
          <p class="text-muted">Required columns: ${cfg.required.join(', ')}. Optional: ${cfg.optional.join(', ')}.</p>
        </div>
        <label class="btn btn-ghost file-btn">Choose CSV<input type="file" class="csv-import-input" data-importer="${key}" accept=".csv,text/csv" hidden /></label>
      </div>
      <div class="csv-import-result" id="import-result-${key}"></div>
    `).join('');

    Utils.qsa('.csv-import-input', list).forEach((input) => {
      input.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        const key = input.dataset.importer;
        e.target.value = '';
        if (!file) return;
        let text;
        try {
          text = await file.text();
        } catch {
          Toast.error('Could not read that file');
          return;
        }
        handleImport(key, text, file.name);
      });
    });
  }

  function handleImport(key, text, filename) {
    const cfg = IMPORTERS[key];
    const resultBox = document.getElementById(`import-result-${key}`);
    const rows = CSV.parseWithHeaders(text);
    if (!rows.length) {
      resultBox.innerHTML = `<div class="empty-inline">No data rows found in "${Utils.escapeHtml(filename)}".</div>`;
      return;
    }
    const missingCols = cfg.required.filter((col) => !(col in rows[0]));
    if (missingCols.length) {
      resultBox.innerHTML = `<div class="csv-import-error">Missing required column(s): ${missingCols.join(', ')}.</div>`;
      return;
    }

    const valid = [];
    const errors = [];
    rows.forEach((row, i) => {
      const missing = cfg.required.filter((col) => !row[col]);
      if (missing.length) { errors.push(`Row ${i + 2}: missing ${missing.join(', ')}`); return; }
      const { record, error } = cfg.mapRow(row);
      if (error) errors.push(`Row ${i + 2}: ${error}`);
      else valid.push(record);
    });

    resultBox.innerHTML = `
      <div class="csv-import-summary">
        <span class="badge status-active">${valid.length} ready to import</span>
        ${errors.length ? `<span class="badge status-blocked">${errors.length} skipped</span>` : ''}
        ${valid.length ? `<button class="btn btn-primary btn-sm" id="confirm-import-${key}">Import ${valid.length} row${valid.length === 1 ? '' : 's'}</button>` : ''}
      </div>
      ${errors.length ? `<ul class="csv-error-list">${errors.slice(0, 10).map((e) => `<li>${Utils.escapeHtml(e)}</li>`).join('')}${errors.length > 10 ? `<li>…and ${errors.length - 10} more</li>` : ''}</ul>` : ''}
    `;

    document.getElementById(`confirm-import-${key}`)?.addEventListener('click', () => {
      const collectionMap = { keywords: 'keywords', backlinks: 'backlinks', contentCalendar: 'contentItems' };
      valid.forEach((record) => DB.insert(collectionMap[key], record));
      DB.logActivity('system', `Imported ${valid.length} ${cfg.label.toLowerCase()} row(s) from CSV`, {});
      Toast.success(`Imported ${valid.length} ${cfg.label.toLowerCase()} row(s)`);
      App.refreshChrome();
      resultBox.innerHTML = `<div class="empty-inline">Imported ${valid.length} row(s) from "${Utils.escapeHtml(filename)}".</div>`;
      renderExportGrid();
    });
  }

  Router.register('/settings', render);
})();
