/* ============================================================
   TOTOO AI — shared UI behaviour
   ============================================================ */

(function () {
  'use strict';

  /* ---------- sticky header state ---------- */
  const header = document.querySelector('.site-header');
  if (header) {
    const onScroll = function () {
      header.classList.toggle('is-stuck', window.scrollY > 6);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- mobile navigation ---------- */
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  /* ---------- current page highlight ---------- */
  const here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav a').forEach(function (a) {
    const target = a.getAttribute('href');
    if (!target) return;
    if (target === here || (here === '' && target === 'index.html')) {
      a.setAttribute('aria-current', 'page');
    }
  });

  /* ---------- reveal on scroll + animated bars ---------- */
  const revealables = document.querySelectorAll('.reveal');
  const bars = document.querySelectorAll('[data-bar]');

  function animateBar(el) {
    const value = Number(el.getAttribute('data-bar')) || 0;
    el.style.width = Math.max(0, Math.min(100, value)) + '%';
  }

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        const target = entry.target;
        if (target.classList.contains('reveal')) target.classList.add('in');
        io.unobserve(target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    revealables.forEach(function (el) { io.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add('in'); });
  }

  /* Bars are filled on first paint rather than on scroll: the CSS transition
     still animates them, and they stay correct in snapshots and print. */
  if ('requestAnimationFrame' in window) {
    requestAnimationFrame(function () {
      setTimeout(function () { bars.forEach(animateBar); }, 80);
    });
  } else {
    bars.forEach(animateBar);
  }

  /* ---------- footer year ---------- */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* ---------- toast ---------- */
  let toastEl = null;
  let toastTimer = null;

  window.toast = function (message) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.innerHTML = '<span class="t-dot"></span><span class="t-msg"></span>';
      document.body.appendChild(toastEl);
    }
    toastEl.querySelector('.t-msg').textContent = message;
    requestAnimationFrame(function () { toastEl.classList.add('show'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2800);
  };
})();
