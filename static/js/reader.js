(function() {
  let pdfPath = null, pdfFileName = '', sentences = [], audioMap = {}, cur = 0, playing = false;
  let nextAudio = null, speedTrain = false, trainTimer = null, pdfDoc = null;
  let completedSentences = 0;
  let localPdfUrl = null;

  const els = {
    pdfInput: document.getElementById('pdfInputReader'),
    extractBtn: document.getElementById('extractBtn'),
    extractText: document.getElementById('extractText'),
    pdfViewer: document.getElementById('pdfViewer'),
    pdfInfo: document.getElementById('pdfInfo'),
    pageIndicator: document.getElementById('pageIndicator'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    zoomOutBtn: document.getElementById('zoomOutBtn'),
    zoomInBtn: document.getElementById('zoomInBtn'),
    zoomLabel: document.getElementById('zoomLabel'),
    zoomSep: document.getElementById('zoomSep'),
    fitWidthBtn: document.getElementById('fitWidthBtn'),
    textContainer: document.getElementById('textContainer'),
    emptyState: document.getElementById('emptyState'),
    sentenceList: document.getElementById('sentenceList'),
    transport: document.getElementById('transport'),
    playBtn: document.getElementById('playBtn'), playIcon: document.getElementById('playIcon'),
    skipB: document.getElementById('skipBackBtn'), skipF: document.getElementById('skipFwdBtn'),
    jumpB: document.getElementById('jumpBackBtn'), jumpF: document.getElementById('jumpFwdBtn'),
    vol: document.getElementById('volumeSlider'), speed: document.getElementById('speedSelect'),
    exportBtn: document.getElementById('exportBtn'), searchBtn: document.getElementById('searchBtn'),
    scrubFill: document.getElementById('scrubberFill'), counter: document.getElementById('sentenceCounter'),
    trainBtn: document.getElementById('speedTrainBtn'), voiceSelect: document.getElementById('voiceSelect'),
    batchProgress: document.getElementById('batchProgress'),
    batchProgressBar: document.getElementById('batchProgressBar'),
    audiobookBtn: document.getElementById('audiobookBtn'),
    shortcutsBtn: document.getElementById('shortcutsBtn'),
    shortcutsModal: document.getElementById('shortcutsModal'),
    closeShortcuts: document.getElementById('closeShortcuts'),
    progressStat: document.getElementById('progressStat'),
    pdfDarkToggle: document.getElementById('pdfDarkToggle'),
    formatBadge: document.getElementById('formatBadge'),
    pdfViewerWrap: document.getElementById('pdfViewerWrap'),
    documentText: document.getElementById('documentText'),
  };

  var audio = new Audio();

  function enableTransport(enabled) { var v = !enabled; [els.playBtn, els.skipB, els.skipF, els.jumpB, els.jumpF].forEach(function(b) { b.disabled = v; }); }

  loadVoiceSelect(els.voiceSelect, 'en-US-JennyNeural');

  els.pdfInput.addEventListener('change', async function(e) {
    var f = e.target.files?.[0]; if (!f) return;
    if (localPdfUrl) URL.revokeObjectURL(localPdfUrl);
    localPdfUrl = URL.createObjectURL(f);
    var fd = new FormData(); fd.append('file', f);
    var r = await fetch('/api/upload-pdf/', { method: 'POST', body: fd, headers: {'X-CSRFToken': getCSRFToken()} });
    var d = await r.json();
    if (d.error) { showToast(d.error, 'error'); return; }
    window.history.replaceState(null, '', '/reader/?path=' + encodeURIComponent(d.path));
    loadPdf(d.path, d.name);
  });

  async function loadPdf(path, name) {
    pdfPath = path; pdfFileName = name || path;
    els.extractBtn.disabled = false;
    var ext = path ? '.' + path.split('.').pop().toLowerCase() : '.pdf';
    if (els.formatBadge) { els.formatBadge.textContent = ext; els.formatBadge.style.display = 'inline'; }
    if (ext === '.pdf') {
      showToast('PDF loaded: ' + pdfFileName, 'success');
      await renderPdfPreview(pdfPath);
    } else {
      showToast('Document loaded: ' + pdfFileName, 'success');
    }
    if (!sentences.length) await autoExtractDocument();
    loadSavedPosition();
    loadProgress();
  }

  function getDocExt(path) {
    return path ? '.' + path.split('.').pop().toLowerCase() : '.pdf';
  }

  async function autoExtractDocument() {
    var ext = getDocExt(pdfPath);
    var isPdf = ext === '.pdf';
    if (isPdf) {
      await extract();
      return;
    }
    els.extractBtn.disabled = true; els.extractText.textContent = 'Loading...';
    try {
      var r = await fetch('/api/extract-text/', {
        method: 'POST', headers: {'Content-Type':'application/json','X-CSRFToken':getCSRFToken()},
        body: JSON.stringify({path: pdfPath})
      });
      var d = await r.json();
      if (d.error) { showToast(d.error, 'error'); els.extractBtn.disabled = false; els.extractText.textContent = 'Extract'; return; }
      sentences = d.sentences || [];
      if (!sentences.length) { showToast('No text found', 'error'); els.extractBtn.disabled = false; return; }
      showToast(sentences.length + ' sentences extracted', 'success');
      if (els.formatBadge) { els.formatBadge.textContent = ext; els.formatBadge.style.display = 'inline'; }
      if (els.documentText) {
        els.pdfViewer.style.display = 'none';
        els.documentText.textContent = d.raw || sentences.map(function(s) { return s.text || s; }).join('\n\n');
        els.documentText.style.display = 'block';
      }
      renderSentences();
      els.transport.style.display = 'flex';
      enableTransport(true);
      els.exportBtn.disabled = false;
      els.searchBtn.disabled = false;
      els.audiobookBtn.disabled = false;
      els.extractBtn.disabled = false; els.extractText.textContent = 'Extract';
    } catch(e) {
      showToast('Extraction failed', 'error');
      els.extractBtn.disabled = false; els.extractText.textContent = 'Extract';
    }
  }

  async function loadSavedPosition() {
    if (!pdfPath) return;
    var r = await fetch('/api/get-position/?path=' + encodeURIComponent(pdfPath));
    var d = await r.json();
    if (d.sentenceIndex !== undefined && d.sentenceIndex > 0) {
      window._savedPos = d.sentenceIndex;
    }
  }

  async function loadProgress() {
    if (!pdfPath) return;
    var r = await fetch('/api/get-progress/?path=' + encodeURIComponent(pdfPath));
    var d = await r.json();
    completedSentences = d.completed || 0;
    updateProgress();
  }

  function updateProgress() {
    if (els.progressStat && sentences.length) {
      els.progressStat.textContent = completedSentences + '/' + sentences.length + ' read';
    }
  }

  var currentPage = 1, zoomLevel = 100, fitMode = true;

  async function renderPdfPreview(path) {
    if (typeof pdfjsLib === 'undefined') { return; }
    els.pdfViewer.innerHTML = '<div class="spinner" style="width:24px;height:24px;border:2px solid var(--border-subtle);border-top-color:var(--accent);border-radius:50%;"></div>';
    try {
      var url;
      if (localPdfUrl) {
        url = localPdfUrl;
      } else {
        var r = await fetch('/api/serve-pdf/' + encodeURIComponent(path) + '/');
        if (!r.ok) throw new Error('Server returned ' + r.status);
        var blob = await r.blob();
        url = URL.createObjectURL(blob);
      }
      pdfDoc = await pdfjsLib.getDocument(url).promise;
      els.pdfInfo.textContent = pdfFileName + ' (' + pdfDoc.numPages + ' pages)';
      els.pdfInfo.style.display = 'block';
      els.prevPageBtn.style.display = 'inline-flex';
      els.nextPageBtn.style.display = 'inline-flex';
      els.zoomOutBtn.style.display = 'inline-flex';
      els.zoomInBtn.style.display = 'inline-flex';
      els.zoomLabel.style.display = 'inline';
      els.zoomSep.style.display = 'inline';
      els.fitWidthBtn.style.display = 'inline-flex';
      await renderPage(1);
    } catch(e) {
      els.pdfViewer.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-tertiary);"><p>PDF preview unavailable</p></div>';
    }
  }

  async function renderPage(num) {
    if (!pdfDoc) return;
    currentPage = Math.max(1, Math.min(num, pdfDoc.numPages));
    var page = await pdfDoc.getPage(currentPage);
    var vp = page.getViewport({ scale: 1 });
    var containerWidth = els.pdfViewer.clientWidth - 32;
    var displayScale, renderScale;
    if (fitMode) {
      displayScale = containerWidth / vp.width;
      renderScale = displayScale * (window.devicePixelRatio || 1);
    } else {
      displayScale = zoomLevel / 100;
      renderScale = displayScale * (window.devicePixelRatio || 1);
    }
    var viewport = page.getViewport({ scale: renderScale });
    var displayWidth = vp.width * displayScale;
    var displayHeight = vp.height * displayScale;
    var canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = displayWidth + 'px';
    canvas.style.height = displayHeight + 'px';
    canvas.style.borderRadius = '4px';
    canvas.style.boxShadow = '0 2px 12px rgba(0,0,0,0.3)';
    canvas.style.margin = '0 auto';
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    els.pdfViewer.innerHTML = '';
    els.pdfViewer.appendChild(canvas);
    els.pdfViewer.style.display = 'block';
    els.pdfViewer.style.textAlign = 'center';
    els.pageIndicator.textContent = currentPage + ' / ' + pdfDoc.numPages;
    updateZoomLabel();
  }

  function updateZoomLabel() {
    if (fitMode) { els.zoomLabel.textContent = 'Fit'; }
    else { els.zoomLabel.textContent = zoomLevel + '%'; }
  }

  function goToPage(num, skipSentenceSync) {
    if (!pdfDoc) return;
    renderPage(num);
    if (skipSentenceSync) return;
    var idx = sentences.findIndex(function(s) { return (s.page !== undefined ? s.page + 1 : 0) === num; });
    if (idx >= 0 && !playing) {
      cur = idx;
      var items = els.sentenceList.querySelectorAll('.sentence-item');
      items.forEach(function(el,i) { el.className = 'sentence-item ' + (i===cur?'active':'') + ' ' + (i<cur?'done':''); });
      if (items[idx]) items[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
      updateCounter();
    }
  }

  els.prevPageBtn.addEventListener('click', function() { goToPage(currentPage - 1); });
  els.nextPageBtn.addEventListener('click', function() { goToPage(currentPage + 1); });

  els.zoomInBtn.addEventListener('click', function() {
    fitMode = false;
    zoomLevel = Math.min(300, zoomLevel + 25);
    renderPage(currentPage);
  });
  els.zoomOutBtn.addEventListener('click', function() {
    fitMode = false;
    zoomLevel = Math.max(25, zoomLevel - 25);
    renderPage(currentPage);
  });
  els.fitWidthBtn.addEventListener('click', function() {
    fitMode = true;
    zoomLevel = 100;
    renderPage(currentPage);
  });

  async function extract() {
    if (!pdfPath) { showToast('No PDF loaded', 'error'); return; }
    els.extractBtn.disabled = true; els.extractText.textContent = 'Extracting...';

    try {
      var r = await fetch('/api/extract-text/', {
        method: 'POST',
        headers: {'Content-Type':'application/json','X-CSRFToken':getCSRFToken()},
        body: JSON.stringify({path: pdfPath})
      });
      var d = await r.json();
      if (d.error) { showToast(d.error, 'error'); els.extractBtn.disabled = false; els.extractText.textContent = 'Extract'; return; }

      sentences = d.sentences;
      if (!sentences.length) { showToast('No text found', 'error'); els.extractBtn.disabled = false; els.extractText.textContent = 'Extract'; return; }

      if (d.ocrUsed) showToast('OCR applied (scanned PDF detected)', 'success');

      showToast(sentences.length + ' sentences extracted', 'success');
      renderSentences();
      els.transport.style.display = 'flex';
      enableTransport(true);
      els.exportBtn.disabled = false;
      els.searchBtn.disabled = false;
      els.audiobookBtn.disabled = false;
      els.extractBtn.disabled = false; els.extractText.textContent = 'Extract';

      if (window._savedPos !== undefined && window._savedPos < sentences.length) {
        cur = window._savedPos;
        updateUI();
        showToast('Resumed at sentence ' + (cur+1), 'success');
        delete window._savedPos;
      }
    } catch(e) {
      showToast('Extraction error: ' + e.message, 'error');
      els.extractBtn.disabled = false; els.extractText.textContent = 'Extract';
    }
  }
  els.extractBtn.addEventListener('click', extract);

  function renderSentences() {
    els.emptyState.style.display = 'none';
    els.textContainer.style.display = 'block';
    els.sentenceList.innerHTML = sentences.map(function(item, i) {
      return '<div class="sentence-item ' + (i===cur?'active':'') + ' ' + (i<cur?'done':'') + ' ' + (i < completedSentences ? 'completed' : '') + '" data-i="' + i + '" data-page="' + (item.page !== undefined ? item.page + 1 : '') + '">' +
        '<div style="display:flex;gap:8px;align-items:flex-start;">' +
          '<span style="flex-shrink:0;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;background:' + (i===cur?'rgba(255,255,255,0.2)':'var(--bg-glass)') + ';">' + (i+1) + '</span>' +
          '<div style="min-width:0;">' +
            (item.page !== undefined ? '<div style="font-size:11px;color:var(--text-tertiary);margin-bottom:2px;">pg ' + (item.page + 1) + '</div>' : '') +
            '<span>' + escapeHtml(item.text || item) + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
    els.sentenceList.querySelectorAll('.sentence-item').forEach(function(el) {
      el.addEventListener('click', function() { var idx = parseInt(el.dataset.i); goTo(idx); });
    });
    updateCounter();
  }

  function updateUI() {
    var items = els.sentenceList.querySelectorAll('.sentence-item');
    items.forEach(function(el,i) {
      el.className = 'sentence-item ' + (i===cur?'active':'') + ' ' + (i<cur?'done':'') + ' ' + (i < completedSentences ? 'completed' : '');
      var badge = el.querySelector('span');
      if (badge) badge.style.background = i===cur ? 'rgba(255,255,255,0.2)' : 'var(--bg-glass)';
    });
    var a = items[cur];
    if (a) {
      a.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var pageNum = parseInt(a.dataset.page);
      if (pageNum && !isNaN(pageNum)) goToPage(pageNum, true);
    }
    updateCounter();
    if (audio && playing) {
      els.scrubFill.style.transform = 'scaleX(0)';
      els.scrubFill.style.transition = 'none';
      requestAnimationFrame(function() {
        var text = getSentenceText(sentences[cur]);
        var dur = text ? Math.max(text.length * 0.05, 1) : 1;
        els.scrubFill.style.transition = 'transform ' + dur + 's linear';
        els.scrubFill.style.transform = 'scaleX(1)';
      });
    }
  }

  function getSentenceText(item) { return (item && item.text) ? item.text : (item || ''); }
  function updateCounter() { els.counter.textContent = sentences.length ? (cur+1) + ' / ' + sentences.length : '0 / 0'; }

  function goTo(idx) {
    if (idx < 0 || idx >= sentences.length) return;
    stop(); cur = idx; updateUI(); if (playing) play();
    savePosition();
  }

  async function savePosition() {
    if (!pdfPath || !sentences.length) return;
    try {
      await fetch('/api/save-position/', {
        method: 'POST',
        headers: {'Content-Type':'application/json','X-CSRFToken':getCSRFToken()},
        body: JSON.stringify({pdfPath: pdfPath, sentenceIndex: cur})
      });
    } catch(e) {}
  }

  async function saveProgress() {
    if (!pdfPath || !sentences.length) return;
    try {
      await fetch('/api/save-progress/', {
        method: 'POST',
        headers: {'Content-Type':'application/json','X-CSRFToken':getCSRFToken()},
        body: JSON.stringify({pdfPath: pdfPath, completed: completedSentences, total: sentences.length})
      });
    } catch(e) {}
  }

  function buildTtsUrl(text, voice) {
    return '/api/tts-stream/?text=' + encodeURIComponent(text) + '&voice=' + encodeURIComponent(voice || (els.voiceSelect && els.voiceSelect.value) || 'en-US-JennyNeural');
  }

  async function preloadNextAudio() {
    if (nextAudio) { nextAudio.src = ''; nextAudio = null; }
    var nextIdx = cur + 1;
    if (nextIdx >= sentences.length) return;
    var text = getSentenceText(sentences[nextIdx]);
    if (!text) return;
    nextAudio = new Audio(buildTtsUrl(text));
    nextAudio.volume = parseFloat(els.vol.value);
    nextAudio.playbackRate = parseFloat(els.speed.value);
    nextAudio.load();
  }

  let currentRequestId = 0;

  function play() {
    var text = getSentenceText(sentences[cur]);
    if (!text) { next(); return; }
    var voice = (els.voiceSelect && els.voiceSelect.value) ? els.voiceSelect.value : 'en-US-JennyNeural';
    stop(); // clears src, removes old handler, increments requestId
    var myId = currentRequestId;

    audio.onended = null; // clear any old handler
    audio.onerror = null;

    audio.src = '/api/tts-stream/?text=' + encodeURIComponent(text) + '&voice=' + encodeURIComponent(voice);
    audio.volume = parseFloat(els.vol.value) || 1;
    audio.playbackRate = parseFloat(els.speed.value) || 1;

    audio.onended = function() {
      if (myId !== currentRequestId) return;
      markCompleted(cur);
      next();
    };

    audio.onerror = function() {
      if (myId !== currentRequestId) return;
      showToast('Playback error: failed to load audio', 'error');
      playing = false;
      updatePlayIcon();
    };

    var playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(function(e) {
        if (myId !== currentRequestId) return;
        showToast('Playback failed: ' + (e.message || e), 'error');
        playing = false;
        updatePlayIcon();
      });
    }

    playing = true;
    updatePlayIcon();
    preloadNextAudio();
  }

  function stop() {
    currentRequestId++;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.src = '';
    if (nextAudio) { nextAudio.src = ''; nextAudio = null; }
  }

  function markCompleted(idx) {
    if (idx >= completedSentences) {
      completedSentences = idx + 1;
      updateProgress();
      var items = els.sentenceList.querySelectorAll('.sentence-item');
      if (items[idx]) items[idx].classList.add('completed');
      saveProgress();
    }
  }

  function togglePlay() {
    if (!sentences.length) return;
    if (playing) { playing = false; stop(); updatePlayIcon(); }
    else { play(); }
  }

  function next() {
    if (speedTrain && cur >= sentences.length - 1) { stopTrain(); }
    if (cur < sentences.length - 1) { cur++; updateUI(); if (playing) play(); }
    else { playing = false; cur = 0; updateUI(); stop(); updatePlayIcon(); }
  }

  function prev() { if (cur > 0) { stop(); cur--; updateUI(); if (playing) play(); } }
  function jumpF() { var n = Math.min(cur+5, sentences.length-1); stop(); cur = n; updateUI(); if (playing) play(); }
  function jumpB() { var n = Math.max(cur-5, 0); stop(); cur = n; updateUI(); if (playing) play(); }

  function updatePlayIcon() {
    els.playIcon.innerHTML = playing
      ? '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>'
      : '<path d="M8 5v14l11-7z"/>';
  }

  els.playBtn.addEventListener('click', togglePlay);
  els.skipF.addEventListener('click', next);
  els.skipB.addEventListener('click', prev);
  els.jumpF.addEventListener('click', jumpF);
  els.jumpB.addEventListener('click', jumpB);
  els.vol.addEventListener('input', function() { if (audio) audio.volume = parseFloat(els.vol.value); });
  els.speed.addEventListener('change', function() { if (audio) audio.playbackRate = parseFloat(els.speed.value); });

  els.trainBtn.addEventListener('click', function() {
    speedTrain = !speedTrain;
    els.trainBtn.style.borderColor = speedTrain ? 'var(--success)' : 'var(--border-subtle)';
    showToast(speedTrain ? 'Speed trainer ON' : 'Speed trainer OFF', speedTrain ? 'success' : '');
    if (speedTrain) startTrain(); else stopTrain();
  });

  function startTrain() {
    var interval = 0;
    trainTimer = setInterval(function() {
      interval++;
      if (interval % 3 === 0) {
        var speeds = [0.5,0.75,1,1.25,1.5,1.75,2,2.5,3];
        var current = parseFloat(els.speed.value);
        var idx = speeds.indexOf(current);
        if (idx < speeds.length - 1) {
          els.speed.value = speeds[idx + 1];
          if (audio) audio.playbackRate = speeds[idx + 1];
          showToast('Speed: ' + speeds[idx + 1] + '\u00d7', '');
        }
      }
    }, 15000);
  }

  function stopTrain() { if (trainTimer) { clearInterval(trainTimer); trainTimer = null; } }

  els.exportBtn.addEventListener('click', function() {
    if (!sentences.length) return;
    var b = new Blob([sentences.map(function(s) { return getSentenceText(s); }).join('\n\n')], {type:'text/plain'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = (pdfFileName || 'document').replace('.pdf','') + '.txt'; a.click();
    URL.revokeObjectURL(a.href);
    showToast('Text exported', 'success');
  });

  els.audiobookBtn.addEventListener('click', async function() {
    if (!sentences.length) return;
    var voice = els.voiceSelect.value;
    var chapters = sentences.filter(function(s, i) { return (s.text || s).match(/^chapter\s+\d+/i); }).map(function(s, i) { return { title: (s.text || s).trim(), sentenceIndex: sentences.indexOf(s), index: i }; });
    if (confirm('Export audiobook as ZIP? This will generate any missing audio files.')) {
      els.audiobookBtn.disabled = true;
      els.audiobookBtn.textContent = 'Generating...';
      try {
        var r = await fetch('/api/export-zip/', {
          method: 'POST',
          headers: {'Content-Type':'application/json','X-CSRFToken':getCSRFToken()},
          body: JSON.stringify({sentences: sentences, voice: voice, chapters: chapters})
        });
        var blob = await r.blob();
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (pdfFileName || 'audiobook').replace('.pdf', '') + '_audiobook.zip';
        a.click();
        URL.revokeObjectURL(a.href);
        showToast('Audiobook ZIP downloaded', 'success');
      } catch(e) { showToast('Export failed', 'error'); }
      els.audiobookBtn.disabled = false;
      els.audiobookBtn.textContent = 'Export Audiobook';
    }
  });

  els.searchBtn.addEventListener('click', function() {
    var q = prompt('Search text:');
    if (!q || !sentences.length) return;
    var idx = sentences.findIndex(function(s) { return getSentenceText(s).toLowerCase().includes(q.toLowerCase()); });
    if (idx >= 0) { goTo(idx); showToast('Found at sentence ' + (idx+1), 'success'); }
    else { showToast('Not found', 'error'); }
  });

  els.voiceSelect.addEventListener('change', function() {
    audioMap = {};
  });

  // PDF viewer dark mode (auto follow system, manual toggle overrides)
  var pdfDarkForce = null;
  function applyPdfTheme() {
    var dark = pdfDarkForce !== null ? pdfDarkForce : window.matchMedia('(prefers-color-scheme: dark)').matches;
    var viewer = els.pdfViewer;
    if (viewer) viewer.style.filter = dark ? 'invert(0.9) hue-rotate(180deg) saturate(0.8)' : 'none';
    if (els.pdfDarkToggle) els.pdfDarkToggle.style.borderColor = pdfDarkForce !== null && pdfDarkForce ? 'var(--accent)' : 'var(--border-subtle)';
  }
  applyPdfTheme();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyPdfTheme);
  els.pdfDarkToggle.addEventListener('click', function() {
    if (pdfDarkForce === null) pdfDarkForce = !window.matchMedia('(prefers-color-scheme: dark)').matches;
    else if (pdfDarkForce === true) pdfDarkForce = false;
    else pdfDarkForce = null;
    applyPdfTheme();
  });

  // Shortcuts modal
  els.shortcutsBtn.addEventListener('click', function() {
    els.shortcutsModal.style.display = 'flex';
  });
  els.closeShortcuts.addEventListener('click', function() {
    els.shortcutsModal.style.display = 'none';
  });
  els.shortcutsModal.addEventListener('click', function(e) {
    if (e.target === els.shortcutsModal) els.shortcutsModal.style.display = 'none';
  });

  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    else if (e.code === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.code === 'ArrowLeft') { e.preventDefault(); prev(); }
    else if (e.code === 'ArrowUp') { e.preventDefault(); jumpF(); }
    else if (e.code === 'ArrowDown') { e.preventDefault(); jumpB(); }
    else if (e.code === 'KeyS' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); togglePlay(); }
    else if (e.code === 'Slash' && !e.shiftKey) { e.preventDefault(); if (els.shortcutsModal) els.shortcutsModal.style.display = 'flex'; }
  });

  // Auto-load from URL param (at end so all functions are defined)
  var params = new URLSearchParams(window.location.search);
  if (params.get('path')) loadPdf(params.get('path'));
})();
