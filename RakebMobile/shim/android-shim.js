/* Rakeb Android — pont entre l'application (identique à la version Windows) et Android.
   Chargé avant l'application. Ne fait rien hors de l'application Android. */
(function () {
  'use strict';
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  var P = C.Plugins || {};
  var ADHAN = '__ADHAN_FILE__'; // « adhan.mp3 » si le fichier a été ajouté au projet, sinon vide
  function noop() {}

  /* 1. Réseau natif : User-Agent identifiable (exigé par Wikimédia et Overpass) */
  var UA = 'Rakeb/1.1 (saoudigitallab@gmail.com) Android';
  var nativeFetch = window.fetch;
  if (typeof nativeFetch === 'function') {
    window.fetch = function (input, init) {
      try {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        var hdr = init && init.headers;
        if (/^https?:\/\//i.test(url) && url.indexOf('api.anthropic.com') < 0 && !(hdr && typeof hdr.forEach === 'function')) {
          var h = Object.assign({}, hdr || {});
          if (!h['User-Agent'] && !h['user-agent']) h['User-Agent'] = UA;
          init = Object.assign({}, init || {}, { headers: h });
        }
      } catch (e) { /* requête d'origine conservée */ }
      return nativeFetch.call(this, input, init);
    };
  }

  /* 2. Position : plugin natif (autorisation Android standard, sans nouvelle demande à chaque retour) */
  var G = P.Geolocation;
  if (G) {
    var geo = {
      getCurrentPosition: function (ok, err, opts) {
        opts = opts || {};
        G.checkPermissions().then(function (p) {
          return (p.location === 'granted' || p.coarseLocation === 'granted') ? null : G.requestPermissions();
        }).then(function () {
          return G.getCurrentPosition({ enableHighAccuracy: !!opts.enableHighAccuracy, timeout: Math.max(opts.timeout || 0, 20000), maximumAge: 60000 });
        }).then(function (pos) { if (ok) ok(pos); },
          function (e) { if (err) err({ code: 1, message: (e && e.message) || 'position refusée ou indisponible', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }); });
      },
      watchPosition: function () { return 0; },
      clearWatch: noop
    };
    try { Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true }); } catch (e) { /* conservé */ }
  }

  /* 3. Sauvegarde des réglages hors de la WebView : si Android vide ses données, on les restaure */
  var PR = P.Preferences;
  if (PR) {
    var backup = function () {
      try {
        if (!localStorage.getItem('rakeb-state')) return; // rien à sauvegarder (ou restauration en cours)
        var d = {}, i, k;
        for (i = 0; i < localStorage.length; i++) { k = localStorage.key(i); d[k] = localStorage.getItem(k); }
        PR.set({ key: 'rakeb-backup', value: JSON.stringify(d) });
      } catch (e) { /* ignoré */ }
    };
    if (!localStorage.getItem('rakeb-state') && !sessionStorage.getItem('rakeb-restored')) {
      sessionStorage.setItem('rakeb-restored', '1');
      PR.get({ key: 'rakeb-backup' }).then(function (r) {
        if (!r || !r.value) return;
        var d = JSON.parse(r.value);
        Object.keys(d).forEach(function (k) { localStorage.setItem(k, d[k]); });
        if (d['rakeb-state']) location.reload();
      }).catch(noop);
    }
    setInterval(backup, 20000);
    document.addEventListener('visibilitychange', function () { if (document.hidden) backup(); });
    window.addEventListener('pagehide', backup);
  }

  /* 4. Synthèse vocale (99 Noms d'Allah) : l'absence de speechSynthesis dans la WebView bloquait toute l'application */
  var TTS = P.TextToSpeech;
  if (typeof window.speechSynthesis === 'undefined' || TTS) {
    var voices = [];
    var synth = {
      onvoiceschanged: null,
      getVoices: function () { return voices; },
      cancel: function () { if (TTS) TTS.stop().catch(noop); },
      speak: function (u) {
        var done = function () { if (u && typeof u.onend === 'function') u.onend(); };
        if (!TTS) { setTimeout(done, 0); return; }
        var o = { text: u.text, lang: u.lang || 'ar-SA', rate: u.rate || 1, pitch: 1, volume: 1 };
        if (u.voice && typeof u.voice.index === 'number') o.voice = u.voice.index;
        TTS.speak(o).then(done, done);
      }
    };
    try { Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true }); } catch (e) { window.speechSynthesis = synth; }
    window.SpeechSynthesisUtterance = function (t) { this.text = t || ''; this.lang = ''; this.rate = 1; this.voice = null; this.onend = null; };
    if (TTS) {
      TTS.getSupportedVoices().then(function (r) {
        voices = (r.voices || []).map(function (v, i) { return { name: v.name || v.voiceURI, lang: v.lang, voiceURI: v.voiceURI, index: i }; });
        if (typeof synth.onvoiceschanged === 'function') synth.onvoiceschanged();
      }).catch(noop);
    }
  }

  /* 4b. Boussole : capteurs lus nativement ; le cap est renvoyé à l'application comme un événement « absolu » */
  var CP = P.Compass;
  if (CP) {
    var compassStarted = false, compassListening = false;
    var statePos = function () {
      try { var st = JSON.parse(localStorage.getItem('rakeb-state') || '{}'); return (typeof st.lat === 'number' && typeof st.lon === 'number') ? { lat: st.lat, lon: st.lon } : {}; } catch (e) { return {}; }
    };
    var startCompass = function () {
      if (!compassListening) {
        compassListening = true;
        CP.addListener('heading', function (d) {
          var ev = new Event('deviceorientationabsolute');
          ev.alpha = (360 - d.heading) % 360; ev.beta = 0; ev.gamma = 0; ev.absolute = true;
          window.dispatchEvent(ev);
        });
      }
      if (compassStarted) return;
      compassStarted = true;
      CP.start(statePos()).catch(function () { compassStarted = false; });
    };
    var addL = window.addEventListener;
    window.addEventListener = function (type) {
      if (type === 'deviceorientationabsolute') startCompass();
      return addL.apply(this, arguments);
    };
  }

  /* 5. Exports (CSV, SVG, JSON) : une WebView ne télécharge pas les « blob: » ; on enregistre puis on partage */
  var F = P.Filesystem, S = P.Share;
  if (F && S) {
    var blobs = {};
    var createURL = URL.createObjectURL;
    URL.createObjectURL = function (b) { var u = createURL.call(URL, b); blobs[u] = b; return u; };
    var origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      var a = this;
      if (a.hasAttribute('download') && blobs[a.href]) {
        var name = a.getAttribute('download') || 'rakeb.txt', fr = new FileReader();
        fr.onload = function () {
          var b64 = String(fr.result).split(',')[1] || '';
          F.writeFile({ path: name, data: b64, directory: 'CACHE' })
            .then(function (res) { return S.share({ title: name, url: res.uri, dialogTitle: 'Enregistrer ou envoyer le fichier' }); })
            .catch(function () { /* partage annulé ou impossible */ });
        };
        fr.readAsDataURL(blobs[a.href]);
        return;
      }
      return origClick.apply(this, arguments);
    };
  }

  /* 6. Alertes de prière : notifications programmées par Android (fonctionnent application fermée) */
  var LN = P.LocalNotifications;
  if (!LN) return;
  window.RakebNative = true; // l'application n'émet plus elle-même le carillon (évite le double son)

  var perm = 'default';
  function map(p) { return p === 'granted' ? 'granted' : (p === 'denied' ? 'denied' : 'default'); }
  LN.checkPermissions().then(function (r) { perm = map(r.display); }).catch(noop);

  var CH_ADHAN = ADHAN ? 'adhan-son' : 'adhan-defaut';
  var chA = { id: CH_ADHAN, name: 'Heure de la prière', description: 'Alerte à l\'heure de chaque prière', importance: 5, vibration: true, visibility: 1 };
  if (ADHAN) chA.sound = ADHAN;
  var channelsReady = Promise.all([
    LN.createChannel(chA).catch(noop),
    LN.createChannel({ id: 'rappel', name: 'Rappel avant la prière', description: 'Alerte discrète avant l\'heure', importance: 2, vibration: false }).catch(noop)
  ]);

  // Notification Web : l'application appelle « new Notification » ; les alertes de prière sont déjà programmées en natif
  function N(title, opts) {
    opts = opts || {};
    if (/^(Heure de|Bientôt) /.test(String(title))) return;
    LN.schedule({ notifications: [{ id: 1 + Math.floor(Math.random() * 90000), title: String(title), body: String(opts.body || ''), channelId: 'rappel', schedule: { at: new Date(Date.now() + 400) } }] }).catch(noop);
  }
  Object.defineProperty(N, 'permission', { get: function () { return perm; } });
  N.requestPermission = function (cb) {
    return LN.requestPermissions().then(function (r) { perm = map(r.display); if (cb) cb(perm); return perm; },
      function () { perm = 'denied'; if (cb) cb(perm); return perm; });
  };
  window.Notification = N;

  // Bouton de test (Réglages › Alertes) : une alerte réelle dans 10 secondes, pour vérifier le son et l'arrière-plan
  function addTestButton() {
    var help = document.getElementById('notif-help');
    if (!help || document.getElementById('notif-test-android')) return;
    var b = document.createElement('button');
    b.id = 'notif-test-android'; b.type = 'button'; b.className = 'btn'; b.style.marginTop = '10px';
    b.textContent = '🔔 Tester l\'alerte (dans 10 secondes)';
    b.addEventListener('click', function () {
      LN.requestPermissions().then(function (r) {
        if (r.display !== 'granted') { alert('Autorisez d\'abord les notifications pour Rakeb dans les réglages du téléphone.'); return null; }
        return channelsReady.then(function () {
          var n = { id: 99999, title: 'Test Rakeb', body: 'Si vous entendez ce son, les alertes de prière fonctionnent.', channelId: CH_ADHAN, schedule: { at: new Date(Date.now() + 10000), allowWhileIdle: true } };
          if (ADHAN) n.sound = ADHAN;
          return LN.schedule({ notifications: [n] }).then(function () {
            alert('Alerte programmée dans 10 secondes.\n' + (ADHAN ? 'Son : adhan intégré à l\'application.' : 'Son : son de notification du téléphone (aucun fichier adhan.mp3 dans cette version).') + '\nFermez l\'application (retour à l\'accueil) pour tester en arrière-plan.');
          });
        });
      }).catch(function () { alert('Impossible de programmer le test.'); });
    });
    help.appendChild(document.createElement('br'));
    help.appendChild(b);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addTestButton); else addTestButton();

  var running = false, again = false, lastSig = null;
  function schedule(force) {
    if (!window.RakebBridge) return;
    var list;
    try { list = window.RakebBridge.upcoming(7); } catch (e) { return; }
    var sig = JSON.stringify(list.map(function (x) { return [x.id, x.ts, x.reminder]; }));
    if (!force && sig === lastSig) return;
    if (running) { again = true; return; }
    running = true;
    LN.checkPermissions().then(function (p) { perm = map(p.display); if (perm !== 'granted') throw new Error('permission'); return channelsReady; })
      .then(function () { return LN.getPending(); })
      .then(function (r) { return r.notifications && r.notifications.length ? LN.cancel({ notifications: r.notifications }) : null; })
      .then(function () {
        if (!list.length) return null;
        var notifs = list.slice(0, 60).map(function (x, i) {
          var n = {
            id: 100000 + i,
            title: x.reminder ? 'Bientôt ' + x.name : 'Heure de ' + x.name,
            body: x.reminder ? 'Dans ' + x.reminder + ' minutes (' + x.hhmm + ')' : x.hhmm,
            channelId: x.reminder ? 'rappel' : CH_ADHAN,
            schedule: { at: new Date(x.ts), allowWhileIdle: true }
          };
          if (!x.reminder && ADHAN) n.sound = ADHAN;
          return n;
        });
        return LN.schedule({ notifications: notifs });
      })
      .then(function () { lastSig = sig; }, function () { lastSig = null; })
      .then(function () { running = false; if (again) { again = false; schedule(false); } });
  }
  // L'application change ses réglages (position, méthode, alertes activées, prières décochées…) : on reprogramme
  setInterval(function () { schedule(false); }, 4000);
  document.addEventListener('visibilitychange', function () { schedule(false); });
  window.addEventListener('pagehide', function () { schedule(false); });
})();
