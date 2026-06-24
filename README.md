# Scooter-Nav

Navigatie-app voor scooters (blauw + geel kenteken) met community-meldingen
(politie, **rollerbank**, hulpdiensten, gevaarlijk wegdek, wegafsluitingen).
Volledig plan: [ROADMAP.md](./ROADMAP.md) · Zelf beheren: [HANDOVER.md](./HANDOVER.md).

## Snel starten
```bash
npm install
npm run dev
```
Open de URL die Vite toont (bijv. http://localhost:5173). Geef **locatietoestemming**.

> Tip: `npm run dev` toont ook een **Network-URL** — open die op je telefoon (zelfde wifi)
> om het op een echt scherm te testen. Locatie werkt op de telefoon het best.

## Wat werkt
- Kaart van Purmerend (MapLibre + keyless OpenFreeMap-tegels) + live "jij bent hier"-stip.
- Routes via Valhalla met **kenteken-profielen** (blauw/geel) en tot 3 alternatieven.
- Wegafsluitingen die de route **mijden**; community-meldingen + bevestigen/verwijderen.
- Alerts onderweg ("rollerbank over 350 m") + "▶ Simuleer rit" om te testen.
- Instellingen (thema), en **Inloggen met Google** voor de eigen-API-backend.

## Configuratie (`.env`)
Kopieer `.env.example` naar `.env`:

| Variabele | Betekenis |
|---|---|
| `VITE_MAP_STYLE_URL` | Leeg = keyless OpenFreeMap. Of je MapTiler-style-URL (incl. `?key=`). |
| `VITE_REPORTS_BACKEND` | `mock` (voorbeelddata) of `api` (je eigen server, zie `server/`). |
| `VITE_API_URL` | URL van je eigen API (alleen bij `api`). |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client-id voor "Inloggen met Google" (zelfde als op de server). |
| `VITE_VALHALLA_URL` | Leeg = dev-proxy naar publieke Valhalla; later je eigen routeserver. |

## Architectuur (waarom backend-wisselen makkelijk is)
De app praat nooit rechtstreeks met een database. Alles loopt via interfaces:
- `src/services/reports/` — `ReportsBackend`-interface + `mock`- en `api`-adapters.
  **Wisselen = `VITE_REPORTS_BACKEND` omzetten**, geen code in de rest van de app aanpassen.
- `src/services/location/` — `LocationProvider`-interface (nu browser-GPS, later Capacitor).
- `server/` — de eigen REST-API (Node/Express) + database-schema + beveiliging (`server/SECURITY.md`).

## Scripts
- `npm run dev` — ontwikkelserver
- `npm run build` — type-check (`vue-tsc`) + productie-build
- `npm run type-check` — alleen types controleren
