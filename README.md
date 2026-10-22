# Rakeb — compagnon musulman (SAOU DIGITAL LAB)

Un seul code (`www/`, HTML + JavaScript, sans Expo ni React Native) produit :
- **Android (téléphones et tablettes)** : un `.apk` universel, via Capacitor 5. **Android 5.1 (API 22) et plus.**
- **Windows 32 bits** : un `.exe` portable et un installateur, via Electron 22. **Windows 7 et plus** (fonctionne aussi en 64 bits).

## Générer les fichiers
1. Mettre tout ce dossier dans le dépôt GitHub (branche `main`).
2. Onglet **Actions** › « Build Android (APK) » ou « Build Windows (EXE 32 bits) » › **Run workflow**. Chaque push sur `main` les relance aussi.
3. En bas de l'exécution, section **Artifacts** : `rakeb-android-apk` (Rakeb-android.apk) et `rakeb-windows-exe` (portable + installateur).
4. Liens permanents : `git tag v1.0.0 && git push --tags` → fichiers dans **Releases**.

## Tester sans GitHub
- `npm test` : vérifie le calcul des horaires et de la Qibla.
- Ouvrir `www/index.html` dans un navigateur : l'application complète fonctionne (sauf boussole et rappels Android).
- PC : `cd desktop && npm install && npm start`.

## Signature de l'APK (important)
- Sans réglage, l'APK est signé avec la **clé de test** `signing/rakeb-test.jks` (publique, dans le dépôt). Avantage : chaque nouvel APK s'installe par-dessus le précédent. Inconvénient : n'importe qui peut signer un faux APK avec cette clé. À réserver à un usage personnel ou de test.
- Pour une diffusion publique (ou Google Play), créer sa propre clé :
  1. `keytool -genkeypair -v -keystore my-rakeb.jks -alias rakeb -keyalg RSA -keysize 2048 -validity 10000`
  2. `base64 -w0 my-rakeb.jks` (PowerShell : `[Convert]::ToBase64String([IO.File]::ReadAllBytes("my-rakeb.jks"))`)
  3. Dépôt › Settings › Secrets and variables › Actions : `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
  4. Garder `my-rakeb.jks` en lieu sûr : le perdre empêche toute mise à jour.
- Une ancienne Rakeb installée avec une autre clé (EAS, par exemple) doit être **désinstallée** avant d'installer cet APK. C'est la cause probable de « Appli non installée ».

## Limites
- Android 4 et antérieurs : impossible (les WebView sont trop anciens).
- Windows : l'`.exe` n'est pas signé (certificat payant) ; SmartScreen affiche « Informations complémentaires › Exécuter quand même ».
- Rappels de prière : Android (notifications programmées pour 3 jours, renouvelées à chaque ouverture) ; PC (application ouverte).
- Muslim IA : chaque utilisateur saisit sa propre clé API Anthropic (stockée sur l'appareil).

## Contenu
`www/` application · `desktop/` Electron · `scripts/` outils (icônes Android, tests, préparation PC) · `signing/` clé de test · `assets/icon.png` icône · `.github/workflows/` les deux compilations.
Logo SAOU DIGITAL LAB : déposer `www/assets/logos/saou-digital-lab.png` (sinon le nom s'affiche en texte).
