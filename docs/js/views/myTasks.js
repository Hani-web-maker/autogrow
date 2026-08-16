// views/myTasks.js — per-user task list with smart filters, global sort/filter/search.
(() => {
  let smartFilter = 'all';
  let sortBy = 'dueDate';

  function render(params, query) {
    const outlet = document.getElementById('view-outlet');
    const user = DB.currentUser();
    const clients = DB.all('clients');
    const projects = DB.all('projects');

    outlet.innerHTML = `
      <div class="view-header">
        <div>
          <h1>My Tasks</h1>
          <p class="view-subtitle">Everything assigned to ${Utils.avatarHtml(user, 'avatar-sm')} ${Utils.escapeHtml(user.name)} across all projects</p>
        </div>
        <button class="btn btn-primary" id="mt-new-task-btn">+ New Task</button>
      </div>

      <div class="smart-filter-tabs" id="smart-tabs">
        <button class="smart-tab" data-f="all">All</button>
        <button class="smart-tab" data-f="today">Today</button>
        <button class="smart-tab" data-f="overdue">Overdue</button>
        <button class="smart-tab" data-f="upcoming">Upcoming (7d)</button>
      </div>

      <div class="toolbar">
        <input type="text" id="mt-search" class="input" placeholder="Search my tasks…" />
        <select id="mt-client-filter" class="input"><option value="">All clients</option>${clients.map((c) => `<option value="${c.id}">${Utils.escapeHtml(c.name)}</option>`).join('')}</select>
        <select id="mt-project-filter" class="input"><option value="">All projects</option>${projects.map((p) => `<option value="${p.id}">${Utils.escapeHtml(p.name)}</option>`).join('')}</select>
        <select id="mt-status-filter" class="input"><option value="">All statuses</option>${TaskModal.STATUSES.map((s) => `<option>${s}</option>`).join('')}</select>
        <select id="mt-priority-filter" class="input"><option value="">All priorities</option>${TaskModal.PRIORITIES.map((p) => `<option>${p}</option>`).join('')}</select>
        <select id="mt-sort" class="input">
          <option value="dueDate">Sort: Due date</option>
          <option value="priority">Sort: Priority</option>
          <option value="status">Sort: Status</option>
          <option value="client">Sort: Client</option>
        </select>
      </div>

      <div id="mt-list" class="task-table-wrap"></div>
    `;

    Utils.qsa('.smart-tab', outlet).forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.f === smartFilter);
      tab.addEventListener('click', () => { smartFilter = tab.dataset.f; run(); });
    });

    const search = document.getElementById('mt-search');
    const clientFilter = document.getElementById('mt-client-filter');
    const projectFilter = document.getElementById('mt-project-filter');
    const statusFilter = document.getElementById('mt-status-filter');
    const priorityFilter = document.getElementById('mt-priority-filter');
    const sortSelect = document.getElementById('mt-sort');
    sortSelect.value = sortBy;

    function run() {
      Utils.qsa('.smart-tab', outlet).forEach((tab) => tab.classList.toggle('active', tab.dataset.f === smartFilter));
      sortBy = sortSelect.value;
      renderList(user.id, {
        query: search.value.toLowerCase(),
        clientId: clientFilter.value,
        projectId: projectFilter.value,
        status: statusFilter.value,
        priority: priorityFilter.value,
        smart: smartFilter,
        sort: sortBy,
      });
    }

    [search].forEach((el) => el.addEventListener('input', Utils.debounce(run, 150)));
    [clientFilter, projectFilter, statusFilter, priorityFilter, sortSelect].forEach((el) => el.addEventListener('change', run));
    document.getElementById('mt-new-task-btn').addEventListener('click', () => {
      TaskModal.openCreateForm({ assigneeIds: [user.id] }, { onCreate: () => run() });
    });

    if (query && query.task) {
      TaskModal.open(query.task, { onChange: run });
    }

    run();
  }

  function renderList(userId, filter) {
    const container = document.getElementById('mt-list');
    let tasks = DB.all('tasks').filter((t) => !t.recurrence && t.assigneeIds.includes(userId));

    if (filter.smart === 'today') tasks = tasks.filter((t) => Utils.isToday(t.dueDate) && t.status !== 'Done');
    if (filter.smart === 'overdue') tasks = tasks.filter((t) => Utils.isOverdue(t.dueDate, t.status));
    if (filter.smart === 'upcoming') tasks = tasks.filter((t) => Utils.isUpcoming(t.dueDate) && t.status !== 'Done');

    if (filter.query) tasks = tasks.filter((t) => t.title.toLowerCase().includes(filter.query));
    if (filter.clientId) tasks = tasks.filter((t) => t.clientId === filter.clientId);
    if (filter.projectId) tasks = tasks.filter((t) => t.projectId === filter.projectId);
    if (filter.status) tasks = tasks.filter((t) => t.status === filter.status);
    if (filter.priority) tasks = tasks.filter((t) => t.priority === filter.priority);

    const priorityRank = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
    tasks.sort((a, b) => {
      if (filter.sort === 'priority') return priorityRank[a.priority] - priorityRank[b.priority];
      if (filter.sort === 'status') return a.status.localeCompare(b.status);
      if (filter.sort === 'client') return (DB.get('clients', a.clientId)?.name || '').localeCompare(DB.get('clients', b.clientId)?.name || '');
      return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
    });

    if (!tasks.length) {
      container.innerHTML = `<div class="empty-state"><h3>No tasks here</h3><p>Nothing matches these filters right now.</p></div>`;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead><tr><th></th><th>Task</th><th>Client / Project</th><th>Status</th><th>Priority</th><th>Due</th><th>Tags</th></tr></thead>
        <tbody>
          ${tasks.map((t) => {
            const client = DB.get('clients', t.clientId);
            const project = DB.get('projects', t.projectId);
            const doneCheck = t.status === 'Done';
            return `
            <tr class="clickable-row" data-id="${t.id}">
              <td><input type="checkbox" class="mt-done-check" data-id="${t.id}" ${doneCheck ? 'checked' : ''} /></td>
              <td class="task-list-title">${Utils.escapeHtml(t.title)}</td>
              <td>${Utils.escapeHtml(client?.name || '—')}${project ? ' / ' + Utils.escapeHtml(project.name) : ''}</td>
              <td>${Utils.statusBadge(t.status)}</td>
              <td>${Utils.priorityBadge(t.priority)}</td>
              <td class="${Utils.isOverdue(t.dueDate, t.status) ? 'text-danger' : ''}">${Utils.formatDateShort(t.dueDate)}</td>
              <td>${(t.tags || []).map((tag) => `<span class="tag-chip">${Utils.escapeHtml(tag)}</span>`).join('')}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;

    Utils.qsa('.clickable-row', container).forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.classList.contains('mt-done-check')) return;
        TaskModal.open(row.dataset.id, { onChange: () => renderList(userId, filter) });
      });
    });
    Utils.qsa('.mt-done-check', container).forEach((cb) => {
      cb.addEventListener('click', (e) => e.stopPropagation());
      cb.addEventListener('change', () => {
        const patch = cb.checked ? { status: 'Done', completedAt: new Date().toISOString() } : { status: 'To Do', completedAt: null };
        DB.update('tasks', cb.dataset.id, patch);
        App.refreshChrome();
        renderList(userId, filter);
      });
    });
  }

  Router.register('/my-tasks', render);
})();
