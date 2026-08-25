/**
 * Collaboration & Workspace Access Modal.
 *
 * Provides profile selection (Lucas / Lona) and workspace authentication
 * for Cloudflare tunnel & remote collaboration.
 */
import { useEffect, useState } from 'react'
import { TOKEN_KEY } from '../api/files.ts'
import css from './LoginModal.module.css'

export interface UserProfile {
  name: string
  color: string
  avatar: string
}

export interface LoginModalProps {
  open: boolean
  onLoginSuccess: (token: string, user: UserProfile) => void
}

export function LoginModal({ open, onLoginSuccess }: LoginModalProps) {
  const [preset, setPreset] = useState<'lucas' | 'lona'>('lucas')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Check initial auth status
    void (async () => {
      try {
        const token = localStorage.getItem(TOKEN_KEY)
        const headers: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {}
        const res = await fetch('/vscode-files/auth/status', { headers })
        const data = await res.json()
        if (data.ok && (!data.requiresAuth || data.authenticated)) {
          if (data.user) {
            onLoginSuccess(token || '', data.user)
          }
        }
      } catch {
        // Network/localStorage failure on the initial status check: fall
        // through and show the login form, same as if the host had said
        // "not authenticated" (files.ts's authHeaders() treats a throwing
        // localStorage the same way, for the same reason — privacy-mode
        // browsers can throw on read).
      }
    })()
  }, [onLoginSuccess])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setError('')
    setLoading(true)
    try {
      const name = preset === 'lucas' ? 'Lucas' : 'Lona'
      const color = preset === 'lucas' ? '#3b82f6' : '#ec4899'
      const avatar = preset === 'lucas' ? '👨‍💻' : '💖'
      const res = await fetch('/vscode-files/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, name, color, avatar, preset }),
      })
      const data = await res.json()
      if (data && data.ok) {
        if (data.token) {
          try {
            localStorage.setItem(TOKEN_KEY, data.token)
            localStorage.setItem('dsh_user_profile', JSON.stringify(data.user))
          } catch {
            // Login still succeeds for this session even if persisting it
            // doesn't — same privacy-mode-can-throw reasoning as above.
          }
        }
        onLoginSuccess(data.token, data.user)
      } else {
        setError(data?.error || 'Invalid password. Please try again.')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className={css.backdrop}>
      <form className={`${css.card} vk_login_card`} onSubmit={handleSubmit}>
        <span className={css.badge}>🚀 DeepSeek Harness Cloud</span>
        <h2 className={css.title}>Workspace Collaboration</h2>
        <p className={css.subtitle}>Select your collaborator profile and enter the workspace password.</p>

        <div className={css.profilesGrid}>
          <div
            className={`${css.profileCard} ${preset === 'lucas' ? css.profileActive : ''}`}
            onClick={() => { setPreset('lucas') }}
          >
            <span className={css.avatar}>👨‍💻</span>
            <div>
              <div className={css.name}>Lucas</div>
              <div className={css.role}>Lead Dev</div>
            </div>
          </div>

          <div
            className={`${css.profileCard} ${preset === 'lona' ? css.profileActive : ''}`}
            onClick={() => { setPreset('lona') }}
          >
            <span className={css.avatar}>💖</span>
            <div>
              <div className={css.name}>Lona</div>
              <div className={css.role}>Collaborator</div>
            </div>
          </div>
        </div>

        <div className={css.inputGroup}>
          <label className={css.label} htmlFor="dsh_password">
            Workspace Password
          </label>
          <input
            id="dsh_password"
            type="password"
            className={css.input}
            placeholder="Enter password..."
            value={password}
            onChange={e => { setPassword(e.target.value) }}
            autoFocus
          />
        </div>

        {error && <div className={css.error}>{error}</div>}

        <button type="submit" className={css.loginBtn} disabled={loading}>
          {loading ? 'Connecting…' : 'Enter Workspace 🚀'}
        </button>
      </form>
    </div>
  )
}
