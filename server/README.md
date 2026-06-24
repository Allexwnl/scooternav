# Scooter-Nav API — server + beveiliging + beheer

Kleine Express-server die de meldingen-backend levert (de `api`-optie van de app).
Implementeert het contract uit [`../HANDOVER.md`](../HANDOVER.md) §7.

```
GET  /reports?minLng&minLat&maxLng&maxLat   -> Report[]
POST /reports        { type, lng, lat, path? }   -> Report
POST /reports/:id/vote   { stillThere, voterId } -> 204
GET  /health
```

Ingebouwd: **leescache** (15 s, schaal-sleutel), **rate-limiting** (120/min lezen, 20/min
schrijven), **input-validatie**, **één stem per gebruiker** (DB primary key) en
**auto-verwijderen na 5× "weg"** (DB-trigger).

> 🔒 **Beveiligings-audit + bevindingen (lezen!):** [`SECURITY.md`](./SECURITY.md) — wat is
> dichtgezet, getest met aanvalsverzoeken, én de eerlijke residurisico's (o.a. stem-manipulatie
> zonder accounts).

---

## Auth — Inloggen met Google (eenmalig instellen)
Lezen is openbaar; **plaatsen/stemmen vereist een Google-login** die de server verifieert.
1. **Google Cloud Console** → APIs & Services → Credentials → *Create OAuth client ID*.
2. Type: **Web application**. Bij *Authorized JavaScript origins* zet je je app-URL's:
   `http://localhost:5173` (dev) én je productie-URL (bv. `https://jouwapp.netlify.app`).
3. Kopieer de **Client ID** en zet die op **twee** plekken (zelfde waarde):
   - server `.env`: `GOOGLE_CLIENT_ID=...`
   - frontend `.env` (projectroot): `VITE_GOOGLE_CLIENT_ID=...`
4. Klaar. De server verifieert elk token; de Google-account-id wordt de stem-id (geen
   manipulatie mogelijk). Geen `GOOGLE_CLIENT_ID` ingesteld? Dan staan schrijf-acties uit (503),
   lezen werkt wel.

> We slaan **geen wachtwoorden** op. Alleen de Google-account-id + e-mail (tabel `users`),
> voor contact/verwijderrecht (GDPR).

## 1. Lokaal draaien (om te testen)
```bash
cd server
npm install
cp .env.example .env        # vul DATABASE_URL in
psql "$DATABASE_URL" -f schema.sql
npm start                   # API op http://localhost:8080
curl http://localhost:8080/health
```
De app erop laten draaien: in de projectroot `.env`:
```
VITE_REPORTS_BACKEND=api
VITE_API_URL=http://localhost:8080
```

---

## 2. Op een VPS zetten (productie)
Voorbeeld op Ubuntu. Doe dit als een gewone (niet-root) gebruiker waar mogelijk.

**a. Postgres installeren + database maken**
```bash
sudo apt update && sudo apt install -y postgresql
sudo -u postgres psql -c "create user scooternav with password 'STERK_WACHTWOORD';"
sudo -u postgres psql -c "create database scooternav owner scooternav;"
psql "postgres://scooternav:STERK_WACHTWOORD@localhost:5432/scooternav" -f schema.sql
```

**b. Node + de API**
```bash
# Node 20+ installeren (bv. via nvm), dan:
cd server && npm install
```
Draai 'm als service met **pm2** (herstart automatisch):
```bash
npm i -g pm2
DATABASE_URL=postgres://scooternav:...@localhost:5432/scooternav \
  CORS_ORIGIN=https://jouwapp.netlify.app pm2 start index.mjs --name scooter-api
pm2 save && pm2 startup    # start na reboot
```

**c. HTTPS ervoor met Caddy** (gratis, automatisch SSL-certificaat)
`/etc/caddy/Caddyfile`:
```
api.jouwdomein.nl {
    reverse_proxy localhost:8080
}
```
```bash
sudo apt install -y caddy && sudo systemctl reload caddy
```
Zet daarna in je app: `VITE_API_URL=https://api.jouwdomein.nl`.

---

## 3. Beveiliging — checklist
- [ ] **Firewall (ufw):** alleen 22 (SSH), 80, 443 open. Postgres (5432) **niet** naar buiten.
  ```bash
  sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
  ```
- [ ] **HTTPS overal** (Caddy hierboven). Nooit de API kaal op http exposen.
- [ ] **CORS** beperkt tot je eigen frontend (`CORS_ORIGIN`).
- [ ] **Sterk DB-wachtwoord**, en Postgres luistert alleen op `localhost`.
- [ ] **Geen geheimen in Git.** `.env` staat in `.gitignore`.
- [ ] **SSH met sleutels**, wachtwoord-login uit, root-login uit.
- [ ] **Automatische OS-updates:** `sudo apt install unattended-upgrades`.
- [ ] **Rate-limiting** staat aan (in de API). Verhoog/verlaag in `index.mjs` indien nodig.
- [ ] Géén admin-paneel op internet — beheer via SSH + `psql` of de back-up-tool.

> Onthoud: **verbergen ≠ beveiligen.** Echte beveiliging = bovenstaande lagen, niet "moeilijk te vinden".

---

## 4. Automatische back-ups (cron)
Dagelijkse dump + 14 dagen bewaren:
```bash
mkdir -p ~/backups
crontab -e
```
Voeg toe (03:00 elke nacht):
```
0 3 * * * pg_dump "postgres://scooternav:WACHTWOORD@localhost:5432/scooternav" | gzip > ~/backups/scooternav-$(date +\%F).sql.gz && find ~/backups -name '*.sql.gz' -mtime +14 -delete
```
**Test je herstel** (heel belangrijk — een back-up die je nooit terugzet, is geen back-up):
```bash
gunzip -c ~/backups/scooternav-2026-06-24.sql.gz | psql "postgres://.../een_test_db"
```
Bewaar ook af en toe een kopie **buiten de server** (andere schijf/cloud).

---

## 5. Monitoring
- `pm2 logs scooter-api` — live logs. `pm2 monit` — CPU/RAM.
- `GET /health` — laat een gratis uptime-checker (bv. UptimeRobot) hier elke minuut op pingen → mail bij downtime.
- Houd schijfruimte in de gaten (`df -h`) i.v.m. back-ups en logs.

---

## 6. Schalen als het hard gaat
- **Leescache** zit er al in (15 s). Eén VPS bedient hiermee al duizenden gelijktijdige gebruikers.
- **Meerdere instances?** Dan moet de cache gedeeld zijn → vervang de in-memory `Map` door **Redis**.
- **Veel verkeer:** **PgBouncer** (connection pooling) voor Postgres + een groter VPS-plan.
- **Wereldwijd:** zet een CDN/edge-cache vóór `GET /reports` (meldingen veranderen traag, dus cachen mag).
