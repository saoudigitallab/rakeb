/* Stockage local (localStorage) : tout reste sur l'appareil. */
(function (R) {
  'use strict';
  var P = 'rakeb.';
  var DEFAULTS = {
    method: 'MWL', asr: 1, notif: false,
    loc: { name: 'Dakar', lat: 14.6937, lon: -17.4441, tz: 'Africa/Dakar' },
    model: 'claude-haiku-5-5', currency: 'FCFA'
  };
  function get(k, def) {
    try { var v = localStorage.getItem(P + k); return v === null ? def : JSON.parse(v); } catch (e) { return def; }
  }
  function set(k, v) { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) { /* stockage plein ou refusé */ } }
  function del(k) { try { localStorage.removeItem(P + k); } catch (e) { /* rien */ } }
  function delPrefix(prefix) {
    try {
      var rm = [], i;
      for (i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf(P + prefix) === 0) rm.push(k); }
      rm.forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) { /* rien */ }
  }
  function settings() {
    var s = get('settings', {}), o = {}, k;
    for (k in DEFAULTS) o[k] = s[k] !== undefined ? s[k] : DEFAULTS[k];
    return o;
  }
  function save(patch) { var s = get('settings', {}), k; for (k in patch) s[k] = patch[k]; set('settings', s); }
  R.store = { get: get, set: set, del: del, delPrefix: delPrefix, settings: settings, save: save };
})(window.R = window.R || {});
