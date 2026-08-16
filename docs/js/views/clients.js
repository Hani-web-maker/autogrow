// views/clients.js — client list (CRUD) + client detail.
(() => {
  function renderList() {
    const outlet = document.getElementById('view-outlet');
    outlet.innerHTML = `
      <div class="view-header">
        <div><h1>Clients</h1><p class="view-subtitle">Manage agency clients and contracts</p></div>
        <button class="btn btn-primary" id="new-client-btn">+ New Client</button>
      </div>
      <div class="toolbar">
        <input type="text" id="client-search" class="input" placeholder="Search clients…" />
        <select id="client-status-filter" class="input">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="churned">Churned</option>
        </select>
      </div>
      <div class="card-grid" id="clients-grid"></div>
    `;
    document.getElementById('new-client-btn').addEventListener('click', () => openClientForm());
    const search = document.getElementById('client-search');
    const statusFilter = document.getElementById('client-status-filter');
    const run = () => renderGrid(search.value.toLowerCase(), statusFilter.value);
    search.addEventListener('input', Utils.debounce(run, 150));
    statusFilter.addEventListener('change', run);
    run();
  }

  function renderGrid(query = '', status = '') {
    const grid = document.getElementById('clients-grid');
    let clients = DB.all('clients');
    if (query) clients = clients.filter((c) => c.name.toLowerCase().includes(query) || c.contactName.toLowerCase().includes(query));
    if (status) clients = clients.filter((c) => c.status === status);

    if (!clients.length) {
      grid.innerHTML = `<div class="empty-state"><h3>No clients found</h3><p>Try adjusting your search or add a new client.</p></div>`;
      return;
    }

    grid.innerHTML = clients.map((c) => {
      const projects = DB.all('projects').filter((p) => p.clientId === c.id);
      const activeTasks = DB.all('tasks').filter((t) => t.clientId === c.id && t.status !== 'Done' && !t.recurrence);
      return `
      <a class="client-card" href="#/clients/${c.id}">
        <div class="client-card-top">
          <div class="client-card-name">${Utils.escapeHtml(c.name)}</div>
          <span class="badge status-${c.status}">${c.status}</span>
        </div>
        <div class="client-card-meta">${Utils.escapeHtml(c.website)}</div>
        <div class="client-card-meta">${Utils.escapeHtml(c.contactName)} · ${c.contractType}</div>
        <div class="client-card-stats">
          <span>${projects.length} project${projects.length !== 1 ? 's' : ''}</span>
          <span>${activeTasks.length} open task${activeTasks.length !== 1 ? 's' : ''}</span>
        </div>
      </a>`;
    }).join('');
  }

  function openClientForm(client) {
    const isEdit = !!client;
    const html = `
      <div class="modal-header"><h3>${isEdit ? 'Edit Client' : 'New Client'}</h3><button class="icon-btn" data-act="close">&times;</button></div>
      <div class="modal-body">
        <div class="task-field"><label>Client / Company name</label><input type="text" id="cf-name" value="${Utils.escapeHtml(client?.name || '')}" /></div>
        <div class="task-field-grid">
          <div class="task-field"><label>Contact name</label><input type="text" id="cf-contact" value="${Utils.escapeHtml(client?.contactName || '')}" /></div>
          <div class="task-field"><label>Contact email</label><input type="email" id="cf-email" value="${Utils.escapeHtml(client?.contactEmail || '')}" /></div>
          <div class="task-field"><label>Contact phone</label><input type="text" id="cf-phone" value="${Utils.escapeHtml(client?.contactPhone || '')}" /></div>
          <div class="task-field"><label>Website URL</label><input type="text" id="cf-website" value="${Utils.escapeHtml(client?.website || '')}" /></div>
          <div class="task-field">
            <label>Contract type</label>
            <select id="cf-contract">
              <option value="monthly retainer" ${client?.contractType === 'monthly retainer' ? 'selected' : ''}>Monthly retainer</option>
              <option value="project-based" ${client?.contractType === 'project-based' ? 'selected' : ''}>Project-based</option>
            </select>
          </div>
          <div class="task-field">
            <label>Status</label>
            <select id="cf-status">
              <option value="active" ${client?.status === 'active' ? 'selected' : ''}>Active</option>
              <option value="paused" ${client?.status === 'paused' ? 'selected' : ''}>Paused</option>
              <option value="churned" ${client?.status === 'churned' ? 'selected' : ''}>Churned</option>
            </select>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" data-act="close">Cancel</button>
        <button class="btn btn-primary" id="cf-save">${isEdit ? 'Save Changes' : 'Create Client'}</button>
      </div>`;
    const panel = ModalManager.open(html, { size: 'md' });
    Utils.qsa('[data-act="close"]', panel).forEach((b) => b.addEventListener('click', () => ModalManager.close()));
    Utils.qs('#cf-save', panel).addEventListener('click', () => {
      const name = Utils.qs('#cf-name', panel).value.trim();
      if (!name) { Toast.error('Client name is required'); return; }
      const patch = {
        name,
        contactName: Utils.qs('#cf-contact', panel).value.trim(),
        contactEmail: Utils.qs('#cf-email', panel).value.trim(),
        contactPhone: Utils.qs('#cf-phone', panel).value.trim(),
        website: Utils.qs('#cf-website', panel).value.trim(),
        contractType: Utils.qs('#cf-contract', panel).value,
        status: Utils.qs('#cf-status', panel).value,
      };
      if (isEdit) {
        DB.update('clients', client.id, patch);
        Toast.success('Client updated');
      } else {
        DB.insert('clients', { id: Utils.uid('c'), reportSchedule: { frequency: 'none' }, createdAt: new Date().toISOString(), ...patch });
        DB.logActivity('client', `New client added: ${name}`, {});
        Toast.success('Client created');
      }
      ModalManager.close();
      App.refreshChrome();
      Router.render();
    });
  }

  function renderDetail(params) {
    const outlet = document.getElementById('view-outlet');
    const client = DB.get('clients', params.id);
    if (!client) { outlet.innerHTML = `<div class="empty-state"><h3>Client not found</h3><a href="#/clients">Back to clients</a></div>`; return; }
    const projects = DB.all('projects').filter((p) => p.clientId === client.id);
    const openIssues = DB.all('issues').filter((i) => i.clientId === client.id && i.status !== 'Resolved');
    const keywords = DB.all('keywords').filter((k) => k.clientId === client.id);

    outlet.innerHTML = `
      <div class="view-header">
        <div>
          <a href="#/clients" class="back-link">← All clients</a>
          <h1>${Utils.escapeHtml(client.name)}</h1>
          <p class="view-subtitle">${Utils.escapeHtml(client.website)}</p>
        </div>
        <div class="view-header-actions">
          <span class="badge status-${client.status}">${client.status}</span>
          <button class="btn btn-ghost" id="edit-client-btn">Edit</button>
          <button class="btn btn-danger" id="delete-client-btn">Delete</button>
        </div>
      </div>

      <div class="detail-grid">
        <div class="panel">
          <div class="panel-header"><h3>Contact</h3></div>
          <div class="panel-body">
            <div class="kv-row"><span>Contact</span><strong>${Utils.escapeHtml(client.contactName || '—')}</strong></div>
            <div class="kv-row"><span>Email</span><strong>${Utils.escapeHtml(client.contactEmail || '—')}</strong></div>
            <div class="kv-row"><span>Phone</span><strong>${Utils.escapeHtml(client.contactPhone || '—')}</strong></div>
            <div class="kv-row"><span>Contract</span><strong>${Utils.escapeHtml(client.contractType)}</strong></div>
            <div class="kv-row"><span>Client since</span><strong>${Utils.formatDate(client.createdAt?.slice(0,10))}</strong></div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header"><h3>Report schedule</h3></div>
          <div class="panel-body">
            <div class="task-field">
              <label>Frequency</label>
              <select id="report-freq">
                <option value="none" ${client.reportSchedule?.frequency === 'none' ? 'selected' : ''}>Not scheduled</option>
                <option value="weekly" ${client.reportSchedule?.frequency === 'weekly' ? 'selected' : ''}>Weekly — every Friday</option>
                <option value="monthly" ${client.reportSchedule?.frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
              </select>
            </div>
            <p class="hint-text">A fresh report draft is generated automatically for the current period when this workspace loads.</p>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header"><h3>Snapshot</h3></div>
          <div class="panel-body">
            <div class="kv-row"><span>Projects</span><strong>${projects.length}</strong></div>
            <div class="kv-row"><span>Tracked keywords</span><strong>${keywords.length}</strong></div>
            <div class="kv-row"><span>Open issues</span><strong>${openIssues.length}</strong></div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h3>Projects</h3>
          <button class="btn btn-primary btn-sm" id="new-project-btn">+ New Project</button>
        </div>
        <div class="panel-body">
          ${projects.length ? `<div class="project-list">${projects.map((p) => projectRow(p)).join('')}</div>` : `<div class="empty-inline-panel">No projects yet for this client.</div>`}
        </div>
      </div>
    `;

    document.getElementById('edit-client-btn').addEventListener('click', () => openClientForm(client));
    document.getElementById('delete-client-btn').addEventListener('click', async () => {
      const ok = await ModalManager.confirmDialog({ title: 'Delete client', message: `Delete ${client.name} and unlink related projects? Projects/tasks/keywords will remain but lose their client link.`, confirmLabel: 'Delete', danger: true });
      if (ok) {
        DB.remove('clients', client.id);
        Toast.success('Client deleted');
        Router.navigate('/clients');
      }
    });
    document.getElementById('report-freq').addEventListener('change', (e) => {
      const freq = e.target.value;
      const schedule = freq === 'weekly' ? { frequency: 'weekly', weekday: 5 } : freq === 'monthly' ? { frequency: 'monthly', weekday: 1 } : { frequency: 'none' };
      DB.update('clients', client.id, { reportSchedule: schedule });
      Toast.success('Report schedule updated');
    });
    document.getElementById('new-project-btn').addEventListener('click', () => {
      window.ProjectsView.openProjectForm(null, client.id, () => Router.render());
    });
  }

  function projectRow(p) {
    const pTasks = DB.all('tasks').filter((t) => t.projectId === p.id && !t.recurrence);
    const done = pTasks.filter((t) => t.status === 'Done').length;
    const pct = pTasks.length ? Math.round((done / pTasks.length) * 100) : 0;
    return `
      <a class="project-row" href="#/projects/${p.id}">
        <div>
          <div class="project-row-name">${Utils.escapeHtml(p.name)}</div>
          <div class="project-row-client">${Utils.escapeHtml(p.deliverableType)} · ${Utils.escapeHtml(p.status)}</div>
        </div>
        <div class="progress-mini"><div class="progress-mini-bar" style="width:${pct}%"></div></div>
        <span class="progress-pct">${pct}%</span>
      </a>`;
  }

  Router.register('/clients', renderList);
  Router.register('/clients/:id', renderDetail);

  window.ClientsView = { openClientForm };
})();
