/* ============================================================
   TOTOO AI — local scan history (localStorage)
   No accounts, no server: everything stays in this browser.
   ============================================================ */

window.TotooStore = (function () {
  'use strict';

  const KEY = 'totoo_ai_history_v1';
  const LIMIT = 60;

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function write(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, LIMIT)));
      return true;
    } catch (e) {
      return false;
    }
  }

  function add(entry) {
    const list = read();
    list.unshift(entry);
    write(list);
    return entry;
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }

  function remove(id) {
    write(read().filter(function (item) { return item.id !== id; }));
  }

  function stats() {
    const list = read();
    const total = list.length;
    const fake = list.filter(function (i) { return i.verdict === 'fake'; }).length;
    const suspicious = list.filter(function (i) { return i.verdict === 'suspicious'; }).length;
    const authentic = total - fake - suspicious;
    const avg = total
      ? Math.round(list.reduce(function (sum, i) { return sum + (Number(i.score) || 0); }, 0) / total)
      : 0;
    const riskShare = total ? Math.round(((fake + suspicious) / total) * 100) : 0;
    return { total: total, fake: fake, suspicious: suspicious, authentic: authentic, avg: avg, riskShare: riskShare };
  }

  return { list: read, add: add, clear: clear, remove: remove, stats: stats, KEY: KEY };
})();
