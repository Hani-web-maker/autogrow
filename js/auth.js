// auth.js — optional, client-side login gate.
//
// IMPORTANT HONEST NOTE FOR DEVELOPERS: this is a lightweight deterrent, not
// a security boundary. There is no server, so anyone with direct access to
// this browser's storage (devtools, a copied localStorage.json) can bypass
// it. It exists to stop a laptop screen-share or a shared/kiosk machine from
// exposing client data at a glance — nothing more. The UI must never imply
// otherwise.
//
// Credentials: a username + PIN, hashed with PBKDF2-SHA256 (100k iterations)
// and a random per-install salt via the Web Crypto API, stored in
// DB.settings().auth. The raw PIN is never persisted.
const Auth = (() => {
  const SESSION_KEY = 'growmark.session.v1';
  const REMEMBER_KEY = 'growmark.remember.v1';
  const PBKDF2_ITERATIONS = 100000;
  const DEFAULT_TIMEOUT_MINUTES = 30;
  const REMEMBER_DAYS = 30;
  const ACTIVITY_REFRESH_MS = 60000;

  let activityArmed = false;
  let lastActivityRefresh = 0;
  let watcherInterval = null;

  function bytesToHex(bytes) {
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  function hexToBytes(hex) {
    const arr = new Uint8Array(hex.length / 2);
    for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16);
    return arr;
  }
  function randomSaltHex(len = 16) {
    return bytesToHex(crypto.getRandomValues(new Uint8Array(len)));
  }

  /**
   * @param {string} pin
   * @param {string} saltHex
   * @param {number} [iterations]
   * @returns {Promise<string>} hex-encoded derived key
   */
  async function deriveHash(pin, saltHex, iterations = PBKDF2_ITERATIONS) {
    const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations, hash: 'SHA-256' },
      keyMaterial,
      256
    );
    return bytesToHex(new Uint8Array(bits));
  }

  /** @returns {boolean} whether a username/PIN gate has been configured. */
  function isConfigured() {
    return !!DB.settings().auth;
  }

  function sessionTimeoutMinutes() {
    return DB.settings().auth?.sessionTimeoutMinutes || DEFAULT_TIMEOUT_MINUTES;
  }

  /**
   * Sets up (or replaces) the login gate.
   * @param {string} username
   * @param {string} pin at least 4 characters
   * @param {number} [timeoutMinutes]
   * @returns {Promise<void>}
   */
  async function setup(username, pin, timeoutMinutes = DEFAULT_TIMEOUT_MINUTES) {
    if (!username || !username.trim()) throw new Error('Username is required.');
    if (!pin || pin.length < 4) throw new Error('PIN/password must be at least 4 characters.');
    const salt = randomSaltHex();
    const hash = await deriveHash(pin, salt);
    DB.updateSettings({
      auth: {
        username: username.trim(),
        salt,
        hash,
        iterations: PBKDF2_ITERATIONS,
        sessionTimeoutMinutes: Number(timeoutMinutes) || DEFAULT_TIMEOUT_MINUTES,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  }

  /** Removes the login gate entirely (app becomes open-access). */
  function disable() {
    DB.updateSettings({ auth: null });
    clearSession();
  }

  /**
   * @param {string} username
   * @param {string} pin
   * @param {boolean} [remember]
   * @returns {Promise<boolean>} true if credentials matched
   */
  async function login(username, pin, remember = false) {
    const auth = DB.settings().auth;
    if (!auth) return true;
    if ((username || '').trim().toLowerCase() !== auth.username.toLowerCase()) return false;
    const hash = await deriveHash(pin, auth.salt, auth.iterations);
    if (hash !== auth.hash) return false;
    startSession(remember);
    return true;
  }

  function startSession(remember) {
    const expiresAt = Date.now() + sessionTimeoutMinutes() * 60000;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ expiresAt }));
    if (remember) {
      const rememberExpiresAt = Date.now() + REMEMBER_DAYS * 24 * 60 * 60000;
      localStorage.setItem(REMEMBER_KEY, JSON.stringify({ expiresAt: rememberExpiresAt }));
    }
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(REMEMBER_KEY);
  }

  /** Signs the current device out (does not touch stored credentials). */
  function logout() {
    clearSession();
  }

  /** @returns {boolean} whether the current tab/device currently satisfies the login gate. */
  function isAuthenticated() {
    if (!isConfigured()) return true;
    const remembered = readJson(REMEMBER_KEY, localStorage);
    if (remembered && remembered.expiresAt > Date.now()) return true;
    const session = readJson(SESSION_KEY, sessionStorage);
    return !!(session && session.expiresAt > Date.now());
  }

  function readJson(key, store) {
    try {
      const raw = store.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /** Slides the session expiry forward on user activity; throttled to once/minute. */
  function extendSession() {
    if (!isConfigured()) return;
    const now = Date.now();
    if (now - lastActivityRefresh < ACTIVITY_REFRESH_MS) return;
    lastActivityRefresh = now;
    const session = readJson(SESSION_KEY, sessionStorage);
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify({ expiresAt: now + sessionTimeoutMinutes() * 60000 }));
    const remembered = readJson(REMEMBER_KEY, localStorage);
    if (remembered) localStorage.setItem(REMEMBER_KEY, JSON.stringify({ expiresAt: now + REMEMBER_DAYS * 24 * 60 * 60000 }));
  }

  /** Wires activity listeners that keep an authenticated session alive. Call once after login. */
  function armActivityListener() {
    if (activityArmed) return;
    activityArmed = true;
    ['click', 'keydown', 'mousemove'].forEach((evt) => {
      document.addEventListener(evt, extendSession, { passive: true });
    });
  }

  /**
   * Polls every 15s; if the session has expired, invokes onExpire (typically
   * re-renders the login screen) exactly once per expiry.
   * @param {Function} onExpire
   */
  function startSessionWatcher(onExpire) {
    if (watcherInterval) clearInterval(watcherInterval);
    watcherInterval = setInterval(() => {
      if (isConfigured() && !isAuthenticated()) {
        clearInterval(watcherInterval);
        watcherInterval = null;
        onExpire();
      }
    }, 15000);
  }

  // ---------- UI ----------
  function renderLogin({ onSuccess } = {}) {
    const root = document.getElementById('app-root');
    const auth = DB.settings().auth;
    root.innerHTML = `
      <div class="auth-screen">
        <div class="auth-card">
          <div class="auth-brand">${Brand.fullLogoImg('auth-logo')}</div>
          <h1>Welcome back</h1>
          <p class="auth-subtitle">Sign in to ${Utils.escapeHtml(DB.settings().agencyName || 'your GrowMark workspace')}.</p>
          <form id="login-form" novalidate>
            <div class="task-field">
              <label for="login-username">Username</label>
              <input type="text" id="login-username" autocomplete="username" value="${Utils.escapeHtml(auth?.username || '')}" required />
            </div>
            <div class="task-field">
              <label for="login-pin">PIN / password</label>
              <input type="password" id="login-pin" autocomplete="current-password" required />
            </div>
            <label class="auth-remember">
              <input type="checkbox" id="login-remember" /> Remember this device for ${REMEMBER_DAYS} days
            </label>
            <div class="auth-error" id="login-error" hidden></div>
            <button type="submit" class="btn btn-primary auth-submit">Sign in</button>
          </form>
          <p class="auth-disclaimer">This is a local device lock, not account security — it keeps your screen private, not your data encrypted.</p>
        </div>
      </div>`;

    const form = document.getElementById('login-form');
    const errorBox = document.getElementById('login-error');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.hidden = true;
      const username = document.getElementById('login-username').value;
      const pin = document.getElementById('login-pin').value;
      const remember = document.getElementById('login-remember').checked;
      const submitBtn = form.querySelector('.auth-submit');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in…';
      try {
        const ok = await login(username, pin, remember);
        if (ok) {
          armActivityListener();
          onSuccess?.();
        } else {
          errorBox.textContent = 'Incorrect username or PIN.';
          errorBox.hidden = false;
          submitBtn.disabled = false;
          submitBtn.textContent = 'Sign in';
        }
      } catch (err) {
        console.error('Login failed', err);
        errorBox.textContent = 'Something went wrong signing in. Please try again.';
        errorBox.hidden = false;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign in';
      }
    });
    document.getElementById('login-username').focus();
  }

  return {
    isConfigured, setup, disable, login, logout, isAuthenticated,
    armActivityListener, startSessionWatcher, renderLogin,
    DEFAULT_TIMEOUT_MINUTES,
  };
})();
