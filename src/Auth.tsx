import { useState } from 'react'
import { supabase } from './supabase'

type Mode = 'login' | 'signup'

function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleEmailAuth = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    setLoading(true)
    setError('')
    setMessage('')

    const cleanEmail = email.trim()

    if (!cleanEmail || !password) {
      setError('Please enter your email and password.')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Your password must be at least 6 characters.')
      setLoading(false)
      return
    }

    try {
      if (mode === 'login') {
        const { error } =
          await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          })

        if (error) throw error

        setMessage('Welcome back to PMF Flix.')
      } else {
        const { data, error } =
          await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              emailRedirectTo: window.location.origin,
            },
          })

        if (error) throw error

        if (data.session) {
          setMessage(
            'Your PMF Flix account has been created.',
          )
        } else {
          setMessage(
            'Account created. Please check your email and verify your account before signing in.',
          )
        }
      }
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : 'Authentication failed. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] px-4 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(220,38,38,0.18),transparent_35%)]" />

      <div className="relative z-10 w-full max-w-md">

        <div className="mb-8 text-center">
          <div className="text-4xl font-black tracking-tight">
            <span className="text-red-600">PMF</span>
            LIX
          </div>

          <p className="mt-2 text-sm text-white/40">
            Prince Mufasa Flix
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-xl sm:p-8">

          <div className="mb-7 text-center">
            <h1 className="text-2xl font-black">
              {mode === 'login'
                ? 'Welcome back'
                : 'Create your account'}
            </h1>

            <p className="mt-2 text-sm text-white/40">
              {mode === 'login'
                ? 'Sign in to continue watching PMF Flix.'
                : 'Join PMF Flix and start your cinematic journey.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-xl bg-black/40 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login')
                setError('')
                setMessage('')
              }}
              className={`rounded-lg py-2.5 text-sm font-bold transition ${
                mode === 'login'
                  ? 'bg-white text-black'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              Sign In
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('signup')
                setError('')
                setMessage('')
              }}
              className={`rounded-lg py-2.5 text-sm font-bold transition ${
                mode === 'signup'
                  ? 'bg-white text-black'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              Register
            </button>
          </div>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />

            <span className="text-xs uppercase tracking-widest text-white/30">
              secure access
            </span>

            <div className="h-px flex-1 bg-white/10" />
          </div>

          <form
            onSubmit={handleEmailAuth}
            className="space-y-4"
          >

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-white/50">
                Email
              </label>

              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="you@example.com"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3.5 text-sm outline-none transition placeholder:text-white/20 focus:border-red-600"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-white/50">
                Password
              </label>

              <input
                type="password"
                autoComplete={
                  mode === 'login'
                    ? 'current-password'
                    : 'new-password'
                }
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Minimum 6 characters"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3.5 text-sm outline-none transition placeholder:text-white/20 focus:border-red-600"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {message && (
              <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-300">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-red-600 py-3.5 text-sm font-black transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? 'Please wait...'
                : mode === 'login'
                  ? 'Sign In to PMF Flix'
                  : 'Create PMF Account'}
            </button>

          </form>

          <p className="mt-6 text-center text-xs leading-5 text-white/25">
            By continuing, you agree to use PMF Flix responsibly
            and only access content you are authorized to view.
          </p>

        </div>

        <p className="mt-6 text-center text-xs text-white/20">
          © 2026 PMF Flix. All rights reserved.
        </p>

      </div>
    </div>
  )
}

export default AuthScreen
