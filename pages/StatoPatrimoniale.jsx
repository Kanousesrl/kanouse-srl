import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { calcolaSaldi, fmtEur } from '../lib/contabilita.js'

const ATTIVO = [
  { conto: '__banca', nome: 'Banca c/c principale' },
  { conto: '__cassa', nome: 'Cassa contanti' },
  { conto: '__crediti_clienti', nome: 'Crediti verso clienti' },
  { conto: '__soci_sott', nome: 'Soci c/sottoscrizione' },
  { conto: '__soci_dovuti', nome: 'Soci c/versamenti ancora dovuti' },
  { conto: '__iva_credito', nome: 'IVA a credito' },
  { conto: '__attrezzature', nome: 'Attrezzature' },
]
const PASSIVO = [
  { conto: '__debiti_fornitori', nome: 'Debiti verso fornitori' },
  { conto: '__iva_debito', nome: 'IVA a debito' },
  { conto: '__fondo_tasse', nome: 'Fondo imposte' },
  { conto: '__fondo_contributi', nome: 'Fondo contributi' },
]
const NETTO = [
  { conto: '__capitale_sociale', nome: 'Capitale sociale' },
]

export default function StatoPatrimoniale() {
  const [movimenti, setMovimenti] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('movimenti').select('*').then(({ data }) => {
      setMovimenti(data || [])
      setLoading(false)
    })
  }, [])

  const saldi = calcolaSaldi(movimenti)

  // Conti custom (debiti dipendenti, fondi custom, altri)
  const contiCustom = Object.keys(saldi).filter(k => !k.startsWith('__') && saldi[k] !== 0)

  const ricaviTot = Object.entries(saldi).filter(([k]) => k.includes('ricavi')).reduce((s, [, v]) => s + Math.abs(v), 0)
  const costiTot = Object.entries(saldi).filter(([k]) => k.includes('costi')).reduce((s, [, v]) => s + v, 0)
  const utile = ricaviTot - costiTot

  const totAttivo = ATTIVO.reduce((s, x) => s + (saldi[x.conto] || 0), 0)
  const totPassivo = PASSIVO.reduce((s, x) => s + Math.abs(saldi[x.conto] || 0), 0)
  const totCustomPassivo = contiCustom.reduce((s, k) => s + Math.abs(saldi[k]), 0)
  const totNetto = Math.abs(saldi['__capitale_sociale'] || 0) + utile
  const totPassivoNetto = totPassivo + totCustomPassivo + totNetto
  const diff = Math.abs(totAttivo - totPassivoNetto)
  const bilanciato = diff < 0.5 // tolleranza su conti custom non classificati

  function Voce({ nome, val }) {
    return (
      <div className="cassetto">
        <div className="cassetto-name">{nome}</div>
        <div className="cassetto-value">{fmtEur(Math.abs(val))}</div>
      </div>
    )
  }

  if (loading) return <div className="loading"><i className="ti ti-loader" />Caricamento...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Stato patrimoniale</div>
          <div className="page-subtitle">Situazione al {new Date().toLocaleDateString('it-IT')}</div>
        </div>
        <span className={bilanciato ? 'zero-ok' : 'zero-ko'}>
          {bilanciato ? 'Attivo = Passivo + Netto ✓' : `Differenza: ${fmtEur(diff)}`}
        </span>
      </div>

      <div className="grid-2">
        <div className="card">
          <div style={{ fontWeight: 500, marginBottom: '1rem' }}>Attivo</div>
          {ATTIVO.map(x => <Voce key={x.conto} nome={x.nome} val={saldi[x.conto] || 0} />)}
          <div className="cassetto" style={{ borderTop: '0.5px solid var(--border-strong)', marginTop: 4 }}>
            <div className="cassetto-name" style={{ fontWeight: 500 }}>Totale attivo</div>
            <div className="cassetto-value" style={{ color: 'var(--blue)' }}>{fmtEur(totAttivo)}</div>
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 500, marginBottom: '1rem' }}>Passivo</div>
          {PASSIVO.map(x => <Voce key={x.conto} nome={x.nome} val={saldi[x.conto] || 0} />)}
          {contiCustom.map(k => <Voce key={k} nome={k} val={saldi[k]} />)}

          <hr style={{ margin: '0.75rem 0' }} />
          <div style={{ fontWeight: 500, marginBottom: '0.75rem', fontSize: 13, color: 'var(--text-secondary)' }}>Patrimonio netto</div>
          <Voce nome="Capitale sociale" val={saldi['__capitale_sociale'] || 0} />
          <div className="cassetto">
            <div className="cassetto-name">Utile d'esercizio</div>
            <div className="cassetto-value" style={{ color: utile >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtEur(utile)}</div>
          </div>
          <div className="cassetto" style={{ borderTop: '0.5px solid var(--border-strong)', marginTop: 4 }}>
            <div className="cassetto-name" style={{ fontWeight: 500 }}>Totale passivo + netto</div>
            <div className="cassetto-value" style={{ color: 'var(--blue)' }}>{fmtEur(totPassivoNetto)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
