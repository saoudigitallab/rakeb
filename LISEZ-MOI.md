# Rakeb — générer le .exe et l'.apk avec GitHub

Une seule application (celle de ton `Rakeb.exe`) pour les deux plateformes :
- `RakebDesktop/` : l'application Windows (Electron 31.7.7). Source unique : `index.html`.
- `RakebMobile/` : l'emballage Android (Capacitor 5). Il reprend automatiquement `RakebDesktop/index.html` : **un changement dans `index.html` met à jour les deux versions**.

## Mettre sur GitHub
1. Dans ton dépôt, supprime les anciens fichiers (Add file › … ou crayon › Delete).
2. **Add file › Upload files** : glisse les dossiers `RakebDesktop` et `RakebMobile` et le fichier `.gitignore`.
3. Crée les deux workflows à la main (Add file › Create new file) : `.github/workflows/build-windows.yml` et `.github/workflows/build-android.yml`, en collant le contenu des fichiers de cette archive.
4. **Actions** › choisis chaque workflow › **Run workflow**. Résultat dans **Artifacts** : `rakeb-windows-exe` et `rakeb-android-apk`.
5. Liens permanents : crée une Release avec le tag `v1.0.0`.

## Fichiers produits
- Windows : `Rakeb-portable-1.0.0-ia32.exe` (32 bits), `Rakeb-portable-1.0.0-x64.exe` (64 bits), `Rakeb-installateur-1.0.0-ia32.exe`. Windows 10 ou plus.
- Android : `Rakeb-android.apk` (téléphones et tablettes, Android 5.1 ou plus).

## Différences entre Windows et Android
- Les alertes de prière fonctionnent comme sur PC : tant que Rakeb est ouvert (elles s'affichent comme notifications Android). Application fermée, pas d'alerte.
- Le choix d'un fichier d'adhan personnalisé dépend du sélecteur de fichiers Android.
- Ajouts demandés dans l'application : écran Confidentialité et boutons WhatsApp / Appeler / E-mail (voir `RakebDesktop/`). Sur Android, « Appeler » copie le numéro.

## Signature de l'APK
Sans réglage : clé de test publique du dépôt (les mises à jour s'installent par-dessus, mais n'importe qui peut signer un faux APK avec cette clé). Pour une diffusion publique, crée ta clé (`keytool -genkeypair -v -keystore my-rakeb.jks -alias rakeb -keyalg RSA -keysize 2048 -validity 10000`), puis les 4 secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` (Settings › Secrets and variables › Actions). Garde `my-rakeb.jks` en lieu sûr.
Une ancienne Rakeb installée avec une autre signature doit être désinstallée avant d'installer cet APK.

## Corrections du 25 octobre 2026
- **Bas d'écran masqué (téléphone et tablette)** : sur les écrans de moins de 900 px, la marge sous le dernier bloc n'était jamais ajoutée (le corps de la page a une hauteur figée). Ajout d'une marge dans le contenu (`main`) : testé sur 5 tailles d'écran et 7 écrans, plus rien n'est caché sous la barre d'onglets.
- **« Dernier article »** : (1) l'identifiant envoyé à Wikipédia (User-Agent) est maintenant conforme à leur règle (nom + adresse e-mail de contact), sur PC (`main.js`) comme sur Android (`android-shim.js`) ; (2) si l'API « résumé » échoue, l'application essaie l'API « action » de Wikipédia ; (3) en cas d'échec, le message affiche maintenant le détail (par exemple « HTTP 403 »).

## Mise à jour du 25 octobre 2026 (arrière-plan, position, boussole, adhan, 99 Noms)
- **99 Noms d'Allah vides + réglages morts sur Android** : la WebView n'a pas la synthèse vocale (`speechSynthesis`). Le code des 99 Noms plantait au démarrage et **arrêtait tout le reste du script** (alertes, carillon, adhan, apparence, Mes données). Corrigé : l'application ne plante plus sans synthèse vocale, et sur Android la voix passe par le moteur vocal du téléphone (il faut une voix arabe installée dans « Synthèse vocale » d'Android pour une bonne prononciation).
- **Alertes en arrière-plan (Android)** : les prochaines alertes (7 jours, rappels et prières décochées compris) sont programmées par Android lui-même, avec exactement les horaires affichés : elles sonnent application fermée. Elles sont reprogrammées à chaque changement de réglage et à chaque ouverture.
- **Adhan en notification (Android)** : déposer `RakebMobile/android-res/adhan.mp3` (voir le fichier LISEZ-MOI.txt du dossier). Sans lui : son de notification du téléphone + vibration. L'adhan choisi dans Réglages (fichier ajouté) ne joue que application ouverte.
- **Position demandée à chaque retour** : la position passe par le plugin Android (autorisation standard) et les réglages sont sauvegardés en double hors de la WebView (restauration automatique s'ils sont effacés). Choisir « Pendant l'utilisation » ou « Toujours », jamais « Uniquement cette fois-ci ».
- **Boussole immobile** : l'événement magnétique « absolu » est prioritaire, les événements relatifs (faux nord) sont ignorés, lissage et affichage du cap en direct ; si aucun capteur ne répond, un message l'indique.
- **Mes données (Android)** : l'export (JSON, CSV, SVG) ouvre le partage Android (enregistrer dans Fichiers, Drive, WhatsApp…) ; l'import passe par le sélecteur de fichiers.
- **PC** : fermer la fenêtre laisse Rakeb actif près de l'horloge (icône dans la zone de notification) ; les alertes continuent. Clic droit sur l'icône : Ouvrir, Lancer au démarrage de Windows, Quitter.

## Boussole Android : lecture native (25 octobre 2026)
- Nouveau plugin `RakebMobile/android-native/CompassPlugin.java` : il lit directement les capteurs d'Android (vecteur de rotation, sinon accéléromètre + magnétomètre), applique la déclinaison magnétique du lieu (environ 7° à Dakar) et envoie le cap à l'application. Il est ajouté et enregistré automatiquement à la compilation (`scripts/android-setup.js`).
- Le capteur ne démarre que lorsque l'on active la boussole dans l'écran Qibla, et se met en pause avec l'application.

## Téléphones sans boussole et test des alertes (26 octobre 2026)
- **Repère avec le soleil** (écran Qibla) : calcule la position du soleil à partir de la position et de l'heure ; il indique de combien tourner à droite ou à gauche à partir du soleil pour être face à la Qibla. Il fonctionne sans aucun capteur, en journée (soleil à plus de 8° au-dessus de l'horizon).
- **Tecno KG5P (Spark 9, HiOS 8.6)** : la fiche technique ne liste ni boussole ni magnétomètre (empreinte, accéléromètre, proximité) : aucune application ne peut y afficher une vraie boussole.
- **Réglages › Alertes (Android)** : bouton « Tester l'alerte (dans 10 secondes) » pour vérifier le son et l'arrière-plan.
- **Adhan** : déposer `adhan.mp3` dans `RakebMobile/android-res/` (court de préférence, moins de 1 minute). Le dépôt GitHub étant public, n'y mettre qu'un enregistrement libre de droits ou passer le dépôt en privé.

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
- **Numéro de version unique** : `const APP_VERSION` dans `RakebDesktop/index.html`. `scripts/sync-version.js` le recopie dans les `package.json` (noms des `.exe`, versionName de l'APK).
- **Publier une version** : changer `APP_VERSION` (par exemple 1.2.0), valider, puis créer la Release `v1.2.0` (ou `git tag v1.2.0 && git push --tags`). Les fichiers `.exe` et `.apk` sont joints automatiquement.
- **Mises à jour intégrées** : Réglages › « Version et mises à jour » compare la version installée à la dernière Release GitHub (`saoudigitallab/rakeb`) et propose le téléchargement ; vérification automatique une fois par jour.
- **Signaler un problème** (À propos) : message WhatsApp prérempli avec la version et le modèle d'appareil.
- **Ajustement des horaires** (Horaires) : de −30 à +30 minutes par prière pour s'aligner sur la mosquée ; pris en compte par l'affichage, le mois, les alertes et les alarmes Android.
- **Partage en image** : bouton « 📤 Partager » sur chaque doua, la doua du jour et l'aya du jour (image 1080 px, texte arabe, translittération, traduction, source). Android : feuille de partage (WhatsApp, etc.) ; PC : enregistrement du fichier.
- **Coran hors ligne** : « 📥 Télécharger tout le Coran » (texte arabe et traduction, 114 sourates, stockés sur l'appareil, reprise possible) ; une sourate lue est mémorisée automatiquement ; marque-page 🔖 par verset et bouton « Reprendre ».
- **Confidentialité** : ajout de api.github.com et de Google Fonts à la liste des services contactés ; date mise à jour.
