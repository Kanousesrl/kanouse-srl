import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useToast } from '../lib/toast.jsx'
import { fmtEur } from '../lib/contabilita.js'

// Valuta una riga dato il contesto delle righe precedenti e il netto
function valutaRighe(voci, netto) {
  const ctx = { netto: netto || 0 }
  return voci.map(v => {
    let base = 0
    try {
      // base può essere: "netto", nome di una voce precedente, o espressione tipo "netto * 0.75"
      // Sostituiamo i nomi noti con i loro valori
      let expr = (v.base || '0').trim().toLowerCase()
      // Sostituisci riferimenti a variabili con i loro valori
      Object.entries(ctx).forEach(([k, val]) => {
        // Sostituisce il nome esatto (non dentro parole più lunghe)
        expr = expr.replace(new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), String(val))
      })
      // Permetti solo numeri, operatori matematici e spazi
      if (/^[0-9+\-*/.() ]+$/.test(expr)) {
        // eslint-disable-next-line no-new-func
        base = Function(`"use strict"; return (${expr})`)()
      }
    } catch { base = 0 }
    const perc = parseFloat(v.percentuale) || 0
    const risultato = Math.round(base * perc) / 100
    // Aggiungi questa voce al contesto (nome normalizzato senza spazi)
    const chiave = (v.nome || '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    if (chiave) ctx[chiave] = risultato
    ctx[`voce_${Object.keys(ctx).length}`] = risultato
    return { ...v, baseCalcolata: Math.round(base * 100) / 100, risultato, chiave }
  })
}

function RigaVoce({ v, i, voci, onChange, onRemove, netto }) {
  // Suggerimenti per la base: netto + nomi delle voci precedenti
  const suggerimenti = ['netto', ...voci.slice(0, i).map(x => (x.nome || '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')).filter(Boolean)]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 1fr 32px', gap: 8, marginBottom: 8, alignItems: 'start' }}>
      <div>
        {i === 0 && <label>Nome voce</label>}
        <input type="text" value={v.nome || ''} onChange={e => onChange(i, 'nome', e.target.value)} placeholder="es. INPS datore" />
      </div>
      <div>
        {i === 0 && <label>Base di calcolo</label>}
        <input
          type="text"
          value={v.base || ''}
          onChange={e => onChange(i, 'base', e.target.value)}
          placeholder="es. netto * 0.75"
          list={`sug-${i}`}
        />
        <datalist id={`sug-${i}`}>
          {suggerimenti.map(s => <option key={s} value={s} />)}
        </datalist>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
          Variabili: {suggerimenti.join(', ')}
        </div>
      </div>
      <div>
        {i === 0 && <label>% aliquota</label>}
        <input type="number" value={v.percentuale || ''} onChange={e => onChange(i, 'percentuale', e.target.value)} placeholder="0" step="0.01" />
      </div>
      <div>
        {i === 0 && <label>Note</label>}
        <input type="text" value={v.note || ''} onChange={e => onChange(i, 'note', e.target.value)} placeholder="Nota opzionale" />
      </div>
      <div style={{ display: 'flex', alignItems: i === 0 ? 'flex-end' : 'center', paddingTop: i === 0 ? 0 : 0 }}>
        <button className="btn btn-sm btn-danger" onClick={() => onRemove(i)} aria-label="Rimuovi"><i className="ti ti-x" aria-hidden="true" /></button>
      </div>
    </div>
  )
}

export default function Regimi() {
  const toast = useToast()
  const [regimi, setRegimi] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ nome: '', note: '', voci: [] })
  const [saving, setSaving] = useState(false)
  const [nettoTest, setNettoTest] = useState('1000')

  useEffect(() => { carica() }, [])

  async function carica() {
    setLoading(true)
    const { data } = await supabase.from('regimi').select('*').order('nome')
    setRegimi(data || [])
    setLoading(false)
  }

  const nettoNum = parseFloat(nettoTest) || 0
  const righeCalcolate = valutaRighe(form.voci, nettoNum)
  const totaleCaricoAzienda = righeCalcolate.reduce((s, r) => s + r.risultato, 0)
  const percentualeTotale = nettoNum > 0 ? Math.round(totaleCaricoAzienda / nettoNum * 10000) / 100 : 0

  function aggiornaVoce(i, field, val) {
    const n = [...form.voci]
    n[i] = { ...n[i], [field]: val }
    setForm({ ...form, voci: n })
  }

  function rimuoviVoce(i) {
    setForm({ ...form, voci: form.voci.filter((_, j) => j !== i) })
  }

  function aggiungiVoce() {
    setForm({ ...form, voci: [...form.voci, { nome: '', base: 'netto', percentuale: '', note: '' }] })
  }

  function sposta(i, dir) {
    const n = [...form.voci]
    const j = i + dir
    if (j < 0 || j >= n.length) return
    ;[n[i], n[j]] = [n[j], n[i]]
    setForm({ ...form, voci: n })
  }

  function apriNuovo() {
    setEditId(null)
    setForm({ nome: '', note: '', voci: [{ nome: 'INPS datore', base: 'netto', percentuale: '13.23', note: '' }] })
    setShowModal(true)
  }

  function apriModifica(r) {
    setEditId(r.id)
    setForm({ nome: r.nome, note: r.note || '', voci: r.voci || [] })
    setShowModal(true)
  }

  async function salva() {
    if (!form.nome.trim()) return toast('Inserisci un nome')
    setSaving(true)
    const payload = {
      nome: form.nome,
      note: form.note || null,
      voci: form.voci,
      percentuale_totale: percentualeTotale,
    }
    let error
    if (editId) {
      ;({ error } = await supabase.from('regimi').update(payload).eq('id', editId))
    } else {
      ;({ error } = await supabase.from('regimi').insert([payload]))
    }
    setSaving(false)
    if (error) { toast('Errore: ' + error.message); return }
    toast(editId ? 'Regime aggiornato' : 'Regime creato')
    setShowModal(false)
    carica()
  }

  async function elimina(id) {
    if (!confirm('Eliminare?')) return
    await supabase.from('regimi').delete().eq('id', id)
    toast('Eliminato')
    carica()
  }

  if (loading) return <div className="loading"><i className="ti ti-loader" />Caricamento...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Regimi contrattuali</div>
          <div className="page-subtitle">Tabelle di calcolo per contributi e ritenute</div>
        </div>
        <button className="btn btn-primary" onClick={apriNuovo}>
          <i className="ti ti-plus" aria-hidden="true" /> Nuovo regime
        </button>
      </div>

      <div className="info-box" style={{ marginBottom: '1.5rem' }}>
        Ogni regime è una tabella di calcolo liberamente componibile. Ogni voce può usare come base <strong>netto</strong> (il compenso inserito), il nome di una voce precedente, o espressioni tipo <code>netto * 0.75</code>. La percentuale totale viene applicata automaticamente in fase di registrazione evento.
      </div>

      {regimi.length === 0 ? (
        <div className="card">
          <div className="empty">
            <i className="ti ti-users-group" aria-hidden="true" />
            <div>Nessun regime configurato.</div>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={apriNuovo}>Crea primo regime</button>
          </div>
        </div>
      ) : (
        <div className="stack">
          {regimi.map(r => {
            const righe = valutaRighe(r.voci || [], 1000)
            const tot = righe.reduce((s, x) => s + x.risultato, 0)
            return (
              <div className="card" key={r.id}>
                <div className="row-between" style={{ marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 15 }}>{r.nome}</div>
                    {r.note && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{r.note}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--amber)' }}>{r.percentuale_totale}%</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>sul netto</div>
                    </div>
                    <div className="row">
                      <button className="btn btn-sm" onClick={() => apriModifica(r)}><i className="ti ti-edit" aria-hidden="true" /> Modifica</button>
                      <button className="btn btn-sm btn-danger" onClick={() => elimina(r.id)}><i className="ti ti-trash" aria-hidden="true" /></button>
                    </div>
                  </div>
                </div>

                {/* Tabella voci */}
                <table>
                  <thead>
                    <tr>
                      <th>Voce</th>
                      <th>Base di calcolo</th>
                      <th style={{ textAlign: 'right' }}>Base (su €1.000)</th>
                      <th style={{ textAlign: 'right' }}>%</th>
                      <th style={{ textAlign: 'right' }}>Risultato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {righe.map((v, i) => (
                      <tr key={i}>
                        <td>{v.nome}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{v.base}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{fmtEur(v.baseCalcolata)}</td>
                        <td style={{ textAlign: 'right' }}>{v.percentuale}%</td>
                        <td style={{ textAlign: 'right', fontWeight: 500, color: 'var(--amber)' }}>{fmtEur(v.risultato)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: '0.5px solid var(--border-strong)' }}>
                      <td colSpan={4} style={{ fontWeight: 500 }}>Totale a carico azienda (su €1.000)</td>
                      <td style={{ textAlign: 'right', fontWeight: 500, color: 'var(--amber)' }}>{fmtEur(tot)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal editor */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ width: 780, maxWidth: '98vw' }}>
            <div className="modal-header">
              <span className="modal-title">{editId ? 'Modifica regime' : 'Nuovo regime'}</span>
              <button className="btn btn-sm" onClick={() => setShowModal(false)} aria-label="Chiudi"><i className="ti ti-x" aria-hidden="true" /></button>
            </div>

            <div className="form-row form-row-2" style={{ marginBottom: '0.75rem' }}>
              <div>
                <label>Nome regime</label>
                <input type="text" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="es. Contratto a chiamata" autoFocus />
              </div>
              <div>
                <label>Note</label>
                <input type="text" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Descrizione opzionale" />
              </div>
            </div>

            <hr />

            {/* Tabella voci */}
            <div className="row-between" style={{ marginBottom: '0.75rem' }}>
              <span style={{ fontWeight: 500 }}>Voci di calcolo</span>
              <button className="btn btn-sm" onClick={aggiungiVoce}>
                <i className="ti ti-plus" aria-hidden="true" /> Aggiungi voce
              </button>
            </div>

            <div className="info-box" style={{ marginBottom: '0.75rem', fontSize: 12 }}>
              <strong>Base di calcolo:</strong> usa <code>netto</code> per il compenso, il nome di una voce precedente (es. <code>imponibile_previdenziale</code>), o espressioni come <code>netto * 0.75</code>, <code>netto - voce_precedente</code>. I nomi vengono normalizzati (spazi → underscore).
            </div>

            {form.voci.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 12 }}>Nessuna voce. Aggiungi la prima con il tasto +</div>
            )}

            {form.voci.map((v, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: -28, top: 20, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button className="btn btn-sm" style={{ padding: '2px 4px' }} onClick={() => sposta(i, -1)} disabled={i === 0} aria-label="Su"><i className="ti ti-chevron-up" style={{ fontSize: 11 }} aria-hidden="true" /></button>
                  <button className="btn btn-sm" style={{ padding: '2px 4px' }} onClick={() => sposta(i, 1)} disabled={i === form.voci.length - 1} aria-label="Giù"><i className="ti ti-chevron-down" style={{ fontSize: 11 }} aria-hidden="true" /></button>
                </div>
                <RigaVoce v={v} i={i} voci={form.voci} onChange={aggiornaVoce} onRemove={rimuoviVoce} netto={nettoNum} />
              </div>
            ))}

            <hr />

            {/* Simulatore */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', padding: '1rem', marginBottom: '1rem' }}>
              <div className="row-between" style={{ marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 500, fontSize: 13 }}>Simulatore</span>
                <div className="row">
                  <label style={{ margin: 0 }}>Compenso netto (€)</label>
                  <input type="number" value={nettoTest} onChange={e => setNettoTest(e.target.value)} style={{ width: 120 }} placeholder="1000" step="0.01" />
                </div>
              </div>

              {form.voci.length > 0 && (
                <table>
                  <thead>
                    <tr>
                      <th>Voce</th>
                      <th style={{ fontFamily: 'monospace', fontSize: 11 }}>Base</th>
                      <th style={{ textAlign: 'right' }}>Base calc.</th>
                      <th style={{ textAlign: 'right' }}>%</th>
                      <th style={{ textAlign: 'right' }}>Risultato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {righeCalcolate.map((v, i) => (
                      <tr key={i}>
                        <td style={{ fontSize: 13 }}>{v.nome || `Voce ${i + 1}`}</td>
                        <td style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{v.base}</td>
                        <td style={{ textAlign: 'right', fontSize: 13 }}>{fmtEur(v.baseCalcolata)}</td>
                        <td style={{ textAlign: 'right', fontSize: 13 }}>{v.percentuale}%</td>
                        <td style={{ textAlign: 'right', fontWeight: 500, color: 'var(--amber)', fontSize: 13 }}>{fmtEur(v.risultato)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '0.5px solid var(--border-strong)' }}>
                      <td colSpan={3} style={{ fontWeight: 500, fontSize: 13 }}>Totale a carico azienda</td>
                      <td style={{ textAlign: 'right', fontWeight: 500, color: 'var(--amber)', fontSize: 13 }}>{percentualeTotale}%</td>
                      <td style={{ textAlign: 'right', fontWeight: 500, color: 'var(--amber)', fontSize: 15 }}>{fmtEur(totaleCaricoAzienda)}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Costo totale (netto + contributi)</td>
                      <td />
                      <td style={{ textAlign: 'right', fontWeight: 500, fontSize: 13 }}>{fmtEur(nettoNum + totaleCaricoAzienda)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowModal(false)}>Annulla</button>
              <button className="btn btn-primary" onClick={salva} disabled={saving}>{saving ? 'Salvataggio...' : editId ? 'Salva modifiche' : 'Crea regime'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
