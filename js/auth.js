/* ============================================================
   TOTOO AI — demo authentication
   ------------------------------------------------------------
   IMPORTANT: this is a client-side demo, not real security.
   Passwords are salted + hashed with PBKDF2-SHA256 (120k
   iterations) and stored in this browser's localStorage.
   Anyone with DevTools access can bypass the session flag.
   Use a real backend (Supabase, Firebase, a Laravel/Express
   API) before handling genuine accounts.
   ============================================================ */

window.TotooAuth = (function () {
  'use strict';

  const USERS_KEY = 'totoo_ai_users_v1';
  const SESSION_KEY = 'totoo_ai_auth_v1';
  const ITERATIONS = 120000;
  const PAGES = ['index.html', 'detector.html', 'dashboard.html', 'about.html', 'references.html'];

  /* ---------- storage helpers ---------- */

  function readUsers() {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function writeUsers(list) {
    localStorage.setItem(USERS_KEY, JSON.stringify(list));
  }

  function readSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeSession(session, remember) {
    const payload = JSON.stringify(session);
    clearSession();
    if (remember) localStorage.setItem(SESSION_KEY, payload);
    else sessionStorage.setItem(SESSION_KEY, payload);
  }

  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
  }

  /* ---------- crypto ---------- */

  function toB64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function fromB64(str) {
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function randomSalt() {
    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);
    return toB64(salt);
  }

  function subtleAvailable() {
    return !!(window.crypto && window.crypto.subtle && window.crypto.getRandomValues);
  }

  async function derive(password, saltB64, iterations) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: fromB64(saltB64), iterations: iterations || ITERATIONS, hash: 'SHA-256' },
      keyMaterial,
      256
    );
    return toB64(new Uint8Array(bits));
  }

  function constantTimeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  /* ---------- validation ---------- */

  function normaliseEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function isEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }

  function newId() {
    if (window.crypto && crypto.randomUUID) return 'u_' + crypto.randomUUID();
    return 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ---------- public API ---------- */

  function currentUser() {
    if (!subtleAvailable()) return null;
    const session = readSession();
    if (!session || !session.userId) return null;
    const user = readUsers().filter(function (u) { return u.id === session.userId; })[0];
    if (!user) return null;
    return { id: user.id, name: user.name, email: user.email };
  }

  async function signUp(input) {
    if (!subtleAvailable()) {
      return { ok: false, error: 'Secure hashing is unavailable here. Open the site through http://localhost or https.' };
    }
    const name = String((input && input.name) || '').trim();
    const email = normaliseEmail(input && input.email);
    const password = String((input && input.password) || '');

    if (name.length < 2) return { ok: false, field: 'name', error: 'Please enter your full name.' };
    if (!isEmail(email)) return { ok: false, field: 'email', error: 'Enter a valid email address.' };
    if (password.length < 8) return { ok: false, field: 'password', error: 'Use at least 8 characters.' };
    if (password.length > 200) return { ok: false, field: 'password', error: 'That password is too long.' };

    const users = readUsers();
    if (users.some(function (u) { return u.email === email; })) {
      return { ok: false, field: 'email', error: 'An account with this email already exists.' };
    }

    const salt = randomSalt();
    let hash;
    try {
      hash = await derive(password, salt, ITERATIONS);
    } catch (e) {
      return { ok: false, error: 'Could not secure the password. Try again.' };
    }

    const user = {
      id: newId(),
      name: name,
      email: email,
      salt: salt,
      hash: hash,
      iterations: ITERATIONS,
      createdAt: Date.now()
    };
    users.push(user);
    writeUsers(users);

    writeSession({ userId: user.id, at: Date.now() }, input && input.remember !== false);
    return { ok: true, user: { id: user.id, name: user.name, email: user.email } };
  }

  async function signIn(input) {
    if (!subtleAvailable()) {
      return { ok: false, error: 'Secure hashing is unavailable here. Open the site through http://localhost or https.' };
    }
    const email = normaliseEmail(input && input.email);
    const password = String((input && input.password) || '');
    if (!email || !password) return { ok: false, error: 'Enter your email and password.' };

    const user = readUsers().filter(function (u) { return u.email === email; })[0];
    if (!user) return { ok: false, error: 'Invalid email or password.' };

    let hash;
    try {
      hash = await derive(password, user.salt, user.iterations);
    } catch (e) {
      return { ok: false, error: 'Could not verify the password. Try again.' };
    }
    if (!constantTimeEqual(hash, user.hash)) return { ok: false, error: 'Invalid email or password.' };

    writeSession({ userId: user.id, at: Date.now() }, input && input.remember !== false);
    return { ok: true, user: { id: user.id, name: user.name, email: user.email } };
  }

  function signOut() {
    clearSession();
    window.location.href = 'index.html';
  }

  function safeNext(value) {
    const raw = String(value || '');
    const file = raw.split('?')[0].split('/').pop();
    return PAGES.indexOf(file) !== -1 ? file : '';
  }

  function requireAuth() {
    if (currentUser()) return true;
    const here = location.pathname.split('/').pop() || 'index.html';
    const next = safeNext(here);
    const target = 'login.html' + (next ? '?next=' + encodeURIComponent(next) : '');
    location.replace(target);
    return false;
  }

  function initialsOf(name) {
    return String(name || '?')
      .trim()
      .split(/\s+/)
      .map(function (w) { return w.charAt(0); })
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  function esc(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ---------- header ---------- */

  function wireAccountMenu(root) {
    const btn = root.querySelector('.account-btn');
    const panel = root.querySelector('.account-panel');
    if (!btn || !panel) return;

    function close() {
      panel.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      root.classList.remove('open');
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      const willOpen = panel.hidden;
      panel.hidden = !willOpen;
      btn.setAttribute('aria-expanded', String(willOpen));
      root.classList.toggle('open', willOpen);
    });

    document.addEventListener('click', function (e) {
      if (!root.contains(e.target)) close();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) {
        close();
        btn.focus();
      }
    });

    const out = panel.querySelector('[data-signout]');
    if (out) out.addEventListener('click', function () { signOut(); });
  }

  function renderHeader() {
    const slot = document.getElementById('authSlot');
    if (!slot) return;
    const user = currentUser();

    if (!user) {
      slot.innerHTML = '<a class="btn btn-primary btn-sm" href="login.html">Sign in</a>';
      return;
    }

    slot.innerHTML =
      '<div class="account">' +
        '<button class="account-btn" type="button" aria-haspopup="true" aria-expanded="false" aria-label="Account menu">' +
          '<span class="avatar" aria-hidden="true">' + esc(initialsOf(user.name)) + '</span>' +
          '<span class="account-name">' + esc(user.name.split(/\s+/)[0]) + '</span>' +
          '<svg class="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>' +
        '</button>' +
        '<div class="account-panel" hidden>' +
          '<div class="account-id">' +
            '<b>' + esc(user.name) + '</b>' +
            '<span>' + esc(user.email) + '</span>' +
          '</div>' +
          '<a href="dashboard.html">Dashboard</a>' +
          '<button type="button" data-signout>Sign out</button>' +
        '</div>' +
      '</div>';

    wireAccountMenu(slot.querySelector('.account'));
  }

  /* Mobile navigation entry: the auth chip is hidden below 820px, so the
     same action is offered inside the collapsed menu. */
  function renderNavAuth() {
    const box = document.getElementById('navAuth');
    if (!box) return;
    const user = currentUser();

    if (!user) {
      box.innerHTML = '<a href="login.html">Sign in</a>';
      return;
    }

    box.innerHTML = '<button type="button" data-signout>Sign out (' + esc(user.name.split(/\s+/)[0]) + ')</button>';
    const out = box.querySelector('[data-signout]');
    if (out) out.addEventListener('click', function () { signOut(); });
  }

  function init() {
    renderHeader();
    renderNavAuth();
    if (document.body && document.body.getAttribute('data-require-auth') === 'true') {
      requireAuth();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    currentUser: currentUser,
    requireAuth: requireAuth,
    renderHeader: renderHeader,
    initialsOf: initialsOf,
    safeNext: safeNext,
    subtleAvailable: subtleAvailable,
    PAGES: PAGES
  };
})();
