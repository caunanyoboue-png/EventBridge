import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import toast from 'react-hot-toast';

// Fix leaflet default marker icons (Vite bundling issue)
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Abidjan centre par défaut
const DEFAULT_LAT = 5.3599517;
const DEFAULT_LNG = -4.0082563;
const DEFAULT_ZOOM = 13;

// Épingle colorée (ex. rouge urgence pour le S.O.S)
function pinIcon(color: string) {
  return L.divIcon({
    className: 'eb-pin',
    html: `<svg width="32" height="42" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24C24 5.37 18.63 0 12 0z" fill="${color}"/><circle cx="12" cy="12" r="4.5" fill="#fff"/></svg>`,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
  });
}

interface Props {
  lat?: number | null;
  lng?: number | null;
  onSelect: (lat: number, lng: number, address: string) => void;
  markerColor?: string;
}

export default function MapPicker({ lat, lng, onSelect, markerColor }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef      = useRef<L.Map | null>(null);
  const markerRef   = useRef<L.Marker | null>(null);
  const [locating, setLocating] = useState(false);
  const [address, setAddress]   = useState('');

  const initLat = lat ?? DEFAULT_LAT;
  const initLng = lng ?? DEFAULT_LNG;

  async function reverseGeocode(la: number, ln: number): Promise<string> {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${la}&lon=${ln}&accept-language=fr`,
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
      return `${la.toFixed(5)}, ${ln.toFixed(5)}`;
    }
  }

  // Crée le marqueur (avec son handler de drag) ou le déplace s'il existe déjà.
  function ensureMarker(la: number, ln: number): L.Marker {
    if (!markerRef.current) {
      const opts: L.MarkerOptions = { draggable: true };
      if (markerColor) opts.icon = pinIcon(markerColor);
      const m = L.marker([la, ln], opts).addTo(mapRef.current!);
      m.on('dragend', async () => {
        const pos = m.getLatLng();
        const addr = await reverseGeocode(pos.lat, pos.lng);
        setAddress(addr);
        onSelect(pos.lat, pos.lng, addr); // déplacement manuel → met à jour l'adresse
      });
      markerRef.current = m;
    } else {
      markerRef.current.setLatLng([la, ln]);
    }
    return markerRef.current;
  }

  // Clic / GPS : place l'épingle ET remonte l'adresse au parent.
  async function placeMarker(la: number, ln: number) {
    if (!mapRef.current) return;
    ensureMarker(la, ln);
    const addr = await reverseGeocode(la, ln);
    setAddress(addr);
    onSelect(la, ln, addr);
  }

  // Init carte (une seule fois)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView([initLat, initLng], DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    map.on('click', async (e: L.LeafletMouseEvent) => {
      await placeMarker(e.latlng.lat, e.latlng.lng);
    });
    mapRef.current = map;

    if (lat != null && lng != null) ensureMarker(lat, lng); // épingle initiale (silencieuse)

    return () => { map.remove(); mapRef.current = null; markerRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Coordonnées modifiées depuis l'extérieur (ex. adresse géocodée) → déplacer l'épingle.
  useEffect(() => {
    if (lat == null || lng == null || !mapRef.current) return;
    const m = markerRef.current;
    if (m) {
      const c = m.getLatLng();
      if (Math.abs(c.lat - lat) < 1e-6 && Math.abs(c.lng - lng) < 1e-6) return; // déjà à la bonne place
    }
    ensureMarker(lat, lng);
    mapRef.current.setView([lat, lng], Math.max(mapRef.current.getZoom(), 15));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  async function geolocate() {
    if (!navigator.geolocation) {
      toast.error("La géolocalisation n'est pas disponible sur cet appareil.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude, accuracy } = pos.coords;
        const coarse = accuracy != null && accuracy > 3000; // > 3 km : lecture WiFi/IP peu fiable (typique sur ordinateur)
        mapRef.current?.flyTo([latitude, longitude], coarse ? 13 : 16, { animate: true, duration: 1 });
        await placeMarker(latitude, longitude);
        setLocating(false);
        if (coarse) {
          toast(
            `Position approximative (±${Math.round(accuracy / 1000)} km). Sur ordinateur, la localisation passe par le WiFi/IP et vise souvent Abidjan — déplacez l'épingle pour ajuster.`,
            { icon: '📍', duration: 7000 }
          );
        }
      },
      err => {
        setLocating(false);
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "Localisation refusée. Autorisez l'accès à votre position, puis réessayez — ou placez l'épingle à la main."
            : err.code === err.TIMEOUT
            ? "La localisation a expiré. Réessayez, ou placez l'épingle à la main sur la carte."
            : "Position indisponible. Placez l'épingle à la main sur la carte.";
        toast.error(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(201,168,76,0.2)', isolation: 'isolate' }}>
      {/* Barre d'info + bouton GPS */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', background: 'rgba(26,18,50,0.95)',
        borderBottom: '1px solid rgba(201,168,76,0.12)',
      }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {address || 'Cliquez sur la carte pour placer l\'épingle'}
        </span>
        <button
          type="button"
          onClick={geolocate}
          disabled={locating}
          style={{
            marginLeft: 10, flexShrink: 0,
            padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            cursor: locating ? 'wait' : 'pointer',
            background: 'var(--color-gold-primary)',
            color: '#261642', border: 'none', opacity: locating ? 0.7 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {locating ? '…' : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><MapPin size={14} /> Me localiser</span>}
        </button>
      </div>

      {/* Carte Leaflet */}
      <div ref={containerRef} style={{ height: 260, width: '100%' }} />

      <p style={{ fontSize: 11, color: 'var(--color-text-muted)', padding: '6px 12px', background: 'rgba(26,18,50,0.95)', margin: 0 }}>
        Glissez l'épingle ou cliquez pour affiner la position · OpenStreetMap
      </p>
    </div>
  );
}
