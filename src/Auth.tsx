import { useState, type FormEvent } from 'react'
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured, supabaseConfigError } from './supabase'
import heroImage from './assets/hero.png'
import PMFLogo from './components/PMFLogo'

type AuthScreenProps = {
  onAuthenticated?: (session: Session) => void
}

type AuthMode = 'signin' | 'signup' | 'forgot_password'

export default function AuthScreen({
  onAuthenticated,
}: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const resetMessages = () => {
    setErrorMessage('')
    setSuccessMessage('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetMessages()

    const cleanEmail = email.trim()

    if (!isSupabaseConfigured) {
      setErrorMessage(
        supabaseConfigError ||
          'Supabase environment variables are missing. Please configure .env file.',
      )
      return
    }

    if (!cleanEmail) {
      setErrorMessage('Please enter your email address.')
      return
    }

    // Password reset mode
    if (mode === 'forgot_password') {
      setLoading(true)
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        })
        if (error) throw error
        setSuccessMessage('Password recovery email dispatched. Please check your inbox.')
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to send password recovery email.',
        )
      } finally {
        setLoading(false)
      }
      return
    }

    if (!password) {
      setErrorMessage('Please enter your password.')
      return
    }

    if (mode === 'signup') {
      if (!fullName.trim()) {
        setErrorMessage('Please enter your full name.')
        return
      }

      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match.')
        return
      }

      if (password.length < 6) {
        setErrorMessage('Your password must contain at least 6 characters.')
        return
      }
    }

    setLoading(true)

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
          },
        })

        if (error) throw error

        if (data.session && onAuthenticated) {
          onAuthenticated(data.session)
          return
        }

        setSuccessMessage(
          'Account created successfully. Please check your email to confirm your account, then sign in.',
        )
        setMode('signin')
        setPassword('')
        setConfirmPassword('')
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        })

        if (error) throw error

        if (data.session && onAuthenticated) {
          onAuthenticated(data.session)
          return
        }

        setErrorMessage(
          'Login succeeded, but no authentication session was returned. Please try again.',
        )
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Something went wrong. Please try again.'

      if (message.toLowerCase().includes('invalid login credentials')) {
        setErrorMessage('Incorrect email or password. Please verify and try again.')
      } else {
        setErrorMessage(message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="pmf-auth-screen relative min-h-screen overflow-hidden bg-[#030208] text-white selection:bg-amber-400 selection:text-black">
      {/* Background artwork & atmospheric lighting */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt=""
          className="h-full w-full object-cover opacity-25 filter blur-xs"
        />
        <div className="absolute inset-0 bg-[#030208]/85" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#030208] via-[#030208]/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#030208] via-transparent to-[#030208]/60" />
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full bg-purple-700/15 blur-[160px]"
      />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-md">
          {/* Official Brand Logo */}
          <div className="mb-8 text-center">
            <div className="mx-auto flex items-center justify-center mb-4">
              <img
                src="/pmf-flix-logo.png"
                alt="Prince Mufasa Flix"
                className="h-16 sm:h-20 w-auto object-contain drop-shadow-[0_4px_24px_rgba(245,158,11,0.35)]"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  const fb = document.getElementById('pmf-auth-logo-fallback')
                  if (fb) fb.style.display = 'flex'
                }}
              />
              <div id="pmf-auth-logo-fallback" style={{ display: 'none' }} className="flex-col items-center">
                <PMFLogo size={56} showWordmark={true} />
              </div>
            </div>

            <p className="text-[9px] font-black uppercase tracking-[0.35em] text-amber-400/80">
              Exclusive Global Cinema Portal
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
              {mode === 'signup'
                ? 'Create Your PMF Account'
                : mode === 'forgot_password'
                ? 'Recover Your Password'
                : 'Welcome to PMF-Flix'}
            </h1>

            <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-white/50">
              {mode === 'signup'
                ? 'Register your account to unlock personalized profiles and continuous streaming.'
                : mode === 'forgot_password'
                ? 'Enter your registered email to receive a secure recovery link.'
                : 'Sign in to access your personal cinematic universe, watchlists, and PMF Originals.'}
            </p>
          </div>

          {/* Form Card */}
          <div className="rounded-[2rem] border border-white/10 bg-[#090714]/85 p-6 shadow-2xl backdrop-blur-2xl sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <label className="block">
                  <span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-white/40">
                    Full Name
                  </span>
                  <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4">
                    <UserRound size={16} className="shrink-0 text-white/30" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Prince Mufasa"
                      autoComplete="name"
                      className="min-w-0 flex-1 bg-transparent py-3 text-xs text-white outline-none placeholder:text-white/20"
                    />
                  </div>
                </label>
              )}

              <label className="block">
                <span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-white/40">
                  Email Address
                </span>
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4">
                  <Mail size={16} className="shrink-0 text-white/30" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    className="min-w-0 flex-1 bg-transparent py-3 text-xs text-white outline-none placeholder:text-white/20"
                  />
                </div>
              </label>

              {mode !== 'forgot_password' && (
                <label className="block">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase tracking-wider text-white/40">
                      Password
                    </span>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => {
                          resetMessages()
                          setMode('forgot_password')
                        }}
                        className="text-[9px] font-bold text-amber-400 hover:text-amber-300"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4">
                    <LockKeyhole size={16} className="shrink-0 text-white/30" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Your password"
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      required
                      className="min-w-0 flex-1 bg-transparent py-3 text-xs text-white outline-none placeholder:text-white/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="text-white/30 hover:text-white"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </label>
              )}

              {mode === 'signup' && (
                <label className="block">
                  <span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-white/40">
                    Confirm Password
                  </span>
                  <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4">
                    <LockKeyhole size={16} className="shrink-0 text-white/30" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      autoComplete="new-password"
                      required
                      className="min-w-0 flex-1 bg-transparent py-3 text-xs text-white outline-none placeholder:text-white/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="text-white/30 hover:text-white"
                    >
                      {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </label>
              )}

              {errorMessage && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                  {errorMessage}
                </div>
              )}

              {successMessage && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
                  {successMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 text-xs font-black uppercase tracking-wider text-black transition hover:bg-amber-300 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Processing...
                  </>
                ) : mode === 'signup' ? (
                  <>
                    Create Account
                    <ArrowRight size={15} />
                  </>
                ) : mode === 'forgot_password' ? (
                  <>
                    <KeyRound size={15} />
                    Send Recovery Link
                  </>
                ) : (
                  <>
                    Sign In to PMF-Flix
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>

            {/* Mode switch links */}
            <div className="mt-6 border-t border-white/[0.08] pt-4 text-center">
              {mode === 'forgot_password' ? (
                <button
                  type="button"
                  onClick={() => {
                    resetMessages()
                    setMode('signin')
                  }}
                  className="text-xs text-white/50 hover:text-white"
                >
                  ← Back to Sign In
                </button>
              ) : mode === 'signup' ? (
                <p className="text-xs text-white/50">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      resetMessages()
                      setMode('signin')
                    }}
                    className="font-bold text-amber-400 hover:underline"
                  >
                    Sign In
                  </button>
                </p>
              ) : (
                <p className="text-xs text-white/50">
                  Don't have a PMF-Flix account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      resetMessages()
                      setMode('signup')
                    }}
                    className="font-bold text-amber-400 hover:underline"
                  >
                    Register Now
                  </button>
                </p>
              )}
            </div>

            <div className="mt-4 flex items-center justify-center gap-1.5 text-[9px] text-white/30">
              <ShieldCheck size={12} className="text-emerald-400/80" />
              <span>Protected by Supabase Authentication & RLS</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
