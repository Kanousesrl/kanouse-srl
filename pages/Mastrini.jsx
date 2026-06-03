import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useToast } from '../lib/toast.jsx'
import { CATEGORIE_MASTRINO } from '../lib/contabilita.js'

const SISTEMA = [
  { nome: 'Cassa contanti', tipo: 'disponibilita' },
  { nome: 'Banca c/c principale', tipo: 'disponibilita' },
  { nome: 'Crediti verso clienti', tipo: 'attivo' },
  { nome: 'Soci c/sottoscrizione', tipo: 'attivo' },
  { nome: 'Soci c/versamenti ancora dovuti', tipo: 'attivo' },
  { nome: 'IVA a credito', tipo: 'attivo' },
  { nome: 'Attrezzature', tipo: 'attivo' },
  { nome: 'IVA a debito', tipo: 'passivo' },
  { nome: 'Debiti verso fornitori', tipo: 'passivo' },
  { nome: 'Fondo imposte', tipo: 'fondo_accantonamento' },
  { nome: 'Fondo contributi', tipo: 'fondo_accantonamento' },
  { nome: 'Capitale sociale', tipo: 'netto' },
  { nome: 'Ricavi Wedding', tipo: 'ricavo' },
  { nome: 'Ricavi La Serra', tipo: 'ricavo' },
  { nome: 'Costi del personale', tipo: 'costo' },
  { nome: 'Acquisti e forniture', tipo: 'costo' },
  { nome: 'Accantonamenti', tipo: 'costo' },
]

export default function Mastrini() {
  const toast = useToast()
  const [mastrini, setMastrini] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ nome: '', tipo: 'debito_dipendente', note: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { carica() }, [])

  async function carica() {
    setLoading(true)
    const { data } = await supabase.from('mastrini').select('*').order('tipo').order('nome')
    setMastrini(data || [])
    setLoading(false)
  }

  async function salva() {
    if (!form.nome.trim()) return toast('Inserisci un nome')
    setSaving(true)
    let error
    if (editId) {
      ;({ error } = await supabase.from('mastrini').update({ nome: form.nome, tipo: form.tipo, note: form.note || null }).eq('id', editId))
    } else {
      ;({ error } = await supabase.from('mastrini').insert([{ nome: form.nome, tipo: form.tipo, note: form.note || null, sistema: false }]))
    }
    setSaving(false)
    if (error) { toast('Errore: ' + error.message); return }
    toast(editId ? 'Mastrino aggiornato' : 'Mastrino creato')
    setShowModal(false)
    setEditId(null)
    setForm({ nome: '', tipo: 'debito_dipendente', note: '' })
    carica()
  }

  async function elimina(id) {
    if (!confirm('Eliminare questo mastrino?')) return
    await supabase.from('mastrini').delete().eq('id', id)
    toast('Eliminato')
    carica()
  }

  function apriModifica(m) {
    setEditId(m.id)
    setForm({ nome: m.nome, tipo: m.tipo, note: m.note || '' })
    setShowModal(true)
  }

  function apriNuovo() {
    setEditId(null)
    setForm({ nome: '', tipo: 'debito_dipendente', note: '' })
    setShowModal(true)
  }

  const grouped = CATEGORIE_MASTRINO.map(cat => ({
    ...cat,
    voci: mastrini.filter(m => m.tipo === cat.value),
  })).filter(g => g.voci.length > 0)

  if (loading) return <div className="loading"><i className="ti ti-loader" />Caricamento...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Mastrini</div>
          <div className="page-subtitle">Piano dei conti — aggiungi liberamente nuovi conti</div>
        </div>
        <button className="btn btn-primary" onClick={apriNuovo}>
          <i className="ti ti-plus" aria-hidden="true" /> Nuovo mastrino
        </button>
      </div>

      <div className="info-box" style={{ marginBottom: '1.5rem' }}>
        I mastrini sono i conti del piano contabile. Puoi aggiungere liberamente nuovi conti — ad esempio <strong>Debiti v/Alessandro</strong>, <strong>Banca Intesa c/c</strong>, <strong>Fondo furgone</strong> — e usarli in qualsiasi scrittura.
      </div>

      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div style={{ fontWeight: 500, marginBottom: '0.75rem' }}>Conti di sistema</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Creati automaticamente, non modificabili</div>
          <table>
            <thead><tr><th>Nome</th><th>Tipo</th></tr></thead>
            <tbody>
              {SISTEMA.map((m, i) => (
                <tr key={i}>
                  <td>{m.nome}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{CATEGORIE_MASTRINO.find(c => c.value === m.tipo)?.label || m.tipo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          {grouped.length === 0 ? (
            <div className="card">
              <div className="empty">
                <i className="ti ti-folders" aria-hidden="true" />
                <div>Nessun mastrino personalizzato.</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Aggiungi i tuoi conti con il tasto +</div>
                <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={apriNuovo}>
                  <i className="ti ti-plus" aria-hidden="true" /> Aggiungi primo mastrino
                </button>
              </div>
            </div>
          ) : (
            grouped.map(g => (
              <div className="card" key={g.value} style={{ marginBottom: '1rem' }}>
                <div style={{ fontWeight: 500, fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>{g.label}</div>
                <table>
                  <thead><tr><th>Nome</th><th>Note</th><th style={{ width: 80 }}></th></tr></thead>
                  <tbody>
                    {g.voci.map(m => (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 500 }}>{m.nome}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{m.note || '—'}</td>
                        <td>
                          <div className="row">
                            <button className="btn btn-sm" onClick={() => apriModifica(m)} aria-label="Modifica"><i className="ti ti-edit" aria-hidden="true" /></button>
                            <button className="btn btn-sm btn-danger" onClick={() => elimina(m.id)} aria-label="Elimina"><i className="ti ti-trash" aria-hidden="true" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editId ? 'Modifica mastrino' : 'Nuovo mastrino'}</span>
              <button className="btn btn-sm" onClick={() => setShowModal(false)} aria-label="Chiudi"><i className="ti ti-x" aria-hidden="true" /></button>
            </div>
            <div className="form-group">
              <label>Nome</label>
              <input type="text" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="es. Debiti v/Alessandro" autoFocus />
            </div>
            <div className="form-group">
              <label>Tipologia</label>
              <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                {CATEGORIE_MASTRINO.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Note (opzionale)</label>
              <input type="text" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="es. Alessandro Greco, contratto a chiamata" />
            </div>
            <div className="row" style={{ marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowModal(false)}>Annulla</button>
              <button className="btn btn-primary" onClick={salva} disabled={saving}>{saving ? 'Salvataggio...' : editId ? 'Salva modifiche' : 'Crea mastrino'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
