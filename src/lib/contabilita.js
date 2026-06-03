export function verificaBilancio(righe) {
  const somma = righe.reduce((acc, r) => acc + (r.dare || 0) - (r.avere || 0), 0)
  return Math.abs(somma) < 0.01
}

export function calcolaSaldi(movimenti) {
  const saldi = {}
  movimenti.forEach(m => {
    (m.righe || []).forEach(r => {
      if (!r.conto) return
      if (saldi[r.conto] === undefined) saldi[r.conto] = 0
      saldi[r.conto] += (r.dare || 0) - (r.avere || 0)
    })
  })
  return saldi
}

export function fmtEur(v) {
  const n = parseFloat(v) || 0
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)
}

// Tipi di conto di sistema (non cancellabili)
export const TIPI_CONTO_SISTEMA = {
  // Disponibilità liquide
  cassa: { nome: 'Cassa contanti', tipo: 'disponibilita', sistema: true },
  banca_principale: { nome: 'Banca c/c principale', tipo: 'disponibilita', sistema: true },
  // Crediti
  crediti_clienti: { nome: 'Crediti verso clienti', tipo: 'attivo', sistema: true },
  soci_sottoscrizione: { nome: 'Soci c/sottoscrizione', tipo: 'attivo', sistema: true },
  soci_versamenti_dovuti: { nome: 'Soci c/versamenti ancora dovuti', tipo: 'attivo', sistema: true },
  // IVA
  iva_credito: { nome: 'IVA a credito', tipo: 'attivo', sistema: true },
  iva_debito: { nome: 'IVA a debito', tipo: 'passivo', sistema: true },
  // Debiti fornitori
  debiti_fornitori: { nome: 'Debiti verso fornitori', tipo: 'passivo', sistema: true },
  // Fondi accantonamento
  fondo_tasse: { nome: 'Fondo imposte', tipo: 'fondo_accantonamento', sistema: true },
  fondo_contributi: { nome: 'Fondo contributi', tipo: 'fondo_accantonamento', sistema: true },
  // Immobilizzazioni
  attrezzature: { nome: 'Attrezzature', tipo: 'attivo', sistema: true },
  // Netto
  capitale_sociale: { nome: 'Capitale sociale', tipo: 'netto', sistema: true },
  // Ricavi
  ricavi_wedding: { nome: 'Ricavi Wedding', tipo: 'ricavo', sistema: true },
  ricavi_serra: { nome: 'Ricavi La Serra', tipo: 'ricavo', sistema: true },
  // Costi
  costi_personale: { nome: 'Costi del personale', tipo: 'costo', sistema: true },
  costi_acquisti: { nome: 'Acquisti e forniture', tipo: 'costo', sistema: true },
  costi_accantonamenti: { nome: 'Accantonamenti', tipo: 'costo', sistema: true },
}

export const CATEGORIE_MASTRINO = [
  { value: 'disponibilita', label: 'Disponibilità liquide (cassa/banca)' },
  { value: 'attivo', label: 'Attivo (crediti, beni)' },
  { value: 'passivo', label: 'Passivo (debiti generici)' },
  { value: 'debito_dipendente', label: 'Debito verso dipendente/collaboratore' },
  { value: 'fondo_accantonamento', label: 'Fondo accantonamento' },
  { value: 'netto', label: 'Patrimonio netto' },
  { value: 'ricavo', label: 'Ricavo' },
  { value: 'costo', label: 'Costo' },
]

// Genera scrittura capitale sociale (due fasi)
export function scritturaCapitaleSociale({ totale, versato, contoCassa }) {
  const nonVersato = totale - versato
  const righe = []
  // Fase 1: Sottoscrizione
  righe.push({ conto: 'soci_sottoscrizione', dare: totale, avere: 0, nota: 'Sottoscrizione capitale' })
  righe.push({ conto: 'capitale_sociale', dare: 0, avere: totale, nota: 'Capitale sociale sottoscritto' })
  // Fase 2: Versamento parziale
  if (versato > 0) {
    righe.push({ conto: contoCassa || 'banca_principale', dare: versato, avere: 0, nota: 'Versamento quota' })
    righe.push({ conto: 'soci_sottoscrizione', dare: 0, avere: versato, nota: 'Versamento quota' })
  }
  // Residuo
  if (nonVersato > 0) {
    righe.push({ conto: 'soci_versamenti_dovuti', dare: nonVersato, avere: 0, nota: 'Versamenti ancora dovuti' })
    righe.push({ conto: 'soci_sottoscrizione', dare: 0, avere: nonVersato, nota: 'Versamenti ancora dovuti' })
  }
  return righe
}
