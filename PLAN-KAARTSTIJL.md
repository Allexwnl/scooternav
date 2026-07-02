# Plan: eigen kaartstijl — CARTO eruit, OpenFreeMap + eigen stijl-JSON erin

**Doel:** de Positron (licht) / Dark Matter (donker) look behouden, maar 100% legaal voor
commercieel gebruik (Play Store + donaties/verdienmodel), €0/mnd, en licht ge-brand als
sweetscoots. CARTO's servers verdwijnen volledig uit de app.

**Waarom dit mag:** de Positron/Dark Matter-*ontwerpen* zijn open source (BSD 3-clause +
CC-BY design, repo's van OpenMapTiles). Alleen CARTO's *tile-hosting* is niet-commercieel.
We hosten de stijl-JSON zelf en laten hem tegels laden van OpenFreeMap (expliciet gratis,
óók commercieel, keyless, geen limieten).

---

## Context (lees eerst)

- App: Vue 3 + Vite + MapLibre GL, in deze repo (`scooter-nav`).
- `src/config.ts` → `MAP_STYLE_LIGHT` / `MAP_STYLE_DARK` wijzen nu naar
  `basemaps.cartocdn.com` (positron / dark-matter). Er is een `VITE_MAP_STYLE_URL`
  env-override; die moet blijven werken.
- `src/components/MapView.vue` → `styleForTheme()` kiest licht/donker o.b.v.
  `settings.theme`; een `watch` op het thema doet `m.setStyle(...)` en her-tekent de
  eigen overlays (routes/meldingen) via `addOverlays`. **Aan MapView hoeft niets te
  veranderen** — de app tekent zijn eigen lagen bovenop en is agnostisch over de basestijl.
- `src/services/i18n.ts` → key `map_credit` (nl én en) noemt nu "CARTO".
- Er is **nog geen `public/`-map** — aanmaken; Vite serveert die op `/`.

## Stap 1 — Basis-stijlen ophalen

1. **Licht:** haal OpenFreeMap's eigen gehoste Positron op — die heeft al de juiste
   tile/glyph/sprite-URL's: `https://tiles.openfreemap.org/styles/positron`
   (dit is een JSON-document; sla de body op).
2. **Donker:** haal het open-source Dark Matter-ontwerp op:
   `https://raw.githubusercontent.com/openmaptiles/dark-matter-gl-style/master/style.json`

## Stap 2 — Dark Matter omzetten naar OpenFreeMap-bronnen

Gebruik de in stap 1 opgehaalde OpenFreeMap-Positron als **referentie voor de correcte
URL's** en zet in de dark-matter-JSON:

- `sources.openmaptiles.url` → zelfde TileJSON-URL als in de OpenFreeMap-Positron
  (verwacht: `https://tiles.openfreemap.org/planet`).
- `glyphs` → zelfde glyphs-URL als in de OpenFreeMap-Positron.
- `sprite` → **laat de sprite-URL van de openmaptiles-repo NIET staan.** Kijk of de
  dark-matter-stijl überhaupt sprites gebruikt (zoek naar `*-pattern`/`icon-image` in de
  layers); zo nauwelijks → wijs naar dezelfde sprite als de OpenFreeMap-Positron.
- **Fontstacks:** inventariseer alle `text-font`-waarden in de dark-matter-JSON en
  vergelijk met de fontstacks die de OpenFreeMap-Positron gebruikt. Vervang niet-bestaande
  fonts door het dichtstbijzijnde Noto Sans-equivalent (bijv. `"Metropolis Regular"` →
  `"Noto Sans Regular"`, `"...Bold"` → `"Noto Sans Bold"`, `"...Italic"` →
  `"Noto Sans Italic"`). Elke fontstack die 404't = onzichtbare labels, dus dit is de
  belangrijkste stap. Verifieer in de browser-network-tab dat álle font-requests 200 geven.
- Behoud/zet het `attribution`-veld op de source: OSM + OpenMapTiles + OpenFreeMap.

## Stap 3 — sweetscoots-branding (licht houden!)

Kleine, smaakvolle tweaks in **beide** JSON's — niet de hele stijl verbouwen:

- **Fietspaden/paths**: geef `highway=cycleway`-achtige lagen (zoek layer-ids met
  `path`/`cycleway`) een subtiel sweetscoots-groen tintje — past bij een scooter-app
  waar fietspaden betekenis hebben. Licht thema: bijv. `#2e7d32` op lage opacity;
  donker thema: `#66bb6a`-achtig, gedimd.
- **Parken/groen** in het lichte thema een fractie warmer groen.
- Verder afblijven; fijnproeven doet de gebruiker later zelf in Maputnik
  (https://maplibre.org/maputnik/ — JSON laden, klikken, exporteren).

## Stap 4 — In de app hangen

1. Maak `public/map-styles/` en zet de bestanden erin:
   - `public/map-styles/sweetscoots-light.json`
   - `public/map-styles/sweetscoots-dark.json`
2. `src/config.ts`:
   ```ts
   export const MAP_STYLE_LIGHT = ENV_STYLE || '/map-styles/sweetscoots-light.json'
   export const MAP_STYLE_DARK = ENV_STYLE || '/map-styles/sweetscoots-dark.json'
   ```
   (comment bijwerken: geen CARTO meer; ontwerp = OpenMapTiles Positron/Dark Matter,
   tegels = OpenFreeMap.)
3. `src/services/i18n.ts` → `map_credit` in **nl én en**:
   `'Kaart © OpenStreetMap-bijdragers · OpenMapTiles · OpenFreeMap'` /
   `'Map © OpenStreetMap contributors · OpenMapTiles · OpenFreeMap'`.

## Stap 5 — Verifiëren (verplicht, niet overslaan)

1. `npm run dev` → kaart van Purmerend laadt in het lichte thema.
2. Network-tab: **geen enkele request meer naar `cartocdn.com`**; geen 404's op
   fonts/sprites/tiles (alles `tiles.openfreemap.org`).
3. Instellingen → thema naar donker: kaart wisselt naar dark, eigen overlays
   (routes/meldingen) worden her-tekend (bestaande `watch` in MapView regelt dit).
4. Plan een route en zet een melding: eigen lagen renderen bovenop de nieuwe stijl.
5. Labels zichtbaar in beide thema's (fontcheck!), attributie zichtbaar rechtsonder.
6. `npm run build` groen.

## Valkuilen

- **Fonts zijn de #1 breker** (stap 2). Een fontstack die OpenFreeMap niet host geeft
  geen error in de console, alleen missende labels. Check visueel + network-tab.
- De stijl-JSON's zijn groot (±100-200 kB); dat is prima, ze worden statisch geserveerd
  en gecachet. Niet inline in de bundle zetten.
- `VITE_MAP_STYLE_URL`-override moet blijven werken (die gaat vóór beide defaults).
- Licentie: laat de design-credits in de `metadata` van de JSON's staan (CC-BY op het
  ontwerp) en houd de attributie op de kaart zichtbaar (ODbL-eis van OSM).
- Raak `MapView.vue` niet aan tenzij iets aantoonbaar breekt — de stijl-wissel-logica
  bestaat al en werkt.
