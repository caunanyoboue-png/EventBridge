// Haversine formula — distance en km entre deux points GPS
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

// Obtenir la position GPS du navigateur (Promise)
export function getBrowserPosition(): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Géolocalisation non supportée'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve(pos.coords),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

// Reverse geocoding via Nominatim (gratuit, OpenStreetMap)
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=fr`,
      { headers: { 'User-Agent': 'EventBridge-CI/1.0' } }
    );
    const json = await res.json();
    const a = json.address || {};
    const parts = [
      a.road || a.pedestrian || a.footway,
      a.suburb || a.neighbourhood || a.quarter,
      a.city || a.town || a.village || 'Abidjan',
    ].filter(Boolean);
    return parts.join(', ');
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

// Geocoding direct : adresse → coordonnées (via Nominatim)
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const q = encodeURIComponent(`${address}, Côte d'Ivoire`);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1&countrycodes=ci`,
      { headers: { 'User-Agent': 'EventBridge-CI/1.0' } }
    );
    const json = await res.json();
    if (json.length === 0) return null;
    return { lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) };
  } catch {
    return null;
  }
}
