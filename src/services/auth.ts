import { reactive } from 'vue'
import { GOOGLE_CLIENT_ID } from '../config'

export interface AuthUser {
  sub: string
  email?: string
  name?: string
  picture?: string
}

// Reactieve auth-status. `token` = Google ID-token (JWT) dat we naar de API sturen;
// de server verifieert het. We bewaren GEEN wachtwoorden — die zien we nooit.
export const auth = reactive<{ user: AuthUser | null; token: string | null }>({
  user: null,
  token: null,
})

/* eslint-disable @typescript-eslint/no-explicit-any */
let gisReady: Promise<void> | null = null
let initialized = false

function loadGis(): Promise<void> {
  if (gisReady) return gisReady
  gisReady = new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.id) return resolve()
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Google-inlogscript kon niet laden'))
    document.head.appendChild(s)
  })
  return gisReady
}

function decodeJwt(token: string): Record<string, unknown> {
  try {
    return JSON.parse(atob(token.split('.')[1] ?? '')) as Record<string, unknown>
  } catch {
    return {}
  }
}

// Alleen voor weergave (naam/foto). De échte verificatie doet de server.
function onCredential(resp: { credential: string }) {
  const p = decodeJwt(resp.credential)
  auth.token = resp.credential
  auth.user = {
    sub: String(p.sub ?? ''),
    email: p.email as string | undefined,
    name: p.name as string | undefined,
    picture: p.picture as string | undefined,
  }
}

export async function initAuth(): Promise<void> {
  if (!GOOGLE_CLIENT_ID || initialized) return
  await loadGis()
  if (initialized) return // race: een tweede aanroep tijdens het laden
  ;(window as any).google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: onCredential,
  })
  initialized = true
}

export async function renderButton(el: HTMLElement): Promise<void> {
  if (!GOOGLE_CLIENT_ID) return
  await initAuth()
  ;(window as any).google.accounts.id.renderButton(el, {
    theme: 'outline',
    size: 'medium',
    type: 'standard',
    text: 'signin_with',
  })
}

export async function signIn(): Promise<void> {
  if (!GOOGLE_CLIENT_ID) return
  await initAuth()
  ;(window as any).google.accounts.id.prompt()
}

export function signOut(): void {
  auth.user = null
  auth.token = null
  const g = (window as any).google
  if (g?.accounts?.id) g.accounts.id.disableAutoSelect()
}
