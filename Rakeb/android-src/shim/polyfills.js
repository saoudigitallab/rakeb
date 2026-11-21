/* Compléments pour les anciennes WebView Android (Android 5.1 à 8, quand « Android System WebView » n'a pas été mis à jour).
   Syntaxe ES5 uniquement : ce fichier doit pouvoir s'exécuter partout. */
(function () {
  'use strict';
  if (!String.prototype.padStart) {
    String.prototype.padStart = function (len, pad) {
      var s = String(this); pad = pad === undefined ? ' ' : String(pad);
      if (s.length >= len || !pad) return s;
      var need = len - s.length, p = '';
      while (p.length < need) p += pad;
      return p.slice(0, need) + s;
    };
  }
  if (!String.prototype.padEnd) {
    String.prototype.padEnd = function (len, pad) {
      var s = String(this); pad = pad === undefined ? ' ' : String(pad);
      if (s.length >= len || !pad) return s;
      var need = len - s.length, p = '';
      while (p.length < need) p += pad;
      return s + p.slice(0, need);
    };
  }
  if (!Object.entries) Object.entries = function (o) { return Object.keys(o).map(function (k) { return [k, o[k]]; }); };
  if (!Object.values) Object.values = function (o) { return Object.keys(o).map(function (k) { return o[k]; }); };
  if (window.Promise && !Promise.prototype['finally']) {
    Promise.prototype['finally'] = function (f) {
      var P = this.constructor;
      return this.then(function (v) { return P.resolve(f()).then(function () { return v; }); },
                       function (e) { return P.resolve(f()).then(function () { throw e; }); });
    };
  }
  if (window.Element && !Element.prototype.closest) {
    Element.prototype.closest = function (sel) {
      var el = this;
      while (el && el.nodeType === 1) { if ((el.matches || el.msMatchesSelector || el.webkitMatchesSelector).call(el, sel)) return el; el = el.parentElement; }
      return null;
    };
  }
  if (!Array.prototype.includes) {
    Array.prototype.includes = function (x, from) { return this.indexOf(x, from) !== -1; };
  }
  if (!String.prototype.includes) {
    String.prototype.includes = function (x, from) { return this.indexOf(x, from) !== -1; };
  }
  if (!window.CustomEvent || typeof window.CustomEvent !== 'function') {
    window.CustomEvent = function (name, p) {
      p = p || { bubbles: false, cancelable: false, detail: null };
      var e = document.createEvent('CustomEvent'); e.initCustomEvent(name, p.bubbles, p.cancelable, p.detail); return e;
    };
  }

  /* WebView trop ancienne pour exécuter l'application : message clair au lieu d'un écran vide */
  var m = /Chrome\/(\d+)/.exec(navigator.userAgent || '');
  var tooOld = (m && parseInt(m[1], 10) < 51) || !window.Promise || !window.fetch || !window.indexedDB;
  if (tooOld) {
    window.RakebTooOld = true;
    document.addEventListener('DOMContentLoaded', function () {
      document.body.innerHTML = '<div style="padding:28px;font:17px/1.5 sans-serif;color:#eef3f1;background:#0b1f1c;min-height:100vh">' +
        '<h2 style="color:#e3c766">Mise à jour nécessaire</h2>' +
        '<p>Le composant Android qui affiche Rakeb (« Android System WebView ») est trop ancien' + (m ? ' (version ' + m[1] + ')' : '') + '.</p>' +
        '<p>Ouvrez le <strong>Play Store</strong>, cherchez <strong>« Android System WebView »</strong> (ou « Google Chrome ») et touchez <strong>Mettre à jour</strong>, puis relancez Rakeb.</p></div>';
    });
  }
})();
