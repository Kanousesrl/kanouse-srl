import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { fmtEur } from '../lib/contabilita.js'

const CONTI_SISTEMA = [
  { id: '__cassa', nome: 'Cassa contanti', tipo: 'disponibilita' },
  { id: '__banca', nome: 'Banca c/c principale', tipo: 'disponibilita' },
  { id: '__crediti_clienti', nome: 'Crediti verso clienti', tipo: 'attivo' },
  { id: '__soci_sott', nome: 'Soci c/sottoscrizione', tipo: 'attivo' },
  { id: '__soci_dovuti', nome: 'Soci c/versamenti ancora dovuti', tipo: 'attivo' },
  { id: '__iva_credito', nome: 'IVA a credito', tipo: 'attivo' },
  { id: '__iva_debito', nome: 'IVA a debito', tipo: 'passivo' },
  { id: '__debiti_fornitori', nome: 'Debiti verso fornitori', tipo: 'passivo' },
  { id: '__fondo_tasse', nome: 'Fondo imposte', tipo: 'fondo_accantonamento' },
  { id: '__fondo_contributi', nome: 'Fondo contributi', tipo: 'fondo_accantonamento' },
  { id: '__attrezzature', nome: 'Attrezzature', tipo: 'attivo' },
  { id: '__capitale_sociale', nome: 'Capitale sociale', tipo: 'netto' },
  { id: '__ricavi_wedding', nome: 'Ricavi Wedding', tipo: 'ricavo' },
  { id: '__ricavi_serra', nome: 'Ricavi La Serra', tipo: 'ricavo' },
  { id: '__costi_personale', nome: 'Costi del personale', tipo: 'costo' },
  { id: '__costi_acquisti', nome: 'Acquisti e forniture', tipo: 'costo' },
  { id: '__costi_accantonamenti', nome: 'Accantonamenti', tipo: 'costo' },
]

const GRUPPI = [
  { tipo: 'disponibilita', label: 'Disponibilità liquide' },
  { tipo: 'attivo', label: 'Attivo' },
  { tipo: 'passivo', label: 'Passivo' },
  { tipo: 'debito_dipendente', label: 'Debiti verso collaboratori' },
  { tipo: 'fondo_accantonamento', label: 'Fondi accantonamento' },
  { tipo: 'netto', label: 'Patrimonio netto' },
  { tipo: 'ricavo', label: 'Ricavi' },
  { tipo: 'costo', label: 'Costi' },
]

export default function LibroMastro({ navigate }) {
  const [movimenti, setMovimenti] = useState([])
  const [mastrini, setMastrini] = useState([])
  const [loading, setLoading] = useState(true)
  const [contoSelezionato, setContoSelezionato] = useState(null)

  useEffect(() => { carica() }, [])

  async function carica() {
    setLoading(true)
    const [{ data: mov }, { data: mast }] = await Promise.all([
      supabase.from('movimenti').select('*').order('data').order('created_at'),
      supabase.from('mastrini').select('*').order('nome'),
    ])
    setMovimenti(mov || [])
    setMastrini(mast || [])
    setLoading(false)
  }

  const tuttiConti = [...CONTI_SISTEMA, ...mastrini.map(m => ({ id: String(m.id), nome: m.nome, tipo: m.tipo }))]

  // Calcola saldo e movimenti per ogni conto
  function calcolaContoDati(contoId) {
    const righe = []
    movimenti.forEach(m => {
      (m.righe || []).forEach(r => {
        if (String(r.conto) === String(contoId)) {
          righe.push({
            data: m.data,
            descrizione: m.descrizione || '—',
            movimentoId: m.id,
            dare: r.dare || 0,
            avere: r.avere || 0,
            nota: r.nota || '',
          })
        }
      })
    })
    // Calcola saldo progressivo
    let saldo = 0
    const righeConSaldo = righe.map(r => {
      saldo += r.dare - r.avere
      return { ...r, saldo }
    })
    return { righe: righeConSaldo, saldoFinale: saldo }
  }

  // Conti che hanno almeno un movimento
  const contiAttivi = new Set()
  movimenti.forEach(m => (m.righe || []).forEach(r => { if (r.conto) contiAttivi.add(String(r.conto)) }))

  const gruppiConConti = GRUPPI.map(g => ({
    ...g,
    conti: tuttiConti.filter(c => c.tipo === g.tipo && contiAttivi.has(String(c.id))),
  })).filter(g => g.conti.length > 0)

  if (loading) return <div className="loading"><i className="ti ti-loader" />Caricamento...</div>

  const datiConto = contoSelezionato ? calcolaContoDati(contoSelezionato.id) : null

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Libro mastro</div>
          <div className="page-subtitle">Saldo e storico per ogni conto</div>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Lista conti */}
        <div className="stack">
          {gruppiConConti.length === 0 ? (
            <div className="card">
              <div className="empty">
                <i className="ti ti-book" aria-hidden="true" />
                Nessun movimento registrato.
              </div>
            </div>
          ) : gruppiConConti.map(g => (
            <div className="card" key={g.tipo}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>{g.label}</div>
              {g.conti.map(c => {
                const { saldoFinale } = calcolaContoDati(c.id)
                const isSelected = contoSelezionato?.id === c.id
                return (
                  <div
                    key={c.id}
                    className="cassetto"
                    style={{ cursor: 'pointer', background: isSelected ? 'var(--bg-secondary)' : 'var(--bg)', border: isSelected ? '0.5px solid var(--border-strong)' : undefined }}
                    onClick={() => setContoSelezionato(isSelected ? null : c)}
                  >
                    <div className="cassetto-name">
                      <i className="ti ti-book-2" style={{ fontSize: 14, color: 'var(--text-tertiary)' }} aria-hidden="true" />
                      {c.nome}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="cassetto-value" style={{ color: saldoFinale >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtEur(saldoFinale)}</div>
                      <i className={`ti ${isSelected ? 'ti-chevron-up' : 'ti-chevron-right'}`} style={{ fontSize: 12, color: 'var(--text-tertiary)' }} aria-hidden="true" />
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Storico conto selezionato */}
        <div>
          {!contoSelezionato ? (
            <div className="card">
              <div className="empty">
                <i className="ti ti-hand-click" aria-hidden="true" />
                Seleziona un conto per vedere lo storico
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="row-between" style={{ marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 15 }}>{contoSelezionato.nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{datiConto.righe.length} movimenti</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 500, color: datiConto.saldoFinale >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtEur(datiConto.saldoFinale)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>saldo attuale</div>
                </div>
              </div>

              {datiConto.righe.length === 0 ? (
                <div className="empty">Nessun movimento su questo conto.</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Descrizione</th>
                      <th>Nota</th>
                      <th style={{ textAlign: 'right', color: 'var(--green)' }}>Dare</th>
                      <th style={{ textAlign: 'right', color: 'var(--red)' }}>Avere</th>
                      <th style={{ textAlign: 'right' }}>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datiConto.righe.map((r, i) => (
                      <tr key={i} style={{ cursor: 'pointer' }} onClick={() => navigate('nuova', { editId: r.movimentoId })}>
                        <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: 12 }}>{r.data}</td>
                        <td style={{ fontSize: 12 }}>{r.descrizione}</td>
                        <td style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{r.nota}</td>
                        <td style={{ textAlign: 'right', color: r.dare > 0 ? 'var(--green)' : 'var(--text-tertiary)', fontSize: 12 }}>{r.dare > 0 ? fmtEur(r.dare) : '—'}</td>
                        <td style={{ textAlign: 'right', color: r.avere > 0 ? 'var(--red)' : 'var(--text-tertiary)', fontSize: 12 }}>{r.avere > 0 ? fmtEur(r.avere) : '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 500, fontSize: 12, color: r.saldo >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtEur(r.saldo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
