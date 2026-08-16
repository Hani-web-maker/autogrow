// views/projectDetail.js — single project workspace: overview, tasks (4 views),
// keywords, content, backlinks, audit checklist, issue log, files & notes.
(() => {
  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'keywords', label: 'Keywords' },
    { id: 'content', label: 'Content' },
    { id: 'backlinks', label: 'Backlinks' },
    { id: 'audit', label: 'Audit Checklist' },
    { id: 'issues', label: 'Issue Log' },
    { id: 'files', label: 'Files & Notes' },
  ];

  let state = null;

  function render(params, query) {
    const outlet = document.getElementById('view-outlet');
    const project = DB.get('projects', params.id);
    if (!project) {
      outlet.innerHTML = `<div class="empty-state"><h3>Project not found</h3><a href="#/projects">Back to projects</a></div>`;
      return;
    }
    if (!state || state.projectId !== project.id) {
      state = { projectId: project.id, tab: 'overview', taskView: 'kanban' };
    }
    if (query.tab) state.tab = query.tab;

    const client = DB.get('clients', project.clientId);
    const team = project.teamIds.map((id) => DB.get('team', id)).filter(Boolean);

    outlet.innerHTML = `
      <div class="view-header">
        <div>
          ${client ? `<a href="#/clients/${client.id}" class="back-link">← ${Utils.escapeHtml(client.name)}</a>` : '<a href="#/projects" class="back-link">← Projects</a>'}
          <h1>${Utils.escapeHtml(project.name)}</h1>
          <p class="view-subtitle">${Utils.escapeHtml(project.deliverableType)} · Started ${Utils.formatDate(project.startDate)}</p>
        </div>
        <div class="view-header-actions">
          <span class="badge status-${project.status.replace(/\s+/g, '-')}">${project.status}</span>
          ${Utils.avatarGroupHtml(team, 'avatar-sm')}
          <button class="btn btn-ghost" id="edit-project-btn">Edit</button>
          <button class="btn btn-danger" id="delete-project-btn">Delete</button>
        </div>
      </div>

      <div class="tab-nav" id="pd-tab-nav">
        ${TABS.map((t) => `<button class="tab-btn ${state.tab === t.id ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>`).join('')}
      </div>

      <div id="pd-tab-content" class="pd-tab-content"></div>
    `;

    document.getElementById('edit-project-btn').addEventListener('click', () => {
      window.ProjectsView.openProjectForm(project, null, () => render(params, {}));
    });
    document.getElementById('delete-project-btn').addEventListener('click', async () => {
      const ok = await ModalManager.confirmDialog({ title: 'Delete project', message: `Delete "${project.name}"? Tasks and related data linked to this project will remain but lose their project link.`, confirmLabel: 'Delete', danger: true });
      if (ok) {
        DB.remove('projects', project.id);
        Toast.success('Project deleted');
        Router.navigate('/projects');
      }
    });
    Utils.qsa('.tab-btn', outlet).forEach((btn) => btn.addEventListener('click', () => {
      state.tab = btn.dataset.tab;
      Utils.qsa('.tab-btn', outlet).forEach((b) => b.classList.toggle('active', b === btn));
      renderTab(project);
    }));

    renderTab(project);

    if (query.task) {
      state.tab = 'tasks';
      Utils.qsa('.tab-btn', outlet).forEach((b) => b.classList.toggle('active', b.dataset.tab === 'tasks'));
      renderTab(project);
      TaskModal.open(query.task, { onChange: () => renderTab(project) });
    }
  }

  function renderTab(project) {
    const content = document.getElementById('pd-tab-content');
    if (!content) return;
    switch (state.tab) {
      case 'overview': return renderOverview(content, project);
      case 'tasks': return renderTasksTab(content, project);
      case 'keywords': return window.KeywordsView.renderSection(content, { projectId: project.id, clientId: project.clientId }, {});
      case 'content': return window.ContentCalendarView.renderSection(content, { projectId: project.id, clientId: project.clientId }, {});
      case 'backlinks': return window.BacklinksView.renderSection(content, { clientId: project.clientId }, {});
      case 'audit': return renderAuditTab(content, project);
      case 'issues': return renderIssuesTab(content, project);
      case 'files': return renderFilesTab(content, project);
    }
  }

  // ---------- Overview ----------
  function renderOverview(content, project) {
    const tasks = DB.all('tasks').filter((t) => t.projectId === project.id && !t.recurrence);
    const done = tasks.filter((t) => t.status === 'Done').length;
    const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    const byStatus = TaskModal.STATUSES.map((s) => ({ status: s, count: tasks.filter((t) => t.status === s).length }));
    const upcoming = tasks.filter((t) => t.dueDate && t.status !== 'Done').sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')).slice(0, 6);
    const team = project.teamIds.map((id) => DB.get('team', id)).filter(Boolean);
    const issues = DB.all('issues').filter((i) => i.projectId === project.id && i.status !== 'Resolved');

    content.innerHTML = `
      <div class="detail-grid">
        <div class="panel">
          <div class="panel-header"><h3>Progress</h3></div>
          <div class="panel-body">
            <div class="big-progress">
              <div class="big-progress-bar"><div class="big-progress-fill" style="width:${pct}%"></div></div>
              <div class="big-progress-label">${pct}% complete · ${done}/${tasks.length} tasks</div>
            </div>
            <div class="status-breakdown">
              ${byStatus.map((b) => `<div class="status-breakdown-row">${Utils.statusBadge(b.status)}<span>${b.count}</span></div>`).join('')}
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-header"><h3>Team</h3></div>
          <div class="panel-body">
            ${team.length ? team.map((u) => `<div class="workload-row">${Utils.avatarHtml(u)}<span class="workload-name">${Utils.escapeHtml(u.name)}</span><span class="text-muted">${Utils.escapeHtml(u.role)}</span></div>`).join('') : `<div class="empty-inline-panel">No team members assigned.</div>`}
          </div>
        </div>
        <div class="panel">
          <div class="panel-header"><h3>Open issues</h3></div>
          <div class="panel-body">
            ${issues.length ? issues.map((i) => `<div class="workload-row"><span class="badge severity-${i.severity.toLowerCase()}">${i.severity}</span><span class="workload-name">${Utils.escapeHtml(i.title)}</span></div>`).join('') : `<div class="empty-inline-panel">No open issues.</div>`}
          </div>
        </div>
        <div class="panel panel-wide">
          <div class="panel-header"><h3>Upcoming deadlines</h3></div>
          <div class="panel-body">
            ${upcoming.length ? upcoming.map((t) => {
              const assignees = t.assigneeIds.map((id) => DB.get('team', id)).filter(Boolean);
              return `
              <div class="task-list-row" data-id="${t.id}">
                <span class="task-list-title">${Utils.escapeHtml(t.title)}</span>
                ${Utils.priorityBadge(t.priority)}
                <span class="task-list-due ${Utils.isOverdue(t.dueDate, t.status) ? 'text-danger' : ''}">${Utils.formatDateShort(t.dueDate)}</span>
                ${Utils.avatarGroupHtml(assignees, 'avatar-sm')}
              </div>`;
            }).join('') : `<div class="empty-inline-panel">Nothing upcoming.</div>`}
          </div>
        </div>
        ${project.seo ? seoSnapshotPanel(project) : ''}
      </div>
    `;
    Utils.qsa('.task-list-row', content).forEach((row) => {
      row.addEventListener('click', () => TaskModal.open(row.dataset.id, { onChange: () => renderOverview(content, project) }));
    });
  }

  // ---------- SEO snapshot (target keywords, competitors, scope, baseline vs current) ----------
  function seoSnapshotPanel(project) {
    const seo = project.seo;
    const baseline = seo.baseline || {};
    const projectKeywords = DB.all('keywords').filter((k) => k.projectId === project.id);
    const baselineRankByKeyword = {};
    (baseline.startingKeywordRankings || []).forEach((r) => { baselineRankByKeyword[r.keyword] = r.rank; });

    return `
      <div class="panel panel-wide">
        <div class="panel-header"><h3>SEO Snapshot</h3></div>
        <div class="panel-body">
          <div class="detail-grid seo-snapshot-grid">
            <div>
              <div class="seo-snapshot-label">Scope</div>
              <div>${(seo.scope || []).map((s) => `<span class="tag-chip">${Utils.escapeHtml(s)}</span>`).join('') || '<span class="empty-inline">—</span>'}</div>
            </div>
            <div>
              <div class="seo-snapshot-label">Primary competitors</div>
              <div>${(seo.competitors || []).map((c) => `<span class="tag-chip">${Utils.escapeHtml(c)}</span>`).join('') || '<span class="empty-inline">—</span>'}</div>
            </div>
            <div>
              <div class="seo-snapshot-label">Reporting cadence</div>
              <div>${seo.reportingCadence && seo.reportingCadence !== 'none' ? Utils.escapeHtml(seo.reportingCadence) : '<span class="empty-inline">Not scheduled</span>'}</div>
            </div>
          </div>
          <div class="stat-grid seo-baseline-grid">
            <div class="stat-card">
              <div class="stat-value">${baseline.startingTraffic ? baseline.startingTraffic.toLocaleString() : '—'}</div>
              <div class="stat-label">Baseline monthly traffic</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${baseline.startingDA || '—'}</div>
              <div class="stat-label">Baseline DA</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${baseline.startingDR || '—'}</div>
              <div class="stat-label">Baseline DR</div>
            </div>
          </div>
          ${projectKeywords.length ? `
          <div class="table-wrap">
            <table class="data-table data-table-sm">
              <thead><tr><th>Target keyword</th><th>Baseline rank</th><th>Current rank</th><th>Change</th></tr></thead>
              <tbody>
                ${projectKeywords.map((k) => {
                  const current = k.history[k.history.length - 1]?.rank ?? null;
                  const baselineRank = baselineRankByKeyword[k.keyword] ?? null;
                  let changeHtml = '<span class="rank-flat">—</span>';
                  if (baselineRank !== null && current !== null) {
                    const change = baselineRank - current;
                    changeHtml = change > 0 ? `<span class="rank-up">▲ ${change}</span>` : change < 0 ? `<span class="rank-down">▼ ${Math.abs(change)}</span>` : '<span class="rank-flat">— 0</span>';
                  }
                  return `<tr><td>${Utils.escapeHtml(k.keyword)}</td><td>${baselineRank ? '#' + baselineRank : '—'}</td><td>${current ? '#' + current : '—'}</td><td>${changeHtml}</td></tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>` : `<div class="empty-inline-panel">Tracking starts once keyword rank updates are recorded.</div>`}
        </div>
      </div>`;
  }

  // ---------- Tasks tab ----------
  function renderTasksTab(content, project) {
    content.innerHTML = `
      <div class="toolbar">
        <div class="view-toggle">
          ${['kanban', 'list', 'calendar', 'timeline'].map((v) => `<button class="toggle-btn ${state.taskView === v ? 'active' : ''}" data-view="${v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}
        </div>
        <div class="toolbar-spacer"></div>
        <button class="btn btn-primary" id="pd-new-task-btn">+ New Task</button>
      </div>
      <div id="pd-task-view-body"></div>
    `;
    Utils.qsa('.toggle-btn', content).forEach((b) => b.addEventListener('click', () => {
      state.taskView = b.dataset.view;
      Utils.qsa('.toggle-btn', content).forEach((x) => x.classList.toggle('active', x === b));
      renderTaskViewBody(content, project);
    }));
    document.getElementById('pd-new-task-btn').addEventListener('click', () => {
      TaskModal.openCreateForm({ projectId: project.id, clientId: project.clientId }, { onCreate: () => renderTaskViewBody(content, project) });
    });
    renderTaskViewBody(content, project);
  }

  function renderTaskViewBody(content, project) {
    const body = document.getElementById('pd-task-view-body');
    const tasks = DB.all('tasks').filter((t) => t.projectId === project.id && !t.recurrence);
    if (state.taskView === 'kanban') return renderKanban(body, tasks, project);
    if (state.taskView === 'list') return renderTaskList(body, tasks, project);
    if (state.taskView === 'calendar') return renderTaskCalendar(body, tasks, project);
    if (state.taskView === 'timeline') return renderTimeline(body, tasks, project);
  }

  function renderKanban(body, tasks, project) {
    body.innerHTML = `
      <div class="kanban-board">
        ${TaskModal.STATUSES.map((status) => `
          <div class="kanban-column">
            <div class="kanban-column-header">
              <span>${status}</span>
              <span class="kanban-count">${tasks.filter((t) => t.status === status).length}</span>
            </div>
            <div class="kanban-column-body" data-status="${status}">
              ${tasks.filter((t) => t.status === status).map((t) => kanbanCard(t)).join('')}
            </div>
          </div>`).join('')}
      </div>`;

    Utils.qsa('.kanban-card', body).forEach((card) => {
      card.addEventListener('click', () => TaskModal.open(card.dataset.id, { onChange: () => renderTaskViewBody(document.getElementById('pd-tab-content'), project) }));
    });
    DnD.enableKanban(body, {
      onDrop: (taskId, newStatus) => {
        const patch = { status: newStatus, updatedAt: new Date().toISOString() };
        if (newStatus === 'Done') patch.completedAt = new Date().toISOString(); else patch.completedAt = null;
        DB.update('tasks', taskId, patch);
        App.refreshChrome();
        renderTaskViewBody(document.getElementById('pd-tab-content'), project);
      },
    });
  }

  function kanbanCard(t) {
    const assignees = t.assigneeIds.map((id) => DB.get('team', id)).filter(Boolean);
    const blocked = t.dependsOn?.some((id) => DB.get('tasks', id)?.status !== 'Done');
    return `
    <div class="kanban-card" draggable="true" data-id="${t.id}">
      ${blocked ? '<div class="kanban-blocked-flag">⚠ Blocked by dependency</div>' : ''}
      <div class="kanban-card-title">${Utils.escapeHtml(t.title)}</div>
      <div class="kanban-card-tags">${(t.tags || []).map((tag) => `<span class="tag-chip">${Utils.escapeHtml(tag)}</span>`).join('')}</div>
      <div class="kanban-card-footer">
        ${Utils.priorityBadge(t.priority)}
        <span class="${Utils.isOverdue(t.dueDate, t.status) ? 'text-danger' : ''}">${Utils.formatDateShort(t.dueDate)}</span>
        ${Utils.avatarGroupHtml(assignees, 'avatar-sm')}
      </div>
    </div>`;
  }

  function renderTaskList(body, tasks, project) {
    const sorted = [...tasks].sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
    body.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Task</th><th>Assignees</th><th>Status</th><th>Priority</th><th>Due</th><th>Tags</th></tr></thead>
        <tbody>
          ${sorted.length ? sorted.map((t) => {
            const assignees = t.assigneeIds.map((id) => DB.get('team', id)).filter(Boolean);
            return `
            <tr class="clickable-row" data-id="${t.id}">
              <td class="task-list-title">${Utils.escapeHtml(t.title)}</td>
              <td>${Utils.avatarGroupHtml(assignees, 'avatar-sm')}</td>
              <td>${Utils.statusBadge(t.status)}</td>
              <td>${Utils.priorityBadge(t.priority)}</td>
              <td class="${Utils.isOverdue(t.dueDate, t.status) ? 'text-danger' : ''}">${Utils.formatDateShort(t.dueDate)}</td>
              <td>${(t.tags || []).map((tag) => `<span class="tag-chip">${Utils.escapeHtml(tag)}</span>`).join('')}</td>
            </tr>`;
          }).join('') : `<tr><td colspan="6"><div class="empty-inline-panel">No tasks yet. Create the first one.</div></td></tr>`}
        </tbody>
      </table>`;
    Utils.qsa('.clickable-row', body).forEach((row) => {
      row.addEventListener('click', () => TaskModal.open(row.dataset.id, { onChange: () => renderTaskViewBody(document.getElementById('pd-tab-content'), project) }));
    });
  }

  function renderTaskCalendar(body, tasks, project) {
    const monthStart = Utils.monthRange().start;
    const d = new Date(monthStart + 'T00:00:00');
    const year = d.getFullYear(), month = d.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    while (cells.length % 7 !== 0) cells.push(null);

    body.innerHTML = `
      <div class="cal-grid">
        ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d2) => `<div class="cal-dow">${d2}</div>`).join('')}
        ${cells.map((dateStr) => {
          if (!dateStr) return `<div class="cal-cell cal-cell-empty"></div>`;
          const dayTasks = tasks.filter((t) => t.dueDate === dateStr);
          const isToday = dateStr === Utils.todayISO();
          return `
          <div class="cal-cell ${isToday ? 'cal-cell-today' : ''}">
            <div class="cal-daynum">${Number(dateStr.slice(-2))}</div>
            <div class="cal-items">
              ${dayTasks.map((t) => `<div class="cal-item priority-${t.priority.toLowerCase()}" data-id="${t.id}" title="${Utils.escapeHtml(t.title)}">${Utils.escapeHtml(t.title)}</div>`).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>`;
    Utils.qsa('.cal-item', body).forEach((el) => {
      el.addEventListener('click', () => TaskModal.open(el.dataset.id, { onChange: () => renderTaskViewBody(document.getElementById('pd-tab-content'), project) }));
    });
  }

  function renderTimeline(body, tasks, project) {
    const dated = tasks.filter((t) => t.dueDate);
    if (!dated.length) {
      body.innerHTML = `<div class="empty-inline-panel">No tasks with due dates yet — add due dates to see the timeline.</div>`;
      return;
    }
    const starts = dated.map((t) => t.createdAt.slice(0, 10)).concat([project.startDate]);
    const ends = dated.map((t) => t.dueDate);
    let rangeStart = starts.sort()[0];
    let rangeEnd = ends.sort().slice(-1)[0];
    rangeEnd = Utils.addDays(rangeEnd, 3);
    const totalDays = Math.max(1, Utils.daysBetween(rangeStart, rangeEnd));
    const todayPct = clampPct((Utils.daysBetween(rangeStart, Utils.todayISO()) / totalDays) * 100);

    const rows = [...dated].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map((t) => {
      const barStartRaw = t.createdAt.slice(0, 10) < rangeStart ? rangeStart : t.createdAt.slice(0, 10);
      const barStart = barStartRaw > t.dueDate ? t.dueDate : barStartRaw;
      const leftPct = clampPct((Utils.daysBetween(rangeStart, barStart) / totalDays) * 100);
      const widthPct = Math.max(1.5, clampPct((Utils.daysBetween(barStart, t.dueDate) / totalDays) * 100));
      return `
      <div class="gantt-row">
        <div class="gantt-row-label" title="${Utils.escapeHtml(t.title)}">${Utils.escapeHtml(t.title)}</div>
        <div class="gantt-row-track">
          <div class="gantt-bar ${Utils.statusClass(t.status)}" data-id="${t.id}" style="left:${leftPct}%; width:${widthPct}%" title="${Utils.escapeHtml(t.title)} — due ${Utils.formatDate(t.dueDate)}"></div>
        </div>
      </div>`;
    }).join('');

    body.innerHTML = `
      <div class="gantt-wrap">
        <div class="gantt-header">
          <div class="gantt-row-label"></div>
          <div class="gantt-row-track gantt-ruler">
            <span class="gantt-range-label gantt-range-start">${Utils.formatDateShort(rangeStart)}</span>
            <span class="gantt-range-label gantt-range-end">${Utils.formatDateShort(rangeEnd)}</span>
            <div class="gantt-today-line" style="left:${todayPct}%" title="Today"></div>
          </div>
        </div>
        ${rows}
      </div>`;
    Utils.qsa('.gantt-bar', body).forEach((el) => {
      el.addEventListener('click', () => TaskModal.open(el.dataset.id, { onChange: () => renderTaskViewBody(document.getElementById('pd-tab-content'), project) }));
    });
  }

  function clampPct(n) { return Math.max(0, Math.min(100, n)); }

  // ---------- Audit checklist ----------
  function renderAuditTab(content, project) {
    const audits = DB.all('projectAudits').filter((a) => a.projectId === project.id);
    const templates = DB.all('auditTemplates');
    content.innerHTML = `
      <div class="toolbar">
        <div class="toolbar-spacer"></div>
        <select id="audit-template-select" class="input">${templates.map((t) => `<option value="${t.id}">${Utils.escapeHtml(t.name)}</option>`).join('')}</select>
        <button class="btn btn-primary" id="attach-audit-btn">+ Attach Checklist</button>
      </div>
      <div id="audit-list">
        ${audits.length ? audits.map((a) => auditCard(a)).join('') : `<div class="empty-state"><h3>No audit checklist attached</h3><p>Attach a reusable technical SEO checklist to start tracking pass/fail per item.</p></div>`}
      </div>`;

    document.getElementById('attach-audit-btn').addEventListener('click', () => {
      const templateId = document.getElementById('audit-template-select').value;
      const template = DB.get('auditTemplates', templateId);
      if (!template) return;
      const instance = {
        id: Utils.uid('pa'), projectId: project.id, templateId: template.id, name: template.name, createdAt: new Date().toISOString(),
        items: template.items.map((it) => ({ id: Utils.uid('pai'), text: it.text, status: 'pending', notes: '' })),
      };
      DB.insert('projectAudits', instance);
      Toast.success('Checklist attached');
      renderAuditTab(content, project);
    });

    Utils.qsa('.audit-item-status', content).forEach((sel) => {
      sel.addEventListener('change', () => {
        const audit = DB.get('projectAudits', sel.dataset.auditId);
        const item = audit.items.find((i) => i.id === sel.dataset.itemId);
        item.status = sel.value;
        DB.update('projectAudits', audit.id, { items: audit.items });
        renderAuditTab(content, project);
      });
    });
    Utils.qsa('.audit-item-notes', content).forEach((input) => {
      input.addEventListener('change', () => {
        const audit = DB.get('projectAudits', input.dataset.auditId);
        const item = audit.items.find((i) => i.id === input.dataset.itemId);
        item.notes = input.value;
        DB.update('projectAudits', audit.id, { items: audit.items });
      });
    });
    Utils.qsa('.remove-audit-btn', content).forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ok = await ModalManager.confirmDialog({ title: 'Remove checklist', message: 'Remove this attached audit checklist?', confirmLabel: 'Remove', danger: true });
        if (ok) { DB.remove('projectAudits', btn.dataset.id); renderAuditTab(content, project); }
      });
    });
  }

  function auditCard(audit) {
    const pass = audit.items.filter((i) => i.status === 'pass').length;
    const fail = audit.items.filter((i) => i.status === 'fail').length;
    const total = audit.items.length;
    return `
    <div class="panel">
      <div class="panel-header">
        <h3>${Utils.escapeHtml(audit.name)}</h3>
        <span class="audit-summary">${pass}/${total} passed${fail ? ` · ${fail} failed` : ''}</span>
        <button class="btn btn-ghost btn-sm remove-audit-btn" data-id="${audit.id}">Remove</button>
      </div>
      <div class="panel-body">
        <table class="data-table audit-table">
          <thead><tr><th>Check</th><th>Status</th><th>Notes</th></tr></thead>
          <tbody>
            ${audit.items.map((it) => `
              <tr>
                <td>${Utils.escapeHtml(it.text)}</td>
                <td>
                  <select class="audit-item-status" data-audit-id="${audit.id}" data-item-id="${it.id}">
                    <option value="pending" ${it.status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="pass" ${it.status === 'pass' ? 'selected' : ''}>Pass</option>
                    <option value="fail" ${it.status === 'fail' ? 'selected' : ''}>Fail</option>
                    <option value="n/a" ${it.status === 'n/a' ? 'selected' : ''}>N/A</option>
                  </select>
                </td>
                <td><input type="text" class="audit-item-notes" data-audit-id="${audit.id}" data-item-id="${it.id}" value="${Utils.escapeHtml(it.notes || '')}" placeholder="Notes…" /></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  // ---------- Issue log ----------
  const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
  const ISSUE_STATUSES = ['Open', 'In Progress', 'Resolved'];

  function renderIssuesTab(content, project) {
    const issues = DB.all('issues').filter((i) => i.projectId === project.id);
    content.innerHTML = `
      <div class="toolbar">
        <div class="toolbar-spacer"></div>
        <button class="btn btn-primary" id="new-issue-btn">+ Log Issue</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Issue</th><th>Severity</th><th>Status</th><th>Found</th><th>Resolved</th><th></th></tr></thead>
          <tbody>
            ${issues.length ? issues.map((i) => `
              <tr>
                <td>
                  <div class="task-list-title">${Utils.escapeHtml(i.title)}</div>
                  <div class="text-muted">${Utils.escapeHtml(i.description || '')}</div>
                </td>
                <td><span class="badge severity-${i.severity.toLowerCase()}">${i.severity}</span></td>
                <td>
                  <select class="issue-status-select" data-id="${i.id}">
                    ${ISSUE_STATUSES.map((s) => `<option ${i.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                  </select>
                </td>
                <td>${Utils.formatDate(i.foundDate)}</td>
                <td>${i.resolvedDate ? Utils.formatDate(i.resolvedDate) : '—'}</td>
                <td class="row-actions"><button class="icon-btn-sm" data-act="delete-issue" data-id="${i.id}" aria-label="Delete issue">🗑</button></td>
              </tr>`).join('') : `<tr><td colspan="6"><div class="empty-inline-panel">No issues logged for this project.</div></td></tr>`}
          </tbody>
        </table>
      </div>`;

    document.getElementById('new-issue-btn').addEventListener('click', () => openIssueForm(project, null, () => renderIssuesTab(content, project)));
    Utils.qsa('.issue-status-select', content).forEach((sel) => {
      sel.addEventListener('change', () => {
        const patch = { status: sel.value };
        if (sel.value === 'Resolved') patch.resolvedDate = Utils.todayISO();
        else patch.resolvedDate = null;
        DB.update('issues', sel.dataset.id, patch);
        App.refreshChrome();
        renderIssuesTab(content, project);
      });
    });
    Utils.qsa('[data-act="delete-issue"]', content).forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ok = await ModalManager.confirmDialog({ title: 'Delete issue', message: 'Delete this logged issue?', confirmLabel: 'Delete', danger: true });
        if (ok) { DB.remove('issues', btn.dataset.id); renderIssuesTab(content, project); }
      });
    });
  }

  function openIssueForm(project, issue, onSaved) {
    const html = `
      <div class="modal-header"><h3>Log Issue</h3><button class="icon-btn" data-act="close" aria-label="Close">&times;</button></div>
      <div class="modal-body">
        <div class="task-field"><label>Title</label><input type="text" id="if-title" /></div>
        <div class="task-field"><label>Description</label><textarea id="if-desc" rows="3"></textarea></div>
        <div class="task-field-grid">
          <div class="task-field"><label>Severity</label><select id="if-severity">${SEVERITIES.map((s) => `<option>${s}</option>`).join('')}</select></div>
          <div class="task-field"><label>Status</label><select id="if-status">${ISSUE_STATUSES.map((s) => `<option>${s}</option>`).join('')}</select></div>
          <div class="task-field"><label>Found date</label><input type="date" id="if-found" value="${Utils.todayISO()}" /></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" data-act="close">Cancel</button>
        <button class="btn btn-primary" id="if-save">Log Issue</button>
      </div>`;
    const panel = ModalManager.open(html, { size: 'md' });
    Utils.qsa('[data-act="close"]', panel).forEach((b) => b.addEventListener('click', () => ModalManager.close()));
    Utils.qs('#if-save', panel).addEventListener('click', () => {
      const title = Utils.qs('#if-title', panel).value.trim();
      if (!title) { Toast.error('Title is required'); return; }
      DB.insert('issues', {
        id: Utils.uid('is'), clientId: project.clientId, projectId: project.id, title,
        description: Utils.qs('#if-desc', panel).value.trim(),
        severity: Utils.qs('#if-severity', panel).value,
        status: Utils.qs('#if-status', panel).value,
        foundDate: Utils.qs('#if-found', panel).value,
        resolvedDate: null,
      });
      Toast.success('Issue logged');
      ModalManager.close();
      onSaved();
    });
  }

  // ---------- Files & Notes ----------
  function renderFilesTab(content, project) {
    content.innerHTML = `
      <div class="detail-grid">
        <div class="panel">
          <div class="panel-header"><h3>Notes</h3></div>
          <div class="panel-body">
            <div id="notes-list">${(project.notes || []).slice().reverse().map((n) => noteRow(n)).join('') || `<div class="empty-inline-panel">No notes yet.</div>`}</div>
            <div class="comment-add-row">
              <textarea id="new-note-input" rows="2" placeholder="Add a project note…"></textarea>
              <button class="btn btn-primary btn-sm" id="add-note-btn">Add Note</button>
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-header"><h3>Files</h3></div>
          <div class="panel-body">
            <div id="files-list" class="attachment-list">${(project.files || []).map((f) => fileRow(f)).join('') || `<div class="empty-inline-panel">No files uploaded.</div>`}</div>
            <input type="file" id="project-file-input" multiple />
          </div>
        </div>
      </div>`;

    document.getElementById('add-note-btn').addEventListener('click', () => {
      const input = document.getElementById('new-note-input');
      const text = input.value.trim();
      if (!text) return;
      const fresh = DB.get('projects', project.id);
      fresh.notes.push({ id: Utils.uid('note'), text, authorId: DB.currentUser().id, createdAt: new Date().toISOString() });
      DB.update('projects', project.id, { notes: fresh.notes });
      Toast.success('Note added');
      renderFilesTab(content, DB.get('projects', project.id));
    });

    document.getElementById('project-file-input').addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      const fresh = DB.get('projects', project.id);
      for (const f of files) {
        if (f.size > 3 * 1024 * 1024) { Toast.error(`${f.name} is too large (max 3MB for demo storage)`); continue; }
        const dataUrl = await Utils.readFileAsDataURL(f);
        fresh.files.push({ id: Utils.uid('pf'), name: f.name, size: f.size, type: f.type, dataUrl, uploadedAt: new Date().toISOString() });
      }
      DB.update('projects', project.id, { files: fresh.files });
      Toast.success('File(s) uploaded');
      renderFilesTab(content, DB.get('projects', project.id));
    });

    Utils.qsa('[data-act="remove-note"]', content).forEach((btn) => {
      btn.addEventListener('click', () => {
        const fresh = DB.get('projects', project.id);
        fresh.notes = fresh.notes.filter((n) => n.id !== btn.dataset.id);
        DB.update('projects', project.id, { notes: fresh.notes });
        renderFilesTab(content, DB.get('projects', project.id));
      });
    });
    Utils.qsa('[data-act="remove-file"]', content).forEach((btn) => {
      btn.addEventListener('click', () => {
        const fresh = DB.get('projects', project.id);
        fresh.files = fresh.files.filter((f) => f.id !== btn.dataset.id);
        DB.update('projects', project.id, { files: fresh.files });
        renderFilesTab(content, DB.get('projects', project.id));
      });
    });
  }

  function noteRow(n) {
    const author = DB.get('team', n.authorId);
    return `
    <div class="comment-row">
      ${Utils.avatarHtml(author, 'avatar-sm')}
      <div class="comment-body">
        <div class="comment-meta"><strong>${Utils.escapeHtml(author?.name || 'Unknown')}</strong> <span>${App.timeAgo(n.createdAt)}</span></div>
        <div class="comment-text">${Utils.escapeHtml(n.text)}</div>
      </div>
      <button class="icon-btn-sm" data-act="remove-note" data-id="${n.id}" aria-label="Remove note">&times;</button>
    </div>`;
  }

  function fileRow(f) {
    return `
    <div class="attachment-row">
      <span class="attachment-name">📎 ${Utils.escapeHtml(f.name)}</span>
      <span class="attachment-size">${Utils.fileSizeLabel(f.size)}</span>
      <a href="${f.dataUrl}" download="${Utils.escapeHtml(f.name)}" class="link-btn">Download</a>
      <button class="icon-btn-sm" data-act="remove-file" data-id="${f.id}" aria-label="Remove file">&times;</button>
    </div>`;
  }

  Router.register('/projects/:id', render);
})();
