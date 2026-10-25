/* Rakeb Android — pont minimal entre l'application (identique à la version Windows) et Android.
   1) Notifications : l'application utilise « new Notification(...) » ; sur Android on les envoie au système.
   2) Les appels réseau passent par le moteur natif (CapacitorHttp, activé dans capacitor.config.json) : pas de blocage CORS. */
(function () {
  'use strict';
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  // Requêtes réseau natives : un User-Agent identifiable est exigé par Wikimédia et Overpass (sinon refus 403).
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
      } catch (e) { /* on laisse la requête d'origine */ }
      return nativeFetch.call(this, input, init);
    };
  }

  var LN = C.Plugins && C.Plugins.LocalNotifications;
  if (!LN) return;

  var perm = 'default';
  function map(p) { return p === 'granted' ? 'granted' : (p === 'denied' ? 'denied' : 'default'); }
  LN.checkPermissions().then(function (r) { perm = map(r.display); }).catch(function () {});
  LN.createChannel({ id: 'adhan', name: 'Heures de prière', importance: 5, vibration: true, visibility: 1 }).catch(function () {});

  function N(title, opts) {
    opts = opts || {};
    LN.schedule({ notifications: [{
      id: 1 + Math.floor(Math.random() * 2000000000),
      title: String(title), body: String(opts.body || ''), channelId: 'adhan',
      schedule: { at: new Date(Date.now() + 400) }
    }] }).catch(function () {});
  }
  Object.defineProperty(N, 'permission', { get: function () { return perm; } });
  N.requestPermission = function (cb) {
    return LN.requestPermissions().then(function (r) { perm = map(r.display); if (cb) cb(perm); return perm; },
      function () { perm = 'denied'; if (cb) cb(perm); return perm; });
  };
  window.Notification = N;
})();
