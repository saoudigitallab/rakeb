/* Rappels de prière : notifications locales (Android) ou minuteur + notification (PC, application ouverte). */
(function (R) {
  'use strict';
  var timer = null;
  var IDS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

  function plugin() {
    return window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins.LocalNotifications : null;
  }
  function isNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }
  function beep() {
    try {
      var C = window.AudioContext || window.webkitAudioContext, a = new C(), o = a.createOscillator(), g = a.createGain();
      o.type = 'sine'; o.frequency.value = 660; g.gain.value = 0.15;
      o.connect(g); g.connect(a.destination); o.start();
      setTimeout(function () { o.stop(); a.close(); }, 900);
    } catch (e) { /* pas d'audio */ }
  }
  function message(id) { return { title: 'Rakeb — ' + R.prayer.NOMS[id], body: 'C\'est l\'heure de la prière de ' + R.prayer.NOMS[id] + '.' }; }

  /** Demande l'autorisation. Retourne true si accordée. */
  function ask() {
    var p = plugin();
    if (isNative() && p) {
      return p.requestPermissions().then(function (r) { return r.display === 'granted'; }, function () { return false; });
    }
    if (!('Notification' in window)) return Promise.resolve(false);
    if (Notification.permission === 'granted') return Promise.resolve(true);
    return Notification.requestPermission().then(function (r) { return r === 'granted'; });
  }

  function upcoming(loc, cfg, days) {
    var out = [], base = R.prayer.dateParts(new Date(), loc.tz), d, i, now = Date.now();
    for (d = 0; d < days; d++) {
      var p = R.prayer.addDays(base, d), t = R.prayer.times(p.y, p.m, p.d, loc.lat, loc.lon, cfg.method, cfg.asr);
      if (!t) continue;
      for (i = 0; i < IDS.length; i++) if (t[IDS[i]].getTime() > now) out.push({ id: IDS[i], at: t[IDS[i]], n: d * 10 + i });
    }
    return out;
  }

  /** (Re)programme les rappels selon les réglages. À appeler à chaque ouverture et chaque changement. */
  function rearm(loc, cfg) {
    var p = plugin(), list;
    clearTimeout(timer);
    if (isNative() && p) {
      p.getPending().then(function (r) { return r.notifications.length ? p.cancel({ notifications: r.notifications }) : null; })
        .then(function () {
          if (!cfg.notif) return null;
          return p.createChannel({ id: 'adhan', name: 'Heures de prière', importance: 5, vibration: true, visibility: 1 }).catch(function () {})
            .then(function () {
              var notifs = upcoming(loc, cfg, 3).map(function (u) {
                var m = message(u.id);
                return { id: 1000 + u.n, title: m.title, body: m.body, channelId: 'adhan', schedule: { at: u.at, allowWhileIdle: true } };
              });
              return notifs.length ? p.schedule({ notifications: notifs }) : null;
            });
        }).catch(function () { /* autorisation refusée : rien à programmer */ });
      return;
    }
    if (!cfg.notif || !('Notification' in window) || Notification.permission !== 'granted') return;
    list = upcoming(loc, cfg, 2);
    if (!list.length) return;
    var u = list[0], delay = Math.min(u.at.getTime() - Date.now(), 2147000000);
    timer = setTimeout(function () {
      var m = message(u.id);
      try { new Notification(m.title, { body: m.body, icon: 'assets/icon.png' }); } catch (e) { /* ignoré */ }
      beep();
      rearm(loc, cfg);
    }, delay);
  }

  R.notify = { ask: ask, rearm: rearm, isNative: isNative };
})(window.R = window.R || {});
