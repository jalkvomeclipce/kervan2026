/* ============================================================
   KERVAN YOLU — config.js
   Google ile giriş ve bulut kaydı için Firebase ayarları.
   Boş bırakılırsa oyun "misafir" modunda çalışır, ilerleme
   yalnızca bu tarayıcıda saklanır.

   Kurulum (bir kez, ücretsiz Spark planı yeter):
   1. https://console.firebase.google.com → Proje oluştur
   2. Authentication → Sign-in method → Google'ı aç
   3. Authentication → Settings → Authorized domains → oyunun
      yayınlandığı alan adını ekle (localhost hazır gelir)
   4. Firestore Database → Create database → Rules sekmesine
      README'deki kuralı yapıştır (herkes yalnız kendi kaydını görür)
   5. Project settings → Your apps → Web app ekle → firebaseConfig
      içindeki değerleri aşağıya kopyala, sonra `node build.js`
   ============================================================ */
var KY = (typeof KY !== 'undefined') ? KY : {};

KY.CLOUD_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: ''
};
