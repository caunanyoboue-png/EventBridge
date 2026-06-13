// Icônes de prestations — version professionnelle (lucide) remplaçant les emojis.
import {
  Utensils, Wine, ChefHat, ConciergeBell, Music, Megaphone,
  Lightbulb, Camera, Video, ShieldCheck, Car, Package, Palette, Sparkles,
  type LucideIcon,
} from 'lucide-react';

const SERVICE_ICON_MAP: Record<string, LucideIcon> = {
  'Service en salle':       Utensils,
  'Bar / Barman':           Wine,
  'Cuisine gastronomique':  ChefHat,
  'Hôtesse accueil':        ConciergeBell,
  'Animation':              Music,
  'MC / Présentateur':      Megaphone,
  'Son & Lumière':          Lightbulb,
  'Photographie':           Camera,
  'Vidéographie':           Video,
  'Sécurité':               ShieldCheck,
  'Chauffeur':              Car,
  'Manutention':            Package,
  'Décoration':             Palette,
};

export function getServiceIcon(type?: string | null): LucideIcon {
  return (type && SERVICE_ICON_MAP[type]) || Sparkles;
}

interface ServiceIconProps {
  type?: string | null;
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

/** Icône de prestation. Par défaut dorée. */
export function ServiceIcon({ type, size = 22, color = '#d4af37', strokeWidth = 1.6, className }: ServiceIconProps) {
  const Icon = getServiceIcon(type);
  return <Icon size={size} color={color} strokeWidth={strokeWidth} className={className} />;
}

/** Icône de prestation dans une pastille dorée arrondie (pour les cartes). */
export function ServiceIconBadge({ type, size = 44, iconSize }: { type?: string | null; size?: number; iconSize?: number }) {
  return (
    <div
      style={{
        width: size, height: size, flexShrink: 0, borderRadius: size * 0.28,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, rgba(201,168,76,0.16), rgba(201,168,76,0.06))',
        border: '1px solid rgba(201,168,76,0.28)',
      }}
    >
      <ServiceIcon type={type} size={iconSize ?? Math.round(size * 0.5)} />
    </div>
  );
}
