# Verdienmodel — sweetscoots

Concreet, gefaseerd plan. Kern: **eerst gratis groeien via de WhatsApp-groep, daarna
freemium, advertenties pas bij schaal.** Onderscheid = de scooter-niche (kenteken-routes +
rollerbank), niet "live verkeer" (dat heeft Waze, jij niet — zie [WAZE_VERGELIJKING.md](./WAZE_VERGELIJKING.md)).

> **Geld verdienen zónder gebruikers te verliezen** is de hele opzet: melden en navigeren
> blijven altijd gratis én zonder account (login is pas nodig om meldingen goed/af te keuren).
> Je verdient aan *extra* waarde (Plus, donaties, later ads bij stilstand) — nooit door de
> gratis basis uit te kleden of een betaalmuur voor de kernfunctie te zetten.

## Wat moet je dekken (kosten)
| Post | Kosten |
|---|---|
| VPS (Valhalla + API + Postgres) | ~€5–15/mnd |
| Frontend (Netlify) | gratis |
| Domeinnaam | ~€10/jaar |
| Google Play (eenmalig) | $25 |
| **Doel fase 1: ~€10–20/mnd dekken** | |

## Fase 1 — Lanceren (0 → ~1.000 gebruikers): **GRATIS**
- **Geen ads, geen betaalmuur.** Focus volledig op community + retentie via je WhatsApp-groep.
- **Donaties** als enige inkomsten: een "Steun de app"-knop (Tikkie / Buy Me a Coffee / Stripe).
  Realistisch dekt dit vaak net de server.
- Doel: **bewijzen dat mensen het gebruiken** (product-market-fit), niet winst.
- Verwachte opbrengst: **€0–50/mnd** (donaties).

## Fase 2 — Groeien (~1k → 10k): **FREEMIUM** ⭐
Gratis blijft volwaardig; **"sweetscoots Plus"** voor wie meer wil:
- Suggestie-prijs: **€1,99/mnd**, **€14,99/jaar**, of eenmalig **€9,99**.
- Plus-functies (premium-waarde, niet de basis uitkleden):
  - offline kaarten, geen advertenties, extra stemmen/thema's,
  - meer alert-instellingen (afstand, types), opgeslagen plekken-pro, ritgeschiedenis,
  - een badge / hogere status in de community.
- Rekenvoorbeeld: 5.000 actief × **3% betaalt** × €15/jaar ≈ **€2.250/jaar** (~€185/mnd) → ruim boven de kosten.
- Donaties lopen door.

## Fase 3 — Schaal (10k+): **ADVERTENTIES + B2B**
- **Lokale advertenties / sponsored pins** (scooterdealers, onderdelen, verzekeraars,
  tankstations) — het Waze-model. **Alleen tonen als je stilstaat** (veilig + Play-beleid).
  Wordt pas zinvol bij **tienduizenden** gebruikers (eCPM ~€1–5).
- **B2B-data**: geanonimiseerde, geaggregeerde knelpunt-data (gevaarlijke kruispunten/wegdek)
  aan gemeenten/onderzoek. Waardevol, maar juridisch + privacy-werk; pas bij schaal.

## Mix per fase
| Fase | Gebruikers | Verdienmodel | Doel |
|---|---|---|---|
| 1 | 0–1k | donaties | break-even op server |
| 2 | 1k–10k | freemium (+donaties) | winstgevend in het klein |
| 3 | 10k+ | ads + B2B (+freemium) | echte omzet |

## Concrete eerste stappen
1. ✅ **Donatie-knop** zit in het menu ("☕ Steun sweetscoots") — zet de `href` in `App.vue`
   naar je eigen Tikkie / Buy Me a Coffee-link. Nul werk, dekt de server.
2. Bouw de **premium-haakjes** alvast in (een `isPlus`-vlag achter de Google-login), zodat
   Plus later een kwestie is van features ontgrendelen.
3. Houd **kosten laag**: blijf op de gratis tiers tot het echt loopt.

## Eerlijke risico's
- **Advertenties leveren bij kleine schaal vrijwel niets** — niet op rekenen vóór ~10k.
- **Freemium werkt alleen met echte premium-waarde** — niet de gratis versie uitkleden.
- **Live verkeer** (Waze's troef) heb je niet → win op de **niche**, niet op verkeer.
- **Vertrouwen**: nooit persoonlijke locatiedata verkopen — bij een rollerbank-app dodelijk voor je community.
