function getCSRFToken() {
  const m = document.cookie.match(new RegExp('(^| )csrftoken=([^;]+)'));
  return m ? decodeURIComponent(m[2]) : '';
}

function showToast(msg, type) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.style.background = type === 'error' ? 'rgba(255,69,58,0.9)' : type === 'success' ? 'rgba(48,209,88,0.9)' : 'rgba(0,0,0,0.85)';
  el.className = 'toast show';
  clearTimeout(el._hide);
  el._hide = setTimeout(() => { el.className = 'toast'; }, 2500);
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function loadVoiceSelect(selectEl, selectedId) {
  fetch('/api/voices/').then(r => r.json()).then(voices => {
    const groups = {};
    Object.entries(voices).forEach(([id, v]) => {
      const lang = (v.lang || id.split('-').slice(0,2).join('-') || 'other');
      if (!groups[lang]) groups[lang] = [];
      groups[lang].push({id, name: v.name});
    });
    selectEl.innerHTML = Object.entries(groups).sort().map(([lang, vlist]) =>
      `<optgroup label="${lang}">${vlist.map(v =>
        `<option value="${v.id}" ${v.id === (selectedId || 'en-US-JennyNeural') ? 'selected' : ''}>${v.name}</option>`
      ).join('')}</optgroup>`
    ).join('');
  });
}
