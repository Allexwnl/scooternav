import type { CapacitorConfig } from '@capacitor/cli'

// Config voor het verpakken van de web-app als native Android/iOS-app.
// Pas de stappen toe uit CAPACITOR.md (Capacitor wordt pas geïnstalleerd wanneer je
// de mobiele app bouwt — dit bestand staat alvast klaar).
const config: CapacitorConfig = {
  appId: 'com.scooternav.app',
  appName: 'Scooter-Nav',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config
