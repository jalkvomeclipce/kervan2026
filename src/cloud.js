/* ============================================================
   KERVAN YOLU — cloud.js
   Google ile giriş (Firebase Auth) ve bulut kaydı (Firestore).
   Firebase kütüphanesi yalnızca config.js doluysa yüklenir.
   Kayıt: saves/{uid} belgesi { save, at, name, lv }.
   ============================================================ */
var KY = (typeof KY !== 'undefined') ? KY : {};

KY.Cloud = (function () {
  const CFG = KY.CLOUD_CONFIG || {};
  const SDK = 'https://cdn.jsdelivr.net/npm/firebase@10.12.2/';
  let auth = null, db = null, user = null, initP = null;
  const enabled = () => !!(CFG.apiKey && CFG.projectId);

  function script(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.async = true; s.onload = res; s.onerror = () => rej(new Error('yüklenemedi: ' + src));
      document.head.appendChild(s);
    });
  }
  // kütüphaneyi yükle; oturum açıksa kullanıcıyı döndür
  function init() {
    if (!enabled()) return Promise.resolve(null);
    if (initP) return initP;
    initP = (async () => {
      await script(SDK + 'firebase-app-compat.js');
      await Promise.all([script(SDK + 'firebase-auth-compat.js'), script(SDK + 'firebase-firestore-compat.js')]);
      const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(CFG);
      auth = app.auth(); db = app.firestore();
      try { await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch (e) { /* varsayılan kalıcılık */ }
      try { await auth.getRedirectResult(); } catch (e) { console.warn('giriş yönlendirmesi', e); }
      return new Promise(res => { const off = auth.onAuthStateChanged(u => { user = u; off(); res(u); }); });
    })();
    return initP;
  }
  async function signIn() {
    await init();
    const prov = new firebase.auth.GoogleAuthProvider();
    prov.setCustomParameters({ prompt: 'select_account' });
    try {
      const r = await auth.signInWithPopup(prov);
      user = r.user;
    } catch (e) {
      // açılır pencere engellendiyse sayfa yönlendirmesiyle dene
      if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) { await auth.signInWithRedirect(prov); return null; }
      throw e;
    }
    return user;
  }
  async function signOut() { if (auth) await auth.signOut(); user = null; }
  async function load() {
    if (!user) return null;
    const d = await db.collection('saves').doc(user.uid).get();
    if (!d.exists) return null;
    try { const v = d.data(); return Object.assign(JSON.parse(v.save), { at: v.at || 0 }); } catch (e) { return null; }
  }
  let inflight = false, queued = null;
  async function save(obj) {
    if (!user || !db) return false;
    if (inflight) { queued = obj; return true; }
    inflight = true;
    try {
      await db.collection('saves').doc(user.uid).set({ save: JSON.stringify(obj), at: obj.at || Date.now(), name: obj.p.name || '', lv: obj.p.lv || 1 });
      return true;
    } catch (e) { console.warn('bulut kaydı başarısız', e); return false; }
    finally {
      inflight = false;
      if (queued) { const q = queued; queued = null; save(q); }
    }
  }
  const errText = (e) => ({
    'auth/popup-closed-by-user': 'Giriş penceresi kapatıldı.',
    'auth/cancelled-popup-request': 'Giriş iptal edildi.',
    'auth/unauthorized-domain': 'Bu alan adı Firebase\'de yetkili değil (Authorized domains).',
    'auth/network-request-failed': 'Ağ bağlantısı yok.'
  }[e && e.code] || 'Giriş yapılamadı. Biraz sonra tekrar dene.');
  return { enabled, init, signIn, signOut, load, save, errText, user: () => user };
})();
