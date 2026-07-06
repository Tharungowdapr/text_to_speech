(function() {
  let sentences = [], cur = 0, playing = false, audioMap = {};

  const els = {
    textarea: document.getElementById('ttsTextarea'),
    playBtn: document.getElementById('playTTS'), playIcon: document.getElementById('playTTSIcon'),
    skipB: document.getElementById('skipBackTTS'), skipF: document.getElementById('skipFwdTTS'),
    jumpB: document.getElementById('jumpBackTTS'), jumpF: document.getElementById('jumpFwdTTS'),
    vol: document.getElementById('volumeTTS'), speed: document.getElementById('speedTTS'),
    saveBtn: document.getElementById('saveTextBtn'), savedBtn: document.getElementById('savedBtn'),
    exportBtn: document.getElementById('exportTTSBtn'), savedCount: document.getElementById('savedCount'),
    textContainer: document.getElementById('ttsTextContainer'), emptyState: document.getElementById('ttsEmptyState'),
    sentenceList: document.getElementById('ttsSentenceList'), counter: document.getElementById('sentenceCounterTTS'),
    scrubFill: document.getElementById('scrubberFillTTS'),
    voiceSelect: document.getElementById('voiceSelectTTS'),
    savedModal: document.getElementById('savedModal'), savedTextList: document.getElementById('savedTextList'),
    closeModal: document.getElementById('closeSavedModal'),
    generateBtn: document.getElementById('generateAllTTS'),
    batchProgress: document.getElementById('batchProgressTTS'),
    batchProgressBar: document.getElementById('batchProgressBarTTS'),
  };

  loadVoiceSelect(els.voiceSelect, 'en-US-JennyNeural');

  function parseSentences(text) {
    return text.replace(/([.!?])\s+/g,'$1|').replace(/([.!?])([A-Z])/g,'$1|$2').split('|').map(s=>s.trim()).filter(s=>s.length>0);
  }

  const audio = new Audio();

  els.textarea.addEventListener('input', () => {
    const t = els.textarea.value.trim();
    sentences = t ? parseSentences(t) : [];
    render();
    els.saveBtn.disabled = !t;
    els.exportBtn.disabled = !t;
    els.generateBtn.disabled = !sentences.length;
    els.playBtn.disabled = !sentences.length;
    enableTransport(!sentences.length);
  });

  function enableTransport(dis) {
    [els.playBtn, els.skipB, els.skipF, els.jumpB, els.jumpF].forEach(b => b.disabled = dis);
  }

  function render() {
    if (sentences.length) {
      els.emptyState.style.display = 'none';
      els.textContainer.style.display = 'block';
      els.sentenceList.innerHTML = sentences.map((s,i) =>
        `<div class="sentence-item ${i===cur?'active':''} ${i<cur?'done':''}" data-i="${i}">
          <div style="display:flex;gap:8px;align-items:flex-start;">
            <span style="flex-shrink:0;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;background:${i===cur?'rgba(255,255,255,0.2)':'var(--bg-glass)'};">${i+1}</span>
            <span>${escapeHtml(s)}</span>
          </div>
        </div>`
      ).join('');
      els.sentenceList.querySelectorAll('.sentence-item').forEach(el => {
        el.addEventListener('click', () => { const idx = parseInt(el.dataset.i); goTo(idx); });
      });
    } else {
      els.textContainer.style.display = 'none';
      els.emptyState.style.display = 'flex';
    }
    updateCounter();
  }

  function updateUI() {
    const items = els.sentenceList.querySelectorAll('.sentence-item');
    items.forEach((el,i) => {
      el.className = `sentence-item ${i===cur?'active':''} ${i<cur?'done':''}`;
      const badge = el.querySelector('span');
      if (badge) badge.style.background = i===cur ? 'rgba(255,255,255,0.2)' : 'var(--bg-glass)';
    });
    const a = items[cur];
    if (a) a.scrollIntoView({ behavior: 'smooth', block: 'center' });
    updateCounter();
  }

  function updateCounter() { els.counter.textContent = sentences.length ? `${cur+1} / ${sentences.length}` : '0 / 0'; }

  function goTo(idx) {
    if (idx < 0 || idx >= sentences.length) return;
    stop(); cur = idx; updateUI(); if (playing) play();
  }

  // Batch pre-generate all audio
  els.generateBtn.addEventListener('click', async () => {
    if (!sentences.length) return;
    const voice = els.voiceSelect.value;
    els.generateBtn.disabled = true;
    els.generateBtn.textContent = 'Generating...';
    if (els.batchProgress) els.batchProgress.style.display = 'block';
    try {
      const r = await fetch('/api/tts-batch/', {
        method: 'POST',
        headers: {'Content-Type':'application/json','X-CSRFToken':getCSRFToken()},
        body: JSON.stringify({texts: sentences, voice: voice})
      });
      const d = await r.json();
      audioMap = d.mapping || {};
      if (els.batchProgress) {
        els.batchProgress.style.display = 'none';
        els.batchProgressBar.style.width = '0%';
      }
      showToast(Object.keys(audioMap).length + ' audio files ready', 'success');
    } catch(e) {
      if (els.batchProgress) els.batchProgress.style.display = 'none';
      showToast('Generation failed (playback will generate on-demand)', 'error');
    }
    els.generateBtn.disabled = false;
    els.generateBtn.textContent = 'Generate All Audio';
  });

  // Re-generate on voice change
  els.voiceSelect.addEventListener('change', () => {
    audioMap = {};
  });

  let currentPlayId = 0;

  async function play() {
    const text = sentences[cur];
    if (!text) { next(); return; }
    try {
      const voice = els.voiceSelect.value;
      stop();
      currentPlayId++;
      const reqId = currentPlayId;
      els.playIcon.innerHTML = '<div class="spinner" style="width:16px;height:16px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;"></div>';

      audio.src = '/api/tts-stream/?text=' + encodeURIComponent(text) + '&voice=' + encodeURIComponent(voice);
      audio.volume = parseFloat(els.vol.value) || 1;
      audio.playbackRate = parseFloat(els.speed.value) || 1;

      audio.play().catch((e) => {
        if (reqId !== currentPlayId) return;
        showToast('Audio playback failed: ' + (e.message || 'unknown error'), 'error');
        playing = false;
        updatePlayIcon();
      });

      audio.addEventListener('ended', () => next());
      playing = true;
      updatePlayIcon();
    } catch(e) { showToast('Playback error', 'error'); playing = false; updatePlayIcon(); }
  }

  function stop() { audio.pause(); audio.src = ''; }

  function togglePlay() {
    if (!sentences.length) return;
    if (playing) { playing = false; stop(); updatePlayIcon(); }
    else { play(); }
  }

  function next() {
    if (cur < sentences.length - 1) { cur++; updateUI(); if (playing) play(); }
    else { playing = false; cur = 0; updateUI(); stop(); updatePlayIcon(); }
  }

  function prev() { if (cur > 0) { stop(); cur--; updateUI(); if (playing) play(); } }
  function jumpF() { const n = Math.min(cur+5, sentences.length-1); stop(); cur = n; updateUI(); if (playing) play(); }
  function jumpB() { const n = Math.max(cur-5, 0); stop(); cur = n; updateUI(); if (playing) play(); }

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
  els.vol.addEventListener('input', () => { if (audio) audio.volume = parseFloat(els.vol.value); });
  els.speed.addEventListener('change', () => { if (audio) audio.playbackRate = parseFloat(els.speed.value); });

  els.saveBtn.addEventListener('click', async () => {
    const text = els.textarea.value.trim();
    if (!text) return;
    const title = prompt('Title for this text:');
    if (!title) return;
    const r = await fetch('/api/save-text/', {
      method: 'POST',
      headers: {'Content-Type':'application/json','X-CSRFToken':getCSRFToken()},
      body: JSON.stringify({title, content: text})
    });
    const d = await r.json();
    if (d.ok) { els.savedCount.textContent = d.count; showToast('Text saved', 'success'); }
  });

  els.savedBtn.addEventListener('click', async () => {
    const r = await fetch('/api/get-texts/');
    const texts = await r.json();
    els.savedCount.textContent = texts.length;
    els.savedTextList.innerHTML = texts.length
      ? texts.map(t => `
        <div class="card" style="margin-bottom:8px;padding:12px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
            <span style="font-weight:600;font-size:13px;">${escapeHtml(t.title)}</span>
            <div style="display:flex;gap:4px;">
              <button class="btn btn-accent" style="padding:2px 8px;font-size:11px;" onclick="window.loadText('${t.id}')">Load</button>
              <button class="btn" style="padding:2px 8px;font-size:11px;" onclick="window.delText('${t.id}')">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>
          </div>
          <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:4px;">${t.createdAt.slice(0,10)}</div>
          <div style="font-size:12px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(t.content.substring(0,120))}</div>
        </div>`).join('')
      : '<div style="text-align:center;padding:28px;color:var(--text-tertiary);">No saved texts</div>';
    els.savedModal.style.display = 'flex';
  });

  window.loadText = async (id) => {
    const r = await fetch('/api/get-texts/');
    const texts = await r.json();
    const t = texts.find(x => x.id === id);
    if (t) { els.textarea.value = t.content; els.textarea.dispatchEvent(new Event('input')); els.savedModal.style.display = 'none'; showToast('Text loaded', 'success'); }
  };
  window.delText = async (id) => {
    if (!confirm('Delete this saved text?')) return;
    await fetch('/api/delete-text/' + id + '/', { method: 'DELETE', headers: {'X-CSRFToken': getCSRFToken()} });
    els.savedBtn.click();
  };

  els.closeModal.addEventListener('click', () => els.savedModal.style.display = 'none');
  els.savedModal.addEventListener('click', e => { if (e.target === els.savedModal) els.savedModal.style.display = 'none'; });

  els.exportBtn.addEventListener('click', () => {
    const t = els.textarea.value.trim();
    if (!t) return;
    const b = new Blob([t], {type:'text/plain'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = 'text.txt'; a.click();
    URL.revokeObjectURL(a.href);
    showToast('Text exported', 'success');
  });

  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    else if (e.code === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.code === 'ArrowLeft') { e.preventDefault(); prev(); }
  });
})();