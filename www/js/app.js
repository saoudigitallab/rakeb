/* Rakeb — interface (une seule base de code pour Android et Windows). */
(function (R) {
  'use strict';
  R.version = '1.0.0';
  var CONTACT = { tel: '+221764182200', wa: '221764182200', mail: 'saoudigitallab@gmail.com' };
  var isDesktop = !!window.rakebDesktop;
  var isNative = R.notify.isNative();
  var state = { day: 0, sura: null, suraList: null, chat: null, cleanup: null, busy: false };

  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.className = 'show';
    clearTimeout(toast.h); toast.h = setTimeout(function () { t.className = ''; }, 2800);
  }
  function pad(n) { return ('0' + n).slice(-2); }
  function fmtTime(d, tz) { return d.toLocaleTimeString('fr-FR', { timeZone: tz, hour: '2-digit', minute: '2-digit' }); }
  function fmtDay(p) {
    var d = new Date(Date.UTC(p.y, p.m - 1, p.d, 12)), g = '', h = '';
    g = d.toLocaleDateString('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    try { h = new Intl.DateTimeFormat('fr-FR-u-ca-islamic-umalqura', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(d); } catch (e) { h = ''; }
    return { g: g, h: h };
  }
  function cfg() { var s = R.store.settings(); return { method: s.method, asr: Number(s.asr), notif: !!s.notif }; }
  function openText(s) { return encodeURIComponent(s); }

  /* ---------- Prières ---------- */
  function streak(tz) {
    var base = R.prayer.dateParts(new Date(), tz), n = 0, i = 0, done;
    function full(p) { var t = R.store.get('t.' + R.prayer.key(p), {}); return ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].every(function (k) { return t[k]; }); }
    if (!full(base)) i = 1;
    for (; i < 3650; i++) { done = full(R.prayer.addDays(base, -i)); if (!done) break; n++; }
    return n;
  }
  function viewPrieres() {
    var s = R.store.settings(), loc = s.loc, c = cfg(), now = new Date();
    var base = R.prayer.dateParts(now, loc.tz), p = R.prayer.addDays(base, state.day), key = R.prayer.key(p);
    var t = R.prayer.times(p.y, p.m, p.d, loc.lat, loc.lon, c.method, c.asr), day = fmtDay(p);
    var h = '<div class="card"><div class="row between"><button class="btn sec" data-act="day" data-d="-1" aria-label="Jour précédent">‹</button>' +
      '<div style="text-align:center"><strong>' + esc(day.g) + '</strong><br><span class="muted">' + esc(day.h) + '</span></div>' +
      '<button class="btn sec" data-act="day" data-d="1" aria-label="Jour suivant">›</button></div>' +
      (state.day !== 0 ? '<p style="text-align:center"><button class="btn sec" data-act="day" data-d="0">Aujourd\'hui</button></p>' : '') + '</div>';
    if (!t) return { html: h + '<div class="card">Les horaires ne peuvent pas être calculés à cette latitude. Choisissez une autre ville dans Paramètres.</div>' };
    var nx = state.day === 0 ? R.prayer.next(now, loc, c) : null;
    if (nx) {
      h += '<div class="card next" aria-live="off"><div class="nm">Prochaine prière : ' + esc(nx.nom) + '</div><div class="tm">' + fmtTime(nx.date, loc.tz) +
        '</div><div class="cd" id="cd" data-at="' + nx.date.getTime() + '"></div></div>';
    }
    var track = R.store.get('t.' + key, {}), rows = '';
    R.prayer.ORDER.forEach(function (id) {
      var isP = id !== 'sunrise', on = !!track[id];
      rows += '<li class="' + (nx && nx.id === id ? 'cur' : '') + '"><span class="n">' + R.prayer.NOMS[id] + '</span><span class="t">' + fmtTime(t[id], loc.tz) + '</span>' +
        (isP ? '<button class="chk" data-act="track" data-id="' + id + '" aria-pressed="' + on + '" aria-label="' + R.prayer.NOMS[id] + ' accomplie">✓</button>' : '<span class="chk none"></span>') + '</li>';
    });
    h += '<div class="card"><div class="row between"><h3>Horaires — ' + esc(loc.name) + '</h3><span class="badge" title="Jours consécutifs avec les 5 prières">🔥 ' + streak(loc.tz) + ' j</span></div><ul class="times">' + rows + '</ul>' +
      '<p class="muted" style="font-size:13px">Méthode : ' + esc((R.prayer.METHODS[c.method] || {}).nom || '') + (c.asr === 2 ? ' · Asr hanafite' : '') + '</p></div>';
    return { html: h };
  }
  function tick() {
    var el = $('#cd'); if (!el) return;
    var ms = Number(el.getAttribute('data-at')) - Date.now();
    if (ms <= 0) { render(); return; }
    var s = Math.floor(ms / 1000);
    el.textContent = 'dans ' + pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s % 3600 / 60)) + ':' + pad(s % 60);
  }

  /* ---------- Qibla ---------- */
  var CARD = ['Nord', 'Nord-Est', 'Est', 'Sud-Est', 'Sud', 'Sud-Ouest', 'Ouest', 'Nord-Ouest'];
  function viewQibla() {
    var loc = R.store.settings().loc, q = R.prayer.qibla(loc.lat, loc.lon), dist = Math.round(R.prayer.distanceKaaba(loc.lat, loc.lon));
    var html = '<div class="card" style="text-align:center"><h3>Direction de la Qibla</h3><div class="compass" id="compass"><div class="pointer"></div>' +
      '<div class="disk" id="disk"><span class="n">N</span><div class="kaaba" style="transform:rotate(' + q.toFixed(1) + 'deg)"></div></div><div class="center-dot"></div></div>' +
      '<p class="gold" style="font-size:22px;margin:0">' + Math.round(q) + '° ' + CARD[Math.round(q / 45) % 8] + '</p>' +
      '<p class="muted">Depuis ' + esc(loc.name) + ' · ' + dist.toLocaleString('fr-FR') + ' km de la Kaaba</p>' +
      '<p class="muted" id="cmsg" style="font-size:14px">Boussole : recherche du capteur…</p></div>' +
      '<div class="card"><p class="muted">Sur téléphone et tablette, tournez l\'appareil à plat jusqu\'à ce que la Kaaba 🕋 soit en haut, sous la flèche. Éloignez-vous des objets métalliques. Sur PC, utilisez l\'angle indiqué par rapport au nord.</p></div>';
    return { html: html, after: function () {
      var disk = $('#disk'), msg = $('#cmsg'), got = false;
      function onOri(e) {
        var hd = null;
        if (typeof e.webkitCompassHeading === 'number') hd = e.webkitCompassHeading;
        else if (e.alpha !== null && e.alpha !== undefined && (e.absolute || e.type === 'deviceorientationabsolute')) hd = 360 - e.alpha;
        if (hd === null || !disk) return;
        got = true; disk.style.transform = 'rotate(' + (-hd).toFixed(1) + 'deg)';
        msg.textContent = 'Boussole active';
      }
      var ev = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
      window.addEventListener(ev, onOri, true);
      state.cleanup = function () { window.removeEventListener(ev, onOri, true); };
      setTimeout(function () { if (!got && msg) msg.textContent = 'Pas de boussole sur cet appareil : suivez l\'angle indiqué par rapport au nord.'; }, 2500);
    } };
  }

  /* ---------- Coran ---------- */
  function viewCoran() {
    if (state.sura) return viewSura();
    return { html: '<h2>Coran</h2><input type="search" id="qsearch" placeholder="Rechercher une sourate…" aria-label="Rechercher une sourate"><div class="card" style="margin-top:12px"><div id="qlist" class="muted">Chargement…</div></div>',
      after: function () {
        R.quran.surahs().then(function (l) { state.suraList = l; fillList(''); },
          function () { $('#qlist').textContent = 'Connexion Internet nécessaire pour la première ouverture.'; });
      } };
  }
  function fillList(q) {
    var l = state.suraList || [], box = $('#qlist'); if (!box) return;
    q = q.trim().toLowerCase();
    var f = l.filter(function (s) { return !q || String(s.n) === q || s.en.toLowerCase().indexOf(q) >= 0 || s.tr.toLowerCase().indexOf(q) >= 0 || s.ar.indexOf(q) >= 0; });
    box.className = '';
    box.innerHTML = f.map(function (s) {
      return '<button class="sura" data-act="sura" data-n="' + s.n + '"><span class="num">' + s.n + '</span><span><strong>' + esc(s.en) + '</strong><br><span class="muted" style="font-size:13px">' + esc(s.tr) + ' · ' + s.v + ' versets</span></span><span class="ar">' + esc(s.ar) + '</span></button>';
    }).join('') || '<p class="muted">Aucune sourate trouvée.</p>';
  }
  function viewSura() {
    var n = state.sura;
    return { html: '<div class="row between"><button class="btn sec" data-act="back">‹ Sourates</button><span class="muted">Sourate ' + n + '</span></div>' +
      '<div class="card" style="margin-top:12px"><audio controls preload="none" src="' + R.quran.audioUrl(n) + '" aria-label="Écouter la sourate"></audio><div id="ayat" class="muted">Chargement…</div></div>',
      after: function () {
        R.store.set('lastsura', n);
        R.quran.surah(n).then(function (a) {
          $('#ayat').className = '';
          $('#ayat').innerHTML = a.map(function (v) {
            return '<div class="ayah"><div class="v">' + v.n + '</div><div class="ar" lang="ar">' + esc(v.ar) + '</div><div class="fr">' + esc(v.fr) + '</div></div>';
          }).join('');
        }, function () { $('#ayat').textContent = 'Connexion Internet nécessaire pour charger cette sourate.'; });
      } };
  }

  /* ---------- Muslim IA ---------- */
  function viewIA() {
    state.chat = state.chat || R.store.get('chat', []);
    var hasKey = !!R.store.get('apikey', '');
    var msgs = state.chat.map(function (m) { return '<div class="msg ' + (m.role === 'user' ? 'user' : m.err ? 'err' : 'ai') + '">' + esc(m.content) + '</div>'; }).join('');
    return { html: '<h2>Muslim IA</h2>' +
      (hasKey ? '' : '<div class="card"><p>Pour utiliser Muslim IA, ajoutez votre clé API Anthropic dans <a class="gold" href="#/reglages">Paramètres</a>.</p></div>') +
      '<div class="chat" id="chat" aria-live="polite">' + (msgs || '<p class="muted">Posez une question sur l\'islam. Les réponses sont générées par une IA : elles peuvent comporter des erreurs et ne remplacent pas l\'avis d\'un savant qualifié.</p>') + '</div>' +
      '<textarea id="q" placeholder="Votre question…" aria-label="Votre question"' + (hasKey ? '' : ' disabled') + '></textarea>' +
      '<div class="wrap" style="margin-top:10px"><button class="btn" data-act="ask"' + (hasKey ? '' : ' disabled') + '>Envoyer</button><button class="btn sec" data-act="clearchat">Effacer la conversation</button></div>' };
  }
  function ask() {
    var q = $('#q'), text = q.value.trim();
    if (!text || state.busy) return;
    state.busy = true; state.chat.push({ role: 'user', content: text });
    var api = state.chat.filter(function (m) { return !m.err; }).map(function (m) { return { role: m.role, content: m.content }; });
    render();
    R.ai.ask(api).then(function (a) { state.chat.push({ role: 'assistant', content: a || '…' }); },
      function (e) { state.chat.push({ role: 'assistant', content: e.message, err: true }); })
      .then(function () { state.busy = false; R.store.set('chat', state.chat.filter(function (m) { return !m.err; }).slice(-30)); render(); });
  }

  /* ---------- Plus : menu, tasbih, zakat ---------- */
  function viewPlus() {
    return { html: '<h2>Plus</h2><div class="card">' +
      '<a class="list-link" href="#/tasbih">Tasbih <span>›</span></a><a class="list-link" href="#/zakat">Calculateur de zakat <span>›</span></a>' +
      '<a class="list-link" href="#/reglages">Paramètres <span>›</span></a><a class="list-link" href="#/apropos">À propos de Rakeb et de SAOU DIGITAL LAB <span>›</span></a>' +
      '<a class="list-link" href="#/confidentialite">Politique de confidentialité <span>›</span></a></div>' };
  }
  function viewTasbih() {
    var t = R.store.get('tasbih', { count: 0, target: 33 });
    return { html: '<h2>Tasbih</h2><div class="card" style="text-align:center"><button class="tas" data-act="tas" id="tas" aria-label="Compter">' + t.count + '</button>' +
      '<p class="muted" id="tasinfo">' + (t.target ? 'Objectif : ' + t.target : 'Sans objectif') + '</p>' +
      '<div class="wrap" style="justify-content:center">' + [33, 99, 100, 0].map(function (n) { return '<button class="btn ' + (t.target === n ? '' : 'sec') + '" data-act="target" data-n="' + n + '">' + (n || '∞') + '</button>'; }).join('') +
      '<button class="btn danger" data-act="tasreset">Remettre à zéro</button></div></div>' };
  }
  var ZF = [['cash', 'Espèces et épargne'], ['goldg', 'Or possédé (grammes)'], ['silverg', 'Argent possédé (grammes)'], ['goods', 'Marchandises destinées à la vente'], ['recv', 'Créances sûres'], ['debts', 'Dettes à payer prochainement'], ['pgold', 'Prix du gramme d\'or'], ['psilver', 'Prix du gramme d\'argent']];
  function viewZakat() {
    var z = R.store.get('zakat', {}), cur = esc(R.store.settings().currency);
    return { html: '<h2>Zakat</h2><div class="card"><p class="muted">Montants en ' + cur + '. Le seuil (nisab) est calculé sur 85 g d\'or. La zakat est de 2,5 % du patrimoine net, détenu depuis un an lunaire.</p>' +
      ZF.map(function (f) { return '<label class="f" for="z_' + f[0] + '">' + f[1] + '</label><input type="number" inputmode="decimal" min="0" id="z_' + f[0] + '" data-act="zin" data-k="' + f[0] + '" value="' + esc(z[f[0]] || '') + '">'; }).join('') +
      '</div><div class="card res" id="zres"></div><p class="muted" style="font-size:13px">Outil d\'aide : pour un cas particulier, consultez un savant qualifié.</p>',
      after: zcalc };
  }
  function zcalc() {
    var z = R.store.get('zakat', {}), n = function (k) { return parseFloat(z[k]) || 0; }, el = $('#zres'); if (!el) return;
    var cur = R.store.settings().currency, fmt = function (v) { return Math.round(v).toLocaleString('fr-FR') + ' ' + cur; };
    var total = n('cash') + n('goldg') * n('pgold') + n('silverg') * n('psilver') + n('goods') + n('recv'), net = total - n('debts'), nisab = 85 * n('pgold');
    var h = 'Patrimoine net : <strong>' + fmt(net) + '</strong><br>';
    if (!nisab) h += '<span class="muted">Saisissez le prix du gramme d\'or pour connaître le seuil.</span>';
    else if (net >= nisab) h += 'Seuil (nisab) : ' + fmt(nisab) + '<br>Zakat à verser : <strong>' + fmt(net * 0.025) + '</strong>';
    else h += 'Seuil (nisab) : ' + fmt(nisab) + '<br>Le seuil n\'est pas atteint : pas de zakat à verser.';
    el.innerHTML = h;
  }

  /* ---------- Paramètres ---------- */
  function viewReglages() {
    var s = R.store.settings(), loc = s.loc, hasKey = !!R.store.get('apikey', '');
    var cities = R.cities.map(function (c) { return '<option value="' + esc(c.name) + '"' + (c.name === loc.name ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('');
    var custom = !R.cities.some(function (c) { return c.name === loc.name; });
    var meth = Object.keys(R.prayer.METHODS).map(function (k) { return '<option value="' + k + '"' + (k === s.method ? ' selected' : '') + '>' + esc(R.prayer.METHODS[k].nom) + '</option>'; }).join('');
    return { html: '<h2>Paramètres</h2>' +
      '<div class="card"><h3>Lieu</h3><p class="muted">Actuel : ' + esc(loc.name) + ' (' + loc.lat.toFixed(3) + ', ' + loc.lon.toFixed(3) + ')</p>' +
      '<label class="f" for="city-sel">Ville</label><select id="city-sel" data-act="city">' + (custom ? '<option selected>' + esc(loc.name) + '</option>' : '') + cities + '</select>' +
      '<div class="wrap" style="margin-top:10px"><button class="btn sec" data-act="gps">📍 Ma position</button>' + (isDesktop ? '<button class="btn sec" data-act="ip">Position approximative (IP)</button>' : '') + '</div>' +
      '<label class="f" for="lat">Ou coordonnées</label><div class="wrap"><input style="flex:1;min-width:110px" type="number" step="any" id="lat" placeholder="Latitude"><input style="flex:1;min-width:110px" type="number" step="any" id="lon" placeholder="Longitude"></div>' +
      '<button class="btn sec" style="margin-top:10px" data-act="coords">Appliquer ces coordonnées</button></div>' +
      '<div class="card"><h3>Calcul des horaires</h3><label class="f" for="method">Méthode</label><select id="method" data-act="method">' + meth + '</select>' +
      '<label class="f" for="asr">Asr</label><select id="asr" data-act="asr"><option value="1"' + (+s.asr === 1 ? ' selected' : '') + '>Standard (chaféite, malikite, hanbalite)</option><option value="2"' + (+s.asr === 2 ? ' selected' : '') + '>Hanafite</option></select></div>' +
      '<div class="card"><h3>Rappels de prière</h3><label class="row"><input type="checkbox" id="notif" data-act="notif"' + (s.notif ? ' checked' : '') + ' style="width:24px;height:24px"> Me prévenir à l\'heure des prières</label>' +
      '<p class="muted" style="font-size:13px">' + (isNative ? 'Sur Android, autorisez les notifications et, si possible, « Alarmes et rappels » pour une heure exacte.' : 'Sur PC, les rappels fonctionnent quand Rakeb est ouvert.') + '</p></div>' +
      '<div class="card"><h3>Muslim IA</h3><label class="f" for="key">Clé API Anthropic ' + (hasKey ? '(enregistrée)' : '') + '</label><input type="password" id="key" autocomplete="off" placeholder="sk-ant-…">' +
      '<label class="f" for="model">Modèle</label><input type="text" id="model" value="' + esc(s.model) + '" autocapitalize="off" spellcheck="false">' +
      '<div class="wrap" style="margin-top:10px"><button class="btn" data-act="savekey">Enregistrer</button>' + (hasKey ? '<button class="btn danger" data-act="delkey">Supprimer la clé</button>' : '') + '</div></div>' +
      '<div class="card"><h3>Zakat</h3><label class="f" for="cur">Monnaie affichée</label><input type="text" id="cur" data-act="cur" value="' + esc(s.currency) + '"></div>' +
      '<div class="card"><h3>Mes données</h3><div class="stack"><button class="btn danger" data-act="cleartrack">Effacer le suivi et la série</button><button class="btn danger" data-act="clearall">Effacer toutes mes données</button></div></div>' +
      '<p class="muted" style="text-align:center">Rakeb ' + R.version + '</p>' };
  }
  function setLoc(loc) { R.store.save({ loc: loc }); changed(); toast('Lieu : ' + loc.name); }
  function changed() { R.notify.rearm(R.store.settings().loc, cfg()); render(); }
  function localTz() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; } }
  function gps() {
    var ok = function (la, lo) { setLoc({ name: 'Ma position', lat: Math.round(la * 1e4) / 1e4, lon: Math.round(lo * 1e4) / 1e4, tz: localTz() }); };
    var fail = function () { toast('Position indisponible : choisissez une ville.'); };
    var G = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Geolocation;
    toast('Recherche de la position…');
    if (isNative && G) { G.requestPermissions().then(function () { return G.getCurrentPosition({ enableHighAccuracy: false, timeout: 20000 }); }).then(function (p) { ok(p.coords.latitude, p.coords.longitude); }).catch(fail); return; }
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition(function (p) { ok(p.coords.latitude, p.coords.longitude); }, fail, { timeout: 15000 });
    else fail();
  }
  function byIp() {
    fetch('https://ipapi.co/json/').then(function (r) { return r.json(); }).then(function (j) {
      if (!j.latitude) throw new Error('x');
      setLoc({ name: j.city || 'Ma position', lat: j.latitude, lon: j.longitude, tz: j.timezone || localTz() });
    }).catch(function () { toast('Localisation par IP indisponible.'); });
  }

  /* ---------- À propos & confidentialité ---------- */
  function logo(file, nom) {
    return '<span class="logo-slot"><img src="assets/logos/' + file + '" alt="Logo ' + esc(nom) + '" data-fallback="' + esc(nom) + '"></span>';
  }
  function viewApropos() {
    var phone = isDesktop
      ? '<div class="row between"><span>Téléphone / WhatsApp : <strong>+221 76 418 22 00</strong></span><button class="btn sec" data-act="copy" data-v="' + CONTACT.tel + '">Copier</button></div>'
      : '<a class="btn sec block" href="tel:' + CONTACT.tel + '" aria-label="Appeler SAOU DIGITAL LAB">📞 Appeler</a>';
    var wa = 'https://wa.me/' + CONTACT.wa + '?text=' + openText('Bonjour SAOU DIGITAL LAB, je vous contacte depuis l\'application Rakeb.');
    return { html: '<h2>À propos</h2><div class="card"><div class="logos">' + logo('rakeb.png', 'Rakeb') + logo('saou-digital-lab.png', 'SAOU DIGITAL LAB') + '</div>' +
      '<div class="devise">Créer · Apprendre · Innover</div>' +
      '<p>Rakeb est développé par SAOU DIGITAL LAB, le pôle numérique de SAOU SYNERGY GROUP, à Mbour, dans la région de Thiès, au Sénégal.</p></div>' +
      '<div class="card"><h3>Nous contacter</h3><div class="stack">' +
      '<a class="btn block" href="' + wa + '" target="_blank" rel="noopener" aria-label="Écrire sur WhatsApp">💬 WhatsApp</a>' + phone +
      '<a class="btn sec block" href="mailto:' + CONTACT.mail + '?subject=' + openText('Rakeb — contact') + '" aria-label="Envoyer un e-mail">✉️ E-mail</a></div>' +
      '<p class="muted" style="margin-top:12px">+221 76 418 22 00<br>' + CONTACT.mail + '</p></div>' +
      '<div class="card"><a class="list-link" href="#/confidentialite">Politique de confidentialité <span>›</span></a>' +
      '<p class="muted" style="margin:8px 0 0">Version ' + R.version + '</p></div><p class="muted" style="text-align:center">© 2026 SAOU DIGITAL LAB</p>' };
  }
  function viewConfidentialite() {
    var P = R.privacy, h = '<a class="btn sec" href="#/apropos">‹ Retour</a><div class="card priv" style="margin-top:12px"><h2>' + esc(P.titre) + '</h2><p class="muted">' + esc(P.maj) + '</p>';
    var keep = function (t) { return !(isNative && t.indexOf('(PC et web uniquement)') === 0); };
    P.sections.forEach(function (s) {
      h += '<h3>' + esc(s.h) + '</h3>';
      (s.p || []).forEach(function (t) { h += '<p>' + esc(t) + '</p>'; });
      if (s.ul) h += '<ul>' + s.ul.filter(keep).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
      (s.p2 || []).forEach(function (t) { h += '<p>' + esc(t) + '</p>'; });
    });
    h += '<p><a class="btn" href="mailto:' + CONTACT.mail + '?subject=' + openText('Rakeb — confidentialité') + '">Nous écrire</a></p></div>';
    return { html: h };
  }

  /* ---------- Routage ---------- */
  var ROUTES = {
    prieres: viewPrieres, qibla: viewQibla, coran: viewCoran, ia: viewIA, plus: viewPlus,
    tasbih: viewTasbih, zakat: viewZakat, reglages: viewReglages, apropos: viewApropos, confidentialite: viewConfidentialite
  };
  var NAV = [['prieres', '🕌', 'Prières'], ['qibla', '🧭', 'Qibla'], ['coran', '📖', 'Coran'], ['ia', '💬', 'Muslim IA'], ['plus', '☰', 'Plus']];
  var GROUP = { tasbih: 'plus', zakat: 'plus', reglages: 'plus', apropos: 'plus', confidentialite: 'plus' };
  function current() { var r = (location.hash || '').replace(/^#\/?/, ''); return ROUTES[r] ? r : 'prieres'; }
  function render() {
    var r = current(), v;
    if (state.cleanup) { state.cleanup(); state.cleanup = null; }
    var scroll = window.pageYOffset;
    try { v = ROUTES[r](); } catch (e) { v = { html: '<div class="card">Une erreur est survenue. Rouvrez l\'application.</div>' }; }
    $('#view').innerHTML = v.html;
    $('#city').textContent = R.store.settings().loc.name;
    $('#nav').innerHTML = NAV.map(function (n) {
      var on = (GROUP[r] || r) === n[0];
      return '<a href="#/' + n[0] + '"' + (on ? ' aria-current="page"' : '') + '><span class="ico" aria-hidden="true">' + n[1] + '</span>' + n[2] + '</a>';
    }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('img[data-fallback]'), function (img) {
      img.onerror = function () { var s = document.createElement('span'); s.className = 'logo-txt'; s.textContent = img.getAttribute('data-fallback'); img.parentNode.replaceChild(s, img); };
      if (img.complete && img.naturalWidth === 0) img.onerror();
    });
    if (v.after) v.after();
    tick();
    if (render.last !== r) { window.scrollTo(0, 0); $('#view').focus({ preventScroll: true }); } else window.scrollTo(0, scroll);
    render.last = r;
  }

  /* ---------- Événements ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href]') : null;
    if (a && isDesktop) {
      var href = a.getAttribute('href');
      if (/^(https?:|mailto:)/.test(href)) { e.preventDefault(); window.rakebDesktop.openExternal(href); return; }
    }
    var b = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!b || b.tagName === 'INPUT' || b.tagName === 'SELECT') return;
    var act = b.getAttribute('data-act'), id = b.getAttribute('data-id');
    if (act === 'day') { var d = +b.getAttribute('data-d'); state.day = d === 0 ? 0 : state.day + d; render(); }
    else if (act === 'track') {
      var loc = R.store.settings().loc, p = R.prayer.addDays(R.prayer.dateParts(new Date(), loc.tz), state.day), k = 't.' + R.prayer.key(p), t = R.store.get(k, {});
      t[id] = !t[id]; R.store.set(k, t); render();
    }
    else if (act === 'sura') { state.sura = +b.getAttribute('data-n'); render(); }
    else if (act === 'back') { state.sura = null; render(); }
    else if (act === 'ask') ask();
    else if (act === 'clearchat') { state.chat = []; R.store.del('chat'); render(); }
    else if (act === 'tas') {
      var tt = R.store.get('tasbih', { count: 0, target: 33 }); tt.count++; R.store.set('tasbih', tt);
      $('#tas').textContent = tt.count;
      if (navigator.vibrate) navigator.vibrate(tt.target && tt.count % tt.target === 0 ? [60, 40, 60] : 15);
      if (tt.target && tt.count % tt.target === 0) toast('Objectif atteint : ' + tt.count);
    }
    else if (act === 'target') { var t2 = R.store.get('tasbih', { count: 0, target: 33 }); t2.target = +b.getAttribute('data-n'); R.store.set('tasbih', t2); render(); }
    else if (act === 'tasreset') { R.store.set('tasbih', { count: 0, target: (R.store.get('tasbih', { target: 33 }).target) }); render(); }
    else if (act === 'gps') gps();
    else if (act === 'ip') byIp();
    else if (act === 'coords') {
      var la = parseFloat($('#lat').value), lo = parseFloat($('#lon').value);
      if (isNaN(la) || isNaN(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) { toast('Coordonnées invalides.'); return; }
      setLoc({ name: 'Coordonnées saisies', lat: la, lon: lo, tz: localTz() });
    }
    else if (act === 'savekey') {
      var key = $('#key').value.trim();
      if (key) R.store.set('apikey', key);
      R.store.save({ model: $('#model').value.trim() || 'claude-haiku-5-5' }); toast('Enregistré.'); render();
    }
    else if (act === 'delkey') { R.store.del('apikey'); toast('Clé supprimée.'); render(); }
    else if (act === 'cleartrack') { if (confirm('Effacer tout le suivi des prières et la série ?')) { R.store.delPrefix('t.'); toast('Suivi effacé.'); render(); } }
    else if (act === 'clearall') { if (confirm('Effacer toutes les données de Rakeb sur cet appareil ?')) { R.store.delPrefix(''); state.chat = null; R.notify.rearm(R.store.settings().loc, { notif: false }); toast('Données effacées.'); render(); } }
    else if (act === 'copy') {
      var v = b.getAttribute('data-v');
      (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(function () { toast('Numéro copié'); }, function () { toast(v); });
    }
  });
  document.addEventListener('change', function (e) {
    var el = e.target, act = el.getAttribute && el.getAttribute('data-act');
    if (act === 'city') { var c = R.cities.filter(function (x) { return x.name === el.value; })[0]; if (c) setLoc({ name: c.name, lat: c.lat, lon: c.lon, tz: c.tz }); }
    else if (act === 'method') { R.store.save({ method: el.value }); changed(); }
    else if (act === 'asr') { R.store.save({ asr: +el.value }); changed(); }
    else if (act === 'notif') {
      if (!el.checked) { R.store.save({ notif: false }); changed(); return; }
      R.notify.ask().then(function (ok) { R.store.save({ notif: ok }); if (!ok) toast('Notifications refusées dans le système.'); changed(); });
    }
  });
  document.addEventListener('input', function (e) {
    var el = e.target, act = el.getAttribute && el.getAttribute('data-act');
    if (el.id === 'qsearch') fillList(el.value);
    else if (act === 'zin') { var z = R.store.get('zakat', {}); z[el.getAttribute('data-k')] = el.value; R.store.set('zakat', z); zcalc(); }
    else if (act === 'cur') { R.store.save({ currency: el.value || 'FCFA' }); }
  });
  window.addEventListener('hashchange', render);
  setInterval(tick, 1000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { R.notify.rearm(R.store.settings().loc, cfg()); if (current() === 'prieres') render(); } });

  render();
  R.notify.rearm(R.store.settings().loc, cfg());
})(window.R = window.R || {});
