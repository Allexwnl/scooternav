# Hosting — sweetscoots

Waar draait wat, en hoe zet je het live. Gefaseerd: begin bijna gratis, schaal pas op als het
loopt (zie [VERDIENMODEL.md](./VERDIENMODEL.md)).

| Onderdeel | Zwaarte | Waar | Kosten |
|---|---|---|---|
| **Frontend** (Vue-build, statisch) | niets | Netlify / Cloudflare Pages | gratis |
| **API + Postgres** (`server/`) | licht | kleine VPS of managed DB | ~€4/mnd |
| **Valhalla** (routing) | zwaar | publiek (FOSSGIS) → later eigen VPS | gratis → ~€7/mnd |

> **Begin zonder eigen Valhalla.** De app gebruikt standaard de gratis publieke FOSSGIS-instance.
> Pas zelf hosten als die je gaat rate-limiten.

---

## Nu: Render + Neon (gratis, één blueprint)

De snelste gratis start — alles op één plek, geen VPS. **Render** host de API én de statische
frontend; **Neon** is de (serverless) Postgres. De repo bevat al een `render.yaml`.

> ⚠️ Op het gratis Render-plan valt de API na ~15 min inactiviteit in slaap → de eerste request
> daarna duurt ~50s (koude start). Prima om te beginnen; upgrade of ga naar Hetzner als het loopt.

**1. Neon-database aanmaken**
1. https://neon.tech → nieuw project (regio **EU**, bv. Frankfurt).
2. Kopieer de **"Pooled connection"**-string (host eindigt op `-pooler...`). Zorg dat er
   `?sslmode=require` achter staat — dat verwacht Neon en `pg` schakelt er SSL mee in.
3. Laad het schema één keer (lokaal, met de Neon-URL):
   ```bash
   psql "postgres://...neon.tech/neondb?sslmode=require" -f server/schema.sql
   ```
   (Of plak de inhoud van `server/schema.sql` in Neon's SQL-editor.)

**2. Render-blueprint deployen**
1. https://render.com → **New → Blueprint** → kies deze GitHub-repo. Render leest `render.yaml`
   en maakt twee services: `sweetscoots-api` (Node) en `sweetscoots` (static).
2. Vul de gevraagde `sync:false`-variabelen in:
   - **sweetscoots-api** → `DATABASE_URL` (de Neon pooled-string), `GOOGLE_CLIENT_ID`,
     en `CORS_ORIGIN` = de frontend-URL (bv. `https://sweetscoots.onrender.com`).
   - **sweetscoots** → `VITE_API_URL` = de API-URL (bv. `https://sweetscoots-api.onrender.com`)
     en `VITE_GOOGLE_CLIENT_ID` (zelfde waarde als `GOOGLE_CLIENT_ID`).
3. De URL's ken je pas ná de eerste deploy → deploy eerst, vul dan `CORS_ORIGIN` en
   `VITE_API_URL` in, en trigger een re-deploy (de frontend bakt `VITE_*` in bij de build).

**3. Google OAuth**
Voeg de frontend-URL toe bij Google Cloud → OAuth-client → *Authorized JavaScript origins*
(zie [server/README.md](./server/README.md) "Auth"). Zonder dit is inloggen/stemmen uit (503).

**Valhalla** blijft de publieke FOSSGIS-instance (staat al in `render.yaml`). Eigen Valhalla is
te zwaar voor Render-free → dat gaat t.z.t. naar een VPS (zie hieronder).

---

## Welke Hetzner

Maak een account → **console**: https://console.hetzner.cloud
Plannen + prijzen (kunnen wijzigen, check de pagina): https://www.hetzner.com/cloud

De **ARM-lijn (CAX)** is de beste prijs/RAM-verhouding en prima voor Node + Postgres + Valhalla:

| Plan | vCPU / RAM / disk | ~Prijs | Waarvoor |
|---|---|---|---|
| **CAX11** | 2 ARM / 4 GB / 40 GB | ~€3,79/mnd | Fase 1: API + Postgres |
| **CAX21** | 4 ARM / 8 GB / 80 GB | ~€6,49/mnd | Fase 2: + zelf-gehoste Valhalla |
| CX22 (x86) | 2 Intel / 4 GB / 40 GB | ~€4,59/mnd | x86-alternatief voor CAX11 |
| CX32 (x86) | 4 Intel / 8 GB / 80 GB | ~€7,49/mnd | x86-alternatief voor CAX21 |

Kies een **EU-datacenter** (Falkenstein / Neurenberg / Helsinki): lage latency voor NL én je data
blijft in de EU (GDPR — belangrijk voor een rollerbank-app). De 8 GB bij CAX21/CX32 is voor het
**bouwen** van de NL-routekaart; daarna draait Valhalla op minder (zie tip onderaan).

---

## 1. Frontend → Netlify (gratis)

1. Push de repo naar GitHub → op netlify.com: **Add new site → Import from GitHub**.
2. Build command `npm run build`, publish directory `dist`.
3. **Environment variables** (Site settings → Environment) — zet de productie-`VITE_*`:
   - `VITE_REPORTS_BACKEND=api`
   - `VITE_API_URL=https://api.jouwdomein.nl`
   - `VITE_VALHALLA_URL=https://valhalla1.openstreetmap.de` ⚠️ **verplicht in productie** — de
     `/valhalla`-dev-proxy bestaat alléén in `vite dev`. Zet je eigen URL zodra je Valhalla host.
   - `VITE_GOOGLE_CLIENT_ID=...` (zelfde waarde als op de server)
4. Voeg je productie-URL toe bij Google OAuth → *Authorized JavaScript origins* (zie
   [server/README.md](./server/README.md) "Auth").

## 2. API + Postgres → Hetzner CAX11

```bash
# op de VPS (Ubuntu):
apt update && apt install -y postgresql nodejs npm
sudo -u postgres psql -c "create user scooternav with password 'KIESEENWACHTWOORD';"
sudo -u postgres psql -c "create database scooternav owner scooternav;"
sudo -u postgres psql -d scooternav -f /pad/naar/server/schema.sql

cd server
cp .env.example .env      # vul DATABASE_URL, CORS_ORIGIN (je Netlify-URL), GOOGLE_CLIENT_ID
npm ci
node index.mjs            # of via systemd/pm2 zodat het herstart
```
Zet er een reverse proxy (Caddy/Nginx) vóór voor HTTPS op `api.jouwdomein.nl`. Caddy = 2 regels en
regelt het TLS-certificaat zelf.

## 3. Valhalla → pas wanneer nodig (Hetzner CAX21)

```bash
cd valhalla
docker compose up -d        # bouwt de eerste keer de NL-tiles (duurt lang, ~paar GB RAM)
docker compose logs -f      # volg de build; serveert daarna op :8002
```
Zet daarna `VITE_VALHALLA_URL=https://routing.jouwdomein.nl` op Netlify en herdeploy.

**Tip om geld te besparen:** bouw de tiles één keer (lokaal of op een tijdelijke grote instance),
kopieer de `valhalla/custom_files`-map naar je kleine VPS en draai met `force_rebuild=False`. Dan
betaal je niet permanent voor de 8 GB die alleen de *build* nodig had.

---

## Domein
~€10/jaar bij TransIP / Namecheap / Cloudflare. Wijs subdomeinen naar je VPS:
`api.jouwdomein.nl` → API, `routing.jouwdomein.nl` → Valhalla. Frontend hangt aan Netlify
(of zet je apex-domein daar via een CNAME/Netlify-DNS).

## Goedkoopste start (aanrader)
Netlify (gratis) + **Hetzner CAX11** (API+DB) + publieke FOSSGIS Valhalla = **~€4/mnd**.
Upgrade naar CAX21 zodra je Valhalla zelf draait.
