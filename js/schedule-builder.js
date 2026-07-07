/* ════════════════════════════════════════════════════════════
   TIMETABLE BUILDER  ·  js/schedule-builder.js
   ─────────────────────────────────────────────────────────
   TO REMOVE THIS FEATURE COMPLETELY:
     1. Delete this file
     2. Remove its <script> tag in index.html
     3. Remove <!-- TIMETABLE BUILDER MODAL --> in index.html
     4. Remove <!-- FIRST-TIME SETUP PROMPT --> in index.html
     5. Remove the sbOpenBtn + setupPromptBtn buttons in index.html
     6. Remove /* TIMETABLE BUILDER STYLES */ in css/style.css
   All other files stay untouched and work perfectly.
════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Universal block-type presets ─────────────────────────
     Deliberately generic so ANYONE (student, worker, parent,
     athlete…) can use them — not just a teacher.
  ──────────────────────────────────────────────────────── */
  const BLOCK_TYPES = [
    { value: 'study',  label: '📖 Study',    color: '#93c26a' },
    { value: 'work',   label: '💼 Work',     color: '#f4a935' },
    { value: 'health', label: '💪 Health',   color: '#6fb3c9' },
    { value: 'rest',   label: '😴 Rest',     color: '#b39ddb' },
    { value: 'meal',   label: '🍽 Meal',     color: '#e0835a' },
    { value: 'family', label: '🏠 Family',   color: '#e390ab' },
    { value: 'custom', label: '✏️ Custom…',  color: '#a6bcae' },
  ];

  function typeColor(t) {
    return (BLOCK_TYPES.find(x => x.value === t) || BLOCK_TYPES[6]).color;
  }

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, m =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  /* ── State ── */
  let draftBlocks = [];
  let dragSrcUid = null;

  /* ══════════════════════════════════════════════════════
     SETUP PROMPT — shown to brand-new users until they
     have saved their first custom schedule
  ══════════════════════════════════════════════════════ */
  window.updateSetupPrompt = function () {
    const prompt = document.getElementById('setupPrompt');
    if (!prompt) return;
    const hasSchedule = window.getScheduleTemplate &&
      window.getScheduleTemplate() !== (window._DEFAULT_BLOCKS_REF);
    /* show prompt only if state.schedule is explicitly null/undefined
       i.e. user has never built a custom schedule */
    const tpl = window.getScheduleTemplate ? window.getScheduleTemplate() : null;
    const hasCustom = tpl && tpl.some(b => b.id && b.id.startsWith('uid_'));
    /* simpler check: if localStorage has no schedule key, it's a new user */
    let isNew = true;
    try {
      const raw = localStorage.getItem('daily-board-v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        isNew = !(parsed && parsed.schedule && parsed.schedule.length);
      }
    } catch (e) {}
    prompt.style.display = isNew ? 'flex' : 'none';
  };

  /* ══════════════════════════════════════════════════════
     OPEN / CLOSE
  ══════════════════════════════════════════════════════ */
  function openBuilder() {
    const tpl = (window.getScheduleTemplate && window.getScheduleTemplate()) || [];
    draftBlocks = JSON.parse(JSON.stringify(tpl)).map((b, i) => ({
      ...b,
      _uid: b.id || ('uid_' + i + '_' + Date.now()),
      /* Preserve legacy type names from the original owner's schedule */
      type: mapLegacyType(b.type)
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

  /* Map old owner-specific type names to universal ones */
  function mapLegacyType(t) {
    const map = { teach: 'work', body: 'health', sleep: 'rest', other: 'custom' };
    return map[t] || t;
  }

  /* ══════════════════════════════════════════════════════
     RENDER BLOCK LIST
  ══════════════════════════════════════════════════════ */
  function renderList() {
    const list = document.getElementById('sb-list');
    list.innerHTML = '';

    if (!draftBlocks.length) {
      list.innerHTML = `
        <div class="sb-empty">
          <div style="font-size:36px;margin-bottom:10px">📋</div>
          <div>No blocks yet.</div>
          <div>Click <b>+ Add Block</b> below to start building your daily routine.</div>
        </div>`;
      return;
    }

    draftBlocks.forEach(b => {
      const isCustom = b.type === 'custom';
      const card = document.createElement('div');
      card.className = 'sb-card';
      card.draggable = true;
      card.dataset.uid = b._uid;

      card.innerHTML = `
        <div class="sb-type-bar" style="background:${typeColor(b.type)}"></div>
        <div class="sb-card-top">
          <span class="sb-drag" title="Drag to reorder">⠿</span>
          <select class="sb-type-sel" aria-label="Block type">
            ${BLOCK_TYPES.map(t =>
              `<option value="${t.value}"${b.type === t.value ? ' selected' : ''}>${t.label}</option>`
            ).join('')}
          </select>
          <input class="sb-custom-label${isCustom ? '' : ' sb-hidden'}"
                 value="${esc(b.typeLabel || '')}"
                 placeholder="e.g. Prayer, Gym, Cooking…"
                 maxlength="24"
                 aria-label="Custom category name">
          <input class="sb-time" value="${esc(b.time)}" placeholder="e.g. 6:00 – 8:00 AM" aria-label="Time">
          <button class="sb-del" title="Remove" aria-label="Remove block">×</button>
        </div>
        <div class="sb-card-bot">
          <input class="sb-title" value="${esc(b.title)}" placeholder="Block title (required)" aria-label="Title">
          <input class="sb-desc"  value="${esc(b.desc || '')}" placeholder="Short description (optional)" aria-label="Description">
        </div>
      `;

      /* Live field binding */
      const get = () => draftBlocks.find(x => x._uid === b._uid);
      const customLabelInp = card.querySelector('.sb-custom-label');

      card.querySelector('.sb-type-sel').addEventListener('change', e => {
        const val = e.target.value;
        get().type = val;
        card.querySelector('.sb-type-bar').style.background = typeColor(val);
        /* Show / hide custom label input */
        if (val === 'custom') {
          customLabelInp.classList.remove('sb-hidden');
          customLabelInp.focus();
        } else {
          customLabelInp.classList.add('sb-hidden');
          get().typeLabel = '';
        }
      });

      customLabelInp.addEventListener('input', e => { get().typeLabel = e.target.value; });
      card.querySelector('.sb-time').addEventListener('input',  e => { get().time  = e.target.value; });
      card.querySelector('.sb-title').addEventListener('input', e => { get().title = e.target.value; });
      card.querySelector('.sb-desc').addEventListener('input',  e => { get().desc  = e.target.value; });

      /* Delete */
      card.querySelector('.sb-del').addEventListener('click', () => {
        draftBlocks = draftBlocks.filter(x => x._uid !== b._uid);
        renderList();
      });

      /* ── Drag to reorder ── */
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

  /* ══════════════════════════════════════════════════════
     ADD / SAVE / RESET
  ══════════════════════════════════════════════════════ */
  function addBlock() {
    const uid = 'uid_' + Date.now();
    draftBlocks.push({ _uid: uid, id: uid, type: 'study', time: '', title: '', desc: '', sub: [], typeLabel: '' });
    renderList();
    setTimeout(() => {
      const last = document.querySelector('#sb-list .sb-card:last-child');
      if (last) {
        last.querySelector('.sb-title')?.focus();
        last.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 60);
  }

  function saveAndApply() {
    /* Sync DOM order */
    const uidOrder = [...document.querySelectorAll('#sb-list .sb-card')].map(c => c.dataset.uid);
    const map = Object.fromEntries(draftBlocks.map(b => [b._uid, b]));
    const ordered = uidOrder.map(u => map[u]).filter(Boolean);

    const cleaned = ordered
      .filter(b => b.title && b.title.trim())
      .map((b, i) => ({
        id: b.id || ('blk_' + i),
        type: b.type || 'study',
        typeLabel: (b.type === 'custom' && b.typeLabel) ? b.typeLabel.trim() : '',
        time: (b.time || '').trim(),
        title: b.title.trim(),
        desc: (b.desc || '').trim(),
        sub: b.sub || []
      }));

    if (!cleaned.length) {
      showErr('Add at least one block with a title before saving.');
      return;
    }

    if (window.saveScheduleTemplate) window.saveScheduleTemplate(cleaned);
    closeBuilder();
    if (window.updateSetupPrompt) window.updateSetupPrompt();
  }

  function resetToDefault() {
    if (!confirm('Reset to the built-in default schedule?\nYour custom schedule will be removed — all your logged data stays safe.')) return;
    if (window.saveScheduleTemplate) window.saveScheduleTemplate(null);
    closeBuilder();
    if (window.updateSetupPrompt) window.updateSetupPrompt();
  }

  function showErr(msg) {
    const el = document.getElementById('sb-err');
    if (el) { el.textContent = msg; setTimeout(() => { el.textContent = ''; }, 3500); }
  }

  /* ══════════════════════════════════════════════════════
     BOOT — wire all buttons
  ══════════════════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', () => {
    /* Builder open buttons */
    document.getElementById('sbOpenBtn')?.addEventListener('click', openBuilder);
    document.getElementById('setupPromptBtn')?.addEventListener('click', openBuilder);

    /* Builder close / cancel */
    document.getElementById('sb-close')?.addEventListener('click', closeBuilder);
    document.getElementById('sb-cancel')?.addEventListener('click', closeBuilder);

    /* Builder actions */
    document.getElementById('sb-add-block')?.addEventListener('click', addBlock);
    document.getElementById('sb-save')?.addEventListener('click', saveAndApply);
    document.getElementById('sb-reset')?.addEventListener('click', resetToDefault);

    /* Close on backdrop click */
    document.getElementById('sb-modal')?.addEventListener('click', e => {
      if (e.target.id === 'sb-modal') closeBuilder();
    });

    /* Escape key */
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && document.getElementById('sb-modal')?.classList.contains('open')) closeBuilder();
    });

    /* Initial prompt check (delayed so app.js has time to load state) */
    setTimeout(() => { if (window.updateSetupPrompt) window.updateSetupPrompt(); }, 300);
  });

})();
