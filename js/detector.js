/* ============================================================
   TOTOO AI — detector page controller
   ============================================================ */

(function () {
  'use strict';

  const Engine = window.TotooEngine;
  if (!Engine) return;

  const $ = function (sel, root) { return (root || document).querySelector(sel); };
  const $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  const els = {
    tabs: $$('.tab'),
    panels: $$('.tab-panel'),
    textInput: $('#textInput'),
    charCount: $('#charCount'),
    sampleRow: $('#sampleRow'),
    runBtn: $('#runBtn'),
    clearBtn: $('#clearBtn'),
    analyzing: $('#analyzing'),
    analysisSteps: $('#analysisSteps'),
    resultWrap: $('#resultWrap'),
    resultEmpty: $('#resultEmpty'),
    result: $('#result'),
    dropzones: { image: $('#dzImage'), video: $('#dzVideo') },
    inputs: { image: $('#fileImage'), video: $('#fileVideo') },
    previews: { image: $('#previewImage'), video: $('#previewVideo') },
    previewMeta: { image: $('#previewMetaImage'), video: $('#previewMetaVideo') },
    clearFile: { image: $('#clearImage'), video: $('#clearVideo') }
  };

  const state = {
    mode: 'text',
    files: { image: null, video: null },
    urls: { image: null, video: null },
    busy: false
  };

  /* ---------- helpers ---------- */

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function humanBytes(b) {
    if (!b) return '0 B';
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(2) + ' MB';
  }

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function verdictColor(verdict) {
    if (verdict === 'fake') return 'var(--crimson)';
    if (verdict === 'suspicious') return 'var(--amber)';
    return 'var(--teal)';
  }

  function verdictIcon(verdict) {
    if (verdict === 'authentic') return '✓';
    if (verdict === 'suspicious') return '!';
    return '✕';
  }

  /* ---------- tabs ---------- */

  function setMode(mode) {
    state.mode = mode;
    els.tabs.forEach(function (t) {
      const active = t.getAttribute('data-tab') === mode;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', String(active));
    });
    els.panels.forEach(function (p) {
      p.classList.toggle('active', p.getAttribute('data-panel') === mode);
    });
    updateRunState();
  }

  els.tabs.forEach(function (tab) {
    tab.addEventListener('click', function () { setMode(tab.getAttribute('data-tab')); });
  });

  /* ---------- text input ---------- */

  function updateCharCount() {
    const value = els.textInput.value;
    const words = value.trim() ? value.trim().split(/\s+/).length : 0;
    els.charCount.textContent = value.length + ' chars · ' + words + ' words';
  }

  if (els.textInput) {
    els.textInput.addEventListener('input', function () {
      updateCharCount();
      updateRunState();
    });
    updateCharCount();
  }

  /* ---------- samples ---------- */

  if (els.sampleRow && window.TotooSamples) {
    window.TotooSamples.forEach(function (sample) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.setAttribute('data-kind', sample.tone);
      btn.textContent = sample.label;
      btn.addEventListener('click', function () {
        els.textInput.value = sample.text;
        updateCharCount();
        updateRunState();
        setMode('text');
        els.textInput.focus();
        window.toast('Sample loaded — run the analysis.');
      });
      els.sampleRow.appendChild(btn);
    });
  }

  /* ---------- file handling ---------- */

  function clearFile(kind) {
    state.files[kind] = null;
    if (state.urls[kind]) {
      URL.revokeObjectURL(state.urls[kind]);
      state.urls[kind] = null;
    }
    els.inputs[kind].value = '';
    els.previews[kind].classList.remove('show');
    const media = els.previews[kind].querySelector('[data-media]') || els.previews[kind];
    media.innerHTML = '';
    els.previewMeta[kind].innerHTML = '';
    els.clearFile[kind].classList.add('is-hidden');
    updateRunState();
  }

  function renderPreview(kind, file) {
    const preview = els.previews[kind];
    const meta = els.previewMeta[kind];
    const media = preview.querySelector('[data-media]') || preview;
    media.innerHTML = '';

    if (state.urls[kind]) URL.revokeObjectURL(state.urls[kind]);
    const objectUrl = URL.createObjectURL(file);
    state.urls[kind] = objectUrl;

    if (kind === 'image') {
      const img = document.createElement('img');
      img.alt = 'Selected image preview';
      img.src = objectUrl;
      img.onload = function () {
        meta.innerHTML =
          '<span><b>' + esc(file.name) + '</b></span>' +
          '<span>' + humanBytes(file.size) + '</span>' +
          '<span>' + img.naturalWidth + '×' + img.naturalHeight + ' px</span>';
      };
      media.appendChild(img);
    } else {
      const video = document.createElement('video');
      video.controls = true;
      video.playsInline = true;
      video.src = objectUrl;
      video.onloadedmetadata = function () {
        meta.innerHTML =
          '<span><b>' + esc(file.name) + '</b></span>' +
          '<span>' + humanBytes(file.size) + '</span>' +
          '<span>' + video.duration.toFixed(1) + ' s</span>' +
          '<span>' + video.videoWidth + '×' + video.videoHeight + '</span>';
      };
      media.appendChild(video);
    }

    preview.classList.add('show');
    els.clearFile[kind].classList.remove('is-hidden');
  }

  Object.keys(els.dropzones).forEach(function (kind) {
    const dz = els.dropzones[kind];
    const input = els.inputs[kind];
    if (!dz || !input) return;

    ['dragenter', 'dragover'].forEach(function (evt) {
      dz.addEventListener(evt, function (e) {
        e.preventDefault();
        dz.classList.add('is-drag');
      });
    });
    ['dragleave', 'drop'].forEach(function (evt) {
      dz.addEventListener(evt, function (e) {
        e.preventDefault();
        dz.classList.remove('is-drag');
      });
    });
    dz.addEventListener('drop', function (e) {
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      input.files = e.dataTransfer.files;
      acceptFile(kind, file);
    });

    input.addEventListener('change', function () {
      if (input.files && input.files[0]) acceptFile(kind, input.files[0]);
    });

    els.clearFile[kind].addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      clearFile(kind);
    });
  });

  function acceptFile(kind, file) {
    const expected = kind === 'image' ? /^image\// : /^video\//;
    if (!expected.test(file.type)) {
      window.toast(kind === 'image' ? 'Please choose an image file (JPG, PNG, WebP).' : 'Please choose a video file (MP4, WebM, MOV).');
      return;
    }
    const max = kind === 'image' ? 25 * 1024 * 1024 : 120 * 1024 * 1024;
    if (file.size > max) {
      window.toast('File is too large for this demo (' + humanBytes(max) + ' max).');
      return;
    }
    state.files[kind] = file;
    renderPreview(kind, file);
    updateRunState();
  }

  /* ---------- run-state ---------- */

  function updateRunState() {
    if (!els.runBtn) return;
    let ready = false;
    if (state.mode === 'text') ready = els.textInput.value.trim().length >= 12;
    else ready = !!state.files[state.mode];
    els.runBtn.disabled = !ready || state.busy;
  }

  /* ---------- analysis animation ---------- */

  const STAGE_COPY = {
    text: [
      'Normalising text and detecting language mix',
      'Scanning lexical sensationalism markers',
      'Checking attribution and verifiability',
      'Scoring emotional and formatting signals',
      'Computing weighted risk score'
    ],
    image: [
      'Reading container bytes and signature',
      'Extracting EXIF / provenance metadata',
      'Checking geometry and compression profile',
      'Matching generator and editor fingerprints',
      'Computing weighted risk score'
    ],
    video: [
      'Probing container, duration and codec',
      'Reading resolution and bitrate profile',
      'Checking for an audio track',
      'Matching generator and editor fingerprints',
      'Computing weighted risk score'
    ]
  };

  async function playStages(kind) {
    const list = STAGE_COPY[kind];
    els.analysisSteps.innerHTML = list.map(function (text, i) {
      return (
        '<div class="a-step" data-i="' + i + '">' +
        '<span class="tick">' + (i + 1) + '</span>' +
        '<span>' + text + '</span>' +
        '</div>'
      );
    }).join('');
    const nodes = $$('.a-step', els.analysisSteps);
    const delays = [220, 240, 260, 240];

    for (let i = 0; i < nodes.length; i++) {
      nodes[i].classList.add('active');
      await sleep(delays[i] || 200);
      nodes[i].classList.remove('active');
      nodes[i].classList.add('done');
      nodes[i].querySelector('.tick').textContent = '✓';
    }
  }

  /* ---------- result rendering ---------- */

  function renderSignals(signals) {
    return signals.map(function (s) {
      const color = s.value >= 65 ? 'var(--crimson)' : s.value >= 40 ? 'var(--amber)' : 'var(--teal)';
      return (
        '<div class="signal">' +
        '<span class="signal-name">' + esc(s.name) + '</span>' +
        '<span class="signal-val" style="color:' + color + '">' + s.value + '</span>' +
        '<span class="signal-track"><span class="signal-fill" data-w="' + s.value + '" style="background:' + color + '"></span></span>' +
        '<span class="signal-name" style="grid-column:1/-1;font-weight:500;color:var(--muted);font-size:.76rem;margin-top:-3px">' + esc(s.note) + '</span>' +
        '</div>'
      );
    }).join('');
  }

  function renderExcerpt(text, ranges) {
    if (!text) return '';
    const limit = 900;
    const slice = text.slice(0, limit);
    let out = '';
    let cursor = 0;
    ranges.forEach(function (r) {
      if (r.start >= limit) return;
      const start = Math.max(cursor, r.start);
      const end = Math.min(limit, r.end);
      if (end <= start) return;
      out += esc(slice.slice(cursor, start));
      out += '<mark>' + esc(slice.slice(start, end)) + '</mark>';
      cursor = end;
    });
    out += esc(slice.slice(cursor));
    if (text.length > limit) out += ' …';
    return out;
  }

  function renderFacts(facts) {
    if (!facts || !facts.length) return '';
    return (
      '<div class="result-block"><h4>File facts</h4>' +
      '<div class="facts">' +
      facts.map(function (f) {
        return '<div class="fact"><span>' + esc(f.label) + '</span><b>' + esc(f.value) + '</b></div>';
      }).join('') +
      '</div></div>'
    );
  }

  function renderResult(result, sourceLabel) {
    const color = verdictColor(result.verdict);
    const circ = 295.3;
    const offset = circ * (1 - result.score / 100);

    els.result.innerHTML =
      '<div class="result-head">' +
        '<div class="gauge">' +
          '<svg width="104" height="104" viewBox="0 0 104 104" aria-hidden="true">' +
            '<circle class="track" cx="52" cy="52" r="47"></circle>' +
            '<circle class="fill" cx="52" cy="52" r="47" stroke="' + color + '" ' +
              'style="stroke-dasharray:' + circ + ';stroke-dashoffset:' + circ + '"></circle>' +
          '</svg>' +
          '<div class="gauge-center"><b>' + result.score + '</b><span>Risk</span></div>' +
        '</div>' +
        '<div>' +
          '<span class="verdict-badge ' + result.verdict + '">' + verdictIcon(result.verdict) + ' ' + esc(result.verdictLabel) + '</span>' +
          '<h2>' + esc(sourceLabel) + '</h2>' +
          '<p class="r-sub">' + esc(result.detail) + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="result-body">' +
        renderFacts(result.facts) +
        '<div class="result-block"><h4>Signal breakdown</h4>' + renderSignals(result.signals) + '</div>' +
        (result.kind === 'text'
          ? '<div class="result-block"><h4>' +
            (result.highlights && result.highlights.length ? 'Flagged passages' : 'Analysed text') +
            '</h4><div class="excerpt">' + renderExcerpt(result.excerpt, result.highlights) + '</div></div>'
          : '') +
        '<div class="result-block"><h4>What this means</h4><ul class="notes-list">' +
          result.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') +
        '</ul></div>' +
        '<div class="result-block"><div class="advice">' +
          '<h4>Verify before you share</h4>' +
          '<div class="advice-links">' +
            '<a href="https://verafiles.org/articles" target="_blank" rel="noopener">VERA Files</a>' +
            '<a href="https://tsek.ph/" target="_blank" rel="noopener">Tsek.ph</a>' +
            '<a href="https://www.rappler.com/newsbreak/fact-check/" target="_blank" rel="noopener">Rappler Fact Check</a>' +
            '<a href="https://pcij.org/" target="_blank" rel="noopener">PCIJ</a>' +
            '<a href="https://toolbox.google.com/factcheck/explorer" target="_blank" rel="noopener">Google Fact Check</a>' +
          '</div>' +
          '<p style="margin:12px 0 0;font-size:.76rem;color:var(--ink-soft)">Result copied to your scan history automatically.</p>' +
        '</div></div>' +
        '<div class="result-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-copy-report>Copy report</button>' +
          '<a class="btn btn-ghost btn-sm" href="dashboard.html">Open dashboard</a>' +
        '</div>' +
      '</div>' +
      '<div class="disclaimer">' +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></svg>' +
        '<span><strong>Prototype notice.</strong> Totoo AI runs transparent heuristics on-device, not a trained deepfake classifier. Treat the score as a triage hint and confirm with a human fact-checker.</span>' +
      '</div>';

    els.resultEmpty.classList.add('is-hidden');
    els.result.classList.add('show');

    requestAnimationFrame(function () {
      const fill = $('.gauge .fill', els.result);
      if (fill) fill.style.strokeDashoffset = String(offset);
      $$('.signal-fill', els.result).forEach(function (bar) {
        bar.style.width = (Number(bar.getAttribute('data-w')) || 0) + '%';
      });
    });
  }

  function summaryText(result) {
    const lines = [
      'Totoo AI — detection report',
      'Verdict: ' + result.verdictLabel,
      'Risk score: ' + result.score + '/100',
      'Analysed: ' + new Date().toLocaleString(),
      '',
      'Signals:'
    ];
    result.signals.forEach(function (s) {
      lines.push('  • ' + s.name + ': ' + s.value + '/100 — ' + s.note);
    });
    lines.push('', 'Heuristic prototype. Verify with a human fact-checker.');
    return lines.join('\n');
  }

  /* ---------- main run ---------- */

  async function run() {
    if (state.busy) return;
    state.busy = true;
    els.runBtn.disabled = true;
    const originalLabel = els.runBtn.innerHTML;
    els.runBtn.innerHTML = '<span class="spinner" style="border-top-color:var(--ink)"></span> Analysing…';

    els.resultEmpty.classList.add('is-hidden');
    els.result.classList.remove('show');
    els.analyzing.classList.add('show');
    els.resultWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    let result = null;
    let sourceLabel = '';
    let preview = '';
    let source = 'pasted text';

    try {
      await playStages(state.mode);

      if (state.mode === 'text') {
        const text = els.textInput.value.trim();
        result = Engine.analyzeText(text);
        const wc = text.split(/\s+/).filter(Boolean).length;
        sourceLabel = 'Text submission · ' + wc + ' words';
        preview = text;
        source = 'pasted text';
      } else if (state.mode === 'image') {
        const file = state.files.image;
        result = await Engine.analyzeImage(file);
        sourceLabel = file.name;
        preview = file.name;
        source = 'image upload';
      } else {
        const file = state.files.video;
        result = await Engine.analyzeVideo(file);
        sourceLabel = file.name;
        preview = file.name;
        source = 'video upload';
      }

      if (!result || !result.ok) {
        window.toast((result && result.error) || 'Analysis failed. Try another input.');
        els.resultEmpty.classList.remove('is-hidden');
        return;
      }

      await sleep(140);
      els.analyzing.classList.remove('show');
      renderResult(result, sourceLabel);
      window.__lastResult = result;

      const entry = {
        id: 'scan_' + Date.now(),
        ts: Date.now(),
        kind: result.kind,
        preview: preview.slice(0, 180),
        verdict: result.verdict,
        score: result.score,
        source: source
      };
      window.TotooStore.add(entry);
      window.toast('Scan saved to your dashboard.');
    } catch (err) {
      els.analyzing.classList.remove('show');
      els.resultEmpty.classList.remove('is-hidden');
      window.toast('Something went wrong while analysing.');
      console.error(err);
    } finally {
      state.busy = false;
      els.runBtn.innerHTML = originalLabel;
      updateRunState();
    }
  }

  if (els.runBtn) els.runBtn.addEventListener('click', run);

  if (els.clearBtn) {
    els.clearBtn.addEventListener('click', function () {
      els.textInput.value = '';
      updateCharCount();
      updateRunState();
      els.result.classList.remove('show');
      els.resultEmpty.classList.remove('is-hidden');
      els.textInput.focus();
    });
  }

  /* Ctrl/Cmd + Enter to run */
  if (els.textInput) {
    els.textInput.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!els.runBtn.disabled) run();
      }
    });
  }

  /* ---------- copy report ---------- */

  document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-copy-report]');
    if (!btn) return;
    const result = window.__lastResult;
    if (!result) return;
    navigator.clipboard.writeText(summaryText(result)).then(function () {
      window.toast('Report copied to clipboard.');
    }).catch(function () {
      window.toast('Clipboard blocked by the browser.');
    });
  });

  /* ---------- prefill from hero demo / deep links ---------- */

  try {
    const params = new URLSearchParams(location.search);
    const sampleId = params.get('sample');
    const pending = sessionStorage.getItem('totoo_pending_text');
    const sample = sampleId && window.TotooSamples && window.TotooSamples.byId
      ? window.TotooSamples.byId(sampleId)
      : null;

    if (sample) {
      els.textInput.value = sample.text;
      updateCharCount();
      updateRunState();
    } else if (pending) {
      els.textInput.value = pending;
      sessionStorage.removeItem('totoo_pending_text');
      updateCharCount();
      updateRunState();
      window.toast('Your text is loaded — press Analyse.');
    }

    if (params.get('run') === '1' && !els.runBtn.disabled) {
      setTimeout(run, 350);
    }
  } catch (e) { /* ignore */ }

  updateRunState();
})();
