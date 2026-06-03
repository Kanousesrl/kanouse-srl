import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function accedi(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError('Email o password errati')
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-tertiary)'
    }}>
      <div style={{ width: 360, maxWidth: '95vw' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text)' }}>Kanouse SRL</div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>Gestione contabile</div>
        </div>
        <div className="card">
          <div style={{ fontWeight: 500, marginBottom: '1.25rem' }}>Accedi</div>
          <form onSubmit={accedi}>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="tu@esempio.com" required autoFocus
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
              />
            </div>
            {error && (
              <div style={{ background: 'var(--red-bg)', color: 'var(--red-text)', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>
                {error}
              </div>
            )}
            <button className="btn btn-primary" type="submit" disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '10px' }}>
              {loading ? 'Accesso in corso...' : 'Accedi'}
            </button>
          </form>
        </div>
        <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: 12, color: 'var(--text-tertiary)' }}>
          Per richiedere l'accesso contatta un amministratore
        </div>
      </div>
    </div>
  )
}
