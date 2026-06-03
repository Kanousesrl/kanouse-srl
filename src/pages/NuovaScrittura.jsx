import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { verificaBilancio, fmtEur } from '../lib/contabilita.js'
import { useToast } from '../lib/toast.jsx'

const TIPI_OP = [
  { value: 'evento', label: 'Evento (wedding / La Serra)', icon: 'ti-music' },
  { value: 'corrispettivi', label: 'Corrispettivi giornalieri', icon: 'ti-receipt' },
  { value: 'fattura_emessa', label: 'Fattura emessa', icon: 'ti-file-invoice' },
  { value: 'incasso_fattura', label: 'Incasso fattura cliente', icon: 'ti-cash' },
  { value: 'fattura_ricevuta', label: 'Fattura ricevuta (acquisto)', icon: 'ti-file-download' },
  { value: 'pagamento_fornitore', label: 'Pagamento fornitore', icon: 'ti-truck-delivery' },
  { value: 'pagamento_dipendente', label: 'Pagamento dipendente/collaboratore', icon: 'ti-user-dollar' },
  { value: 'acquisto_attrezzatura', label: 'Acquisto attrezzatura', icon: 'ti-tool' },
  { value: 'capitale_sociale', label: 'Capitale sociale (sottoscrizione/versamento)', icon: 'ti-building' },
  { value: 'acconto_tasse', label: 'Accantonamento tasse', icon: 'ti-percentage' },
  { value: 'utilizzo_fondo', label: 'Utilizzo fondo accantonamento', icon: 'ti-arrow-up-right' },
  { value: 'libera', label: 'Scrittura libera (avanzata)', icon: 'ti-pencil' },
]

const ALIQUOTE = [0, 4, 5, 10, 22]

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

function scorporaIva(lordo, aliquota) {
  if (!aliquota) return { imponibile: lordo, iva: 0 }
  const imponibile = Math.round((lordo / (1 + aliquota / 100)) * 100) / 100
  const iva = Math.round((lordo - imponibile) * 100) / 100
  return { imponibile, iva }
}

function calcolaIva(imponibile, aliquota) {
  return Math.round(imponibile * aliquota) / 100
}

function rigaVuota() { return { conto: '', dare: '', avere: '', nota: '' } }

export default function NuovaScrittura({ navigate, editId: editIdProp }) {
  const toast = useToast()
  const [tipo, setTipo] = useState('evento')
  const [attivita, setAttivita] = useState('wedding')
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [descrizione, setDescrizione] = useState('')
  // Importo principale
  const [importoMode, setImportoMode] = useState('imponibile') // 'imponibile' | 'lordo'
  const [importoInput, setImportoInput] = useState('')
  const [aliquota, setAliquota] = useState(10)
  const [contoLiquidita, setContoLiquidita] = useState('__banca')
  // Compensi
  const [compensi, setCompensi] = useState([
    { nome: 'Alessandro', contoDebito: '', importo: '', regimeId: '' },
    { nome: 'Santino', contoDebito: '', importo: '', regimeId: '' },
    { nome: 'Roberto', contoDebito: '', importo: '', regimeId: '' },
  ])
  // Costi aggiuntivi (con IVA)
  const [costi, setCosti] = useState([])
  // Accantonamenti
  const [accantonamenti, setAccantonamenti] = useState([])
  // Capitale sociale
  const [capTotale, setCapTotale] = useState('12000')
  const [capVersato, setCapVersato] = useState('3000')
  // Scrittura libera
  const [righeLibere, setRigheLibere] = useState([rigaVuota(), rigaVuota()])
  // Dati ausiliari
  const [modelli, setModelli] = useState([])
  const [mastrini, setMastrini] = useState([])
  const [regimi, setRegimi] = useState([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedModello, setSelectedModello] = useState('')
  const [editId, setEditId] = useState(editIdProp || null)

  const tuttiConti = [...CONTI_SISTEMA, ...mastrini.map(m => ({ id: String(m.id), nome: m.nome, tipo: m.tipo }))]

  useEffect(() => { caricaDati() }, [])
  useEffect(() => { if (editIdProp) caricaMovimento(editIdProp) }, [editIdProp])

  async function caricaDati() {
    setLoading(true)
    const [{ data: mod }, { data: mast }, { data: reg }] = await Promise.all([
      supabase.from('modelli').select('*').order('nome'),
      supabase.from('mastrini').select('*').order('nome'),
      supabase.from('regimi').select('*').order('nome'),
    ])
    setModelli(mod || [])
    setMastrini(mast || [])
    setRegimi(reg || [])
    setLoading(false)
  }

  async function caricaMovimento(id) {
    const { data: m } = await supabase.from('movimenti').select('*').eq('id', id).single()
    if (!m) return
    setTipo(m.tipo); setAttivita(m.attivita || 'wedding'); setData(m.data)
    setDescrizione(m.descrizione || ''); setImportoInput(String(m.importo || ''))
    setAliquota(m.aliquota || 0); setContoLiquidita(m.conto_liquidita || '__banca')
    if (m.compensi) setCompensi(m.compensi)
    if (m.costi) setCosti(m.costi)
    if (m.accantonamenti) setAccantonamenti(m.accantonamenti)
    if (m.righe_libere) setRigheLibere(m.righe_libere)
    if (m.cap_totale) setCapTotale(String(m.cap_totale))
    if (m.cap_versato) setCapVersato(String(m.cap_versato))
  }

  async function applicaModello(id) {
    const mod = modelli.find(m => m.id === parseInt(id))
    if (!mod) return
    setTipo(mod.tipo); setAttivita(mod.attivita)
    setDescrizione(mod.descrizione || ''); setAliquota(mod.aliquota || 10)
    if (mod.compensi) setCompensi(mod.compensi)
    if (mod.accantonamenti) setAccantonamenti(mod.accantonamenti)
    if (mod.costi) setCosti(mod.costi)
    toast('Modello applicato')
  }

  // Calcolo importo principale
  const inputVal = parseFloat(importoInput) || 0
  const needsIva = ['evento', 'fattura_emessa', 'fattura_ricevuta', 'corrispettivi', 'acquisto_attrezzatura'].includes(tipo)
  let imp = 0, iva = 0, totLordo = 0
  if (importoMode === 'lordo' && needsIva) {
    const r = scorporaIva(inputVal, aliquota)
    imp = r.imponibile; iva = r.iva; totLordo = inputVal
  } else {
    imp = inputVal; iva = needsIva ? calcolaIva(imp, aliquota) : 0; totLordo = imp + iva
  }

  function regimePerCompenso(c) {
    if (!c.regimeId) return null
    return regimi.find(r => r.id === parseInt(c.regimeId)) || null
  }

  function aliquotaPerCompenso(c) {
    const reg = regimePerCompenso(c)
    return reg ? (reg.percentuale_totale || 21) : 21
  }

  function righeOneriByConto(netto, c) {
    const reg = regimePerCompenso(c)
    if (!reg || !reg.voci?.length) {
      return [{ conto: '__fondo_contributi', importo: Math.round(netto * 21) / 100, nota: 'Contributi azienda ' + c.nome }]
    }
    const ctx = { netto }
    return (reg.voci || []).map(v => {
      let base = 0
      try {
        let expr = (v.base || '0').trim().toLowerCase()
        Object.entries(ctx).forEach(([k, val]) => {
          expr = expr.replace(new RegExp('\b' + k + '\b', 'g'), String(val))
        })
        if (/^[0-9+\-*/.() ]+$/.test(expr)) base = new Function('return (' + expr + ')')()
      } catch { base = 0 }
      const risultato = Math.round(base * (parseFloat(v.percentuale) || 0)) / 100
      const chiave = (v.nome || '').toLowerCase().replace(/s+/g, '_').replace(/[^a-z0-9_]/g, '')
      if (chiave) ctx[chiave] = risultato
      return { conto: v.contoDest || '__fondo_contributi', importo: risultato, nota: (v.nome || 'Onere') + ' ' + c.nome }
    }).filter(r => r.importo > 0 && r.conto)
  }

  const totCompensi = tipo === 'evento' ? compensi.reduce((s, c) => s + (parseFloat(c.importo) || 0), 0) : 0
  const totContributi = tipo === 'evento' ? compensi.reduce((s, c) => {
    const n = parseFloat(c.importo) || 0
    return s + Math.round(n * aliquotaPerCompenso(c)) / 100
  }, 0) : 0

  // Costi con IVA
  const costiCalcolati = costi.map(c => {
    const inputC = parseFloat(c.importo) || 0
    if (c.modeIva === 'lordo' && (parseInt(c.aliquota) || 0) > 0) {
      const r = scorporaIva(inputC, parseInt(c.aliquota) || 0)
      return { ...c, imponibile: r.imponibile, iva: r.iva, totale: inputC }
    }
    const aliq = parseInt(c.aliquota) || 0
    const ivaC = Math.round(inputC * aliq) / 100
    return { ...c, imponibile: inputC, iva: ivaC, totale: inputC + ivaC }
  })
  const totCostiLordi = costiCalcolati.reduce((s, c) => s + c.totale, 0)
  const totAccantonamenti = accantonamenti.reduce((s, a) => s + (parseFloat(a.importo) || 0), 0)
  const cassaFinale = totLordo - iva - totCompensi - totContributi - totCostiLordi - totAccantonamenti

  // Assicura che esista il mastrino per il compenso e ritorna il suo id
  async function assicuraMastrino(nome) {
    if (!nome.trim()) return null
    const nomeM = `Debiti v/${nome.trim()}`
    // Controlla se esiste già
    const { data: existing } = await supabase.from('mastrini').select('id').eq('nome', nomeM).single()
    if (existing) return String(existing.id)
    // Crea nuovo
    const { data: nuovo } = await supabase.from('mastrini').insert([{ nome: nomeM, tipo: 'debito_dipendente', sistema: false }]).select().single()
    return nuovo ? String(nuovo.id) : null
  }

  function contoNome(id) {
    const found = tuttiConti.find(c => String(c.id) === String(id))
    return found ? found.nome : id
  }

  function generaRighe(compensiConConti) {
    const contoLiq = contoLiquidita
    const contoRicavi = attivita === 'serra' ? '__ricavi_serra' : '__ricavi_wedding'

    if (tipo === 'libera') {
      return righeLibere.filter(r => r.conto && (parseFloat(r.dare) > 0 || parseFloat(r.avere) > 0))
        .map(r => ({ conto: r.conto, dare: parseFloat(r.dare) || 0, avere: parseFloat(r.avere) || 0, nota: r.nota || '' }))
    }

    // Capitale sociale — scrittura corretta in 2 fasi
    if (tipo === 'capitale_sociale') {
      const tot = parseFloat(capTotale) || 0
      const vers = parseFloat(capVersato) || 0
      const residuo = tot - vers
      const righe = []
      // Fase 1: Sottoscrizione — Soci c/sottoscrizione (Dare) → Capitale Sociale (Avere)
      righe.push({ conto: '__soci_sott', dare: tot, avere: 0, nota: 'Sottoscrizione capitale' })
      righe.push({ conto: '__capitale_sociale', dare: 0, avere: tot, nota: 'Capitale sociale sottoscritto' })
      // Fase 2: Versamento parziale — Banca (Dare) → Soci c/sottoscrizione (Avere)
      // Il saldo residuo rimane aperto in Soci c/sottoscrizione fino al saldo completo
      if (vers > 0) {
        righe.push({ conto: contoLiq, dare: vers, avere: 0, nota: 'Versamento quota' })
        righe.push({ conto: '__soci_sott', dare: 0, avere: vers, nota: 'Versamento quota' })
      }
      return righe
    }

    const righe = []

    if (tipo === 'evento') {
      righe.push({ conto: contoLiq, dare: totLordo, avere: 0, nota: 'Incasso lordo' })
      if (iva > 0) righe.push({ conto: '__iva_debito', dare: 0, avere: iva, nota: `IVA ${aliquota}%` })
      righe.push({ conto: contoRicavi, dare: 0, avere: imp, nota: 'Ricavo netto' });
      (compensiConConti || compensi).forEach(c => {
        const netto = parseFloat(c.importo) || 0
        if (netto <= 0) return
        const oneri = righeOneriByConto(netto, c)
        // Controlla se il regime prevede IVA (almeno una voce punta a __iva_credito)
        const hasIva = oneri.some(o => o.conto === '__iva_credito')
        if (hasIva) {
          // Regime fattura: Costi personale (imponibile) + IVA a credito + Debiti v/collaboratore (lordo)
          const ivaCollab = oneri.filter(o => o.conto === '__iva_credito').reduce((s, o) => s + o.importo, 0)
          const altriOneri = oneri.filter(o => o.conto !== '__iva_credito')
          const totAltri = altriOneri.reduce((s, o) => s + o.importo, 0)
          righe.push({ conto: '__costi_personale', dare: netto + totAltri, avere: 0, nota: 'Costo ' + c.nome })
          righe.push({ conto: '__iva_credito', dare: ivaCollab, avere: 0, nota: 'IVA fattura ' + c.nome })
          righe.push({ conto: c.contoDebito || '__debiti_fornitori', dare: 0, avere: netto + ivaCollab, nota: 'Debito lordo ' + c.nome })
          altriOneri.forEach(o => righe.push({ conto: o.conto, dare: 0, avere: o.importo, nota: o.nota }))
        } else {
          // Regime standard: Costi personale (netto + oneri) + Debiti v/collaboratore (netto) + fondi oneri
          const totOneri = oneri.reduce((s, o) => s + o.importo, 0)
          righe.push({ conto: '__costi_personale', dare: netto + totOneri, avere: 0, nota: 'Costo ' + c.nome })
          righe.push({ conto: c.contoDebito || '__debiti_fornitori', dare: 0, avere: netto, nota: 'Debito netto ' + c.nome })
          oneri.forEach(o => righe.push({ conto: o.conto, dare: 0, avere: o.importo, nota: o.nota }))
        }
      })
    }
    if (tipo === 'corrispettivi') {
      righe.push({ conto: contoLiq, dare: totLordo, avere: 0, nota: 'Corrispettivi' })
      if (iva > 0) righe.push({ conto: '__iva_debito', dare: 0, avere: iva, nota: `IVA ${aliquota}%` })
      righe.push({ conto: contoRicavi, dare: 0, avere: imp, nota: 'Ricavo netto' })
    }
    if (tipo === 'fattura_emessa') {
      righe.push({ conto: '__crediti_clienti', dare: totLordo, avere: 0, nota: 'Credito verso cliente' })
      if (iva > 0) righe.push({ conto: '__iva_debito', dare: 0, avere: iva, nota: `IVA ${aliquota}%` })
      righe.push({ conto: contoRicavi, dare: 0, avere: imp, nota: 'Ricavo' })
    }
    if (tipo === 'incasso_fattura') {
      righe.push({ conto: contoLiq, dare: imp, avere: 0, nota: 'Incasso' })
      righe.push({ conto: '__crediti_clienti', dare: 0, avere: imp, nota: 'Storno credito' })
    }
    if (tipo === 'fattura_ricevuta') {
      righe.push({ conto: '__costi_acquisti', dare: imp, avere: 0, nota: 'Costo' })
      if (iva > 0) righe.push({ conto: '__iva_credito', dare: iva, avere: 0, nota: `IVA ${aliquota}%` })
      righe.push({ conto: '__debiti_fornitori', dare: 0, avere: totLordo, nota: 'Debito fornitore' })
    }
    if (tipo === 'pagamento_fornitore') {
      righe.push({ conto: '__debiti_fornitori', dare: imp, avere: 0, nota: 'Estinzione debito' })
      righe.push({ conto: contoLiq, dare: 0, avere: imp, nota: 'Pagamento' })
    }
    if (tipo === 'pagamento_dipendente') {
      (compensiConConti || compensi).forEach(c => {
        const netto = parseFloat(c.importo) || 0
        const aliqC = parseInt(c.aliquota) || 0
        if (netto > 0) {
          let ivaC = 0, totC = netto
          if (aliqC > 0) {
            if (c.modeIva === 'lordo') {
              ivaC = Math.round(netto - netto / (1 + aliqC / 100) * 100) / 100
              totC = netto
            } else {
              ivaC = Math.round(netto * aliqC) / 100
              totC = netto + ivaC
            }
          }
          righe.push({ conto: c.contoDebito || '__debiti_fornitori', dare: netto, avere: 0, nota: 'Estinzione debito ' + c.nome })
          if (ivaC > 0) righe.push({ conto: '__iva_credito', dare: ivaC, avere: 0, nota: 'IVA fattura ' + c.nome })
          righe.push({ conto: contoLiq, dare: 0, avere: totC, nota: 'Pagamento ' + c.nome })
        }
      })
    }
    if (tipo === 'acquisto_attrezzatura') {
      righe.push({ conto: '__attrezzature', dare: imp, avere: 0, nota: 'Immobilizzazione' })
      if (iva > 0) righe.push({ conto: '__iva_credito', dare: iva, avere: 0, nota: `IVA ${aliquota}%` })
      righe.push({ conto: contoLiq, dare: 0, avere: totLordo, nota: 'Pagamento' })
    }
    if (tipo === 'acconto_tasse') {
      righe.push({ conto: '__costi_accantonamenti', dare: imp, avere: 0, nota: 'Accantonamento' })
      righe.push({ conto: '__fondo_tasse', dare: 0, avere: imp, nota: 'Fondo tasse' })
    }
    if (tipo === 'utilizzo_fondo') {
      const fondo = accantonamenti[0]?.mastrinoId || '__fondo_tasse'
      righe.push({ conto: fondo, dare: imp, avere: 0, nota: 'Utilizzo fondo' })
      righe.push({ conto: contoLiq, dare: 0, avere: imp, nota: 'Pagamento' })
    }

    // Costi aggiuntivi con IVA
    costiCalcolati.forEach(c => {
      if (c.totale > 0 && c.conto) {
        righe.push({ conto: c.conto, dare: c.imponibile, avere: 0, nota: c.nota || 'Costo' })
        if (c.iva > 0) righe.push({ conto: '__iva_credito', dare: c.iva, avere: 0, nota: `IVA ${c.aliquota}%` })
        righe.push({ conto: contoLiq, dare: 0, avere: c.totale, nota: c.nota || 'Pagamento costo' })
      }
    })

    // Accantonamenti
    if (tipo !== 'utilizzo_fondo') {
      accantonamenti.forEach(a => {
        const val = parseFloat(a.importo) || 0
        if (val > 0 && a.mastrinoId) {
          righe.push({ conto: '__costi_accantonamenti', dare: val, avere: 0, nota: `Acc.to ${a.nome}` })
          righe.push({ conto: a.mastrinoId, dare: 0, avere: val, nota: `Acc.to ${a.nome}` })
        }
      })
    }

    return righe
  }

  const righeAnteprima = generaRighe()
  const bilanciatoOk = verificaBilancio(righeAnteprima)

  async function salva() {
    if (!righeAnteprima.length) return toast('Nessuna riga da registrare')
    if (!bilanciatoOk) return toast('La scrittura non è bilanciata')
    setSaving(true)

    // Crea mastrini dipendenti automaticamente se mancano
    let compensiFinali = compensi
    if (['evento', 'pagamento_dipendente'].includes(tipo)) {
      compensiFinali = await Promise.all(compensi.map(async c => {
        if (!c.nome.trim()) return c
        if (c.contoDebito) return c
        const id = await assicuraMastrino(c.nome)
        return { ...c, contoDebito: id || '' }
      }))
      setCompensi(compensiFinali)
      await caricaDati()
    }

    const righeFinali = generaRighe(compensiFinali)

    const payload = {
      tipo, attivita, data, descrizione,
      importo: imp, iva, aliquota,
      conto_liquidita: contoLiquidita,
      compensi: ['evento', 'pagamento_dipendente'].includes(tipo) ? compensiFinali : null,
      costi: costi.length ? costi : null,
      accantonamenti: accantonamenti.length ? accantonamenti : null,
      righe_libere: tipo === 'libera' ? righeLibere : null,
      cap_totale: tipo === 'capitale_sociale' ? parseFloat(capTotale) : null,
      cap_versato: tipo === 'capitale_sociale' ? parseFloat(capVersato) : null,
      righe: righeFinali,
    }
    let error
    if (editId) {
      ;({ error } = await supabase.from('movimenti').update(payload).eq('id', editId))
    } else {
      ;({ error } = await supabase.from('movimenti').insert([payload]))
    }
    setSaving(false)
    if (error) { toast('Errore: ' + error.message); return }
    toast(editId ? 'Movimento aggiornato' : 'Movimento salvato')
    navigate('partitario')
  }

  async function salvaModello() {
    const nome = prompt('Nome del modello:')
    if (!nome) return
    const { error } = await supabase.from('modelli').insert([{
      nome, tipo, attivita, aliquota,
      descrizione: descrizione || null,
      compensi: ['evento', 'pagamento_dipendente'].includes(tipo) ? compensi : null,
      accantonamenti: accantonamenti.length ? accantonamenti : null,
      costi: costi.length ? costi : null,
    }])
    if (error) toast('Errore: ' + error.message)
    else { toast('Modello salvato'); caricaDati() }
  }

  function NomeContoSelect({ value, onChange, placeholder, filterFn }) {
    const conti = filterFn ? tuttiConti.filter(filterFn) : tuttiConti
    const gruppi = ['disponibilita', 'attivo', 'passivo', 'debito_dipendente', 'fondo_accantonamento', 'netto', 'ricavo', 'costo']
    const labels = { disponibilita: 'Disponibilità', attivo: 'Attivo', passivo: 'Passivo', debito_dipendente: 'Debiti dipendenti', fondo_accantonamento: 'Fondi', netto: 'Netto', ricavo: 'Ricavi', costo: 'Costi' }
    return (
      <select value={value} onChange={e => onChange(e.target.value)}>
        <option value="">{placeholder || 'Seleziona conto...'}</option>
        {gruppi.map(cat => {
          const voci = conti.filter(c => c.tipo === cat)
          if (!voci.length) return null
          return (
            <optgroup key={cat} label={labels[cat] || cat}>
              {voci.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </optgroup>
          )
        })}
      </select>
    )
  }

  if (loading) return <div className="loading"><i className="ti ti-loader" />Caricamento...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{editId ? 'Modifica scrittura' : 'Nuova scrittura'}</div>
          <div className="page-subtitle">Registra un movimento contabile</div>
        </div>
        <div className="row">
          {modelli.length > 0 && (
            <select value={selectedModello} onChange={e => { setSelectedModello(e.target.value); applicaModello(e.target.value) }} style={{ width: 200 }}>
              <option value="">Carica modello...</option>
              {modelli.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          )}
          <button className="btn btn-sm" onClick={salvaModello}><i className="ti ti-template" aria-hidden="true" /> Salva modello</button>
        </div>
      </div>

      <div className="grid-2" style={{ gap: '1.5rem', alignItems: 'start' }}>
        <div className="stack">
          {/* Testata */}
          <div className="card">
            <div className="form-row form-row-2" style={{ marginBottom: '0.75rem' }}>
              <div>
                <label>Tipo operazione</label>
                <select value={tipo} onChange={e => setTipo(e.target.value)}>
                  {TIPI_OP.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label>Attività</label>
                <select value={attivita} onChange={e => setAttivita(e.target.value)}>
                  <option value="wedding">Wedding</option>
                  <option value="serra">La Serra</option>
                  <option value="comune">Comune</option>
                </select>
              </div>
            </div>
            <div className="form-row form-row-2" style={{ marginBottom: '0.75rem' }}>
              <div>
                <label>Data</label>
                <input type="date" value={data} onChange={e => setData(e.target.value)} />
              </div>
              <div>
                <label>Conto liquidità</label>
                <NomeContoSelect value={contoLiquidita} onChange={setContoLiquidita} filterFn={c => c.tipo === 'disponibilita'} />
              </div>
            </div>
            <div className="form-group">
              <label>Descrizione</label>
              <input type="text" value={descrizione} onChange={e => setDescrizione(e.target.value)} placeholder="es. Matrimonio Esposito - Taranto" />
            </div>

            {tipo !== 'libera' && tipo !== 'capitale_sociale' && tipo !== 'pagamento_dipendente' && (
              <>
                {/* Switch imponibile / lordo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Inserisci:</span>
                  <button
                    className={`btn btn-sm${importoMode === 'imponibile' ? ' btn-primary' : ''}`}
                    onClick={() => setImportoMode('imponibile')}
                    disabled={!needsIva}
                  >Imponibile</button>
                  <button
                    className={`btn btn-sm${importoMode === 'lordo' ? ' btn-primary' : ''}`}
                    onClick={() => setImportoMode('lordo')}
                    disabled={!needsIva}
                  >Lordo (scorporo IVA)</button>
                </div>
                <div className="form-row form-row-3">
                  <div>
                    <label>{importoMode === 'lordo' ? 'Importo lordo (€)' : 'Importo imponibile (€)'}</label>
                    <input type="number" value={importoInput} onChange={e => setImportoInput(e.target.value)} placeholder="0.00" step="0.01" />
                  </div>
                  <div>
                    <label>Aliquota IVA</label>
                    <select value={aliquota} onChange={e => setAliquota(parseInt(e.target.value))} disabled={!needsIva}>
                      {ALIQUOTE.map(a => <option key={a} value={a}>{a === 0 ? 'Esente / FC' : `${a}%`}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>{importoMode === 'lordo' ? 'Imponibile / IVA' : 'IVA / Lordo'}</label>
                    <input readOnly value={iva > 0 ? `${fmtEur(importoMode === 'lordo' ? imp : iva)} / ${fmtEur(importoMode === 'lordo' ? iva : totLordo)}` : fmtEur(imp)} style={{ fontWeight: 500 }} />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Capitale sociale */}
          {tipo === 'capitale_sociale' && (
            <div className="card">
              <div style={{ fontWeight: 500, marginBottom: '0.75rem' }}>Capitale sociale</div>
              <div className="info-box" style={{ marginBottom: '0.75rem' }}>
                Fase 1 — Sottoscrizione: Soci c/sottoscrizione (Dare) → Capitale Sociale (Avere)<br />
                Fase 2 — Versamento: Banca (Dare) → Soci c/sottoscrizione (Avere)<br />
                Il conto Soci c/sottoscrizione resta aperto (saldo positivo) finché non viene versato tutto il capitale.
              </div>
              <div className="form-row form-row-2">
                <div>
                  <label>Capitale totale sottoscritto (€)</label>
                  <input type="number" value={capTotale} onChange={e => setCapTotale(e.target.value)} placeholder="12000" step="0.01" />
                </div>
                <div>
                  <label>Quota già versata (€)</label>
                  <input type="number" value={capVersato} onChange={e => setCapVersato(e.target.value)} placeholder="3000" step="0.01" />
                </div>
              </div>
              {parseFloat(capTotale) > 0 && (
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
                  Residuo non versato: <strong style={{ color: 'var(--amber)' }}>{fmtEur(parseFloat(capTotale) - parseFloat(capVersato))}</strong>
                </div>
              )}
            </div>
          )}

          {/* Compensi */}
          {['evento', 'pagamento_dipendente'].includes(tipo) && (
            <div className="card">
              <div className="row-between" style={{ marginBottom: '1rem' }}>
                <span style={{ fontWeight: 500 }}>{tipo === 'pagamento_dipendente' ? 'Pagamenti' : 'Compensi evento'}</span>
                <button className="btn btn-sm" onClick={() => setCompensi([...compensi, { nome: '', contoDebito: '', importo: '', regimeId: '' }])}>
                  <i className="ti ti-plus" aria-hidden="true" /> Aggiungi
                </button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Se il collaboratore non ha ancora un mastrino, verrà creato automaticamente al salvataggio.
              </div>
              {compensi.map((c, i) => (
                <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', padding: '10px', marginBottom: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr 1fr 32px', gap: 8, marginBottom: tipo === 'pagamento_dipendente' ? 8 : 0, alignItems: 'end' }}>
                    <div>
                      {i === 0 && <label>Nome</label>}
                      <input type="text" value={c.nome} onChange={e => { const n = [...compensi]; n[i].nome = e.target.value; setCompensi(n) }} placeholder="Nome collaboratore" />
                    </div>
                    <div>
                      {i === 0 && <label>Importo (€)</label>}
                      <input type="number" value={c.importo} onChange={e => { const n = [...compensi]; n[i].importo = e.target.value; setCompensi(n) }} placeholder="0.00" step="0.01" />
                    </div>
                    <div>
                      {i === 0 && <label>Conto debito</label>}
                      <NomeContoSelect value={c.contoDebito} onChange={v => { const n = [...compensi]; n[i].contoDebito = v; setCompensi(n) }}
                        placeholder="Auto (crea mastrino)" filterFn={c => c.tipo === 'debito_dipendente' || c.tipo === 'passivo'} />
                    </div>
                    <div>
                      {i === 0 && <label>{tipo === 'pagamento_dipendente' ? 'IVA %' : 'Regime'}</label>}
                      {tipo === 'pagamento_dipendente' ? (
                        <select value={c.aliquota || '0'} onChange={e => { const n = [...compensi]; n[i].aliquota = e.target.value; setCompensi(n) }}>
                          <option value="0">Nessuna IVA</option>
                          <option value="10">10%</option>
                          <option value="22">22%</option>
                        </select>
                      ) : (
                        <select value={c.regimeId} onChange={e => { const n = [...compensi]; n[i].regimeId = e.target.value; setCompensi(n) }}>
                          <option value="">Default (21%)</option>
                          {regimi.map(r => <option key={r.id} value={r.id}>{r.nome} ({r.percentuale_totale}%)</option>)}
                        </select>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <button className="btn btn-sm btn-danger" onClick={() => setCompensi(compensi.filter((_, j) => j !== i))} aria-label="Rimuovi"><i className="ti ti-x" aria-hidden="true" /></button>
                    </div>
                  </div>
                  {tipo === 'pagamento_dipendente' && parseInt(c.aliquota) > 0 && parseFloat(c.importo) > 0 && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button className={'btn btn-sm' + (c.modeIva !== 'lordo' ? ' btn-primary' : '')} onClick={() => { const n = [...compensi]; n[i].modeIva = 'imponibile'; setCompensi(n) }}>Imponibile</button>
                      <button className={'btn btn-sm' + (c.modeIva === 'lordo' ? ' btn-primary' : '')} onClick={() => { const n = [...compensi]; n[i].modeIva = 'lordo'; setCompensi(n) }}>Lordo (scorporo)</button>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        IVA: {fmtEur(c.modeIva === 'lordo'
                          ? parseFloat(c.importo) - parseFloat(c.importo) / (1 + parseInt(c.aliquota) / 100)
                          : parseFloat(c.importo) * parseInt(c.aliquota) / 100
                        )} — Totale: {fmtEur(c.modeIva === 'lordo'
                          ? parseFloat(c.importo)
                          : parseFloat(c.importo) * (1 + parseInt(c.aliquota) / 100)
                        )}
                      </span>
                    </div>
                  )}
                </div>
              ))}
              {totCompensi > 0 && tipo === 'evento' && (
                <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                  Compensi: <strong>{fmtEur(totCompensi)}</strong> — Contributi azienda: <strong style={{ color: 'var(--amber)' }}>{fmtEur(totContributi)}</strong>
                </div>
              )}
            </div>
          )}

          {/* Costi aggiuntivi con IVA */}
          {tipo !== 'libera' && tipo !== 'capitale_sociale' && (
            <div className="card">
              <div className="row-between" style={{ marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 500 }}>Costi aggiuntivi</span>
                <button className="btn btn-sm" onClick={() => setCosti([...costi, { conto: '', importo: '', aliquota: '0', modeIva: 'imponibile', nota: '' }])}>
                  <i className="ti ti-plus" aria-hidden="true" /> Aggiungi costo
                </button>
              </div>
              {costi.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Nessun costo aggiuntivo.</div>}
              {costi.map((c, i) => {
                const cc = costiCalcolati[i] || c
                return (
                  <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', padding: '10px', marginBottom: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 1fr 32px', gap: 8, marginBottom: 6, alignItems: 'end' }}>
                      <div>
                        {i === 0 && <label>Conto costo</label>}
                        <NomeContoSelect value={c.conto} onChange={v => { const n = [...costi]; n[i].conto = v; setCosti(n) }} filterFn={x => x.tipo === 'costo'} />
                      </div>
                      <div>
                        {i === 0 && <label>Importo (€)</label>}
                        <input type="number" value={c.importo} onChange={e => { const n = [...costi]; n[i].importo = e.target.value; setCosti(n) }} placeholder="0.00" step="0.01" />
                      </div>
                      <div>
                        {i === 0 && <label>IVA %</label>}
                        <select value={c.aliquota} onChange={e => { const n = [...costi]; n[i].aliquota = e.target.value; setCosti(n) }}>
                          {ALIQUOTE.map(a => <option key={a} value={a}>{a === 0 ? 'Esente' : `${a}%`}</option>)}
                        </select>
                      </div>
                      <div>
                        {i === 0 && <label>Nota</label>}
                        <input type="text" value={c.nota} onChange={e => { const n = [...costi]; n[i].nota = e.target.value; setCosti(n) }} placeholder="Descrizione" />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button className="btn btn-sm btn-danger" onClick={() => setCosti(costi.filter((_, j) => j !== i))} aria-label="Rimuovi"><i className="ti ti-x" aria-hidden="true" /></button>
                      </div>
                    </div>
                    {parseInt(c.aliquota) > 0 && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button className={`btn btn-sm${c.modeIva === 'imponibile' ? ' btn-primary' : ''}`} onClick={() => { const n = [...costi]; n[i].modeIva = 'imponibile'; setCosti(n) }}>Imponibile</button>
                        <button className={`btn btn-sm${c.modeIva === 'lordo' ? ' btn-primary' : ''}`} onClick={() => { const n = [...costi]; n[i].modeIva = 'lordo'; setCosti(n) }}>Lordo (scorporo)</button>
                        {parseFloat(c.importo) > 0 && (
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            Imponibile: {fmtEur(cc.imponibile)} — IVA: {fmtEur(cc.iva)} — Totale: {fmtEur(cc.totale)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Accantonamenti */}
          {!['libera', 'capitale_sociale', 'utilizzo_fondo'].includes(tipo) && (
            <div className="card">
              <div className="row-between" style={{ marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 500 }}>Accantonamenti</span>
                <button className="btn btn-sm" onClick={() => setAccantonamenti([...accantonamenti, { mastrinoId: '', nome: '', importo: '' }])}>
                  <i className="ti ti-plus" aria-hidden="true" /> Aggiungi
                </button>
              </div>
              {accantonamenti.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Nessun accantonamento.</div>}
              {accantonamenti.map((a, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 32px', gap: 8, marginBottom: 8, alignItems: 'end' }}>
                  <div>
                    {i === 0 && <label>Fondo</label>}
                    <NomeContoSelect value={a.mastrinoId} onChange={v => {
                      const n = [...accantonamenti]; n[i].mastrinoId = v
                      n[i].nome = tuttiConti.find(c => String(c.id) === String(v))?.nome || ''
                      setAccantonamenti(n)
                    }} filterFn={c => c.tipo === 'fondo_accantonamento'} />
                  </div>
                  <div>
                    {i === 0 && <label>Importo (€)</label>}
                    <input type="number" value={a.importo} onChange={e => { const n = [...accantonamenti]; n[i].importo = e.target.value; setAccantonamenti(n) }} placeholder="0.00" step="0.01" />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button className="btn btn-sm btn-danger" onClick={() => setAccantonamenti(accantonamenti.filter((_, j) => j !== i))} aria-label="Rimuovi"><i className="ti ti-x" aria-hidden="true" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Scrittura libera */}
          {tipo === 'libera' && (
            <div className="card">
              <div className="row-between" style={{ marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 500 }}>Righe contabili (dare / avere)</span>
                <button className="btn btn-sm" onClick={() => setRigheLibere([...righeLibere, rigaVuota()])}>
                  <i className="ti ti-plus" aria-hidden="true" /> Riga
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 1fr 32px', gap: 8, marginBottom: 4 }}>
                <label>Conto</label><label>Dare (€)</label><label>Avere (€)</label><label>Nota</label><span />
              </div>
              {righeLibere.map((r, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 1fr 32px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <NomeContoSelect value={r.conto} onChange={v => { const n = [...righeLibere]; n[i].conto = v; setRigheLibere(n) }} />
                  <input type="number" value={r.dare} onChange={e => { const n = [...righeLibere]; n[i].dare = e.target.value; setRigheLibere(n) }} placeholder="0.00" step="0.01" />
                  <input type="number" value={r.avere} onChange={e => { const n = [...righeLibere]; n[i].avere = e.target.value; setRigheLibere(n) }} placeholder="0.00" step="0.01" />
                  <input type="text" value={r.nota} onChange={e => { const n = [...righeLibere]; n[i].nota = e.target.value; setRigheLibere(n) }} placeholder="Nota" />
                  <button className="btn btn-sm btn-danger" onClick={() => setRigheLibere(righeLibere.filter((_, j) => j !== i))} aria-label="Rimuovi"><i className="ti ti-x" aria-hidden="true" /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="stack">
          {tipo === 'evento' && imp > 0 && (
            <div className="card">
              <div style={{ fontWeight: 500, marginBottom: '0.75rem' }}>Riepilogo cassa evento</div>
              <div className="totale-evento">
                <div className="totale-row"><span>Incasso lordo</span><span style={{ color: 'var(--green)' }}>{fmtEur(totLordo)}</span></div>
                {iva > 0 && <div className="totale-row"><span>IVA a debito ({aliquota}%)</span><span style={{ color: 'var(--red)' }}>− {fmtEur(iva)}</span></div>}
                {compensi.map((c, i) => parseFloat(c.importo) > 0 && (
                  <div className="totale-row" key={i}><span>Compenso {c.nome}</span><span style={{ color: 'var(--red)' }}>− {fmtEur(parseFloat(c.importo))}</span></div>
                ))}
                {totContributi > 0 && <div className="totale-row"><span>Contributi azienda</span><span style={{ color: 'var(--amber)' }}>− {fmtEur(totContributi)}</span></div>}
                {costiCalcolati.map((c, i) => c.totale > 0 && (
                  <div className="totale-row" key={i}><span>{c.nota || 'Costo'}{c.iva > 0 ? ` (IVA ${c.aliquota}%)` : ''}</span><span style={{ color: 'var(--red)' }}>− {fmtEur(c.totale)}</span></div>
                ))}
                {accantonamenti.map((a, i) => parseFloat(a.importo) > 0 && (
                  <div className="totale-row" key={i}><span>Acc.to {a.nome || 'fondo'}</span><span style={{ color: 'var(--amber)' }}>− {fmtEur(parseFloat(a.importo))}</span></div>
                ))}
                <div className="totale-row finale">
                  <span>Cassa disponibile</span>
                  <span style={{ color: cassaFinale >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtEur(cassaFinale)}</span>
                </div>
              </div>
            </div>
          )}

          {righeAnteprima.length > 0 && (
            <div className="card">
              <div className="row-between" style={{ marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 500 }}>Scrittura contabile</span>
                <span className={bilanciatoOk ? 'zero-ok' : 'zero-ko'}>{bilanciatoOk ? 'Bilanciata ✓' : 'Sbilanciata ⚠'}</span>
              </div>
              <div className="scrittura-preview">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', gap: 4, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Conto</span>
                  <span style={{ fontSize: 12, color: 'var(--green)', textAlign: 'right' }}>Dare</span>
                  <span style={{ fontSize: 12, color: 'var(--red)', textAlign: 'right' }}>Avere</span>
                </div>
                {righeAnteprima.map((r, i) => (
                  <div className="scrittura-row" key={i}>
                    <span style={{ fontSize: 12 }}>{tuttiConti.find(c => String(c.id) === String(r.conto))?.nome || r.conto}{r.nota ? ` — ${r.nota}` : ''}</span>
                    <span className="dare" style={{ textAlign: 'right', minWidth: 90, fontSize: 12 }}>{r.dare > 0 ? fmtEur(r.dare) : '—'}</span>
                    <span className="avere" style={{ textAlign: 'right', minWidth: 90, fontSize: 12 }}>{r.avere > 0 ? fmtEur(r.avere) : '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button className="btn btn-primary" onClick={salva} disabled={saving || !bilanciatoOk}
            style={{ width: '100%', justifyContent: 'center', padding: '12px', opacity: bilanciatoOk ? 1 : 0.5 }}>
            <i className="ti ti-check" aria-hidden="true" />
            {saving ? 'Salvataggio...' : editId ? 'Salva modifiche' : 'Registra movimento'}
          </button>
          {!bilanciatoOk && righeAnteprima.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--red)', textAlign: 'center' }}>Dare ≠ Avere — controlla gli importi</div>
          )}
        </div>
      </div>
    </div>
  )
}
