import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

/* Keep this in sync with js/auth.js — same Firebase project. */
const firebaseConfig = {
  apiKey: "AIzaSyC1gQl1tvJNNpJf_RZnb_LlzHI0ouRIiD0",
  authDomain: "daily-board-b99d9.firebaseapp.com",
  projectId: "daily-board-b99d9",
  storageBucket: "daily-board-b99d9.firebasestorage.app",
  messagingSenderId: "791840367063",
  appId: "1:791840367063:web:db86b4ccc39876cccd2b92"
};

const LOGIN_URL = "login.html";
const configured = !firebaseConfig.apiKey.startsWith("PASTE");

const body = document.body;
const el = id => document.getElementById(id);
let auth, db, unsub = null, saveTimer = null;

function enterApp(user) {
  const w = el("uwho"); if (w) w.innerHTML = "Signed in as <b>" + user.email + "</b>";
  const dw = el("drawer-who"); if (dw) dw.textContent = user.email;
  body.className = "app-ready";
  const ref = doc(db, "users", user.uid);
  if (unsub) unsub();
  unsub = onSnapshot(ref, snap => {
    if (snap.metadata.hasPendingWrites) return;
    if (snap.exists()) { window.applyRemoteState(snap.data()); }
    else { const st = window.getLocalState(); window.applyRemoteState(st); setDoc(ref, { subjects: st.subjects, logs: st.logs, schedule: st.schedule || null, updated: Date.now() }); }
  }, () => { const b = el("usync"); if (b) b.textContent = "offline"; });
}

if (!configured) {
  /* Local development fallback when Firebase isn't set up at all */
  body.className = "app-ready";
  const w = el("uwho"); if (w) w.textContent = "Preview — saved on this device only";
  const s = el("usync"); if (s) s.textContent = "not synced";
} else {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app); db = getFirestore(app);

  window.saveToCloud = function (st) {
    if (!auth.currentUser) return;
    const bar = el("usync"); if (bar) bar.textContent = "saving…";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      setDoc(doc(db, "users", auth.currentUser.uid), { subjects: st.subjects, logs: st.logs, schedule: st.schedule || null, updated: Date.now() })
        .then(() => { if (bar) bar.textContent = "✓ synced"; })
        .catch(() => { if (bar) bar.textContent = "offline — will sync"; });
    }, 600);
  };

  onAuthStateChanged(auth, user => {
    if (user && user.emailVerified) {
      enterApp(user);
    } else {
      if (unsub) { unsub(); unsub = null; }
      window.location.href = LOGIN_URL;
    }
  });
}

[el("signout"), el("signout2")].forEach(btn => {
  if (btn) btn.addEventListener("click", () => { if (auth) signOut(auth); else window.location.href = LOGIN_URL; });
});
