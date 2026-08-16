// modal.js — generic modal + confirm dialog helper
const ModalManager = (() => {
  let backdrop, panel, currentOnClose;

  function ensure() {
    if (backdrop) return;
    backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = '<div class="modal-panel" role="dialog" aria-modal="true"></div>';
    document.body.appendChild(backdrop);
    panel = backdrop.querySelector('.modal-panel');
    backdrop.addEventListener('mousedown', (e) => {
      if (e.target === backdrop) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && backdrop.classList.contains('open')) close();
    });
  }

  function open(html, { size = 'md', onClose } = {}) {
    ensure();
    panel.className = `modal-panel modal-${size}`;
    panel.innerHTML = html;
    backdrop.classList.add('open');
    document.body.classList.add('modal-open');
    currentOnClose = onClose;
    return panel;
  }

  function close() {
    if (!backdrop) return;
    backdrop.classList.remove('open');
    document.body.classList.remove('modal-open');
    if (currentOnClose) {
      const cb = currentOnClose;
      currentOnClose = null;
      cb();
    }
    setTimeout(() => { if (panel) panel.innerHTML = ''; }, 200);
  }

  function confirmDialog({ title = 'Are you sure?', message = '', confirmLabel = 'Confirm', danger = false }) {
    return new Promise((resolve) => {
      const html = `
        <div class="modal-header"><h3>${Utils.escapeHtml(title)}</h3></div>
        <div class="modal-body"><p>${Utils.escapeHtml(message)}</p></div>
        <div class="modal-footer">
          <button class="btn btn-ghost" data-act="cancel">Cancel</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="confirm">${Utils.escapeHtml(confirmLabel)}</button>
        </div>`;
      const p = open(html, { size: 'sm' });
      p.querySelector('[data-act="cancel"]').addEventListener('click', () => { close(); resolve(false); });
      p.querySelector('[data-act="confirm"]').addEventListener('click', () => { close(); resolve(true); });
    });
  }

  return { open, close, confirmDialog };
})();
