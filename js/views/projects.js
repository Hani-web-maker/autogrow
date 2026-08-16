// views/projects.js — cross-client project list.
(() => {
  const DELIVERABLE_TYPES = ['Technical SEO Audit', 'Link Building Campaign', 'Content Strategy', 'Local SEO', 'Full SEO Retainer'];
  const STATUSES = ['active', 'on hold', 'completed'];
  const SEO_SCOPE_OPTIONS = ['Technical SEO', 'On-Page', 'Off-Page', 'Content', 'Local SEO'];
  const SCOPE_TO_DELIVERABLE = {
    'Technical SEO': 'Technical SEO Audit',
    'Off-Page': 'Link Building Campaign',
    'Content': 'Content Strategy',
    'Local SEO': 'Local SEO',
    'On-Page': 'Full SEO Retainer',
  };

  function render() {
    const outlet = document.getElementById('view-outlet');
    outlet.innerHTML = `
      <div class="view-header">
        <div><h1>Projects</h1><p class="view-subtitle">All SEO engagements across clients</p></div>
        <div class="view-header-actions">
          <button class="btn btn-ghost" id="new-seo-project-btn">+ New SEO Project</button>
          <button class="btn btn-primary" id="new-project-btn">+ New Project</button>
        </div>
      </div>
      <div class="toolbar">
        <input type="text" id="proj-search" class="input" placeholder="Search projects…" />
        <select id="proj-client-filter" class="input">
          <option value="">All clients</option>
          ${DB.all('clients').map((c) => `<option value="${c.id}">${Utils.escapeHtml(c.name)}</option>`).join('')}
        </select>
        <select id="proj-status-filter" class="input">
          <option value="">All statuses</option>
          ${STATUSES.map((s) => `<option value="${s}">${s}</option>`).join('')}
        </select>
      </div>
      <div class="card-grid" id="projects-grid"></div>
    `;
    document.getElementById('new-project-btn').addEventListener('click', () => openProjectForm());
    document.getElementById('new-seo-project-btn').addEventListener('click', () => openSeoProjectWizard(null, () => Router.render()));
    const search = document.getElementById('proj-search');
    const clientFilter = document.getElementById('proj-client-filter');
    const statusFilter = document.getElementById('proj-status-filter');
    const run = () => renderGrid(search.value.toLowerCase(), clientFilter.value, statusFilter.value);
    search.addEventListener('input', Utils.debounce(run, 150));
    clientFilter.addEventListener('change', run);
    statusFilter.addEventListener('change', run);
    run();
  }

  function renderGrid(query, clientId, status) {
    const grid = document.getElementById('projects-grid');
    let projects = DB.all('projects');
    if (query) projects = projects.filter((p) => p.name.toLowerCase().includes(query));
    if (clientId) projects = projects.filter((p) => p.clientId === clientId);
    if (status) projects = projects.filter((p) => p.status === status);

    if (!projects.length) {
      grid.innerHTML = `<div class="empty-state"><h3>No projects found</h3><p>Try adjusting filters or create a new project.</p></div>`;
      return;
    }

    grid.innerHTML = projects.map((p) => {
      const client = DB.get('clients', p.clientId);
      const pTasks = DB.all('tasks').filter((t) => t.projectId === p.id && !t.recurrence);
      const done = pTasks.filter((t) => t.status === 'Done').length;
      const pct = pTasks.length ? Math.round((done / pTasks.length) * 100) : 0;
      const team = p.teamIds.map((id) => DB.get('team', id)).filter(Boolean);
      return `
      <a class="project-card" href="#/projects/${p.id}">
        <div class="project-card-top">
          <span class="badge status-${p.status.replace(/\s+/g, '-')}">${p.status}</span>
          <span class="deliverable-tag">${Utils.escapeHtml(p.deliverableType)}</span>
        </div>
        <div class="project-card-name">${Utils.escapeHtml(p.name)}</div>
        <div class="project-card-client">${Utils.escapeHtml(client?.name || 'Unassigned client')}</div>
        <div class="progress-mini"><div class="progress-mini-bar" style="width:${pct}%"></div></div>
        <div class="project-card-footer">
          <span>${pct}% complete</span>
          ${Utils.avatarGroupHtml(team, 'avatar-sm')}
        </div>
      </a>`;
    }).join('');
  }

  function openProjectForm(project, presetClientId, onSaved) {
    const isEdit = !!project;
    const clients = DB.all('clients');
    const team = DB.all('team');
    const html = `
      <div class="modal-header"><h3>${isEdit ? 'Edit Project' : 'New Project'}</h3><button class="icon-btn" data-act="close" aria-label="Close">&times;</button></div>
      <div class="modal-body">
        <div class="task-field"><label>Project name</label><input type="text" id="pf-name" value="${Utils.escapeHtml(project?.name || '')}" /></div>
        <div class="task-field-grid">
          <div class="task-field">
            <label>Client</label>
            <select id="pf-client">${clients.map((c) => `<option value="${c.id}" ${(project?.clientId || presetClientId) === c.id ? 'selected' : ''}>${Utils.escapeHtml(c.name)}</option>`).join('')}</select>
          </div>
          <div class="task-field">
            <label>Deliverable type</label>
            <select id="pf-type">${DELIVERABLE_TYPES.map((t) => `<option ${project?.deliverableType === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
          </div>
          <div class="task-field">
            <label>Start date</label>
            <input type="date" id="pf-start" value="${project?.startDate || Utils.todayISO()}" />
          </div>
          <div class="task-field">
            <label>Status</label>
            <select id="pf-status">${STATUSES.map((s) => `<option ${project?.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
          </div>
        </div>
        <div class="task-field">
          <label>Assigned team</label>
          <div class="chip-checkbox-group">
            ${team.map((u) => `
              <label class="chip-checkbox">
                <input type="checkbox" value="${u.id}" ${project?.teamIds?.includes(u.id) ? 'checked' : ''} />
                ${Utils.avatarHtml(u, 'avatar-sm')}<span>${Utils.escapeHtml(u.name)}</span>
              </label>`).join('')}
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" data-act="close">Cancel</button>
        <button class="btn btn-primary" id="pf-save">${isEdit ? 'Save Changes' : 'Create Project'}</button>
      </div>`;
    const panel = ModalManager.open(html, { size: 'md' });
    Utils.qsa('[data-act="close"]', panel).forEach((b) => b.addEventListener('click', () => ModalManager.close()));
    Utils.qs('#pf-save', panel).addEventListener('click', async () => {
      const name = Utils.qs('#pf-name', panel).value.trim();
      if (!name) { Toast.error('Project name is required'); return; }
      const duplicate = DB.findByName('projects', name, project?.id);
      if (duplicate) {
        const proceed = await ModalManager.confirmDialog({
          title: 'Duplicate project name',
          message: `A project named "${duplicate.name}" already exists. Create another one with the same name anyway?`,
          confirmLabel: 'Create Anyway',
        });
        if (!proceed) return;
      }
      const teamIds = Utils.qsa('.chip-checkbox input:checked', panel).map((i) => i.value);
      const patch = {
        name,
        clientId: Utils.qs('#pf-client', panel).value,
        deliverableType: Utils.qs('#pf-type', panel).value,
        startDate: Utils.qs('#pf-start', panel).value,
        status: Utils.qs('#pf-status', panel).value,
        teamIds,
      };
      if (isEdit) {
        DB.update('projects', project.id, patch);
        Toast.success('Project updated');
      } else {
        const newProj = { id: Utils.uid('p'), notes: [], files: [], createdAt: new Date().toISOString(), ...patch };
        DB.insert('projects', newProj);
        DB.logActivity('project', `New project created: ${name}`, { projectId: newProj.id });
        Toast.success('Project created');
      }
      ModalManager.close();
      App.refreshChrome();
      if (onSaved) onSaved(); else Router.render();
    });
  }

  // ---------- New SEO Project wizard ----------
  function openSeoProjectWizard(presetClientId, onSaved) {
    const clients = DB.all('clients');
    if (!clients.length) { Toast.error('Add a client first'); return; }
    const defaultTemplate = DB.all('auditTemplates')[0];
    const presetClient = presetClientId ? DB.get('clients', presetClientId) : null;
    const html = `
      <div class="modal-header"><h3>New SEO Project</h3><button class="icon-btn" data-act="close" aria-label="Close">&times;</button></div>
      <div class="modal-body task-modal-body">
        <div class="task-field-grid">
          <div class="task-field">
            <label>Client</label>
            <select id="sw-client" ${presetClientId ? 'disabled' : ''}>
              ${clients.map((c) => `<option value="${c.id}" ${(presetClientId || clients[0].id) === c.id ? 'selected' : ''}>${Utils.escapeHtml(c.name)}</option>`).join('')}
            </select>
          </div>
          <div class="task-field">
            <label>Project name</label>
            <input type="text" id="sw-name" value="${presetClient ? Utils.escapeHtml(presetClient.name + ' SEO Engagement') : ''}" />
          </div>
          <div class="task-field"><label>Start date</label><input type="date" id="sw-start" value="${Utils.todayISO()}" /></div>
          <div class="task-field">
            <label>Reporting cadence</label>
            <select id="sw-cadence">
              <option value="weekly">Weekly</option>
              <option value="monthly" selected>Monthly</option>
              <option value="none">Not scheduled</option>
            </select>
          </div>
        </div>

        <div class="task-field">
          <label>Target keywords <span class="text-muted">(one per line — optionally "keyword, starting rank")</span></label>
          <textarea id="sw-keywords" rows="4" placeholder="family dentist denver, 24&#10;emergency dentist near me"></textarea>
        </div>

        <div class="task-field">
          <label>Primary competitors <span class="text-muted">(2–5 domains, one per line)</span></label>
          <textarea id="sw-competitors" rows="3" placeholder="competitor-one.com&#10;competitor-two.com"></textarea>
        </div>

        <div class="task-field">
          <label>Scope</label>
          <div class="chip-checkbox-group">
            ${SEO_SCOPE_OPTIONS.map((s) => `<label class="chip-checkbox"><input type="checkbox" value="${s}" checked /><span>${s}</span></label>`).join('')}
          </div>
        </div>

        <div class="task-field">
          <label>Deliverables checklist <span class="text-muted">(auto-attaches as the project's technical audit checklist)</span></label>
          <div class="chip-checkbox-group" id="sw-deliverables">
            ${defaultTemplate.items.map((it) => `<label class="chip-checkbox"><input type="checkbox" value="${it.id}" data-text="${Utils.escapeHtml(it.text)}" checked /><span>${Utils.escapeHtml(it.text)}</span></label>`).join('')}
          </div>
        </div>

        <div class="task-field">
          <label>Baseline metrics <span class="text-muted">(so reports can show real before/after deltas)</span></label>
          <div class="task-field-grid">
            <div class="task-field"><label>Starting monthly traffic</label><input type="number" id="sw-traffic" min="0" placeholder="e.g. 1200" /></div>
            <div class="task-field"><label>Starting Domain Authority (DA)</label><input type="number" id="sw-da" min="0" max="100" placeholder="e.g. 18" /></div>
            <div class="task-field"><label>Starting Domain Rating (DR)</label><input type="number" id="sw-dr" min="0" max="100" placeholder="e.g. 15" /></div>
          </div>
        </div>
        <div class="auth-error" id="sw-error" hidden></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" data-act="close">Cancel</button>
        <button class="btn btn-primary" id="sw-save">Create SEO Project</button>
      </div>`;
    const panel = ModalManager.open(html, { size: 'lg' });
    Utils.qsa('[data-act="close"]', panel).forEach((b) => b.addEventListener('click', () => ModalManager.close()));

    Utils.qs('#sw-save', panel).addEventListener('click', async () => {
      const errBox = Utils.qs('#sw-error', panel);
      errBox.hidden = true;
      const name = Utils.qs('#sw-name', panel).value.trim();
      const clientId = presetClientId || Utils.qs('#sw-client', panel).value;
      const keywordLines = Utils.qs('#sw-keywords', panel).value.split('\n').map((l) => l.trim()).filter(Boolean);
      const competitorLines = Utils.qs('#sw-competitors', panel).value.split('\n').map((l) => l.trim()).filter(Boolean);
      const scope = Utils.qsa('.chip-checkbox-group input:checked', panel)
        .filter((i) => SEO_SCOPE_OPTIONS.includes(i.value)).map((i) => i.value);
      const deliverables = Utils.qsa('#sw-deliverables input:checked', panel).map((i) => ({ id: Utils.uid('del'), text: i.dataset.text, done: false }));

      if (!name) { errBox.textContent = 'Project name is required.'; errBox.hidden = false; return; }
      if (!keywordLines.length) { errBox.textContent = 'Add at least one target keyword.'; errBox.hidden = false; return; }
      if (competitorLines.length < 2 || competitorLines.length > 5) { errBox.textContent = 'Add between 2 and 5 primary competitors.'; errBox.hidden = false; return; }
      if (!scope.length) { errBox.textContent = 'Select at least one scope area.'; errBox.hidden = false; return; }

      const duplicate = DB.findByName('projects', name);
      if (duplicate) {
        const proceed = await ModalManager.confirmDialog({
          title: 'Duplicate project name',
          message: `A project named "${duplicate.name}" already exists. Create another one with the same name anyway?`,
          confirmLabel: 'Create Anyway',
        });
        if (!proceed) return;
      }

      const cadence = Utils.qs('#sw-cadence', panel).value;
      const startingKeywordRankings = [];
      const parsedKeywords = keywordLines.map((line) => {
        const [kw, rankStr] = line.split(',').map((s) => s.trim());
        const rank = rankStr ? Number(rankStr) : null;
        if (rank) startingKeywordRankings.push({ keyword: kw, rank });
        return { keyword: kw, rank };
      });

      const deliverableType = scope.length === 1 ? (SCOPE_TO_DELIVERABLE[scope[0]] || 'Full SEO Retainer') : 'Full SEO Retainer';

      const project = {
        id: Utils.uid('p'),
        clientId,
        name,
        deliverableType,
        startDate: Utils.qs('#sw-start', panel).value || Utils.todayISO(),
        status: 'active',
        teamIds: [],
        notes: [], files: [],
        createdAt: new Date().toISOString(),
        seo: {
          targetKeywords: parsedKeywords.map((k) => k.keyword),
          competitors: competitorLines,
          scope,
          reportingCadence: cadence,
          deliverables,
          baseline: {
            startingTraffic: Number(Utils.qs('#sw-traffic', panel).value) || 0,
            startingKeywordRankings,
            startingDA: Number(Utils.qs('#sw-da', panel).value) || 0,
            startingDR: Number(Utils.qs('#sw-dr', panel).value) || 0,
          },
        },
      };
      DB.insert('projects', project);
      DB.logActivity('project', `New SEO project created: ${name}`, { projectId: project.id });

      // Bulk-create keyword tracker entries from the target keyword list.
      parsedKeywords.forEach((k) => {
        DB.insert('keywords', {
          id: Utils.uid('k'), clientId, projectId: project.id, keyword: k.keyword, targetUrl: '', searchVolume: 0,
          history: k.rank ? [{ date: Utils.todayISO(), rank: k.rank }] : [],
        });
      });

      // Auto-attach the technical audit checklist using the selected deliverables.
      if (deliverables.length) {
        DB.insert('projectAudits', {
          id: Utils.uid('pa'), projectId: project.id, templateId: defaultTemplate.id, name: defaultTemplate.name,
          createdAt: new Date().toISOString(),
          items: deliverables.map((d) => ({ id: Utils.uid('pai'), text: d.text, status: 'pending', notes: '' })),
        });
      }

      // Wire the reporting cadence into the client's existing reportSchedule field.
      if (cadence !== 'none') {
        DB.update('clients', clientId, { reportSchedule: cadence === 'weekly' ? { frequency: 'weekly', weekday: 5 } : { frequency: 'monthly', weekday: 1 } });
      }

      ModalManager.close();
      Toast.success('SEO project created');
      App.refreshChrome();
      if (onSaved) onSaved(); else Router.navigate(`/projects/${project.id}`);
    });
  }

  Router.register('/projects', render);

  window.ProjectsView = { openProjectForm, openSeoProjectWizard, DELIVERABLE_TYPES, STATUSES, SEO_SCOPE_OPTIONS };
})();
