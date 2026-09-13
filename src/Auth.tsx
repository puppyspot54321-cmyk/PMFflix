import { useState } from 'react'
import {
  ArrowRight,
  Eye,
  EyeOff,
  Film,
  Loader2,
  Lock,
  Mail,
  Sparkles,
} from 'lucide-react'
import { supabase } from './supabase'
import heroImage from './assets/hero.png'

type Mode = 'signin' | 'signup'

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const isSignup = mode === 'signup'

  const clearFeedback = () => {
    setMessage('')
    setError('')
  }

  const switchMode = (nextMode: Mode) => {
    clearFeedback()
    setMode(nextMode)
    setPassword('')
    setConfirmPassword('')
  }

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    clearFeedback()

    const cleanEmail = email.trim().toLowerCase()

    if (!cleanEmail) {
      setError('Please enter your email address.')
      return
    }

    if (!password) {
      setError('Please enter your password.')
      return
    }

    if (password.length < 6) {
      setError(
        'Your password must contain at least 6 characters.',
      )
      return
    }

    if (isSignup && password !== confirmPassword) {
      setError('Your passwords do not match.')
      return
    }

    setLoading(true)

    try {
      if (isSignup) {
        const { data, error: signUpError } =
          await supabase.auth.signUp({
            email: cleanEmail,
            password,
          })

        if (signUpError) {
          throw signUpError
        }

        if (data.session) {
          setMessage(
            'Your PMF account is ready. Welcome to PMF-Flix.',
          )
        } else {
          setMessage(
            'Account created. Check your email to confirm your account before signing in.',
          )
        }
      } else {
        const { error: signInError } =
          await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          })

        if (signInError) {
          throw signInError
        }
      }
    } catch (err) {
      console.error('PMF authentication error:', err)

      const text =
        err instanceof Error
          ? err.message
          : 'Authentication failed. Please try again.'

      setError(text)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <img
        src={heroImage}
        alt="PMF Cinematic Hero"
        className="absolute inset-0 h-full w-full object-cover object-center opacity-40"
      />

      <div className="absolute inset-0 bg-black/70" />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_35%,rgba(220,20,30,.18),transparent_35%)]" />

      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/45" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
        <div className="grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_.9fr]">
          <section className="hidden lg:block">
            <div className="max-w-xl">
              <div className="mb-7 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-red-500/20 bg-red-600/10">
                  <Film className="h-5 w-5 text-red-500" />
                </div>

                <div>
                  <div className="text-2xl font-black tracking-[-0.06em]">
                    PMF
                    <span className="text-red-600">
                      LIX
                    </span>
                  </div>

                  <p className="text-[8px] font-bold uppercase tracking-[0.3em] text-white/30">
                    Prince Mufasa Flix
                  </p>
                </div>
              </div>

              <p className="mb-4 text-[10px] font-black uppercase tracking-[0.4em] text-red-500">
                Your cinematic world
              </p>

              <h1 className="text-6xl font-black leading-[.92] tracking-[-0.07em] xl:text-8xl">
                Your World.
                <br />
                Your Stories.
                <br />
                <span className="text-red-600">
                  Your Flix.
                </span>
              </h1>

              <p className="mt-7 max-w-lg text-base leading-7 text-white/45">
                Discover premium stories, unforgettable
                characters and cinematic entertainment
                built for a new generation of global
                audiences.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-white/45 backdrop-blur-xl">
                  Premium Cinema
                </div>

                <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-white/45 backdrop-blur-xl">
                  Original Stories
                </div>

                <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-white/45 backdrop-blur-xl">
                  Global Entertainment
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto w-full max-w-md">
            <div className="mb-7 text-center lg:hidden">
              <div className="text-3xl font-black tracking-[-0.06em]">
                PMF
                <span className="text-red-600">
                  LIX
                </span>
              </div>

              <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.3em] text-white/30">
                Prince Mufasa Flix
              </p>
            </div>

            <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-black/65 p-6 shadow-2xl shadow-black/60 backdrop-blur-2xl sm:p-8">
              <div className="mb-7">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600 shadow-lg shadow-red-950/40">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>

                <p className="text-[9px] font-black uppercase tracking-[0.35em] text-red-500">
                  PMF Member Access
                </p>

                <h2 className="mt-2 text-3xl font-black tracking-tight">
                  {isSignup
                    ? 'Create your account'
                    : 'Welcome back'}
                </h2>

                <p className="mt-2 text-sm leading-6 text-white/35">
                  {isSignup
                    ? 'Join PMF-Flix and enter your cinematic world.'
                    : 'Sign in to continue your PMF-Flix experience.'}
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                <label className="block">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                    Email address
                  </span>

                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />

                    <input
                      type="email"
                      value={email}
                      onChange={(event) =>
                        setEmail(event.target.value)
                      }
                      autoComplete="email"
                      placeholder="you@example.com"
                      disabled={loading}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.045] py-3.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-red-500/60 focus:bg-white/[0.07] disabled:opacity-50"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                    Password
                  </span>

                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />

                    <input
                      type={
                        showPassword
                          ? 'text'
                          : 'password'
                      }
                      value={password}
                      onChange={(event) =>
                        setPassword(event.target.value)
                      }
                      autoComplete={
                        isSignup
                          ? 'new-password'
                          : 'current-password'
                      }
                      placeholder="••••••••"
                      disabled={loading}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.045] py-3.5 pl-11 pr-12 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-red-500/60 focus:bg-white/[0.07] disabled:opacity-50"
                    />

                    <button
                      type="button"
                      aria-label={
                        showPassword
                          ? 'Hide password'
                          : 'Show password'
                      }
                      onClick={() =>
                        setShowPassword(
                          (value) => !value,
                        )
                      }
                      className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-white/30 transition hover:bg-white/10 hover:text-white"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </label>

                {isSignup && (
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                      Confirm password
                    </span>

                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />

                      <input
                        type={
                          showConfirmPassword
                            ? 'text'
                            : 'password'
                        }
                        value={confirmPassword}
                        onChange={(event) =>
                          setConfirmPassword(
                            event.target.value,
                          )
                        }
                        autoComplete="new-password"
                        placeholder="••••••••"
                        disabled={loading}
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.045] py-3.5 pl-11 pr-12 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-red-500/60 focus:bg-white/[0.07] disabled:opacity-50"
                      />

                      <button
                        type="button"
                        aria-label={
                          showConfirmPassword
                            ? 'Hide password'
                            : 'Show password'
                        }
                        onClick={() =>
                          setShowConfirmPassword(
                            (value) => !value,
                          )
                        }
                        className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-white/30 transition hover:bg-white/10 hover:text-white"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </label>
                )}

                                {error && (
                  <div
                    role="alert"
                    className="rounded-2xl border border-red-500/20 bg-red-500/[0.07] px-4 py-3 text-xs leading-5 text-red-300"
                  >
                    {error}
                  </div>
                )}

                {message && (
                  <div
                    role="status"
                    className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-xs leading-5 text-emerald-300"
                  >
                    {message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3.5 text-sm font-black text-white shadow-xl shadow-red-950/30 transition hover:bg-red-500 hover:shadow-red-950/50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {isSignup
                        ? 'Creating account...'
                        : 'Signing in...'}
                    </>
                  ) : (
                    <>
                      {isSignup
                        ? 'Create Account'
                        : 'Enter PMF-Flix'}

                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </form>

              <div className="my-7 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/[0.08]" />
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/20">
                  PMF
                </span>
                <div className="h-px flex-1 bg-white/[0.08]" />
              </div>

              <div className="text-center">
                <p className="text-xs text-white/35">
                  {isSignup
                    ? 'Already have a PMF account?'
                    : "Don't have a PMF account?"}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    switchMode(
                      isSignup
                        ? 'signin'
                        : 'signup',
                    )
                  }
                  disabled={loading}
                  className="mt-2 text-sm font-black text-red-500 transition hover:text-red-400 disabled:opacity-50"
                >
                  {isSignup
                    ? 'Sign in instead'
                    : 'Create your account'}
                </button>
              </div>

              <p className="mt-7 text-center text-[9px] leading-5 text-white/20">
                By continuing, you agree to use PMF-Flix
                only for content you are legally
                authorized to access and stream.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-center gap-2 text-[9px] font-bold uppercase tracking-[0.18em] text-white/20">
              <span className="h-1 w-1 rounded-full bg-red-600" />
              Secure PMF Member Access
              <span className="h-1 w-1 rounded-full bg-red-600" />
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

