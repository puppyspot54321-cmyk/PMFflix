import { useEffect, useState, type FormEvent } from 'react'
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
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  /*
   * Recover an existing authenticated session.
   * This also handles the case where the user refreshes the page
   * after successfully signing in.
   */
  useEffect(() => {
    let mounted = true

    const recoverSession = async () => {
      const { data, error } = await supabase.auth.getSession()

      if (!mounted || error) return

      if (data.session && onAuthenticated) {
        onAuthenticated(data.session)
      }
    }

    recoverSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return

      if (nextSession && onAuthenticated) {
        onAuthenticated(nextSession)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [onAuthenticated])

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
      setErrorMessage('Please enter your email and password.')
      return
    }

    if (isSignUp && !fullName.trim()) {
      setErrorMessage('Please enter your name.')
      return
    }

    if (isSignUp && password !== confirmPassword) {
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
        const { data, error } = await supabase.auth.signUp({
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

        /*
         * IMPORTANT:
         * Never use an undefined "session" variable here.
         * Supabase returns the authenticated session through
         * data.session.
         */
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

        /*
         * THIS IS THE CRITICAL FIX.
         *
         * The authenticated session is data.session.
         * It is passed directly back to App.tsx.
         */
        if (data.session && onAuthenticated) {
          onAuthenticated(data.session)
          return
        }

        /*
         * This should only happen if Supabase reports a successful
         * authentication without returning a session.
         */
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
        message.toLowerCase().includes('invalid login credentials')
      ) {
        setErrorMessage('Incorrect email or password.')
      } else if (
        message.toLowerCase().includes('email not confirmed')
      ) {
        setErrorMessage(
          'Please confirm your email address before signing in.',
        )
      } else {
        setErrorMessage(message)
      }
    } finally {
      setLoading(false)
    }
  }

  const switchMode = () => {
    resetMessages()
    setIsSignUp((current) => !current)
    setPassword('')
    setConfirmPassword('')
  }

  return (
    <div className="min-h-screen bg-[#030303] text-white">
      <div className="relative min-h-screen overflow-hidden">
        {/* Cinematic background */}
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt=""
            className="h-full w-full object-cover"
          />

          <div className="absolute inset-0 bg-black/65" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/35" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />
        </div>

        {/* Ambient glow */}
        <div className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-white/5 blur-3xl" />

        <div className="relative z-10 flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
          <div className="grid w-full max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-black/50 shadow-2xl shadow-black/50 backdrop-blur-xl lg:grid-cols-2">
            {/* Brand side */}
            <div className="hidden min-h-[680px] flex-col justify-between p-10 lg:flex xl:p-14">
              <div>
                <div className="mb-8 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-black shadow-lg">
                    <Play
                      size={19}
                      fill="currentColor"
                      strokeWidth={2.5}
                    />
                  </div>

                  <div>
                    <div className="text-xl font-black tracking-tight">
                      PMF
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/50">
                      Prince Mufasa Flix
                    </div>
                  </div>
                </div>

                <div className="max-w-md">
                  <p className="mb-4 text-xs font-bold uppercase tracking-[0.35em] text-white/50">
                    Your World. Your Stories. Your Flix.
                  </p>

                  <h1 className="text-5xl font-black leading-[0.95] tracking-tight xl:text-6xl">
                    Stories that
                    <br />
                    stay with you.
                  </h1>

                  <p className="mt-7 max-w-sm text-sm leading-7 text-white/60">
                    Discover a cinematic world of movies, series,
                    originals and stories from around the globe.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-white/45">
                <ShieldCheck size={16} />
                <span>
                  Secure account authentication powered by Supabase
                </span>
              </div>
            </div>

            {/* Auth side */}
            <div className="flex min-h-[680px] items-center p-6 sm:p-10 lg:p-12">
              <div className="mx-auto w-full max-w-md">
                {/* Mobile brand */}
                <div className="mb-9 flex items-center gap-3 lg:hidden">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black">
                    <Play
                      size={17}
                      fill="currentColor"
                      strokeWidth={2.5}
                    />
                  </div>

                  <div>
                    <div className="font-black tracking-tight">
                      PMF
                    </div>
                    <div className="text-[9px] font-semibold uppercase tracking-[0.25em] text-white/45">
                      Prince Mufasa Flix
                    </div>
                  </div>
                </div>

                <div className="mb-8">
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.3em] text-white/45">
                    {isSignUp ? 'Join PMF-Flix' : 'Welcome back'}
                  </p>

                  <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
                    {isSignUp
                      ? 'Create your account.'
                      : 'Enter your world.'}
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-white/50">
                    {isSignUp
                      ? 'Create your PMF account and start building your personal entertainment universe.'
                      : 'Sign in to continue watching your stories.'}
                  </p>
                </div>

                {/* Messages */}
                {errorMessage && (
                  <div className="mb-5 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm leading-5 text-red-200">
                    {errorMessage}
                  </div>
                )}

                {successMessage && (
                  <div className="mb-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm leading-5 text-emerald-200">
                    {successMessage}
                  </div>
                )}

                <form
                  onSubmit={handleSubmit}
                  className="space-y-4"
                >
                  {isSignUp && (
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-white/60">
                        Full name
                      </label>

                      <div className="relative">
                        <UserRound
                          size={17}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35"
                        />

                        <input
                          type="text"
                          value={fullName}
                          onChange={(event) =>
                            setFullName(event.target.value)
                          }
                          placeholder="Your name"
                          autoComplete="name"
                          disabled={loading}
                          className="h-13 w-full rounded-2xl border border-white/10 bg-white/5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.07] disabled:opacity-50"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="mb-2 block text-xs font-semibold text-white/60">
                      Email address
                    </label>

                    <div className="relative">
                      <Mail
                        size={17}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35"
                      />

                      <input
                        type="email"
                        value={email}
                        onChange={(event) =>
                          setEmail(event.target.value)
                        }
                        placeholder="you@example.com"
                        autoComplete="email"
                        disabled={loading}
                        className="h-13 w-full rounded-2xl border border-white/10 bg-white/5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.07] disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold text-white/60">
                      Password
                    </label>

                    <div className="relative">
                      <LockKeyhole
                        size={17}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35"
                      />

                      <input
                        type={
                          showPassword ? 'text' : 'password'
                        }
                        value={password}
                        onChange={(event) =>
                          setPassword(event.target.value)
                        }
                        placeholder="••••••••"
                        autoComplete={
                          isSignUp
                            ? 'new-password'
                            : 'current-password'
                        }
                        disabled={loading}
                        className="h-13 w-full rounded-2xl border border-white/10 bg-white/5 pl-11 pr-12 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.07] disabled:opacity-50"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword((value) => !value)
                        }
                        disabled={loading}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-white/35 transition hover:text-white disabled:opacity-40"
                        aria-label={
                          showPassword
                            ? 'Hide password'
                            : 'Show password'
                        }
                      >
                        {showPassword ? (
                          <EyeOff size={17} />
                        ) : (
                          <Eye size={17} />
                        )}
                      </button>
                    </div>
                  </div>

                  {isSignUp && (
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-white/60">
                        Confirm password
                      </label>

                      <div className="relative">
                        <LockKeyhole
                          size={17}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35"
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
                          placeholder="••••••••"
                          autoComplete="new-password"
                          disabled={loading}
                          className="h-13 w-full rounded-2xl border border-white/10 bg-white/5 pl-11 pr-12 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.07] disabled:opacity-50"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setShowConfirmPassword(
                              (value) => !value,
                            )
                          }
                          disabled={loading}
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-white/35 transition hover:text-white disabled:opacity-40"
                          aria-label={
                            showConfirmPassword
                              ? 'Hide password'
                              : 'Show password'
                          }
                        >
                          {showConfirmPassword ? (
                            <EyeOff size={17} />
                          ) : (
                            <Eye size={17} />
                          )}
                        </button>
                      </div>
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
                    {isSignUp ? 'Sign in' : 'Create one'}
                  </button>
                </p>

                <p className="mt-7 text-center text-[10px] leading-5 text-white/25">
                  By continuing, you agree to use PMF-Flix only for
                  lawful, authorized entertainment content.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
 }
