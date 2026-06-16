import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { calcolaSaldi, fmtEur } from '../lib/contabilita.js'

export default function Dashboard({ navigate }) {
  const [movimenti, setMovimenti] = useState([])
  const [mastrini, setMastrini] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { carica() }, [])

  async function carica() {
    setLoading(true)
    const [{ data: mov }, { data: mast }] = await Promise.all([
      supabase.from('movimenti').select('*').order('data', { ascending: false }),
      supabase.from('mastrini').select('*'),
    ])
    setMovimenti(mov || [])
    setMastrini(mast || [])
    setLoading(false)
  }

  const saldi = calcolaSaldi(movimenti)

  const banca = (saldi['__banca'] || 0) + (saldi['__cassa'] || 0)
  const ivaDebito = Math.abs(saldi['__iva_debito'] || 0)
  const ivaCredito = Math.abs(saldi['__iva_credito'] || 0)
  const ivaNetta = ivaDebito - ivaCredito
  const fondoTasse = saldi['__fondo_tasse'] || 0
  const fondoContributi = saldi['__fondo_contributi'] || 0

  // Debiti verso dipendenti/collaboratori (mastrini custom tipo debito_dipendente)
  const idDebitiDipendenti = mastrini.filter(m => m.tipo === 'debito_dipendente').map(m => String(m.id))
  const totDebitiDipendenti = idDebitiDipendenti.reduce((s, id) => s + Math.abs(saldi[id] || 0), 0)

  // Tutti i fondi accantonamento (di sistema + custom)
  const idFondiCustom = mastrini.filter(m => m.tipo === 'fondo_accantonamento').map(m => String(m.id))
  const totFondiCustom = idFondiCustom.reduce((s, id) => s + Math.abs(saldi[id] || 0), 0)
  const totFondi = Math.abs(fondoTasse) + Math.abs(fondoContributi) + totFondiCustom

  // Liquidità disponibile = Banca+Cassa - Debiti dipendenti - Fondi - (IVA debito - IVA credito)
  const liquiditaDisponibile = banca - totDebitiDipendenti - totFondi - ivaNetta

  // Ricavi e costi
  const ricaviTot = Object.entries(saldi).filter(([k]) => k.includes('ricavi')).reduce((s, [, v]) => s + Math.abs(v), 0)
  const costiTot = Object.entries(saldi).filter(([k]) => k.includes('costi')).reduce((s, [, v]) => s + v, 0)
  const utile = ricaviTot - costiTot

  // Sigma check
  let sigma = 0
  Object.entries(saldi).forEach(([, v]) => { sigma += v })
  const balanced = Math.abs(sigma) < 0.01

  const ultimi = movimenti.slice(0, 8)

  if (loading) return <div className="loading"><i className="ti ti-loader" />Caricamento...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">Esercizio {new Date().getFullYear()}</div>
        </div>
        <div className={balanced ? 'zero-ok' : 'zero-ko'}>
          {balanced ? 'Σ = 0 ✓' : 'Σ ≠ 0 ⚠'}
        </div>
      </div>

      {/* Card Liquidità disponibile */}
      <div className="card" style={{ marginBottom: '1.5rem', background: 'var(--bg-secondary)' }}>
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 4 }}>Liquidità disponibile</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Banca + Cassa − Debiti collaboratori − Fondi accantonamento − Saldo IVA
            </div>
          </div>
          <div style={{ fontSize: 32, fontWeight: 500, color: liquiditaDisponibile >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {fmtEur(liquiditaDisponibile)}
          </div>
        </div>
        <hr style={{ margin: '0.75rem 0' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', fontSize: 13 }}>
          <div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>Banca + Cassa</div>
            <div style={{ fontWeight: 500, color: 'var(--green)' }}>{fmtEur(banca)}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>Debiti collaboratori</div>
            <div style={{ fontWeight: 500, color: 'var(--red)' }}>− {fmtEur(totDebitiDipendenti)}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>Fondi accantonamento</div>
            <div style={{ fontWeight: 500, color: 'var(--amber)' }}>− {fmtEur(totFondi)}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>Saldo IVA (debito-credito)</div>
            <div style={{ fontWeight: 500, color: ivaNetta > 0 ? 'var(--red)' : 'var(--green)' }}>
              {ivaNetta > 0 ? '− ' : '+ '}{fmtEur(Math.abs(ivaNetta))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
        <div className="metric">
          <div className="metric-label">Liquidità totale (banca)</div>
          <div className={`metric-value ${banca >= 0 ? 'green' : 'red'}`}>{fmtEur(banca)}</div>
        </div>
        <div className="metric">
          <div className="metric-label">IVA netta a debito</div>
          <div className={`metric-value ${ivaNetta > 0 ? 'amber' : 'green'}`}>{fmtEur(ivaNetta)}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Fondi accantonati</div>
          <div className="metric-value amber">{fmtEur(totFondi)}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Risultato d'esercizio</div>
          <div className={`metric-value ${utile >= 0 ? 'green' : 'red'}`}>{fmtEur(utile)}</div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div style={{ fontWeight: 500, marginBottom: '1rem' }}>Disponibilità e crediti</div>
          {[
            { conto: '__banca', icon: 'ti-building-bank', color: 'var(--green)', nome: 'Banca c/c principale' },
            { conto: '__cassa', icon: 'ti-cash', color: 'var(--green)', nome: 'Cassa contanti' },
            { conto: '__crediti_clienti', icon: 'ti-file-invoice', color: 'var(--blue)', nome: 'Crediti verso clienti' },
            { conto: '__soci_sott', icon: 'ti-users', color: 'var(--amber)', nome: 'Soci c/sottoscrizione' },
            { conto: '__attrezzature', icon: 'ti-tool', color: 'var(--text-secondary)', nome: 'Attrezzature' },
            { conto: '__iva_credito', icon: 'ti-receipt-tax', color: 'var(--green)', nome: 'IVA a credito' },
          ].map(({ conto, icon, color, nome }) => (
            <div className="cassetto" key={conto}>
              <div className="cassetto-name">
                <i className={`ti ${icon}`} style={{ color, fontSize: 16 }} aria-hidden="true" />
                {nome}
              </div>
              <div className="cassetto-value" style={{ color }}>{fmtEur(saldi[conto] || 0)}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <div style={{ fontWeight: 500, marginBottom: '1rem' }}>Passivo e fondi</div>
          {[
            { conto: '__debiti_fornitori', icon: 'ti-truck-delivery', color: 'var(--red)', nome: 'Debiti verso fornitori' },
            { conto: '__iva_debito', icon: 'ti-percentage', color: 'var(--red)', nome: 'IVA a debito' },
            { conto: '__fondo_tasse', icon: 'ti-cash', color: 'var(--amber)', nome: 'Fondo imposte' },
            { conto: '__fondo_contributi', icon: 'ti-shield', color: 'var(--amber)', nome: 'Fondo contributi' },
            { conto: '__capitale_sociale', icon: 'ti-building', color: 'var(--purple)', nome: 'Capitale sociale' },
          ].map(({ conto, icon, color, nome }) => (
            <div className="cassetto" key={conto}>
              <div className="cassetto-name">
                <i className={`ti ${icon}`} style={{ color, fontSize: 16 }} aria-hidden="true" />
                {nome}
              </div>
              <div className="cassetto-value" style={{ color }}>{fmtEur(Math.abs(saldi[conto] || 0))}</div>
            </div>
          ))}
          {/* Debiti dipendenti custom */}
          {mastrini.filter(m => m.tipo === 'debito_dipendente' && Math.abs(saldi[String(m.id)] || 0) > 0).map(m => (
            <div className="cassetto" key={m.id}>
              <div className="cassetto-name">
                <i className="ti ti-user-dollar" style={{ color: 'var(--amber)', fontSize: 16 }} aria-hidden="true" />
                {m.nome}
              </div>
              <div className="cassetto-value" style={{ color: 'var(--amber)' }}>{fmtEur(Math.abs(saldi[String(m.id)] || 0))}</div>
            </div>
          ))}
          {/* Fondi accantonamento custom */}
          {mastrini.filter(m => m.tipo === 'fondo_accantonamento' && Math.abs(saldi[String(m.id)] || 0) > 0).map(m => (
            <div className="cassetto" key={m.id}>
              <div className="cassetto-name">
                <i className="ti ti-shield" style={{ color: 'var(--amber)', fontSize: 16 }} aria-hidden="true" />
                {m.nome}
              </div>
              <div className="cassetto-value" style={{ color: 'var(--amber)' }}>{fmtEur(Math.abs(saldi[String(m.id)] || 0))}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="row-between" style={{ marginBottom: '1rem' }}>
          <span style={{ fontWeight: 500 }}>Ultimi movimenti</span>
          <button className="btn btn-sm" onClick={() => navigate('nuova')}>
            <i className="ti ti-plus" aria-hidden="true" /> Nuova scrittura
          </button>
        </div>
        {ultimi.length === 0 ? (
          <div className="empty">
            <i className="ti ti-inbox" aria-hidden="true" />
            <div>Nessun movimento.</div>
            <button className="btn btn-sm" onClick={() => navigate('nuova')} style={{ marginTop: 8 }}>Aggiungi il primo</button>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrizione</th>
                <th>Attività</th>
                <th style={{ textAlign: 'right' }}>Importo</th>
                <th style={{ textAlign: 'right' }}>IVA</th>
              </tr>
            </thead>
            <tbody>
              {ultimi.map(m => (
                <tr key={m.id}>
                  <td style={{ color: 'var(--text-secondary)' }}>{m.data}</td>
                  <td>{m.descrizione}</td>
                  <td>
                    <span className={`badge badge-${m.attivita}`}>
                      {m.attivita === 'wedding' ? 'Wedding' : m.attivita === 'serra' ? 'La Serra' : 'Comune'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>{fmtEur(m.importo)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{m.iva > 0 ? fmtEur(m.iva) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
