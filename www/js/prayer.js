/* Calcul des horaires de prière et de la Qibla — 100 % local, sans réseau. */
(function (R) {
  'use strict';
  var D2R = Math.PI / 180, R2D = 180 / Math.PI;
  function sin(d) { return Math.sin(d * D2R); }
  function cos(d) { return Math.cos(d * D2R); }
  function tan(d) { return Math.tan(d * D2R); }
  function asin(x) { return Math.asin(x) * R2D; }
  function acos(x) { return Math.acos(x) * R2D; }
  function atan2(y, x) { return Math.atan2(y, x) * R2D; }
  function acot(x) { return Math.atan(1 / x) * R2D; }
  function fix(a, b) { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; }

  var METHODS = {
    MWL:     { nom: 'Ligue islamique mondiale', fajr: 18,   isha: 17 },
    UOIF:    { nom: 'UOIF (France)',            fajr: 12,   isha: 12 },
    ISNA:    { nom: 'ISNA (Amérique du Nord)',  fajr: 15,   isha: 15 },
    EGYPTE:  { nom: 'Autorité égyptienne',      fajr: 19.5, isha: 17.5 },
    MAKKAH:  { nom: 'Umm al-Qura (La Mecque)',  fajr: 18.5, ishaMin: 90 },
    KARACHI: { nom: 'Université de Karachi',    fajr: 18,   isha: 18 }
  };

  function julian(y, m, d) { // jour julien à 0 h UT
    if (m <= 2) { y -= 1; m += 12; }
    var A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }
  function sunPosition(jd) {
    var D = jd - 2451545.0;
    var g = fix(357.529 + 0.98560028 * D, 360);
    var q = fix(280.459 + 0.98564736 * D, 360);
    var L = fix(q + 1.915 * sin(g) + 0.020 * sin(2 * g), 360);
    var e = 23.439 - 0.00000036 * D;
    var RA = fix(atan2(cos(e) * sin(L), cos(L)), 360) / 15;
    var eqt = q / 15 - RA;
    while (eqt > 12) eqt -= 24;
    while (eqt < -12) eqt += 24;
    return { decl: asin(sin(e) * sin(L)), eqt: eqt };
  }
  function toDate(jd) { return new Date(Math.round((jd - 2440587.5) * 86400000)); }

  // heures (angle) avant/après le midi solaire pour un angle sous l'horizon
  function hourAngle(angle, lat, decl) {
    var c = (-sin(angle) - sin(lat) * sin(decl)) / (cos(lat) * cos(decl));
    return c < -1 || c > 1 ? NaN : acos(c) / 15;
  }
  function asrAngle(factor, lat, decl) {
    var a = -acot(factor + tan(Math.abs(lat - decl)));
    return hourAngle(a, lat, decl);
  }

  /** y, m (1-12), d = date civile locale du lieu. Retourne des objets Date (instants absolus). */
  function times(y, m, d, lat, lon, methodKey, asrFactor) {
    var M = METHODS[methodKey] || METHODS.MWL;
    var jd0 = julian(y, m, d) + 0.5 - lon / 360; // midi solaire moyen approximatif
    var sp = sunPosition(jd0);
    var transit = jd0 - sp.eqt / 24;
    function at(fn, sign) { // deux itérations pour tenir compte du mouvement du Soleil
      var jd = transit, t = NaN, i;
      for (i = 0; i < 2; i++) {
        var p = sunPosition(jd);
        t = fn(p.decl);
        if (isNaN(t)) return NaN;
        jd = transit + sign * t / 24;
      }
      return jd;
    }
    var jdSunrise = at(function (dc) { return hourAngle(0.833, lat, dc); }, -1);
    var jdSunset  = at(function (dc) { return hourAngle(0.833, lat, dc); },  1);
    if (isNaN(jdSunrise) || isNaN(jdSunset)) return null; // soleil de minuit / nuit polaire
    var jdFajr = at(function (dc) { return hourAngle(M.fajr, lat, dc); }, -1);
    var jdIsha = M.ishaMin ? jdSunset + M.ishaMin / 1440
                           : at(function (dc) { return hourAngle(M.isha, lat, dc); }, 1);
    var night = 1 - (jdSunset - jdSunrise); // durée de la nuit en jours (hautes latitudes)
    if (isNaN(jdFajr)) jdFajr = jdSunrise - night / 7;
    if (isNaN(jdIsha)) jdIsha = jdSunset + night / 7;
    var jdAsr = at(function (dc) { return asrAngle(asrFactor === 2 ? 2 : 1, lat, dc); }, 1);
    if (isNaN(jdAsr)) jdAsr = transit + 0.15;
    return {
      fajr: toDate(jdFajr), sunrise: toDate(jdSunrise), dhuhr: toDate(transit),
      asr: toDate(jdAsr), maghrib: toDate(jdSunset), isha: toDate(jdIsha)
    };
  }

  function qibla(lat, lon) {
    var kLat = 21.4225, kLon = 39.8262, dl = kLon - lon;
    var y = sin(dl), x = cos(lat) * tan(kLat) - sin(lat) * cos(dl);
    return fix(atan2(y, x), 360);
  }
  function distanceKaaba(lat, lon) {
    var kLat = 21.4225, kLon = 39.8262;
    var a = sin((kLat - lat) / 2) * sin((kLat - lat) / 2) +
            cos(lat) * cos(kLat) * sin((kLon - lon) / 2) * sin((kLon - lon) / 2);
    return 2 * 6371 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /** Date civile (y, m, d) d'un instant dans un fuseau IANA. */
  function dateParts(date, tz) {
    var f = new Intl.DateTimeFormat('en-CA', { timeZone: tz || undefined, year: 'numeric', month: '2-digit', day: '2-digit' });
    var p = f.format(date).split('-');
    return { y: +p[0], m: +p[1], d: +p[2] };
  }
  function addDays(p, n) {
    var t = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  }
  function key(p) { return p.y + '-' + ('0' + p.m).slice(-2) + '-' + ('0' + p.d).slice(-2); }

  var ORDER = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
  var NOMS = { fajr: 'Fajr', sunrise: 'Lever du soleil', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };

  /** Prochaine prière à partir de maintenant. Retourne {id, nom, date} ou null. */
  function next(now, loc, cfg) {
    var base = dateParts(now, loc.tz), i, d, t, k;
    for (d = 0; d < 2; d++) {
      var p = addDays(base, d);
      t = times(p.y, p.m, p.d, loc.lat, loc.lon, cfg.method, cfg.asr);
      if (!t) return null;
      for (i = 0; i < ORDER.length; i++) {
        k = ORDER[i];
        if (k !== 'sunrise' && t[k] > now) return { id: k, nom: NOMS[k], date: t[k] };
      }
    }
    return null;
  }

  R.prayer = {
    METHODS: METHODS, ORDER: ORDER, NOMS: NOMS,
    times: times, qibla: qibla, distanceKaaba: distanceKaaba,
    dateParts: dateParts, addDays: addDays, key: key, next: next
  };
})(window.R = window.R || {});
