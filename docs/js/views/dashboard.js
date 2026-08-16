// views/dashboard.js — agency-wide overview.
(() => {
  function render() {
    const outlet = document.getElementById('view-outlet');
    const tasks = DB.all('tasks').filter((t) => !t.recurrence);
    const projects = DB.all('projects');
    const clients = DB.all('clients');
    const team = DB.all('team');
    const today = Utils.todayISO();
    const week = Utils.weekRange(today);

    const dueThisWeek = tasks.filter((t) => t.dueDate && t.dueDate >= week.start && t.dueDate <= week.end && t.status !== 'Done');
    const overdue = tasks.filter((t) => Utils.isOverdue(t.dueDate, t.status));
    const activeProjects = projects.filter((p) => p.status === 'active');
    const reportsDue = DB.all('reports').filter((r) => r.status === 'draft');

    const overdueByMember = team.map((u) => ({
      user: u,
      count: overdue.filter((t) => t.assigneeIds.includes(u.id)).length,
    })).filter((r) => r.count > 0).sort((a, b) => b.count - a.count);

    const workload = team.map((u) => ({
      label: u.name.split(' ')[0],
      value: tasks.filter((t) => t.assigneeIds.includes(u.id) && t.status !== 'Done').length,
      color: u.color,
    }));

    outlet.innerHTML = `
      <div class="view-header">
        <div>
          <h1>Dashboard</h1>
          <p class="view-subtitle">Agency overview — ${Utils.formatDate(today, { weekday: 'long' })}</p>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-value">${dueThisWeek.length}</div>
          <div class="stat-label">Tasks due this week</div>
        </div>
        <div class="stat-card ${overdue.length ? 'stat-card-warn' : ''}">
          <div class="stat-value">${overdue.length}</div>
          <div class="stat-label">Overdue tasks</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${activeProjects.length}</div>
          <div class="stat-label">Active projects</div>
        </div>
        <div class="stat-card ${reportsDue.length ? 'stat-card-accent' : ''}">
          <div class="stat-value">${reportsDue.length}</div>
          <div class="stat-label">Reports awaiting review</div>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="panel">
          <div class="panel-header"><h3>Due this week</h3><a href="#/my-tasks" class="link-btn">View all</a></div>
          <div class="panel-body">
            ${dueThisWeek.length ? listTasks(dueThisWeek.slice(0, 8)) : emptyInline('Nothing due this week. 🎉')}
          </div>
        </div>

        <div class="panel">
          <div class="panel-header"><h3>Overdue by team member</h3></div>
          <div class="panel-body">
            ${overdueByMember.length ? overdueByMember.map((r) => `
              <div class="workload-row">
                ${Utils.avatarHtml(r.user)}
                <span class="workload-name">${Utils.escapeHtml(r.user.name)}</span>
                <span class="badge status-overdue">${r.count} overdue</span>
              </div>`).join('') : emptyInline('No overdue tasks. Nice work.')}
          </div>
        </div>

        <div class="panel">
          <div class="panel-header"><h3>Active projects</h3><a href="#/projects" class="link-btn">View all</a></div>
          <div class="panel-body">
            ${activeProjects.length ? activeProjects.slice(0, 6).map((p) => {
              const client = DB.get('clients', p.clientId);
              const pTasks = DB.all('tasks').filter((t) => t.projectId === p.id && !t.recurrence);
              const done = pTasks.filter((t) => t.status === 'Done').length;
              const pct = pTasks.length ? Math.round((done / pTasks.length) * 100) : 0;
              return `
              <a class="project-row" href="#/projects/${p.id}">
                <div>
                  <div class="project-row-name">${Utils.escapeHtml(p.name)}</div>
                  <div class="project-row-client">${Utils.escapeHtml(client?.name || '')}</div>
                </div>
                <div class="progress-mini"><div class="progress-mini-bar" style="width:${pct}%"></div></div>
                <span class="progress-pct">${pct}%</span>
              </a>`;
            }).join('') : emptyInline('No active projects yet.')}
          </div>
        </div>

        <div class="panel">
          <div class="panel-header"><h3>Reports due</h3><a href="#/reports" class="link-btn">Open Reports</a></div>
          <div class="panel-body">
            ${reportsDue.length ? reportsDue.map((r) => {
              const client = DB.get('clients', r.clientId);
              return `
              <div class="workload-row">
                <span class="badge status-draft">${r.frequency}</span>
                <span class="workload-name">${Utils.escapeHtml(client?.name || 'Unknown client')}</span>
                <span class="report-period">${Utils.formatDateShort(r.period.start)} – ${Utils.formatDateShort(r.period.end)}</span>
              </div>`;
            }).join('') : emptyInline('No report drafts pending.')}
          </div>
        </div>

        <div class="panel panel-wide">
          <div class="panel-header"><h3>Workload — open tasks per team member</h3><a href="#/team" class="link-btn">Team</a></div>
          <div class="panel-body">
            <canvas id="workload-chart" class="chart-canvas" style="height:${Math.max(120, workload.length * 34)}px"></canvas>
          </div>
        </div>
      </div>
    `;

    Charts.barChart(document.getElementById('workload-chart'), workload);
  }

  function listTasks(tasks) {
    return tasks.map((t) => {
      const project = DB.get('projects', t.projectId);
      const assignees = t.assigneeIds.map((id) => DB.get('team', id)).filter(Boolean);
      return `
      <a class="task-list-row" href="#/projects/${t.projectId}?task=${t.id}">
        <span class="task-list-title">${Utils.escapeHtml(t.title)}</span>
        <span class="task-list-project">${Utils.escapeHtml(project?.name || '')}</span>
        ${Utils.priorityBadge(t.priority)}
        <span class="task-list-due ${Utils.isOverdue(t.dueDate, t.status) ? 'text-danger' : ''}">${Utils.formatDateShort(t.dueDate)}</span>
        ${Utils.avatarGroupHtml(assignees, 'avatar-sm')}
      </a>`;
    }).join('');
  }

  function emptyInline(msg) {
    return `<div class="empty-inline-panel">${msg}</div>`;
  }

  Router.register('/dashboard', render);
})();
