import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useToast } from '../lib/toast.jsx'
import { fmtEur } from '../lib/contabilita.js'

const CONTI_SISTEMA = [
  { id: '__fondo_contributi', nome: 'Fondo contributi', tipo: 'fondo_accantonamento' },
  { id: '__fondo_tasse', nome: 'Fondo imposte', tipo: 'fondo_accantonamento' },
  { id: '__iva_credito', nome: 'IVA a credito', tipo: 'attivo' },
  { id: '__iva_debito', nome: 'IVA a debito', tipo: 'passivo' },
  { id: '__costi_personale', nome: 'Costi del personale', tipo: 'costo' },
  { id: '__costi_acquisti', nome: 'Acquisti e forniture', tipo: 'costo' },
  { id: '__costi_accantonamenti', nome: 'Accantonamenti', tipo: 'costo' },
  { id: '__debiti_fornitori', nome: 'Debiti verso fornitori', tipo: 'passivo' },
]

function valutaRighe(voci, netto) {
  const ctx = { netto: netto || 0 }
  return voci.map(v => {
    let base = 0
    try {
      let expr = (v.base || '0').trim().toLowerCase()
      Object.entries(ctx).forEach(([k, val]) => {
        expr = expr.replace(new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), String(val))
      })
      if (/^[0-9+\-*/.() ]+$/.test(expr)) {
        base = Function(`"use strict"; return (${expr})`)()
      }
    } catch { base = 0 }
    const perc = parseFloat(v.percentuale) || 0
    const risultato = Math.round(base * perc) / 100
    const chiave = (v.nome || '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    if (chiave) ctx[chiave] = risultato
    return { ...v, baseCalcolata: Math.round(base * 100) / 100, risultato, chiave }
  })
}

function RigaVoce({ v, i, voci, onChange, onRemove, tuttiConti }) {
  const suggerimenti = ['netto', ...voci.slice(0, i).map(x =>
    (x.nome || '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')).filter(Boolean)]

  const gruppi = ['disponibilita', 'attivo', 'passivo', 'fondo_accantonamento', 'costo']
  const labels = { disponibilita: 'Disponibilità', attivo: 'Attivo', passivo: 'Passivo', fondo_accantonamento: 'Fondi', costo: 'Costi' }

  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', padding: '10px 12px', marginBottom: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 32px', gap: 8, marginBottom: 8, alignItems: 'end' }}>
        <div>
          <label>Nome voce</label>
          <input type="text" value={v.nome || ''} onChange={e => onChange(i, 'nome', e.target.value)} placeholder="es. INPS datore" />
        </div>
        <div>
          <label>Base di calcolo</label>
          <input type="text" value={v.base || ''} onChange={e => onChange(i, 'base', e.target.value)}
            placeholder="es. netto * 0.75" list={`sug-${i}`} />
          <datalist id={`sug-${i}`}>{suggerimenti.map(s => <option key={s} value={s} />)}</datalist>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>Variabili: {suggerimenti.join(', ')}</div>
        </div>
        <div>
          <label>% aliquota</label>
          <input type="number" value={v.percentuale || ''} onChange={e => onChange(i, 'percentuale', e.target.value)} placeholder="0" step="0.01" />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button className="btn btn-sm btn-danger" onClick={() => onRemove(i)} aria-label="Rimuovi"><i className="ti ti-x" aria-hidden="true" /></button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <label>Conto di destinazione (accantonamento/IVA)</label>
          <select value={v.contoDest || ''} onChange={e => onChange(i, 'contoDest', e.target.value)}>
            <option value="">Nessuno (solo calcolo)</option>
            {gruppi.map(cat => {
              const voci = tuttiConti.filter(c => c.tipo === cat)
              if (!voci.length) return null
              return (
                <optgroup key={cat} label={labels[cat] || cat}>
                  {voci.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </optgroup>
              )
            })}
          </select>
        </div>
        <div>
          <label>Note</label>
          <input type="text" value={v.note || ''} onChange={e => onChange(i, 'note', e.target.value)} placeholder="Nota opzionale" />
        </div>
      </div>
    </div>
  )
}

export default function Regimi() {
  const toast = useToast()
  const [regimi, setRegimi] = useState([])
  const [mastrini, setMastrini] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ nome: '', note: '', voci: [] })
  const [saving, setSaving] = useState(false)
  const [nettoTest, setNettoTest] = useState('1000')

  useEffect(() => { carica() }, [])

  async function carica() {
    setLoading(true)
    const [{ data: reg }, { data: mast }] = await Promise.all([
      supabase.from('regimi').select('*').order('nome'),
      supabase.from('mastrini').select('*').order('nome'),
    ])
    setRegimi(reg || [])
    setMastrini(mast || [])
    setLoading(false)
  }

  const tuttiConti = [...CONTI_SISTEMA, ...mastrini.map(m => ({ id: String(m.id), nome: m.nome, tipo: m.tipo }))]

  const nettoNum = parseFloat(nettoTest) || 0
  const righeCalcolate = valutaRighe(form.voci, nettoNum)
  const totaleCaricoAzienda = righeCalcolate.reduce((s, r) => s + r.risultato, 0)
  const percentualeTotale = nettoNum > 0 ? Math.round(totaleCaricoAzienda / nettoNum * 10000) / 100 : 0

  function aggiornaVoce(i, field, val) {
    const n = [...form.voci]; n[i] = { ...n[i], [field]: val }; setForm({ ...form, voci: n })
  }
  function rimuoviVoce(i) { setForm({ ...form, voci: form.voci.filter((_, j) => j !== i) }) }
  function aggiungiVoce() { setForm({ ...form, voci: [...form.voci, { nome: '', base: 'netto', percentuale: '', contoDest: '__fondo_contributi', note: '' }] }) }
  function sposta(i, dir) {
    const n = [...form.voci]; const j = i + dir
    if (j < 0 || j >= n.length) return
    ;[n[i], n[j]] = [n[j], n[i]]; setForm({ ...form, voci: n })
  }

  function apriNuovo() {
    setEditId(null)
    setForm({ nome: '', note: '', voci: [{ nome: 'INPS datore', base: 'netto', percentuale: '13.23', contoDest: '__fondo_contributi', note: '' }] })
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
    const payload = { nome: form.nome, note: form.note || null, voci: form.voci, percentuale_totale: percentualeTotale }
    let error
    if (editId) { ;({ error } = await supabase.from('regimi').update(payload).eq('id', editId)) }
    else { ;({ error } = await supabase.from('regimi').insert([payload])) }
    setSaving(false)
    if (error) { toast('Errore: ' + error.message); return }
    toast(editId ? 'Regime aggiornato' : 'Regime creato')
    setShowModal(false)
    carica()
  }

  async function elimina(id) {
    if (!confirm('Eliminare?')) return
    await supabase.from('regimi').delete().eq('id', id)
    toast('Eliminato'); carica()
  }

  function nomeContoDest(id) {
    return tuttiConti.find(c => String(c.id) === String(id))?.nome || '—'
  }

  if (loading) return <div className="loading"><i className="ti ti-loader" />Caricamento...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Regimi contrattuali</div>
          <div className="page-subtitle">Tabelle di calcolo per contributi, ritenute e IVA</div>
        </div>
        <button className="btn btn-primary" onClick={apriNuovo}>
          <i className="ti ti-plus" aria-hidden="true" /> Nuovo regime
        </button>
      </div>

      <div className="info-box" style={{ marginBottom: '1.5rem' }}>
        Ogni voce ha un <strong>conto di destinazione</strong> — scegli <em>Fondo contributi</em> per i contributi, <em>IVA a credito</em> per le fatture dei collaboratori, <em>Fondo imposte</em> per le ritenute. La scrittura contabile verrà generata automaticamente con i conti giusti.
      </div>

      {regimi.length === 0 ? (
        <div className="card"><div className="empty"><i className="ti ti-users-group" aria-hidden="true" /><div>Nessun regime.</div><button className="btn btn-primary" style={{ marginTop: 12 }} onClick={apriNuovo}>Crea primo regime</button></div></div>
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
                <table>
                  <thead><tr><th>Voce</th><th>Base</th><th style={{ textAlign: 'right' }}>Base (su €1.000)</th><th style={{ textAlign: 'right' }}>%</th><th style={{ textAlign: 'right' }}>Risultato</th><th>Destinazione</th></tr></thead>
                  <tbody>
                    {righe.map((v, i) => (
                      <tr key={i}>
                        <td>{v.nome}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{v.base}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{fmtEur(v.baseCalcolata)}</td>
                        <td style={{ textAlign: 'right' }}>{v.percentuale}%</td>
                        <td style={{ textAlign: 'right', fontWeight: 500, color: 'var(--amber)' }}>{fmtEur(v.risultato)}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v.contoDest ? nomeContoDest(v.contoDest) : '—'}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: '0.5px solid var(--border-strong)' }}>
                      <td colSpan={4} style={{ fontWeight: 500 }}>Totale (su €1.000)</td>
                      <td style={{ textAlign: 'right', fontWeight: 500, color: 'var(--amber)' }}>{fmtEur(tot)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ width: 820, maxWidth: '98vw' }}>
            <div className="modal-header">
              <span className="modal-title">{editId ? 'Modifica regime' : 'Nuovo regime'}</span>
              <button className="btn btn-sm" onClick={() => setShowModal(false)} aria-label="Chiudi"><i className="ti ti-x" aria-hidden="true" /></button>
            </div>
            <div className="form-row form-row-2" style={{ marginBottom: '0.75rem' }}>
              <div><label>Nome regime</label><input type="text" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="es. Fattura collaboratore" autoFocus /></div>
              <div><label>Note</label><input type="text" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Descrizione opzionale" /></div>
            </div>
            <hr />
            <div className="row-between" style={{ marginBottom: '0.75rem' }}>
              <span style={{ fontWeight: 500 }}>Voci di calcolo</span>
              <button className="btn btn-sm" onClick={aggiungiVoce}><i className="ti ti-plus" aria-hidden="true" /> Aggiungi voce</button>
            </div>
            <div style={{ marginLeft: 32 }}>
              {form.voci.map((v, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: -28, top: 28, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <button className="btn btn-sm" style={{ padding: '2px 4px' }} onClick={() => sposta(i, -1)} disabled={i === 0}><i className="ti ti-chevron-up" style={{ fontSize: 11 }} aria-hidden="true" /></button>
                    <button className="btn btn-sm" style={{ padding: '2px 4px' }} onClick={() => sposta(i, 1)} disabled={i === form.voci.length - 1}><i className="ti ti-chevron-down" style={{ fontSize: 11 }} aria-hidden="true" /></button>
                  </div>
                  <RigaVoce v={v} i={i} voci={form.voci} onChange={aggiornaVoce} onRemove={rimuoviVoce} tuttiConti={tuttiConti} />
                </div>
              ))}
            </div>
            <hr />
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
                  <thead><tr><th>Voce</th><th style={{ fontFamily: 'monospace', fontSize: 11 }}>Base</th><th style={{ textAlign: 'right' }}>Base calc.</th><th style={{ textAlign: 'right' }}>%</th><th style={{ textAlign: 'right' }}>Risultato</th><th>Destinazione</th></tr></thead>
                  <tbody>
                    {righeCalcolate.map((v, i) => (
                      <tr key={i}>
                        <td style={{ fontSize: 13 }}>{v.nome || `Voce ${i + 1}`}</td>
                        <td style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{v.base}</td>
                        <td style={{ textAlign: 'right', fontSize: 13 }}>{fmtEur(v.baseCalcolata)}</td>
                        <td style={{ textAlign: 'right', fontSize: 13 }}>{v.percentuale}%</td>
                        <td style={{ textAlign: 'right', fontWeight: 500, color: 'var(--amber)', fontSize: 13 }}>{fmtEur(v.risultato)}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v.contoDest ? tuttiConti.find(c => String(c.id) === String(v.contoDest))?.nome || '—' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '0.5px solid var(--border-strong)' }}>
                      <td colSpan={3} style={{ fontWeight: 500, fontSize: 13 }}>Totale a carico azienda</td>
                      <td style={{ textAlign: 'right', fontWeight: 500, color: 'var(--amber)', fontSize: 13 }}>{percentualeTotale}%</td>
                      <td style={{ textAlign: 'right', fontWeight: 500, color: 'var(--amber)', fontSize: 15 }}>{fmtEur(totaleCaricoAzienda)}</td>
                      <td />
                    </tr>
                    <tr>
                      <td colSpan={3} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Costo totale (netto + oneri)</td>
                      <td /><td style={{ textAlign: 'right', fontWeight: 500, fontSize: 13 }}>{fmtEur(nettoNum + totaleCaricoAzienda)}</td><td />
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
