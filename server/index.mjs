// Scooter-Nav API — kleine, beveiligde Express-server.
// Implementeert het contract uit HANDOVER.md §7 (zelfde als src/services/reports/apiReports.ts).
// Beveiligings-audit + bevindingen: zie server/SECURITY.md.
//
// Auth: "Inloggen met Google". Lezen mag anoniem; SCHRIJVEN vereist een geldig Google
// ID-token. De server VERIFIEERT dat token en gebruikt de Google-account-id (sub) als
// stem-id — zo is één account = één stem (geen manipulatie met verzonnen id's).

import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import pg from 'pg'
import { OAuth2Client } from 'google-auth-library'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const PORT = process.env.PORT || 8080
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const oauth = new OAuth2Client(GOOGLE_CLIENT_ID)

const TYPES = ['politie', 'rollerbank', 'hulpdienst', 'gevaarlijk_wegdek', 'wegafsluiting']
const MAX_BBOX_SPAN = 5
const MAX_PATH_POINTS = 1000
const RESULT_LIMIT = 1000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const app = express()
app.set('trust proxy', 1)
app.use(express.json({ limit: '64kb' }))
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true }))

const readLimiter = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false })
const writeLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false })
app.use(readLimiter)

// --- Auth-middleware: verifieert het Google ID-token server-side ---
async function requireAuth(req, res, next) {
  if (!GOOGLE_CLIENT_ID) return res.status(503).json({ error: 'login niet geconfigureerd' })
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'login vereist' })
  try {
    const ticket = await oauth.verifyIdToken({ idToken: token, audience: GOOGLE_CLIENT_ID })
    const p = ticket.getPayload()
    req.user = { sub: p.sub, email: p.email }
    // E-mail bewaren (voor verwijderrecht/contact). Faalt stil als users-tabel ontbreekt.
    pool
      .query(
        `insert into users (sub, email) values ($1, $2)
         on conflict (sub) do update set email = excluded.email, last_seen = now()`,
        [p.sub, p.email ?? null],
      )
      .catch(() => {})
    next()
  } catch {
    return res.status(401).json({ error: 'ongeldige of verlopen login' })
  }
}

// --- validatie-helpers ---
function validLngLat(lng, lat) {
  return Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lng) <= 180 && Math.abs(lat) <= 90
}
function validPath(path) {
  if (path == null) return true
  if (!Array.isArray(path) || path.length < 2 || path.length > MAX_PATH_POINTS) return false
  return path.every((p) => Array.isArray(p) && p.length === 2 && validLngLat(Number(p[0]), Number(p[1])))
}

// --- leescache ---
const CACHE_TTL = 15_000
const cache = new Map()
const cacheKey = (b) => [b.minLng, b.minLat, b.maxLng, b.maxLat].map((n) => n.toFixed(3)).join(',')

function toReport(row) {
  return {
    id: row.id,
    type: row.type,
    lng: row.lng,
    lat: row.lat,
    path: row.path ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
    confirmations: Number(row.confirmations ?? 0),
    denials: Number(row.denials ?? 0),
  }
}

app.get('/health', (_req, res) => res.json({ ok: true }))

// Lezen: publiek (geen login nodig).
app.get('/reports', async (req, res) => {
  const minLng = Number(req.query.minLng)
  const minLat = Number(req.query.minLat)
  const maxLng = Number(req.query.maxLng)
  const maxLat = Number(req.query.maxLat)
  if (![minLng, minLat, maxLng, maxLat].every(Number.isFinite))
    return res.status(400).json({ error: 'ongeldige bbox' })
  if (minLng > maxLng || minLat > maxLat) return res.status(400).json({ error: 'bbox omgedraaid' })
  if (maxLng - minLng > MAX_BBOX_SPAN || maxLat - minLat > MAX_BBOX_SPAN)
    return res.status(400).json({ error: 'bbox te groot' })

  const b = { minLng, minLat, maxLng, maxLat }
  const hit = cache.get(cacheKey(b))
  if (hit && Date.now() - hit.at < CACHE_TTL) return res.json(hit.data)

  try {
    const { rows } = await pool.query(
      `select r.id, r.type, r.lng, r.lat, r.path, r.created_at,
        coalesce(count(v.*) filter (where v.still_there), 0) as confirmations,
        coalesce(count(v.*) filter (where v.still_there = false), 0) as denials
       from reports r left join report_votes v on v.report_id = r.id
       where r.lng between $1 and $3 and r.lat between $2 and $4
       group by r.id limit ${RESULT_LIMIT}`,
      [b.minLng, b.minLat, b.maxLng, b.maxLat],
    )
    const data = rows.map(toReport)
    cache.set(cacheKey(b), { at: Date.now(), data })
    res.json(data)
  } catch {
    res.status(500).json({ error: 'database' })
  }
})

// Schrijven: login vereist.
app.post('/reports', writeLimiter, requireAuth, async (req, res) => {
  const { type, lng, lat, path } = req.body ?? {}
  if (!TYPES.includes(type)) return res.status(400).json({ error: 'ongeldig type' })
  if (!validLngLat(lng, lat)) return res.status(400).json({ error: 'ongeldige coördinaten' })
  if (!validPath(path)) return res.status(400).json({ error: 'ongeldig pad' })
  try {
    const { rows } = await pool.query(
      `insert into reports (type, lng, lat, path) values ($1, $2, $3, $4)
       returning id, type, lng, lat, path, created_at`,
      [type, lng, lat, path ? JSON.stringify(path) : null],
    )
    cache.clear()
    res.json(toReport({ ...rows[0], confirmations: 0, denials: 0 }))
  } catch {
    res.status(500).json({ error: 'database' })
  }
})

// Stemmen: login vereist; stem-id = Google-sub (server-bepaald, NIET door client opgegeven).
app.post('/reports/:id/vote', writeLimiter, requireAuth, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ongeldige id' })
  const { stillThere } = req.body ?? {}
  if (typeof stillThere !== 'boolean') return res.status(400).json({ error: 'ongeldige stem' })
  try {
    await pool.query(
      `insert into report_votes (report_id, voter_id, still_there) values ($1, $2, $3)
       on conflict (report_id, voter_id) do update set still_there = excluded.still_there`,
      [req.params.id, req.user.sub, stillThere],
    )
    cache.clear()
    res.status(204).end()
  } catch {
    res.status(500).json({ error: 'database' })
  }
})

app.listen(PORT, () => console.log(`Scooter-Nav API draait op poort ${PORT}`))
