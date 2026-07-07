    "use strict";

    /* ── persistence ── */
    const KEY = "daily-board-v1";
    function load() { try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
    function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { } if (window.saveToCloud) window.saveToCloud(state); }

    /* ── timetable ── */
    const BLOCKS = [
      { id: "gym", time: "5:30 – 7:30 AM", type: "body", title: "Gym & personal care", desc: "Move first — protects everything after it." },
      { id: "fresh", time: "7:30 – 8:00 AM", type: "body", title: "Freshen up & breakfast", desc: "Fuel before you teach." },
      { id: "prep", time: "8:00 – 8:45 AM", type: "teach", title: "Prepare for class", desc: "Quick prep for all three grades." },
      {
        id: "school", time: "8:45 – 11:45 AM", type: "teach", title: "School — teaching", desc: "Travel, teach, travel back.",
        sub: [["Travel", "8:45"], ["Class 8th", "9:00"], ["Class 9th", "9:45"], ["Class 10th", "10:30"], ["Travel", "11:30"]]
      },
      { id: "lunch", time: "11:45 – 1:00 PM", type: "body", title: "Lunch & reset", desc: "Eat, breathe, small tasks." },
      { id: "study", time: "1:00 – 10:00 PM", type: "study", title: "Study block — listen & read", desc: "Log sessions below. 10–15 min break each hour." },
      { id: "relax", time: "10:00 – 11:00 PM", type: "body", title: "Wind down & other works", desc: "Close open loops for tomorrow." },
      { id: "sleep", time: "11:15 – 5:15 AM", type: "sleep", title: "Sleep", desc: "Scheduled 6h — protect it, or shift lights-out earlier for 7." },
    ];

    const CHALK = ["#f4a935", "#6fb3c9", "#93c26a", "#e390ab", "#b39ddb", "#e0835a"];
    const DEFAULT_SUBJECTS = [
      { id: "s1", name: "Core Study", color: "#f4a935", target: 4 },
      { id: "s2", name: "Skill Track", color: "#6fb3c9", target: 2 },
      { id: "s3", name: "Revision", color: "#93c26a", target: 1 },
    ];

    /* ── state ── */
    let state = load() || { subjects: JSON.parse(JSON.stringify(DEFAULT_SUBJECTS)), logs: {} };
    if (!state.subjects || !state.subjects.length) state.subjects = JSON.parse(JSON.stringify(DEFAULT_SUBJECTS));
    if (!state.logs) state.logs = {};
    let viewDate = iso(new Date());

    /* ── date helpers ── */
    function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
    function parse(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
    function addDays(s, n) { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
    const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const DOWS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    function fmtLong(s) { const d = parse(s); return DOW[d.getDay()] + ", " + d.getDate() + " " + MON[d.getMonth()] + " " + d.getFullYear(); }
    function weekStart(s) { const d = parse(s); const off = (d.getDay() + 6) % 7; d.setDate(d.getDate() - off); return iso(d); }
    function shiftMonth(s, n) { const d = parse(s); d.setDate(1); d.setMonth(d.getMonth() + n); return iso(d); }
    function fmtRange(a, b) { const da = parse(a), db = parse(b); return da.getDate() + " " + MON[da.getMonth()].slice(0, 3) + " – " + db.getDate() + " " + MON[db.getMonth()].slice(0, 3) + " " + db.getFullYear(); }

    /* ── log helpers ── */
    function dayLog(s) { if (!state.logs[s]) state.logs[s] = { done: {}, sessions: [] }; return state.logs[s]; }
    function studyHours(s) { const l = state.logs[s]; if (!l || !l.sessions) return 0; return l.sessions.reduce((a, x) => a + (+x.hours || 0), 0); }
    function adherence(s) { const l = state.logs[s]; if (!l) return 0; let d = 0; BLOCKS.forEach(b => { if (l.done && l.done[b.id]) d++; }); return Math.round(d / BLOCKS.length * 100); }
    function targetTotal() { return state.subjects.reduce((a, s) => a + (+s.target || 0), 0); }
    function subjById(id) { return state.subjects.find(s => s.id === id); }
    function hasRecordedDayData(s) {
      const l = dayLog(s);
      const hasSessions = Array.isArray(l.sessions) && l.sessions.some(x => +x.hours > 0);
      const hasDone = Object.values(l.done || {}).some(Boolean);
      const hasJournal = !!(l.journal && l.journal.trim());
      return hasSessions || hasDone || hasJournal || studyHours(s) > 0;
    }
    function canEditDay(s) {
      const d = parse(s);
      const today = parse(iso(new Date()));
      return d < today && hasRecordedDayData(s);
    }
    function dayBlocks(s) {
      const l = dayLog(s);
      if (!Array.isArray(l.blocks) || !l.blocks.length) {
        l.blocks = BLOCKS.map(b => ({ ...b, sub: Array.isArray(b.sub) ? b.sub.map(x => [...x]) : [] }));
      }
      return l.blocks;
    }

    function streak() {
      let n = 0, cur = iso(new Date());
      if (studyHours(cur) <= 0) cur = addDays(cur, -1);
      while (studyHours(cur) > 0) { n++; cur = addDays(cur, -1); }
      return n;
    }
    function tally(n) {
      if (n <= 0) return "—";
      let out = "", full = Math.floor(n / 5), rem = n % 5;
      out += "卌 ".repeat(full); out += "|".repeat(rem);
      return out.trim() + "  " + n;
    }

    /* ── toast ── */
    let tT;
    function toast(msg) { const t = document.getElementById("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(tT); tT = setTimeout(() => t.classList.remove("show"), 2200); }

    /* ── esc ── */
    function esc(s) { return String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }

    /* ════════════════ RENDER ════════════════ */

    function renderHeader() {
      const d = parse(viewDate);
      document.getElementById("dow").textContent = DOW[d.getDay()];
      document.getElementById("fulldate").textContent = d.getDate() + " " + MON[d.getMonth()] + " " + d.getFullYear();
      document.getElementById("datePick").value = viewDate;
      document.getElementById("mAdh").textContent = adherence(viewDate) + "%";
      const h = studyHours(viewDate);
      document.getElementById("mHrs").textContent = h.toFixed(1);
      const t = targetTotal();
      document.getElementById("mTgt").textContent = t > 0 ? Math.min(100, Math.round(h / t * 100)) + "%" : "—";
      document.getElementById("mStreak").textContent = tally(streak());
    }

    /* Week strip */
    function renderWeekStrip() {
      const wrap = document.getElementById("weekStrip");
      wrap.innerHTML = "";
      const today = iso(new Date());
      const ws = weekStart(viewDate);
      const maxH = Math.max(0.1, ...[0, 1, 2, 3, 4, 5, 6].map(i => studyHours(addDays(ws, i))));
      for (let i = 0; i < 7; i++) {
        const ds = addDays(ws, i);
        const h = studyHours(ds);
        const d = parse(ds);
        const el = document.createElement("div");
        el.className = "wk-day" + (ds === today ? " wk-today" : "") + (ds === viewDate ? " wk-active" : "");
        el.dataset.date = ds;
        const pct = Math.max(3, h / maxH * 100);
        el.innerHTML =
          '<div class="wk-label">' + DOWS[d.getDay()] + '</div>' +
          '<div class="wk-date">' + d.getDate() + '</div>' +
          '<div class="wk-bar-wrap"><div class="wk-bar' + (h === 0 ? " wk-z" : "") + '" style="height:' + pct + '%"></div></div>' +
          '<div class="wk-hrs">' + (h > 0 ? h.toFixed(1) + "h" : "—") + '</div>';
        el.addEventListener("click", () => {
          viewDate = ds;
          document.getElementById("datePick").value = ds;
          renderHeader(); renderWeekStrip(); renderBlocks(); renderSessions(); renderJournal();
        });
        wrap.appendChild(el);
      }
    }

    /* Schedule blocks */
    function renderBlocks() {
      const l = dayLog(viewDate), wrap = document.getElementById("blocks");
      const editable = canEditDay(viewDate);
      wrap.innerHTML = "";
      const blocks = dayBlocks(viewDate);
      blocks.forEach((b, i) => {
        const done = !!(l.done && l.done[b.id]);
        const el = document.createElement("div");
        el.className = "blk" + (done ? " done" : ""); el.dataset.type = b.type;
        let subHtml = "";
        if (b.sub) { subHtml = '<div class="sub">' + b.sub.map(x => '<span class="chip">' + x[0] + ' <b>' + x[1] + '</b></span>').join("") + '</div>'; }
        let extra = "";
        if (b.id === "study") { const t = targetTotal(); extra = '<div class="sub"><span class="chip">Logged <b>' + studyHours(viewDate).toFixed(2) + 'h</b></span>' + (t > 0 ? '<span class="chip">Target <b>' + t + 'h</b></span>' : '') + '</div>'; }
        el.innerHTML =
          '<div class="blk-main">' +
          '<input type="checkbox" class="chk" ' + (done ? "checked" : "") + ' data-blk="' + b.id + '" aria-label="Mark ' + b.title + ' done">' +
          '<div class="time">' + esc(b.time) + '</div>' +
          '<div class="body"><div class="title">' + esc(b.title) + '</div><div class="desc">' + esc(b.desc) + '</div>' + subHtml + extra + '</div>' +
          (editable ? '<div class="blk-actions"><button class="blk-edit" data-i="' + i + '" type="button">✏️ Edit</button></div>' : '') +
          '</div>' +
          '<div class="blk-edit-form">' +
          '<input type="text" class="blk-time" value="' + esc(b.time) + '" placeholder="Time">' +
          '<input type="text" class="blk-title" value="' + esc(b.title) + '" placeholder="Title">' +
          '<input type="text" class="blk-desc" value="' + esc(b.desc) + '" placeholder="Description">' +
          '<button class="blk-save" type="button">✓ Save</button>' +
          '<button class="blk-cancel" type="button">✕ Cancel</button>' +
          '</div>';
        wrap.appendChild(el);

        const editBtn = el.querySelector(".blk-edit");
        if (editBtn) {
          editBtn.addEventListener("click", () => el.classList.add("editing"));
        }
        const cancelBtn = el.querySelector(".blk-cancel");
        if (cancelBtn) {
          cancelBtn.addEventListener("click", () => el.classList.remove("editing"));
        }
        const saveBtn = el.querySelector(".blk-save");
        if (saveBtn) {
          saveBtn.addEventListener("click", () => {
            const blocks2 = dayBlocks(viewDate);
            blocks2[i].time = el.querySelector(".blk-time").value.trim() || blocks2[i].time;
            blocks2[i].title = el.querySelector(".blk-title").value.trim() || blocks2[i].title;
            blocks2[i].desc = el.querySelector(".blk-desc").value.trim() || blocks2[i].desc;
            persist(); renderBlocks(); renderHeader(); toast("Block updated ✓");
          });
        }
      });
      wrap.querySelectorAll(".chk").forEach(c => c.addEventListener("change", e => {
        const l = dayLog(viewDate); if (!l.done) l.done = {};
        l.done[e.target.dataset.blk] = e.target.checked;
        persist(); renderHeader(); e.target.closest(".blk").classList.toggle("done", e.target.checked);
      }));
    }

    function renderSubjOptions() {
      const sel = document.getElementById("lgSubj");
      sel.innerHTML = state.subjects.map(s => '<option value="' + s.id + '">' + esc(s.name) + '</option>').join("");
    }

    /* Sessions with edit */
    function renderSessions() {
      const l = dayLog(viewDate), wrap = document.getElementById("sessions");
      wrap.innerHTML = "";
      if (!l.sessions || !l.sessions.length) {
        wrap.innerHTML = '<div class="empty">No sessions logged yet — add your first block above.</div>';
        return;
      }
      l.sessions.forEach((s, i) => {
        const subj = subjById(s.subjectId) || { name: "(removed)", color: "#6f8a7c" };
        const el = document.createElement("div"); el.className = "ses";

        const subjOpts = state.subjects.map(su => '<option value="' + su.id + '"' + (su.id === s.subjectId ? " selected" : "") + '>' + esc(su.name) + '</option>').join("");

        el.innerHTML =
          '<span class="dot" style="background:' + subj.color + '"></span>' +
          // Static
          '<div class="ses-static">' +
          '<span class="snm">' + esc(subj.name) + '</span>' +
          '<span class="shr">' + (+s.hours).toFixed(2) + 'h</span>' +
          '<span class="snote">' + (s.note ? esc(s.note) : "—") + '</span>' +
          '</div>' +
          // Edit form
          '<div class="ses-edit-form">' +
          '<select class="e-subj">' + subjOpts + '</select>' +
          '<input type="number" class="e-hrs" value="' + (+s.hours).toFixed(2) + '" min="0" max="16" step="0.25">' +
          '<input type="text" class="e-note" value="' + (s.note ? esc(s.note) : "") + '" placeholder="Note…">' +
          '<button class="e-save">✓ Save</button>' +
          '<button class="e-cancel">✕</button>' +
          '</div>' +
          // Action buttons
          '<div class="ses-actions">' +
          '<button class="edt" data-i="' + i + '" aria-label="Edit session" title="Edit">✏️</button>' +
          '<button class="del" data-i="' + i + '" aria-label="Delete session" title="Delete">×</button>' +
          '</div>';

        wrap.appendChild(el);

        // Toggle edit mode
        el.querySelector(".edt").addEventListener("click", () => {
          el.classList.toggle("editing");
        });
        el.querySelector(".e-cancel").addEventListener("click", () => {
          el.classList.remove("editing");
        });
        el.querySelector(".e-save").addEventListener("click", () => {
          const l2 = dayLog(viewDate);
          l2.sessions[i].subjectId = el.querySelector(".e-subj").value;
          l2.sessions[i].hours = parseFloat(el.querySelector(".e-hrs").value) || 0;
          l2.sessions[i].note = el.querySelector(".e-note").value.trim();
          persist(); renderSessions(); renderBlocks(); renderHeader(); renderWeekStrip(); toast("Session updated ✓");
        });
        el.querySelector(".del").addEventListener("click", () => {
          const l2 = dayLog(viewDate); l2.sessions.splice(i, 1);
          persist(); renderSessions(); renderBlocks(); renderHeader(); renderWeekStrip();
        });
      });
    }

    /* Journal */
    function renderJournal() {
      const l = dayLog(viewDate);
      const ta = document.getElementById("journalText");
      if (ta) ta.value = (l.journal || "");
    }

    document.getElementById("journalToggle").addEventListener("click", () => {
      const jw = document.getElementById("journalWrap");
      const open = jw.classList.toggle("open");
      document.getElementById("journalToggle").setAttribute("aria-expanded", open ? "true" : "false");
    });

    document.getElementById("journalSave").addEventListener("click", () => {
      dayLog(viewDate).journal = document.getElementById("journalText").value;
      persist(); toast("Reflection saved 📝");
    });

    document.getElementById("journalText").addEventListener("blur", () => {
      dayLog(viewDate).journal = document.getElementById("journalText").value;
      persist();
    });

    /* Subjects */
    function renderSubjects() {
      const g = document.getElementById("subjGrid"); g.innerHTML = "";
      state.subjects.forEach(s => {
        const el = document.createElement("div"); el.className = "subj";
        el.innerHTML =
          '<span class="swatch" style="background:' + s.color + '" title="Pick colour">' +
          '<input type="color" class="color-pick" data-id="' + s.id + '" value="' + s.color + '">' +
          '</span>' +
          '<input class="nm" data-id="' + s.id + '" value="' + esc(s.name) + '">' +
          '<div class="tgt">target <input type="number" min="0" max="12" step="0.5" data-id="' + s.id + '" value="' + s.target + '"> h/day</div>' +
          '<button class="del" data-id="' + s.id + '" aria-label="Remove subject">×</button>';
        g.appendChild(el);
      });
      g.querySelectorAll("input.nm").forEach(i => i.addEventListener("input", e => {
        subjById(e.target.dataset.id).name = e.target.value; persist(); renderSubjOptions();
      }));
      g.querySelectorAll(".tgt input").forEach(i => i.addEventListener("input", e => {
        subjById(e.target.dataset.id).target = +e.target.value || 0; persist(); renderHeader(); renderBlocks();
      }));
      g.querySelectorAll(".color-pick").forEach(cp => cp.addEventListener("input", e => {
        const s = subjById(e.target.dataset.id); s.color = e.target.value;
        e.target.closest(".swatch").style.background = e.target.value;
        persist(); renderSessions();
      }));
      g.querySelectorAll(".del").forEach(b => b.addEventListener("click", e => {
        if (state.subjects.length <= 1) { toast("Keep at least one subject"); return; }
        state.subjects = state.subjects.filter(x => x.id !== e.target.dataset.id);
        persist(); renderSubjects(); renderSubjOptions(); renderHeader();
      }));
    }

    /* ── Reports ── */
    let repMode = "daily", repDate = iso(new Date());

    function renderReports() {
      document.querySelectorAll(".rtab").forEach(t => t.classList.toggle("on", t.dataset.rep === repMode));
      const body = document.getElementById("repBody");
      if (repMode === "daily") repDaily(body);
      else if (repMode === "weekly") repWeekly(body);
      else repMonthly(body);
    }

    function rm(k, l, good) { return '<div class="rm' + (good ? " good" : "") + '"><div class="rk">' + k + '</div><div class="rl">' + l + '</div></div>'; }

    function subjectBreakdown(days) {
      const tot = {}; state.subjects.forEach(s => tot[s.id] = 0);
      days.forEach(d => { const l = state.logs[d]; if (l && l.sessions) l.sessions.forEach(x => { if (tot[x.subjectId] != null) tot[x.subjectId] += (+x.hours || 0); }); });
      const max = Math.max(0.1, ...Object.values(tot));
      return state.subjects.map(s => {
        const v = tot[s.id] || 0;
        return '<div class="sbar-row"><div class="sbar-lbl"><span class="dot" style="background:' + s.color + '"></span>' + esc(s.name) + '</div>' +
          '<div class="sbar-track"><div class="sbar-fill" style="width:' + (v / max * 100) + '%;background:' + s.color + '"></div></div>' +
          '<div class="sbar-val">' + v.toFixed(1) + 'h</div></div>';
      }).join("");
    }

    function repDaily(body) {
      document.getElementById("rLbl").textContent = fmtLong(repDate);
      const h = studyHours(repDate), a = adherence(repDate), t = targetTotal();
      const l = state.logs[repDate];
      let notes = "";
      if (l && l.sessions && l.sessions.length) {
        notes = '<div class="card-h">Sessions</div><div class="sessions">' + l.sessions.map(s => {
          const su = subjById(s.subjectId) || { name: "(removed)", color: "#6f8a7c" };
          return '<div class="ses"><span class="dot" style="background:' + su.color + '"></span><div class="ses-static"><span class="snm">' + esc(su.name) + '</span><span class="shr">' + (+s.hours).toFixed(2) + 'h</span><span class="snote">' + (s.note ? esc(s.note) : "—") + '</span></div></div>';
        }).join("") + '</div>';
      } else notes = '<div class="empty">Nothing logged this day.</div>';
      let jr = "";
      if (l && l.journal) { jr = '<div class="card-h">Reflection</div><div class="note-box" style="font-family:Kalam,cursive;font-size:14px;line-height:1.8">' + esc(l.journal) + '</div>'; }
      body.innerHTML = '<div class="rmetrics">' +
        rm(h.toFixed(1) + "h", "Study logged") +
        rm((t > 0 ? Math.min(100, Math.round(h / t * 100)) : 0) + "%", "Of daily target", h >= t && t > 0) +
        rm(a + "%", "Day on track", a >= 80) +
        '</div>' + notes + jr;
    }

    function repWeekly(body) {
      const ws = weekStart(repDate), we = addDays(ws, 6);
      document.getElementById("rLbl").textContent = fmtRange(ws, we);
      const days = []; for (let i = 0; i < 7; i++) days.push(addDays(ws, i));
      const hrs = days.map(studyHours);
      const total = hrs.reduce((a, b) => a + b, 0);
      const active = hrs.filter(x => x > 0).length;
      const avgAdh = Math.round(days.reduce((a, d) => a + adherence(d), 0) / 7);
      const t = targetTotal(); const metDays = days.filter(d => t > 0 && studyHours(d) >= t).length;
      const max = Math.max(t || 0, ...hrs, 1);
      const today = iso(new Date());
      let bars = days.map((d, i) => {
        const v = hrs[i]; const pd = parse(d);
        return '<div class="wcol' + (d === today ? " today" : "") + '"><div class="wbar' + (v === 0 ? " z" : "") + '" style="height:' + (v / max * 100) + '%">' + (v > 0 ? '<span class="v">' + v.toFixed(1) + '</span>' : '') + '</div><div class="wday">' + DOWS[pd.getDay()] + '</div><div class="wdate">' + pd.getDate() + '</div></div>';
      }).join("");
      body.innerHTML = '<div class="rmetrics">' +
        rm(total.toFixed(1) + "h", "This week") + rm((total / 7).toFixed(1) + "h", "Avg / day") +
        rm(active + "/7", "Active days", active >= 6) + rm(metDays + "/7", "Hit target", metDays >= 5) +
        rm(avgAdh + "%", "Avg on track", avgAdh >= 80) +
        '</div><div class="card-h">Study hours across the week</div><div class="wchart">' + bars + '</div>' +
        '<div class="card-h">By subject</div><div class="sbars">' + subjectBreakdown(days) + '</div>';
    }

    function repMonthly(body) {
      const d = parse(repDate), y = d.getFullYear(), m = d.getMonth();
      document.getElementById("rLbl").textContent = MON[m] + " " + y;
      const dim = new Date(y, m + 1, 0).getDate();
      const days = []; for (let i = 1; i <= dim; i++) days.push(iso(new Date(y, m, i)));
      const hrs = days.map(studyHours);
      const total = hrs.reduce((a, b) => a + b, 0);
      const active = hrs.filter(x => x > 0).length;
      const t = targetTotal(); const metDays = days.filter(x => t > 0 && studyHours(x) >= t).length;
      const best = Math.max(0, ...hrs);
      const consistency = Math.round(active / dim * 100);
      const firstDow = (new Date(y, m, 1).getDay() + 6) % 7;
      const today = iso(new Date());
      let cells = "";
      ["M", "T", "W", "T", "F", "S", "S"].forEach(h => cells += '<div class="hd">' + h + '</div>');
      for (let i = 0; i < firstDow; i++) cells += '<div class="cell e"></div>';
      days.forEach((ds, i) => {
        const v = hrs[i]; let lv = "";
        if (v > 0) { const r = t > 0 ? v / t : v / 4; lv = r >= 1 ? "l4" : r >= 0.66 ? "l3" : r >= 0.33 ? "l2" : "l1"; }
        cells += '<div class="cell ' + lv + (ds === today ? " tdy" : "") + '" title="' + ds + ': ' + v.toFixed(1) + 'h">' + (i + 1) + '</div>';
      });
      body.innerHTML = '<div class="rmetrics">' +
        rm(total.toFixed(1) + "h", "Month total") + rm(active + "/" + dim, "Active days", active >= dim * 0.8) +
        rm((active > 0 ? (total / active).toFixed(1) : "0") + "h", "Avg active day") + rm(best.toFixed(1) + "h", "Best day") +
        rm(consistency + "%", "Consistency", consistency >= 80) + rm(metDays, "Target days", metDays >= dim * 0.6) +
        '</div><div class="card-h">Consistency calendar</div><div class="hm">' + cells + '</div>' +
        '<div class="hm-key"><span>Less</span><span class="kc" style="background:#16382a"></span><span class="kc l1" style="background:#26543f"></span><span class="kc l2" style="background:#3f6b30"></span><span class="kc l3" style="background:#6f9a3f"></span><span class="kc l4" style="background:#93c26a"></span><span>More</span></div>' +
        '<div class="card-h">By subject</div><div class="sbars">' + subjectBreakdown(days) + '</div>';
    }

    /* ── Excel export ── */
    function exportXlsx() {
      const wb = XLSX.utils.book_new();
      const sess = [["Date", "Subject", "Hours", "Notes"]];
      const sched = [["Date", "Block", "Done"]];
      const summary = [["Date", "StudyHours", "TargetHours", "Adherence%", "TargetMet"]];
      const journal = [["Date", "Reflection"]];
      const t = targetTotal();
      Object.keys(state.logs).sort().forEach(ds => {
        const l = state.logs[ds];
        (l.sessions || []).forEach(s => { const su = subjById(s.subjectId); sess.push([ds, su ? su.name : "(removed)", +s.hours, s.note || ""]); });
        BLOCKS.forEach(b => sched.push([ds, b.title, (l.done && l.done[b.id]) ? "Yes" : "No"]));
        const h = studyHours(ds);
        summary.push([ds, +h.toFixed(2), t, adherence(ds), (t > 0 && h >= t) ? "Yes" : "No"]);
        if (l.journal) journal.push([ds, l.journal]);
      });
      const subj = [["Name", "TargetHours", "Color"]];
      state.subjects.forEach(s => subj.push([s.name, s.target, s.color]));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sess), "StudySessions");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sched), "Schedule");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "DailySummary");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(journal), "Journal");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(subj), "Subjects");
      XLSX.writeFile(wb, "study-log.xlsx");
      toast("Exported study-log.xlsx ✓");
    }

    /* ── Excel import ── */
    function importXlsx(file) {
      const rd = new FileReader();
      rd.onload = e => {
        try {
          const wb = XLSX.read(e.target.result, { type: "array" });
          if (wb.Sheets["Subjects"]) {
            const rows = XLSX.utils.sheet_to_json(wb.Sheets["Subjects"], { header: 1 }).slice(1).filter(r => r[0]);
            if (rows.length) state.subjects = rows.map((r, i) => ({ id: "s" + (i + 1), name: String(r[0]), target: +r[1] || 0, color: r[2] || CHALK[i % CHALK.length] }));
          }
          const nameToId = {}; state.subjects.forEach(s => nameToId[s.name] = s.id);
          const logs = {};
          if (wb.Sheets["StudySessions"]) {
            XLSX.utils.sheet_to_json(wb.Sheets["StudySessions"], { header: 1 }).slice(1).forEach(r => {
              if (!r[0]) return; const ds = String(r[0]).slice(0, 10);
              if (!logs[ds]) logs[ds] = { done: {}, sessions: [] };
              let sid = nameToId[r[1]];
              if (!sid) { const ns = { id: "s" + (state.subjects.length + 1), name: String(r[1] || "Subject"), target: 0, color: CHALK[state.subjects.length % CHALK.length] }; state.subjects.push(ns); nameToId[ns.name] = ns.id; sid = ns.id; }
              logs[ds].sessions.push({ id: "x" + Math.random().toString(36).slice(2, 7), subjectId: sid, hours: +r[2] || 0, note: r[3] || "" });
            });
          }
          if (wb.Sheets["Schedule"]) {
            const titleToId = {}; BLOCKS.forEach(b => titleToId[b.title] = b.id);
            XLSX.utils.sheet_to_json(wb.Sheets["Schedule"], { header: 1 }).slice(1).forEach(r => {
              if (!r[0]) return; const ds = String(r[0]).slice(0, 10);
              if (!logs[ds]) logs[ds] = { done: {}, sessions: [] };
              const bid = titleToId[r[1]]; if (bid) logs[ds].done[bid] = (String(r[2]).toLowerCase() === "yes" || r[2] === true);
            });
          }
          if (wb.Sheets["Journal"]) {
            XLSX.utils.sheet_to_json(wb.Sheets["Journal"], { header: 1 }).slice(1).forEach(r => {
              if (!r[0]) return; const ds = String(r[0]).slice(0, 10);
              if (!logs[ds]) logs[ds] = { done: {}, sessions: [] };
              logs[ds].journal = String(r[1] || "");
            });
          }
          state.logs = logs; persist(); renderAll(); toast("Imported successfully ✓");
        } catch (err) { toast("Couldn't read that file"); }
      };
      rd.readAsArrayBuffer(file);
    }

    /* ════════════════ WIRING ════════════════ */
    function renderAll() { renderHeader(); renderWeekStrip(); renderBlocks(); renderSubjOptions(); renderSessions(); renderSubjects(); renderReports(); renderJournal(); }

    /* Nav tab switching */
    function switchTab(name) {
      document.querySelectorAll(".nav-link").forEach(l => l.classList.toggle("on", l.dataset.tab === name));
      document.querySelectorAll(".drawer-link").forEach(l => l.classList.toggle("on", l.dataset.tab === name));
      ["today", "subjects", "reports", "data"].forEach(n => document.getElementById("p-" + n).classList.toggle("hide", n !== name));
      document.getElementById("navDrawer").classList.remove("open");
      document.getElementById("hamburger").classList.remove("open");
      document.getElementById("hamburger").setAttribute("aria-expanded", "false");
    }

    document.querySelectorAll(".nav-link").forEach(l => l.addEventListener("click", () => switchTab(l.dataset.tab)));
    document.querySelectorAll(".drawer-link").forEach(l => l.addEventListener("click", () => switchTab(l.dataset.tab)));

    /* Hamburger */
    document.getElementById("hamburger").addEventListener("click", () => {
      const drawer = document.getElementById("navDrawer");
      const burger = document.getElementById("hamburger");
      const open = drawer.classList.toggle("open");
      burger.classList.toggle("open", open);
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });

    /* Report tabs */
    document.querySelectorAll(".rtab").forEach(t => t.addEventListener("click", () => { repMode = t.dataset.rep; renderReports(); }));
    document.getElementById("rPrev").addEventListener("click", () => { repDate = repMode === "daily" ? addDays(repDate, -1) : repMode === "weekly" ? addDays(repDate, -7) : shiftMonth(repDate, -1); renderReports(); });
    document.getElementById("rNext").addEventListener("click", () => { repDate = repMode === "daily" ? addDays(repDate, 1) : repMode === "weekly" ? addDays(repDate, 7) : shiftMonth(repDate, 1); renderReports(); });

    /* Date picker */
    document.getElementById("datePick").addEventListener("change", e => { viewDate = e.target.value; renderHeader(); renderWeekStrip(); renderBlocks(); renderSessions(); renderJournal(); });
    document.getElementById("todayBtn").addEventListener("click", () => { viewDate = iso(new Date()); renderHeader(); renderWeekStrip(); renderBlocks(); renderSessions(); renderJournal(); });

    /* Add session */
    function addSession() {
      const sid = document.getElementById("lgSubj").value;
      const hrs = parseFloat(document.getElementById("lgHrs").value);
      const note = document.getElementById("lgNote").value.trim();
      if (!sid) { toast("Add a subject first"); return; }
      if (!hrs || hrs <= 0) { toast("Enter hours (e.g. 1.5)"); return; }
      dayLog(viewDate).sessions.push({ id: "x" + Math.random().toString(36).slice(2, 7), subjectId: sid, hours: hrs, note });
      persist();
      document.getElementById("lgHrs").value = "";
      document.getElementById("lgNote").value = "";
      renderSessions(); renderBlocks(); renderHeader(); renderWeekStrip(); toast("Session logged ✓");
    }
    document.getElementById("lgAdd").addEventListener("click", addSession);
    document.getElementById("lgNote").addEventListener("keydown", e => { if (e.key === "Enter") addSession(); });
    document.getElementById("lgHrs").addEventListener("keydown", e => { if (e.key === "Enter") addSession(); });

    /* Subjects */
    document.getElementById("addSub").addEventListener("click", () => {
      const i = state.subjects.length;
      state.subjects.push({ id: "s" + Date.now(), name: "New subject", color: CHALK[i % CHALK.length], target: 1 });
      persist(); renderSubjects(); renderSubjOptions();
    });

    /* Data */
    document.getElementById("btnExport").addEventListener("click", exportXlsx);
    document.getElementById("btnImport").addEventListener("click", () => document.getElementById("fileIn").click());
    document.getElementById("fileIn").addEventListener("change", e => { if (e.target.files[0]) importXlsx(e.target.files[0]); e.target.value = ""; });
    document.getElementById("btnReset").addEventListener("click", () => {
      if (confirm("Reset ALL data? Export first — this cannot be undone.")) {
        state = { subjects: JSON.parse(JSON.stringify(DEFAULT_SUBJECTS)), logs: {} }; persist();
        viewDate = iso(new Date()); repDate = iso(new Date());
        renderAll(); toast("Reset done");
      }
    });

    /* ════════════════ POMODORO TIMER ════════════════ */
    const FS_CIRC = 540.4; // 2π×86
    let pomoRunning = false, pomoTimer = null, pomoSecs = 25 * 60, pomoTotal = 25 * 60, pomoSessions = 0, pomoCurMin = 25;
    const modeLabels = { 25: "Focus", 5: "Short Break", 15: "Long Break" };

    function pomoDisplay() {
      const m = Math.floor(pomoSecs / 60), s = pomoSecs % 60;
      const str = String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
      // Fullscreen
      document.getElementById("fsDisplay").textContent = str;
      const offset = FS_CIRC * (1 - (pomoSecs / pomoTotal));
      document.getElementById("fsRingFg").style.strokeDashoffset = offset;
      document.getElementById("fsRingGlow").style.strokeDashoffset = offset;
      document.getElementById("fsCount").textContent = "🍅 " + pomoSessions + " session" + (pomoSessions !== 1 ? "s" : "");
      // Update page title when running
      document.title = pomoRunning ? (str + " · " + modeLabels[pomoCurMin]) : "The Daily Board — Study & Schedule ERP";
    }

    function setMode(mins) {
      pomoCurMin = mins; pomoTotal = mins * 60; pomoSecs = mins * 60;
      clearInterval(pomoTimer); pomoRunning = false;
      document.getElementById("pomoFSStart").textContent = "Start";
      document.getElementById("fsLabel").textContent = modeLabels[mins] || "Focus";
      document.querySelectorAll(".pomo-fs-mode").forEach(b => b.classList.toggle("on", +b.dataset.min === mins));
      // Ring colour: red for focus, teal for break
      const col = mins === 25 ? "#e74c3c" : "#6fb3c9";
      document.getElementById("fsRingFg").style.stroke = col;
      document.getElementById("fsRingGlow").style.stroke = mins === 25 ? "rgba(231,76,60,.18)" : "rgba(111,179,201,.18)";
      document.getElementById("fsLabel").style.color = mins === 25 ? "rgba(231,76,60,.85)" : "rgba(111,179,201,.85)";
      document.getElementById("pomoFSStart").style.background = mins === 25 ? "linear-gradient(135deg,#c0392b,#e74c3c)" : "linear-gradient(135deg,#2980b9,#6fb3c9)";
      pomoDisplay();
    }

    function pomoBell() {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [880, 1100, 880].forEach((f, i) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.frequency.value = f;
          const t = ctx.currentTime + i * 0.35;
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.3, t + 0.05);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
          o.start(t); o.stop(t + 0.4);
        });
      } catch (e) { }
    }

    function pomoTick() {
      if (pomoSecs > 0) { pomoSecs--; pomoDisplay(); }
      else {
        clearInterval(pomoTimer); pomoRunning = false;
        document.getElementById("pomoFSStart").textContent = "Start";
        document.title = "The Daily Board — Study & Schedule ERP";
        pomoBell();
        if (pomoCurMin === 25) {
          pomoSessions++;
          toast("🍅 Focus done! Great work — take a break.");
          document.getElementById("lgHrs").value = "0.42";
          document.getElementById("lgNote").value = "Pomodoro session #" + pomoSessions;
          setTimeout(() => setMode(pomoSessions % 4 === 0 ? 15 : 5), 700);
        } else {
          toast("Break over! Back to work 💪");
          setTimeout(() => setMode(25), 700);
        }
        pomoDisplay();
      }
    }

    /* Open / close fullscreen */
    function openPomoFS() { document.getElementById("pomoFS").classList.add("open"); }
    function closePomoFS() { document.getElementById("pomoFS").classList.remove("open"); }

    document.getElementById("pomoBtn").addEventListener("click", openPomoFS);
    document.getElementById("pomoFSClose").addEventListener("click", closePomoFS);

    document.getElementById("pomoFSStart").addEventListener("click", () => {
      if (pomoRunning) {
        clearInterval(pomoTimer); pomoRunning = false;
        document.getElementById("pomoFSStart").textContent = "Resume";
        document.title = "The Daily Board — Study & Schedule ERP";
      } else {
        pomoTimer = setInterval(pomoTick, 1000); pomoRunning = true;
        document.getElementById("pomoFSStart").textContent = "Pause";
      }
      pomoDisplay();
    });

    document.getElementById("pomoFSReset").addEventListener("click", () => {
      clearInterval(pomoTimer); pomoRunning = false; pomoSecs = pomoTotal;
      document.getElementById("pomoFSStart").textContent = "Start";
      document.title = "The Daily Board — Study & Schedule ERP";
      pomoDisplay();
    });

    document.querySelectorAll(".pomo-fs-mode").forEach(b => b.addEventListener("click", () => setMode(+b.dataset.min)));

    /* Keyboard shortcuts inside fullscreen */
    document.addEventListener("keydown", e => {
      const fs = document.getElementById("pomoFS");
      if (!fs.classList.contains("open")) return;
      if (e.key === "Escape") { closePomoFS(); }
      if (e.code === "Space" && e.target.tagName !== "BUTTON") {
        e.preventDefault();
        document.getElementById("pomoFSStart").click();
      }
      if (e.key.toLowerCase() === "r" && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
        document.getElementById("pomoFSReset").click();
      }
    });

    setMode(25); // initialise colours

    /* ── Firebase bridge ── */
    window.applyRemoteState = function (data) {
      if (data) {
        if (Array.isArray(data.subjects) && data.subjects.length) state.subjects = data.subjects;
        state.logs = (data.logs && typeof data.logs === "object") ? data.logs : {};
      }
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { }
      renderAll();
    };
    window.getLocalState = function () { return state; };

    renderAll();
