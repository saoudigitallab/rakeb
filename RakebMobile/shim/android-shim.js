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
      var warn = function (info) {
        window.RakebCompassInfo = info;
        window.RakebCompassUnavailable = true;
        window.dispatchEvent(new CustomEvent('rakeb-no-compass', { detail: info }));
      };
      CP.sensors().catch(function () { return {}; }).then(function (info) {
        window.RakebCompassInfo = info;
        if (info && info.available === false) warn(info);
      });
      CP.start(statePos()).catch(function () { compassStarted = false; if (!window.RakebCompassUnavailable) warn({ available: false }); });
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

  // Réglages › Alertes : test réel dans 10 s, diagnostic du canal (importance, son) et raccourcis vers les réglages Android
  var IMPORTANCE = { 0: 'désactivé', 1: 'minimale', 2: 'faible (sans son)', 3: 'moyenne (son)', 4: 'haute (son)', 5: 'urgente (son)' };
  function diagnose() {
    return LN.listChannels().then(function (r) {
      var ch = (r.channels || []).filter(function (c) { return c.id === CH_ADHAN; })[0];
      if (!ch) return 'Canal d\'alerte introuvable.';
      var silent = ch.importance < 3 || !ch.sound;
      return 'Canal « ' + ch.name + ' » : importance ' + (IMPORTANCE[ch.importance] || ch.importance) + ', son : ' + (ch.sound ? (ADHAN ? 'adhan intégré' : 'son du téléphone') : 'AUCUN') + ', vibration ' + (ch.vibrate ? 'oui' : 'non') + '.' +
        (silent ? '\n\n⚠ Ce canal est silencieux : touchez « 🔊 Réglages du son » puis choisissez Importance « Urgente » (ou « Élevée ») et un son.' : '');
    }).catch(function () { return ''; });
  }
  function openSys(method, args) {
    var S = P.RakebSystem;
    if (!S) { alert('Ces réglages ne sont pas disponibles : ouvrez Réglages › Applications › Rakeb.'); return; }
    S[method](args || {}).catch(function () { alert('Impossible d\'ouvrir ces réglages : ouvrez-les à la main (Réglages › Applications › Rakeb).'); });
  }
  function makeButton(id, label, onClick) {
    var b = document.createElement('button');
    b.id = id; b.type = 'button'; b.className = 'btn'; b.style.margin = '8px 8px 0 0'; b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }
  function addTestButton() {
    var help = document.getElementById('notif-help');
    if (!help || document.getElementById('notif-test-android')) return;
    help.appendChild(document.createElement('br'));
    help.appendChild(makeButton('notif-test-android', '🔔 Tester l\'alerte (dans 10 secondes)', function () {
      if (AD) {
        AD.schedule({ events: [{ id: 299999, ts: Date.now() + 10000, title: 'Test Rakeb', body: 'Si vous entendez ceci, l\'adhan fonctionnera à l\'heure de la prière.' }] })
          .then(function () { return AD.audioInfo(); })
          .then(function (info) {
            var src = info.hasUser ? 'votre fichier d\'adhan' : (info.hasBundled ? 'l\'adhan intégré à l\'application' : 'le son de notification du téléphone (ajoutez un fichier dans « Son de l\'adhan »)');
            alert('Alarme programmée dans 10 secondes.\nSon : ' + src + '.\nLe son suit le volume des ALARMES du téléphone : vérifiez qu\'il n\'est pas à zéro.' +
              (info.exact ? '' : '\n\n⚠ Android limite les alarmes exactes : touchez « ⏰ Alarmes exactes ».') +
              '\n\nQuittez l\'application (retour à l\'accueil) pour tester en arrière-plan.');
          }).catch(function () { alert('Impossible de programmer le test.'); });
        return;
      }
      LN.requestPermissions().then(function (r) {
        if (r.display !== 'granted') { alert('Autorisez d\'abord les notifications pour Rakeb dans les réglages du téléphone.'); return null; }
        return channelsReady.then(function () {
          var n = { id: 99999, title: 'Test Rakeb', body: 'Si vous entendez ce son, les alertes de prière fonctionnent.', channelId: CH_ADHAN, schedule: { at: new Date(Date.now() + 10000), allowWhileIdle: true } };
          if (ADHAN) n.sound = ADHAN;
          return LN.schedule({ notifications: [n] }).then(diagnose).then(function (info) {
            alert('Alerte programmée dans 10 secondes.\n' + info + '\n\nQuittez l\'application (retour à l\'accueil) pour tester en arrière-plan.');
          });
        });
      }).catch(function () { alert('Impossible de programmer le test.'); });
    }));
    if (AD) {
      help.appendChild(makeButton('adhan-play-now', '▶ Écouter l\'adhan maintenant', function () { AD.playNow().catch(function () { alert('Lecture impossible.'); }); }));
      help.appendChild(makeButton('adhan-stop', '⏹ Arrêter le son', function () { AD.stop().catch(noop); }));
      help.appendChild(makeButton('adhan-exact', '⏰ Alarmes exactes', function () { AD.openExactAlarmSettings().catch(function () { alert('Rien à régler sur ce téléphone : les alarmes exactes sont déjà autorisées.'); }); }));
    }
    help.appendChild(makeButton('notif-sound-settings', '🔊 Réglages du son', function () { openSys('openChannelSettings', { channel: CH_ADHAN }); }));
    help.appendChild(makeButton('notif-battery-settings', '🔋 Batterie (arrière-plan)', function () { openSys('openBatterySettings'); }));
    help.appendChild(makeButton('notif-app-settings', '⚙️ Réglages de l\'application', function () { openSys('openAppSettings'); }));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addTestButton); else addTestButton();

  var AD = P.RakebAdhan; // alarmes + lecture native de l'adhan (volume des alarmes, indépendant des notifications)
  var running = false, again = false, lastSig = null;
  function schedule(force) {
    if (!window.RakebBridge) return;
    var list;
    try { list = window.RakebBridge.upcoming(7); } catch (e) { return; }
    var sig = JSON.stringify(list.map(function (x) { return [x.id, x.ts, x.reminder]; }));
    if (!force && sig === lastSig) return;
    if (running) { again = true; return; }
    running = true;
    var prayers = list.filter(function (x) { return !x.reminder; });
    var reminders = list.filter(function (x) { return x.reminder; });
    var toLN = AD ? reminders : list; // avec le module natif, seuls les rappels « Bientôt » passent par les notifications
    var nativeStep = AD
      ? AD.schedule({ events: prayers.slice(0, 40).map(function (x, i) { return { id: 200000 + i, ts: x.ts, title: 'Heure de ' + x.name, body: x.hhmm }; }) })
      : Promise.resolve();
    nativeStep.catch(noop)
      .then(function () { return LN.checkPermissions(); })
      .then(function (p) { perm = map(p.display); if (perm !== 'granted') throw new Error('permission'); return channelsReady; })
      .then(function () { return LN.getPending(); })
      .then(function (r) { return r.notifications && r.notifications.length ? LN.cancel({ notifications: r.notifications }) : null; })
      .then(function () {
        if (!toLN.length) return null;
        var notifs = toLN.slice(0, 60).map(function (x, i) {
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

  /* Son de l'adhan choisi dans Réglages (stocké dans IndexedDB par l'application) : copié vers le module natif */
  var audioBusy = false;
  function readAdhanRecord(cb) {
    try {
      var req = indexedDB.open('rakeb-media', 1);
      req.onupgradeneeded = function () { req.result.createObjectStore('audio'); };
      req.onerror = function () { cb(null); };
      req.onsuccess = function () {
        var db = req.result;
        try {
          var g = db.transaction('audio', 'readonly').objectStore('audio').get('adhan');
          g.onsuccess = function () { cb(g.result || null); db.close(); };
          g.onerror = function () { cb(null); db.close(); };
        } catch (e) { cb(null); try { db.close(); } catch (e2) { /* ignoré */ } }
      };
    } catch (e) { cb(null); }
  }
  function sendAudio(rec, sig) {
    var CH = 600 * 1024, total = Math.max(1, Math.ceil(rec.blob.size / CH)), i = 0;
    return new Promise(function (resolve, reject) {
      (function next() {
        if (i >= total) { resolve(); return; }
        var fr = new FileReader();
        fr.onload = function () {
          AD.setAudio({ data: String(fr.result).split(',')[1] || '', index: i, total: total, sig: sig }).then(function () { i++; next(); }, reject);
        };
        fr.onerror = function () { reject(new Error('lecture')); };
        fr.readAsDataURL(rec.blob.slice(i * CH, (i + 1) * CH));
      })();
    });
  }
  function syncAudio() {
    if (!AD || audioBusy) return;
    audioBusy = true;
    var done = function () { audioBusy = false; };
    readAdhanRecord(function (rec) {
      AD.audioInfo().then(function (info) {
        if (rec && rec.blob) {
          var sig = (rec.name || '') + '|' + rec.blob.size;
          if (info.hasUser && info.sig === sig) return null;
          return sendAudio(rec, sig);
        }
        return info.hasUser ? AD.clearAudio() : null;
      }).catch(noop).then(done);
    });
  }
  syncAudio();
  setInterval(syncAudio, 5000);

  // L'application change ses réglages (position, méthode, alertes activées, prières décochées…) : on reprogramme
  setInterval(function () { schedule(false); }, 4000);
  document.addEventListener('visibilitychange', function () { schedule(false); });
  window.addEventListener('pagehide', function () { schedule(false); });
})();
