    import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
    import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail, sendEmailVerification } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
    import { getFirestore, doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

    /* ═══════════════════════════════════════════════════════════════════
       STEP 1 — PASTE YOUR FIREBASE CONFIG HERE
       These values are safe to be public; your data is protected by login
       and Firestore security rules, not by hiding these keys.
    ═══════════════════════════════════════════════════════════════════ */
    const firebaseConfig = {
      apiKey: "AIzaSyC1gQl1tvJNNpJf_RZnb_LlzHI0ouRIiD0",
      authDomain: "daily-board-b99d9.firebaseapp.com",
      projectId: "daily-board-b99d9",
      storageBucket: "daily-board-b99d9.firebasestorage.app",
      messagingSenderId: "791840367063",
      appId: "1:791840367063:web:db86b4ccc39876cccd2b92"
    };
    /* ═══════════════════════════════════════════════════════════════════ */

    const body = document.body;
    const setView = s => { body.className = s; };
    const el = id => document.getElementById(id);
    const showErr = m => { const e = el("gerr"); if (e) { e.textContent = m || ""; e.style.color = "var(--miss)"; } };

    const configured = !firebaseConfig.apiKey.startsWith("PASTE");
    let auth, db, unsub = null, saveTimer = null, mode = "login";

    function toLogin() { setView("need-login"); if (configured && el("gsubmit")) el("gsubmit").disabled = false; }

    function enterApp(user) {
      const w = el("uwho"); if (w) w.innerHTML = "Signed in as <b>" + user.email + "</b>";
      const dw = el("drawer-who"); if (dw) dw.textContent = user.email;
      setView("app-ready");
      const ref = doc(db, "users", user.uid);
      if (unsub) unsub();
      unsub = onSnapshot(ref, snap => {
        if (snap.metadata.hasPendingWrites) return;
        if (snap.exists()) { window.applyRemoteState(snap.data()); }
        else { const st = window.getLocalState(); window.applyRemoteState(st); setDoc(ref, { subjects: st.subjects, logs: st.logs, updated: Date.now() }); }
      }, () => { const b = el("usync"); if (b) b.textContent = "offline"; });
    }

    function showVerifyGate(user) {
      if (unsub) { unsub(); unsub = null; }
      const vm = el("vmsg");
      if (vm) vm.innerHTML = "Verify <b>" + user.email + "</b> to continue. Open the link we emailed you (check spam too), then tap the button below. Didn't get one? Resend it.";
      const ve = el("verr"); if (ve) ve.textContent = "";
      setView("need-verify");
    }

    if (!configured) {
      toLogin();
      const note = el("gnote");
      if (note) note.innerHTML = "<b style='color:#f4a935'>Setup needed for login.</b> Paste your Firebase config into index.html (STEP 1 in the code below — full steps in the README). Or just look around first:";
      if (el("gsubmit")) el("gsubmit").disabled = true;
      const prev = document.createElement("div");
      prev.className = "gforgot"; prev.style.marginTop = "12px";
      prev.innerHTML = '<a id="gpreview">Preview without login →</a>';
      const note2 = el("gnote"); if (note2) note2.after(prev);
      const pv = el("gpreview");
      if (pv) pv.addEventListener("click", () => {
        setView("app-ready");
        const w = el("uwho"); if (w) w.textContent = "Preview — saved on this device only";
        const s = el("usync"); if (s) s.textContent = "not synced";
        [el("signout"), el("signout2")].forEach(b => { if (b) b.textContent = "Back to login"; });
      });
    } else {
      const app = initializeApp(firebaseConfig);
      auth = getAuth(app); db = getFirestore(app);

      window.saveToCloud = function (st) {
        if (!auth.currentUser) return;
        const bar = el("usync"); if (bar) bar.textContent = "saving…";
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          setDoc(doc(db, "users", auth.currentUser.uid), { subjects: st.subjects, logs: st.logs, updated: Date.now() })
            .then(() => { if (bar) bar.textContent = "✓ synced"; })
            .catch(() => { if (bar) bar.textContent = "offline — will sync"; });
        }, 600);
      };

      onAuthStateChanged(auth, user => {
        if (user) { if (user.emailVerified) enterApp(user); else showVerifyGate(user); }
        else { if (unsub) { unsub(); unsub = null; } toLogin(); }
      });
    }

    function applyMode() {
      if (mode === "login") {
        el("gtitle").textContent = "Welcome back"; el("gsubmit").textContent = "Log in";
        el("gtoggle-text").textContent = "New here? "; el("gtoggle-link").textContent = "Create one";
        el("gpass").setAttribute("autocomplete", "current-password");
      } else {
        el("gtitle").textContent = "Create your board"; el("gsubmit").textContent = "Create account";
        el("gtoggle-text").textContent = "Already have an account? "; el("gtoggle-link").textContent = "Log in";
        el("gpass").setAttribute("autocomplete", "new-password");
      }
      const e = el("gerr"); if (e) e.textContent = "";
    }

    async function doAuth() {
      if (!configured) return;
      const e = (el("gemail").value || "").trim();
      const p = el("gpass").value || "";
      if (!e || !p) { showErr("Enter your email and password."); return; }
      el("gsubmit").disabled = true;
      try {
        if (mode === "login") { await signInWithEmailAndPassword(auth, e, p); }
        else { const cred = await createUserWithEmailAndPassword(auth, e, p); await sendEmailVerification(cred.user); }
      } catch (err) { showErr(friendly(err.code)); el("gsubmit").disabled = false; }
    }

    function friendly(code) {
      return ({ "auth/invalid-email": "That email doesn't look right.", "auth/missing-password": "Enter a password.", "auth/weak-password": "Password should be at least 6 characters.", "auth/email-already-in-use": "That email already has an account — try logging in.", "auth/invalid-credential": "Email or password is incorrect.", "auth/wrong-password": "Email or password is incorrect.", "auth/user-not-found": "No account with that email — create one below.", "auth/too-many-requests": "Too many attempts. Wait a moment and retry.", "auth/network-request-failed": "Network problem — check your connection.", "auth/operation-not-allowed": "Email sign-in isn't enabled yet in your Firebase console." })[code] || "Something went wrong. Please try again.";
    }

    if (el("gtoggle-link")) el("gtoggle-link").addEventListener("click", () => { mode = mode === "login" ? "signup" : "login"; applyMode(); });
    if (el("gsubmit")) el("gsubmit").addEventListener("click", doAuth);
    if (el("gpass")) el("gpass").addEventListener("keydown", ev => { if (ev.key === "Enter") doAuth(); });
    if (el("gemail")) el("gemail").addEventListener("keydown", ev => { if (ev.key === "Enter") el("gpass").focus(); });

    // Both sign-out buttons
    [el("signout"), el("signout2")].forEach(btn => {
      if (btn) btn.addEventListener("click", () => { if (auth) signOut(auth); else setView("need-login"); });
    });

    if (el("gforgot-link")) el("gforgot-link").addEventListener("click", async () => {
      if (!configured) return;
      const e = (el("gemail").value || "").trim();
      if (!e) { showErr("Type your email above first, then tap reset."); return; }
      try { await sendPasswordResetEmail(auth, e); showErr("Reset link sent — check your email."); }
      catch (err) { showErr(friendly(err.code)); }
    });

    if (el("vcheck")) el("vcheck").addEventListener("click", async () => {
      if (!auth || !auth.currentUser) { setView("need-login"); return; }
      const ve = el("verr"); if (ve) { ve.style.color = "var(--chalk-dim)"; ve.textContent = "Checking…"; }
      el("vcheck").disabled = true;
      try {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) { await auth.currentUser.getIdToken(true); if (ve) ve.textContent = ""; enterApp(auth.currentUser); }
        else if (ve) { ve.style.color = "var(--miss)"; ve.textContent = "Not verified yet — open the link in your email first, then tap again."; }
      } catch (err) { if (ve) { ve.style.color = "var(--miss)"; ve.textContent = "Couldn't check just now — try again in a moment."; } }
      el("vcheck").disabled = false;
    });

    if (el("vresend")) el("vresend").addEventListener("click", async () => {
      if (!auth || !auth.currentUser) return;
      const ve = el("verr");
      try { await sendEmailVerification(auth.currentUser); if (ve) { ve.style.color = "var(--lime)"; ve.textContent = "Sent again — check your inbox and spam folder."; } }
      catch (err) { if (ve) { ve.style.color = "var(--miss)"; ve.textContent = friendly(err.code); } }
    });

    if (el("vswitch")) el("vswitch").addEventListener("click", () => { if (auth) signOut(auth); });

    applyMode();
