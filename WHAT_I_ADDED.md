# Wat er is toegevoegd — overzicht

Dit is je samenvatting van sweetscoots: wat de app nu kan, wat er deze sessie bij kwam,
hoe het beveiligd is, en wat jíj nog moet doen. Diepere docs: [ROADMAP.md](./ROADMAP.md) ·
[HANDOVER.md](./HANDOVER.md) · [server/README.md](./server/README.md) ·
[server/SECURITY.md](./server/SECURITY.md) · [CAPACITOR.md](./CAPACITOR.md) ·
[VERDIENMODEL.md](./VERDIENMODEL.md).

---

## In één zin
Een scooter-navigatie-app (blauw + geel kenteken) met **Waze-stijl community-meldingen**
(politie, **rollerbank**, hulpdiensten, gevaarlijk wegdek, wegafsluitingen), turn-by-turn
navigatie met stem, en een veilige eigen backend met Google-login.

## Nieuw deze sessie (de eindsprint) ✨
- ☰ **Menu-knop i.p.v. topbar**: één knop opent een bottom-sheet met **Google-login +
  kenteken (blauw/geel) + instellingen**. Melden is een aparte oranje knop.
- 🏠 **Opgeslagen plekken** (thuis/werk): bewaar een bestemming en navigeer er met één tik heen.
- 🚦 **Snelheidslimiet-waarschuwing**: limietbord (25 blauw / 45 geel); de snelheids-pill
  wordt **rood** als je te hard gaat.
- 🟦 **Waze-style layout**: zoekbalk onderaan ("Waarheen?"), navigatie-onderbalk met
  **aankomsttijd + resterende tijd/afstand**, **snelheids-pill**, "centreer op mij"-knop,
  meld-grid (iconen-raster) en een richtingspijl.
- 🐛 **Fix:** een tik op de kaart verandert je route niet meer als je er al een hebt gekozen
  (gebruik "wissen" of de zoekbalk voor een nieuwe bestemming).
- 🛰️ **Preciezere locatie** (voor echt rijden): high-accuracy GPS + de stip **"snapt" op de
  route** tijdens navigatie (geen zijwaartse sprongen) + een **richtingspijl**.
- 🚲 **"Ga hier het fietspad op/af"**: detecteert fietspad↔weg-overgangen per kenteken
  (Valhalla `trace_attributes`) en toont + **spreekt** ze uit onderweg.
- 🧭 **Third-person navigatiemodus** (Waze-stijl): bij "Start navigatie" kantelt de kaart,
  zoomt in en **draait mee met je rijrichting**; volgt je positie. Stoppen met de ✕-knop.
- 🔁 **Route-herberekening** als je verkeerd rijdt (off-route → automatisch opnieuw).
- 🔐 **Melden vereist inloggen** met Google (zo zie je wie misbruik maakt van meldingen).
- 🔎 **Adres zoeken** (geocoding via OpenStreetMap/Nominatim) — zoekbalk met suggesties.
- 🗣️ **Turn-by-turn navigatie + gesproken instructies** ("Sla linksaf naar Waterlandlaan")
  in NL of EN. Geverifieerd: routes geven echte stap-voor-stap instructies.
- 🔆 **Scherm blijft aan** tijdens (gesimuleerde) navigatie (Wake Lock).
- 🌍 **Meertalig (i18n)**: volledige NL + EN UI, omschakelbaar in instellingen.
- 🎛️ **Meldingen-filter**: kies welke types je op de kaart ziet.
- 📱 **Capacitor-opzet** voor een Android/Play Store-app (config + stappen in CAPACITOR.md).
- 🔐 **Inloggen met Google** + complete **beveiligings-audit** (zie hieronder).
- 🧹 **Supabase volledig verwijderd** (gekozen voor eigen API/VPS) → bundle ~215 kB kleiner.
- 🐛 Console-fouten opgelost: dubbele Google-init, poort vastgezet (5173), omleidings-400's
  verminderd, ontbrekende kaart-icoontjes + favicon stilgemaakt.

## Alle features (volledige lijst)
**Kaart & locatie** — MapLibre-kaart (Purmerend), live "jij bent hier"-stip, keyless tegels.
**Routes** — Valhalla-routing met **kenteken-profielen** (blauw=snorfiets ~25 km/u mag fietspad,
geel=bromfiets 45 km/u), tot **3 alternatieven**, kies een route.
**Wegafsluitingen** — als **lijn die de weg volgt** (gesnapt), en de route **gaat eromheen**
(client-side detour; hard via je eigen Valhalla).
**Community-meldingen** — plaatsen **Waze-stijl op je eigen locatie** (één tik); afsluiting
teken je (begin→eind). **Bevestigen** ("staat het er nog?"), **één stem per gebruiker**, en
**automatisch verwijderen na 5× "weg"**.
**Onderweg** — alert voor meldingen vóór je ("⚙️ Rollerbank over 350 m") + turn-by-turn + stem.
**"▶ Simuleer rit"** om alles op de desktop te testen zonder te rijden.
**Instellingen** — thema (licht/donker), taal (NL/EN), standaard kenteken, stem aan/uit,
scherm-aan, meldingen-filter.

## Beveiliging (cruciaal — getest)
- **Inloggen met Google**: **geen wachtwoorden opgeslagen**. Schrijven (plaatsen/stemmen)
  vereist een **server-geverifieerd** Google-token; de stem-id is de Google-account-id
  (server-bepaald) → **stem-manipulatie dicht**.
- **API gehard + live getest** (zie `server/SECURITY.md`): SQL-injectie, ongeldige input,
  te grote bbox/body, spam → allemaal geweigerd. Rate-limiting, input-validatie, HTTPS,
  firewall, geen admin-paneel op internet. **0 npm-vulnerabilities.**
- Eerlijk restrisico: iemand met meerdere Google-accounts kan stemmen stapelen → later
  Play Integrity als extra slot (staat in SECURITY.md).

## Architectuur (kort)
- `src/` — Vue 3 + TypeScript app. Backends/diensten achter **interfaces** (makkelijk wisselen):
  `services/reports` (mock | eigen api), `services/routing` (Valhalla), `services/location`
  (browser-GPS → Capacitor later), `services/auth` (Google), `services/i18n`, `services/geocoding`,
  `services/wakeLock`, `stores/settings`.
- `server/` — eigen REST-API (Node/Express) + Postgres-schema + beveiliging.
- `valhalla/` — Docker-opzet voor je eigen routeserver.

## Hoe draai je het (dev)
```bash
npm install
npm run dev        # http://localhost:5173
```
`mock`-backend werkt zonder server (voorbeeldmeldingen). Voor de echte backend: `server/` opzetten
en `.env` → `VITE_REPORTS_BACKEND=api` + `VITE_API_URL` + `VITE_GOOGLE_CLIENT_ID`.

## ⚠️ Wat JIJ nog moet doen
1. **Google-login werkend maken:** in Google Cloud Console bij je OAuth-client **Authorized
   JavaScript origins** → voeg `http://localhost:5173` toe (en later je productie-URL).
   Zet dezelfde client-id als `GOOGLE_CLIENT_ID` op de server.
2. **Eigen backend live** (als je echte data wilt): volg `server/README.md` (Postgres + API +
   HTTPS + back-ups via cron).
3. **Eigen Valhalla** voor harde afsluiting-vermijding + heel NL: `valhalla/README.md`.
4. **Mobiele app:** `CAPACITOR.md`.

## Stand van de roadmap
**Klaar:** kaart+locatie, routes+kenteken-profielen, alternatieven, afsluitingen (lijn +
vermijden), community-meldingen (plaatsen/bevestigen/verwijderen, 1 stem p.p.), alerts onderweg,
turn-by-turn + stem, zoeken, i18n NL/EN, instellingen + filter, scherm-aan, eigen API + audit +
Google-login, Capacitor-opzet.
**Nog te doen / later:** eigen Valhalla draaien (harde afsluiting-vermijding + heel NL),
GPS gladstrijken (map-matching), kaart dag/nacht, per-land scooter-regels (internationaal),
Play Integrity (extra anti-misbruik), de Android-app daadwerkelijk bouwen + publiceren.

_Alle code compileert (build groen) en de externe diensten (geocoding, routing-instructies,
auth-gate) zijn live getest._
