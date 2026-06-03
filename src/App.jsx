import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase.js'
import { ToastProvider } from './lib/toast.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import NuovaScrittura from './pages/NuovaScrittura.jsx'
import Modelli from './pages/Modelli.jsx'
import Mastrini from './pages/Mastrini.jsx'
import Regimi from './pages/Regimi.jsx'
import Partitario from './pages/Partitario.jsx'
import LibroMastro from './pages/LibroMastro.jsx'
import StatoPatrimoniale from './pages/StatoPatrimoniale.jsx'
import ContoEconomico from './pages/ContoEconomico.jsx'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'ti-layout-dashboard', section: null },
  { id: 'nuova', label: 'Nuova scrittura', icon: 'ti-plus', section: 'Operazioni' },
  { id: 'modelli', label: 'Modelli', icon: 'ti-template', section: null },
  { id: 'partitario', label: 'Partitario', icon: 'ti-list-details', section: 'Registri' },
  { id: 'mastro', label: 'Libro mastro', icon: 'ti-book-2', section: null },
  { id: 'sp', label: 'Stato patrimoniale', icon: 'ti-building-bank', section: null },
  { id: 'ce', label: 'Conto economico', icon: 'ti-chart-bar', section: null },
  { id: 'mastrini', label: 'Mastrini', icon: 'ti-folders', section: 'Configurazione' },
  { id: 'regimi', label: 'Regimi contrattuali', icon: 'ti-users-group', section: null },
]

const PAGES = {
  dashboard: Dashboard, nuova: NuovaScrittura, modelli: Modelli,
  mastrini: Mastrini, regimi: Regimi, partitario: Partitario,
  mastro: LibroMastro, sp: StatoPatrimoniale, ce: ContoEconomico,
}

function AppInner() {
  const [page, setPage] = useState('dashboard')
  const [pageProps, setPageProps] = useState({})
  const [user, setUser] = useState(null)

  const navigate = (id, props = {}) => { setPage(id); setPageProps(props) }

  async function logout() {
    await supabase.auth.signOut()
  }

  const PageComponent = PAGES[page] || Dashboard
  let lastSection = null

  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="sidebar-logo">
          <h1>Kanouse SRL</h1>
          <p>Gestione contabile</p>
        </div>
        {NAV.map(item => {
          const showSection = item.section && item.section !== lastSection
          if (item.section) lastSection = item.section
          return (
            <div key={item.id}>
              {showSection && <div className="nav-section">{item.section}</div>}
              <button className={`nav-item${page === item.id ? ' active' : ''}`} onClick={() => navigate(item.id)}>
                <i className={`ti ${item.icon}`} aria-hidden="true" />
                {item.label}
              </button>
            </div>
          )
        })}
        <div style={{ marginTop: 'auto', padding: '1rem 1.25rem', borderTop: '0.5px solid var(--border)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email}
          </div>
          <button className="nav-item" onClick={logout} style={{ padding: '6px 0', color: 'var(--red)' }}>
            <i className="ti ti-logout" aria-hidden="true" />
            Esci
          </button>
        </div>
      </nav>
      <main className="main">
        <PageComponent navigate={navigate} {...pageProps} />
      </main>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-tertiary)' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Caricamento...</div>
      </div>
    )
  }

  if (!session) {
    return (
      <ToastProvider>
        <Login />
      </ToastProvider>
    )
  }

  return (
    <ToastProvider>
      <AppInner user={session.user} />
    </ToastProvider>
  )
}
