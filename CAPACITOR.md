# Van web-app naar Android-app (Capacitor)

De app is web-first gebouwd; **Capacitor** verpakt de web-build in een echte Android-app
(en later iOS). `capacitor.config.ts` staat al klaar.

## Stappen (op je eigen pc, met Android Studio geïnstalleerd)
```bash
# 1. Capacitor installeren
npm i @capacitor/core
npm i -D @capacitor/cli

# 2. Android-platform toevoegen
npx cap add android

# 3. Web-app bouwen en naar native syncen
npm run build
npx cap sync

# 4. Openen in Android Studio (daar draai/bouw je de app)
npx cap open android
```

## Aanbevolen native plugins
```bash
npm i @capacitor/geolocation             # nauwkeurige/achtergrond-GPS
npm i @capacitor-community/keep-awake     # scherm aan tijdens rijden
```
De app gebruikt al **abstracties**, dus je hoeft alleen de native-tak in te vullen:
- **Locatie:** `src/services/location/` → maak een `CapacitorLocationProvider` (zelfde
  interface als `WebLocationProvider`) en kies die in `createLocationProvider()` op native.
- **Scherm aan:** `src/services/wakeLock.ts` → vervang de Web Wake Lock-aanroepen door de
  KeepAwake-plugin op native. De rest van de app verandert niet.

## Login & API op mobiel
- **Inloggen met Google** op native: gebruik `@codetrix-studio/capacitor-google-auth` (geeft
  óók een ID-token dat je server verifieert — zelfde flow als op web).
- Zet `VITE_API_URL` naar je echte API-URL (https) en `VITE_GOOGLE_CLIENT_ID` goed.
- Voeg je app-id/redirect toe aan de Google-client (Android-client-id).

## Publiceren (Play Store)
- Google Play Console: **eenmalig $25**.
- In Android Studio: **Build → Generate Signed Bundle** (AAB) met een keystore (goed bewaren!).
- Verplicht vanwege locatie + login: een **privacybeleid**-URL in de Play Console.
