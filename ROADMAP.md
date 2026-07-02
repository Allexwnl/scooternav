# sweetscootsigatie — Roadmap

> **Visie:** een navigatie-app die écht weet hoe een scooter rijdt — voor zowel
> **blauw kenteken (snorfiets, 25 km/u)** als **geel kenteken (bromfiets, 45 km/u)** —
> en die je betrouwbaar de juiste route geeft (inclusief fietspad op/af), zonder dat
> het scherm uitvalt of de locatie wegspringt. Plus **live community-meldingen**
> (politie, rollerbank-controles, hulpdiensten, gevaarlijke wegstukken) — Waze-stijl,
> maar dan voor scooters.
>
> **Regio:** eerst **Purmerend** (klein = snel itereren), daarna **heel Nederland**.
> **Platform:** web-app eerst (PWA), met **Capacitor** zodat het makkelijk een echte
> Android/iOS-app wordt.

---

## Kernidee: niet zelf bouwen, maar slim samenstellen

Het zware werk (kaartdata + routeberekening) bestaat al gratis. Wij knopen het aan elkaar
en doen de scooter-specifieke logica.

| Onderdeel | Wat we gebruiken | Zelf bouwen of samenstellen? |
|---|---|---|
| Kaartdata | **OpenStreetMap** (gratis; bevat toegang per voertuig, fietspaden, max-snelheid) | samenstellen |
| Routeberekening | **Valhalla** (open source, heeft een `motor_scooter`-profiel + custom profielen) | samenstellen + tunen |
| Kaart op scherm | **MapLibre GL** (gratis, open versie van Mapbox) | samenstellen |
| Kaart-tegels | MapTiler (gratis tier) → later self-host / **Protomaps** (offline) | samenstellen |
| App-schil | **Vue 3 + Vite + TypeScript**, wrappen met **Capacitor** | zelf bouwen |
| Scooter-logica | blauw/geel profielen, fietspad op/af, GPS-stabiliteit | **zelf — dit is onze toegevoegde waarde** |

---

## De drie moeilijke kernen (eerlijk)

1. **Blauw vs geel kenteken = twee verschillende routeprofielen.**
   - **Geel (bromfiets, 45 km/u):** op de rijbaan, soms op een bromfietspad, **niet** op
     gewone fietspaden, **niet** op de snelweg. → dicht bij Valhalla's `motor_scooter`.
   - **Blauw (snorfiets, 25 km/u):** vaak op het **fietspad**, maar in sommige steden
     (bijv. delen van Amsterdam) juist op de rijbaan met helmplicht. → vraagt een
     **fiets-achtig, gemotoriseerd profiel** op 25 km/u.
   - **Risico:** de kwaliteit van OSM-tags (`moped`, `mofa`, bromfietspad-tags) bepaalt
     hoe goed dit klopt. Dit moeten we per regio controleren en bijschaven.

2. **"Fietspad op/af"-melding.** De route loopt grotendeels al over de juiste weg-soort
   per kenteken. De melding zelf = een UI-laag die het **wegtype van het huidige/volgende
   segment** leest en waarschuwt bij een overgang weg ↔ fietspad.

3. **Betrouwbaarheid tijdens het rijden** (jouw harde eisen):
   - **Scherm mag niet uitvallen** → wake lock.
   - **Locatie mag niet wegspringen** → high-accuracy GPS + smoothing/map-matching
     (positie "snappen" op de route).

---

## Architectuur: PWA-first, Capacitor-ready

Eén web-app (Vue + Vite + TS). Native functies achter een **dunne abstractielaag**:

```
UI (Vue componenten)
        │
Services-laag (TypeScript)
  ├─ geolocatie   → web: Geolocation API   | native: @capacitor/geolocation
  ├─ wake lock    → web: Wake Lock API      | native: @capacitor-community/keep-awake
  └─ routing      → fetch() naar Valhalla (zelfde op web én native)
```

Zo werkt het meteen in de browser én is de stap naar Capacitor klein (alleen de
native-tak invullen). **Geen herbouw nodig.**

---

## Fasen

### Fase 0 — Fundament & eerste kaart  ✅ *gebouwd*
- [x] Repo: Vue 3 + Vite + **TypeScript** opzetten.
- [x] MapLibre GL kaart tonen, gecentreerd op **Purmerend** (keyless OpenFreeMap-tegels).
- [x] Browser-geolocatie: een "jij bent hier"-stip die meebeweegt.
- [x] Abstractielaag voor geolocatie klaargezet (web-tak nu, Capacitor later). Wake lock volgt in Fase 4.
- [x] **Extra (op verzoek):** meldingen-databron achter één `ReportsBackend`-interface →
      mock/eigen API wisselbaar via `.env` (`VITE_REPORTS_BACKEND`).
- **Leerdoel (TS):** types, hoe een kaart en geolocatie werken.
- **Klaar als:** je ziet de kaart van Purmerend met je eigen positie erop. ✓

### Fase 1 — Routeberekening (MVP)  ✅ *gebouwd*
- [x] Valhalla aanspreken via **publieke FOSSGIS-instance** (dev-proxy in Vite → geen CORS).
- [x] Bestemming kiezen door **op de kaart te tikken** → route op kaart + afstand + ETA.
      **Zoekveld (adres-zoeken via Nominatim) ✓ toegevoegd.**
- [x] **Kenteken-toggle (blauw/geel)** in de UI — schakelt nu al van costing:
      geel = `motor_scooter`, blauw = `bicycle` (voorlopige benadering, Fase 2 verfijnt).
- [x] **Alternatieve routes (max 3, Waze-stijl):** via Valhalla `alternates` → tot 3 routes
      met afstand + ETA; tik een kaartje of de lijn om te kiezen. Annoteren ("vermijdt
      rollerbank-controle") volgt zodra Track B meedoet.
- **Klaar als:** je plant in Purmerend een route van A naar B en kiest uit max 3 routes. ✓
- ⚠️ Publieke FOSSGIS-Valhalla = alleen dev/fair-use. Eigen self-hosted Valhalla = Fase 2.

### Fase 2 — Twee profielen écht goed doen  🟡 *deels gebouwd*
- [x] **Self-host Valhalla**: Docker-setup klaar in `valhalla/` (compose + README).
      Jij draait `docker compose up` lokaal om de tiles te bouwen (NL- of Purmerend-extract).
- [x] **Geel**: `motor_scooter`, top 45 km/u, vermijdt snelwegen.
- [x] **Blauw**: `bicycle`-profiel (mag fietspad), ~25 km/u — benadering.
- [x] ETA's per snelheid (25 vs 45 km/u) via `costing_options`.
- [ ] Tags in Purmerend controleren + profielen fijn afstellen op je eigen Valhalla.
- **Klaar als:** dezelfde A→B een duidelijk andere, juiste route geeft per kenteken. ✓ (basis staat)

### Fase 3 — Navigatie-modus + "fietspad op/af"  ✅ *gebouwd*
- [x] Valhalla maneuvers → **stapsgewijze instructies** in de UI **+ gesproken** (NL/EN).
- [x] **Fietspad op/af-melding** bij overgang weg ↔ fietspad (kenteken-afhankelijk, via
      Valhalla `trace_attributes`) — wordt getoond én uitgesproken tijdens navigatie.
- [x] **Third-person navigatiemodus** (Waze-stijl): gekanteld + ingezoomd, kaart draait mee
      met de rijrichting en volgt je positie. Start via "Start navigatie" (GPS) of "Simuleer rit".
- **Klaar als:** je een ritje kunt "narijden" met instructies op het scherm. ✓ (via "Simuleer rit")

### Fase 4 — Betrouwbaarheid (jouw expliciete eisen)  🟡
- [x] **Scherm aan houden** tijdens navigatie (Wake Lock; instelbaar).
- [x] **GPS-stabiliteit:** high-accuracy `watchPosition` (verse fixes) + **map-matching**
      (positie op de route snappen) + **richtingspijl** zodat de stip niet wegspringt.
- [x] **Herberekenen** als je off-route raakt (> ~55 m van de route → automatisch opnieuw, met cooldown).
- **Klaar als:** een echte testrit niet uitvalt en de positie netjes op de route blijft.

### Fase 5 — Mobiele app via Capacitor  🟡 *opzet klaar*
- [x] **Opzet + stappen klaar**: `capacitor.config.ts` + `CAPACITOR.md` (installeren, android
      toevoegen, native plugins voor GPS/keep-awake/Google-login). Bouwen = lokaal met Android Studio.
- [ ] Native plugins daadwerkelijk inhaken + testen op een echte telefoon, op de scooter.
- **Klaar als:** je een installeerbare Android-app hebt die hetzelfde doet.

### Fase 6 — Heel Nederland + polish
- [ ] Volledige **NL OSM-extract** in self-hosted Valhalla.
- [ ] **Offline kaarten** (Protomaps pmtiles) — stretch.
- [x] **Stem-instructies** (NL/EN) + **dark mode** ✓. Resteert: glanceable UI, batterijzuinig.

---

## Track B — Community-meldingen (Waze-stijl)

> **Positionering:** "Flitsmeister, maar voor scooters" — met als unieke troef
> **rollerbank-controles**, waar juist scooterrijders last van hebben en die de
> bestaande apps niet goed dekken.

**Meldingtypes**

| Type | Live of vast | Waarom |
|---|---|---|
| 🚓 Politie / controle | live (vervalt vanzelf) | algemene politiecontrole |
| ⚙️ **Rollerbank-controle** | live | dé scooter-killer — opvoer-/snelheidscontrole |
| 🚑 Hulpdiensten / ongeluk | live | naderende hulpdiensten, ongeval |
| ⚠️ Gevaarlijk wegdek/situatie | live én vast | kuilen, tramrails, gladheid, gevaarlijk kruispunt |
| 🚧 Weg afgesloten / werkzaamheden | live én vast | **als lijn** (van–tot, langs de weg, Waze-stijl); beïnvloedt de route |

**Waarschuwings-afstanden (vooral voor de rollerbank-melding)**
Een vaste cirkel is te grof (je kunt vlakbij zijn op een parallelweg die de controle niet passeert). Daarom gelaagd:
- **Kern-/risicozone ~300–500 m:** "hier word je daadwerkelijk aangehouden."
- **Waarschuwing ~1,5–2 km vooruit, alléén als het op je route/rijrichting ligt:** zo ver van tevoren krijg je de melding, zodat je nog kunt omrijden.
- **Beter dan afstand: op tijd waarschuwen (~2–3 min vooruit).** Schaalt automatisch mee met snelheid — snorfiets (25 km/u) en bromfiets (45 km/u) krijgen dan evenveel reactietijd.
- Trigger op "ligt op mijn route", niet op een kale cirkel. **Start met deze waardes en tune later** met echte meldingen.

**Backend — jouw Laravel-wereld 🎯**
Precies waar jouw werk-stack past: een kleine **Laravel-API** + database met
**geo-queries** (PostGIS / spatial index).
- `POST /reports` — melding plaatsen (type, lat/lng, tijd, richting).
- `GET /reports?bbox=...` — meldingen rond je positie ophalen.
- **Live = simpele polling** (elke ~15–30 s of bij kaartbeweging), géén realtime-socket nodig.
  Op een rijdende scooter met wisselend signaal is dat robuuster én zuiniger. Realtime
  pop-ups zijn een optionele extra voor véél later — geen afhankelijkheid.
- **Vervallen vanzelf** (TTL/tijdsverval) — een melding van 3 uur geleden is niet relevant.
- **Bevestigen/wegstemmen** ("staat er nog" / "weg") → betrouwbaarheid.
- **Anti-misbruik:** rate-limiting, apparaat-gebonden, spam/nep tegengaan.

**De échte uitdaging (eerlijk): netwerk-effect.**
De code is goed te doen. Maar een crowdsource-laag is **alleen waardevol met genoeg
actieve melders.** Met 5 gebruikers in Purmerend blijft de kaart leeg. Dit is het
moeilijkste deel — moeilijker dan de techniek.
- **Aanpak:** hyperlokaal starten in een bestaande Purmerendse scooter-community
  (Facebook/forum), en inzetten op de **rollerbank-niche**: hoge emotionele waarde →
  mensen melden én checken graag. Pas uitbreiden als het lokaal "leeft".

**Fasering (loopt parallel; alert-onderweg pas ná navigatie-modus van Fase 3)**
- [x] **B1** — Meldingen tonen: pins op de kaart. Nu via een **mock-backend** met
      voorbeeldmeldingen rond Purmerend + **polling** (elke 20 s / bij kaartbeweging),
      achter de `ReportsBackend`-interface. Swap naar je eigen API = later, zonder app-wijziging.
      Wegafsluitingen tonen als **rode lijn die het wegennet volgt** (van–tot, gesnapt
      via Valhalla `pedestrian` — geen omwegen), niet als punt.
- [x] **B2** — Melden (Waze-stijl): knop **➕** → kies type. Punt-meldingen (politie,
      rollerbank, hulpdienst, gevaarlijk wegdek) komen **direct op je eigen locatie** te
      staan (geen getik), met een korte bevestiging. Een **wegafsluiting** teken je op de
      kaart (begin + eind), gesnapt aan de weg. **Melden vereist nu inloggen** (accountability).
- [x] **B3** — **Bevestigen (Waze-stijl):** tik een melding (pin of afsluitingslijn) →
      *"Staat het er nog? 👍 Ja / 👎 Weg"*. **Eén stem per gebruiker** (apparaat-id) —
      dubbel stemmen telt niet. Na **5 verschillende "weg"-stemmen** wordt de melding
      **automatisch verwijderd**. (Server dwingt dit later af; automatische prompt onderweg
      + tijdsverval komen nog.)
- [x] **B4** — **Alert onderweg**: terwijl je rijdt waarschuwt de app voor een melding
      vóór je op de route ("⚙️ Rollerbank-controle · over 350 m"), met live afstand
      (binnen ~1 km, alleen meldingen die echt op de route liggen). Werkt met je GPS; voor
      testen op de desktop een **"▶ Simuleer rit"** die een virtuele positie over de route
      laat lopen. (Instelbare afstand = Track C; stem-melding = Fase 6.)
- 🟡 **B5** — **Wegafsluitingen in de route (Waze-stijl):** lijn-weergave ✓, aanmaken +
      aan-de-weg-snappen ✓. Vermijding nu tweeledig:
      (a) **client-side** — routes langs een afsluiting krijgen "⚠ langs afsluiting"; loopt
      élke route erlangs, dan wordt er via een tussenpunt **actief omheen gestuurd**
      (geverifieerd op de publieke server), of een duidelijke melding als het niet lukt;
      (b) **`exclude_polygons`** wordt meegestuurd zodat een **self-hosted Valhalla** er
      hard omheen stuurt. ⚠️ De publieke FOSSGIS-instance negeert exclude — volledig hard
      blokkeren werkt dus pas na self-host (Fase 2).
- [x] **Echte backend** — eigen REST-API + Postgres-schema klaar in `server/` (Node/Express).
      Zet `VITE_REPORTS_BACKEND=api` + `VITE_API_URL`: meldingen en stemmen worden dan echt
      opgeslagen, en "1 stem per gebruiker" + auto-verwijderen na 5× "weg" draaien
      **serverseitig** (PK + trigger). Tot dan blijft `mock` de standaard.

---

## Track C — Instellingen / UI  🟡 *deels gebouwd*

Een instellingen-scherm (tandwiel rechtsboven) waarin je de app naar jezelf zet.
Opgeslagen in `localStorage`; later eventueel gekoppeld aan een account.

- [x] **Thema licht/donker** (handig 's nachts op de scooter).
- [x] **Kenteken-keuze onthouden** (blauw/geel).
- [ ] **Kaart dag/nacht** (andere kaartstijl; vereist herladen van de stijl + opnieuw
      tekenen van routes/meldingen).
- [x] **Welke meldingen tonen** (filter per type) ✓.
- [ ] **Waarschuwingsafstand rollerbank** instelbaar (nu vast ~1 km; zie B4).
- [x] **Stemmeldingen** aan/uit ✓.
- [x] **Scherm aan houden** tijdens rijden ✓.
- [x] **Taal (NL/EN)** ✓ (i18n).
- [ ] **Tekstgrootte / glanceable modus** voor leesbaarheid onderweg.

---

## Te bouwen — optioneel / later
- [x] **Kant-en-klare eigen API-server** — `server/` (Node/Express): contract uit
      `HANDOVER.md` §7, één-stem-per-gebruiker, auto-verwijderen na 5× "weg", **leescache** +
      **rate-limiting**. Aanzetten: `VITE_REPORTS_BACKEND=api` + `VITE_API_URL`.
- [x] **Uitgebreide beveiligings-/serverhandleiding** — `server/README.md`: VPS-setup, HTTPS
      (Caddy), firewall (ufw), secrets, **automatische back-ups via cron**, monitoring, schalen.
- [x] **Inloggen met Google** (OAuth) — server + frontend: géén wachtwoorden, schrijven
      achter een **server-geverifieerd** token, stem-id = Google-account → **stem-manipulatie
      dicht**. Audit + tests: `server/SECURITY.md`. Setup: `server/README.md` "Auth"
      (`VITE_GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_ID`).
- [ ] **i18n** (meertalige UI) en **Capacitor** (Play Store-app) — nog te doen.

---

## Groot maken (schaal + internationaal)
Strategische keuze: **eigen API + VPS** als doel-backend (goedkoper op schaal, geen
tier-muren, eigen ruime bandbreedte). Doel: groot worden — weinig concurrentie in de Play
Store, geen goede scooter-navigatie-apps, en óók buiten NL bruikbaar.

**Schaal**
- [ ] Eigen API-server + Postgres op VPS (zie "Te bouwen"). Begin klein, schaal CPU/RAM op bij groei.
- [ ] **Leescache** (Redis/edge, ~10–30 s) op de meldingen-query → dé schaal-sleutel bij virality.
- [ ] Connection pooling (PgBouncer) + monitoring + automatische back-ups (cron).

**Internationaal — let op: niet alleen "meer kaart laden"**
- [ ] ⚠️ **Scooter-regels verschillen per land.** Blauw/geel (snorfiets/bromfiets) is
      NL-specifiek; andere landen hebben eigen voertuigklassen en regels (waar mag je rijden,
      fietspad-toegang). → routeprofielen **per land** opzetten (land-bewust profiel-systeem).
- [ ] Multi-regio Valhalla: per-land/continent OSM-extracts (of planet — zwaar: veel RAM/disk).
- [ ] **i18n** — meertalige UI.
- [ ] Land-detectie op basis van positie → juiste profielen + taal.

**Aanbevolen volgorde:** eerst **NL volledig + lanceren** via de WhatsApp-groep (bewijs dat
mensen het willen), dán **land voor land** uitbreiden. Internationaliseren vóór
product-market-fit = verspilde moeite.

**Distributie:** Play Store via Capacitor (Fase 5), eenmalig $25.

---

## Open vragen / te onderzoeken
- Hoe goed zijn de OSM-tags voor bromfiets/snorfiets-toegang in Purmerend? (bepaalt profiel-kwaliteit)
- Hosted Valhalla voor de MVP, of meteen self-hosten? (self-host = meer controle, iets meer setup)
- Offline routing (niet alleen offline kaart) is zwaar — bewust uitstellen tot na NL-dekking.
- Crowdsourced wegafsluitingen die de route beïnvloeden: vanaf hoeveel bevestigingen
  blokkeren we hard? (anders stuurt één foute/oude melding iedereen onnodig om)

## ⚠️ Disclaimer (verplicht in de app)
De route is een hulpmiddel en kan fout zitten door verouderde of ontbrekende kaartdata.
De bestuurder blijft verantwoordelijk voor het volgen van verkeersregels en bebording
(o.a. waar snorfiets/bromfiets wel/niet mag rijden).

**Community-meldingen** zijn door gebruikers geplaatst en niet geverifieerd; ze kunnen
onjuist of verouderd zijn. Het melden van controles is in Nederland toegestaan (zoals
Flitsmeister doet), maar de regels verschillen per land — controleer dit vóór uitbreiding
buiten NL.

---

## Kosten — wat is gratis, waar komt geld kijken?

**Altijd gratis (de software):** Vue, Vite, TypeScript, MapLibre, Valhalla, Laravel,
Capacitor, OpenStreetMap-data. Je betaalt nooit voor de tools zelf.

**Gratis zolang jij de enige gebruiker bent:** alles draait lokaal op je eigen pc
(dev-server, Valhalla in Docker, lokale backend, OSM-extract). €0.

**Hier komt pas geld kijken — als anderen het echt gebruiken:**

| Post | Indicatie | Gratis te houden? |
|---|---|---|
| Server/VPS voor Valhalla + backend (24/7) | ~€5–20/mnd (NL-only is bescheiden) | Self-hosten op eigen pc/Pi thuis = €0 |
| Kaart-tegels boven gratis limiet (MapTiler) | gratis tot een limiet | Protomaps self-hosten = €0 (alleen bandbreedte) |
| Google Play publiceren | eenmalig $25 | Android sideloaden / PWA = €0 |
| Apple App Store (iOS) | $99/jaar | Alleen nodig als je iOS in de store wilt |
| Adres-zoeken (geocoding) | Nominatim gratis (met fair-use) | Self-host / fair use = €0 |

**Samengevat:** voor jezelf + de Purmerend-test = **gratis**. Publieke app =
grofweg **~€10/mnd server** + eventueel eenmalig $25 (Android). Software blijft gratis.

### Waar draait wat? (waarom toch een server, en niet alleen Netlify)
- **Frontend (Vue-app)** → **Netlify, gratis.** ✓ Statische bestanden, perfect hiervoor.
- **Community-meldingen (database + API)** → **je eigen REST-API + Postgres** (`server/`),
  op dezelfde VPS als Valhalla. Geen abonnement; jij beheert het (zie `server/README.md`).
- **Routeberekening (Valhalla)** → **eigen server/VPS of pc thuis.** Dít is waarvoor je een
  server nodig hebt: een continu draaiend proces met meerdere GB kaartdata — dat kan Netlify
  niet (Netlify Functions zijn serverless: te klein/kortlevend). En onze **eigen
  scooter-profielen (blauw/geel)** sluiten een kant-en-klare gratis route-API uit.

### Database = je eigen Postgres (via je API)
Geo-zoeken is de kernfeature ("meldingen in de buurt / op mijn route"). Daarom **Postgres**:
nu een bbox-query met index (snel + exact), later eventueel **PostGIS** voor radius/
dichtstbijzijnde. Geen per-lees-kosten; draait op je eigen server naast Valhalla (`server/`).

---

## Tech-stack samenvatting
**Frontend:** Vue 3 · Vite · TypeScript · MapLibre GL
**Mobiel:** Capacitor (+ @capacitor/geolocation, @capacitor-community/keep-awake)
**Routing:** Valhalla (self-hosted, Docker) op OpenStreetMap-data (Geofabrik NL-extract)
**Kaart-tegels:** MapTiler free → Protomaps (self-host/offline)
**Backend (community):** Laravel-API + PostGIS/spatial database (meldingen, geo-queries)
