import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useToast } from '../lib/toast.jsx'
import { fmtEur } from '../lib/contabilita.js'

export default function Modelli({ navigate }) {
  const toast = useToast()
  const [modelli, setModelli] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { carica() }, [])

  async function carica() {
    setLoading(true)
    const { data } = await supabase.from('modelli').select('*').order('nome')
    setModelli(data || [])
    setLoading(false)
  }

  async function elimina(id) {
    if (!confirm('Eliminare questo modello?')) return
    await supabase.from('modelli').delete().eq('id', id)
    toast('Modello eliminato')
    carica()
  }

  if (loading) return <div className="loading"><i className="ti ti-loader" />Caricamento...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Modelli</div>
          <div className="page-subtitle">Scritture predefinite riutilizzabili</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('nuova')}>
          <i className="ti ti-plus" aria-hidden="true" /> Nuova scrittura
        </button>
      </div>

      {modelli.length === 0 ? (
        <div className="card">
          <div className="empty">
            <i className="ti ti-template" aria-hidden="true" />
            <div>Nessun modello salvato.</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Crea una scrittura e clicca "Salva come modello".</div>
          </div>
        </div>
      ) : (
        <div className="grid-2">
          {modelli.map(m => (
            <div className="card" key={m.id}>
              <div className="row-between" style={{ marginBottom: '0.75rem' }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{m.nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    <span className={`badge badge-${m.attivita}`}>{m.attivita === 'wedding' ? 'Wedding' : m.attivita === 'serra' ? 'La Serra' : 'Comune'}</span>
                    <span style={{ marginLeft: 8 }}>{m.tipo?.replace(/_/g, ' ')}</span>
                  </div>
                </div>
                <div className="row">
                  <button className="btn btn-sm btn-success" onClick={() => navigate('nuova', { modelloId: m.id })}>
                    <i className="ti ti-player-play" aria-hidden="true" /> Usa
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => elimina(m.id)}>
                    <i className="ti ti-trash" aria-hidden="true" />
                  </button>
                </div>
              </div>
              {m.descrizione && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{m.descrizione}</div>}
              {m.compensi && (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  Compensi: {m.compensi.map(c => `${c.nome} ${c.importo ? fmtEur(c.importo) : '—'}`).join(' · ')}
                </div>
              )}
              {m.accantonamenti && m.accantonamenti.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  Accantonamenti: {m.accantonamenti.map(a => `${a.nome} ${a.importo ? fmtEur(a.importo) : '—'}`).join(' · ')}
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>IVA: {m.aliquota}%</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
