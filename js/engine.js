/* ============================================================
   TOTOO AI — Detection engine
   Transparent, client-side heuristic prototype.

   This is NOT a trained neural network. It implements the
   signal families described in the study (lexical sensationalism,
   attribution integrity, emotional intensity, formatting,
   verifiability, file metadata) so the interface and evaluation
   flow can be demonstrated end-to-end. Every function sits behind
   a single entry point so a hosted model can replace it later:

       TotooEngine.analyzeText(text)
       TotooEngine.analyzeImage(file)
       TotooEngine.analyzeVideo(file)

   Every result returns { score, verdict, signals[] } where score
   is a 0-100 manipulation-risk estimate.
   ============================================================ */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TotooEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ----------------------------------------------------------
     Lexicons (Filipino, Taglish, English)
     ---------------------------------------------------------- */

  const SENSATIONAL = [
    'grabe', 'grabeh', 'sobrang', 'shocking', 'nakakagulat', 'nagulantang',
    'bistado', 'pasabog', 'eksklusibo', 'hindi kapani-paniwala',
    'imbestigador', 'kalokohan', 'iskandalo', 'delikado', 'peligro',
    'breaking', 'just in', 'must share', 'share agad', 'ipaalam sa lahat',
    'ayaw maniwala', 'nagwawala', 'nagkagulo', 'hindi inaasahan',
    'nagulat', 'kakila-kilabot', 'nakakaloka', 'hala', 'seryoso ba',
    'totoo ba', 'grabe naman', 'bomba', 'big reveal', 'exposed', 'leak'
  ];

  const VAGUE_ATTRIBUTION = [
    'ayon sa isang source', 'ayon sa source', 'ayon sa aming source',
    'hindi pinangalanan', 'hindi kilalang source', 'isang netizen',
    'ayon sa isang netizen', 'sabi ng iba', 'may nagsabi', 'sabi nila',
    'reportedly', 'allegedly', 'sources say', 'unconfirmed report',
    'ayon sa tsismis', 'chika', 'chismis', 'tsismis', 'kumakalat',
    'ayon sa isang insider', 'inside source'
  ];

  const HEDGE_WORDS = ['daw', 'umano', 'kuno', 'raw', 'diumano'];

  const EMOTION = [
    'galit', 'takot', 'lungkot', 'iyak', 'umiiyak', 'saya', 'tawa',
    'inis', 'suklam', 'poot', 'kadiri', 'nakakainis', 'nakakaiyak',
    'natakot', 'nagalit', 'nasaktan', 'traitor', 'bayani', 'kawawa',
    'salbahe', 'demonyo', 'hayop', 'bobo', 'tanga', 'magnanakaw',
    'corrupt', 'trahedya', 'krisis', 'digmaan', 'giyera'
  ];

  const CREDIBLE_ORGS = [
    'doh', 'department of health', 'pnp', 'philippine national police',
    'comelec', 'pagasa', 'nbi', 'deped', 'dswd', 'dost', 'phivolcs',
    'malacañang', 'malacanang', 'senado', 'senate', 'kongreso',
    'house of representatives', 'supreme court', 'korte suprema',
    'reuters', 'associated press', 'afp', 'pna', 'philippine news agency',
    'gma', 'abs-cbn', 'rappler', 'inquirer', 'philstar',
    'manila bulletin', 'vera files', 'tsek.ph', 'pcij',
    'world health organization', 'who', 'nasa', 'noaa', 'unicef'
  ];

  const ATTRIBUTION_PHRASES = [
    'ayon sa', 'according to', 'pahayag ni', 'sinabi ni', 'sa isang pahayag',
    'inihayag ng', 'binanggit ni', 'confirmed by', 'in a statement',
    'press release', 'statement from', 'ayon kay', 'base sa pahayag'
  ];

  const AI_FILENAME_HINTS = [
    'midjourney', 'dalle', 'dall-e', 'stable-diffusion', 'stablediffusion',
    'ai-generated', 'ai_generated', 'aigenerated', 'deepfake', 'face-swap',
    'faceswap', 'synthetic', 'generated', 'runway', 'sora', 'veo',
    'this-person-does-not-exist', 'gan'
  ];

  const EDITOR_HINTS = [
    'photoshop', 'adobe', 'gimp', 'lightroom', 'canva', 'picsart',
    'snapseed', 'illustrator', 'affinity', 'pixlr', 'facetune'
  ];

  /* ----------------------------------------------------------
     Helpers
     ---------------------------------------------------------- */

  const clamp = (n, lo, hi) => Math.max(lo === undefined ? 0 : lo, Math.min(hi === undefined ? 100 : hi, n));
  const round = (n) => Math.round(n);

  function words(text) {
    const m = text.trim().match(/[\p{L}\p{N}'’-]+/gu);
    return m || [];
  }

  function countOccurrences(haystack, needle) {
    if (!needle) return 0;
    let count = 0;
    let i = 0;
    while ((i = haystack.indexOf(needle, i)) !== -1) {
      count++;
      i += needle.length;
    }
    return count;
  }

  function findAll(text, needle) {
    const out = [];
    if (!needle) return out;
    let i = 0;
    while ((i = text.indexOf(needle, i)) !== -1) {
      out.push({ start: i, end: i + needle.length });
      i += needle.length;
    }
    return out;
  }

  function verdictFrom(score) {
    if (score >= 65) return 'fake';
    if (score >= 40) return 'suspicious';
    return 'authentic';
  }

  function labelFor(verdict, kind) {
    const media = kind === 'text' ? 'fake' : 'manipulated';
    if (verdict === 'fake') return 'Likely ' + media;
    if (verdict === 'suspicious') return 'Suspicious — verify first';
    return 'Likely authentic';
  }

  function detailFor(verdict, score) {
    if (verdict === 'fake') return 'Strong misinformation signals detected (' + score + '% risk).';
    if (verdict === 'suspicious') return 'Mixed signals — treat as unverified until checked.';
    return 'No significant manipulation pattern detected (' + score + '% risk).';
  }

  /* ----------------------------------------------------------
     TEXT ANALYSIS
     ---------------------------------------------------------- */

  function analyzeText(rawText) {
    const text = String(rawText || '').trim();

    if (text.length < 12) {
      return { ok: false, error: 'Please enter at least a sentence (12 characters or more).' };
    }

    const lower = text.toLowerCase();
    const wordList = words(text);
    const wordCount = Math.max(1, wordList.length);
    const per100 = (n) => (n / wordCount) * 100;
    const totalChars = text.length;

    const hits = {
      sensational: 0,
      vague: 0,
      hedge: 0,
      emotion: 0
    };
    const flags = [];

    SENSATIONAL.forEach(function (term) {
      const n = countOccurrences(lower, term);
      if (n) {
        hits.sensational += n;
        flags.push({ term: term, weight: 3, type: 'sensational' });
      }
    });

    VAGUE_ATTRIBUTION.forEach(function (term) {
      const n = countOccurrences(lower, term);
      if (n) {
        hits.vague += n;
        flags.push({ term: term, weight: 4, type: 'vague' });
      }
    });

    HEDGE_WORDS.forEach(function (term) {
      const re = new RegExp('\\b' + term + '\\b', 'g');
      const n = (lower.match(re) || []).length;
      if (n) {
        hits.hedge += n;
        flags.push({ term: term, weight: 3, type: 'hedge' });
      }
    });

    EMOTION.forEach(function (term) {
      const re = new RegExp('\\b' + term + '\\b', 'g');
      const n = (lower.match(re) || []).length;
      if (n) {
        hits.emotion += n;
        flags.push({ term: term, weight: 2, type: 'emotion' });
      }
    });

    /* --- signal 1: sensational wording --- */
    const sensationalRisk = clamp(per100(hits.sensational) * 9);

    /* --- signal 2: attribution integrity --- */
    let credibility = 0;
    let attributionFound = 0;
    ATTRIBUTION_PHRASES.forEach(function (p) {
      const n = countOccurrences(lower, p);
      if (n) { attributionFound += n; credibility += Math.min(36, 18 * n); }
    });
    let orgFound = 0;
    CREDIBLE_ORGS.forEach(function (o) {
      const re = new RegExp('(^|[^\\p{L}])' + o.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^\\p{L}]|$)', 'u');
      if (re.test(lower)) { orgFound++; credibility += 20; }
    });
    credibility = Math.min(92, credibility);
    if (/["“”]/.test(text)) credibility = Math.min(92, credibility + 12);
    if (/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|ph|net|org|gov)\b/i.test(text)) credibility = Math.min(92, credibility + 8);
    const attributionRisk = clamp(92 - credibility);

    /* --- signal 3: emotional intensity --- */
    const exclamations = (text.match(/!/g) || []).length;
    const questions = (text.match(/\?/g) || []).length;
    const emotionRisk = clamp(
      per100(hits.emotion) * 11 +
      Math.min(30, exclamations * 7) +
      Math.min(10, questions * 3)
    );

    /* --- signal 4: formatting red flags --- */
    const letters = text.replace(/[^\p{L}]/gu, '');
    const upper = text.replace(/[^\p{L}]/gu, '').replace(/[^\p{Lu}]/gu, '');
    const capsRatio = letters.length > 8 ? upper.length / letters.length : 0;
    const punctuationSpam = (text.match(/[!?]{2,}/g) || []).length;
    const emoji = (text.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []).length;
    const formattingRisk = clamp(
      Math.max(0, capsRatio - 0.24) * 190 +
      Math.min(28, punctuationSpam * 9) +
      Math.min(18, emoji * 3) +
      (text.length > 60 && text.length < 160 ? 8 : 0)
    );

    /* --- signal 5: vague sourcing / hedging --- */
    const vaguenessRisk = clamp(
      Math.min(70, hits.vague * 26) +
      Math.min(38, hits.hedge * 12) +
      Math.min(20, per100(hits.hedge) * 14)
    );

    /* --- signal 6: verifiability --- */
    const hasDate =
      /\b(enero|pebrero|marso|abril|mayo|hunyo|hulyo|agosto|setyembre|oktubre|nobyembre|disyembre|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s*\d{4}\b/i.test(text) ||
      /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/.test(text);
    const hasNumbers = /\d/.test(text);
    const hasNamedPerson = /\b(sec\.|secretary|sen\.|senator|gov\.|governor|mayor|rep\.|congressman|chief|general|dr\.)\s+[\p{Lu}]/u.test(text);

    let verifiability = 0;
    if (hasDate) verifiability += 30;
    if (hasNumbers) verifiability += 15;
    if (hasNamedPerson) verifiability += 20;
    if (orgFound) verifiability += 20;
    if (attributionFound) verifiability += 15;
    const verifiabilityRisk = clamp(90 - verifiability);

    const signals = [
      {
        id: 'sensational',
        name: 'Sensational wording',
        value: round(sensationalRisk),
        note: hits.sensational
          ? hits.sensational + ' sensational term' + (hits.sensational > 1 ? 's' : '') + ' found'
          : 'No clickbait vocabulary'
      },
      {
        id: 'attribution',
        name: 'Source attribution',
        value: round(attributionRisk),
        note: orgFound
          ? orgFound + ' credible outlet or agency reference' + (orgFound > 1 ? 's' : '')
          : attributionFound
            ? attributionFound + ' attribution phrase' + (attributionFound > 1 ? 's' : '')
            : 'No named source or agency'
      },
      {
        id: 'emotion',
        name: 'Emotional intensity',
        value: round(emotionRisk),
        note: exclamations
          ? exclamations + ' exclamation mark' + (exclamations > 1 ? 's' : '') + ', ' + hits.emotion + ' emotion word(s)'
          : (hits.emotion ? hits.emotion + ' emotion word(s)' : 'Neutral tone')
      },
      {
        id: 'formatting',
        name: 'Formatting red flags',
        value: round(formattingRisk),
        note: capsRatio > 0.4
          ? Math.round(capsRatio * 100) + '% of letters are uppercase'
          : (punctuationSpam ? 'Repeated punctuation detected' : 'Normal casing and punctuation')
      },
      {
        id: 'vagueness',
        name: 'Vague hedging language',
        value: round(vaguenessRisk),
        note: (hits.vague + hits.hedge)
          ? (hits.vague + hits.hedge) + ' vague-reference marker(s) such as "daw", "umano", "reportedly"'
          : 'No hedging markers'
      },
      {
        id: 'verifiability',
        name: 'Verifiability',
        value: round(verifiabilityRisk),
        note: hasDate || hasNumbers || hasNamedPerson
          ? 'Contains checkable detail (dates, names, figures)'
          : 'No dates, names, or figures to verify'
      }
    ];

    const WEIGHTS = {
      sensational: 0.22,
      attribution: 0.24,
      emotion: 0.15,
      formatting: 0.11,
      vagueness: 0.17,
      verifiability: 0.11
    };

    let score = 0;
    signals.forEach(function (s) { score += s.value * WEIGHTS[s.id]; });

    /* Corroboration rule: several weak signals together are stronger than
       any single one. Mirrors the multi-feature ensembling used by
       Jamen & Reyes (2023) and Kumar et al. (2026). */
    let composite = 0;
    if (attributionRisk >= 60) composite += 6;
    if (hits.vague + hits.hedge >= 2) composite += 6;
    if (sensationalRisk >= 60) composite += 4;

    score = clamp(round(score + composite));
    const verdict = verdictFrom(score);

    /* --- highlight ranges --- */
    const ranges = [];
    flags.forEach(function (f) {
      findAll(lower, f.term).forEach(function (r) { ranges.push(r); });
    });
    ranges.sort(function (a, b) { return a.start - b.start; });
    const merged = [];
    ranges.forEach(function (r) {
      const last = merged[merged.length - 1];
      if (last && r.start <= last.end) { last.end = Math.max(last.end, r.end); }
      else merged.push({ start: r.start, end: r.end });
    });

    const notes = [];
    if (attributionRisk >= 60) notes.push('No named source, agency, or link — the single strongest indicator of unverified content.');
    if (hits.vague) notes.push('Vague attributions ("' + VAGUE_ATTRIBUTION.find(function (v) { return lower.indexOf(v) !== -1; }) + '") shift the burden of proof away from the poster.');
    if (sensationalRisk >= 55) notes.push('Clickbait vocabulary is used to trigger sharing before verification.');
    if (formattingRisk >= 55) notes.push('Heavy capitalisation and punctuation are classic engagement-bait patterns.');
    if (verifiabilityRisk >= 60) notes.push('Nothing in the post can be independently checked — no date, figure, or named person.');
    if (!notes.length) notes.push('Text is attributed, dated, and measured in tone — consistent with standard news writing.');
    notes.push('Cross-check the claim with at least two independent outlets before sharing.');

    return {
      ok: true,
      kind: 'text',
      score: score,
      verdict: verdict,
      verdictLabel: labelFor(verdict, 'text'),
      detail: detailFor(verdict, score),
      signals: signals,
      highlights: merged,
      excerpt: text,
      stats: {
        words: wordCount,
        chars: totalChars,
        capsRatio: Math.round(capsRatio * 100),
        exclamations: exclamations
      },
      notes: notes,
      engine: 'heuristic-v1'
    };
  }

  /* ----------------------------------------------------------
     MEDIA HELPERS
     ---------------------------------------------------------- */

  function extensionOf(name) {
    const m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
    return m ? m[1] : '';
  }

  async function sniffBytes(file) {
    const slice = file.slice(0, 32);
    const buf = new Uint8Array(await slice.arrayBuffer());
    const hex = Array.prototype.map.call(buf, function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
    if (hex.startsWith('ffd8ff')) return 'jpeg';
    if (hex.startsWith('89504e47')) return 'png';
    if (hex.startsWith('47494638')) return 'gif';
    if (hex.startsWith('52494646') && hex.slice(16, 24) === '57454250') return 'webp';
    if (hex.slice(8, 16) === '66747970') return 'video';
    if (hex.startsWith('424d')) return 'bmp';
    return '';
  }

  async function readHeadText(file, limit) {
    const slice = file.slice(0, limit || 262144);
    const buf = new Uint8Array(await slice.arrayBuffer());
    let out = '';
    for (let i = 0; i < buf.length; i++) out += String.fromCharCode(buf[i]);
    return out;
  }

  function filenameHits(name) {
    const lower = String(name || '').toLowerCase();
    const found = [];
    AI_FILENAME_HINTS.forEach(function (h) { if (lower.indexOf(h) !== -1) found.push(h); });
    EDITOR_HINTS.forEach(function (h) { if (lower.indexOf(h) !== -1) found.push(h); });
    return found;
  }

  function describeBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function signal(id, name, value, note) {
    return { id: id, name: name, value: round(clamp(value)), note: note };
  }

  /* ----------------------------------------------------------
     IMAGE ANALYSIS
     ---------------------------------------------------------- */

  async function analyzeImage(file) {
    if (!file) return { ok: false, error: 'No image selected.' };
    if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name)) {
      return { ok: false, error: 'That file does not look like an image. Use JPG, PNG, or WebP.' };
    }

    const ext = extensionOf(file.name);
    const sniffed = await sniffBytes(file);
    const head = await readHeadText(file, 262144);
    const lowerHead = head.toLowerCase();

    const hasExif = /exif/.test(lowerHead);
    const hasC2PA = /c2pa|jumbf/.test(lowerHead);
    const editor = EDITOR_HINTS.filter(function (h) { return lowerHead.indexOf(h) !== -1; });
    const nameHits = filenameHits(file.name);

    const dims = await new Promise(function (resolve) {
      if (typeof Image === 'undefined') { resolve(null); return; }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(url);
      };
      img.onerror = function () { resolve(null); URL.revokeObjectURL(url); };
      img.src = url;
    });

    const bytes = file.size;
    const pixels = dims ? Math.max(1, dims.width * dims.height) : 0;
    const bytesPerPixel = pixels ? bytes / pixels : 0;
    const megapixels = pixels ? pixels / 1e6 : 0;

    const formatOk = !sniffed || sniffed === 'jpeg' && /jpe?g/.test(ext) ||
      sniffed === 'png' && ext === 'png' ||
      sniffed === 'webp' && ext === 'webp' ||
      sniffed === 'gif' && ext === 'gif';
    const mismatch = !!sniffed && !formatOk;

    const signals = [
      signal(
        'metadata',
        'Provenance metadata',
        hasC2PA ? 12 : hasExif ? 34 : 72,
        hasC2PA
          ? 'C2PA / content-credential block present'
          : hasExif
            ? 'EXIF block found — camera data may be verifiable'
            : 'No EXIF or provenance block — origin cannot be traced'
      ),
      signal(
        'format',
        'Format & container integrity',
        mismatch ? 74 : 20,
        mismatch
          ? 'File extension does not match its actual byte signature'
          : 'Container matches the file extension'
      ),
      signal(
        'editing',
        'Editing / generation traces',
        (editor.length ? 58 : 0) + (nameHits.length ? 34 : 0) + (hasC2PA ? -10 : 8),
        editor.length
          ? 'Editing-software signature: ' + editor.join(', ')
          : nameHits.length
            ? 'Filename contains generator hint: ' + nameHits.join(', ')
            : 'No editing-software or generator markers in the header'
      ),
      signal(
        'geometry',
        'Geometry & compression profile',
        (megapixels && megapixels < 0.25 ? 52 : 22) +
          (dims && Math.abs(dims.width - dims.height) <= 4 && dims.width >= 768 ? 14 : 0) +
          (bytesPerPixel > 2.6 ? 16 : 0),
        dims
          ? dims.width + '×' + dims.height + ' px · ' + megapixels.toFixed(2) + ' MP · ' + bytesPerPixel.toFixed(2) + ' bytes/pixel'
          : 'Dimensions could not be read'
      ),
      signal(
        'filename',
        'Filename provenance',
        nameHits.length ? 62 : 18,
        nameHits.length
          ? 'Suspicious naming pattern: ' + nameHits.join(', ')
          : 'Generic filename'
      )
    ];

    const WEIGHTS = { metadata: 0.28, format: 0.18, editing: 0.22, geometry: 0.16, filename: 0.16 };
    let score = 0;
    signals.forEach(function (s) { score += s.value * WEIGHTS[s.id]; });
    score = clamp(round(score));
    const verdict = verdictFrom(score);

    const notes = [];
    if (!hasExif && !hasC2PA) notes.push('Stripped metadata is common on social uploads, but it also means the image cannot be traced to a device or creator.');
    if (editor.length) notes.push('An editing-software signature was found, so retouching cannot be ruled out.');
    if (nameHits.length) notes.push('The filename itself suggests AI generation or heavy editing.');
    if (mismatch) notes.push('The header bytes contradict the file extension — treat the file as unsafe.');
    if (dims && Math.abs(dims.width - dims.height) <= 4) notes.push('Perfectly square output is typical of diffusion-model defaults (1024×1024, 512×512).');
    if (!notes.length) notes.push('Metadata and container checks are clean. Visual inspection is still required.');
    notes.push('Run a reverse image search and compare with the original post.');

    return {
      ok: true,
      kind: 'image',
      score: score,
      verdict: verdict,
      verdictLabel: labelFor(verdict, 'image'),
      detail: detailFor(verdict, score),
      signals: signals,
      notes: notes,
      facts: [
        { label: 'File', value: file.name },
        { label: 'Size', value: describeBytes(bytes) },
        { label: 'Type', value: (sniffed || ext || 'unknown').toUpperCase() },
        { label: 'Dimensions', value: dims ? dims.width + '×' + dims.height : '—' }
      ],
      engine: 'heuristic-v1'
    };
  }

  /* ----------------------------------------------------------
     VIDEO ANALYSIS
     ---------------------------------------------------------- */

  async function analyzeVideo(file) {
    if (!file) return { ok: false, error: 'No video selected.' };
    if (!/^video\//.test(file.type) && !/\.(mp4|webm|mov|m4v|ogv)$/i.test(file.name)) {
      return { ok: false, error: 'That file does not look like a video. Use MP4, WebM, or MOV.' };
    }

    const ext = extensionOf(file.name);
    const sniffed = await sniffBytes(file);
    const head = await readHeadText(file, 131072);
    const lowerHead = head.toLowerCase();
    const nameHits = filenameHits(file.name);
    const editor = EDITOR_HINTS.filter(function (h) { return lowerHead.indexOf(h) !== -1; });

    const info = await new Promise(function (resolve) {
      if (typeof document === 'undefined') { resolve(null); return; }
      const url = URL.createObjectURL(file);
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.muted = true;
      const done = function (payload) {
        URL.revokeObjectURL(url);
        resolve(payload);
      };
      v.onloadedmetadata = function () {
        let hasAudio = null;
        try {
          if ('mozHasAudio' in v) hasAudio = !!v.mozHasAudio;
          else if (v.audioTracks && typeof v.audioTracks.length === 'number') hasAudio = v.audioTracks.length > 0;
          else if (typeof v.webkitAudioDecodedByteCount === 'number' && v.webkitAudioDecodedByteCount > 0) hasAudio = true;
        } catch (e) { hasAudio = null; }
        done({
          duration: v.duration,
          width: v.videoWidth,
          height: v.videoHeight,
          hasAudio: hasAudio
        });
      };
      v.onerror = function () { done(null); };
      v.src = url;
      setTimeout(function () { done(null); }, 6000);
    });

    const bytes = file.size;
    const duration = info && isFinite(info.duration) ? info.duration : 0;
    const bitrate = duration ? (bytes * 8) / duration / 1000 : 0;
    const short = duration > 0 && duration < 12;
    const tiny = info && info.width ? info.width < 480 : false;

    const signals = [
      signal(
        'metadata',
        'Container & metadata',
        /exif|udta|xmp|creation_time/.test(lowerHead) ? 30 : 66,
        /exif|udta|xmp|creation_time/.test(lowerHead)
          ? 'Container carries device or creation metadata'
          : 'No device or creation metadata in the container'
      ),
      signal(
        'geometry',
        'Resolution & aspect',
        (tiny ? 46 : 16) +
          (info && info.width && info.height && Math.abs((info.width / info.height) - 1) < 0.02 ? 12 : 0),
        info && info.width
          ? info.width + '×' + info.height + ' · ' + (info.width / info.height).toFixed(2) + ':1 aspect'
          : 'Resolution could not be read'
      ),
      signal(
        'compression',
        'Bitrate profile',
        bitrate === 0 ? 48 : bitrate < 350 ? 42 : bitrate > 12000 ? 30 : 18,
        bitrate ? Math.round(bitrate) + ' kbps · ' + describeBytes(bytes) : 'Bitrate could not be estimated'
      ),
      signal(
        'editing',
        'Editing / generation traces',
        (editor.length ? 62 : 0) + (nameHits.length ? 36 : 0),
        editor.length
          ? 'Editing-software signature: ' + editor.join(', ')
          : nameHits.length
            ? 'Filename contains generator hint: ' + nameHits.join(', ')
            : 'No generator or editor markers detected'
      ),
      signal(
        'audio',
        'Audio track',
        info && info.hasAudio === true ? 38 : info && info.hasAudio === false ? 26 : 30,
        info
          ? info.hasAudio === true
            ? 'Audio track present — check for voice cloning'
            : info.hasAudio === false
              ? 'Silent video — audio deepfake not applicable'
              : 'Audio presence could not be confirmed by this browser'
          : 'Audio track could not be probed'
      ),
      signal(
        'duration',
        'Clip profile',
        (short ? 34 : 12) + (!duration ? 22 : 0),
        duration ? duration.toFixed(1) + ' s clip' : 'Duration unreadable'
      )
    ];

    const WEIGHTS = { metadata: 0.22, geometry: 0.16, compression: 0.18, editing: 0.20, audio: 0.10, duration: 0.14 };
    let score = 0;
    signals.forEach(function (s) { score += s.value * WEIGHTS[s.id]; });
    score = clamp(round(score));
    const verdict = verdictFrom(score);

    const notes = [];
    if (!/exif|udta|xmp|creation_time/.test(lowerHead)) notes.push('Most platforms strip container metadata on upload — absence alone is not proof of manipulation.');
    if (info && info.hasAudio === true) notes.push('Audio is present. Listen for unnatural breathing pauses, flat prosody, or lip-sync drift.');
    if (info && info.hasAudio === null) notes.push('This browser cannot report whether the clip has an audio track — play it and listen for voice cloning.');
    if (short) notes.push('Short clips are the dominant format for face-swap deepfakes; single-frame artifacts are easier to hide.');
    if (nameHits.length) notes.push('The filename points to a synthetic-media generator.');
    if (!notes.length) notes.push('Container checks are clean; frame-level inspection is still recommended.');
    notes.push('Use InVID / WeVerify to extract keyframes and inspect them individually.');
    notes.push('Compare the clip against the original upload from the named person or outlet.');

    return {
      ok: true,
      kind: 'video',
      score: score,
      verdict: verdict,
      verdictLabel: labelFor(verdict, 'video'),
      detail: detailFor(verdict, score),
      signals: signals,
      notes: notes,
      facts: [
        { label: 'File', value: file.name },
        { label: 'Size', value: describeBytes(bytes) },
        { label: 'Duration', value: duration ? duration.toFixed(1) + ' s' : '—' },
        { label: 'Resolution', value: info && info.width ? info.width + '×' + info.height : '—' },
        { label: 'Audio', value: info ? (info.hasAudio === true ? 'Present' : info.hasAudio === false ? 'None' : 'Unconfirmed') : '—' }
      ],
      engine: 'heuristic-v1'
    };
  }

  return {
    analyzeText: analyzeText,
    analyzeImage: analyzeImage,
    analyzeVideo: analyzeVideo,
    version: 'heuristic-v1',
    thresholds: { fake: 65, suspicious: 40 }
  };
});
