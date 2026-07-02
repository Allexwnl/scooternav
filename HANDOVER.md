# HANDOVER — alles zelf draaien (zonder hulp)

Naslag om sweetscoots zelfstandig te beheren: draaien, back-uppen, beveiligen en problemen
oplossen. Plan: [ROADMAP.md](./ROADMAP.md). Server + beveiliging: [`server/README.md`](./server/README.md)
en [`server/SECURITY.md`](./server/SECURITY.md).

---

## 1. Wat staat waar
```
src/                      de app (Vue + TypeScript)
  services/reports/       meldingen-backends ACHTER ÉÉN interface (types.ts):
    mockReports.ts        voorbeelddata (geen server nodig)
    apiReports.ts         je eigen REST-server
    index.ts              kiest de backend op basis van .env  <-- DE SWITCH
  services/auth.ts        Inloggen met Google (frontend)
  services/routing/       Valhalla-routes + omleiden rond afsluitingen
  services/location/      GPS (browser nu, Capacitor later)
server/                   je eigen REST-API (Node/Express) + schema.sql + SECURITY.md
valhalla/                 docker-compose + uitleg voor je eigen routeserver
```

## 2. Lokaal draaien
```bash
npm install
npm run dev      # open de getoonde URL
npm run build    # controleert types + maakt productie-build
```

## 3. Backend kiezen — "de switch"
In `.env` (kopie van `.env.example`):
```
VITE_REPORTS_BACKEND=mock      # of: api
```
- **mock** — voorbeeldmeldingen, geen server. Voor ontwikkelen.
- **api** — je eigen REST-server (zie `server/`). Zet ook `VITE_API_URL` en
  `VITE_GOOGLE_CLIENT_ID`. De app verandert verder niet bij wisselen.

## 4. Back-ups maken + herstellen
Je data leeft in **je eigen Postgres** (op je server). Back-uppen doe je daar met `pg_dump`
via een **cron-job** — de exacte stappen + een geteste herstelprocedure staan in
[`server/README.md`](./server/README.md) §4. Bewaar af en toe een kopie buiten de server.

## 5. Iets kapot? Snel terug
Omdat alles achter de `ReportsBackend`-interface zit en je data in je eigen database staat:
1. Zet desnoods tijdelijk `VITE_REPORTS_BACKEND=mock` zodat de app blijft werken.
2. Herstel de database uit je laatste `pg_dump`-back-up (zie `server/README.md`).
3. Zet `api` weer aan.

## 6. Beveiliging — de regels die er echt toe doen
> **Mythe:** "een verborgen admin-paneel is veilig." Dat heet *security through obscurity*
> en is GEEN beveiliging. Echte beveiliging = niet-publiek + sterke auth.

- **Login = Inloggen met Google** (geen wachtwoorden opgeslagen). Schrijven (plaatsen/stemmen)
  vereist een door de server **geverifieerd** Google-token; de stem-id is de Google-account-id.
  Setup + audit: `server/README.md` "Auth" en `server/SECURITY.md`.
- **Geen admin-paneel op internet.** Beheer via **SSH + `psql`** op je server. Geen aanvalsoppervlak.
- **Geheimen geheim:** `.env` nooit in Git; in de frontend alleen publieke waarden (de Google
  client-id is publiek bedoeld). DB-wachtwoord en certificaten alleen op de server.
- **HTTPS overal** (Caddy, zie `server/README.md`), **firewall** (Postgres niet naar buiten),
  **rate-limiting** (zit in de API), en `npm audit` + OS-updates bijhouden.

## 7. Je eigen API
Staat kant-en-klaar in **`server/`** (Node/Express): endpoints-contract, leescache,
rate-limiting, input-validatie, Google-login en auto-verwijderen na 5× "weg". Setup,
beveiliging en schalen: `server/README.md`. Beveiligings-audit: `server/SECURITY.md`.

## 8. Troubleshooting / FAQ
- **Lege kaart / geen tegels** → check internet; eventueel `VITE_MAP_STYLE_URL` (MapTiler-sleutel).
- **Geen route / "Routefout"** → publieke Valhalla traag/plat; later eigen Valhalla (`valhalla/`).
- **Route door een afsluiting** → publieke server vermijdt niet hard; de app stuurt er
  client-side omheen. Volledig hard: eigen Valhalla (`exclude_polygons`).
- **Meldingen verdwijnen na herladen** → je draait `mock`. Zet `api` aan (met je server live).
- **"Log in met Google" / 401 bij plaatsen** → schrijven vereist login; controleer dat
  `VITE_GOOGLE_CLIENT_ID` (frontend) en `GOOGLE_CLIENT_ID` (server) **gelijk** zijn.
- **Geen locatie op desktop** → browser blokkeert vaak GPS; gebruik "▶ Simuleer rit" of test op telefoon.

## 9. Onderhoudsritme
Wekelijks: `pg_dump`-back-up controleren • Maandelijks: `npm audit` + updates (app én `server/`) •
2FA op je server-/domein-accounts • Plan: Play Integrity als de app groeit (extra anti-misbruik).
