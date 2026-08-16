// components/taskModal.js — shared task detail/edit modal used by every task view.
const TaskModal = (() => {
  const STATUSES = ['To Do', 'In Progress', 'In Review', 'Blocked', 'Done'];
  const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

  function teamOptionsHtml(selectedIds, projectTeamIds) {
    const team = DB.all('team');
    const pool = projectTeamIds && projectTeamIds.length ? team.filter((u) => projectTeamIds.includes(u.id)) : team;
    return pool.map((u) => `
      <label class="chip-checkbox">
        <input type="checkbox" value="${u.id}" ${selectedIds.includes(u.id) ? 'checked' : ''} />
        <span class="avatar avatar-sm" style="background:${u.color}">${u.initials}</span>
        <span>${Utils.escapeHtml(u.name)}</span>
      </label>`).join('');
  }

  function renderMentionText(text) {
    const team = DB.all('team');
    let html = Utils.escapeHtml(text);
    team.forEach((u) => {
      const re = new RegExp(`@${u.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
      html = html.replace(re, `<span class="mention">@${u.name}</span>`);
    });
    return html;
  }

  function detectMentions(text) {
    const team = DB.all('team');
    return team.filter((u) => text.includes(`@${u.name}`)).map((u) => u.id);
  }

  function open(taskId, { onChange } = {}) {
    const task = DB.get('tasks', taskId);
    if (!task) return;
    render(task, onChange);
  }

  function render(task, onChange) {
    const project = task.projectId ? DB.get('projects', task.projectId) : null;
    const client = task.clientId ? DB.get('clients', task.clientId) : null;
    const isRecurringInstance = !!task.recurrenceParentId;
    const projectTasks = task.projectId ? DB.all('tasks').filter((t) => t.projectId === task.projectId && t.id !== task.id && !t.recurrence) : [];

    const html = `
      <div class="modal-header task-modal-header">
        <div>
          <div class="task-modal-breadcrumb">${client ? Utils.escapeHtml(client.name) : ''}${project ? ' / ' + Utils.escapeHtml(project.name) : ''}</div>
          <input type="text" id="tm-title" class="task-title-input" value="${Utils.escapeHtml(task.title)}" />
        </div>
        <button class="icon-btn" data-act="close" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body task-modal-body">
        ${isRecurringInstance ? `<div class="recurring-note">↻ Auto-generated from a recurring task</div>` : ''}
        <div class="task-field-grid">
          <div class="task-field">
            <label>Status</label>
            <select id="tm-status">${STATUSES.map((s) => `<option ${s === task.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
          </div>
          <div class="task-field">
            <label>Priority</label>
            <select id="tm-priority">${PRIORITIES.map((p) => `<option ${p === task.priority ? 'selected' : ''}>${p}</option>`).join('')}</select>
          </div>
          <div class="task-field">
            <label>Due date</label>
            <input type="date" id="tm-due" value="${task.dueDate || ''}" />
          </div>
          <div class="task-field">
            <label>Tags</label>
            <input type="text" id="tm-tags" value="${Utils.escapeHtml((task.tags || []).join(', '))}" placeholder="comma, separated" />
          </div>
        </div>

        <div class="task-field">
          <label>Assignees</label>
          <div class="chip-checkbox-group" id="tm-assignees">${teamOptionsHtml(task.assigneeIds || [], project ? project.teamIds : null)}</div>
        </div>

        <div class="task-field">
          <label>Description</label>
          <textarea id="tm-desc" rows="3" placeholder="Add more detail…">${Utils.escapeHtml(task.description || '')}</textarea>
        </div>

        ${projectTasks.length ? `
        <div class="task-field">
          <label>Blocked by</label>
          <select id="tm-dependency" multiple size="3">
            ${projectTasks.map((t) => `<option value="${t.id}" ${task.dependsOn?.includes(t.id) ? 'selected' : ''}>${Utils.escapeHtml(t.title)} ${t.status === 'Done' ? '✓' : ''}</option>`).join('')}
          </select>
          ${blockedWarning(task)}
        </div>` : ''}

        <div class="task-field">
          <label>Checklist / Subtasks</label>
          <div id="tm-subtasks" class="subtask-list">${renderSubtasks(task)}</div>
          <div class="subtask-add-row">
            <input type="text" id="tm-subtask-input" placeholder="Add a checklist item and press Enter" />
          </div>
        </div>

        <div class="task-field">
          <label>Attachments</label>
          <div id="tm-attachments" class="attachment-list">${renderAttachments(task)}</div>
          <input type="file" id="tm-file-input" multiple />
        </div>

        <div class="task-field">
          <label>Comments</label>
          <div id="tm-comments" class="comment-list">${renderComments(task)}</div>
          <div class="comment-add-row">
            <textarea id="tm-comment-input" rows="2" placeholder="Add a comment… use @Name to mention"></textarea>
            <button class="btn btn-primary btn-sm" id="tm-comment-add">Post</button>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-danger" id="tm-delete">Delete task</button>
        <button class="btn btn-ghost" data-act="close">Close</button>
      </div>
    `;

    const panel = ModalManager.open(html, { size: 'lg' });
    bindEvents(panel, task, onChange);
  }

  function blockedWarning(task) {
    if (!task.dependsOn || !task.dependsOn.length) return '';
    const blockers = task.dependsOn.map((id) => DB.get('tasks', id)).filter(Boolean);
    const unfinished = blockers.filter((b) => b.status !== 'Done');
    if (!unfinished.length) return '';
    return `<div class="dependency-warning">⚠ Blocked by ${unfinished.length} unfinished task${unfinished.length > 1 ? 's' : ''}</div>`;
  }

  function renderSubtasks(task) {
    if (!task.subtasks || !task.subtasks.length) return `<div class="empty-inline">No checklist items yet.</div>`;
    const done = task.subtasks.filter((s) => s.done).length;
    return `
      <div class="subtask-progress"><div class="subtask-progress-bar" style="width:${(done / task.subtasks.length) * 100}%"></div></div>
      ${task.subtasks.map((s) => `
        <div class="subtask-row" data-id="${s.id}">
          <input type="checkbox" ${s.done ? 'checked' : ''} data-act="toggle-subtask" />
          <span class="${s.done ? 'done' : ''}">${Utils.escapeHtml(s.title)}</span>
          <button class="icon-btn-sm" data-act="remove-subtask" aria-label="Remove checklist item">&times;</button>
        </div>`).join('')}`;
  }

  function renderAttachments(task) {
    if (!task.attachments || !task.attachments.length) return `<div class="empty-inline">No files attached.</div>`;
    return task.attachments.map((a) => `
      <div class="attachment-row" data-id="${a.id}">
        <span class="attachment-name">📎 ${Utils.escapeHtml(a.name)}</span>
        <span class="attachment-size">${Utils.fileSizeLabel(a.size)}</span>
        <a href="${a.dataUrl}" download="${Utils.escapeHtml(a.name)}" class="link-btn">Download</a>
        <button class="icon-btn-sm" data-act="remove-attachment" aria-label="Remove attachment">&times;</button>
      </div>`).join('');
  }

  function renderComments(task) {
    if (!task.comments || !task.comments.length) return `<div class="empty-inline">No comments yet.</div>`;
    return task.comments.map((c) => {
      const author = DB.get('team', c.authorId);
      return `
      <div class="comment-row">
        <span class="avatar avatar-sm" style="background:${author?.color || '#999'}">${author?.initials || '?'}</span>
        <div class="comment-body">
          <div class="comment-meta"><strong>${Utils.escapeHtml(author?.name || 'Unknown')}</strong> <span>${App.timeAgo(c.createdAt)}</span></div>
          <div class="comment-text">${renderMentionText(c.text)}</div>
        </div>
      </div>`;
    }).join('');
  }

  function bindEvents(panel, task, onChange) {
    const notify = () => { if (onChange) onChange(); App.refreshChrome(); };
    const closeBtns = Utils.qsa('[data-act="close"]', panel);
    closeBtns.forEach((b) => b.addEventListener('click', () => ModalManager.close()));

    Utils.qs('#tm-title', panel).addEventListener('change', (e) => {
      DB.update('tasks', task.id, { title: e.target.value, updatedAt: new Date().toISOString() });
      notify();
    });
    Utils.qs('#tm-status', panel).addEventListener('change', (e) => {
      const patch = { status: e.target.value, updatedAt: new Date().toISOString() };
      if (e.target.value === 'Done') patch.completedAt = new Date().toISOString();
      else patch.completedAt = null;
      DB.update('tasks', task.id, patch);
      if (e.target.value === 'Done') DB.logActivity('task', `"${task.title}" marked done`, { taskId: task.id });
      notify();
    });
    Utils.qs('#tm-priority', panel).addEventListener('change', (e) => {
      DB.update('tasks', task.id, { priority: e.target.value, updatedAt: new Date().toISOString() });
      notify();
    });
    Utils.qs('#tm-due', panel).addEventListener('change', (e) => {
      DB.update('tasks', task.id, { dueDate: e.target.value || null, updatedAt: new Date().toISOString() });
      notify();
    });
    Utils.qs('#tm-tags', panel).addEventListener('change', (e) => {
      const tags = e.target.value.split(',').map((t) => t.trim()).filter(Boolean);
      DB.update('tasks', task.id, { tags, updatedAt: new Date().toISOString() });
      notify();
    });
    Utils.qs('#tm-desc', panel).addEventListener('change', (e) => {
      DB.update('tasks', task.id, { description: e.target.value, updatedAt: new Date().toISOString() });
      notify();
    });
    Utils.qs('#tm-assignees', panel)?.addEventListener('change', () => {
      const ids = Utils.qsa('#tm-assignees input:checked', panel).map((i) => i.value);
      DB.update('tasks', task.id, { assigneeIds: ids, updatedAt: new Date().toISOString() });
      notify();
    });
    const depSelect = Utils.qs('#tm-dependency', panel);
    depSelect?.addEventListener('change', () => {
      const ids = Array.from(depSelect.selectedOptions).map((o) => o.value);
      DB.update('tasks', task.id, { dependsOn: ids, updatedAt: new Date().toISOString() });
      notify();
      const updated = DB.get('tasks', task.id);
      render(updated, onChange);
    });

    // subtasks
    const subtaskInput = Utils.qs('#tm-subtask-input', panel);
    subtaskInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && subtaskInput.value.trim()) {
        const updated = DB.get('tasks', task.id);
        updated.subtasks.push({ id: Utils.uid('sub'), title: subtaskInput.value.trim(), done: false });
        DB.update('tasks', task.id, { subtasks: updated.subtasks });
        subtaskInput.value = '';
        notify();
        render(DB.get('tasks', task.id), onChange);
      }
    });
    panel.addEventListener('click', (e) => {
      const row = e.target.closest('.subtask-row');
      if (row && e.target.dataset.act === 'toggle-subtask') {
        const updated = DB.get('tasks', task.id);
        const st = updated.subtasks.find((s) => s.id === row.dataset.id);
        if (st) st.done = e.target.checked;
        DB.update('tasks', task.id, { subtasks: updated.subtasks });
        notify();
        render(DB.get('tasks', task.id), onChange);
      }
      if (row && e.target.dataset.act === 'remove-subtask') {
        const updated = DB.get('tasks', task.id);
        updated.subtasks = updated.subtasks.filter((s) => s.id !== row.dataset.id);
        DB.update('tasks', task.id, { subtasks: updated.subtasks });
        notify();
        render(DB.get('tasks', task.id), onChange);
      }
      const attRow = e.target.closest('.attachment-row');
      if (attRow && e.target.dataset.act === 'remove-attachment') {
        const updated = DB.get('tasks', task.id);
        updated.attachments = updated.attachments.filter((a) => a.id !== attRow.dataset.id);
        DB.update('tasks', task.id, { attachments: updated.attachments });
        notify();
        render(DB.get('tasks', task.id), onChange);
      }
    });

    // file attach
    Utils.qs('#tm-file-input', panel).addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      const updated = DB.get('tasks', task.id);
      for (const f of files) {
        if (f.size > 3 * 1024 * 1024) { Toast.error(`${f.name} is too large (max 3MB for demo storage)`); continue; }
        const dataUrl = await Utils.readFileAsDataURL(f);
        updated.attachments.push({ id: Utils.uid('att'), name: f.name, size: f.size, type: f.type, dataUrl });
      }
      DB.update('tasks', task.id, { attachments: updated.attachments });
      Toast.success('Attachment added');
      notify();
      render(DB.get('tasks', task.id), onChange);
    });

    // comments
    Utils.qs('#tm-comment-add', panel).addEventListener('click', () => {
      const input = Utils.qs('#tm-comment-input', panel);
      const text = input.value.trim();
      if (!text) return;
      const updated = DB.get('tasks', task.id);
      const mentions = detectMentions(text);
      updated.comments.push({ id: Utils.uid('cmt'), authorId: DB.currentUser().id, text, createdAt: new Date().toISOString(), mentions });
      DB.update('tasks', task.id, { comments: updated.comments });
      if (mentions.length) DB.logActivity('mention', `You were mentioned in "${task.title}"`, { taskId: task.id });
      Toast.success('Comment added');
      notify();
      render(DB.get('tasks', task.id), onChange);
    });

    Utils.qs('#tm-delete', panel).addEventListener('click', async () => {
      const ok = await ModalManager.confirmDialog({ title: 'Delete task', message: `Delete "${task.title}"? This cannot be undone.`, confirmLabel: 'Delete', danger: true });
      if (ok) {
        DB.remove('tasks', task.id);
        ModalManager.close();
        notify();
        Toast.success('Task deleted');
      }
    });
  }

  function openCreateForm(defaults, { onCreate } = {}) {
    const project = defaults.projectId ? DB.get('projects', defaults.projectId) : null;
    const html = `
      <div class="modal-header"><h3>New Task</h3><button class="icon-btn" data-act="close" aria-label="Close">&times;</button></div>
      <div class="modal-body task-modal-body">
        <div class="task-field">
          <label>Title</label>
          <input type="text" id="nt-title" placeholder="Task title" autofocus />
        </div>
        <div class="task-field-grid">
          <div class="task-field">
            <label>Status</label>
            <select id="nt-status">${STATUSES.map((s) => `<option ${s === (defaults.status || 'To Do') ? 'selected' : ''}>${s}</option>`).join('')}</select>
          </div>
          <div class="task-field">
            <label>Priority</label>
            <select id="nt-priority">${PRIORITIES.map((p) => `<option ${p === 'Medium' ? 'selected' : ''}>${p}</option>`).join('')}</select>
          </div>
          <div class="task-field">
            <label>Due date</label>
            <input type="date" id="nt-due" value="${defaults.dueDate || ''}" />
          </div>
        </div>
        <div class="task-field">
          <label>Assignees</label>
          <div class="chip-checkbox-group" id="nt-assignees">${teamOptionsHtml([], project ? project.teamIds : null)}</div>
        </div>
        <div class="task-field">
          <label>Description</label>
          <textarea id="nt-desc" rows="3"></textarea>
        </div>
        <div class="task-field recurrence-field">
          <label><input type="checkbox" id="nt-recurring" /> Make this a recurring task</label>
          <div id="nt-recurrence-opts" class="recurrence-opts" hidden>
            <select id="nt-freq">
              <option value="daily">Daily</option>
              <option value="weekly" selected>Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <select id="nt-weekday">
              <option value="1">Monday</option><option value="2">Tuesday</option><option value="3">Wednesday</option>
              <option value="4">Thursday</option><option value="5" selected>Friday</option><option value="6">Saturday</option><option value="0">Sunday</option>
            </select>
            <input type="number" id="nt-dayofmonth" min="1" max="28" value="1" hidden placeholder="Day of month" />
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" data-act="close">Cancel</button>
        <button class="btn btn-primary" id="nt-create">Create Task</button>
      </div>`;
    const panel = ModalManager.open(html, { size: 'lg' });
    Utils.qsa('[data-act="close"]', panel).forEach((b) => b.addEventListener('click', () => ModalManager.close()));

    const recurCheck = Utils.qs('#nt-recurring', panel);
    const recurOpts = Utils.qs('#nt-recurrence-opts', panel);
    recurCheck.addEventListener('change', () => { recurOpts.hidden = !recurCheck.checked; });
    Utils.qs('#nt-freq', panel).addEventListener('change', (e) => {
      Utils.qs('#nt-weekday', panel).hidden = e.target.value !== 'weekly';
      Utils.qs('#nt-dayofmonth', panel).hidden = e.target.value !== 'monthly';
    });

    Utils.qs('#nt-create', panel).addEventListener('click', () => {
      const title = Utils.qs('#nt-title', panel).value.trim();
      if (!title) { Toast.error('Title is required'); return; }
      const assigneeIds = Utils.qsa('#nt-assignees input:checked', panel).map((i) => i.value);
      let recurrence = null;
      if (recurCheck.checked) {
        const freq = Utils.qs('#nt-freq', panel).value;
        recurrence = { freq, lastGenerated: null };
        if (freq === 'weekly') recurrence.weekday = Number(Utils.qs('#nt-weekday', panel).value);
        if (freq === 'monthly') recurrence.dayOfMonth = Number(Utils.qs('#nt-dayofmonth', panel).value);
      }
      const task = {
        id: Utils.uid('task'),
        title,
        description: Utils.qs('#nt-desc', panel).value.trim(),
        projectId: defaults.projectId || null,
        clientId: defaults.clientId || (project ? project.clientId : null),
        assigneeIds,
        dueDate: Utils.qs('#nt-due', panel).value || null,
        priority: Utils.qs('#nt-priority', panel).value,
        status: Utils.qs('#nt-status', panel).value,
        tags: defaults.tags || [],
        subtasks: [],
        comments: [],
        attachments: [],
        dependsOn: [],
        recurrence,
        recurrenceParentId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
      };
      DB.insert('tasks', task);
      DB.logActivity('task', `New task created: "${title}"`, { taskId: task.id });
      ModalManager.close();
      Toast.success('Task created');
      App.refreshChrome();
      if (onCreate) onCreate(task);
    });
  }

  return { open, openCreateForm, STATUSES, PRIORITIES };
})();
