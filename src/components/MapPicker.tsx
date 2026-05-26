import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

interface Props {
  lat?: number | null;
  lng?: number | null;
  onSelect: (lat: number, lng: number, address: string) => void;
}

export default function MapPicker({ lat, lng, onSelect }: Props) {
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

  async function placeMarker(la: number, ln: number) {
    if (!mapRef.current) return;
    markerRef.current?.remove();
    markerRef.current = L.marker([la, ln], { draggable: true }).addTo(mapRef.current);
    markerRef.current.on('dragend', async () => {
      const pos = markerRef.current!.getLatLng();
      const addr = await reverseGeocode(pos.lat, pos.lng);
      setAddress(addr);
      onSelect(pos.lat, pos.lng, addr);
    });
    const addr = await reverseGeocode(la, ln);
    setAddress(addr);
    onSelect(la, ln, addr);
  }

  // Init map once
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

    if (lat && lng) placeMarker(lat, lng);

    return () => { map.remove(); mapRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function geolocate() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords;
        mapRef.current?.flyTo([latitude, longitude], 16, { animate: true, duration: 1 });
        await placeMarker(latitude, longitude);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(201,168,76,0.2)' }}>
      {/* Barre d'info + bouton GPS */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', background: 'rgba(26,18,50,0.95)',
        borderBottom: '1px solid rgba(201,168,76,0.12)',
      }}>
        <span style={{ fontSize: 12, color: 'rgba(240,230,211,0.5)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
            background: 'linear-gradient(135deg,#c9a84c,#e8c97a)',
            color: '#261642', border: 'none', opacity: locating ? 0.7 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {locating ? '…' : '📍 Me localiser'}
        </button>
      </div>

      {/* Carte Leaflet */}
      <div ref={containerRef} style={{ height: 260, width: '100%' }} />

      <p style={{ fontSize: 11, color: 'rgba(240,230,211,0.3)', padding: '6px 12px', background: 'rgba(26,18,50,0.95)', margin: 0 }}>
        Glissez l'épingle ou cliquez pour affiner la position · OpenStreetMap
      </p>
    </div>
  );
}
