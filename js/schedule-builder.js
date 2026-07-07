/* ════════════════════════════════════════════════════════════
   TIMETABLE BUILDER  ·  js/schedule-builder.js
   ─────────────────────────────────────────────────────────
   TO REMOVE THIS FEATURE COMPLETELY:
     1. Delete this file
     2. Remove its <script> tag in index.html
     3. Remove <!-- TIMETABLE BUILDER MODAL --> in index.html
     4. Remove <!-- FIRST-TIME SETUP PROMPT --> in index.html
     5. Remove sbOpenBtn + setupPromptBtn buttons in index.html
     6. Remove /* TIMETABLE BUILDER STYLES */ in css / style.css
════════════════════════════════════════════════════════════ */
  (function () {
    'use strict';

    /* ── Universal block types — for ANY person, not just a teacher ── */
    var BLOCK_TYPES = [
      { value: 'study', label: '📖 Study', color: '#93c26a' },
      { value: 'work', label: '💼 Work', color: '#f4a935' },
      { value: 'health', label: '💪 Health', color: '#6fb3c9' },
      { value: 'rest', label: '😴 Rest', color: '#b39ddb' },
      { value: 'meal', label: '🍽 Meal', color: '#e0835a' },
      { value: 'family', label: '🏠 Family', color: '#e390ab' },
      { value: 'custom', label: '✏️ Custom…', color: '#a6bcae' },
    ];

    function typeColor(t) {
      var match = BLOCK_TYPES.find(function (x) { return x.value === t; });
      return match ? match.color : '#a6bcae';
    }

    function esc(s) {
      return String(s || '').replace(/[&<>"']/g, function (m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
      });
    }

    var draftBlocks = [];
    var dragSrcUid = null;

    /* ══════════════════════════════════════════════════════
       SETUP PROMPT VISIBILITY
       Show the golden "Build your schedule" banner for new
       users; hide it once they've saved a schedule.
    ══════════════════════════════════════════════════════ */
    window.updateSetupPrompt = function () {
      var prompt = document.getElementById('setupPrompt');
      if (!prompt) return;
      var isNew = window.isNewUser ? window.isNewUser() : false;
      prompt.style.display = isNew ? 'flex' : 'none';
    };

    /* ══════════════════════════════════════════════════════
       OPEN / CLOSE
    ══════════════════════════════════════════════════════ */
    function openBuilder() {
      var tpl = (window.getScheduleTemplate && window.getScheduleTemplate()) || [];
      draftBlocks = JSON.parse(JSON.stringify(tpl)).map(function (b, i) {
        return Object.assign({}, b, {
          _uid: b.id || ('uid_' + i + '_' + Date.now()),
          type: mapLegacyType(b.type),
          typeLabel: b.typeLabel || ''
        });
      });
      renderList();
      var modal = document.getElementById('sb-modal');
      if (modal) modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function closeBuilder() {
      var modal = document.getElementById('sb-modal');
      if (modal) modal.classList.remove('open');
      document.body.style.overflow = '';
      dragSrcUid = null;
    }

    /* Map old owner-specific names → universal ones */
    function mapLegacyType(t) {
      var map = { teach: 'work', body: 'health', sleep: 'rest', other: 'custom' };
      return map[t] || t || 'study';
    }

    /* ══════════════════════════════════════════════════════
       RENDER BLOCK LIST
    ══════════════════════════════════════════════════════ */
    function renderList() {
      var list = document.getElementById('sb-list');
      if (!list) return;
      list.innerHTML = '';

      if (!draftBlocks.length) {
        list.innerHTML = [
          '<div class="sb-empty">',
          '  <div style="font-size:36px;margin-bottom:10px">📋</div>',
          '  <div style="font-weight:700;color:var(--chalk);margin-bottom:6px">Your schedule is empty</div>',
          '  <div>Click <b>+ Add Block</b> below to build your daily routine.<br>',
          '  Add blocks for anything — work, study, meals, gym, family time…</div>',
          '</div>'
        ].join('');
        return;
      }

      draftBlocks.forEach(function (b) {
        var isCustom = b.type === 'custom';
        var card = document.createElement('div');
        card.className = 'sb-card';
        card.draggable = true;
        card.dataset.uid = b._uid;

        card.innerHTML = [
          '<div class="sb-type-bar" style="background:' + typeColor(b.type) + '"></div>',
          '<div class="sb-card-top">',
          '  <span class="sb-drag" title="Drag to reorder">⠿</span>',
          '  <select class="sb-type-sel" aria-label="Block type">',
          BLOCK_TYPES.map(function (t) {
            return '<option value="' + t.value + '"' + (b.type === t.value ? ' selected' : '') + '>' + t.label + '</option>';
          }).join(''),
          '  </select>',
          '  <input class="sb-custom-label' + (isCustom ? '' : ' sb-hidden') + '"',
          '         value="' + esc(b.typeLabel || '') + '"',
          '         placeholder="e.g. Prayer, Gym, Cooking…"',
          '         maxlength="24" aria-label="Custom type label">',
          '  <input class="sb-time" value="' + esc(b.time) + '" placeholder="e.g. 6:00 – 8:00 AM" aria-label="Time">',
          '  <button class="sb-del" title="Remove block" aria-label="Remove block">×</button>',
          '</div>',
          '<div class="sb-card-bot">',
          '  <input class="sb-title" value="' + esc(b.title) + '" placeholder="Block title (required)" aria-label="Title">',
          '  <input class="sb-desc" value="' + esc(b.desc || '') + '" placeholder="Short description (optional)" aria-label="Description">',
          '</div>'
        ].join('');

        /* Helper to get the live block object */
        function getB() {
          return draftBlocks.find(function (x) { return x._uid === b._uid; });
        }

        var customLabelInp = card.querySelector('.sb-custom-label');

        card.querySelector('.sb-type-sel').addEventListener('change', function (e) {
          var val = e.target.value;
          getB().type = val;
          card.querySelector('.sb-type-bar').style.background = typeColor(val);
          if (val === 'custom') {
            customLabelInp.classList.remove('sb-hidden');
            customLabelInp.focus();
          } else {
            customLabelInp.classList.add('sb-hidden');
            getB().typeLabel = '';
          }
        });

        customLabelInp.addEventListener('input', function (e) { getB().typeLabel = e.target.value; });
        card.querySelector('.sb-time').addEventListener('input', function (e) { getB().time = e.target.value; });
        card.querySelector('.sb-title').addEventListener('input', function (e) { getB().title = e.target.value; });
        card.querySelector('.sb-desc').addEventListener('input', function (e) { getB().desc = e.target.value; });

        card.querySelector('.sb-del').addEventListener('click', function () {
          draftBlocks = draftBlocks.filter(function (x) { return x._uid !== b._uid; });
          renderList();
        });

        /* ── Drag to reorder ── */
        card.addEventListener('dragstart', function (e) {
          dragSrcUid = b._uid;
          card.classList.add('sb-dragging');
          e.dataTransfer.effectAllowed = 'move';
        });
        card.addEventListener('dragover', function (e) {
          e.preventDefault();
          if (!dragSrcUid || card.dataset.uid === dragSrcUid) return;
          list.querySelectorAll('.sb-card').forEach(function (c) { c.classList.remove('sb-over'); });
          card.classList.add('sb-over');
          var src = list.querySelector('[data-uid="' + dragSrcUid + '"]');
          if (!src) return;
          var cards = Array.from(list.querySelectorAll('.sb-card'));
          if (cards.indexOf(src) < cards.indexOf(card)) list.insertBefore(src, card.nextSibling);
          else list.insertBefore(src, card);
        });
        card.addEventListener('dragleave', function () { card.classList.remove('sb-over'); });
        card.addEventListener('dragend', function () {
          card.classList.remove('sb-dragging');
          list.querySelectorAll('.sb-card').forEach(function (c) { c.classList.remove('sb-over'); });
          var uidOrder = Array.from(list.querySelectorAll('.sb-card')).map(function (c) { return c.dataset.uid; });
          var map = {};
          draftBlocks.forEach(function (b) { map[b._uid] = b; });
          draftBlocks = uidOrder.map(function (u) { return map[u]; }).filter(Boolean);
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
      var uid = 'uid_' + Date.now();
      draftBlocks.push({ _uid: uid, id: uid, type: 'study', time: '', title: '', desc: '', sub: [], typeLabel: '' });
      renderList();
      setTimeout(function () {
        var last = document.querySelector('#sb-list .sb-card:last-child');
        if (last) {
          var inp = last.querySelector('.sb-title');
          if (inp) inp.focus();
          last.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 60);
    }

    function saveAndApply() {
      /* Sync order from DOM */
      var uidOrder = Array.from(document.querySelectorAll('#sb-list .sb-card')).map(function (c) { return c.dataset.uid; });
      var map = {};
      draftBlocks.forEach(function (b) { map[b._uid] = b; });

      var cleaned = uidOrder.map(function (u) { return map[u]; }).filter(function (b) {
        return b && b.title && b.title.trim();
      }).map(function (b, i) {
        return {
          id: b.id || ('blk_' + i),
          type: b.type || 'study',
          typeLabel: (b.type === 'custom' && b.typeLabel) ? b.typeLabel.trim() : '',
          time: (b.time || '').trim(),
          title: b.title.trim(),
          desc: (b.desc || '').trim(),
          sub: b.sub || []
        };
      });

      if (!cleaned.length) {
        showErr('Add at least one block with a title before saving.');
        return;
      }

      if (window.saveScheduleTemplate) window.saveScheduleTemplate(cleaned);
      closeBuilder();
      if (window.updateSetupPrompt) window.updateSetupPrompt();
    }

    function resetToDefault() {
      if (!confirm('Reset to the built-in default schedule?\nYour custom schedule will be removed — logged data stays safe.')) return;
      if (window.saveScheduleTemplate) window.saveScheduleTemplate(null);
      closeBuilder();
      if (window.updateSetupPrompt) window.updateSetupPrompt();
    }

    function showErr(msg) {
      var el = document.getElementById('sb-err');
      if (el) { el.textContent = msg; setTimeout(function () { el.textContent = ''; }, 3500); }
    }

    /* ══════════════════════════════════════════════════════
       BOOT — bulletproof: works whether DOM is ready or not
    ══════════════════════════════════════════════════════ */
    function init() {
      var on = function (id, ev, fn) {
        var el = document.getElementById(id);
        if (el) el.addEventListener(ev, fn);
      };

      on('sbOpenBtn', 'click', openBuilder);
      on('setupPromptBtn', 'click', openBuilder);
      on('sb-close', 'click', closeBuilder);
      on('sb-cancel', 'click', closeBuilder);
      on('sb-add-block', 'click', addBlock);
      on('sb-save', 'click', saveAndApply);
      on('sb-reset', 'click', resetToDefault);

      var modal = document.getElementById('sb-modal');
      if (modal) {
        modal.addEventListener('click', function (e) {
          if (e.target === modal) closeBuilder();
        });
      }

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal && modal.classList.contains('open')) closeBuilder();
      });

      if (window.updateSetupPrompt) window.updateSetupPrompt();
    }

    /* Safe init: if DOM already parsed, run immediately; otherwise wait */
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }

    /* Also run after app.js has had time to set up state */
    window.addEventListener('load', function () {
      if (window.updateSetupPrompt) window.updateSetupPrompt();
    });

  })();
