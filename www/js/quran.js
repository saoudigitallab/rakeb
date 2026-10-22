/* Coran : texte et traduction (api.alquran.cloud), audio (mp3quran.net). */
(function (R) {
  'use strict';
  var API = 'https://api.alquran.cloud/v1';
  function getJSON(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }
  function surahs() {
    var cached = R.store.get('quran.list', null);
    if (cached) return Promise.resolve(cached);
    return getJSON(API + '/surah').then(function (j) {
      var l = j.data.map(function (s) { return { n: s.number, ar: s.name, en: s.englishName, tr: s.englishNameTranslation, v: s.numberOfAyahs, type: s.revelationType }; });
      R.store.set('quran.list', l);
      return l;
    });
  }
  function surah(n) {
    var key = 'quran.s' + n, cached = R.store.get(key, null);
    if (cached) return Promise.resolve(cached);
    return getJSON(API + '/surah/' + n + '/editions/quran-uthmani,fr.hamidullah').then(function (j) {
      var ar = j.data[0].ayahs, fr = j.data[1].ayahs;
      var out = ar.map(function (a, i) { return { n: a.numberInSurah, ar: a.text, fr: fr[i] ? fr[i].text : '' }; });
      R.store.set(key, out);
      return out;
    });
  }
  function audioUrl(n) { return 'https://server8.mp3quran.net/afs/' + ('00' + n).slice(-3) + '.mp3'; }
  R.quran = { surahs: surahs, surah: surah, audioUrl: audioUrl };
})(window.R = window.R || {});
