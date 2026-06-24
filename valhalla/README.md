# Self-hosted Valhalla (Fase 2)

Je eigen routeserver, zodat je niet afhankelijk bent van de publieke FOSSGIS-instance
en de scooter-profielen later helemaal kunt fijn afstellen.

## Wat heb je nodig
- **Docker** (Docker Desktop op Windows is prima).
- Wat geduld bij de eerste build (kaart downloaden + tiles bouwen).

## Starten
```bash
cd valhalla
docker compose up -d
docker compose logs -f      # volg de build; klaar als hij "serving" meldt
```
De eerste run downloadt `netherlands-latest.osm.pbf` (~1,5 GB) en bouwt de tiles.
Daarna draait de server op **http://localhost:8002**.

Test:
```bash
curl -s http://localhost:8002/status
```

## De app erop laten draaien
In dev gaat routing via de Vite-proxy (voorkomt CORS). Wijs die proxy naar je lokale
Valhalla door de dev-server zo te starten (vanuit de projectroot):
```bash
VALHALLA_PROXY_TARGET=http://localhost:8002 npm run dev
```
`VITE_VALHALLA_URL` mag dan leeg blijven (`/valhalla` → proxy → jouw server).

> Op Windows PowerShell: `$env:VALHALLA_PROXY_TARGET="http://localhost:8002"; npm run dev`

## Sneller itereren met alleen Purmerend
Heel NL bouwen duurt lang. Voor ontwikkelen kun je een klein extract gebruiken:
- Download een bbox rond Purmerend via **BBBike extract** (https://extract.bbbike.org/), of
- knip zelf met **osmium**:
  ```bash
  osmium extract -b 4.90,52.47,5.02,52.54 netherlands-latest.osm.pbf -o purmerend.osm.pbf
  ```
Leg het `.pbf`-bestand in `./custom_files/` en zet `force_rebuild=True` in
`docker-compose.yml` voor één run (daarna weer op `False`).

## Profielen (blauw vs geel)
De kenteken-logica zit nu in de app (`src/services/routing/valhalla.ts`):
- **geel** → `motor_scooter`, top 45 km/u
- **blauw** → `bicycle` (mag fietspad), ~25 km/u

Met je eigen Valhalla kun je dit later verder verfijnen (eigen costing-config,
toegangsregels per wegtype) zodra je merkt waar de routes nog afwijken van de praktijk.
