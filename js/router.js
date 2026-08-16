// router.js — minimal hash-based router. Routes are registered as
// pattern -> render(params, query) and matched against location.hash.
const Router = (() => {
  const routes = [];
  let notFound = () => '<div class="empty-state">Page not found.</div>';

  function register(pattern, handler) {
    const paramNames = [];
    const regexStr = pattern.replace(/:[^/]+/g, (m) => {
      paramNames.push(m.slice(1));
      return '([^/]+)';
    });
    routes.push({ regex: new RegExp(`^${regexStr}$`), paramNames, handler });
  }

  function setNotFound(fn) {
    notFound = fn;
  }

  function parseHash() {
    let hash = location.hash.slice(1) || '/dashboard';
    const [path, queryStr] = hash.split('?');
    const query = {};
    if (queryStr) {
      queryStr.split('&').forEach((pair) => {
        const [k, v] = pair.split('=');
        if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });
    }
    return { path, query };
  }

  function resolve() {
    const { path, query } = parseHash();
    for (const route of routes) {
      const m = path.match(route.regex);
      if (m) {
        const params = {};
        route.paramNames.forEach((name, i) => { params[name] = decodeURIComponent(m[i + 1]); });
        return { handler: route.handler, params, query, path };
      }
    }
    return { handler: notFound, params: {}, query, path };
  }

  function navigate(hash) {
    if (location.hash === `#${hash}`) {
      render();
    } else {
      location.hash = hash;
    }
  }

  function render() {
    const { handler, params, query, path } = resolve();
    App.setActiveNav(path);
    const outlet = document.getElementById('view-outlet');
    outlet.scrollTop = 0;
    try {
      handler(params, query);
    } catch (err) {
      console.error('View render error', err);
      outlet.innerHTML = `<div class="empty-state"><h3>Something went wrong</h3><p>${Utils.escapeHtml(err.message)}</p></div>`;
    }
  }

  function start() {
    window.addEventListener('hashchange', render);
    render();
  }

  return { register, setNotFound, navigate, render, start, parseHash };
})();
