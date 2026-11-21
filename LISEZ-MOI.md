# Rakeb — générer le .exe et l'.apk avec GitHub

Une seule application pour les deux plateformes, **dans un seul dossier `Rakeb/`** et **un seul workflow** :
```
Rakeb/
  index.html            ← source unique (Windows et Android), contient APP_VERSION
  icon.png
  main.js, preload.js, netcompat.js           ← Electron (Windows)
  electron-builder.yml, electron-builder.legacy.yml
  capacitor.config.json                       ← Capacitor (Android)
  android-src/  native/ (classes Java), res/ (adhan.mp3), widget/, shim/ (ponts Android), signing/ (clé de test)
  scripts/      sync-version.js, prepare-desktop.js, prepare-web.js, android-setup.js
  tests/        run.js (tests automatiques)
  docs/         cahier des charges, notes de version
  package.json  ← une seule version (recopiée depuis APP_VERSION)
.github/workflows/build.yml   ← tests + Windows 10/11 + Windows 7/8 + APK + Release
```
**Un changement dans `Rakeb/index.html` met à jour les deux versions.** Au moment de la compilation :
- `scripts/prepare-desktop.js` prépare `Rakeb/build/desktop` (fichiers de Rakeb.exe, avec le même `package.json` « rakeb-desktop » qu'avant : les données des utilisateurs Windows restent au même endroit) ;
- `scripts/prepare-web.js` prépare `Rakeb/www` (version convertie pour les anciennes WebView Android).
Ces dossiers, ainsi que `Rakeb/android` (projet généré par Capacitor) et `Rakeb/dist`, ne vont pas sur GitHub (`.gitignore`).

## Mettre sur GitHub
1. **Actions** : rien à faire, le workflow **Build Rakeb (Windows + Android)** se lance tout seul à chaque envoi dans `Rakeb/` (y compris un simple changement de test). Bouton **Run workflow** pour le relancer à la main.
2. Résultat dans **Artifacts** du run : `rakeb-windows-exe`, `rakeb-windows7-8-exe` et `rakeb-android-apk`.
3. **Release** : crée le tag de la version (actuellement `v1.3.0`, voir « Publier une version » en fin de fichier) : le workflow fabrique tout et publie **une seule Release** avec tous les fichiers et la note de version.

## Fichiers produits
- Windows : `Rakeb-portable-1.3.0-ia32.exe` (32 bits), `Rakeb-portable-1.3.0-x64.exe` (64 bits), `Rakeb-installateur-1.3.0-ia32.exe`, etc. (liste complète dans « PC et Android : toutes les architectures et versions »). Windows 7 SP1 ou plus.
- Android : `Rakeb-android.apk` (téléphones et tablettes, Android 5.1 ou plus).

## Différences entre Windows et Android
- Les alertes de prière fonctionnent comme sur PC : tant que Rakeb est ouvert (elles s'affichent comme notifications Android). Application fermée, pas d'alerte.
- Le choix d'un fichier d'adhan personnalisé dépend du sélecteur de fichiers Android.
- Ajouts demandés dans l'application : écran Confidentialité et boutons WhatsApp / Appeler / E-mail (voir `Rakeb/`). Sur Android, « Appeler » copie le numéro.

## Signature de l'APK
Sans réglage : clé de test publique du dépôt (les mises à jour s'installent par-dessus, mais n'importe qui peut signer un faux APK avec cette clé). Pour une diffusion publique, crée ta clé (`keytool -genkeypair -v -keystore my-rakeb.jks -alias rakeb -keyalg RSA -keysize 2048 -validity 10000`), puis les 4 secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` (Settings › Secrets and variables › Actions). Garde `my-rakeb.jks` en lieu sûr.
Une ancienne Rakeb installée avec une autre signature doit être désinstallée avant d'installer cet APK.

## Corrections du 25 octobre 2026
- **Bas d'écran masqué (téléphone et tablette)** : sur les écrans de moins de 900 px, la marge sous le dernier bloc n'était jamais ajoutée (le corps de la page a une hauteur figée). Ajout d'une marge dans le contenu (`main`) : testé sur 5 tailles d'écran et 7 écrans, plus rien n'est caché sous la barre d'onglets.
- **« Dernier article »** : (1) l'identifiant envoyé à Wikipédia (User-Agent) est maintenant conforme à leur règle (nom + adresse e-mail de contact), sur PC (`main.js`) comme sur Android (`android-shim.js`) ; (2) si l'API « résumé » échoue, l'application essaie l'API « action » de Wikipédia ; (3) en cas d'échec, le message affiche maintenant le détail (par exemple « HTTP 403 »).

## Mise à jour du 25 octobre 2026 (arrière-plan, position, boussole, adhan, 99 Noms)
- **99 Noms d'Allah vides + réglages morts sur Android** : la WebView n'a pas la synthèse vocale (`speechSynthesis`). Le code des 99 Noms plantait au démarrage et **arrêtait tout le reste du script** (alertes, carillon, adhan, apparence, Mes données). Corrigé : l'application ne plante plus sans synthèse vocale, et sur Android la voix passe par le moteur vocal du téléphone (il faut une voix arabe installée dans « Synthèse vocale » d'Android pour une bonne prononciation).
- **Alertes en arrière-plan (Android)** : les prochaines alertes (7 jours, rappels et prières décochées compris) sont programmées par Android lui-même, avec exactement les horaires affichés : elles sonnent application fermée. Elles sont reprogrammées à chaque changement de réglage et à chaque ouverture.
- **Adhan en notification (Android)** : déposer `Rakeb/android-src/res/adhan.mp3` (voir le fichier LISEZ-MOI.txt du dossier). Sans lui : son de notification du téléphone + vibration. L'adhan choisi dans Réglages (fichier ajouté) ne joue que application ouverte.
- **Position demandée à chaque retour** : la position passe par le plugin Android (autorisation standard) et les réglages sont sauvegardés en double hors de la WebView (restauration automatique s'ils sont effacés). Choisir « Pendant l'utilisation » ou « Toujours », jamais « Uniquement cette fois-ci ».
- **Boussole immobile** : l'événement magnétique « absolu » est prioritaire, les événements relatifs (faux nord) sont ignorés, lissage et affichage du cap en direct ; si aucun capteur ne répond, un message l'indique.
- **Mes données (Android)** : l'export (JSON, CSV, SVG) ouvre le partage Android (enregistrer dans Fichiers, Drive, WhatsApp…) ; l'import passe par le sélecteur de fichiers.
- **PC** : fermer la fenêtre laisse Rakeb actif près de l'horloge (icône dans la zone de notification) ; les alertes continuent. Clic droit sur l'icône : Ouvrir, Lancer au démarrage de Windows, Quitter.

## Boussole Android : lecture native (25 octobre 2026)
- Nouveau plugin `Rakeb/android-src/native/CompassPlugin.java` : il lit directement les capteurs d'Android (vecteur de rotation, sinon accéléromètre + magnétomètre), applique la déclinaison magnétique du lieu (environ 7° à Dakar) et envoie le cap à l'application. Il est ajouté et enregistré automatiquement à la compilation (`scripts/android-setup.js`).
- Le capteur ne démarre que lorsque l'on active la boussole dans l'écran Qibla, et se met en pause avec l'application.

## Téléphones sans boussole et test des alertes (26 octobre 2026)
- **Repère avec le soleil** (écran Qibla) : calcule la position du soleil à partir de la position et de l'heure ; il indique de combien tourner à droite ou à gauche à partir du soleil pour être face à la Qibla. Il fonctionne sans aucun capteur, en journée (soleil à plus de 8° au-dessus de l'horizon).
- **Tecno KG5P (Spark 9, HiOS 8.6)** : la fiche technique ne liste ni boussole ni magnétomètre (empreinte, accéléromètre, proximité) : aucune application ne peut y afficher une vraie boussole.
- **Réglages › Alertes (Android)** : bouton « Tester l'alerte (dans 10 secondes) » pour vérifier le son et l'arrière-plan.
- **Adhan** : déposer `adhan.mp3` dans `Rakeb/android-src/res/` (court de préférence, moins de 1 minute). Le dépôt GitHub étant public, n'y mettre qu'un enregistrement libre de droits ou passer le dépôt en privé.

## Duas, azkar et tasbih (8 novembre 2026)
- **Bibliothèque de duas complète** : 141 textes en 16 catégories (matin, soir, quotidien, prière, ablutions et mosquée, repas, maison et vêtements, sommeil et réveil, voyage, épreuve, pardon et repentir, maladie et guérison, deuil, famille, pluie-vent-lune, protection). Chaque doua a le texte arabe **complet**, la translittération, la traduction française et la source (Coran, Boukhari, Muslim, Abu Dawud, Tirmidhi…). Les textes ont été rédigés avec soin mais doivent être relus par une personne qualifiée avant une large diffusion.
- **Ajout par l'utilisateur** : bouton « ➕ Ajouter une doua / un dhikr » (catégorie, texte arabe, translittération, traduction, source), liste « ⭐ Mes ajouts » et suppression. Tasbih : bouton « ➕ Ajouter une formule » (nom, arabe, traduction, objectif) et suppression. Tout est enregistré sur l'appareil et inclus dans l'export « Mes données ».
- **Tasbih** : 4 formules authentiques supplémentaires.
- **Alertes Android** : boutons de diagnostic dans Réglages › Alertes (test dans 10 secondes avec l'état réel du canal : importance, son) et raccourcis vers les réglages du son, de la batterie et de l'application.
- **Correctif important** : la version du 26 octobre contenait un conflit de nom (`sunPosition`) qui cassait le calcul des horaires de prière. Corrigé ici.

## Adhan natif et boussole : correction de fond (9 novembre 2026)
- **Adhan par alarmes Android** : à l'heure de chaque prière, Android réveille Rakeb (alarme exacte) qui joue l'adhan lui-même via un service au premier plan, sur le **volume des alarmes** : cela ne dépend plus des réglages de notification de HiOS. Une notification avec le bouton « Arrêter l'adhan » s'affiche pendant la lecture. Les alarmes sont reprogrammées après un redémarrage du téléphone. Les rappels « Bientôt » restent des notifications silencieuses.
- **Source du son** (dans l'ordre) : le fichier choisi dans Réglages › Son de l'adhan (copié automatiquement vers le module natif, sans recompiler), sinon `adhan.mp3` intégré à l'APK, sinon le son de notification du téléphone.
- **Boutons Réglages › Alertes** : tester dans 10 s, écouter maintenant, arrêter le son, alarmes exactes, réglages du son, batterie, application.
- **Boussole** : l'application interroge les capteurs du téléphone. Sans magnétomètre (cas du Tecno KG5P), elle l'explique en clair, affiche les capteurs détectés et met en évidence le repère avec le soleil.
- Nouvelles classes Java (`android-native/`) : `AdhanPlugin`, `AdhanScheduler`, `AdhanService`, `AdhanReceiver`, `BootReceiver`, plus `sensors()` dans `CompassPlugin`. Vérifiées par compilation contre l'API Android 14.

## Évolutions du 10 novembre 2026 (version 1.1.0)
- **Tests automatiques** (`tests/`, 37 vérifications) : lancés par GitHub avant chaque compilation et dans le workflow « Tests automatiques ». Ils contrôlent la syntaxe, les fonctions déclarées deux fois (l'erreur qui avait cassé les horaires), les horaires de Dakar, les écrans, les duas, le tasbih, les ajustements, le pont des alarmes Android et la vérification des mises à jour. Si un test échoue, la compilation s'arrête. En local : `cd tests && npm install && npm test`.
- **Numéro de version unique** : `const APP_VERSION` dans `Rakeb/index.html`. `Rakeb/scripts/sync-version.js` le recopie dans `Rakeb/package.json` (noms des `.exe`, versionName de l'APK).
- **Publier une version** : changer `APP_VERSION` (par exemple 1.2.0), valider, puis créer la Release `v1.2.0` (ou `git tag v1.2.0 && git push --tags`). Les fichiers `.exe` et `.apk` sont joints automatiquement.
- **Mises à jour intégrées** : Réglages › « Version et mises à jour » compare la version installée à la dernière Release GitHub (`saoudigitallab/rakeb`) et propose le téléchargement ; vérification automatique une fois par jour.
- **Signaler un problème** (À propos) : message WhatsApp prérempli avec la version et le modèle d'appareil.
- **Ajustement des horaires** (Horaires) : de −30 à +30 minutes par prière pour s'aligner sur la mosquée ; pris en compte par l'affichage, le mois, les alertes et les alarmes Android.
- **Partage en image** : bouton « 📤 Partager » sur chaque doua, la doua du jour et l'aya du jour (image 1080 px, texte arabe, translittération, traduction, source). Android : feuille de partage (WhatsApp, etc.) ; PC : enregistrement du fichier.
- **Coran hors ligne** : « 📥 Télécharger tout le Coran » (texte arabe et traduction, 114 sourates, stockés sur l'appareil, reprise possible) ; une sourate lue est mémorisée automatiquement ; marque-page 🔖 par verset et bouton « Reprendre ».
- **Confidentialité** : ajout de api.github.com et de Google Fonts à la liste des services contactés ; date mise à jour.

## PC et Android : toutes les architectures et versions (11 novembre 2026)
**Windows (workflow « Build Rakeb », tâches `windows` et `windows7`)** — un portable et un installateur par architecture :
| Windows | Fichiers | Moteur |
|---|---|---|
| 10 et 11, 32 bits | `Rakeb-portable-…-ia32.exe`, `Rakeb-installateur-…-ia32.exe` | Electron 31 |
| 10 et 11, 64 bits | `…-x64.exe` | Electron 31 |
| 10 et 11 sur ARM (Surface Pro X…) | `…-arm64.exe` | Electron 31 |
| **7 SP1, 8, 8.1**, 32 et 64 bits | `Rakeb-win7-portable-…` et `Rakeb-win7-installateur-…` (ia32, x64) | Electron 22 (dernière version compatible) |
- Le code réseau passe par `Rakeb/netcompat.js` : `net.fetch` n'existe qu'à partir d'Electron 25, la version Windows 7/8 utilise `net.request` avec le même comportement (testé sur Electron 22 et 31 : GET, 404, redirection, POST, annulation, UTF-8, User-Agent).
- Windows 7 : installer Windows 7 SP1 et ses mises à jour de sécurité (SHA-2) ; un .exe de la série « win7 » est inutile sur Windows 10/11.

**Android (workflow « Build Rakeb », tâche `android`)** — un seul APK universel, sans bibliothèque native (fonctionne sur ARM 32/64 bits et x86) :
- **Android 5.1 (API 22) et plus**, jusqu'aux versions les plus récentes ; téléphones, tablettes, pliables et multi-fenêtre (`supports-screens`, `resizeableActivity`).
- Android 5.0 et 4.x : impossible (Capacitor 5 exige l'API 22 et ces appareils n'ont plus de WebView exploitable).
- **Anciennes WebView** : le JavaScript de l'APK est converti en ES2015 (esbuild) et complété par des polyfills : l'application fonctionne avec une WebView Chrome 51 ou plus. Android 5/6 : mettre à jour « Android System WebView » dans le Play Store ; si elle est trop ancienne, l'application affiche un message clair au lieu d'un écran vide.
- Les tests automatiques sont aussi lancés sur la version convertie.
- Mise en page vérifiée sur 7 tailles (téléphones, tablettes 600 à 800 px, paysage, PC) × 15 écrans : aucun débordement, aucun contenu masqué.

## Évolutions du 16 novembre 2026 (version 1.2.0)
Cahier des charges de référence : `docs/CAHIER-DES-CHARGES-EVOLUTIONS.md`. `APP_VERSION` reste à **1.1.0** dans le code : à passer à 1.2.0 au moment de la Release (voir « Publier une version »). Tout est dans `Rakeb/index.html` (une seule source) ; seul `RakebMobile/shim/android-shim.js` reçoit un petit complément (titre et texte personnalisés des rappels).
- **Tests automatiques : 37 → 131 vérifications** (136 sur la version convertie pour Android). Nouveaux contrôles : 26 phrases pour la détection d'intention, mode sources avec mock des 4 API (succès, délai dépassé, erreur HTTP 403), cache, liste blanche réseau (analyse du code), Confidentialité, calendrier hégirien (4 dates connues), profils de mosquée, recherche de duas, carte Qibla, mode Ramadan (heure simulée), accessibilité (boutons et champs nommés), contrastes des 5 thèmes.
- **Muslim IA — mode « sources vérifiées », sans clé API** : `detectIntent` classe la question en local (verset, hadith, tafsir, horaire, doua, fiqh, général ; français, arabe, wolof). Réponses sourcées : texte arabe, translittération, traduction, lien cliquable (quran.com, sunnah.com), bouton Copier, bandeau « Réponse issue de [source]. Activez la clé API dans Réglages › Muslim IA… ». Réseau limité à une liste fermée de 4 domaines (`api.alquran.cloud`, `api.quran.com`, `cdn.jsdelivr.net`, `api.aladhan.com`), délai de 5 s, erreurs détaillées (« HTTP 403 »), cache local (60 réponses, bouton « Vider le cache »), position arrondie à 2 décimales pour Aladhan. Aucune recherche web ouverte, aucun site d'avis juridique.
- **Pas de fatwa** : toute question de fiqh (halal/haram, divorce, héritage, validité…) reçoit un avertissement et un renvoi vers un savant qualifié, avec ou sans clé API, et n'est jamais envoyée à l'IA.
- **Avec une clé API** : chemin existant conservé ; consigne de citer les sources (sourate:verset, collection et numéro), alerte automatique si la réponse n'en cite aucune, rappel « consultez une personne qualifiée ».
- **Hadiths : `cdn.jsdelivr.net` à la place de l'API sunnah.com**, qui exige une clé. Le lien « sunnah.com » n'est qu'un lien ouvert par l'utilisateur.
- **Mode Ramadan** (Menu › Ramadan, et carte sur l'accueil pendant le mois) : compte à rebours imsak / iftar d'après le calcul de prières existant, imsak réglable (0 à 15 min avant le Fajr), dua de rupture du jeûne mise en avant, compteur de jeûnes jour par jour (inclus dans « Mes données »), rappel silencieux 10 min avant l'iftar (toast sur PC ; alarme sur le canal « Rappel » d'Android, via `RakebBridge.upcoming`). Les alarmes de prière et l'adhan natif ne sont pas modifiés.
- **Qibla par carte** (Qibla) : carte OpenStreetMap dessinée en JavaScript pur (grand cercle vers La Mecque, sans bibliothèque), chargée seulement après un clic ; lien « Pas de boussole ? Voir la carte » pour les appareils sans magnétomètre (Tecno KG5P). Sans réseau, la ligne reste affichée. La boussole n'est pas touchée.
- **Calendrier hégirien** : date hégirienne dans l'entête et sous « Horaires » ; ajustement −1 / +1 jour (Réglages › Calendrier hégirien, et écran Ramadan) appliqué partout (accueil, calendrier, Ramadan, rappels). Calcul tabulaire intégré, sans réseau.
- **Finitions** : bouton Copier (dua, verset, hadith, réponses de Muslim IA) ; recherche des duas dans toutes les catégories (mot-clé, thème, source, sans accents ni voyelles arabes) ; historique de recherche du Coran ; version visible dans À propos ; noms accessibles (aria-label) sur les boutons et listes ; contrastes corrigés (jade, or, nouvelle couleur de texte d'erreur) ; profils d'horaires par mosquée (nom + 5 ajustements, Horaires).
- **Confidentialité** : ajout de api.quran.com, api.aladhan.com, sunnah.com (lien), tile.openstreetmap.org (carte, sur clic), précisions sur api.alquran.cloud et cdn.jsdelivr.net, noms d'hôtes d'Anthropic et de Wikipédia ; mise à jour du 16 novembre 2026 ; paragraphe Muslim IA sans clé.
- **À relire / vérifier avant publication** :
  1. *Religieux* : mots-clés de `FIQH_RE` (liste de refus) ; formulation de l'avertissement fiqh ; imsak = Fajr − 10 min par défaut (le jeûne commence au Fajr : réglable à 0) ; tafsir court = Tafsir al-Muyassar (arabe) ; la numérotation des hadiths de Muslim, Abu Dawud, etc. dans le dépôt hadith-api peut différer de celle de sunnah.com (le lien peut alors pointer un autre numéro).
  2. *Techniques* : les 4 API n'ont pas pu être interrogées depuis l'environnement de développement (tests sur mocks conformes à leur documentation) : essayer sur un vrai téléphone « 2:255 », « Boukhari 1 », « tafsir 112:1 », « horaires » avec le réseau. `api.quran.com` migre vers `apis.quran.foundation` (identifiants OAuth) : si le tafsir échoue, repli automatique sur `api.alquran.cloud` (`ar.muyassar`). Traduction française des hadiths : repli sur l'anglais si absente.
  3. *Appareils* : rappel d'iftar et canal « Rappel » sur Android ; carte Qibla sans réseau ; Windows 10.


## Évolutions v1.3 (11 ajouts)

| # | Évolution | Où |
|---|-----------|----|
| 1 | Rappels de sunna (lundi/jeudi, jours blancs, Arafat, Achoura, Al-Kahf, adhkar matin/soir, dernier tiers de la nuit) | Menu › Rappels de sunna |
| 2 | Planificateur de khatma (N jours, lecture du jour, progression, ouverture au bon verset via le marque-page) | Menu › Planificateur de khatma |
| 3 | Imsakiya partageable (image PNG des jours du Ramadan : imsak, Fajr, iftar) | Ramadan › Imsakiya à partager |
| 4 | Recherche plein texte dans le Coran téléchargé (français et arabe), utilisée aussi par Muslim IA | Coran › Recherche hors ligne |
| 5 | 40 hadiths de Nawawi intégrés (42 textes), recherche par thème, « Nawawi 5 » dans Muslim IA | Menu › 40 hadiths de Nawawi |
| 6 | Rattrapage des prières et des jours de jeûne, relié au compteur du Ramadan | Menu › Rattrapage |
| 7 | Suivi du tarawih et de la sadaqa | Ramadan |
| 8 | Widget Android (prochaine prière, ou iftar pendant le Ramadan) | Écran d'accueil Android |
| 9 | Wolof (partiel) et mots-clés wolof pour Muslim IA | Réglages › Langue |
| 10 | Sauvegarde automatique de « Mes données » + envoi en un geste | Réglages › Mes données |
| 11 | Table Umm al-Qura (1420-1499 AH), désactivable | Réglages › Calendrier hégirien |

Points d'attention :
- **Alarmes** : aucune alarme existante n'est modifiée. Les rappels de sunna passent par `RakebBridge.upcoming` comme les rappels d'iftar (notifications silencieuses). Le widget lit seulement la liste mémorisée par `AdhanScheduler` ; la seule modification de cette classe est l'appel `RakebWidgetProvider.refresh`. `upcoming` renvoyait `undefined` quand seules les alertes d'iftar étaient actives : corrigé.
- **Widget** : compilé ici contre android.jar (API 34) avec une classe `R` simulée ; le rendu réel sur téléphone reste à vérifier.
- **Données** : Nawawi (fawazahmed0/hadith-api) et table Umm al-Qura (hijri-converter) sont embarquées dans l'application. Les titres thématiques des hadiths et les traductions sont à faire relire.
- **Wolof** : seules ~20 étiquettes sont traduites ; à faire relire par un locuteur avant diffusion.
- **Sauvegarde automatique** : copie dans le stockage de l'application (IndexedDB), donc perdue si l'on efface les données de l'application. « Envoyer ma sauvegarde » est la vraie protection. La clé API n'est jamais sauvegardée.
- Khatma : répartition par nombre de versets (pas par pages du mushaf).

## Évolutions du 20 novembre 2026 (version 1.3.0)
**Affiches à partager** (Menu › Affiches à partager) : une image soignée, prête pour WhatsApp, un statut ou l'impression.
| Affiche | Contenu |
|---|---|
| Horaires du jour / de demain | 5 prières + lever du soleil, noms en arabe, « Joumou'a » le vendredi, dates grégorienne et hégirienne, lieu |
| Horaires de la semaine | 7 jours, aujourd'hui en évidence, vendredi repéré |
| Horaires du mois | tous les jours du mois choisi (◀ ▶), avec le jour hégirien |
| Jours blancs | 13, 14 et 15 du mois hégirien en cours ou du prochain : date, début du jeûne (Fajr), iftar (Maghrib), hadith de référence |
| Jeûnes recommandés (30 jours) | lundis, jeudis, jours blancs, Arafat, Tassou'a et Achoura ; Aïds et jours de tachriq exclus |
| Dates importantes | les 6 prochaines fêtes et dates (Ramadan, Aïds, Hajj, Achoura…) et le décompte en jours |
| Imsakiya du Ramadan | la même que dans l'écran Ramadan, avec le choix du format et des couleurs |
- **Formats** : carré (1080 × 1080), portrait (1080 × 1350), statut / story (1080 × 1920). Si le contenu dépasse (mois entier), l'image est allongée et l'écran l'indique.
- **Couleurs** : vert et or (Rakeb), clair (pour imprimer et afficher à la mosquée), nuit.
- **En-tête** (ex. « Mosquée de Mbour ») et **message** facultatifs, mémorisés.
- **Aperçu en direct**, bouton « 📤 Partager l'affiche » (Android : feuille de partage ; PC : fichier PNG enregistré) et « 📋 Copier en texte » (version texte avec la mise en forme WhatsApp).
- **Raccourcis** : bouton « 🖼️ Affiche » dans Horaires (suit la vue Aujourd'hui / Demain / Mois), boutons dans Calendrier, Rappels de sunna et Ramadan.
- Tout est calculé sur l'appareil, avec les ajustements de mosquée, la méthode de calcul, l'ajustement hégirien et la table Umm al-Qura : **aucun nouveau service réseau** (écran Confidentialité inchangé).
- **Correctif** : le rappel « jour blanc » n'est plus envoyé pour le 13 Dhou al-Hijja (jour de tachriq, on n'y jeûne pas).
- **Tests** : 21 vérifications ajoutées (modèles des 8 affiches, dates de Dakar, jours sans jeûne, version texte, écran, raccourcis, absence d'appel réseau, rappel du 13 Dhou al-Hijja).
- **Version** : `APP_VERSION` passe à **1.3.0** (et les `package.json` via `scripts/sync-version.js`).

À relire avant diffusion :
1. *Religieux* : texte du hadith des jours blancs (« Si tu jeûnes trois jours dans le mois… », at-Tirmidhi 761, an-Nasa'i 2424) ; liste des jours exclus (Aïd al-Fitr, Aïd al-Adha, 11-13 Dhou al-Hijja) ; libellés « Tassou'a » et « Achoura ».
2. *Appareils* : rendu de la police arabe (Amiri) sans réseau sur Android : une police arabe du téléphone est utilisée à défaut ; partage de l'image sur un vrai téléphone (WhatsApp).

## Réorganisation : un seul dossier, un seul workflow (21 novembre 2026)
- `RakebDesktop/`, `RakebMobile/`, `tests/`, `scripts/` et `docs/` sont regroupés dans **`Rakeb/`** (organisation ci-dessus, comme MediCore). Fichiers natifs Android dans `Rakeb/android-src/` (le nom `android/` est réservé au projet que Capacitor génère).
- **Un seul `package.json`** (`Rakeb/package.json`) et un seul numéro de version.
- **Un seul workflow** `.github/workflows/build.yml` remplace `build-windows.yml`, `build-android.yml` et `tests.yml` : les tests tournent une fois, puis Windows 10/11, Windows 7/8 et Android sont fabriqués **en parallèle**. Il se relance à chaque envoi dans `Rakeb/`, y compris pour un fichier de test.
- **Release en un geste** : avec un tag `vX.Y.Z`, la tâche `release` attend les trois compilations et publie une seule Release (titre « Rakeb X.Y.Z », texte = `Rakeb/docs/NOTES-VERSION-X.Y.Z.md`, tous les `.exe` et l'`.apk`). Le tag est refusé s'il ne correspond pas à `APP_VERSION`.
- Rien ne change pour les utilisateurs : même application, mêmes noms de fichiers, même dossier de données sur Windows, même identifiant Android (`com.rakeb.mobile`) et même clé de signature.

### Passer de l'ancienne organisation à la nouvelle (une seule fois, sur github.com)
1. **Supprimer les anciens workflows** : `.github/workflows/build-windows.yml`, `build-android.yml` et `tests.yml` (ouvrir le fichier › « … » › **Delete file** › Commit). À faire en premier, sinon ils se lancent et échouent pendant le déménagement.
2. **Supprimer les anciens dossiers** `RakebDesktop`, `RakebMobile`, `tests`, `scripts`, `docs` : ouvrir le dossier › « … » en haut à droite › **Delete directory** › Commit.
3. **Add file › Upload files** : glisser le dossier **`Rakeb`** entier et le fichier `LISEZ-MOI.md` › Commit.
4. **Add file › Create new file** : nom `.github/workflows/build.yml`, coller le contenu du fichier de l'archive › Commit. Faire de même pour `.gitignore` à la racine si besoin.
5. **Actions** › **Build Rakeb (Windows + Android)** : le run démarre ; vérifier que les 4 tâches (tests, windows, windows7, android) sont vertes.

## Publier une version (exemple : 1.3.0)
1. Vérifier que `const APP_VERSION = '1.3.0'` dans `Rakeb/index.html` et que `Rakeb/docs/NOTES-VERSION-1.3.0.md` existe.
2. Attendre que le dernier run de **Build Rakeb** sur `main` soit vert.
3. **Releases › Draft a new release** › **Choose a tag** › taper `v1.3.0` › « Create new tag on publish » (cible `main`) › **Publish release** (le texte peut rester vide).
4. Le workflow se relance pour le tag et remplit la Release : titre, note de version, `.exe` Windows 10/11, `.exe` Windows 7/8 et `Rakeb-android.apk` (compter 10 à 15 minutes).
5. Les installations existantes (1.1.0 et suivantes) proposent la mise à jour dans Réglages › « Version et mises à jour ».
6. Avant une diffusion publique : configurer ta propre clé de signature Android (4 secrets, voir « Signature de l'APK ») ; sinon l'APK est signé avec la clé de test publique.
