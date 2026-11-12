# Cahier des charges des évolutions de Rakeb (prompt de référence)

> Document fourni par le propriétaire du projet (novembre 2026). Il sert de référence pour les prochaines évolutions.
> Statut : **plan à valider avant toute implémentation** (voir `LISEZ-MOI.md`, section « Plan A → E »).

# RÔLE
Tu es développeur senior Electron 31 + Capacitor 5 + JavaScript vanilla.
Tu travailles sur l'application **Rakeb**, un projet existant dont tu dois
respecter l'architecture à la lettre. Tu livres du code testé, sans régression.

# CONTEXTE DU PROJET (à lire avant toute modification)
- Une seule application pour Windows et Android, une seule source de vérité :
  `RakebDesktop/index.html`. `RakebMobile/` (Capacitor 5) la reprend
  automatiquement via `scripts/` — ne JAMAIS dupliquer la logique UI.
- `RakebDesktop/main.js` = processus principal Electron (tray, alertes, IPC).
- `RakebMobile/android-shim.js` = équivalent côté WebView Android (ponts natifs).
- Classes Java natives dans `RakebMobile/android-native/` :
  `AdhanPlugin`, `AdhanScheduler`, `AdhanService`, `AdhanReceiver`,
  `BootReceiver`, `CompassPlugin`. Enregistrement auto via
  `scripts/android-setup.js`.
- Version unique : `const APP_VERSION` dans `RakebDesktop/index.html`,
  propagée par `scripts/sync-version.js` vers les `package.json` et le
  `versionName` de l'APK.
- Tests : `tests/` (37 vérifications, lancés par GitHub avant chaque build).
  Commande locale : `cd tests && npm install && npm test`.
- Contraintes produit :
  - **Hors-ligne d'abord** : toute fonctionnalité doit fonctionner sans réseau
    quand c'est possible ; les appels réseau doivent être optionnels,
    timeout court (≤ 5 s), mis en cache localement.
  - **Aucune donnée personnelle envoyée sans consentement** (position arrondie,
    pas d'identifiant).
  - **Alertes de prière** : reprogrammées à chaque changement de réglage et à
    chaque ouverture ; alarmes exactes Android ; après redémarrage du téléphone.
  - **Signaler une réponse / bug** : bouton WhatsApp prérempli avec
    `APP_VERSION` + modèle d'appareil.
  - Écran Confidentialité : lister TOUT service contacté (api.github.com,
    Google Fonts, + ceux ajoutés ci-dessous).
- Ne pas casser : horaires de Dakar, calcul des prières, alarmes, adhan natif,
  boussole (priorité à l'événement magnétique absolu, déclinaison appliquée),
  export/import « Mes données », partage image, marque-pages Coran.

# OBJECTIFS À IMPLÉMENTER (dans cet ordre de priorité)

## A. Mouslim IA — « mode sources vérifiées » sans clé API
Mouslim IA doit être utile **dès l'installation, sans clé**. La clé API
(OpenAI/autre) ne sert qu'à améliorer la réponse (reformulation, dialogue).

### A1. Détection d'intention (local, sans réseau)
Fonction `detectIntent(question)` qui classe en :
`quran` | `hadith` | `tafsir` | `prayer_time` | `dua` | `general` | `fiqh`.
Mots-clés FR/AR/Wolof + heuristiques simples. Si `fiqh` (halal/haram, divorce,
héritage, etc.) → **ne jamais générer de réponse** : afficher un avertissement
et renvoyer vers un savant / une source reconnue.

### A2. Appels aux API publiques (sans clé), liste blanche uniquement
- `api.alquran.cloud`        → versets + traductions FR/EN
- `quran.com/api` (v4)       → tafsir court
- `sunnah.com` (API publique) → hadiths (Boukhari, Muslim, etc.)
- `api.aladhan.com`          → recoupement horaires de prière
Bannir toute recherche web ouverte (Google/Bing). Pas de scraping d'IslamQA
ni de sites d'avis juridique (ToS + risque de contexte tronqué).

### A3. Réponse « mode sources »
- Rendu structuré : texte arabe + translittération (si dispo) + traduction +
  **source cliquable** (sourate:verset, n° de hadith, page de tafsir).
- Bandeau permanent : « Réponse issue de [source]. Activez la clé API dans
  Réglages › Mouslim IA pour des réponses personnalisées. »
- Cache local des réponses déjà obtenues (mode hors-ligne partiel).
- Timeout 5 s, gestion propre des erreurs (afficher le détail type « HTTP 403 »,
  comme pour « Dernier article »).
- User-Agent conforme (nom + adresse e-mail de contact), comme déjà fait pour
  Wikipédia.

### A4. Si clé API présente
Chemin existant conservé, mais **toute réponse religieuse doit citer ses
sources** ; avertissement rappelé : « consultez une personne qualifiée pour
une question religieuse. »

### A5. Confidentialité
Ajouter les 4 domaines ci-dessus à l'écran Confidentialité + date mise à jour.

## B. Mode Ramadan
- Compte à rebours du jeûne (imsak/iftar) basé sur le calcul de prières existant.
- Rappel 10 min avant l'iftar (notification silencieuse Android / toast PC).
- Dua de rupture du jeûne (déjà dans la bibliothèque duas) mise en avant.
- Compteur de jeûnes + calendrier lunaire ajustable (+/− 1 jour).
- Écran dédié accessible depuis l'accueil pendant le mois de Ramadan.

## C. Qibla par carte (secours sans capteur)
- En plus de la boussole et du repère soleil, afficher une carte
  **OpenStreetMap** (tuiles hors-ligne possibles) avec la direction tracée
  vers La Mecque.
- Utile pour les appareils sans magnétomètre (ex. Tecno KG5P) : message clair
  déjà en place, ajouter le lien vers la carte.
- Ne se charge que si l'utilisateur l'active (pas de requête réseau silencieuse).

## D. Calendrier hégirien
- Afficher la date hégirienne à côté de la grégorienne (accueil + entête).
- Ajustement manuel +/− 1 jour (Réglages).
- Aucun calcul réseau requis (algorithme tabulaire intégré).

## E. Petites finitions utiles
- Bouton « copier » sur chaque dua, aya, hadith.
- Recherche locale dans la bibliothèque duas/azkar (mot-clé, thème, source).
- Historique de recherche Coran.
- Numéro de version visible dans À propos (déjà propagé via `APP_VERSION`).
- Accessibilité : labels ARIA sur boutons d'action, contrastes vérifiés.
- Profils d'ajustement d'horaires par mosquée (nom + 5 ajustements −30/+30),
  enregistrés localement, sélectionnables dans Horaires.

# CE QUE TU NE DOIS PAS FAIRE
- Dupliquer du code entre `RakebDesktop/` et `RakebMobile/`.
- Ajouter une dépendance lourde (framework UI, librairie de cartes JS massive) :
  préférer du vanilla + un `<iframe>` OSM pour la carte.
- Faire des appels réseau non listés dans l'écran Confidentialité.
- Scraper des sites d'avis juridique.
- Générer des fatwas automatiquement.
- Casser les 37 tests existants.
- Modifier `APP_VERSION` toi-même (je le ferai à la Release).

# LIVRABLES ATTENDUS
1. **Code** modifiant `RakebDesktop/index.html` (+ `main.js`,
   `android-shim.js`, `scripts/`, `tests/` si nécessaire) — pas de copie
   dans `RakebMobile/` sauf pour les fichiers Android natifs.
2. **Tests** ajoutés dans `tests/` couvrant :
   - `detectIntent` sur 20 phrases types (dont fiqh → avertissement) ;
   - le mode sources (mock des 4 API, succès + timeout + erreur HTTP) ;
   - le cache local (2ᵉ appel identique = pas de requête réseau) ;
   - l'ajout des domaines à la Confidentialité ;
   - le calcul hégirien (au moins 3 dates connues) ;
   - les ajustements par mosquée.
   Objectif : passer de 37 à **≥ 50 vérifications**.
3. **Écran Confidentialité** mis à jour (domaines + date).
4. **Note de version** rédigée au format des sections existantes du
   `LISEZ-MOI.md` (« Évolutions du JJ mois AAAA (version X.Y.Z) »).
5. **Résumé court** en fin de réponse : fichiers modifiés, tests lancés,
   points d'attention pour la relecture religieuse.

# MÉTHODE DE TRAVAIL
1. Commence par lire `RakebDesktop/index.html`, `RakebDesktop/main.js`,
   `RakebMobile/android-shim.js`, `tests/`, et le `LISEZ-MOI.md`.
2. Propose un **plan en 5 étapes** (A → B → C → D → E) avec les fichiers
   touchés, AVANT d'écrire du code. Attends mon accord si une étape touche
   les alarmes, l'adhan ou la boussole.
3. Implémente étape par étape. Après chaque étape : `cd tests && npm test`,
   et corrige jusqu'à 100 % vert.
4. À la fin, fournis la note de version et le résumé.

# CRITÈRES DE VALIDATION FINALE
- [ ] `npm test` ≥ 50 vérifications, toutes vertes.
- [ ] Mouslim IA répond sans clé sur : verset, hadith, tafsir, horaire.
- [ ] Mouslim IA refuse de générer une fatwa (test dédié).
- [ ] Aucune requête réseau hors liste blanche (vérifiable par grep).
- [ ] Confidentialité à jour (domaines + date).
- [ ] Rakeb fonctionne hors-ligne : alertes, adhan, boussole, Coran téléchargé,
      duas, tasbih, export.
- [ ] Rien de cassé sur Tecno KG5P (absence magnétomètre) ni sur Windows 10.

Commence par le **plan en 5 étapes**, puis attends mon accord.
