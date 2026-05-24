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
  'Abidjan - Plateau',
  'Abidjan - Cocody',
  'Abidjan - Marcory',
  'Abidjan - Yopougon',
  'Abidjan - Treichville',
  'Abidjan - Abobo',
  'Abidjan - Adjamé',
  'Bouaké',
  'San Pedro',
  'Yamoussoukro',
  'Daloa',
];

export const COMPETENCES = [
  'Service en salle',
  'Bar / Barman',
  'Cuisine gastronomique',
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
