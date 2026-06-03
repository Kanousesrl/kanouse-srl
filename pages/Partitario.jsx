import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { fmtEur } from '../lib/contabilita.js'
import { useToast } from '../lib/toast.jsx'

export default function Partitario({ navigate }) {
  const toast = useToast()
  const [movimenti, setMovimenti] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroAttivita, setFiltroAttivita] = useState('tutti')
  const [filtroTipo, setFiltroTipo] = useState('tutti')
  const [espanso, setEspanso] = useState(null)

  useEffect(() => { carica() }, [])

  async function carica() {
    setLoading(true)
    const { data } = await supabase.from('movimenti').select('*').order('data', { ascending: false }).order('created_at', { ascending: false })
    setMovimenti(data || [])
    setLoading(false)
  }

  async function elimina(id) {
    if (!confirm('Eliminare questo movimento? Non è reversibile.')) return
    const { error } = await supabase.from('movimenti').delete().eq('id', id)
    if (error) { toast('Errore: ' + error.message); return }
    toast('Movimento eliminato')
    carica()
  }

  const filtered = movimenti.filter(m => {
    if (filtroAttivita !== 'tutti' && m.attivita !== filtroAttivita) return false
    if (filtroTipo !== 'tutti' && m.tipo !== filtroTipo) return false
    return true
  })

  const tipiUsati = [...new Set(movimenti.map(m => m.tipo))]

  if (loading) return <div className="loading"><i className="ti ti-loader" />Caricamento...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Partitario</div>
          <div className="page-subtitle">{filtered.length} movimenti</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('nuova')}>
          <i className="ti ti-plus" aria-hidden="true" /> Nuova scrittura
        </button>
      </div>

      <div className="row" style={{ marginBottom: '1rem', flexWrap: 'wrap' }}>
        <select value={filtroAttivita} onChange={e => setFiltroAttivita(e.target.value)} style={{ width: 160 }}>
          <option value="tutti">Tutte le attività</option>
          <option value="wedding">Wedding</option>
          <option value="serra">La Serra</option>
          <option value="comune">Comune</option>
        </select>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={{ width: 200 }}>
          <option value="tutti">Tutti i tipi</option>
          {tipiUsati.map(t => <option key={t} value={t}>{t?.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty">
            <i className="ti ti-list-details" aria-hidden="true" />
            Nessun movimento trovato.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 28 }}></th>
                <th>Data</th>
                <th>Descrizione</th>
                <th>Tipo</th>
                <th>Attività</th>
                <th style={{ textAlign: 'right' }}>Imponibile</th>
                <th style={{ textAlign: 'right' }}>IVA</th>
                <th style={{ width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <>
                  <tr key={m.id} style={{ cursor: 'pointer' }} onClick={() => setEspanso(espanso === m.id ? null : m.id)}>
                    <td>
                      <i className={`ti ${espanso === m.id ? 'ti-chevron-down' : 'ti-chevron-right'}`} style={{ fontSize: 12, color: 'var(--text-tertiary)' }} aria-hidden="true" />
                    </td>
                    <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{m.data}</td>
                    <td>{m.descrizione || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.tipo?.replace(/_/g, ' ')}</td>
                    <td><span className={`badge badge-${m.attivita}`}>{m.attivita === 'wedding' ? 'Wedding' : m.attivita === 'serra' ? 'La Serra' : 'Comune'}</span></td>
                    <td style={{ textAlign: 'right' }}>{fmtEur(m.importo)}</td>
                    <td style={{ textAlign: 'right', color: m.iva > 0 ? 'var(--amber)' : 'var(--text-tertiary)' }}>{m.iva > 0 ? fmtEur(m.iva) : '—'}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="row">
                        <button className="btn btn-sm" onClick={() => navigate('nuova', { editId: m.id })} aria-label="Modifica">
                          <i className="ti ti-edit" aria-hidden="true" />
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => elimina(m.id)} aria-label="Elimina">
                          <i className="ti ti-trash" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {espanso === m.id && (
                    <tr key={`${m.id}-det`}>
                      <td colSpan={8} style={{ background: 'var(--bg-secondary)', padding: '12px 16px' }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Scrittura contabile</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', gap: 4 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Conto</span>
                          <span style={{ fontSize: 11, color: 'var(--green)', textAlign: 'right' }}>Dare</span>
                          <span style={{ fontSize: 11, color: 'var(--red)', textAlign: 'right' }}>Avere</span>
                          {(m.righe || []).map((r, i) => (
                            <>
                              <span key={`c${i}`} style={{ fontSize: 12 }}>{r.conto}{r.nota ? ` — ${r.nota}` : ''}</span>
                              <span key={`d${i}`} style={{ fontSize: 12, color: r.dare > 0 ? 'var(--green)' : 'var(--text-tertiary)', textAlign: 'right' }}>{r.dare > 0 ? fmtEur(r.dare) : '—'}</span>
                              <span key={`a${i}`} style={{ fontSize: 12, color: r.avere > 0 ? 'var(--red)' : 'var(--text-tertiary)', textAlign: 'right' }}>{r.avere > 0 ? fmtEur(r.avere) : '—'}</span>
                            </>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="card card-sm" style={{ marginTop: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', fontSize: 13 }}>
            <div>
              <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>Totale imponibile</div>
              <div style={{ fontWeight: 500 }}>{fmtEur(filtered.reduce((s, m) => s + (m.importo || 0), 0))}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>Totale IVA</div>
              <div style={{ fontWeight: 500, color: 'var(--amber)' }}>{fmtEur(filtered.reduce((s, m) => s + (m.iva || 0), 0))}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>Totale lordo</div>
              <div style={{ fontWeight: 500 }}>{fmtEur(filtered.reduce((s, m) => s + (m.importo || 0) + (m.iva || 0), 0))}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
