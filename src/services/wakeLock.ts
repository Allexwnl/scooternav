// Houdt het scherm aan tijdens navigatie (Wake Lock API). Web nu; op mobiel later
// eventueel de Capacitor KeepAwake-plugin met dezelfde enable/disable-aanroepen.
let lock: WakeLockSentinel | null = null

function onVisible() {
  if (document.visibilityState === 'visible' && !lock) void enableWakeLock()
}

export async function enableWakeLock(): Promise<void> {
  if (!('wakeLock' in navigator) || lock) return
  try {
    lock = await navigator.wakeLock.request('screen')
    lock.addEventListener('release', () => {
      lock = null
    })
    document.addEventListener('visibilitychange', onVisible)
  } catch {
    lock = null // niet ondersteund of geweigerd — stil negeren
  }
}

export async function disableWakeLock(): Promise<void> {
  document.removeEventListener('visibilitychange', onVisible)
  const current = lock
  lock = null
  try {
    await current?.release()
  } catch {
    /* al vrijgegeven */
  }
}
