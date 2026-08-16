// views/projects.js — cross-client project list.
(() => {
  const DELIVERABLE_TYPES = ['Technical SEO Audit', 'Link Building Campaign', 'Content Strategy', 'Local SEO', 'Full SEO Retainer'];
  const STATUSES = ['active', 'on hold', 'completed'];

  function render() {
    const outlet = document.getElementById('view-outlet');
    outlet.innerHTML = `
      <div class="view-header">
        <div><h1>Projects</h1><p class="view-subtitle">All SEO engagements across clients</p></div>
        <button class="btn btn-primary" id="new-project-btn">+ New Project</button>
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
      <div class="modal-header"><h3>${isEdit ? 'Edit Project' : 'New Project'}</h3><button class="icon-btn" data-act="close">&times;</button></div>
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
    Utils.qs('#pf-save', panel).addEventListener('click', () => {
      const name = Utils.qs('#pf-name', panel).value.trim();
      if (!name) { Toast.error('Project name is required'); return; }
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

  Router.register('/projects', render);

  window.ProjectsView = { openProjectForm, DELIVERABLE_TYPES, STATUSES };
})();
