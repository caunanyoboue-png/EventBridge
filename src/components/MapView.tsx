import { useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface Props {
  lat: number;
  lng: number;
  label?: string;
  zoom?: number;
}

export default function MapView({ lat, lng, label, zoom = 15 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: false })
      .setView([lat, lng], zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([lat, lng]).addTo(map);
    if (label) marker.bindPopup(label).openPopup();

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update view if coords change
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setView([lat, lng], zoom);
  }, [lat, lng, zoom]);

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(201,168,76,0.15)' }}>
      <div ref={containerRef} style={{ height: 220, width: '100%' }} />
      <div style={{
        padding: '7px 12px', background: 'rgba(26,18,50,0.95)',
        fontSize: 11, color: 'var(--color-text-muted)',
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        <MapPin size={12} /> {label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`} · OpenStreetMap
      </div>
    </div>
  );
}
