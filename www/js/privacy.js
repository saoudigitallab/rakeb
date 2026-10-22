/* Politique de confidentialité — texte de référence (11 octobre 2026), utilisé tel quel.
   Les lignes qui commencent par « (PC et web uniquement) » ne s'affichent pas dans l'application Android. */
(function (R) {
  'use strict';
  R.privacy = {
    titre: 'Rakeb — Politique de confidentialité',
    maj: 'Dernière mise à jour : 11 octobre 2026',
    sections: [
      { h: '1. Qui sommes-nous', p: ['Rakeb est édité par SAOU DIGITAL LAB, pôle numérique de SAOU SYNERGY GROUP, basé à Mbour, région de Thiès, Sénégal. Pour toute question : saoudigitallab@gmail.com ou WhatsApp / appel au +221 76 418 22 00.'] },
      { h: '2. L\'essentiel', ul: [
        'Pas de compte ni d\'inscription.',
        'Pas de publicité, pas de statistiques d\'usage, pas de pistage.',
        'Vos données personnelles (position, suivi des prières, zakat, favoris…) restent sur votre appareil. Nous n\'avons aucun serveur qui les reçoit.',
        'Certaines fonctions en ligne contactent des services tiers, détaillés à la section 5.'] },
      { h: '3. Données enregistrées sur votre appareil', p: ['Rakeb enregistre localement, sur votre appareil uniquement :'], ul: [
        'vos réglages (méthode de calcul, palette, notifications…) ;',
        'la position utilisée pour calculer les horaires de prière et la direction de la Qibla (GPS, ville choisie ou coordonnées saisies) ;',
        'votre suivi des prières, votre série, votre compteur de tasbih, votre progression dans le programme de 365 jours, les noms d\'Allah marqués comme appris et vos inspirations gardées ;',
        'les montants saisis dans le calculateur de zakat ;',
        'l\'historique de vos conversations avec Muslim IA et, si vous l\'avez saisie, votre clé API ;',
        '(PC et web uniquement) un fichier audio d\'adhan que vous avez choisi.'], p2: ['Ces données ne nous sont jamais transmises.'] },
      { h: '4. Autorisations demandées', ul: [
        'Localisation : uniquement quand l\'application est ouverte et que vous demandez votre position, pour calculer les horaires et la Qibla. Vous pouvez refuser ; certaines fonctions seront alors limitées.',
        'Notifications : pour vous prévenir à l\'heure des prières. Elles sont générées localement par l\'application.',
        'Capteur de boussole : pour afficher la direction de la Qibla. La lecture reste sur votre appareil.',
        'Accès à Internet : pour les fonctions en ligne listées ci-dessous.'] },
      { h: '5. Services tiers contactés', p: ['Quand vous utilisez les fonctions concernées, votre appareil se connecte directement à ces services, qui reçoivent au minimum votre adresse IP, comme tout site web que vous consultez. Chacun applique sa propre politique de confidentialité, que nous ne contrôlons pas.'], ul: [
        'api.alquran.cloud : texte du Coran et traductions (numéro de sourate ou de verset demandé).',
        'mp3quran.net : écoute des sourates (fichier audio demandé).',
        'cdn.jsdelivr.net (dépôt public de hadiths) : hadith du jour.',
        'Anthropic (API Claude) : fonction Muslim IA, voir section 6.',
        '(PC et web uniquement) Overpass API / OpenStreetMap : recherche de mosquées et de commerces halal ; ce service reçoit les coordonnées de la position utilisée pour la recherche.',
        '(PC et web uniquement) ipapi.co : localisation approximative à partir de votre adresse IP, uniquement si vous choisissez cette option.',
        '(PC et web uniquement) Wikipédia ou le flux RSS que vous avez indiqué : article du jour.',
        'Liens externes (cartes, sites web) : ils s\'ouvrent dans votre navigateur ou votre application et dépendent alors de leur éditeur.',
        'WhatsApp, appel téléphonique, e-mail : si vous nous contactez par ces boutons, c\'est vous qui lancez l\'échange. Nous recevons ce que vous nous envoyez (votre numéro ou votre adresse, votre message) et l\'utilisons uniquement pour vous répondre.'] },
      { h: '6. Muslim IA', p: ['Muslim IA envoie vos questions, ainsi que les derniers échanges de la conversation, à Anthropic, avec votre propre clé API. Les réponses sont générées par une intelligence artificielle : elles peuvent comporter des erreurs et ne remplacent pas l\'avis d\'un savant qualifié. Ne saisissez pas d\'informations personnelles sensibles dans vos questions. Votre clé API est stockée uniquement sur votre appareil ; nous n\'y avons pas accès. Vous pouvez la supprimer dans les paramètres de l\'application et la révoquer depuis votre compte Anthropic.'] },
      { h: '7. Conservation et suppression', p: ['Vos données restent sur votre appareil tant que vous ne les supprimez pas. Pour tout effacer : désinstallez l\'application, ou effacez ses données dans les réglages de votre système (sur Android : Paramètres › Applications › Rakeb › Stockage › Effacer les données). Sur PC, la section « Mes données » des paramètres permet aussi d\'effacer le suivi et la série.'] },
      { h: '8. Enfants', p: ['Rakeb ne demande ni âge ni identité et ne collecte aucune donnée personnelle sur nos serveurs. Nous recommandons que les mineurs soient accompagnés d\'un parent pour utiliser Muslim IA.'] },
      { h: '9. Sécurité', p: ['Vos données locales sont protégées par les mécanismes de votre appareil (code de verrouillage, chiffrement du stockage…). Nous vous conseillons d\'activer le verrouillage de l\'écran. Les connexions aux services tiers passent, dans la mesure du possible, par HTTPS.'] },
      { h: '10. Vos droits et contact', p: ['Comme nous ne conservons pas vos données personnelles, vous les gérez directement dans l\'application. Pour toute question ou demande concernant les échanges que vous nous avez envoyés (WhatsApp, e-mail, appel), écrivez à saoudigitallab@gmail.com. Cette politique tient compte de la loi sénégalaise n° 2008-12 du 25 janvier 2008 sur la protection des données à caractère personnel ; vous pouvez saisir la Commission de protection des données personnelles (CDP) si vous estimez que vos droits ne sont pas respectés.'] },
      { h: '11. Modifications', p: ['Nous pouvons mettre à jour cette politique, par exemple lorsqu\'une fonctionnalité change. La date de dernière mise à jour figure en tête de ce document.'] }
    ]
  };
})(window.R = window.R || {});
