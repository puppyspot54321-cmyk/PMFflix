import { useEffect, useState } from 'react'
import {
  Eye,
  EyeOff,
  Film,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Sparkles,
} from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import heroImage from './assets/hero.png'

type AuthScreenProps = {
  onAuthenticated?: (session: Session) => void
}

export default function AuthScreen({
  onAuthenticated,
}: AuthScreenProps) {
  const [mode, setMode] = useState<
    'signin' | 'signup'
  >('signin')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] =
    useState('')

  const [showPassword, setShowPassword] =
    useState(false)

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false)

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (
          active &&
          data.session &&
          onAuthenticated
        ) {
          onAuthenticated(data.session)
        }
      })

    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (
            session &&
            onAuthenticated
          ) {
            onAuthenticated(session)
          }
        },
      )

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [onAuthenticated])

  const clearFeedback = () => {
    setError('')
    setMessage('')
  }

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    clearFeedback()

    const cleanEmail =
      email.trim().toLowerCase()

    if (!cleanEmail || !password) {
      setError(
        'Please enter your email and password.',
      )
      return
    }

    if (mode === 'signup') {
      if (password.length < 6) {
        setError(
          'Your password must contain at least 6 characters.',
        )
        return
      }

      if (password !== confirmPassword) {
        setError(
          'Your passwords do not match.',
        )
        return
      }
    }

    setLoading(true)

    try {
      if (mode === 'signin') {
        const {
          data,
          error: signInError,
        } =
          await supabase.auth.signInWithPassword(
            {
              email: cleanEmail,
              password,
            },
          )

        if (signInError) {
          throw signInError
        }

        if (!data.session) {
          throw new Error(
            'Login succeeded, but no active session was returned.',
          )
        }

        setMessage(
          'Welcome back to PMF-Flix.',
        )

        if (onAuthenticated) {
          onAuthenticated(data.session)
        }

        return
      }

      const {
        data,
        error: signUpError,
      } =
        await supabase.auth.signUp({
          email: cleanEmail,
          password,
        })

      if (signUpError) {
        throw signUpError
      }

      if (data.session) {
        setMessage(
          'Your PMF-Flix account is ready.',
        )

        if (onAuthenticated) {
          onAuthenticated(data.session)
        }

        return
      }

      setMessage(
        'Account created. Please check your email to confirm your account, then sign in.',
      )

      setMode('signin')
      setPassword('')
      setConfirmPassword('')
    } catch (authError) {
      const authMessage =
        authError instanceof Error
          ? authError.message
          : 'Authentication failed. Please try again.'

      setError(
        authMessage
          .replace(
            'Invalid login credentials',
            'Incorrect email or password.',
          )
          .replace(
            'Email not confirmed',
            'Please confirm your email address before signing in.',
          ),
      )
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (
    nextMode: 'signin' | 'signup',
  ) => {
    clearFeedback()
    setMode(nextMode)
    setPassword('')
    setConfirmPassword('')
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030303] text-white">
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt=""
          className="h-full w-full object-cover opacity-20"
        />

        <div className="absolute inset-0 bg-black/75" />

        <div className="absolute inset-0 bg-gradient-to-br from-black via-black/80 to-black/50" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-black shadow-2xl">
              <Film size={25} />
            </div>

            <h1 className="mt-5 text-3xl font-black tracking-[-0.05em]">
              PMF
              <span className="text-white/35">
                -FLIX
              </span>
            </h1>

            <p className="mt-2 text-[8px] font-black uppercase tracking-[0.3em] text-white/25">
              Prince Mufasa Flix
            </p>

            <div className="mt-5 flex items-center justify-center gap-2 text-[8px] font-black uppercase tracking-[0.2em] text-white/30">
              <Sparkles size={10} />
              Your World. Your Stories. Your Flix.
            </div>
          </div>

          <section className="rounded-3xl border border-white/10 bg-black/65 p-5 shadow-2xl backdrop-blur-2xl sm:p-7">
            <div className="mb-7">
              <h2 className="text-2xl font-black tracking-[-0.04em]">
                {mode === 'signin'
                  ? 'Welcome back'
                  : 'Join PMF-Flix'}
              </h2>

              <p className="mt-2 text-xs leading-5 text-white/30">
                {mode === 'signin'
                  ? 'Sign in to continue your cinematic journey.'
                  : 'Create your PMF-Flix account and start building your world of stories.'}
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <label className="block">
                <span className="mb-2 block text-[7px] font-black uppercase tracking-[0.18em] text-white/30">
                  Email address
                </span>

                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 transition focus-within:border-white/25">
                  <Mail
                    size={15}
                    className="shrink-0 text-white/25"
                  />

                  <input
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(
                        event.target.value,
                      )
                    }
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="min-w-0 flex-1 bg-transparent py-3.5 text-sm text-white outline-none placeholder:text-white/20"
                    disabled={loading}
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-[7px] font-black uppercase tracking-[0.18em] text-white/30">
                  Password
                </span>

                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 transition focus-within:border-white/25">
                  <LockKeyhole
                    size={15}
                    className="shrink-0 text-white/25"
                  />

                  <input
                    type={
                      showPassword
                        ? 'text'
                        : 'password'
                    }
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value,
                      )
                    }
                    autoComplete={
                      mode === 'signin'
                        ? 'current-password'
                        : 'new-password'
                    }
                    placeholder="Enter your password"
                    className="min-w-0 flex-1 bg-transparent py-3.5 text-sm text-white outline-none placeholder:text-white/20"
                    disabled={loading}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (value) => !value,
                      )
                    }
                    className="shrink-0 text-white/25 hover:text-white"
                    aria-label={
                      showPassword
                        ? 'Hide password'
                        : 'Show password'
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={15} />
                    ) : (
                      <Eye size={15} />
                    )}
                  </button>
                </div>
              </label>

              {mode === 'signup' && (
                <label className="block">
                  <span className="mb-2 block text-[7px] font-black uppercase tracking-[0.18em] text-white/30">
                    Confirm password
                  </span>

                  <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 transition focus-within:border-white/25">
                    <LockKeyhole
                      size={15}
                      className="shrink-0 text-white/25"
                    />

                    <input
                      type={
                        showConfirmPassword
                          ? 'text'
                          : 'password'
                      }
                      value={
                        confirmPassword
                      }
                      onChange={(event) =>
                        setConfirmPassword(
                          event.target.value,
                        )
                      }
                      autoComplete="new-password"
                      placeholder="Confirm your password"
                      className="min-w-0 flex-1 bg-transparent py-3.5 text-sm text-white outline-none placeholder:text-white/20"
                      disabled={loading}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(
                          (value) =>
                            !value,
                        )
                      }
                      className="shrink-0 text-white/25 hover:text-white"
                      aria-label={
                        showConfirmPassword
                          ? 'Hide password'
                          : 'Show password'
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={15} />
                      ) : (
                        <Eye size={15} />
                      )}
                    </button>
                  </div>
                </label>
              )}

              {error && (
                <div className="rounded-xl border border-red-400/15 bg-red-400/[0.05] px-4 py-3 text-[10px] leading-5 text-red-200/75">
                  {error}
                </div>
              )}

              {message && (
                <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[10px] leading-5 text-white/60">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-4 text-[9px] font-black uppercase tracking-[0.18em] text-black transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <LoaderCircle
                      size={14}
                      className="animate-spin"
                    />
                    Connecting
                  </>
                ) : mode === 'signin' ? (
                  'Enter PMF-Flix'
                ) : (
                  'Create Account'
                )}
              </button>
            </form>

            <div className="mt-7 border-t border-white/[0.07] pt-5 text-center">
              <p className="text-[10px] text-white/25">
                {mode === 'signin'
                  ? "Don't have an account?"
                  : 'Already have an account?'}
              </p>

              <button
                type="button"
                onClick={() =>
                  switchMode(
                    mode === 'signin'
                      ? 'signup'
                      : 'signin',
                  )
                }
                className="mt-2 text-[9px] font-black uppercase tracking-[0.16em] text-white/60 hover:text-white"
              >
                {mode === 'signin'
                  ? 'Create your PMF account'
                  : 'Sign in instead'}
              </button>
            </div>
          </section>

          <p className="mt-6 text-center text-[7px] font-black uppercase tracking-[0.2em] text-white/15">
            Secure authentication powered by PMF-Flix
          </p>
        </div>
      </div>
    </main>
  )
}
