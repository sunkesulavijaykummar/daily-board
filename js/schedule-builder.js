/* ════════════════════════════════════════════════════════════
   TIMETABLE BUILDER  ·  js/schedule-builder.js
   ─────────────────────────────────────────────────────────
   HOW TO REMOVE THIS FEATURE COMPLETELY:
     1. Delete this file (js/schedule-builder.js)
     2. Remove its <script> tag in index.html
     3. Remove the <!-- TIMETABLE BUILDER MODAL --> block in index.html
     4. Remove the "Setup Schedule" button from sec-h-row in index.html
     5. Remove the TIMETABLE BUILDER STYLES section from css/style.css
   Everything else (app.js, firebase.js) stays untouched.
════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const BLOCK_TYPES = [
    { value: 'study', label: '📖 Study',  color: '#93c26a' },
    { value: 'teach', label: '🎓 Teach',  color: '#f4a935' },
    { value: 'body',  label: '💪 Body',   color: '#6fb3c9' },
    { value: 'sleep', label: '😴 Sleep',  color: '#b39ddb' },
    { value: 'other', label: '⚙ Other',  color: '#a6bcae' },
  ];

  function typeColor(t) {
    return (BLOCK_TYPES.find(x => x.value === t) || BLOCK_TYPES[4]).color;
  }

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, m =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  let draftBlocks = [];
  let dragSrcUid = null;

  function openBuilder() {
    const tpl = (window.getScheduleTemplate && window.getScheduleTemplate()) || [];
    draftBlocks = JSON.parse(JSON.stringify(tpl)).map((b, i) => ({
      ...b, _uid: b.id || ('uid_' + i + '_' + Date.now())
    }));
    renderList();
    document.getElementById('sb-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeBuilder() {
    document.getElementById('sb-modal').classList.remove('open');
    document.body.style.overflow = '';
    dragSrcUid = null;
  }

  function renderList() {
    const list = document.getElementById('sb-list');
    list.innerHTML = '';
    if (!draftBlocks.length) {
      list.innerHTML = '<div class="sb-empty">No blocks yet — click <b>+ Add Block</b> below to start building your schedule.</div>';
      return;
    }
    draftBlocks.forEach(b => {
      const card = document.createElement('div');
      card.className = 'sb-card';
      card.draggable = true;
      card.dataset.uid = b._uid;
      card.innerHTML = `
        <div class="sb-type-bar" style="background:${typeColor(b.type)}"></div>
        <div class="sb-card-top">
          <span class="sb-drag" title="Drag to reorder">⠿</span>
          <select class="sb-type-sel" aria-label="Block type">
            ${BLOCK_TYPES.map(t => `<option value="${t.value}"${b.type===t.value?' selected':''}>${t.label}</option>`).join('')}
          </select>
          <input class="sb-time" value="${esc(b.time)}" placeholder="e.g. 6:00 – 8:00 AM" aria-label="Time">
          <button class="sb-del" title="Remove" aria-label="Remove block">×</button>
        </div>
        <div class="sb-card-bot">
          <input class="sb-title" value="${esc(b.title)}" placeholder="Block title (required)" aria-label="Title">
          <input class="sb-desc"  value="${esc(b.desc||'')}" placeholder="Description (optional)" aria-label="Description">
        </div>
      `;
      const get = () => draftBlocks.find(x => x._uid === b._uid);
      card.querySelector('.sb-type-sel').addEventListener('change', e => {
        get().type = e.target.value;
        card.querySelector('.sb-type-bar').style.background = typeColor(e.target.value);
      });
      card.querySelector('.sb-time').addEventListener('input',  e => { get().time  = e.target.value; });
      card.querySelector('.sb-title').addEventListener('input', e => { get().title = e.target.value; });
      card.querySelector('.sb-desc').addEventListener('input',  e => { get().desc  = e.target.value; });
      card.querySelector('.sb-del').addEventListener('click', () => {
        draftBlocks = draftBlocks.filter(x => x._uid !== b._uid);
        renderList();
      });
      card.addEventListener('dragstart', e => {
        dragSrcUid = b._uid;
        card.classList.add('sb-dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragover', e => {
        e.preventDefault();
        if (!dragSrcUid || card.dataset.uid === dragSrcUid) return;
        list.querySelectorAll('.sb-card').forEach(c => c.classList.remove('sb-over'));
        card.classList.add('sb-over');
        const src = list.querySelector(`[data-uid="${dragSrcUid}"]`);
        if (!src) return;
        const cards = [...list.querySelectorAll('.sb-card')];
        if (cards.indexOf(src) < cards.indexOf(card)) list.insertBefore(src, card.nextSibling);
        else list.insertBefore(src, card);
      });
      card.addEventListener('dragleave', () => card.classList.remove('sb-over'));
      card.addEventListener('dragend', () => {
        card.classList.remove('sb-dragging');
        list.querySelectorAll('.sb-card').forEach(c => c.classList.remove('sb-over'));
        const uidOrder = [...list.querySelectorAll('.sb-card')].map(c => c.dataset.uid);
        const map = Object.fromEntries(draftBlocks.map(b => [b._uid, b]));
        draftBlocks = uidOrder.map(u => map[u]).filter(Boolean);
        dragSrcUid = null;
        renderList();
      });
      list.appendChild(card);
    });
  }

  function addBlock() {
    const uid = 'uid_' + Date.now();
    draftBlocks.push({ _uid: uid, id: uid, type: 'study', time: '', title: '', desc: '', sub: [] });
    renderList();
    setTimeout(() => {
      const last = document.querySelector('#sb-list .sb-card:last-child');
      if (last) { last.querySelector('.sb-title')?.focus(); last.scrollIntoView({ behavior:'smooth', block:'nearest' }); }
    }, 60);
  }

  function saveAndApply() {
    const uidOrder = [...document.querySelectorAll('#sb-list .sb-card')].map(c => c.dataset.uid);
    const map = Object.fromEntries(draftBlocks.map(b => [b._uid, b]));
    const cleaned = uidOrder.map(u => map[u]).filter(b => b && b.title && b.title.trim())
      .map((b, i) => ({ id: b.id||('blk_'+i), type:b.type||'study', time:(b.time||'').trim(), title:b.title.trim(), desc:(b.desc||'').trim(), sub:b.sub||[] }));
    if (!cleaned.length) {
      const err = document.getElementById('sb-err'); if(err) { err.textContent='Add at least one block with a title.'; setTimeout(()=>err.textContent='',3000); } return;
    }
    if (window.saveScheduleTemplate) window.saveScheduleTemplate(cleaned);
    closeBuilder();
  }

  function resetToDefault() {
    if (!confirm('Reset to the built-in default schedule?\nYour custom schedule will be removed — all your logged data stays safe.')) return;
    if (window.saveScheduleTemplate) window.saveScheduleTemplate(null);
    closeBuilder();
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('sbOpenBtn')?.addEventListener('click', openBuilder);
    document.getElementById('sb-close')?.addEventListener('click', closeBuilder);
    document.getElementById('sb-cancel')?.addEventListener('click', closeBuilder);
    document.getElementById('sb-add-block')?.addEventListener('click', addBlock);
    document.getElementById('sb-save')?.addEventListener('click', saveAndApply);
    document.getElementById('sb-reset')?.addEventListener('click', resetToDefault);
    document.getElementById('sb-modal')?.addEventListener('click', e => { if (e.target.id === 'sb-modal') closeBuilder(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('sb-modal')?.classList.contains('open')) closeBuilder(); });
  });
})();
