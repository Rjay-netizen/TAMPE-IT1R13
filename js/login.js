/* ============================================================
   TOTOO AI — login page controller
   ============================================================ */

(function () {
  'use strict';

  const Auth = window.TotooAuth;
  if (!Auth) return;

  const $ = function (s) { return document.querySelector(s); };

  const els = {
    tabs: Array.prototype.slice.call(document.querySelectorAll('[data-mode]')),
    panels: Array.prototype.slice.call(document.querySelectorAll('[data-panel]')),
    signInForm: $('#signInForm'),
    signUpForm: $('#signUpForm'),
    banner: $('#authBanner'),
    strength: $('#strength'),
    togglePw: Array.prototype.slice.call(document.querySelectorAll('[data-toggle-pw]'))
  };

  const params = new URLSearchParams(location.search);
  const next = Auth.safeNext(params.get('next')) || 'dashboard.html';

  /* Already signed in? Skip the form. */
  if (Auth.currentUser()) {
    location.replace(next);
    return;
  }

  function setMode(mode) {
    els.tabs.forEach(function (t) {
      const active = t.getAttribute('data-mode') === mode;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', String(active));
    });
    els.panels.forEach(function (p) {
      p.classList.toggle('active', p.getAttribute('data-panel') === mode);
    });
    clearBanner();
    const first = document.querySelector('[data-panel="' + mode + '"] input');
    if (first && window.innerWidth > 820) first.focus();
  }

  els.tabs.forEach(function (tab) {
    tab.addEventListener('click', function () { setMode(tab.getAttribute('data-mode')); });
  });

  /* ---------- feedback ---------- */

  function showBanner(message, tone) {
    if (!els.banner) return;
    els.banner.textContent = message;
    els.banner.className = 'auth-banner show ' + (tone || 'error');
  }

  function clearBanner() {
    if (!els.banner) return;
    els.banner.textContent = '';
    els.banner.className = 'auth-banner';
  }

  function fieldError(form, name, message) {
    const node = form.querySelector('[data-error="' + name + '"]');
    const input = form.querySelector('[name="' + name + '"]');
    if (node) {
      node.textContent = message || '';
      node.classList.toggle('show', !!message);
    }
    if (input) {
      input.classList.toggle('invalid', !!message);
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
  }

  function clearErrors(form) {
    form.querySelectorAll('.field-error').forEach(function (n) {
      n.textContent = '';
      n.classList.remove('show');
    });
    form.querySelectorAll('input').forEach(function (i) {
      i.classList.remove('invalid');
      i.removeAttribute('aria-invalid');
    });
  }

  /* ---------- password visibility ---------- */

  els.togglePw.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const input = document.getElementById(btn.getAttribute('data-toggle-pw'));
      if (!input) return;
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
      btn.classList.toggle('on', !showing);
      input.focus();
    });
  });

  /* ---------- strength meter ---------- */

  function scorePassword(value) {
    let score = 0;
    if (value.length >= 8) score++;
    if (value.length >= 12) score++;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
    if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score++;
    return Math.min(4, score);
  }

  const LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
  const pwInput = document.getElementById('signupPassword');

  if (pwInput && els.strength) {
    pwInput.addEventListener('input', function () {
      const value = pwInput.value;
      if (!value) {
        els.strength.setAttribute('data-level', '0');
        els.strength.setAttribute('aria-label', 'Password strength');
        return;
      }
      const level = Math.max(1, scorePassword(value));
      els.strength.setAttribute('data-level', String(level));
      els.strength.setAttribute('aria-label', 'Password strength: ' + LABELS[level]);
    });
  }

  /* ---------- submit ---------- */

  function setLoading(form, loading) {
    const btn = form.querySelector('[type="submit"]');
    if (!btn) return;
    btn.disabled = loading;
    btn.classList.toggle('is-loading', loading);
    const label = btn.querySelector('.btn-label');
    if (label) label.textContent = loading ? 'Please wait…' : btn.getAttribute('data-label');
  }

  if (els.signInForm) {
    const form = els.signInForm;
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearBanner();
      clearErrors(form);

      const data = new FormData(form);
      const email = String(data.get('email') || '').trim();
      const password = String(data.get('password') || '');
      const remember = !!data.get('remember');

      if (!email) return fieldError(form, 'email', 'Enter your email address.');
      if (!password) return fieldError(form, 'password', 'Enter your password.');

      setLoading(form, true);
      const result = await Auth.signIn({ email: email, password: password, remember: remember });
      setLoading(form, false);

      if (!result.ok) {
        if (result.field) fieldError(form, result.field, result.error);
        else showBanner(result.error, 'error');
        return;
      }
      location.href = next;
    });
  }

  if (els.signUpForm) {
    const form = els.signUpForm;
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearBanner();
      clearErrors(form);

      const data = new FormData(form);
      const name = String(data.get('name') || '').trim();
      const email = String(data.get('email') || '').trim();
      const password = String(data.get('password') || '');
      const confirm = String(data.get('confirm') || '');
      const remember = !!data.get('remember');

      let invalid = false;
      if (name.length < 2) { fieldError(form, 'name', 'Enter your full name.'); invalid = true; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { fieldError(form, 'email', 'Enter a valid email address.'); invalid = true; }
      if (password.length < 8) { fieldError(form, 'password', 'Use at least 8 characters.'); invalid = true; }
      if (confirm !== password) { fieldError(form, 'confirm', 'Passwords do not match.'); invalid = true; }
      if (invalid) return;

      setLoading(form, true);
      const result = await Auth.signUp({
        name: name, email: email, password: password, remember: remember
      });
      setLoading(form, false);

      if (!result.ok) {
        if (result.field) fieldError(form, result.field, result.error);
        else showBanner(result.error, 'error');
        return;
      }
      location.href = next;
    });
  }

  /* Enter moves between fields naturally; Escape clears the banner */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') clearBanner();
  });

  const forgot = document.getElementById('forgotBtn');
  if (forgot) {
    forgot.addEventListener('click', function () {
      showBanner('Password recovery needs a server. In this demo, create a new account with a different email.', 'error');
    });
  }

  setMode(params.get('mode') === 'register' ? 'register' : 'signin');
})();
