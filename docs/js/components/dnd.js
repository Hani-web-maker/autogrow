// components/dnd.js — reusable HTML5 drag-and-drop wiring for Kanban-style boards.
const DnD = (() => {
  function enableKanban(container, { onDrop } = {}) {
    let draggedId = null;

    container.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.kanban-card');
      if (!card) return;
      draggedId = card.dataset.id;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggedId);
    });

    container.addEventListener('dragend', (e) => {
      const card = e.target.closest('.kanban-card');
      if (card) card.classList.remove('dragging');
      Utils.qsa('.kanban-column-body', container).forEach((c) => c.classList.remove('drop-target'));
    });

    container.addEventListener('dragover', (e) => {
      const col = e.target.closest('.kanban-column-body');
      if (!col) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      col.classList.add('drop-target');
    });

    container.addEventListener('dragleave', (e) => {
      const col = e.target.closest('.kanban-column-body');
      if (col && !col.contains(e.relatedTarget)) col.classList.remove('drop-target');
    });

    container.addEventListener('drop', (e) => {
      const col = e.target.closest('.kanban-column-body');
      if (!col) return;
      e.preventDefault();
      col.classList.remove('drop-target');
      const id = draggedId || e.dataTransfer.getData('text/plain');
      const newStatus = col.dataset.status;
      if (id && newStatus && onDrop) onDrop(id, newStatus);
      draggedId = null;
    });
  }

  return { enableKanban };
})();
