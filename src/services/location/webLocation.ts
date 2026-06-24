import type {
  LocationProvider,
  PositionCallback,
  PositionErrorCallback,
} from './types'

/**
 * Web-implementatie via de browser Geolocation API.
 * Later: een CapacitorLocationProvider met dezelfde interface → native GPS.
 */
export class WebLocationProvider implements LocationProvider {
  watch(onPos: PositionCallback, onErr?: PositionErrorCallback): () => void {
    if (!('geolocation' in navigator)) {
      onErr?.(new Error('Geolocatie wordt niet ondersteund door deze browser.'))
      return () => {}
    }

    const id = navigator.geolocation.watchPosition(
      (p) =>
        onPos({
          lng: p.coords.longitude,
          lat: p.coords.latitude,
          accuracy: p.coords.accuracy,
          heading: p.coords.heading,
          speed: p.coords.speed,
        }),
      (e) => onErr?.(new Error(e.message)),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }, // altijd verse, nauwkeurige fix
    )

    return () => navigator.geolocation.clearWatch(id)
  }
}
