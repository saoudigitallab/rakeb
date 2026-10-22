// Vérifie le calcul des horaires et de la Qibla (node scripts/test-prayer.js)
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { window: {} }; ctx.window.window = ctx.window; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../www/js/prayer.js'), 'utf8'), ctx);
const R = ctx.window.R;
const f = (d, tz) => d.toLocaleTimeString('fr-FR', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
let bad = 0;
function check(nom, cond, info) { if (!cond) { bad++; console.log('ÉCHEC', nom, info || ''); } else console.log('ok   ', nom, info || ''); }

const t = R.prayer.times(2026, 10, 22, 14.6937, -17.4441, 'MWL', 1);
const tz = 'Africa/Dakar';
const L = {}; Object.keys(t).forEach(k => L[k] = f(t[k], tz));
console.log('Dakar 22/10/2026 (MWL):', L);
const mins = k => { const [h, m] = L[k].split(':').map(Number); return h * 60 + m; };
check('ordre des prières', mins('fajr') < mins('sunrise') && mins('sunrise') < mins('dhuhr') && mins('dhuhr') < mins('asr') && mins('asr') < mins('maghrib') && mins('maghrib') < mins('isha'));
check('Dhuhr Dakar ~12h54', Math.abs(mins('dhuhr') - (12 * 60 + 54)) <= 4, L.dhuhr);
check('Lever du soleil ~07h05', Math.abs(mins('sunrise') - (7 * 60 + 5)) <= 8, L.sunrise);
check('Coucher du soleil ~18h42', Math.abs(mins('maghrib') - (18 * 60 + 42)) <= 8, L.maghrib);

const q = R.prayer.qibla(14.6937, -17.4441);
check('Qibla Dakar ~74°', Math.abs(q - 73.9) < 1, q.toFixed(1) + '°');
const qp = R.prayer.qibla(48.8566, 2.3522);
check('Qibla Paris ~119°', Math.abs(qp - 119) < 2, qp.toFixed(1) + '°');

const p = R.prayer.times(2026, 6, 21, 48.8566, 2.3522, 'MWL', 1);
check('Paris été : horaires définis (hautes latitudes)', p && !isNaN(p.fajr) && !isNaN(p.isha), p ? f(p.fajr, 'Europe/Paris') + ' / ' + f(p.isha, 'Europe/Paris') : 'null');
const mk = R.prayer.times(2026, 10, 22, 21.4225, 39.8262, 'MAKKAH', 1);
check('Umm al-Qura : Isha = Maghrib + 90 min', Math.round((mk.isha - mk.maghrib) / 60000) === 90);
const hanafi = R.prayer.times(2026, 10, 22, 14.6937, -17.4441, 'MWL', 2);
check('Asr hanafite plus tardif', hanafi.asr > t.asr, f(t.asr, tz) + ' → ' + f(hanafi.asr, tz));
const n = R.prayer.next(new Date(Date.UTC(2026, 9, 22, 20, 0)), { lat: 14.6937, lon: -17.4441, tz }, { method: 'MWL', asr: 1 });
check('Après Isha : prochaine = Fajr de demain', n && n.id === 'fajr' && n.date > new Date(Date.UTC(2026, 9, 22, 20, 0)), n && f(n.date, tz));
process.exit(bad ? 1 : 0);
