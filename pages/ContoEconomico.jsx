import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { calcolaSaldi, fmtEur } from '../lib/contabilita.js'

export default function ContoEconomico() {
  const [movimenti, setMovimenti] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('movimenti').select('*').then(({ data }) => {
      setMovimenti(data || [])
      setLoading(false)
    })
  }, [])

  const saldi = calcolaSaldi(movimenti)

  const ricaviVoci = Object.entries(saldi).filter(([k]) => k.includes('ricavi')).map(([k, v]) => ({ nome: k.replace('__ricavi_', 'Ricavi ').replace('_', ' '), val: Math.abs(v) }))
  const costiVoci = Object.entries(saldi).filter(([k]) => k.includes('costi')).map(([k, v]) => ({ nome: k.replace('__costi_', 'Costi ').replace('_', ' '), val: v }))

  const totRicavi = ricaviVoci.reduce((s, x) => s + x.val, 0)
  const totCosti = costiVoci.reduce((s, x) => s + x.val, 0)
  const utile = totRicavi - totCosti
  const margine = totRicavi > 0 ? (utile / totRicavi * 100) : 0

  if (loading) return <div className="loading"><i className="ti ti-loader" />Caricamento...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Conto economico</div>
          <div className="page-subtitle">Esercizio {new Date().getFullYear()}</div>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
        <div className="metric"><div className="metric-label">Totale ricavi</div><div className="metric-value green">{fmtEur(totRicavi)}</div></div>
        <div className="metric"><div className="metric-label">Totale costi</div><div className="metric-value red">{fmtEur(totCosti)}</div></div>
        <div className="metric"><div className="metric-label">Risultato netto</div><div className={`metric-value ${utile >= 0 ? 'green' : 'red'}`}>{fmtEur(utile)}</div></div>
        <div className="metric"><div className="metric-label">Margine</div><div className={`metric-value ${margine >= 0 ? 'green' : 'red'}`}>{margine.toFixed(1)}%</div></div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div style={{ fontWeight: 500, marginBottom: '1rem', color: 'var(--green)' }}>Ricavi</div>
          {ricaviVoci.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Nessun ricavo registrato.</div>}
          {ricaviVoci.map((x, i) => (
            <div className="cassetto" key={i}>
              <div className="cassetto-name">{x.nome}</div>
              <div className="cassetto-value" style={{ color: 'var(--green)' }}>{fmtEur(x.val)}</div>
            </div>
          ))}
          <div className="cassetto" style={{ borderTop: '0.5px solid var(--border-strong)', marginTop: 4 }}>
            <div className="cassetto-name" style={{ fontWeight: 500 }}>Totale ricavi</div>
            <div className="cassetto-value" style={{ color: 'var(--green)' }}>{fmtEur(totRicavi)}</div>
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 500, marginBottom: '1rem', color: 'var(--red)' }}>Costi</div>
          {costiVoci.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Nessun costo registrato.</div>}
          {costiVoci.map((x, i) => (
            <div className="cassetto" key={i}>
              <div className="cassetto-name">{x.nome}</div>
              <div className="cassetto-value" style={{ color: 'var(--red)' }}>{fmtEur(x.val)}</div>
            </div>
          ))}
          <div className="cassetto" style={{ borderTop: '0.5px solid var(--border-strong)', marginTop: 4 }}>
            <div className="cassetto-name" style={{ fontWeight: 500 }}>Totale costi</div>
            <div className="cassetto-value" style={{ color: 'var(--red)' }}>{fmtEur(totCosti)}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: 15 }}>Risultato d'esercizio</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{utile >= 0 ? 'Utile' : 'Perdita'} — margine {margine.toFixed(1)}%</div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 500, color: utile >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtEur(utile)}</div>
        </div>
      </div>
    </div>
  )
}
