import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'EEEE d MMMM yyyy', { locale: fr });
}

export function formatDateShort(date: string | Date): string {
  return format(new Date(date), 'd MMM yyyy', { locale: fr });
}

export function formatTime(time: string): string {
  return time.substring(0, 5);
}

export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr });
}

export function formatCFA(amount: number): string {
  return new Intl.NumberFormat('fr-CI').format(amount) + ' FCFA';
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export const SERVICE_ICONS: Record<string, string> = {
  'Service en salle': '🍽️',
  'Bar / Barman': '🍸',
  'Cuisine gastronomique': '👨‍🍳',
  'Hôtesse accueil': '💁',
  'Animation': '🎤',
  'MC / Présentateur': '🎙️',
  'Son & Lumière': '💡',
  'Photographie': '📸',
  'Vidéographie': '🎥',
  'Sécurité': '🛡️',
  'Chauffeur': '🚗',
  'Manutention': '📦',
  'Décoration': '🎨',
};

export const VILLES = [
  // ── Abidjan ──────────────────────────────────
  'Abidjan - Plateau',
  'Abidjan - Cocody',
  'Abidjan - Cocody - Riviera 1',
  'Abidjan - Cocody - Riviera 2',
  'Abidjan - Cocody - Riviera 3',
  'Abidjan - Cocody - Riviera 4',
  'Abidjan - Cocody - Angré',
  'Abidjan - Cocody - Bonoumin',
  'Abidjan - Cocody - II Plateaux',
  'Abidjan - Cocody - Palmeraie',
  'Abidjan - Marcory',
  'Abidjan - Marcory - Zone 4',
  'Abidjan - Marcory - Anoumabo',
  'Abidjan - Yopougon',
  'Abidjan - Yopougon - Selmer',
  'Abidjan - Yopougon - Kouté',
  'Abidjan - Yopougon - Niangon',
  'Abidjan - Treichville',
  'Abidjan - Abobo',
  'Abidjan - Abobo - Baoulé',
  'Abidjan - Adjamé',
  'Abidjan - Adjamé - Williamsville',
  'Abidjan - Attécoubé',
  'Abidjan - Port-Bouët',
  'Abidjan - Port-Bouët - Vridi',
  'Abidjan - Koumassi',
  'Abidjan - Bingerville',
  // ── Bouaké ───────────────────────────────────
  'Bouaké',
  'Bouaké - Air France',
  'Bouaké - Commerce',
  'Bouaké - Dar-es-Salam',
  'Bouaké - Kennedy',
  'Bouaké - Koko',
  'Bouaké - Nimbo',
  'Bouaké - Sokoura',
  'Bouaké - Tassémini',
  'Bouaké - Zone Industrielle',
  // ── San-Pédro ─────────────────────────────────
  'San-Pédro',
  'San-Pédro - Bardo',
  'San-Pédro - Cité',
  'San-Pédro - Grand-Bardo',
  'San-Pédro - Kponton',
  'San-Pédro - Lac',
  'San-Pédro - Liberté',
  'San-Pédro - Sante Yéou',
  // ── Assinie ──────────────────────────────────
  'Assinie',
  'Assinie - Mafia',
  'Assinie - Afféma',
  'Assinie - Assouindé',
  'Assinie - Jacqueville',
  // ── Yamoussoukro ─────────────────────────────
  'Yamoussoukro',
  'Yamoussoukro - Habitat',
  'Yamoussoukro - Dioulakro',
  'Yamoussoukro - N\'Zuéssibougou',
  'Yamoussoukro - Faya',
  'Yamoussoukro - Millionnaire',
  'Yamoussoukro - Assabou',
  'Yamoussoukro - Morofé',
  // ── Korhogo ──────────────────────────────────
  'Korhogo',
  'Korhogo - Château',
  'Korhogo - Commerce',
  'Korhogo - Kassiré',
  'Korhogo - Koko',
  'Korhogo - Nangakaha',
  'Korhogo - Soba',
  'Korhogo - Zone Industrielle',
  // ── Autres villes ────────────────────────────
  'Grand-Bassam',
  'Grand-Bassam - Quartier France',
  'Grand-Bassam - Nouveau Quartier',
  'Grand-Bassam - Moossou',
  'Daloa',
  'Abengourou',
  'Man',
  'Gagnoa',
  'Divo',
  'Soubré',
];

export const COMPETENCES = [
  'Service en salle',
  'Bar / Barman',
  'Cuisine gastronomique',
  'Plongeur',
  'Hôtesse accueil',
  'Animation',
  'MC / Présentateur',
  'Son & Lumière',
  'Photographie',
  'Vidéographie',
  'Sécurité',
  'Chauffeur',
  'Manutention',
  'Décoration',
];
