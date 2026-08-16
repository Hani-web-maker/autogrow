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
      <div class="modal-header"><h3>${isEdit ? 'Edit Client' : 'New Client'}</h3><button class="icon-btn" data-act="close" aria-label="Close">&times;</button></div>
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
    Utils.qs('#cf-save', panel).addEventListener('click', async () => {
      const name = Utils.qs('#cf-name', panel).value.trim();
      if (!name) { Toast.error('Client name is required'); return; }
      const email = Utils.qs('#cf-email', panel).value.trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { Toast.error('Enter a valid contact email'); return; }
      const duplicate = DB.findByName('clients', name, client?.id);
      if (duplicate) {
        const proceed = await ModalManager.confirmDialog({
          title: 'Duplicate client name',
          message: `A client named "${duplicate.name}" already exists. Create another one with the same name anyway?`,
          confirmLabel: 'Create Anyway',
        });
        if (!proceed) return;
      }
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
          <div class="view-header-actions">
            <button class="btn btn-ghost btn-sm" id="new-seo-project-btn">+ New SEO Project</button>
            <button class="btn btn-primary btn-sm" id="new-project-btn">+ New Project</button>
          </div>
        </div>
        <div class="panel-body">
          ${projects.length ? `<div class="project-list">${projects.map((p) => projectRow(p)).join('')}</div>` : `<div class="empty-inline-panel">No projects yet for this client.</div>`}
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h3>Site Access</h3>
          <button class="btn btn-primary btn-sm" id="new-site-access-btn">+ Add Site Access</button>
        </div>
        <div class="panel-body">
          <p class="hint-text site-access-notice">Reference inventory only — GrowMark does not store passwords. Keep actual credentials in your team's password manager and link to them here.</p>
          <div id="site-access-list"></div>
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
    document.getElementById('new-seo-project-btn').addEventListener('click', () => {
      window.ProjectsView.openSeoProjectWizard(client.id, () => Router.render());
    });
    document.getElementById('new-site-access-btn').addEventListener('click', () => openSiteAccessForm(client));
    renderSiteAccessList(client);
  }

  // ---------- Site Access (Option B: reference inventory, no stored secrets) ----------
  function renderSiteAccessList(client) {
    const container = document.getElementById('site-access-list');
    if (!container) return;
    const entries = DB.all('siteAccess').filter((s) => s.clientId === client.id);
    if (!entries.length) {
      container.innerHTML = `<div class="empty-inline-panel">No site access recorded yet. Add the client's site URL, CMS, and where the team can find login credentials.</div>`;
      return;
    }
    container.innerHTML = entries.map((s) => `
      <div class="site-access-card" data-id="${s.id}">
        <div class="site-access-card-top">
          <strong>${Utils.escapeHtml(s.label || s.siteUrl || 'Site access')}</strong>
          <div class="row-actions">
            <button class="icon-btn-sm" data-act="edit-site-access" data-id="${s.id}" aria-label="Edit site access">✎</button>
            <button class="icon-btn-sm" data-act="delete-site-access" data-id="${s.id}" aria-label="Delete site access">🗑</button>
          </div>
        </div>
        <div class="kv-row"><span>Site URL</span><strong>${s.siteUrl ? `<a href="${Utils.escapeHtml(s.siteUrl)}" target="_blank" rel="noopener">${Utils.escapeHtml(s.siteUrl)}</a>` : '—'}</strong></div>
        <div class="kv-row"><span>CMS / Host</span><strong>${Utils.escapeHtml(s.cmsHost || '—')}</strong></div>
        <div class="kv-row"><span>GSC property</span><strong>${Utils.escapeHtml(s.gscProperty || '—')}</strong></div>
        <div class="kv-row"><span>GA4 property</span><strong>${Utils.escapeHtml(s.ga4Property || '—')}</strong></div>
        <div class="kv-row"><span>Hosting / registrar</span><strong>${Utils.escapeHtml(s.hostingRegistrar || '—')}</strong></div>
        <div class="kv-row"><span>Credentials</span><strong>${Utils.escapeHtml(s.credentialsRef || '—')}</strong></div>
        ${s.linkOut ? `<div class="kv-row"><span>Link out</span><strong><a href="${Utils.escapeHtml(s.linkOut)}" target="_blank" rel="noopener">Open →</a></strong></div>` : ''}
        ${s.notes ? `<div class="site-access-notes">${Utils.escapeHtml(s.notes)}</div>` : ''}
      </div>`).join('');

    Utils.qsa('[data-act="edit-site-access"]', container).forEach((btn) => {
      btn.addEventListener('click', () => openSiteAccessForm(client, DB.get('siteAccess', btn.dataset.id)));
    });
    Utils.qsa('[data-act="delete-site-access"]', container).forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ok = await ModalManager.confirmDialog({ title: 'Delete site access entry', message: 'Remove this site access record?', confirmLabel: 'Delete', danger: true });
        if (ok) { DB.remove('siteAccess', btn.dataset.id); Toast.success('Removed'); renderSiteAccessList(client); }
      });
    });
  }

  function openSiteAccessForm(client, entry) {
    const isEdit = !!entry;
    const html = `
      <div class="modal-header"><h3>${isEdit ? 'Edit Site Access' : 'Add Site Access'}</h3><button class="icon-btn" data-act="close" aria-label="Close">&times;</button></div>
      <div class="modal-body">
        <p class="hint-text site-access-notice">Store references only — e.g. "in 1Password: Client Vault". GrowMark does not encrypt or store actual passwords.</p>
        <div class="task-field"><label>Label</label><input type="text" id="sa-label" placeholder="e.g. Primary WordPress site" value="${Utils.escapeHtml(entry?.label || '')}" /></div>
        <div class="task-field-grid">
          <div class="task-field"><label>Site URL</label><input type="text" id="sa-url" placeholder="https://client-site.com" value="${Utils.escapeHtml(entry?.siteUrl || '')}" /></div>
          <div class="task-field"><label>CMS / Host</label><input type="text" id="sa-cms" placeholder="e.g. WordPress on WP Engine" value="${Utils.escapeHtml(entry?.cmsHost || '')}" /></div>
          <div class="task-field"><label>GSC property</label><input type="text" id="sa-gsc" value="${Utils.escapeHtml(entry?.gscProperty || '')}" /></div>
          <div class="task-field"><label>GA4 property</label><input type="text" id="sa-ga4" value="${Utils.escapeHtml(entry?.ga4Property || '')}" /></div>
          <div class="task-field"><label>Hosting / domain registrar</label><input type="text" id="sa-hosting" value="${Utils.escapeHtml(entry?.hostingRegistrar || '')}" /></div>
          <div class="task-field"><label>Credentials location</label><input type="text" id="sa-creds" placeholder="e.g. in 1Password — Client Vault" value="${Utils.escapeHtml(entry?.credentialsRef || '')}" /></div>
        </div>
        <div class="task-field"><label>Link out (optional)</label><input type="text" id="sa-linkout" placeholder="Direct link to the password manager entry" value="${Utils.escapeHtml(entry?.linkOut || '')}" /></div>
        <div class="task-field"><label>Notes</label><textarea id="sa-notes" rows="2">${Utils.escapeHtml(entry?.notes || '')}</textarea></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" data-act="close">Cancel</button>
        <button class="btn btn-primary" id="sa-save">${isEdit ? 'Save Changes' : 'Add Site Access'}</button>
      </div>`;
    const panel = ModalManager.open(html, { size: 'md' });
    Utils.qsa('[data-act="close"]', panel).forEach((b) => b.addEventListener('click', () => ModalManager.close()));
    Utils.qs('#sa-save', panel).addEventListener('click', () => {
      const siteUrl = Utils.qs('#sa-url', panel).value.trim();
      const label = Utils.qs('#sa-label', panel).value.trim();
      if (!siteUrl && !label) { Toast.error('Enter at least a label or site URL'); return; }
      const patch = {
        label, siteUrl,
        cmsHost: Utils.qs('#sa-cms', panel).value.trim(),
        gscProperty: Utils.qs('#sa-gsc', panel).value.trim(),
        ga4Property: Utils.qs('#sa-ga4', panel).value.trim(),
        hostingRegistrar: Utils.qs('#sa-hosting', panel).value.trim(),
        credentialsRef: Utils.qs('#sa-creds', panel).value.trim(),
        linkOut: Utils.qs('#sa-linkout', panel).value.trim(),
        notes: Utils.qs('#sa-notes', panel).value.trim(),
      };
      if (isEdit) {
        DB.update('siteAccess', entry.id, patch);
        Toast.success('Site access updated');
      } else {
        DB.insert('siteAccess', { id: Utils.uid('sa'), clientId: client.id, createdAt: new Date().toISOString(), ...patch });
        Toast.success('Site access added');
      }
      ModalManager.close();
      renderSiteAccessList(client);
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
