# Beveiligings-audit — Scooter-Nav API

Doel: de API + database controleren tegen de bekende aanvalsklassen, en eerlijk benoemen
wat wél en (nog) niet dichtgezet is. **Geen enkel systeem is "veilig tegen alles"** — dit
rapport zegt precies waar de grenzen liggen.

## Wat is gecontroleerd en hoe het is afgedekt

| Aanvalsklasse | Status | Hoe |
|---|---|---|
| **SQL-injectie** | ✅ Afgedekt | Alle queries volledig **geparametriseerd** (`$1,$2,…`), nooit string-concatenatie. Input wordt daarnaast gevalideerd. |
| **Mass assignment** | ✅ Afgedekt | Alleen expliciete velden (`type,lng,lat,path` / `stillThere,voterId`) worden gelezen — nooit `req.body` in een query gespreid. |
| **Ongeldige/booze input** | ✅ Afgedekt | `type` via whitelist; coördinaten via `Number.isFinite` + bereik; `path` gevalideerd (array van [lng,lat], max 1000 punten); `voterId` max 100 tekens; `:id` moet een geldige UUID zijn. |
| **DoS via grote payload** | ✅ Afgedekt | JSON-body begrensd op **64 kB**. |
| **DoS via "dump alles"** | ✅ Afgedekt | bbox-span begrensd (max 5°), `min>max` geweigerd, en query met `LIMIT 1000`. |
| **DoS via spam** | 🟡 Beperkt | **Rate-limit**: 120/min lezen, **20/min schrijven** per IP. Vertraagt misbruik, stopt het niet volledig (zie residurisico). |
| **Lek van interne info** | ✅ Afgedekt | Fouten geven generieke `{error}` terug, **geen stacktraces**. Zet `NODE_ENV=production`. |
| **Secrets in code/Git** | ✅ Afgedekt | `DATABASE_URL` via env; `.env` staat in `.gitignore`. Frontend gebruikt nooit DB-credentials. |
| **Rate-limit omzeilen via proxy** | ✅ Afgedekt | `trust proxy = 1` → echte client-IP achter Caddy (anders telt iedereen als één IP). |
| **Prototype pollution / ReDoS** | ✅ Afgedekt | Geen object-merges van input; geen regex op vrije gebruikersinput (alleen vaste UUID-check). |
| **Transport (afluisteren)** | ✅ Afgedekt* | HTTPS via Caddy (zie README). *Mits je de API alleen achter HTTPS draait. |
| **CORS** | ✅ Ingesteld | Beperkt tot je frontend (`CORS_ORIGIN`). NB: CORS beschermt browsers, niet bots — de data is sowieso publiek. |
| **Autorisatie / login** | ✅ | Lezen publiek; **schrijven vereist een geverifieerd Google ID-token** (server-side gecheckt met `google-auth-library`). **Geen wachtwoorden opgeslagen** — Google regelt dat. |

## Doorgevoerde fixes (deze audit)
1. `trust proxy = 1` — rate-limiting werkt nu écht achter de reverse proxy.
2. Strenge **schrijf-rate-limit** (20/min) los van lezen.
3. **bbox-validatie**: omgedraaid/oneindig/te-groot → `400`; `LIMIT 1000` op de query.
4. **path-validatie** + maximumlengte (anti-misbruik/garbage).
5. **voterId**-lengte begrensd; **`:id`** moet geldige UUID zijn.
6. Coördinaten via `Number.isFinite` (NaN/Infinity worden nu geweigerd).

## ⚠️ Residurisico's (eerlijk — niet volledig oplosbaar zonder accounts)

**1. Stem-manipulatie — nu GESLOTEN via "Inloggen met Google". ✅**
Schrijven (plaatsen/stemmen) vereist een **geldig Google ID-token** dat de server zélf
verifieert. De stem-id is de Google-account-id (`sub`) — **server-bepaald**, niet door de
client opgegeven. Eén Google-account = één stem; verzonnen id's werken niet meer. Iemand zou
5 échte Google-accounts nodig hebben om een melding te laten verwijderen.
- *Klein restje:* iemand met meerdere Google-accounts kan nog stapelen. Verfijning later:
  Play Integrity, of eisen aan account-leeftijd. Voor normaal gebruik ruim voldoende.

**2. Spam-meldingen.** Plaatsen vereist nu óók een Google-login → bots hebben echte
Google-accounts nodig, wat het sterk afremt; de schrijf-rate-limit blijft erbovenop. Bij veel
groei eventueel: moderatie-queue of Play Integrity.

**3. Privacy/GDPR.** Nu wordt **geen** persoonsdata opgeslagen (anonieme voterId + publieke
locaties). Ga je IP's loggen voor misbruikbestrijding, dan is dat persoonsdata → vermeld het in
een privacyverklaring en stel een bewaartermijn in.

## Productie-checklist (zie ook README §3)
- [ ] HTTPS aan (Caddy), API niet kaal op http.
- [ ] `CORS_ORIGIN` = alleen je frontend. `NODE_ENV=production`.
- [ ] Firewall: Postgres (5432) niet naar buiten; alleen 22/80/443.
- [ ] Sterk DB-wachtwoord; Postgres op `localhost`.
- [ ] Automatische back-ups via cron + **herstel getest**.
- [ ] `npm audit` periodiek; OS auto-updates aan.
- [ ] Plan: accounts/Play Integrity vóór je echt groot wordt.
