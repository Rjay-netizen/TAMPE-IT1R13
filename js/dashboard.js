/* ============================================================
   TOTOO AI — dashboard controller
   ============================================================ */

(function () {
  'use strict';

  const Store = window.TotooStore;
  const $ = function (s, r) { return (r || document).querySelector(s); };

  if (!Store) return;

  const Auth = window.TotooAuth;
  if (!Auth || !Auth.requireAuth()) return;

  const els = {
    total: $('#stTotal'),
    fake: $('#stFake'),
    suspicious: $('#stSuspicious'),
    avg: $('#stAvg'),
    count: $('#historyCount'),
    filterKind: $('#filterKind'),
    filterVerdict: $('#filterVerdict'),
    exportBtn: $('#exportBtn'),
    clearBtn: $('#clearBtn'),
    body: $('#historyBody'),
    tableWrap: $('#tableWrap'),
    empty: $('#emptyState'),
    mix: $('#scanMix'),
    user: $('#workspaceUser')
  };

  const VERDICT_TEXT = {
    fake: 'Likely fake',
    suspicious: 'Suspicious',
    authentic: 'Likely authentic'
  };

  const KIND_TEXT = { text: 'Text', image: 'Image', video: 'Video' };

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtDate(ts) {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function renderStats() {
    const s = Store.stats();
    if (els.total) els.total.textContent = String(s.total);
    if (els.fake) els.fake.textContent = String(s.fake);
    if (els.suspicious) els.suspicious.textContent = String(s.suspicious);
    if (els.avg) els.avg.textContent = s.total ? s.avg + '%' : '—';
    if (els.count) els.count.textContent = s.total + (s.total === 1 ? ' scan' : ' scans');

    if (els.mix) {
      const rows = [
        { name: 'Likely fake / manipulated', value: s.fake, color: 'var(--crimson)' },
        { name: 'Suspicious', value: s.suspicious, color: 'var(--amber)' },
        { name: 'Likely authentic', value: s.authentic, color: 'var(--teal)' }
      ];
      els.mix.innerHTML = rows.map(function (r) {
        const pct = s.total ? Math.round((r.value / s.total) * 100) : 0;
        return (
          '<div class="chart-row">' +
          '<span class="chart-name">' + r.name + '</span>' +
          '<span class="chart-track"><span class="chart-fill" style="background:' + r.color + '" data-w="' + pct + '"></span></span>' +
          '<span class="chart-val">' + pct + '%</span>' +
          '</div>'
        );
      }).join('');
    }
  }

  function animateMix() {
    document.querySelectorAll('#scanMix .chart-fill').forEach(function (bar) {
      requestAnimationFrame(function () {
        bar.style.width = (Number(bar.getAttribute('data-w')) || 0) + '%';
      });
    });
  }

  function renderTable() {
    const all = Store.list();
    const kind = els.filterKind ? els.filterKind.value : 'all';
    const verdict = els.filterVerdict ? els.filterVerdict.value : 'all';

    const rows = all.filter(function (item) {
      return (kind === 'all' || item.kind === kind) && (verdict === 'all' || item.verdict === verdict);
    });

    if (!els.body) return;

    if (!rows.length) {
      els.tableWrap.classList.add('is-hidden');
      els.empty.classList.remove('is-hidden');
      els.empty.querySelector('h3').textContent = all.length ? 'No scans match these filters' : 'No scans yet';
      els.empty.querySelector('p').textContent = all.length
        ? 'Try resetting the filters to see your full history.'
        : 'Run your first analysis and the result will appear here. Everything is stored locally in this browser.';
      return;
    }

    els.tableWrap.classList.remove('is-hidden');
    els.empty.classList.add('is-hidden');

    els.body.innerHTML = rows.map(function (item) {
      const conf = Number(item.score) || 0;
      const color = item.verdict === 'fake' ? 'var(--crimson)' : item.verdict === 'suspicious' ? 'var(--amber)' : 'var(--teal)';
      return (
        '<tr>' +
        '<td style="white-space:nowrap;color:var(--muted)">' + fmtDate(item.ts) + '</td>' +
        '<td><span class="badge kind">' + (KIND_TEXT[item.kind] || item.kind) + '</span></td>' +
        '<td class="td-preview"><span title="' + esc(item.preview) + '">' + esc(item.preview) + '</span></td>' +
        '<td><span class="badge ' + item.verdict + '">' + (VERDICT_TEXT[item.verdict] || item.verdict) + '</span></td>' +
        '<td><span class="conf-cell"><span class="conf-track"><span class="conf-fill" style="width:' + conf + '%;background:' + color + '"></span></span><b>' + conf + '%</b></span></td>' +
        '<td style="text-align:right"><button class="file-clear" data-remove="' + item.id + '" title="Remove this scan">Remove</button></td>' +
        '</tr>'
      );
    }).join('');
  }

  function refresh() {
    renderStats();
    renderTable();
    animateMix();
  }

  if (els.filterKind) els.filterKind.addEventListener('change', renderTable);
  if (els.filterVerdict) els.filterVerdict.addEventListener('change', renderTable);

  if (els.clearBtn) {
    els.clearBtn.addEventListener('click', function () {
      if (!Store.list().length) {
        window.toast('History is already empty.');
        return;
      }
      if (window.confirm('Delete all scan history from this browser?')) {
        Store.clear();
        refresh();
        window.toast('Scan history cleared.');
      }
    });
  }

  if (els.exportBtn) {
    els.exportBtn.addEventListener('click', function () {
      const data = Store.list();
      if (!data.length) {
        window.toast('Nothing to export yet.');
        return;
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'totoo-ai-scans-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      window.toast('Exported ' + data.length + ' scans as JSON.');
    });
  }

  document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    Store.remove(btn.getAttribute('data-remove'));
    refresh();
    window.toast('Scan removed.');
  });

  /* who is signed in */
  const me = Auth.currentUser();
  if (me && els.user) {
    els.user.innerHTML = 'Signed in as <b>' + esc(me.name) + '</b> · ' + esc(me.email) +
      ' — history saved to this account only.';
  }

  refresh();
})();
