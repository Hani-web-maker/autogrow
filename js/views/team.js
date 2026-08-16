// views/team.js — team member management + workload view.
(() => {
  function render() {
    const outlet = document.getElementById('view-outlet');
    const team = DB.all('team');
    const tasks = DB.all('tasks').filter((t) => !t.recurrence);

    const workload = team.map((u) => ({
      label: u.name.split(' ')[0],
      value: tasks.filter((t) => t.assigneeIds.includes(u.id) && t.status !== 'Done').length,
      color: u.color,
    }));

    outlet.innerHTML = `
      <div class="view-header">
        <div><h1>Team</h1><p class="view-subtitle">Members and workload distribution</p></div>
        <button class="btn btn-primary" id="new-member-btn">+ Add Team Member</button>
      </div>

      <div class="panel">
        <div class="panel-header"><h3>Workload — open tasks per person</h3></div>
        <div class="panel-body">
          <canvas id="team-workload-chart" class="chart-canvas" style="height:${Math.max(120, workload.length * 36)}px"></canvas>
        </div>
      </div>

      <div class="card-grid" id="team-grid"></div>
    `;

    Charts.barChart(document.getElementById('team-workload-chart'), workload);
    document.getElementById('new-member-btn').addEventListener('click', () => openMemberForm());
    renderGrid();
  }

  function renderGrid() {
    const grid = document.getElementById('team-grid');
    const team = DB.all('team');
    const tasks = DB.all('tasks').filter((t) => !t.recurrence);
    grid.innerHTML = team.map((u) => {
      const open = tasks.filter((t) => t.assigneeIds.includes(u.id) && t.status !== 'Done');
      const overdue = open.filter((t) => Utils.isOverdue(t.dueDate, t.status));
      return `
      <div class="team-card">
        <div class="team-card-top">
          ${Utils.avatarHtml(u, 'avatar-lg')}
          <div>
            <div class="team-card-name">${Utils.escapeHtml(u.name)}</div>
            <div class="team-card-role">${Utils.escapeHtml(u.role)}</div>
          </div>
        </div>
        <div class="team-card-email">${Utils.escapeHtml(u.email)}</div>
        <div class="team-card-stats">
          <span>${open.length} open task${open.length !== 1 ? 's' : ''}</span>
          <span class="${overdue.length ? 'text-danger' : ''}">${overdue.length} overdue</span>
        </div>
        <div class="team-card-actions">
          <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${u.id}">Edit</button>
          <button class="btn btn-ghost btn-sm" data-act="delete" data-id="${u.id}">Remove</button>
        </div>
      </div>`;
    }).join('');

    grid.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const member = DB.get('team', btn.dataset.id);
      if (btn.dataset.act === 'edit') openMemberForm(member);
      if (btn.dataset.act === 'delete') {
        const ok = await ModalManager.confirmDialog({ title: 'Remove team member', message: `Remove ${member.name}? They will be unassigned from any tasks/projects.`, confirmLabel: 'Remove', danger: true });
        if (ok) {
          DB.all('tasks').forEach((t) => { t.assigneeIds = t.assigneeIds.filter((id) => id !== member.id); });
          DB.all('projects').forEach((p) => { p.teamIds = p.teamIds.filter((id) => id !== member.id); });
          DB.save();
          DB.remove('team', member.id);
          Toast.success('Team member removed');
          render();
        }
      }
    });
  }

  function openMemberForm(member) {
    const isEdit = !!member;
    const colors = ['#2563eb', '#0d9488', '#7c3aed', '#d97706', '#dc2626', '#059669', '#db2777', '#4338ca'];
    const html = `
      <div class="modal-header"><h3>${isEdit ? 'Edit Team Member' : 'Add Team Member'}</h3><button class="icon-btn" data-act="close" aria-label="Close">&times;</button></div>
      <div class="modal-body">
        <div class="task-field"><label>Name</label><input type="text" id="mf-name" value="${Utils.escapeHtml(member?.name || '')}" /></div>
        <div class="task-field-grid">
          <div class="task-field"><label>Role</label><input type="text" id="mf-role" value="${Utils.escapeHtml(member?.role || '')}" placeholder="e.g. SEO Strategist" /></div>
          <div class="task-field"><label>Email</label><input type="email" id="mf-email" value="${Utils.escapeHtml(member?.email || '')}" /></div>
        </div>
        <div class="task-field">
          <label>Color</label>
          <div class="color-swatch-row">
            ${colors.map((c) => `<button type="button" class="color-swatch ${member?.color === c ? 'selected' : ''}" data-color="${c}" style="background:${c}"></button>`).join('')}
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" data-act="close">Cancel</button>
        <button class="btn btn-primary" id="mf-save">${isEdit ? 'Save Changes' : 'Add Member'}</button>
      </div>`;
    const panel = ModalManager.open(html, { size: 'sm' });
    let selectedColor = member?.color || colors[Math.floor(Math.random() * colors.length)];
    Utils.qsa('.color-swatch', panel).forEach((sw) => {
      if (sw.dataset.color === selectedColor) sw.classList.add('selected');
      sw.addEventListener('click', () => {
        selectedColor = sw.dataset.color;
        Utils.qsa('.color-swatch', panel).forEach((s) => s.classList.toggle('selected', s === sw));
      });
    });
    Utils.qsa('[data-act="close"]', panel).forEach((b) => b.addEventListener('click', () => ModalManager.close()));
    Utils.qs('#mf-save', panel).addEventListener('click', () => {
      const name = Utils.qs('#mf-name', panel).value.trim();
      if (!name) { Toast.error('Name is required'); return; }
      const email = Utils.qs('#mf-email', panel).value.trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { Toast.error('Enter a valid email address'); return; }
      const patch = {
        name,
        role: Utils.qs('#mf-role', panel).value.trim(),
        email: Utils.qs('#mf-email', panel).value.trim(),
        color: selectedColor,
        initials: Utils.initials(name),
      };
      if (isEdit) { DB.update('team', member.id, patch); Toast.success('Team member updated'); }
      else { DB.insert('team', { id: Utils.uid('u'), ...patch }); Toast.success('Team member added'); }
      ModalManager.close();
      App.refreshChrome();
      render();
    });
  }

  Router.register('/team', render);
})();
