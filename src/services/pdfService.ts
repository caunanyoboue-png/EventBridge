import jsPDF from 'jspdf';
import { supabase } from '../lib/supabase';
import { type Contract } from '../types';
import { formatCFA } from '../lib/utils';
import { LEGAL_CLAUSES, CDD_REASON_LABELS } from './contractService';

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-CI', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function addSection(doc: jsPDF, title: string, y: number, pageW: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(100, 60, 160);
  doc.text(title, 14, y);
  doc.setDrawColor(201, 168, 76);
  doc.setLineWidth(0.4);
  doc.line(14, y + 1.5, pageW - 14, y + 1.5);
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  return y + 7;
}

function addParagraph(doc: jsPDF, text: string, y: number, pageW: number, pageH: number): number {
  const lines = doc.splitTextToSize(text, pageW - 28);
  if (y + lines.length * 5 > pageH - 20) {
    doc.addPage();
    y = 20;
  }
  doc.text(lines, 14, y);
  return y + lines.length * 5 + 3;
}

function addKeyValue(doc: jsPDF, key: string, value: string, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.text(key + ' :', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(value || '—', 70, y);
  return y + 6;
}

export async function generateContractPDF(contract: Contract): Promise<string> {
  const doc  = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = 15;

  // ── En-tête ───────────────────────────────────────────────────
  doc.setFillColor(38, 22, 66);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(201, 168, 76);
  doc.text('EVENTBRIDGE', 14, 11);
  doc.setFontSize(9);
  doc.setTextColor(240, 230, 211);
  doc.text('Le pont entre talents et opportunités', 14, 17);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('CONTRAT DE MISSION — CDD', pageW / 2, 23, { align: 'center' });

  // Référence
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text(`Réf. : ${contract.id.substring(0, 8).toUpperCase()} · Version ${contract.version}`, pageW - 14, 23, { align: 'right' });

  y = 35;
  doc.setTextColor(30, 30, 30);

  // ── Parties ───────────────────────────────────────────────────
  y = addSection(doc, '1. PARTIES AU CONTRAT (Art. 15.2)', y, pageW);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('ORGANISATEUR (Employeur)', 14, y); y += 5;
  doc.setFont('helvetica', 'normal');
  y = addKeyValue(doc, 'Raison sociale', contract.organizer_name, y);
  y = addKeyValue(doc, 'Adresse', contract.organizer_address, y);
  y = addKeyValue(doc, 'RCCM', contract.organizer_rccm || 'Non fourni', y);
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.text('FREELANCE (Salarié temporaire)', 14, y); y += 5;
  doc.setFont('helvetica', 'normal');
  y = addKeyValue(doc, 'Nom complet', contract.freelance_name, y);
  y = addKeyValue(doc, 'Adresse', contract.freelance_address, y);
  y = addKeyValue(doc, 'N° CNI', contract.freelance_cni || 'Non fourni', y);
  y += 4;

  // ── Nature du contrat ─────────────────────────────────────────
  y = addSection(doc, '2. NATURE ET MOTIF DU CONTRAT (Art. 15.1, 15.3, 15.6)', y, pageW);
  y = addKeyValue(doc, 'Type', 'Contrat à Durée Déterminée (CDD) à terme précis', y);
  y = addKeyValue(doc, 'Motif CDD', CDD_REASON_LABELS[contract.cdd_reason] || contract.cdd_reason, y);
  y = addKeyValue(doc, 'Poste', contract.job_title, y);
  y = addKeyValue(doc, 'Lieu', contract.location, y);
  y = addKeyValue(doc, 'Début', fmtDate(contract.start_date), y);
  y = addKeyValue(doc, 'Fin', fmtDate(contract.end_date), y);
  if (contract.trial_period_days) {
    y = addKeyValue(doc, 'Période d\'essai', `${contract.trial_period_days} jour(s) (Art. 14.5)`, y);
  }
  y += 2;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  y = addParagraph(doc, 'Description des tâches : ' + contract.job_description, y, pageW, pageH);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  y += 2;

  // ── Rémunération ──────────────────────────────────────────────
  y = addSection(doc, '3. RÉMUNÉRATION (Art. 31.1 à 31.9 — SMIG : 355 FCFA/h)', y, pageW);
  y = addKeyValue(doc, 'Taux horaire brut', `${formatCFA(contract.hourly_rate)}/h`, y);
  y = addKeyValue(doc, 'Durée journalière', `${contract.daily_hours}h/jour (max légal : 8h — Art. 21.1)`, y);
  y = addKeyValue(doc, 'Nombre de jours', String(contract.total_days), y);
  y = addKeyValue(doc, 'Montant brut total', formatCFA(contract.total_gross), y);
  y = addKeyValue(doc, 'Indemnité fin contrat (3%)', formatCFA(contract.end_of_contract_indemnity) + ' (Art. 15.8)', y);
  y = addKeyValue(doc, 'Mode de paiement', contract.payment_method.replace('_', ' ').toUpperCase(), y);
  y += 4;

  // ── Heures supplémentaires ────────────────────────────────────
  y = addSection(doc, '4. DURÉE DU TRAVAIL ET HEURES SUPPLÉMENTAIRES (Art. 21.1, 21.5)', y, pageW);
  y = addParagraph(doc,
    'La durée légale du travail est de 40 heures par semaine (8h/jour). ' +
    'Les heures effectuées au-delà seront majorées de 15% pour les 8 premières heures supplémentaires hebdomadaires, ' +
    'et de 50% au-delà. Le repos hebdomadaire minimum est de 24h consécutives (Art. 24.1).',
    y, pageW, pageH);

  // ── Clauses légales obligatoires ──────────────────────────────
  y = addSection(doc, '5. CLAUSES LÉGALES OBLIGATOIRES', y, pageW);
  y = addParagraph(doc, '5.1 Rupture anticipée — ' + LEGAL_CLAUSES.early_termination, y, pageW, pageH);
  y = addParagraph(doc, '5.2 Non-discrimination — ' + LEGAL_CLAUSES.non_discrimination, y, pageW, pageH);
  y = addParagraph(doc, '5.3 Anti-harcèlement — ' + LEGAL_CLAUSES.anti_harassment, y, pageW, pageH);
  y = addParagraph(doc, '5.4 Travail forcé — ' + LEGAL_CLAUSES.no_forced_labor, y, pageW, pageH);

  // ── Clauses optionnelles ──────────────────────────────────────
  if (contract.has_telework_clause || contract.has_confidentiality_clause) {
    y = addSection(doc, '6. CLAUSES PARTICULIÈRES', y, pageW);
    if (contract.has_telework_clause) {
      y = addParagraph(doc, '6.1 Télétravail — ' + LEGAL_CLAUSES.telework, y, pageW, pageH);
    }
    if (contract.has_confidentiality_clause) {
      y = addParagraph(doc, '6.2 Confidentialité — ' + LEGAL_CLAUSES.confidentiality, y, pageW, pageH);
    }
  }

  // ── Indemnité de fin (clause verbatim) ────────────────────────
  y = addSection(doc, contract.has_telework_clause || contract.has_confidentiality_clause ? '7. INDEMNITÉ DE FIN DE CONTRAT' : '6. INDEMNITÉ DE FIN DE CONTRAT', y, pageW);
  y = addParagraph(doc,
    `À l'issue du présent contrat, et sauf conclusion d'un CDI, le Freelance percevra une indemnité de fin de contrat ` +
    `égale à 3% du montant total de la rémunération brute, soit ${formatCFA(contract.end_of_contract_indemnity)} FCFA, ` +
    `versée lors du règlement du dernier salaire. (Art. 15.8)`,
    y, pageW, pageH);

  // ── Signatures ────────────────────────────────────────────────
  if (y > pageH - 60) { doc.addPage(); y = 20; }
  y = addSection(doc, 'SIGNATURES', y, pageW);
  y += 4;

  const col1 = 14, col2 = pageW / 2 + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('L\'ORGANISATEUR', col1, y);
  doc.text('LE FREELANCE', col2, y);
  y += 5;
  doc.setFont('helvetance', 'normal');
  doc.setFontSize(8.5);
  doc.text('Lu et approuvé', col1, y);
  doc.text('Lu et approuvé', col2, y);
  y += 4;
  doc.text(contract.organizer_name, col1, y);
  doc.text(contract.freelance_name, col2, y);
  y += 6;

  if (contract.organizer_signed_at) {
    doc.setTextColor(16, 185, 129);
    doc.text(`✓ Signé le ${fmtDate(contract.organizer_signed_at)}`, col1, y);
  } else {
    doc.setTextColor(150, 150, 150);
    doc.text('Signature en attente', col1, y);
  }

  if (contract.freelance_signed_at) {
    doc.setTextColor(16, 185, 129);
    doc.text(`✓ Signé le ${fmtDate(contract.freelance_signed_at)}`, col2, y);
  } else {
    doc.setTextColor(150, 150, 150);
    doc.text('Signature en attente', col2, y);
  }
  doc.setTextColor(30, 30, 30);
  y += 10;

  // Signature boxes
  doc.setDrawColor(180, 160, 100);
  doc.rect(col1, y, 75, 20);
  doc.rect(col2, y, 75, 20);
  y += 25;

  // ── Watermark SIGNÉ ───────────────────────────────────────────
  if (contract.status === 'signed') {
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setGState(new (doc as unknown as { GState: new (o: object) => object }).GState({ opacity: 0.08 }));
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(72);
      doc.setTextColor(16, 185, 129);
      doc.text('SIGNÉ', pageW / 2, pageH / 2, { align: 'center', angle: 45 });
      doc.setGState(new (doc as unknown as { GState: new (o: object) => object }).GState({ opacity: 1 }));
    }
  }

  // ── Upload vers Supabase Storage ──────────────────────────────
  const pdfBlob = doc.output('blob');
  const path    = `${contract.id}/v${contract.version}.pdf`;
  const { error } = await supabase.storage.from('contracts').upload(path, pdfBlob, {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from('contracts').getPublicUrl(path);
  return data.publicUrl;
}
