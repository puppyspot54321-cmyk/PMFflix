import { useState, type FormEvent } from 'react'
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  Play,
  ShieldCheck,
  UserRound,
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
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const resetMessages = () => {
    setErrorMessage('')
    setSuccessMessage('')
  }

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    resetMessages()

    const cleanEmail = email.trim()

    if (!cleanEmail || !password) {
      setErrorMessage(
        'Please enter your email and password.',
      )
      return
    }

    if (isSignUp && !fullName.trim()) {
      setErrorMessage('Please enter your name.')
      return
    }

    if (
      isSignUp &&
      password !== confirmPassword
    ) {
      setErrorMessage('Passwords do not match.')
      return
    }

    if (password.length < 6) {
      setErrorMessage(
        'Your password must contain at least 6 characters.',
      )
      return
    }

    setLoading(true)

    try {
      if (isSignUp) {
        const { data, error } =
          await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              data: {
                full_name: fullName.trim(),
              },
            },
          })

        if (error) {
          throw error
        }

        if (data.session && onAuthenticated) {
          onAuthenticated(data.session)
          return
        }

        setSuccessMessage(
          'Account created successfully. Please check your email to confirm your account, then sign in.',
        )

        setIsSignUp(false)
        setPassword('')
        setConfirmPassword('')
      } else {
        const { data, error } =
          await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          })

        if (error) {
          throw error
        }

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
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.'

      if (
        message
          .toLowerCase()
          .includes('invalid login credentials')
      ) {
        setErrorMessage(
          'Incorrect email or password.',
        )
      } else {
        setErrorMessage(message)
      }
    } finally {
      setLoading(false)
    }
  }

  const switchMode = () => {
    if (loading) return

    resetMessages()
    setIsSignUp((current) => !current)
    setPassword('')
    setConfirmPassword('')
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt=""
          className="h-full w-full object-cover opacity-30"
        />

        <div className="absolute inset-0 bg-black/65" />

        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black/30" />

        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-black shadow-2xl">
              <Play
                size={23}
                fill="currentColor"
              />
            </div>

            <p className="mt-5 text-[9px] font-black uppercase tracking-[0.35em] text-white/35">
              Prince Mufasa Flix
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-[-0.06em] text-white sm:text-5xl">
              {isSignUp
                ? 'Create your account'
                : 'Welcome back'}
            </h1>

            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white/40">
              {isSignUp
                ? 'Join PMF-Flix and enter a world of stories.'
                : 'Sign in to continue your PMF-Flix experience.'}
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-black/55 p-5 shadow-2xl backdrop-blur-2xl sm:p-7">
            <form
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              {isSignUp && (
                <label className="block">
                  <span className="mb-2 block text-[8px] font-black uppercase tracking-[0.16em] text-white/30">
                    Full name
                  </span>

                  <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4">
                    <UserRound
                      size={16}
                      className="shrink-0 text-white/25"
                    />

                    <input
                      type="text"
                      value={fullName}
                      onChange={(event) =>
                        setFullName(
                          event.target.value,
                        )
                      }
                      placeholder="Your name"
                      autoComplete="name"
                      className="min-w-0 flex-1 bg-transparent py-3.5 text-sm text-white outline-none placeholder:text-white/20"
                    />
                  </div>
                </label>
              )}

              <label className="block">
                <span className="mb-2 block text-[8px] font-black uppercase tracking-[0.16em] text-white/30">
                  Email
                </span>

                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4">
                  <Mail
                    size={16}
                    className="shrink-0 text-white/25"
                  />

                  <input
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="min-w-0 flex-1 bg-transparent py-3.5 text-sm text-white outline-none placeholder:text-white/20"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-[8px] font-black uppercase tracking-[0.16em] text-white/30">
                  Password
                </span>

                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4">
                  <LockKeyhole
                    size={16}
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
                    placeholder="Your password"
                    autoComplete={
                      isSignUp
                        ? 'new-password'
                        : 'current-password'
                    }
                    className="min-w-0 flex-1 bg-transparent py-3.5 text-sm text-white outline-none placeholder:text-white/20"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (current) => !current,
                      )
                    }
                    className="text-white/30 hover:text-white"
                    aria-label={
                      showPassword
                        ? 'Hide password'
                        : 'Show password'
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>
                </div>
              </label>

              {isSignUp && (
                <label className="block">
                  <span className="mb-2 block text-[8px] font-black uppercase tracking-[0.16em] text-white/30">
                    Confirm password
                  </span>

                  <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4">
                    <ShieldCheck
                      size={16}
                      className="shrink-0 text-white/25"
                    />

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
                      placeholder="Confirm password"
                      autoComplete="new-password"
                      className="min-w-0 flex-1 bg-transparent py-3.5 text-sm text-white outline-none placeholder:text-white/20"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(
                          (current) => !current,
                        )
                      }
                      className="text-white/30 hover:text-white"
                      aria-label={
                        showConfirmPassword
                          ? 'Hide password'
                          : 'Show password'
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>
                  </div>
                </label>
              )}

              {errorMessage && (
                <div className="rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-xs leading-5 text-red-200">
                  {errorMessage}
                </div>
              )}

              {successMessage && (
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-xs leading-5 text-emerald-200">
                  {successMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="group mt-3 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-black transition hover:bg-white/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2
                      size={18}
                      className="animate-spin"
                    />
                    {isSignUp
                      ? 'Creating account...'
                      : 'Signing in...'}
                  </>
                ) : (
                  <>
                    {isSignUp
                      ? 'Create account'
                      : 'Sign in'}

                    <ArrowRight
                      size={17}
                      className="transition-transform group-hover:translate-x-1"
                    />
                  </>
                )}
              </button>
            </form>

            <div className="my-7 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />

              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25">
                PMF
              </span>

              <div className="h-px flex-1 bg-white/10" />
            </div>

            <p className="text-center text-sm text-white/45">
              {isSignUp
                ? 'Already have a PMF account?'
                : "Don't have a PMF account?"}{' '}

              <button
                type="button"
                onClick={switchMode}
                disabled={loading}
                className="font-bold text-white underline decoration-white/30 underline-offset-4 transition hover:decoration-white disabled:opacity-50"
              >
                {isSignUp
                  ? 'Sign in'
                  : 'Create one'}
              </button>
            </p>

            <p className="mt-7 text-center text-[10px] leading-5 text-white/25">
              By continuing, you agree to use PMF-Flix
              only for lawful, authorized entertainment
              content.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
