import { useState, useMemo, useEffect } from 'react'
import { supabase } from '../supabase'
import {
  AlertTriangle,
  Info,
  KeyRound,
  Lock,
  Moon,
  Shield,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react'
import type { Movie } from '../movieData/movies'
import type { PMFProfile } from './ProfileSelectionScreen'
import MovieCard from './MovieCard'

interface Midnight18CategoryProps {
  movies: Movie[]
  activeProfile: PMFProfile | null
  onPlayMovie: (movie: Movie) => void
  onSelectMovie: (movie: Movie) => void
  onExitCategory: () => void
}

const AGE_VERIFICATION_STORAGE_KEY = 'pmf_midnight18_verified_v1'
const PARENTAL_PIN_STORAGE_KEY = 'pmf_midnight18_pin_v1'

export default function Midnight18Category({
  movies,
  activeProfile,
  onPlayMovie,
  onSelectMovie,
  onExitCategory,
}: Midnight18CategoryProps) {
  // Is this profile a minor/kids profile?
  const isMinorProfile = activeProfile?.isKids === true
  const [sectionConfig, setSectionConfig] = useState<{
    title: string;
    description: string;
    is_enabled: boolean;
    collection_id: string | null;
    featured_movie_id: number | null;
    artwork_url: string | null;
  }>({
    title: 'Midnight 18+',
    description: 'A curated space for legally licensed, non-explicit mature films and thrillers.',
    is_enabled: true,
    collection_id: null,
    featured_movie_id: null,
    artwork_url: '/images/midnight-18-hero.jpg',
  })

  useEffect(() => {
    let active = true
    const loadSectionConfig = async () => {
      const { data, error } = await supabase
        .from('catalogue_sections')
        .select('title,description,is_enabled,collection_id,featured_movie_id,artwork_url')
        .eq('id', 'midnight-18')
        .maybeSingle()
      if (!active) return
      if (error) {
        console.warn('Midnight section settings could not be loaded:', error.message)
        return
      }
      if (data) {
        setSectionConfig({
          title: data.title || 'Midnight 18+',
          description: data.description || '',
          is_enabled: data.is_enabled !== false,
          collection_id: data.collection_id || null,
          featured_movie_id: data.featured_movie_id ? Number(data.featured_movie_id) : null,
          artwork_url: data.artwork_url || '/images/midnight-18-hero.jpg',
        })
      }
    }
    void loadSectionConfig()
    return () => { active = false }
  }, [])

  // Verification states stored securely per session
  const [isUnlocked, setIsUnlocked] = useState(() => {
    if (isMinorProfile) return false
    try {
      const verified = sessionStorage.getItem(AGE_VERIFICATION_STORAGE_KEY)
      return verified === 'true'
    } catch {
      return false
    }
  })

  const [storedPin, setStoredPin] = useState<string | null>(() => {
    try {
      return localStorage.getItem(PARENTAL_PIN_STORAGE_KEY) || null
    } catch {
      return null
    }
  })

  // Verification form states
  const [birthYear, setBirthYear] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthDay, setBirthDay] = useState('')
  const [enteredPin, setEnteredPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [isSettingPin, setIsSettingPin] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showComplianceInfo, setShowComplianceInfo] = useState(false)

  // Only titles explicitly marked for this vault or carrying an adult classification are included.
  const midnightTitles = useMemo(() => {
    return movies.filter((movie) => {
      const category = (movie.category || '').toLowerCase()
      const rating = String(movie.rating || '').toLowerCase()
      const isVaultTitle =
        Boolean(movie.isMidnight18) ||
        category.includes('midnight') ||
        category.includes('18+') ||
        category.includes('adult') ||
        rating.includes('18+') ||
        rating.includes('nc-17') ||
        rating.includes('tv-ma')
      const matchesCollection =
        !sectionConfig.collection_id ||
        Boolean(movie.collectionIds?.includes(sectionConfig.collection_id))
      return isVaultTitle && matchesCollection
    }).sort((a, b) => {
      if (sectionConfig.featured_movie_id) {
        if (Number(a.id) === sectionConfig.featured_movie_id) return -1
        if (Number(b.id) === sectionConfig.featured_movie_id) return 1
      }
      return 0
    })
  }, [movies, sectionConfig.collection_id, sectionConfig.featured_movie_id])

  // Calculate age from provided date
  const handleVerifyAgeAndUnlock = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (isMinorProfile) {
      setErrorMessage('Access denied: Kids profiles cannot access adult-rated content.')
      return
    }

    const year = parseInt(birthYear, 10)
    const month = parseInt(birthMonth, 10)
    const day = parseInt(birthDay, 10)

    if (isNaN(year) || isNaN(month) || isNaN(day) || year < 1920 || month < 1 || month > 12 || day < 1 || day > 31) {
      setErrorMessage('Please enter a valid legal Date of Birth.')
      return
    }

    const birthDate = new Date(year, month - 1, day)
    if (
      birthDate.getFullYear() !== year ||
      birthDate.getMonth() !== month - 1 ||
      birthDate.getDate() !== day ||
      birthDate.getTime() > Date.now()
    ) {
      setErrorMessage('Please enter a real date of birth that is not in the future.')
      return
    }

    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const m = today.getMonth() - birthDate.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }

    if (age < 18) {
      setErrorMessage('Access restricted: You must be at least 18 years of age to enter this category.')
      return
    }

    // Check PIN requirement
    if (storedPin) {
      if (enteredPin !== storedPin) {
        setErrorMessage('Incorrect 4-digit Parental PIN passcode.')
        return
      }
    } else if (isSettingPin) {
      if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
        setErrorMessage('PIN must be exactly 4 numeric digits.')
        return
      }
      if (newPin !== confirmPin) {
        setErrorMessage('PIN passcodes do not match.')
        return
      }
      try {
        localStorage.setItem(PARENTAL_PIN_STORAGE_KEY, newPin)
        setStoredPin(newPin)
      } catch {}
    }

    // Successfully verified
    try {
      sessionStorage.setItem(AGE_VERIFICATION_STORAGE_KEY, 'true')
    } catch {}

    setIsUnlocked(true)
    setErrorMessage(null)
  }

  const handleLockVault = () => {
    try {
      sessionStorage.removeItem(AGE_VERIFICATION_STORAGE_KEY)
    } catch {}
    setIsUnlocked(false)
  }

  // If this profile is a minor profile, show strict blocker
  if (isMinorProfile) {
    return (
      <div className="min-h-screen bg-[#030208] px-5 pt-32 pb-24 flex items-center justify-center">
        <div className="max-w-md w-full rounded-3xl border border-rose-500/20 bg-rose-950/15 p-8 text-center backdrop-blur-xl shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-400 mb-5">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Parental Restriction Active</h2>
          <p className="mt-2 text-xs text-rose-200/70 leading-relaxed">
            The active profile (<strong className="text-white">{activeProfile.name}</strong>) is designated as a Kids & Family profile.
            Mature 18+ content is strictly prohibited.
          </p>
          <button
            type="button"
            onClick={onExitCategory}
            className="mt-6 w-full rounded-xl bg-white px-5 py-3 text-xs font-black uppercase tracking-wider text-black transition hover:bg-white/90"
          >
            Return to Safe Catalog
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#030208] px-4 sm:px-8 lg:px-16 pt-28 pb-32 text-white">
      {/* Category Header Banner */}
      {!sectionConfig.is_enabled ? (
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <Lock size={28} className="mx-auto mb-3 text-white/35" />
          <h1 className="text-xl font-black text-white">This section is currently unavailable</h1>
          <p className="mt-2 text-sm text-white/50">The PMF-Flix owner has temporarily disabled this catalogue section.</p>
          <button type="button" onClick={onExitCategory} className="mt-5 rounded-xl bg-white px-5 py-2.5 text-xs font-black text-black">Return to PMF-Flix</button>
        </div>
      ) : (
      <>
      <div
        className="midnight18-hero relative mx-auto flex min-h-[360px] max-w-[1600px] items-center overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-[#030208] via-[#090714] to-black p-6 sm:p-10 shadow-2xl mb-10"
        style={{ backgroundImage: `linear-gradient(90deg, rgba(3,2,8,.72) 0%, rgba(3,2,8,.42) 48%, rgba(3,2,8,.12) 100%), url(${sectionConfig.artwork_url || '/images/midnight-18-hero.jpg'})`, backgroundSize: 'cover', backgroundPosition: 'center 38%' }}
      >
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-72 w-72 rounded-full bg-rose-600/10 blur-3xl pointer-events-none" />

        <div className="midnight18-hero-layout relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="midnight18-hero-copy flex flex-col gap-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-md border border-rose-500/40 bg-rose-500/20 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-rose-300">
                <Moon size={11} className="text-rose-400" />
                Midnight 18+
              </span>
              <span className="rounded-md border border-white/20 bg-white/10 px-2 py-0.5 text-[8px] font-black tracking-widest text-white/80">
                ADULT ONLY
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
              {sectionConfig.title || 'Midnight 18+'}
            </h1>
            <p className="text-xs sm:text-sm text-white/60 leading-relaxed">
              A curated destination for licensed mature dramas, sophisticated thrillers and compelling cinema.
            </p>
          </div>

          {/* Right Action: Lock / Unlock & Policy Info */}
          <div className="midnight18-hero-actions flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowComplianceInfo(true)}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-[10px] font-bold text-white/70 hover:bg-white/10 hover:text-white transition"
            >
              <Info size={14} />
              <span>Policy & Compliance</span>
            </button>
            {isUnlocked ? (
              <button
                type="button"
                onClick={handleLockVault}
                className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-500/25 transition active:scale-95"
              >
                <Lock size={14} />
                <span>Lock Vault</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Mandatory Advisory Banner */}
        <div className="midnight18-hero-advisory mt-6 flex items-start gap-3 rounded-2xl border border-white/15 bg-black/45 p-4 backdrop-blur-md">
          <AlertTriangle size={18} className="shrink-0 text-rose-400 mt-0.5" />
          <p className="text-[11px] text-rose-200/80 leading-relaxed">
            <strong>Content Warning:</strong> 18+ only. This catalogue may contain mature themes, strong language and violence. Explicit sexual content is not permitted. Minors are not permitted.
          </p>
        </div>
      </div>
      </>
      )}

      {sectionConfig.is_enabled && (
      <>
      {/* Verification Gate (Shown when not unlocked) */}
      {!isUnlocked ? (
        <div className="mx-auto max-w-lg rounded-3xl border border-white/10 bg-black/60 p-6 sm:p-8 backdrop-blur-2xl shadow-2xl">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-400 mb-3">
              <KeyRound size={26} />
            </div>
            <h2 className="text-xl font-black text-white">Age Confirmation Required</h2>
            <p className="mt-1 text-xs text-white/50">
              Enter your date of birth to confirm you are at least 18. This self-declaration is not identity verification.
            </p>
          </div>

          <form onSubmit={handleVerifyAgeAndUnlock} className="flex flex-col gap-4">
            {/* Date of Birth Inputs */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-white/60 mb-2">
                Date of Birth (YYYY - MM - DD)
              </label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  placeholder="YYYY"
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  min="1920"
                  max={new Date().getFullYear()}
                  required
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-center text-sm font-bold text-white placeholder:text-white/25 focus:border-rose-400 focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="MM"
                  value={birthMonth}
                  onChange={(e) => setBirthMonth(e.target.value)}
                  min="1"
                  max="12"
                  required
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-center text-sm font-bold text-white placeholder:text-white/25 focus:border-rose-400 focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="DD"
                  value={birthDay}
                  onChange={(e) => setBirthDay(e.target.value)}
                  min="1"
                  max="31"
                  required
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-center text-sm font-bold text-white placeholder:text-white/25 focus:border-rose-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Parental PIN Section */}
            {storedPin ? (
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-white/60 mb-1.5">
                  Enter 4-Digit Parental PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  placeholder="••••"
                  value={enteredPin}
                  onChange={(e) => setEnteredPin(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-center text-lg tracking-widest font-bold text-white placeholder:text-white/25 focus:border-rose-400 focus:outline-none"
                />
              </div>
            ) : isSettingPin ? (
              <div className="flex flex-col gap-2">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-white/60 mb-1">
                    Create 4-Digit Parental PIN
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="New PIN"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    required
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-center text-sm font-bold text-white placeholder:text-white/25 focus:border-rose-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-white/60 mb-1">
                    Confirm PIN
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="Confirm PIN"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    required
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-center text-sm font-bold text-white placeholder:text-white/25 focus:border-rose-400 focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                <span className="text-[11px] text-white/60 block">No Parental PIN currently configured.</span>
                <button
                  type="button"
                  onClick={() => setIsSettingPin(true)}
                  className="mt-1 text-xs font-bold text-rose-300 hover:text-rose-200 underline"
                >
                  Set up a 4-digit PIN for extra privacy
                </button>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                <AlertTriangle size={15} className="shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              className="mt-2 w-full rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-purple-600 py-3 text-xs font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-rose-600/20 hover:opacity-95 active:scale-95 transition"
            >
              Confirm Age & Unlock
            </button>
          </form>
        </div>
      ) : (
        /* Unlocked Content Vault */
        <div className="mx-auto max-w-[1600px]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-400" />
              <span className="text-xs font-bold text-white/80">Age Declaration Accepted (18+)</span>
              <span className="text-xs text-white/40">• {midnightTitles.length} Titles Available</span>
            </div>
            <button
              type="button"
              onClick={handleLockVault}
              className="text-xs text-white/50 hover:text-white transition flex items-center gap-1"
            >
              <Lock size={12} />
              <span>Lock Vault</span>
            </button>
          </div>

          {midnightTitles.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center">
              <Moon size={36} className="text-white/20 mb-3" />
              <h3 className="text-lg font-bold text-white">No Midnight Titles Published</h3>
              <p className="mt-1 text-xs text-white/40 max-w-md">
                The platform owner has not yet published adult-rated titles to the production Supabase database.
                Authorized titles published through PMF Studio will appear here securely.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {midnightTitles.map((movie) => (
                <div key={movie.id} className="relative group/adult">
                  <MovieCard
                    {...movie}
                    onClick={() => onSelectMovie(movie)}
                    onPlay={() => onPlayMovie(movie)}
                  />
                  <div className="pointer-events-none absolute top-2 left-2 z-20">
                    <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white shadow">
                      18+
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Compliance Information Modal */}
      {showComplianceInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="max-w-lg w-full rounded-3xl border border-white/15 bg-black/95 p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Shield size={20} className="text-rose-400" />
                <h3 className="text-base font-black text-white uppercase tracking-tight">
                  Midnight 18+ Architecture & Compliance
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowComplianceInfo(false)}
                className="text-white/50 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs text-white/70 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
              <p>
                <strong>1. Legal Protection:</strong> PMF-Flix strictly adheres to applicable content distribution standards. The app applies a local age-declaration gate and blocks Kids profiles in the interface. This is a user-experience control only; it is not identity verification or server-side access enforcement.
              </p>
              <p>
                <strong>2. Minor Profile Isolation:</strong> Profiles flagged as Kids & Family are permanently barred from viewing, searching, or playing any title categorized under Midnight 18+.
              </p>
              <p>
                <strong>3. Google Play Store Compliance Note:</strong> For distribution on Google Play Store, adult sexually explicit content is prohibited under Google Play's Inappropriate Content Policy. Movies distributed in this category must be licensed cinematic feature films (rated TV-MA, R, or equivalent artistic cinema), not unrated or adult pornography.
              </p>
              <p>
                <strong>4. Enterprise KYC Verification:</strong> For jurisdictions requiring government-issued ID checks (such as UK Online Safety Act / US State age-verification laws), an external identity verification provider (e.g. Persona, Jumio, or Stripe Identity) must be connected to Supabase Auth prior to public deployment.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowComplianceInfo(false)}
              className="mt-6 w-full rounded-xl bg-white px-4 py-2.5 text-xs font-black uppercase tracking-wider text-black transition hover:bg-white/90"
            >
              Understood
            </button>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}
