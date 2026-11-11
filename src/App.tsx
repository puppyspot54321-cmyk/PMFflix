import heroImage from './assets/hero.png'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  isUnapprovedDemoMovie,
  type Movie,
} from './movieData/movies'
import { getMovies, isVerifiedOwnerEmail } from './services/movieService'
import { supabase } from './supabase'
import type { Session } from '@supabase/supabase-js'
import AuthScreen from './Auth'
import AdminStudio from './AdminStudio'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Film,
  ListPlus,
  Menu,
  Play,
  Search,
  Sparkles,
  Star,
  Trophy,
  Tv,
  X,
  Download,
  Dice5,
  Globe2,
  Users,
  BookOpen,
  Video,
  Moon,
} from 'lucide-react'
import DiscoveryToolbar from './components/DiscoveryToolbar'
import PMFLogo from './components/PMFLogo'
import OfflineCinemaPage from './components/OfflineCinemaPage'
import PMFBottomNavigation from './components/PMFBottomNavigation'
import PMFShortsExperience from './components/PMFShortsExperience'
import LiveSportsCatalog from './components/LiveSportsCatalog'
import NovelsLibraryCatalog from './components/NovelsLibraryCatalog'
import ShortsComedyCatalog from './components/ShortsComedyCatalog'
import VideoPlayer from './components/VideoPlayer'
import Midnight18Category from './components/Midnight18Category'
import DownloadActionButton from './components/DownloadActionButton'
import { offlineStorage } from './services/offlineStorageService'
import {
  WorldCinemaModal,
  SurpriseMeModal,
  WatchPartyModal,
} from './components/SmartDiscoveryModals'
import {
  TrendingRail,
  BuzzBossSection,
  FreeNovelsSection,
  CinemaTriviaChallenge,
  SpecialtyDestinationsPortal,
} from './components/GlobalDiscoverySections'
import ProfileSelectionScreen, {
  type PMFProfile,
} from './components/ProfileSelectionScreen'

type Section =
  | 'home'
  | 'movies'
  | 'series'
  | 'trending'
  | 'nollywood'
  | 'buzz-boss'
  | 'free-novels'
  | 'my-list'
  | 'offline'
  | 'shorts'
  | 'sports'
  | 'midnight-18'

type SortMode =
  | 'featured'
  | 'newest'
  | 'oldest'
  | 'rating'
  | 'title'

type Filters = {
  category: string
  type: string
  year: string
  rating: string
  sort: SortMode
}

type Profile = {
  name: string
  avatar: string
}

type HistoryItem = {
  movieId: string
  watchedAt: number
}

type Progress = {
  currentTime: number
  duration: number
  updatedAt: number
}

const PROFILE_KEY = 'pmf-profile'
const MY_LIST_KEY = 'pmf-my-list'
const CONTINUE_KEY = 'pmf-continue-watching'
const HISTORY_KEY = 'pmf-watch-history'
const PROGRESS_KEY = 'pmf-watch-progress'

const AVATARS = [
  '🎬',
  '🍿',
  '🔥',
  '⭐',
  '🎭',
  '🚀',
  '👑',
  '🦁',
  '🌌',
  '🎞️',
]

const DEFAULT_PROFILE: Profile = {
  name: 'PMF Member',
  avatar: '🎬',
}

function getProfileStorageKey(key: string, userId?: string, profileId?: string | null): string {
  return userId && profileId ? `${key}:${userId}:${profileId}` : `${key}:no-active-profile`
}

function readStorage<T>(
  key: string,
  fallback: T,
): T {
  try {
    const raw = localStorage.getItem(key)

    if (!raw) {
      return fallback
    }

    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeStorage(
  key: string,
  value: unknown,
) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(value),
    )
  } catch {
    // Local storage can be unavailable in some environments.
  }
}

const PUBLISHED_CATALOG_CACHE_KEY = 'pmf_published_catalog_cache_v1'

function readPublishedCatalogCache(): Movie[] {
  try {
    const raw = localStorage.getItem(PUBLISHED_CATALOG_CACHE_KEY)
    if (!raw) return []
    const cached = JSON.parse(raw) as { savedAt?: number; movies?: Movie[] }
    if (!cached || !Array.isArray(cached.movies) || !Number.isFinite(cached.savedAt)) return []
    // Use the last-known published catalogue immediately; live Supabase refresh below is authoritative.
    return cached.movies.filter((movie) =>
      movie &&
      !isUnapprovedDemoMovie(movie) &&
      (movie.status || 'published') === 'published'
    )
  } catch {
    return []
  }
}

function writePublishedCatalogCache(movies: Movie[]): void {
  try {
    localStorage.setItem(PUBLISHED_CATALOG_CACHE_KEY, JSON.stringify({
      savedAt: Date.now(),
      movies: movies.filter((movie) =>
        !isUnapprovedDemoMovie(movie) &&
        (movie.status || 'published') === 'published'
      ),
    }))
  } catch {
    // Storage can be full or unavailable; the live catalogue remains usable.
  }
}

function persistLiveProgressToStorage(
  movieId: string,
  currentTime: number,
  duration: number,
  storageKey: string = PROGRESS_KEY,
): Record<string, Progress> {
  const existing = readStorage<Record<string, Progress>>(storageKey, {})
  const updated: Record<string, Progress> = {
    ...existing,
    [movieId]: {
      currentTime,
      duration,
      updatedAt: Date.now(),
    },
  }
  writeStorage(storageKey, updated)
  return updated
}

function getMovieId(
  movie: Movie,
): string {
  return String(movie.id)
}

function getRating(
  movie: Movie,
): number {
  const value = Number(
    String(movie.rating ?? '')
      .replace(/[^0-9.]/g, ''),
  )

  return Number.isFinite(value)
    ? value
    : 0
}

function getContentTypeAccent(type: string): string {
  const value = type.toLowerCase()
  if (/series|tv|season|episode/.test(value)) return 'border-sky-400/30 bg-sky-500/10 text-sky-200'
  if (/short|reel|skit/.test(value)) return 'border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-200'
  if (/sport|live/.test(value)) return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
  if (/documentary|docu/.test(value)) return 'border-teal-400/30 bg-teal-500/10 text-teal-200'
  if (/novel|story|book/.test(value)) return 'border-violet-400/30 bg-violet-500/10 text-violet-200'
  if (/special|original|exclusive/.test(value)) return 'border-amber-400/30 bg-amber-500/10 text-amber-100'
  if (/18\+|adult|midnight/.test(value)) return 'border-red-400/40 bg-red-950/70 text-red-200'
  return 'border-orange-400/30 bg-orange-500/10 text-orange-200'
}

function getCategoryAccent(category: string): string {
  const value = category.toLowerCase()
  if (/action|adventure|war|martial/.test(value)) return 'border-orange-400/30 bg-orange-500/10 text-orange-200'
  if (/comedy|family|animation/.test(value)) return 'border-yellow-300/30 bg-yellow-400/10 text-yellow-100'
  if (/drama|romance|love/.test(value)) return 'border-rose-400/30 bg-rose-500/10 text-rose-200'
  if (/thriller|crime|mystery|detective/.test(value)) return 'border-red-400/30 bg-red-500/10 text-red-200'
  if (/horror|supernatural|dark/.test(value)) return 'border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-200'
  if (/science fiction|sci-fi|fantasy|space/.test(value)) return 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100'
  if (/documentary|history|biography/.test(value)) return 'border-teal-400/30 bg-teal-500/10 text-teal-200'
  if (/african|nollywood|nigerian/.test(value)) return 'border-amber-400/30 bg-amber-500/10 text-amber-100'
  if (/sports|football|basketball/.test(value)) return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
  if (/novel|story|book|literature/.test(value)) return 'border-violet-400/30 bg-violet-500/10 text-violet-200'
  if (/18\+|midnight|adult/.test(value)) return 'border-red-400/40 bg-red-950/70 text-red-200'
  return 'border-purple-400/25 bg-purple-500/10 text-purple-200'
}




function AppShell() {
  const [session, setSession] =
    useState<Session | null>(null)

  const [authLoading, setAuthLoading] =
    useState(true)

useEffect(() => {
  let mounted = true
  let authEventOccurred = false

  const loadInitialSession = async () => {
    const {
      data: { session: currentSession },
      error,
    } = await supabase.auth.getSession()

    if (!mounted) {
      return
    }

    if (error) {
      console.error(
        'PMF session restore error:',
        error,
      )
    }

    // Do not let the initial session check
    // overwrite a newer authentication event.
    if (!authEventOccurred) {
      setSession(currentSession)
      setAuthLoading(false)
    }
  }

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(
    (event, nextSession) => {
      if (!mounted) {
        return
      }

      if (
        event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED'
      ) {
        authEventOccurred = true

        // Never replace a valid session with null
        // during a non-sign-out auth event.
        if (nextSession) {
          setSession(nextSession)
        }

        setAuthLoading(false)
        return
      }

      if (event === 'SIGNED_OUT') {
        authEventOccurred = true
        setSession(null)
        setAuthLoading(false)
      }
    },
  )

  void loadInitialSession()

  return () => {
    mounted = false
    subscription.unsubscribe()
  }
}, [])
  
  useEffect(() => {
    const checkStudioAccess = async () => {
      if (!session?.user?.id) {
        setIsStudioAdmin(false)
        setShowStudio(false)
        return
      }

      // PMF-Flix Studio is visible only to the verified owner email.
      // Database editor/admin rows must not expose the Studio UI to other users.
      const allowed = isVerifiedOwnerEmail(session.user.email)
      setIsStudioAdmin(allowed)

      if (!allowed) {
        setShowStudio(false)
      }
    }

    void checkStudioAccess()
  }, [session])

  const [section, setSection] =
    useState<Section>('home')

  const [search, setSearch] =
    useState('')

  const [movies, setMovies] =
    useState<Movie[]>(() => readPublishedCatalogCache())

  const [, setError] =
    useState<string | null>(null)

  const [, setLoading] =
  useState(true)

  const [selectedMovie, setSelectedMovie] =
    useState<Movie | null>(null)

  const [selectedSeason, setSelectedSeason] = useState<{
    seriesTitle: string
    seasonNumber: number
    episodes: Movie[]
  } | null>(null)

  const [watchingMovie, setWatchingMovie] =
    useState<Movie | null>(null)

  const [showWorldCinema, setShowWorldCinema] = useState(false)
  const [showRoulette, setShowRoulette] = useState(false)
  const [watchPartyMovie, setWatchPartyMovie] = useState<Movie | null>(null)
  const [downloadsCount, setDownloadsCount] = useState<number>(() =>
    offlineStorage.getDownloadsCount(),
  )
  const [activeHeroIndex, setActiveHeroIndex] = useState(0)
  const [isHeroPaused, setIsHeroPaused] = useState(false)
  const [heroTouchStartX, setHeroTouchStartX] = useState<number | null>(null)

  useEffect(() => {
    const unsub = offlineStorage.subscribe((list) => {
      setDownloadsCount((prev) => (prev === list.length ? prev : list.length))
    })
    return () => unsub()
  }, [])

  const [profile, setProfile] =
    useState<Profile>(() =>
      readStorage(
        PROFILE_KEY,
        DEFAULT_PROFILE,
      ),
    )

  const [userProfiles, setUserProfiles] = useState<PMFProfile[]>([])
  const [activeProfile, setActiveProfile] = useState<PMFProfile | null>(null)
  const [isSelectingProfile, setIsSelectingProfile] = useState<boolean>(false)

  // Keep device-private offline media and its index isolated to the selected profile.
  useEffect(() => {
    offlineStorage.setActiveProfile(activeProfile?.id ?? null)
  }, [activeProfile?.id])

  // Initialize and synchronize profiles for authenticated session
  useEffect(() => {
    if (!session?.user?.id) {
      setUserProfiles([])
      setActiveProfile(null)
      setIsSelectingProfile(false)
      return
    }

    const userId = session.user.id
    const storageKey = `pmf_profiles_${userId}`
    const activeKey = `pmf_active_profile_${userId}`

    let loadedProfiles: PMFProfile[] = []
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        loadedProfiles = JSON.parse(raw)
      }
    } catch {}

    if (!Array.isArray(loadedProfiles) || loadedProfiles.length === 0) {
      const defaultOwner: PMFProfile = {
        id: `profile-${userId.slice(0, 8)}-1`,
        name:
          session.user.user_metadata?.full_name ||
          session.user.email?.split('@')[0] ||
          'Prince Mufasa',
        avatar: '👑',
        accentColor: 'from-amber-500 to-yellow-600',
        isKids: false,
        createdAt: Date.now(),
      }
      loadedProfiles = [defaultOwner]
      try {
        localStorage.setItem(storageKey, JSON.stringify(loadedProfiles))
      } catch {}
    }

    setUserProfiles(loadedProfiles)

    const savedActiveId = localStorage.getItem(activeKey)
    const matching = loadedProfiles.find((p) => p.id === savedActiveId)
    if (matching) {
      setActiveProfile(matching)
      setProfile({ name: matching.name, avatar: matching.avatar })
      setIsSelectingProfile(false)
    } else {
      setActiveProfile(null)
      setIsSelectingProfile(true)
    }
  }, [session?.user?.id, session?.user?.email, session?.user?.user_metadata?.full_name])

  const handleSelectProfile = (selected: PMFProfile) => {
    setActiveProfile(selected)
    setProfile({ name: selected.name, avatar: selected.avatar })
    if (session?.user?.id) {
      try {
        localStorage.setItem(`pmf_active_profile_${session.user.id}`, selected.id)
      } catch {}
    }
    setIsSelectingProfile(false)
  }

  const handleCreateProfile = (data: Omit<PMFProfile, 'id' | 'createdAt'>) => {
    if (!session?.user?.id) return
    const newProfile: PMFProfile = {
      ...data,
      id: `profile-${session.user.id.slice(0, 8)}-${Date.now()}`,
      createdAt: Date.now(),
    }
    const updated = [...userProfiles, newProfile]
    setUserProfiles(updated)
    try {
      localStorage.setItem(`pmf_profiles_${session.user.id}`, JSON.stringify(updated))
    } catch {}
    handleSelectProfile(newProfile)
  }

  const handleUpdateProfile = (updatedProfile: PMFProfile) => {
    if (!session?.user?.id) return
    const updated = userProfiles.map((p) => (p.id === updatedProfile.id ? updatedProfile : p))
    setUserProfiles(updated)
    try {
      localStorage.setItem(`pmf_profiles_${session.user.id}`, JSON.stringify(updated))
    } catch {}
    if (activeProfile?.id === updatedProfile.id) {
      setActiveProfile(updatedProfile)
      setProfile({ name: updatedProfile.name, avatar: updatedProfile.avatar })
    }
  }

  const handleDeleteProfile = (profileId: string) => {
    if (!session?.user?.id) return
    if (userProfiles.length <= 1) return
    const updated = userProfiles.filter((p) => p.id !== profileId)
    setUserProfiles(updated)
    try {
      localStorage.setItem(`pmf_profiles_${session.user.id}`, JSON.stringify(updated))
    } catch {}
    if (activeProfile?.id === profileId) {
      const fallback = updated[0] || null
      if (fallback) {
        handleSelectProfile(fallback)
      } else {
        setActiveProfile(null)
        setIsSelectingProfile(true)
      }
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setActiveProfile(null)
    setIsSelectingProfile(false)
    setShowProfile(false)
  }

  const [myList, setMyList] = useState<string[]>([])
  const [continueWatching, setContinueWatching] = useState<string[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [progress, setProgress] = useState<Record<string, Progress>>({})

  const profileStorageKey = (key: string) =>
    getProfileStorageKey(key, session?.user?.id, activeProfile?.id)

  useEffect(() => {
    if (!session?.user?.id || !activeProfile?.id) {
      setMyList([])
      setContinueWatching([])
      setHistory([])
      setProgress({})
      return
    }
    setMyList(readStorage(profileStorageKey(MY_LIST_KEY), []))
    setContinueWatching(readStorage(profileStorageKey(CONTINUE_KEY), []))
    setHistory(readStorage(profileStorageKey(HISTORY_KEY), []))
    setProgress(readStorage(profileStorageKey(PROGRESS_KEY), {}))
  }, [session?.user?.id, activeProfile?.id])

  const [filters, setFilters] =
    useState<Filters>({
      category: 'All',
      type: 'All',
      year: 'All',
      rating: '0',
      sort: 'featured',
    })

  const [showFilters, setShowFilters] =
    useState(false)

  const [showProfile, setShowProfile] =
    useState(false)

  const [showStudio, setShowStudio] =
    useState(false)

  const [isStudioAdmin, setIsStudioAdmin] =
    useState(false)

  const [mobileMenu, setMobileMenu] =
    useState(false)

  const [theaterMode, setTheaterMode] =
    useState(false)

  const getNextMovie = () => {
    if (!watchingMovie) {
      return null
    }

    const index =
      movies.findIndex(
        (movie) =>
          getMovieId(movie) ===
          getMovieId(
            watchingMovie,
          ),
      )

    if (
      index < 0 ||
      movies.length < 2
    ) {
      return null
    }

    return (
      movies[
        (index + 1) %
          movies.length
      ] || null
    )
  }

  const heroMovieIdRef =
    useRef<string | null>(null)

  const [toastMessage] = useState<string | null>(null)

  useEffect(() => {
    writeStorage(
      PROFILE_KEY,
      profile,
    )
  }, [profile])

  useEffect(() => {
    if (session?.user?.id && activeProfile?.id) writeStorage(profileStorageKey(MY_LIST_KEY), myList)
  }, [myList, session?.user?.id, activeProfile?.id])

  useEffect(() => {
    if (session?.user?.id && activeProfile?.id) writeStorage(profileStorageKey(CONTINUE_KEY), continueWatching)
  }, [continueWatching, session?.user?.id, activeProfile?.id])

  useEffect(() => {
    if (session?.user?.id && activeProfile?.id) writeStorage(profileStorageKey(HISTORY_KEY), history)
  }, [history, session?.user?.id, activeProfile?.id])

  useEffect(() => {
    if (session?.user?.id && activeProfile?.id) writeStorage(profileStorageKey(PROGRESS_KEY), progress)
  }, [progress, session?.user?.id, activeProfile?.id])

  useEffect(() => {
    let active = true

    const loadMovies = async (isSilent = false) => {
      try {
        if (!isSilent) {
          setLoading(true)
        }
        setError(null)

        const result =
          await getMovies()

        if (!active) {
          return
        }

        // A successful response is authoritative (including an empty catalogue),
        // so deleted/unpublished titles are removed from both UI and cache.
        setMovies(result)
        writePublishedCatalogCache(result)
      } catch (loadError) {
        console.warn(
          'PMF Supabase catalogue refresh failed; hiding stale bundled catalogue:',
          loadError,
        )
        // Keep the last known good catalogue visible on transient failures.
        // Initial state uses a short-lived cache, avoiding a blank page on reopen.
        // A successful Supabase response always replaces this with authoritative data.
      } finally {
        if (active && !isSilent) {
          setLoading(false)
        }
      }
    }

    void loadMovies(false)

    const handleLocalStudioUpdate = () => {
      void loadMovies(true)
    }
    window.addEventListener('pmf-movies-updated', handleLocalStudioUpdate)

    const channel =
      supabase
        .channel(
          'pmf-movie-updates',
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'movies',
          },
          () => {
            void loadMovies(true)
          },
        )
        .subscribe()

    return () => {
      active = false
      window.removeEventListener('pmf-movies-updated', handleLocalStudioUpdate)

      void supabase.removeChannel(
        channel,
      )
    }
  }, [])

  const isInMyList = (
    movie: Movie,
  ) =>
    myList.includes(
      getMovieId(movie),
    )

  const toggleMyList = (
    movie: Movie,
  ) => {
    const id = getMovieId(movie)

    setMyList((current) =>
      current.includes(id)
        ? current.filter(
            (item) => item !== id,
          )
        : [id, ...current],
    )
  }

  const addToHistory = (
    movie: Movie,
  ) => {
    const id = getMovieId(movie)

    setHistory((current) =>
      [
        {
          movieId: id,
          watchedAt: Date.now(),
        },
        ...current.filter(
          (item) =>
            item.movieId !== id,
        ),
      ].slice(0, 50),
    )
  }

  const addToContinueWatching = (
    movie: Movie,
  ) => {
    const id = getMovieId(movie)

    setContinueWatching(
      (current) => [
        id,
        ...current.filter(
          (item) => item !== id,
        ),
      ],
    )
  }

  const [watchingInitialTime, setWatchingInitialTime] = useState<number>(0)

  const getProgress = (
    movie: Movie,
  ): Progress =>
    progress[getMovieId(movie)] || {
      currentTime: 0,
      duration: 0,
      updatedAt: 0,
    }

  const saveProgress = (
    movie: Movie,
    currentTime: number,
    duration: number,
    flushToState = false,
  ) => {
    if (
      currentTime <= 0 ||
      duration <= 0
    ) {
      return
    }

    if (!session?.user?.id || !activeProfile?.id) return

    const updatedMap = persistLiveProgressToStorage(
      getMovieId(movie),
      currentTime,
      duration,
      profileStorageKey(PROGRESS_KEY),
    )

    if (flushToState) {
      setProgress(updatedMap)
    }
  }

  const openMovie = (
    movie: Movie,
  ) => {
    setSelectedSeason(null)
    setSelectedMovie(movie)
  }

  const openSeason = (
    seriesTitle: string,
    seasonNumber: number,
    episodes: Movie[],
  ) => {
    setSelectedMovie(null)
    setSelectedSeason({
      seriesTitle,
      seasonNumber,
      episodes: [...episodes].sort(
        (a, b) => Number(a.episodeNumber || 0) - Number(b.episodeNumber || 0),
      ),
    })
  }

  const startWatching = (
    movie: Movie,
    customPlaybackUrl?: string,
  ) => {
    const storedMap = readStorage<Record<string, Progress>>(profileStorageKey(PROGRESS_KEY), {})
    const saved = storedMap[getMovieId(movie)] || progress[getMovieId(movie)]
    setWatchingInitialTime(saved?.currentTime || 0)
    setSelectedMovie(null)
    setSelectedSeason(null)
    setWatchingMovie(
      customPlaybackUrl
        ? { ...movie, videoUrl: customPlaybackUrl, videoType: 'mp4' }
        : movie,
    )
    addToHistory(movie)
    addToContinueWatching(movie)
  }

  const closePlayer = () => {
    setProgress(readStorage<Record<string, Progress>>(profileStorageKey(PROGRESS_KEY), {}))
    setWatchingMovie(null)
    setTheaterMode(false)
  }

  const navigate = (
    next: Section,
  ) => {
    setSection(next)
    setSearch('')
    setShowFilters(false)
    setMobileMenu(false)
    setSelectedMovie(null)
    setSelectedSeason(null)

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  const normalizedSearch =
    search.trim().toLowerCase()

  const safeCatalogMovies = useMemo(() => {
    return movies.filter((m) => {
      if (isUnapprovedDemoMovie(m)) {
        return false
      }
      if (m.status && m.status !== 'published') {
        return false
      }
      const isMature =
        Boolean(m.isMidnight18) ||
        /18\+|midnight|adult|nc-17|tv-ma|explicit/i.test(
          `${m.category || ''} ${m.rating || ''} ${m.title || ''}`,
        )
      if (isMature) {
        return false
      }
      if (activeProfile?.isKids) {
        return (
          Boolean(m.isKids) ||
          ['Animation', 'Adventure', 'Family', 'Kids', 'Comedy', 'Fantasy', 'Documentary'].some(
            (cat) => (m.category || '').toLowerCase().includes(cat.toLowerCase()),
          )
        )
      }
      return true
    })
  }, [movies, activeProfile?.isKids])

  const searchableMovies = useMemo(() => {
    return safeCatalogMovies.filter((movie) =>
      [
        movie.title,
        movie.seriesTitle,
        movie.seasonNumber,
        movie.episodeNumber,
        movie.description,
        movie.category,
        movie.type,
        movie.year,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch),
    )
  }, [safeCatalogMovies, normalizedSearch])

  const filteredMovies = useMemo(() => {
    let result = [
      ...searchableMovies,
    ]

    if (section === 'movies') {
      result = result.filter(
        (movie) =>
          String(
            movie.type || '',
          ).toLowerCase() !==
          'series',
      )
    }

    if (section === 'series') {
      result = result.filter(
        (movie) =>
          String(
            movie.type || '',
          ).toLowerCase() ===
          'series',
      )
    }

    if (
      filters.category !== 'All'
    ) {
      result = result.filter(
        (movie) =>
          String(
            movie.category || '',
          ).toLowerCase().includes(filters.category.toLowerCase()) ||
          String(
            movie.category || '',
          ) === filters.category,
      )
    }

    if (filters.type !== 'All') {
      result = result.filter(
        (movie) =>
          String(
            movie.type || '',
          ).toLowerCase() ===
          filters.type.toLowerCase(),
      )
    }

    if (filters.year !== 'All') {
      result = result.filter(
        (movie) =>
          String(movie.year) ===
          filters.year,
      )
    }

    const minimumRating =
      Number(filters.rating)

    if (
      minimumRating > 0
    ) {
      result = result.filter(
        (movie) =>
          getRating(movie) >=
          minimumRating,
      )
    }

    switch (filters.sort) {
      case 'newest':
        result.sort(
          (a, b) =>
            Number(b.year || 0) -
            Number(a.year || 0),
        )
        break

      case 'oldest':
        result.sort(
          (a, b) =>
            Number(a.year || 0) -
            Number(b.year || 0),
        )
        break

      case 'rating':
        result.sort(
          (a, b) =>
            getRating(b) -
            getRating(a),
        )
        break

      case 'title':
        result.sort(
          (a, b) =>
            a.title.localeCompare(
              b.title,
            ),
        )
        break

      default:
        result.sort(
          (a, b) =>
            Number(Boolean(b.featured)) -
            Number(Boolean(a.featured)),
        )
    }

    if (activeProfile?.isKids) {
      result = result.filter(
        (movie) =>
          !movie.isMidnight18 &&
          (movie.isKids ||
            ['Animation', 'Adventure', 'Family', 'Kids', 'Comedy', 'Fantasy'].some(
              (cat) =>
                (movie.category || '')
                  .toLowerCase()
                  .includes(cat.toLowerCase()),
            )),
      )
    }

    return result
  }, [
    searchableMovies,
    section,
    filters,
    activeProfile?.isKids,
  ])

  const findSafeMovie = (id: string) =>
    safeCatalogMovies.find((movie) => getMovieId(movie) === id)

  const myListMovies = useMemo(
    () =>
      myList
        .map((id) => safeCatalogMovies.find((movie) => getMovieId(movie) === id))
        .filter(
          (
            movie,
          ): movie is Movie =>
            Boolean(movie),
        ),
    [myList, safeCatalogMovies],
  )

  const continueMovies = useMemo(
    () =>
      continueWatching
        .map((id) => safeCatalogMovies.find((movie) => getMovieId(movie) === id))
        .filter(
          (
            movie,
          ): movie is Movie =>
            Boolean(movie),
        ),
    [
      continueWatching,
      safeCatalogMovies,
    ],
  )

  const historyMovies = useMemo(
    () =>
      [...history]
        .sort(
          (a, b) =>
            b.watchedAt -
            a.watchedAt,
        )
        .map((item) =>
          safeCatalogMovies.find((movie) => getMovieId(movie) === item.movieId),
        )
        .filter(
          (
            movie,
          ): movie is Movie =>
            Boolean(movie),
        ),
    [history, safeCatalogMovies],
  )

  const trendingMovies = useMemo(
    () =>
      [...safeCatalogMovies]
        .sort(
          (a, b) =>
            getRating(b) -
            getRating(a),
        )
        .slice(0, 12),
    [safeCatalogMovies],
  )

  const latestMovies = useMemo(
    () =>
      [...safeCatalogMovies]
        .sort(
          (a, b) =>
            Number(b.year || 0) -
            Number(a.year || 0),
        )
        .slice(0, 12),
    [safeCatalogMovies],
  )

  const africanAndNollywoodMovies = useMemo(
    () =>
      safeCatalogMovies
        .filter((movie) =>
          /african|nollywood|nigeria|ghana|south africa|kenya/i.test(
            `${movie.category || ''} ${movie.description || ''} ${movie.title || ''}`,
          ),
        )
        .slice(0, 12),
    [safeCatalogMovies],
  )

  const seriesRankings = useMemo(
    () =>
      safeCatalogMovies
        .filter((movie) => {
          const type = String(movie.type || '').toLowerCase()
          return (
            type.includes('series') ||
            type.includes('tv') ||
            type.includes('anime')
          )
        })
        .slice(0, 10),
    [safeCatalogMovies],
  )

  const featuredMovies = useMemo(() => {
    const featured = safeCatalogMovies
      .filter(
        (movie) =>
          movie.featured,
      )
      .slice()
      .sort((a, b) =>
        getMovieId(a).localeCompare(
          getMovieId(b),
        ),
      )

    if (!featured.length) {
      return []
    }

    const remembered =
      heroMovieIdRef.current

    if (remembered) {
      const existing =
        featured.find(
          (movie) =>
            getMovieId(movie) ===
            remembered,
        )

      if (existing) {
        return [existing, ...featured.filter(
          (movie) =>
            getMovieId(movie) !==
            remembered,
        )]
      }
    }

    heroMovieIdRef.current =
      getMovieId(featured[0])

    return featured
  }, [safeCatalogMovies])

  const heroCandidates = useMemo(() => {
    const list = featuredMovies.length > 0 ? featuredMovies : safeCatalogMovies
    return list.slice(0, 6)
  }, [featuredMovies, safeCatalogMovies])

  useEffect(() => {
    if (heroCandidates.length <= 1) return
    if (isHeroPaused) return
    if (watchingMovie) return

    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return
    }

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return
      }

      setActiveHeroIndex((prev) => {
        const next = (prev + 1) % heroCandidates.length
        const preloadNext = heroCandidates[(next + 1) % heroCandidates.length]
        if (preloadNext && preloadNext.poster) {
          const img = new Image()
          img.src = preloadNext.poster
        }
        return next
      })
    }, 7000)

    return () => clearInterval(interval)
  }, [heroCandidates, isHeroPaused, watchingMovie])

  const personalizedMovies =
    useMemo(() => {
      const watchedCategories =
        new Map<
          string,
          number
        >()

      historyMovies.forEach(
        (movie, index) => {
          const category =
            String(
              movie.category || '',
            )
              .trim()
              .toLowerCase()

          if (!category) {
            return
          }

          watchedCategories.set(
            category,
            (watchedCategories.get(
              category,
            ) || 0) +
              Math.max(
                1,
                10 - index,
              ),
          )
        },
      )

      const scored = safeCatalogMovies
        .filter(
          (movie) =>
            !history.some(
              (item) =>
                item.movieId ===
                getMovieId(movie),
            ),
        )
        .map((movie) => {
          const category =
            String(
              movie.category || '',
            )
              .trim()
              .toLowerCase()

          const preference =
            watchedCategories.get(
              category,
            ) || 0

          const ratingScore =
            getRating(movie) * 2

          const featuredScore =
            movie.featured ? 5 : 0

          const freshnessScore =
            Number(movie.year || 0) /
            1000

          return {
            movie,
            score:
              preference +
              ratingScore +
              featuredScore +
              freshnessScore,
          }
        })
        .sort(
          (a, b) =>
            b.score - a.score,
        )
        .map(
          (item) =>
            item.movie,
        )

      return (
        scored.length
          ? scored
          : trendingMovies
      ).slice(0, 12)
    }, [
      safeCatalogMovies,
      history,
      historyMovies,
      trendingMovies,
    ])

  const categoryRows = useMemo(
    () => {
      const seen =
        new Set<string>()

      return safeCatalogMovies
        .map(
          (movie) =>
            String(
              movie.category || '',
            ).trim(),
        )
        .filter(
          (category) => {
            if (
              !category ||
              seen.has(category)
            ) {
              return false
            }

            seen.add(category)
            return true
          },
        )
        .slice(0, 8)
        .map((category) => ({
          category,
          items: safeCatalogMovies
            .filter(
              (movie) =>
                String(
                  movie.category || '',
                ).toLowerCase() ===
                category.toLowerCase(),
            )
            .slice(0, 10),
        }))
    },
    [safeCatalogMovies],
  )
    
  const playNextMovie = (
    movie: Movie,
  ) => {
    const storedMap = readStorage<Record<string, Progress>>(profileStorageKey(PROGRESS_KEY), {})
    setProgress(storedMap)
    const saved = storedMap[getMovieId(movie)] || progress[getMovieId(movie)]
    setWatchingInitialTime(saved?.currentTime || 0)
    setSelectedMovie(null)
    setWatchingMovie(movie)
    addToHistory(movie)
    addToContinueWatching(movie)
  }
  
  const saveProfile = () => {
    setProfile(
      (current) => ({
        ...current,
        name:
          current.name.trim() ||
          'PMF Member',
        avatar:
          current.avatar ||
          '🎬',
      }),
    )

    setShowProfile(false)
  }

  
    const resetFilters = () => {
    setFilters({
      category: 'All',
      type: 'All',
      year: 'All',
      rating: '0',
      sort: 'featured',
    })
   }

  const clearSearch = () => {
    setSearch('')
  }

 const getMoviePoster = (
    movie: Movie,
  ) =>
    movie.poster ||
    heroImage

  const getProgressPercent = (
    movie: Movie,
  ) => {
    const item =
      getProgress(movie)

    if (
      item.duration <= 0 ||
      item.currentTime <= 0
    ) {
      return 0
    }

    return Math.min(
      100,
      Math.max(
        0,
        (item.currentTime /
          item.duration) *
          100,
      ),
    )
  }
  
const MovieCard = ({
  movie,
  compact = false,
  onClick,
  collectionMeta,
  isSeasonCollection = false,
}: {
  movie: Movie
  compact?: boolean
  onClick?: () => void
  collectionMeta?: string
  isSeasonCollection?: boolean
}) => {
  const progressPercent =
    getProgressPercent(movie)

  const saved = isInMyList(movie)
  const isAdultTitle = Boolean(movie.isMidnight18) || /18\+|midnight|adult/i.test(`${movie.category || ''} ${movie.rating || ''}`)
  const catalogText = `${movie.category || ''} ${movie.type || ''} ${movie.title || ''}`.toLowerCase()
  const categoryAccent = isAdultTitle
    ? 'rose'
    : /african|nollywood/.test(catalogText)
      ? 'amber'
      : /original|exclusive/.test(catalogText)
        ? 'cyan'
        : /sport|match|live/.test(catalogText)
          ? 'emerald'
          : /short|skit|comedy/.test(catalogText)
            ? 'orange'
            : 'purple'
  const cardAccent = {
    rose: 'border-rose-500/35 shadow-[0_18px_55px_rgba(0,0,0,0.32),0_0_28px_rgba(244,63,94,0.12)] group-hover/card:border-rose-400/60 group-hover/card:shadow-[0_24px_70px_rgba(0,0,0,0.48),0_0_38px_rgba(244,63,94,0.2)]',
    amber: 'border-amber-400/20 group-hover/card:border-amber-300/45 group-hover/card:shadow-[0_24px_70px_rgba(0,0,0,0.48),0_0_38px_rgba(245,158,11,0.16)]',
    cyan: 'border-cyan-300/20 group-hover/card:border-cyan-200/45 group-hover/card:shadow-[0_24px_70px_rgba(0,0,0,0.48),0_0_38px_rgba(34,211,238,0.16)]',
    emerald: 'border-emerald-300/20 group-hover/card:border-emerald-200/45 group-hover/card:shadow-[0_24px_70px_rgba(0,0,0,0.48),0_0_38px_rgba(16,185,129,0.16)]',
    orange: 'border-orange-300/20 group-hover/card:border-orange-200/45 group-hover/card:shadow-[0_24px_70px_rgba(0,0,0,0.48),0_0_38px_rgba(249,115,22,0.16)]',
    purple: 'border-purple-300/[0.08] group-hover/card:border-purple-300/20 group-hover/card:shadow-[0_24px_70px_rgba(0,0,0,0.48),0_0_38px_rgba(168,85,247,0.10)]',
  }[categoryAccent]
  const badgeAccent = {
    rose: 'border-rose-400/50 bg-rose-950/80 shadow-[0_0_22px_rgba(244,63,94,0.3)]',
    amber: 'border-amber-400/40 bg-amber-950/70 shadow-[0_0_22px_rgba(245,158,11,0.2)]',
    cyan: 'border-cyan-300/40 bg-cyan-950/70 shadow-[0_0_22px_rgba(34,211,238,0.2)]',
    emerald: 'border-emerald-300/40 bg-emerald-950/70 shadow-[0_0_22px_rgba(16,185,129,0.2)]',
    orange: 'border-orange-300/40 bg-orange-950/70 shadow-[0_0_22px_rgba(249,115,22,0.2)]',
    purple: 'border-purple-300/15 bg-black/55',
  }[categoryAccent]
  const glowAccent = {
    rose: 'bg-[radial-gradient(circle_at_75%_20%,rgba(244,63,94,0.25),transparent_42%)]',
    amber: 'bg-[radial-gradient(circle_at_75%_20%,rgba(245,158,11,0.2),transparent_42%)]',
    cyan: 'bg-[radial-gradient(circle_at_75%_20%,rgba(34,211,238,0.2),transparent_42%)]',
    emerald: 'bg-[radial-gradient(circle_at_75%_20%,rgba(16,185,129,0.2),transparent_42%)]',
    orange: 'bg-[radial-gradient(circle_at_75%_20%,rgba(249,115,22,0.2),transparent_42%)]',
    purple: 'bg-[radial-gradient(circle_at_75%_20%,rgba(168,85,247,0.18),transparent_35%)]',
  }[categoryAccent]

  return (
    <article
      className={`pmf-home-card group/card relative shrink-0 transition-transform duration-300 hover:z-20 focus-within:z-20 ${
        compact
          ? 'pmf-home-card--compact w-[118px] sm:w-[158px]'
          : 'pmf-home-card--standard w-[132px] sm:w-[184px] lg:w-[205px]'
      }`}
    >
      <div className={`relative overflow-hidden rounded-[15px] border ${cardAccent} bg-[#080611] shadow-[0_12px_36px_rgba(0,0,0,0.28)] transition-all duration-300 ease-out group-hover/card:-translate-y-1 group-hover/card:shadow-[0_20px_48px_rgba(0,0,0,0.46)] motion-reduce:transition-none`}>

        {/* Poster */}
        <button
          type="button"
          onClick={() =>
            onClick ? onClick() : openMovie(movie)
          }
          className="block w-full text-left"
        >
          <div className="relative aspect-[2/3] overflow-hidden bg-[#05040b]">

            <img
              src={getMoviePoster(movie)}
              alt={movie.title}
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover/card:scale-[1.045] motion-reduce:transition-none"
              loading="lazy"
            />

            {/* Cinematic colour treatment */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#030208] via-transparent to-transparent opacity-95" />

            <div className={`absolute inset-0 opacity-70 transition-opacity duration-500 group-hover/card:opacity-100 ${glowAccent}`} />

            {/* Subtle poster sheen */}
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.07] to-transparent transition-transform duration-1000 group-hover/card:translate-x-full" />

            {/* Premium content classification */}
            <div className={`absolute left-2 top-2 flex items-center gap-1 rounded-full border px-2 py-1 backdrop-blur-xl ${badgeAccent} opacity-0 transition-opacity duration-300 group-hover/card:opacity-100`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isAdultTitle ? 'bg-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.9)]' : 'bg-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.9)]'}`} />
              <span className={`text-[6px] font-black uppercase tracking-[0.2em] ${isAdultTitle ? 'text-rose-100' : 'text-white/60'}`}>
                {isAdultTitle ? '18+ • Restricted' : 'PMF'}
              </span>
            </div>

            {/* Featured marker */}
            {movie.featured && (
              <div className="absolute right-2 top-2 rounded-full border border-[#d8b36a]/20 bg-[#080611]/75 px-2 py-1 backdrop-blur-xl opacity-0 transition-opacity duration-300 group-hover/card:opacity-100">
                <span className="text-[6px] font-black uppercase tracking-[0.16em] text-[#d8b36a]">
                  Featured
                </span>
              </div>
            )}

            {/* Hover play */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 transition-all duration-300 group-hover/card:bg-black/20 group-hover/card:opacity-100">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/25 bg-purple-500/85 text-white shadow-[0_0_35px_rgba(168,85,247,0.35)] backdrop-blur-md transition-transform duration-300 group-hover/card:scale-100">
                <Play
                  size={16}
                  fill="currentColor"
                  className="ml-0.5"
                />
              </div>
            </div>

            {/* Progress */}
            {progressPercent > 0 && (
              <div className="absolute inset-x-3 bottom-3">
                <div className="h-1 overflow-hidden rounded-full bg-white/15 backdrop-blur">
                  <div
                    className="h-full rounded-full bg-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.75)]"
                    style={{
                      width: `${progressPercent}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Card information */}
          <div className="relative px-2.5 pb-2.5 pt-2.5 sm:px-3 sm:pb-3 sm:pt-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="min-w-0 truncate text-[13px] font-black tracking-[-0.02em] text-white transition-colors duration-300 group-hover/card:text-purple-200">
                {movie.title}
              </h3>
            </div>

            <div className="mt-1.5 flex items-center gap-1.5 overflow-hidden sm:gap-2">
              {collectionMeta ? (
                <span className="max-w-full truncate text-[8px] font-black uppercase tracking-[0.12em] text-purple-200/80">
                  {collectionMeta}
                </span>
              ) : (
                <>
                  <span className="shrink-0 text-[8px] font-black uppercase tracking-[0.12em] text-purple-200/80">
                    {movie.year}
                  </span>

                  <span className="h-0.5 w-0.5 shrink-0 rounded-full bg-white/20" />

                  <span className={`max-w-[82px] truncate rounded-md border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] ${getContentTypeAccent(movie.type || 'Film')}`}>
                    {movie.type || 'Film'}
                  </span>

                  {movie.category && (
                    <>
                      <span className="h-0.5 w-0.5 shrink-0 rounded-full bg-white/15" />

                      <span className={`max-w-[100px] truncate rounded-md border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] ${getCategoryAccent(movie.category)}`}>
                        {movie.category}
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </button>

        {/* My List */}
        {!isSeasonCollection && <button
          type="button"
          onClick={() =>
            toggleMyList(movie)
          }
          className={`absolute bottom-[54px] right-3 flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-xl transition-all duration-300 active:scale-90 ${
            saved
              ? 'border-purple-300/30 bg-purple-500/20 text-purple-200 shadow-[0_0_20px_rgba(168,85,247,0.16)]'
              : 'border-white/10 bg-black/55 text-white/55 hover:border-purple-300/25 hover:bg-purple-500/15 hover:text-purple-200'
          }`}
          aria-label={
            saved
              ? 'Remove from My List'
              : 'Add to My List'
          }
        >
          {saved ? (
            <Check size={12} />
          ) : (
            <ListPlus size={12} />
          )}
        </button>}
      </div>
    </article>
  )
                }
                
  const SectionTitle = ({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  action?: ReactNode
}) => (
  <div className="group/section relative mb-6 flex items-end justify-between gap-4">
    <div className="relative min-w-0">
      {/* Cinematic section light */}
      <div className="pointer-events-none absolute -left-8 -top-8 h-20 w-32 rounded-full bg-purple-500/10 blur-3xl transition-all duration-700 group-hover/section:bg-purple-500/20" />

      {eyebrow && (
        <div className="relative mb-2 flex items-center gap-2">
          <span className="h-px w-6 bg-gradient-to-r from-purple-400/80 to-transparent" />

          <p className="text-[7px] font-black uppercase tracking-[0.28em] text-purple-300/65">
            {eyebrow}
          </p>

          <span className="h-1 w-1 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
        </div>
      )}

      <div className="relative flex items-center gap-3">
        <h2 className="text-xl font-black tracking-[-0.04em] text-white sm:text-2xl">
          {title}
        </h2>

        <span className="hidden h-px w-12 bg-gradient-to-r from-purple-400/40 to-transparent sm:block" />
      </div>

      {subtitle && (
        <p className="mt-1.5 max-w-2xl text-[10px] leading-5 text-white/30 sm:text-xs">
          {subtitle}
        </p>
      )}
    </div>

    {action && (
      <div className="relative shrink-0">
        {action}
      </div>
    )}
  </div>
)
  
  
  const MovieRow = ({
    title,
    subtitle,
    items,
    eyebrow,
    isTop10 = false,
  }: {
    title: string
    subtitle?: string
    items: Movie[]
    eyebrow?: string
    isTop10?: boolean
  }) => {
    if (!items.length) {
      return null
    }

    const scroll = (
      e: React.MouseEvent<HTMLButtonElement>,
      direction: 'left' | 'right',
    ) => {
      const scroller = e.currentTarget.parentElement?.querySelector(
        '[data-row-scroller]',
      ) as HTMLElement | null
      if (scroller) {
        const offset = direction === 'left' ? -500 : 500
        scroller.scrollBy({ left: offset, behavior: 'smooth' })
      }
    }

    return (
      <section className="group/row relative mb-12">
        {SectionTitle({
          eyebrow,
          title,
          subtitle,
        })}

        <div className="relative">
          {/* Left Arrow */}
          <button
            type="button"
            onClick={(e) => scroll(e, 'left')}
            aria-label={`Scroll ${title} left`}
            className="absolute -left-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/85 text-white shadow-2xl backdrop-blur-xl transition hover:scale-110 hover:bg-white hover:text-black md:group-hover/row:flex"
          >
            <ChevronLeft size={20} />
          </button>

          {/* Right Arrow */}
          <button
            type="button"
            onClick={(e) => scroll(e, 'right')}
            aria-label={`Scroll ${title} right`}
            className="absolute -right-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/85 text-white shadow-2xl backdrop-blur-xl transition hover:scale-110 hover:bg-white hover:text-black md:group-hover/row:flex"
          >
            <ChevronRight size={20} />
          </button>

          <div
            data-row-scroller="true"
            className="no-scrollbar flex snap-x snap-proximity gap-2 overflow-x-auto pb-3 scroll-smooth sm:gap-3 sm:pb-4"
          >
            {items.map((movie, index) => {
              if (isTop10) {
                return (
                  <div
                    key={getMovieId(movie)}
                    className="relative flex shrink-0 items-end"
                  >
                    <span className="z-0 -mr-6 select-none font-sans text-8xl font-black leading-none tracking-tighter text-white/[0.18] drop-shadow-[0_4px_12px_rgba(0,0,0,0.85)] transition-colors sm:text-9xl">
                      {index + 1}
                    </span>
                    <div className="relative z-10">
                      {MovieCard({ movie })}
                    </div>
                  </div>
                )
              }

              return (
                <div key={getMovieId(movie)} className="shrink-0">
                  {MovieCard({ movie })}
                </div>
              )
            })}
          </div>
        </div>
      </section>
    )
  }

  const MovieGrid = ({
    items,
  }: {
    items: Movie[]
  }) => {
    if (!items.length) {
      return (
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] px-6 py-20 text-center">
          <Film
            size={30}
            className="mx-auto text-white/15"
          />

          <h3 className="mt-4 text-lg font-black text-white">
            Nothing found
          </h3>

          <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-white/30">
            Try another search, category,
            year or rating.
          </p>

          <button
            type="button"
            onClick={resetFilters}
            className="mt-6 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-[8px] font-black uppercase tracking-[0.16em] text-white/60 hover:bg-white/10 hover:text-white"
          >
            Reset Filters
          </button>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((movie) => (
          <div
            key={getMovieId(movie)}
            className="min-w-0"
          >
            {MovieCard({ movie })}
          </div>
        ))}
      </div>
    )
  }

  const CatalogPage = ({
    type,
  }: {
    type: 'Movie' | 'Series'
  }) => {
    const catalogItems =
      filteredMovies.filter(
        (movie) => {
          const movieType =
            String(
              movie.type || '',
            ).toLowerCase()

          return (
            movieType ===
            type.toLowerCase()
          )
        },
      )

    return (
      <main className="min-h-screen bg-[#050505] px-5 pb-24 pt-32 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-10">
            <p className="text-[9px] font-black uppercase tracking-[0.35em] text-white/30">
              PMF Discovery
            </p>

            <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-4xl font-black tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl">
                  {type === 'Movie'
                    ? 'Movies'
                    : 'TV Series'}
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/40">
                  Explore the PMF catalogue and
                  discover your next story.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setShowFilters(
                      (current) =>
                        !current,
                    )
                  }
                  className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-[8px] font-black uppercase tracking-[0.16em] text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                >
                  {showFilters
                    ? 'Hide Filters'
                    : 'Filters'}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    navigate('home')
                  }
                  className="rounded-full bg-white px-5 py-3 text-[8px] font-black uppercase tracking-[0.16em] text-black transition hover:scale-105"
                >
                  Back Home
                </button>
              </div>
            </div>
          </div>

          {showFilters && (
            <div className="mb-8">
              <DiscoveryToolbar
                searchQuery={search}
                onSearchChange={setSearch}
                contentType={type}
                onContentTypeChange={() => {}}
                genre={filters.category === 'All' ? 'All Genres' : filters.category}
                onGenreChange={(val) =>
                  setFilters((current) => ({
                    ...current,
                    category: val === 'All Genres' ? 'All' : val,
                  }))
                }
                year={filters.year === 'All' ? 'All Years' : filters.year}
                onYearChange={(val) =>
                  setFilters((current) => ({
                    ...current,
                    year: val === 'All Years' ? 'All' : val,
                  }))
                }
                rating={filters.rating === '0' ? 'All Ratings' : filters.rating}
                onRatingChange={(val) =>
                  setFilters((current) => ({
                    ...current,
                    rating: val === 'All Ratings' ? '0' : val,
                  }))
                }
                sort={filters.sort as any}
                onSortChange={(val) =>
                  setFilters((current) => ({
                    ...current,
                    sort: val,
                  }))
                }
                onReset={resetFilters}
              />
            </div>
          )}

          <div className="mb-6 flex items-center justify-between">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/25">
              {type === 'Movie'
                ? catalogItems.length
                : new Set(catalogItems.map((movie) =>
                    movie.seriesTitle && movie.seasonNumber
                      ? `${movie.seriesTitle.toLocaleLowerCase()}::${movie.seasonNumber}`
                      : `standalone::${getMovieId(movie)}`,
                  )).size}{' '}
              {type === 'Movie'
                ? 'movies'
                : 'season catalogues'}{' '}
              available
            </p>
          </div>

          {type === 'Series' ? (() => {
            const episodeGroups = new Map<string, {
              seriesTitle: string
              seasonNumber: number
              episodes: Movie[]
            }>()
            const standaloneSeries: Movie[] = []

            catalogItems.forEach((movie) => {
              const seasonNumber = Number(movie.seasonNumber)
              const seriesTitle = String(movie.seriesTitle || '').trim()
              const isEpisode = Boolean(
                seriesTitle && Number.isFinite(seasonNumber) && seasonNumber > 0,
              )

              if (!isEpisode) {
                standaloneSeries.push(movie)
                return
              }

              const groupKey = `${seriesTitle.toLocaleLowerCase()}::${seasonNumber}`
              const existing = episodeGroups.get(groupKey)
              if (existing) {
                existing.episodes.push(movie)
              } else {
                episodeGroups.set(groupKey, {
                  seriesTitle,
                  seasonNumber,
                  episodes: [movie],
                })
              }
            })

            const seasonGroups = Array.from(episodeGroups.values()).sort((a, b) =>
              a.seriesTitle.localeCompare(b.seriesTitle) || a.seasonNumber - b.seasonNumber,
            )

            if (!standaloneSeries.length && !seasonGroups.length) {
              return MovieGrid({ items: [] })
            }

            return (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {standaloneSeries.map((movie) => (
                  <div key={getMovieId(movie)} className="min-w-0">
                    {MovieCard({ movie })}
                  </div>
                ))}
                {seasonGroups.map((group) => {
                  const firstEpisode = group.episodes[0]
                  const seasonCard: Movie = {
                    ...firstEpisode,
                    id: `season-${group.seriesTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${group.seasonNumber}`,
                    title: group.seriesTitle,
                    type: 'Series',
                    seasonNumber: group.seasonNumber,
                    episodeNumber: undefined,
                    videoUrl: undefined,
                    videoType: undefined,
                  }

                  return (
                    <div key={seasonCard.id} className="min-w-0">
                      {MovieCard({
                        movie: seasonCard,
                        onClick: () => openSeason(
                          group.seriesTitle,
                          group.seasonNumber,
                          group.episodes,
                        ),
                        collectionMeta: `Season ${group.seasonNumber} • ${group.episodes.length} ${group.episodes.length === 1 ? 'Episode' : 'Episodes'}`,
                        isSeasonCollection: true,
                      })}
                    </div>
                  )
                })}
              </div>
            )
          })() : MovieGrid({
            items: catalogItems,
          })}
        </div>
      </main>
    )
  }

  const MyListPage = () => {
    const savedMovies =
      myList
        .map((id) =>
          findSafeMovie(id),
        )
        .filter(
          (
            movie,
          ): movie is Movie =>
            Boolean(movie),
        )

    return (
      <main className="min-h-screen bg-[#050505] px-5 pb-24 pt-32 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-10">
            <p className="text-[9px] font-black uppercase tracking-[0.35em] text-white/30">
              Your collection
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl">
              My List
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/40">
              The stories you saved for
              later.
            </p>
          </div>

          {savedMovies.length ? (
            MovieGrid({
              items: savedMovies,
            })
          ) : (
            <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] px-6 py-20 text-center">
              <ListPlus
                size={34}
                className="mx-auto text-white/15"
              />

              <h2 className="mt-5 text-2xl font-black tracking-[-0.03em] text-white">
                Your list is waiting.
              </h2>

              <p className="mx-auto mt-3 max-w-md text-xs leading-6 text-white/30">
                Save movies and series you
                want to watch later and they
                will appear here.
              </p>

              <button
                type="button"
                onClick={() =>
                  navigate('movies')
                }
                className="mt-7 rounded-full bg-white px-6 py-3 text-[8px] font-black uppercase tracking-[0.16em] text-black transition hover:scale-105"
              >
                Discover Something
              </button>
            </div>
          )}
        </div>
      </main>
    )
  }

  const Hero = () => {
    const featured =
      heroCandidates[activeHeroIndex % (heroCandidates.length || 1)] ||
      safeCatalogMovies[0]

  if (!featured) {
    return (
      <section className="relative min-h-[92vh] overflow-hidden bg-[#030208]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600/[0.12] blur-[190px]"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-[-10%] top-[15%] h-[500px] w-[500px] rounded-full bg-cyan-400/[0.035] blur-[180px]"
        />

        <div className="relative mx-auto flex min-h-[92vh] max-w-[1600px] items-center px-5 pt-28 sm:px-10 lg:px-16">
          <div className="max-w-5xl">
            <div className="mb-8 flex items-center gap-3">
              <span className="h-px w-14 bg-gradient-to-r from-purple-400 to-transparent" />

              <span className="text-[8px] font-black uppercase tracking-[0.4em] text-purple-300/70">
                Prince Mufasa Flix
              </span>

              <span className="h-1 w-1 rounded-full bg-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.9)]" />
            </div>

            <h1 className="text-6xl font-black leading-[0.82] tracking-[-0.075em] text-white sm:text-8xl lg:text-[112px]">
              Your world.
              <br />

              <span className="bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
                Your stories.
              </span>

              <br />

              <span className="text-white/75">
                Your Flix.
              </span>
            </h1>

            <p className="mt-8 max-w-xl text-sm leading-7 text-white/40 sm:text-base">
              Enter a cinematic universe built
              for stories worth remembering.
            </p>
          </div>
        </div>
      </section>
    )
  }

  const rating =
    getRating(featured)

  return (
    <section
      className="group/hero pmf-home-hero relative min-h-[62vh] sm:min-h-[78vh] lg:min-h-[94vh] overflow-hidden bg-[#030208]"
      onMouseEnter={() => setIsHeroPaused(true)}
      onMouseLeave={() => setIsHeroPaused(false)}
      onFocus={() => setIsHeroPaused(true)}
      onBlur={() => setIsHeroPaused(false)}
      onTouchStart={(e) => setHeroTouchStartX(e.targetTouches[0].clientX)}
      onTouchEnd={(e) => {
        if (heroTouchStartX === null) return
        const touchEndX = e.changedTouches[0].clientX
        const diff = heroTouchStartX - touchEndX
        if (diff > 50) {
          setActiveHeroIndex((prev) => (prev + 1) % heroCandidates.length)
        } else if (diff < -50) {
          setActiveHeroIndex((prev) =>
            prev === 0 ? heroCandidates.length - 1 : prev - 1,
          )
        }
        setHeroTouchStartX(null)
      }}
    >

      {/* =====================================================
          ATMOSPHERIC LIGHT
          ===================================================== */}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-[20%] top-[8%] h-[760px] w-[760px] rounded-full bg-purple-700/[0.14] blur-[210px] pmf-cinematic-glow"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[-12%] top-[8%] h-[650px] w-[650px] rounded-full bg-cyan-400/[0.045] blur-[210px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-30%] left-[35%] h-[650px] w-[650px] rounded-full bg-purple-500/[0.09] blur-[200px]"
      />

      {/* =====================================================
          CINEMATIC ARTWORK
          ===================================================== */}

      <div className="absolute inset-0 overflow-hidden">

        <img
          src={
            featured.poster ||
            heroImage
          }
          alt=""
          className="h-full w-full scale-[1.015] object-cover object-center opacity-95 transition-transform duration-[9000ms] ease-out group-hover/hero:scale-[1.045]"
        />

        {/* Artwork colour bloom */}

        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_70%_38%,rgba(168,85,247,0.24),transparent_30%)]"
        />

        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_86%_20%,rgba(103,232,249,0.08),transparent_25%)]"
        />

        {/* Deep cinematic fade */}

        <div className="absolute inset-0 bg-gradient-to-r from-[#030208]/90 via-[#030208]/60 via-[38%] to-[#030208]/[0.03]" />

        <div className="absolute inset-0 bg-gradient-to-t from-[#030208] via-[#030208]/20 via-[42%] to-transparent" />

        {/* Header protection */}

        <div className="absolute inset-x-0 top-0 h-[24%] bg-gradient-to-b from-[#030208]/65 to-transparent" />

        {/* Cinematic vignette */}

        <div className="absolute inset-0 shadow-[inset_0_0_240px_rgba(0,0,0,0.85)]" />

        {/* Subtle film atmosphere */}

        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,0,0,0.22)_100%)]"
        />

        {/* Fine highlight */}

        <div className="absolute inset-0 bg-white/[0.006]" />
      </div>

      {/* =====================================================
          MAIN HERO CONTENT
          ===================================================== */}

      <div className="relative mx-auto flex min-h-[62vh] sm:min-h-[78vh] lg:min-h-[94vh] max-w-[1600px] items-end px-4 pb-14 pt-24 sm:px-10 sm:pb-24 sm:pt-32 lg:px-16 lg:pb-28">

        <div className="w-full">

          <div className="grid items-end gap-12 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_390px]">

            {/* =================================================
                LEFT — STORY
                ================================================= */}

            <div className="max-w-5xl">

              {/* PMF SIGNATURE */}

              <div className="mb-7 flex items-center gap-3">

                <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-purple-300/20 bg-purple-500/[0.11] text-purple-300 shadow-[0_0_45px_rgba(168,85,247,0.22)] backdrop-blur-xl">

                  <div
                    aria-hidden="true"
                    className="absolute inset-0 rounded-2xl bg-purple-400/10 blur-lg"
                  />

                  <Sparkles
                    size={16}
                    className="relative"
                  />
                </div>

                <div>

                  <div className="flex items-center gap-2">

                    <span className="text-[8px] font-black uppercase tracking-[0.4em] text-purple-300">
                      PMF Signature
                    </span>

                    <span className="h-1 w-1 rounded-full bg-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.9)]" />

                  </div>

                  <p className="mt-1 text-[7px] font-bold uppercase tracking-[0.25em] text-white/30">
                    A cinematic experience
                  </p>

                </div>

              </div>

              {/* TITLE */}

              <h1 className="max-w-5xl text-4xl font-black leading-[0.92] tracking-[-0.055em] text-white sm:text-7xl md:text-8xl lg:text-[94px] xl:text-[106px] drop-shadow-[0_4px_28px_rgba(0,0,0,0.55)]">

                {featured.title}

              </h1>

              {/* METADATA */}

              <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2">

                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-purple-300">
                  {featured.year}
                </span>

                <span className="h-1 w-1 rounded-full bg-white/20" />

                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/55">
                  {featured.type || 'Film'}
                </span>

                {featured.category && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-white/20" />

                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/45">
                      {featured.category}
                    </span>
                  </>
                )}

                {featured.duration && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-white/20" />

                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/40">
                      {featured.duration}
                    </span>
                  </>
                )}

                {rating > 0 && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-white/20" />

                    <span className="inline-flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.2em] text-[#d8b36a]">

                      <Star
                        size={10}
                        fill="currentColor"
                      />

                      {rating.toFixed(1)}

                    </span>
                  </>
                )}

              </div>

              {/* DESCRIPTION */}

              <p className="mt-4 max-w-xl text-xs leading-5 text-white/80 sm:mt-6 sm:text-[15px] sm:leading-7 line-clamp-2">

                {featured.description ||
                  'Discover remarkable stories, unforgettable characters and cinematic worlds on PMF-Flix.'}

              </p>

              {/* ACTIONS */}

              <div className="mt-9 flex flex-wrap items-center gap-3">

                <button
                  type="button"
                  onClick={() =>
                    startWatching(
                      featured,
                    )
                  }
                  className="group/enter relative inline-flex items-center gap-3 overflow-hidden rounded-2xl border border-purple-300/30 bg-gradient-to-r from-purple-600 via-purple-500 to-purple-600 px-6 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-white shadow-[0_18px_65px_rgba(168,85,247,0.32)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_85px_rgba(168,85,247,0.46)] active:scale-[0.97]"
                >

                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover/enter:translate-x-full" />

                  <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white text-purple-700 shadow-lg">

                    <Play
                      size={12}
                      fill="currentColor"
                    />

                  </span>

                  <span className="relative">
                    Enter Experience
                  </span>

                </button>

                <button
                  type="button"
                  onClick={() =>
                    openMovie(
                      featured,
                    )
                  }
                  className="group/explore inline-flex items-center gap-3 rounded-2xl border border-white/15 bg-black/25 px-5 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-white/70 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-purple-300/30 hover:bg-purple-500/10 hover:text-white"
                >

                  <Film
                    size={13}
                    className="transition-transform duration-300 group-hover/explore:scale-110"
                  />

                  Explore Story

                </button>

              </div>

              {/* FEATURED STORY SELECTOR */}
              {heroCandidates.length > 1 && (
                <div className="mt-8 flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {heroCandidates.map((cand, idx) => {
                      const isActive =
                        idx ===
                        activeHeroIndex %
                          heroCandidates.length
                      return (
                        <button
                          key={cand.id}
                          type="button"
                          onClick={() =>
                            setActiveHeroIndex(idx)
                          }
                          className={`h-2 rounded-full transition-all duration-300 ${
                            isActive
                              ? 'w-8 bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)]'
                              : 'w-2 bg-white/20 hover:bg-white/50'
                          }`}
                          aria-label={`Featured title: ${cand.title}`}
                        />
                      )
                    })}
                  </div>

                  <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-white/35">
                    {activeHeroIndex + 1} / {heroCandidates.length}
                  </span>

                  <div className="ml-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveHeroIndex((prev) =>
                          prev === 0
                            ? heroCandidates.length - 1
                            : prev - 1,
                        )
                      }
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/15 hover:text-white"
                      aria-label="Previous featured title"
                    >
                      <ChevronLeft size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveHeroIndex(
                          (prev) =>
                            (prev + 1) %
                            heroCandidates.length,
                        )
                      }
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/15 hover:text-white"
                      aria-label="Next featured title"
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              )}

              {/* PMF SIGNATURE LINE */}

              <div className="mt-10 flex items-center gap-3">

                <div className="relative h-px w-16 overflow-hidden bg-white/10">

                  <div className="absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-purple-400 to-transparent" />

                </div>

                <p className="text-[7px] font-black uppercase tracking-[0.32em] text-white/25">
                  Your World. Your Stories. Your Flix.
                </p>

              </div>

            </div>

            {/* =================================================
                RIGHT — CINEMATIC FEATURE OBJECT
                ================================================= */}

            <div className="hidden lg:block">

              <div className="group/feature relative">

                {/* Floating ambient glow */}

                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-16 rounded-[40px] bg-purple-600/[0.08] blur-[80px] transition-all duration-1000 group-hover/feature:bg-purple-600/[0.14]"
                />

                {/* Outer frame */}

                <div className="relative overflow-hidden rounded-[30px] border border-white/[0.10] bg-[#07050d]/65 p-2 shadow-[0_35px_120px_rgba(0,0,0,0.60)] backdrop-blur-2xl transition-all duration-700 group-hover/feature:-translate-y-2 group-hover/feature:border-purple-300/20">

                  {/* Inner poster */}

                  <div className="relative overflow-hidden rounded-[24px] border border-white/[0.07]">

                    <div className="relative aspect-[2/3] overflow-hidden">

                      <img
                        src={
                          featured.poster ||
                          heroImage
                        }
                        alt={featured.title}
                        className="h-full w-full object-cover transition-transform duration-[6000ms] ease-out group-hover/feature:scale-[1.07]"
                      />

                      {/* Poster lighting */}

                      <div className="absolute inset-0 bg-gradient-to-t from-[#030208] via-transparent to-transparent" />

                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(168,85,247,0.20),transparent_38%)]" />

                      <div className="absolute inset-0 shadow-[inset_0_0_70px_rgba(0,0,0,0.45)]" />

                      {/* FEATURED BADGE */}

                      <div className="absolute left-4 top-4">

                        <div className="flex items-center gap-2 rounded-full border border-purple-300/20 bg-black/60 px-3 py-2 backdrop-blur-xl">

                          <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.9)]" />

                          <span className="text-[7px] font-black uppercase tracking-[0.22em] text-purple-200/80">
                            Featured
                          </span>

                        </div>

                      </div>

                      {/* POSTER INFO */}

                      <div className="absolute inset-x-4 bottom-4">

                        <p className="text-[7px] font-black uppercase tracking-[0.25em] text-white/35">
                          Now presenting
                        </p>

                        <h2 className="mt-1 truncate text-lg font-black tracking-[-0.02em] text-white">
                          {featured.title}
                        </h2>

                      </div>

                    </div>

                    {/* CARD FOOTER */}

                    <div className="flex items-center justify-between gap-3 bg-[#080611]/95 px-4 py-4">

                      <div>

                        <p className="text-[6px] font-black uppercase tracking-[0.24em] text-white/25">
                          PMF CINEMA
                        </p>

                        <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.14em] text-purple-300/70">
                          Your next story awaits
                        </p>

                      </div>

                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-purple-300/15 bg-purple-500/10 text-purple-300 shadow-[0_0_25px_rgba(168,85,247,0.12)]">

                        <Sparkles
                          size={13}
                        />

                      </div>

                    </div>

                  </div>

                </div>

              </div>

            </div>

          </div>

        </div>

      </div>

      {/* =====================================================
          CINEMATIC DETAILS
          ===================================================== */}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-8 right-6 hidden items-center gap-3 text-[7px] font-black uppercase tracking-[0.3em] text-white/20 sm:flex lg:right-12"
      >
        <span className="h-px w-8 bg-white/10" />

        <span>
          PMF / CINEMATIC UNIVERSE
        </span>
      </div>

      {/* Scroll indicator */}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-7 left-1/2 hidden -translate-x-1/2 items-center gap-3 text-[7px] font-black uppercase tracking-[0.28em] text-white/20 sm:flex"
      >
        <span className="h-7 w-px bg-gradient-to-b from-purple-400/80 to-transparent" />

        <span>
          Explore
        </span>
      </div>

    </section>
  )
                }

  const Header = () => (
  <header className="fixed left-0 right-0 top-0 z-50">
    <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-purple-500/[0.06] to-transparent pointer-events-none" />

    <div className="relative border-b border-purple-300/[0.08] bg-[#05040b]/80 shadow-[0_12px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
      <div className="pmf-topbar mx-auto flex h-[64px] sm:h-[72px] max-w-[1600px] items-center gap-2 sm:gap-4 px-3 sm:px-8 lg:px-12">
        
        {/* DESKTOP NAVIGATION */}
        <nav className="hidden items-center gap-1 xl:flex">
          {(
            [
              ['home', 'Home'],
              ['movies', 'Movies'],
              ['series', 'TV Series'],
              ['sports', 'Live Sports'],
              ['shorts', 'PMF Shorts'],
              ['trending', 'Trending'],
              ['nollywood', 'Nollywood'],
              ['free-novels', 'Stories & Novels'],
              ['my-list', 'My List'],
              ['offline', 'Offline Cinema'],
              ...(activeProfile?.isKids !== true ? ([['midnight-18', 'Midnight 18+']] as const) : []),
            ] as const
          ).map(
            ([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() =>
                  navigate(key)
                }
                className={`group relative rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-[0.14em] transition-all whitespace-nowrap ${
                  section === key
                    ? 'text-white'
                    : 'text-white/40 hover:text-white'
                }`}
              >
                <span>{label}</span>

                {key === 'offline' && downloadsCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[8px] font-black text-black">
                    {downloadsCount}
                  </span>
                )}

                <span
                  className={`absolute bottom-0 left-1/2 h-px -translate-x-1/2 bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.7)] transition-all ${
                    section === key
                      ? 'w-6'
                      : 'w-0 group-hover:w-3'
                  }`}
                />
              </button>
            ),
          )}
        </nav>

        {/* RIGHT SIDE */}
        <div className="ml-auto flex min-w-0 items-center gap-2">
          {/* COMPACT BRAND MARK */}
          <button
            type="button"
            onClick={() => navigate('home')}
            aria-label="PMF-Flix home"
            title="PMF-Flix"
            className="flex h-9 w-8 shrink-0 items-center justify-center rounded-lg transition hover:bg-white/[0.05] active:scale-95"
          >
            <PMFLogo size={17} />
          </button>

          {/* SEARCH (Responsive on all screen sizes) */}
          <div className="flex min-w-0 flex-1 sm:flex-none sm:w-[220px] md:w-[260px] max-w-[360px] items-center gap-1.5 sm:gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 sm:px-3 transition-colors focus-within:border-amber-400/40 focus-within:bg-purple-950/20">
            <Search
              size={13}
              className="shrink-0 text-amber-400/80"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search..."
              className="min-w-0 flex-1 bg-transparent py-2 text-[11px] sm:text-xs text-white outline-none placeholder:text-white/30"
            />

            {search && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Clear search"
                className="text-white/40 transition hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* SMART DISCOVERY QUICK ACTIONS */}
          <button
            type="button"
            onClick={() => setShowRoulette(true)}
            className="flex h-9 w-9 sm:h-10 sm:w-auto shrink-0 items-center justify-center sm:justify-start gap-0 sm:gap-1.5 rounded-xl border border-purple-400/25 bg-purple-500/10 px-0 sm:px-3 text-[9px] font-black uppercase tracking-wider text-purple-300 hover:bg-purple-500/20 transition active:scale-95"
            title="PMF Cinema Roulette — Surprise Me"
          >
            <Dice5 size={13} />
            <span className="hidden sm:inline">Surprise Me</span>
          </button>

          <button
            type="button"
            onClick={() => setShowWorldCinema(true)}
            className="flex h-9 w-9 sm:h-10 sm:w-auto shrink-0 items-center justify-center sm:justify-start gap-0 sm:gap-1.5 rounded-xl border border-white/10 bg-white/5 px-0 sm:px-3 text-[9px] font-black uppercase tracking-wider text-white/70 hover:bg-white/10 hover:text-white transition active:scale-95"
            title="World Cinema Explorer"
          >
            <Globe2 size={13} />
            <span className="hidden sm:inline">World Cinema</span>
          </button>

          {/* PROFILE */}
          <button
            type="button"
            onClick={() =>
              setShowProfile(true)
            }
            className="group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.035] text-lg transition-all hover:border-purple-300/25 hover:bg-purple-500/[0.08]"
            aria-label="Open profile"
          >
            <span className="transition-transform duration-300 group-hover:scale-110">
              {profile.avatar}
            </span>
            {activeProfile?.isKids && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[8px] font-black text-black ring-2 ring-[#05040b]">
                K
              </span>
            )}
          </button>

          {/* STUDIO */}
          {isStudioAdmin && (
            <button
              type="button"
              onClick={() => setShowStudio(true)}
              className="flex h-9 w-9 sm:h-10 sm:w-auto shrink-0 items-center justify-center sm:justify-start gap-0 sm:gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-0 sm:px-3.5 text-[9px] font-black uppercase tracking-[0.16em] text-amber-300 transition hover:border-amber-400/50 hover:bg-amber-400/20 hover:text-amber-200 active:scale-95"
              aria-label="Open PMF Studio"
            >
              <Sparkles size={13} className="text-amber-400" />
              <span className="hidden sm:inline">Studio</span>
              <span className="hidden rounded-full bg-amber-400/25 px-1.5 py-0.5 text-[8px] text-amber-200 sm:inline">Admin</span>
            </button>
          )}

          {/* MOBILE MENU */}
          <button
            type="button"
            onClick={() =>
              setMobileMenu(
                (value) => !value,
              )
            }
            className={`flex h-10 w-10 items-center justify-center rounded-xl border text-white/55 transition lg:hidden ${
              mobileMenu
                ? 'border-purple-300/25 bg-purple-500/10 text-purple-300'
                : 'border-white/[0.09] bg-white/[0.035]'
            }`}
            aria-label="Open menu"
          >
            <Menu size={16} />
          </button>
        </div>
      </div>

      {/* MOBILE MENU */}
      {mobileMenu && (
        <div className="border-t border-purple-300/[0.08] bg-[#05040b]/95 px-4 py-4 backdrop-blur-2xl lg:hidden">
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 focus-within:border-purple-300/25">
            <Search
              size={14}
              className="text-purple-300/40"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search the PMF universe"
              className="min-w-0 flex-1 bg-transparent py-3 text-xs text-white outline-none placeholder:text-white/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['home', 'Home'],
                ['movies', 'Movies'],
                ['series', 'TV Series'],
                ['my-list', 'My List'],
              ] as const
            ).map(
              ([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    navigate(key)
                  }
                  className={`rounded-xl border px-4 py-3.5 text-left text-[8px] font-black uppercase tracking-[0.16em] transition ${
                    section === key
                      ? 'border-purple-300/25 bg-purple-500/10 text-purple-300'
                      : 'border-white/[0.08] bg-white/[0.025] text-white/35 hover:border-purple-300/15 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ),
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setShowStudio(true)
              setMobileMenu(false)
            }}
            className="mt-2 w-full rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3.5 text-left text-[9px] font-black uppercase tracking-[0.16em] text-amber-300 transition hover:bg-amber-400/20 hover:text-amber-200"
          >
            <span className="inline-flex items-center gap-2">
              <Sparkles size={14} className="text-amber-400" />
              PMF Studio Command Centre
            </span>
          </button>
        </div>
      )}
    </div>
  </header>
)

const HomeContent = () => (
  <>
    {Hero()}

    <main className="relative mx-auto max-w-[1600px] overflow-hidden px-5 pb-24 sm:px-10 lg:px-16">

      {/* =====================================================
          PMF CINEMATIC ATMOSPHERE
          ===================================================== */}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[1100px] -translate-x-1/2 rounded-full bg-purple-600/[0.045] blur-[150px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-64 top-[35%] h-[520px] w-[520px] rounded-full bg-cyan-400/[0.025] blur-[150px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-64 top-[65%] h-[520px] w-[520px] rounded-full bg-purple-600/[0.035] blur-[150px]"
      />

      {/* =====================================================
          CINEMATIC CATEGORY NAVIGATION STRIP (Reference Image 1)
          ===================================================== */}
      <div className="pmf-category-navigation relative pt-6 sm:pt-8 pb-2">
        <div className="pmf-category-list flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
          {[
            { id: 'all', label: 'All', icon: Sparkles, tone: 'from-white/15 via-white/[0.06] to-white/[0.02]', edge: 'border-white/15', ink: 'text-white', glow: 'shadow-white/5' },
            { id: 'movies', label: 'Movies', icon: Film, tone: 'from-amber-400/25 via-orange-500/10 to-transparent', edge: 'border-amber-300/30', ink: 'text-amber-100', glow: 'shadow-amber-500/15' },
            { id: 'series', label: 'TV Series', icon: Tv, tone: 'from-sky-400/25 via-blue-500/10 to-transparent', edge: 'border-sky-300/30', ink: 'text-sky-100', glow: 'shadow-sky-500/15' },
            { id: 'sports', label: 'Live Sports', icon: Trophy, isLive: true, tone: 'from-emerald-400/25 via-green-500/10 to-transparent', edge: 'border-emerald-300/30', ink: 'text-emerald-100', glow: 'shadow-emerald-500/15' },
            { id: 'shorts', label: 'PMF Shorts', icon: Video, tone: 'from-fuchsia-500/30 via-purple-500/15 to-transparent', edge: 'border-fuchsia-300/35', ink: 'text-fuchsia-100', glow: 'shadow-fuchsia-500/20' },
            { id: 'free-novels', label: 'Stories & Novels', icon: BookOpen, tone: 'from-violet-400/25 via-indigo-500/10 to-transparent', edge: 'border-violet-300/30', ink: 'text-violet-100', glow: 'shadow-violet-500/15' },
            { id: 'nollywood', label: 'Nollywood & African', icon: Globe2, tone: 'from-orange-400/25 via-rose-500/10 to-transparent', edge: 'border-orange-300/30', ink: 'text-orange-100', glow: 'shadow-orange-500/15' },
            { id: 'trending', label: 'Trending', icon: Flame, tone: 'from-rose-500/25 via-red-500/10 to-transparent', edge: 'border-rose-300/30', ink: 'text-rose-100', glow: 'shadow-rose-500/15' },
            { id: 'offline', label: 'Offline Cinema', icon: Download, tone: 'from-cyan-400/25 via-teal-500/10 to-transparent', edge: 'border-cyan-300/30', ink: 'text-cyan-100', glow: 'shadow-cyan-500/15' },
            ...(activeProfile?.isKids !== true ? [{ id: 'midnight-18', label: 'Midnight 18+', icon: Moon, tone: 'from-red-500/30 via-purple-950/40 to-black', edge: 'border-red-400/35', ink: 'text-red-100', glow: 'shadow-red-600/20', isMature: true }] : []),
          ].map((cat) => {
            const Icon = cat.icon
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  if (cat.id !== 'all') navigate(cat.id as Section)
                }}
                className={`pmf-category-tile group relative isolate flex shrink-0 items-center gap-2 overflow-hidden rounded-xl border bg-gradient-to-br px-3.5 py-2 text-xs font-black tracking-wide shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:brightness-125 active:scale-95 ${
                  cat.tone + ' ' + cat.edge + ' ' + cat.ink + ' ' + cat.glow
                }`}
              >
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_0%,rgba(255,255,255,0.16),transparent_65%)] opacity-70 transition-opacity group-hover:opacity-100" />
                {cat.isLive && <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.95)]" />}
                <Icon className="h-4 w-4 drop-shadow-[0_0_8px_currentColor]" />
                <span>{cat.label}</span>
                {cat.id === 'midnight-18' && <span className="rounded-md border border-red-300/35 bg-red-950/60 px-1 py-0.5 text-[8px] tracking-widest">18+</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* =====================================================
          SERIES RANKINGS (Reference Image 1)
          ===================================================== */}
      {seriesRankings.length > 0 && (
        <section className="relative pt-6 sm:pt-10">
          {MovieRow({
            eyebrow: 'Serialized Stories & Anime',
            title: 'Series Rankings',
            subtitle:
              'The highest-rated TV series, anime, and serialized drama across PMF-Flix.',
            items: seriesRankings,
            isTop10: true,
          })}
        </section>
      )}

      {/* =====================================================
          CONTINUE WATCHING
          ===================================================== */}

      {continueMovies.length > 0 && (
        <section className="relative pt-8 sm:pt-12">
          {MovieRow({
            eyebrow: 'Pick up where you left off',
            title: 'Continue Watching',
            subtitle: 'Your unfinished stories, ready when you are.',
            items: continueMovies,
          })}
        </section>
      )}

      {/* =====================================================
          FEATURED
          ===================================================== */}

      {featuredMovies.length > 1 && (
        <section className="relative">
          {MovieRow({
            eyebrow: 'The PMF selection',
            title: 'Featured',
            subtitle: 'Stories selected for the PMF cinematic experience.',
            items: featuredMovies,
          })}
        </section>
      )}

      {/* =====================================================
          TRENDING
          ===================================================== */}

      {trendingMovies.length > 0 && (
        <section className="relative">
          {MovieRow({
            eyebrow: "What's moving",
            title: 'Trending Now',
            subtitle:
              'The titles creating the most excitement across PMF-Flix.',
            items: trendingMovies,
          })}
        </section>
      )}

      {/* =====================================================
          TOP 10 ACROSS PMF-FLIX
          ===================================================== */}

      {safeCatalogMovies.length >= 5 && (
        <section className="relative">
          {MovieRow({
            eyebrow: 'Global Phenomenon',
            title: 'Top 10 Across PMF-Flix',
            subtitle:
              'The most-watched motion pictures and series across our platform today.',
            items: safeCatalogMovies.slice(0, 10),
            isTop10: true,
          })}
        </section>
      )}

      {/* =====================================================
          PERSONALIZED
          ===================================================== */}

      {personalizedMovies.length > 0 && (
        <section className="relative">
          {MovieRow({
            eyebrow: 'Made for your journey',
            title: 'Made For You',
            subtitle:
              "Recommendations shaped by the stories you've explored.",
            items: personalizedMovies,
          })}
        </section>
      )}

      {/* =====================================================
          NEW & NOTEWORTHY
          ===================================================== */}

      {latestMovies.length > 0 && (
        <section className="relative">
          {MovieRow({
            eyebrow: 'Fresh from the catalogue',
            title: 'New & Noteworthy',
            subtitle:
              'Fresh stories waiting to become your next obsession.',
            items: latestMovies,
          })}
        </section>
      )}

      {/* =====================================================
          AFRICAN CINEMA & NOLLYWOOD SPOTLIGHT
          ===================================================== */}

      {africanAndNollywoodMovies.length > 0 && (
        <section className="relative">
          {MovieRow({
            eyebrow: 'Global heritage & storytelling',
            title: 'African Cinema & Nollywood',
            subtitle:
              'Vibrant narratives, authentic voices, and unforgettable modern classics.',
            items: africanAndNollywoodMovies,
          })}
        </section>
      )}

      {/* =====================================================
          CATEGORY UNIVERSE
          ===================================================== */}

      {categoryRows.length > 0 && (
        <section className="relative">
          {categoryRows.map((row) => (
            <div key={row.category}>
              {MovieRow({
                eyebrow: 'Explore the universe',
                title: row.category,
                subtitle: `Discover ${row.category.toLowerCase()} stories on PMF-Flix.`,
                items: row.items,
              })}
            </div>
          ))}
        </section>
      )}

      {/* =====================================================
          BUZZ BOSS SHORT SKITS & COMEDY REELS
          ===================================================== */}
      <BuzzBossSection
        onNavigate={(sec) => setSection(sec as Section)}
      />

      {/* =====================================================
          AFRICAN LITERARY CINEMA & FREE NOVELS
          ===================================================== */}
      <FreeNovelsSection />

      {/* =====================================================
          CINEMA TRIVIA & STREAMING KNOWLEDGE
          ===================================================== */}
      <CinemaTriviaChallenge />

      {/* =====================================================
          SPECIALTY DESTINATIONS (SPORTS, GAMES, LIVE TV)
          ===================================================== */}
      <SpecialtyDestinationsPortal />

      {/* =====================================================
          RECENTLY WATCHED
          ===================================================== */}

      {historyMovies.length > 0 && (
        <section className="relative">
          {MovieRow({
            eyebrow: 'Your activity',
            title: 'Recently Watched',
            subtitle: 'Your latest journey through the PMF universe.',
            items: historyMovies.slice(0, 10),
          })}
        </section>
      )}

      {/* =====================================================
          PMF UNIVERSE PORTAL
          ===================================================== */}

      <section className="group/universe relative mt-16 overflow-hidden rounded-[32px] border border-purple-300/[0.10] bg-[#080611] shadow-[0_30px_100px_rgba(0,0,0,0.35)]">

        {/* Atmospheric lighting */}

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 -top-40 h-[500px] w-[500px] rounded-full bg-purple-600/[0.13] blur-[130px] transition-all duration-1000 group-hover/universe:bg-purple-600/[0.20]"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-48 left-1/3 h-[420px] w-[420px] rounded-full bg-cyan-400/[0.035] blur-[120px]"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.10),transparent_35%)]"
        />

        {/* Decorative grid */}

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)',
            backgroundSize: '42px 42px',
          }}
        />

        {/* Content */}

        <div className="relative grid gap-10 px-6 py-12 sm:px-10 sm:py-16 lg:grid-cols-[1fr_auto] lg:items-end lg:px-16 lg:py-20">

          <div className="max-w-3xl">

            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-purple-300/20 bg-purple-500/10 text-purple-300 shadow-[0_0_30px_rgba(168,85,247,0.15)]">
                <Sparkles size={14} />
              </div>

              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.35em] text-purple-300/70">
                  The PMF Universe
                </p>

                <p className="mt-1 text-[7px] font-bold uppercase tracking-[0.2em] text-white/25">
                  Stories without borders
                </p>
              </div>
            </div>

            <h2 className="max-w-4xl text-4xl font-black leading-[0.92] tracking-[-0.055em] text-white sm:text-5xl lg:text-6xl">
              There is a whole
              <br />
              <span className="bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
                universe waiting.
              </span>
            </h2>

            <p className="mt-6 max-w-2xl text-sm leading-7 text-white/40 sm:text-base">
              Explore global cinema, African stories, unforgettable
              characters and worlds waiting to become part of your
              next cinematic memory.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">

              <button
                type="button"
                onClick={() =>
                  navigate('movies')
                }
                className="group/explore relative inline-flex items-center gap-3 overflow-hidden rounded-2xl border border-purple-300/25 bg-purple-500/90 px-6 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-white shadow-[0_14px_45px_rgba(168,85,247,0.20)] transition-all duration-300 hover:-translate-y-1 hover:bg-purple-400 hover:shadow-[0_18px_60px_rgba(168,85,247,0.32)] active:scale-[0.97]"
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover/explore:translate-x-full" />

                <Film
                  size={13}
                  className="relative"
                />

                <span className="relative">
                  Explore the Universe
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  navigate('movies')
                }
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-white/55 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-purple-300/20 hover:bg-purple-500/10 hover:text-white"
              >
                Browse Catalogue
              </button>

            </div>
          </div>

          {/* PMF visual signature */}

          <div className="relative hidden h-44 w-44 items-center justify-center lg:flex">

            <div className="absolute inset-0 rounded-full border border-purple-300/[0.08]" />

            <div className="absolute inset-4 rounded-full border border-purple-300/[0.08]" />

            <div className="absolute inset-8 rounded-full border border-purple-300/[0.12] bg-purple-500/[0.04] shadow-[0_0_70px_rgba(168,85,247,0.10)]" />

            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-purple-300/20 bg-purple-500/10 text-purple-300 shadow-[0_0_45px_rgba(168,85,247,0.20)] backdrop-blur-xl">
              <Film size={23} />
            </div>

            <div className="absolute left-2 top-1/2 h-1.5 w-1.5 rounded-full bg-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.9)]" />

            <div className="absolute right-5 top-8 h-1 w-1 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.8)]" />

            <div className="absolute bottom-5 right-1/2 h-1.5 w-1.5 rounded-full bg-[#d8b36a] shadow-[0_0_12px_rgba(216,179,106,0.7)]" />
          </div>

        </div>
      </section>

      {/* =====================================================
          FINAL PMF SIGNATURE
          ===================================================== */}

      <section className="relative py-24 text-center">

        <div className="mx-auto mb-7 flex items-center justify-center gap-4">
          <span className="h-px w-16 bg-gradient-to-r from-transparent to-purple-400/30" />

          <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.8)]" />

          <span className="h-px w-16 bg-gradient-to-l from-transparent to-purple-400/30" />
        </div>

        <p className="text-[8px] font-black uppercase tracking-[0.45em] text-purple-300/45">
          PMF-Flix
        </p>

        <h2 className="mt-5 text-3xl font-black tracking-[-0.05em] text-white sm:text-4xl">
          There is always another story.
        </h2>

        <p className="mx-auto mt-4 max-w-xl text-xs leading-6 text-white/30 sm:text-sm">
          Keep exploring. Keep discovering. Keep watching.
        </p>

        <div className="mt-8 flex items-center justify-center gap-2">
          <span className="h-1 w-1 rounded-full bg-purple-400/70" />
          <span className="h-1 w-8 rounded-full bg-purple-400/20" />
          <span className="h-1 w-1 rounded-full bg-purple-400/70" />
        </div>

      </section>

    </main>
  </>
)
            
  const MovieDetails = () => {
    if (!selectedMovie) {
      return null
    }

    const listed =
      isInMyList(selectedMovie)

    const progress =
      getProgressPercent(
        selectedMovie,
      )

    const related =
      safeCatalogMovies
        .filter(
          (movie) =>
            getMovieId(movie) !==
              getMovieId(
                selectedMovie,
              ) &&
            (
              movie.category ===
                selectedMovie.category ||
              movie.type ===
                selectedMovie.type
            ),
        )
        .slice(0, 8)

    return (
      <div className="fixed inset-0 z-[80] overflow-y-auto bg-black">
        <div className="relative min-h-screen">
          <div className="absolute inset-x-0 top-0 h-[55vh] overflow-hidden">
            <img
              src={
                selectedMovie.poster ||
                heroImage
              }
              alt=""
              className="h-full w-full object-cover opacity-35"
            />

            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/65 to-black" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-transparent" />
          </div>

          <div className="relative mx-auto max-w-[1400px] px-5 pb-24 pt-24 sm:px-10 lg:px-16">
            <button
              type="button"
              onClick={() =>
                setSelectedMovie(null)
              }
              className="mb-16 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/60 backdrop-blur transition hover:bg-white/10 hover:text-white"
              aria-label="Close details"
            >
              <X size={17} />
            </button>

            <div className="max-w-3xl pt-10 sm:pt-20">
              <div className="flex flex-wrap items-center gap-2 text-[8px] font-black uppercase tracking-[0.18em] text-white/45">

                 <span>
                  {selectedMovie.type ||
                    'Film'}
                </span>

                <span>•</span>

                <span>
                  {selectedMovie.year}
                </span>

                {selectedMovie.duration && (
                  <>
                    <span>•</span>
                    <span>
                      {
                        selectedMovie.duration
                      }
                    </span>
                  </>
                )}

                {getRating(
                  selectedMovie,
                ) > 0 && (
                  <>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 text-white/70">
                      <Star
                        size={9}
                        fill="currentColor"
                      />
                      {getRating(
                        selectedMovie,
                      ).toFixed(1)}
                    </span>
                  </>
                )}
              </div>

              <h1 className="mt-5 text-5xl font-black tracking-[-0.065em] text-white sm:text-7xl">
                {selectedMovie.title}
              </h1>

              {selectedMovie.category && (
                <div className="mt-4 inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[7px] font-black uppercase tracking-[0.18em] text-white/50">
                  {selectedMovie.category}
                </div>
              )}

              <p className="mt-7 max-w-2xl text-sm leading-7 text-white/50 sm:text-base">
                {selectedMovie.description ||
                  'Discover this story on PMF-Flix.'}
              </p>

              <div className="mt-8 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    startWatching(
                      selectedMovie,
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-[9px] font-black uppercase tracking-[0.16em] text-black transition hover:scale-[1.02]"
                >
                  <Play
                    size={14}
                    fill="currentColor"
                  />

                  {progress > 0
                    ? 'Resume'
                    : 'Play Now'}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    toggleMyList(
                      selectedMovie,
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-5 py-3.5 text-[9px] font-black uppercase tracking-[0.16em] text-white backdrop-blur hover:bg-white/10"
                >
                  {listed ? (
                    <>
                      <Check size={13} />
                      In My List
                    </>
                  ) : (
                    <>
                      <ListPlus size={13} />
                      My List
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setWatchPartyMovie(selectedMovie)}
                  className="inline-flex items-center gap-2 rounded-xl border border-purple-400/30 bg-purple-500/10 px-5 py-3.5 text-[9px] font-black uppercase tracking-[0.16em] text-purple-300 hover:bg-purple-500/20 transition"
                >
                  <Users size={13} />
                  Watch Party
                </button>

                {selectedMovie.videoType !== 'youtube' && selectedMovie.videoUrl && (
                  <DownloadActionButton
                    movie={selectedMovie}
                    onPlayOffline={(offlineUrl) =>
                      startWatching(selectedMovie, offlineUrl)
                    }
                    onOpenVault={() => navigate('offline')}
                  />
                )}
              </div>

              {progress > 0 && (
                <div className="mt-6 max-w-md">
                  <div className="mb-2 flex items-center justify-between text-[7px] font-black uppercase tracking-[0.14em] text-white/30">
                    <span>
                      Continue watching
                    </span>

                    <span>
                      {progress}%
                    </span>
                  </div>

                  <div className="h-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-white"
                      style={{
                        width: `${progress}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-24">
              <div className="grid gap-4 border-y border-white/[0.07] py-7 sm:grid-cols-3">
                <div>
                  <p className="text-[7px] font-black uppercase tracking-[0.18em] text-white/25">
                    Format
                  </p>

                  <p className="mt-2 text-xs font-bold text-white/65">
                    {selectedMovie.type ||
                      'Movie'}
                  </p>
                </div>

                <div>
                  <p className="text-[7px] font-black uppercase tracking-[0.18em] text-white/25">
                    Category
                  </p>

                  <p className="mt-2 text-xs font-bold text-white/65">
                    {selectedMovie.category ||
                      'General'}
                  </p>
                </div>

                <div>
                  <p className="text-[7px] font-black uppercase tracking-[0.18em] text-white/25">
                    Availability
                  </p>

                  <p className="mt-2 text-xs font-bold text-white/65">
                    PMF-Flix
                  </p>
                </div>
              </div>
            </div>

            {related.length > 0 && (
              <section className="mt-16">
                {SectionTitle({
                  eyebrow: 'Keep exploring',
                  title: 'You May Also Like',
                  subtitle: 'More stories from the same world.',
                })}

                <div className="pmf-home-rail no-scrollbar flex snap-x snap-proximity gap-2 overflow-x-auto pb-3 sm:gap-3 sm:pb-4">
                  {related.map(
                    (movie) => (
                      <div key={getMovieId(movie)} className="shrink-0">
                        {MovieCard({ movie })}
                      </div>
                    ),
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    )
  }

const SeasonDetails = () => {
    if (!selectedSeason) return null

    return (
      <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#050505]">
        <div className="mx-auto min-h-screen max-w-[1200px] px-5 pb-24 pt-10 sm:px-10 sm:pt-14">
          <button
            type="button"
            onClick={() => setSelectedSeason(null)}
            className="mb-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Back to series catalogue"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-purple-300/70">
                PMF Series Library
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-[-0.055em] text-white sm:text-6xl">
                {selectedSeason.seriesTitle}
              </h1>
              <p className="mt-3 text-sm font-semibold text-white/50">
                Season {selectedSeason.seasonNumber}
                <span className="mx-2 text-white/20">•</span>
                {selectedSeason.episodes.length} {selectedSeason.episodes.length === 1 ? 'episode' : 'episodes'}
              </p>
            </div>
            <div className="rounded-2xl border border-purple-300/15 bg-purple-500/[0.07] px-5 py-4">
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-purple-200/60">
                Season collection
              </p>
              <p className="mt-1 text-xl font-black text-white">
                {String(selectedSeason.seasonNumber).padStart(2, '0')}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {selectedSeason.episodes.map((episode, index) => {
              const episodeNumber = Number(episode.episodeNumber || index + 1)
              return (
                <article
                  key={getMovieId(episode)}
                  className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3 transition hover:border-purple-300/25 hover:bg-white/[0.045] sm:flex-row sm:items-center sm:p-4"
                >
                  <img
                    src={getMoviePoster(episode)}
                    alt=""
                    className="h-28 w-full rounded-xl object-cover sm:h-24 sm:w-40"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-purple-300/70">
                      Episode {String(episodeNumber).padStart(2, '0')}
                    </p>
                    <h2 className="mt-1 text-base font-black text-white sm:text-lg">
                      {episode.title}
                    </h2>
                    {episode.description && (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/40">
                        {episode.description}
                      </p>
                    )}
                    {episode.duration && (
                      <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.12em] text-white/30">
                        {episode.duration}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => startWatching(episode)}
                    disabled={!episode.videoUrl}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-[9px] font-black uppercase tracking-[0.15em] text-black transition hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Play size={13} fill="currentColor" />
                    {episode.videoUrl ? 'Play Episode' : 'Coming Soon'}
                  </button>
                </article>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

const ProfilePanel = () => {
    if (!showProfile) {
      return null
    }

    return (
      <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-5">
        <div className="w-full max-w-lg overflow-hidden rounded-t-3xl border border-white/10 bg-[#0b0b0b] shadow-2xl sm:rounded-3xl">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
            <div>
              <p className="text-[7px] font-black uppercase tracking-[0.2em] text-white/25">
                Your PMF identity
              </p>

              <h2 className="mt-1 text-lg font-black text-white">
                Profile
              </h2>
            </div>

            <button
              type="button"
              onClick={() =>
                setShowProfile(false)
              }
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/40 hover:bg-white/5 hover:text-white"
            >
              <X size={15} />
            </button>
          </div>

          <div className="p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-3xl">
                {profile.avatar}
              </div>

              <div className="min-w-0">
                <p className="text-xs font-black text-white">
                  {profile.name}
                </p>

                <p className="mt-1 truncate text-[10px] text-white/30">
                  {session?.user
                    ?.email || ''}
                </p>

                <p className="mt-2 text-[7px] font-black uppercase tracking-[0.16em] text-white/20">
                  {myListMovies.length}{' '}
                  saved titles
                </p>
              </div>
            </div>

            <div className="mt-7">
              <label className="block">
                <span className="mb-2 block text-[7px] font-black uppercase tracking-[0.16em] text-white/25">
                  Display name
                </span>

                <input
                  value={profile.name}
                  onChange={(event) =>
                    setProfile(
                      (current) => ({
                        ...current,
                        name:
                          event.target
                            .value,
                      }),
                    )
                  }
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-white/25"
                />
              </label>
            </div>

            <div className="mt-5">
              <span className="mb-3 block text-[7px] font-black uppercase tracking-[0.16em] text-white/25">
                Choose avatar
              </span>

              <div className="grid grid-cols-5 gap-2">
                {AVATARS.map(
                  (avatar) => (
                    <button
                      key={avatar}
                      type="button"
                      onClick={() =>
                        setProfile(
                          (current) => ({
                            ...current,
                            avatar,
                          }),
                        )
                      }
                      className={`flex aspect-square items-center justify-center rounded-xl border text-xl transition ${
                        profile.avatar ===
                        avatar
                          ? 'border-white/30 bg-white/10'
                          : 'border-white/10 bg-white/[0.025] hover:bg-white/5'
                      }`}
                    >
                      {avatar}
                    </button>
                  ),
                )}
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setShowProfile(false)
                  setIsSelectingProfile(true)
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-[9px] font-black uppercase tracking-[0.16em] text-amber-300 hover:bg-amber-400/20 transition"
              >
                <span>Switch Profile Universe</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveProfile}
                  className="flex-1 rounded-xl bg-white px-4 py-3 text-[8px] font-black uppercase tracking-[0.16em] text-black hover:bg-white/90 transition"
                >
                  Save Profile
                </button>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="rounded-xl border border-white/10 px-4 py-3 text-[8px] font-black uppercase tracking-[0.16em] text-white/40 hover:bg-white/5 hover:text-white transition"
                >
                  Sign Out
                </button>
              </div>
            </div>

            {toastMessage && (
              <p className="mt-4 text-center text-[9px] font-bold text-white/40">
                {toastMessage}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  const MobileSearchResults = () => {
    if (!search.trim()) {
      return null
    }

    return (
      <div className="fixed inset-x-0 top-16 z-40 border-b border-white/[0.07] bg-black/95 px-4 py-4 backdrop-blur-xl sm:hidden">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[8px] font-black uppercase tracking-[0.16em] text-white/30">
            Search results
          </p>

          <button
            type="button"
            onClick={clearSearch}
            className="text-white/30 hover:text-white"
          >
            <X size={13} />
          </button>
        </div>

        <div className="pmf-home-rail no-scrollbar flex gap-3 overflow-x-auto">
          {filteredMovies
            .slice(0, 8)
            .map((movie) => (
              <div key={getMovieId(movie)} className="shrink-0">
                {MovieCard({
                  movie,
                  compact: true,
                })}
              </div>
            ))}
        </div>
      </div>
    )
  }

  const renderPlayer = () => {
    if (!watchingMovie) return null
    const nextMovie = getNextMovie()
    return (
      <VideoPlayer
        movie={watchingMovie}
        initialTime={watchingInitialTime}
        initialTheaterMode={theaterMode}
        onClose={closePlayer}
        onProgressSave={(time, dur) => {
          saveProgress(watchingMovie, time, dur, false)
        }}
        onNext={nextMovie ? () => playNextMovie(nextMovie) : undefined}
        nextMovieTitle={nextMovie?.title}
      />
    )
  }

  const Footer = () => (
    <footer className="border-t border-white/[0.06] bg-black px-5 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">

        <div>
          <div className="flex items-center gap-2">
            <img
              src="/pmf-flix-logo.png"
              alt="PMF-Flix"
              className="h-8 sm:h-9 w-auto object-contain opacity-90"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                const fb = document.getElementById('pmf-footer-logo-fallback')
                if (fb) fb.style.display = 'flex'
              }}
            />
            <div id="pmf-footer-logo-fallback" style={{ display: 'none' }}>
              <PMFLogo size={32} showWordmark={true} />
            </div>
          </div>

          <p className="mt-4 max-w-sm text-[10px] leading-5 text-white/25">
            Prince Mufasa Flix — a cinematic
            home for stories from Nigeria,
            Africa and the world.
          </p>
        </div>

        <div className="text-left sm:text-right">
          <p className="text-[7px] font-black uppercase tracking-[0.2em] text-white/20">
            Your World. Your Stories. Your Flix.
          </p>

          <p className="mt-2 text-[8px] text-white/15">
            © {new Date().getFullYear()} PMF-Flix
          </p>
        </div>
      </div>
    </footer>
  )

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center">
            <img
              src="/pmf-flix-icon.png"
              alt="PMF-Flix"
              className="h-20 w-20 object-contain rounded-2xl shadow-2xl animate-pulse"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                const fb = document.getElementById('pmf-splash-icon-fallback')
                if (fb) fb.style.display = 'flex'
              }}
            />
            <div id="pmf-splash-icon-fallback" style={{ display: 'none' }}>
              <PMFLogo size={48} />
            </div>
          </div>

          <p className="mt-5 text-[9px] font-black uppercase tracking-[0.3em] text-white/35">
            PMF-FLIX
          </p>

          <p className="mt-2 text-xs text-white/30">
            Restoring your session...
          </p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <AuthScreen
        onAuthenticated={(nextSession: Session) => {
          setSession(nextSession)
        }}
      />
    )
  }

  // Signature Profile Universe Gate: User must select an authorized profile
  if (isSelectingProfile || !activeProfile) {
    return (
      <ProfileSelectionScreen
        profiles={userProfiles}
        activeProfileId={activeProfile?.id || null}
        onSelectProfile={handleSelectProfile}
        onCreateProfile={handleCreateProfile}
        onUpdateProfile={handleUpdateProfile}
        onDeleteProfile={handleDeleteProfile}
        onSignOut={handleSignOut}
      />
    )
  }

  return (
    <div className="pmf-app-shell min-h-screen bg-[#050505] text-white selection:bg-white selection:text-black">
      {Header()}

      {MobileSearchResults()}

      {toastMessage &&
        !showProfile && (
          <div className="fixed bottom-5 left-1/2 z-[75] -translate-x-1/2 rounded-full border border-white/10 bg-black/85 px-5 py-3 text-[8px] font-black uppercase tracking-[0.14em] text-white/65 shadow-2xl backdrop-blur-xl">
            {toastMessage}
          </div>
        )}

      {section === 'home' && (
        <>
          {HomeContent()}
          {Footer()}
        </>
      )}

      {(section === 'movies' ||
        section === 'series') &&
        CatalogPage({
          type:
            section === 'movies'
              ? 'Movie'
              : 'Series',
        })}

      {section === 'my-list' &&
        MyListPage()}

      {section === 'offline' && (
        <OfflineCinemaPage
          onPlayMovie={(movie, offlineStreamUrl) =>
            startWatching(movie, offlineStreamUrl)
          }
          onExploreCatalogue={() => navigate('movies')}
        />
      )}

      {section === 'trending' && (
        <main className="min-h-screen bg-[#050505] px-5 pb-24 pt-32 sm:px-10 lg:px-16">
          <div className="mx-auto max-w-[1600px]">
            <TrendingRail
              movies={safeCatalogMovies}
              onPlayMovie={startWatching}
              onExploreMovie={openMovie}
            />
            <div className="mt-8">
              <h3 className="text-xl font-black text-white mb-4">Complete Trending Catalogue</h3>
              {MovieGrid({ items: trendingMovies })}
            </div>
          </div>
        </main>
      )}

      {section === 'nollywood' && (
        <main className="min-h-screen bg-[#050505] px-5 pb-24 pt-32 sm:px-10 lg:px-16">
          <div className="mx-auto max-w-[1600px]">
            <div className="mb-8">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-400">
                African Cinema & Nollywood Spotlight
              </span>
              <h1 className="mt-1 text-3xl font-black text-white sm:text-4xl">
                Stories from Lagos, Accra, Johannesburg & the Continent
              </h1>
            </div>
            {MovieGrid({ items: africanAndNollywoodMovies })}
          </div>
        </main>
      )}

      {section === 'buzz-boss' && (
        <main className="min-h-screen bg-[#050505] px-4 pb-28 pt-28 sm:px-8 max-w-[1600px] mx-auto">
          <ShortsComedyCatalog
            onOpenStudio={() => setShowStudio(true)}
          />
        </main>
      )}

      {section === 'free-novels' && (
        <main className="min-h-screen bg-[#050505] px-4 pb-28 pt-28 sm:px-8 max-w-[1600px] mx-auto">
          <NovelsLibraryCatalog
            onOpenStudio={() => setShowStudio(true)}
          />
        </main>
      )}

      {section === 'sports' && (
        <main className="min-h-screen bg-[#050505] px-4 pb-28 pt-28 sm:px-8 max-w-[1600px] mx-auto">
          <LiveSportsCatalog
            onOpenStudio={() => setShowStudio(true)}
          />
        </main>
      )}

      {section === 'shorts' && (
        <PMFShortsExperience
          onBackToHome={() => setSection('home')}
          onOpenStudio={() => setShowStudio(true)}
          allMovies={safeCatalogMovies}
        />
      )}

      {section === 'midnight-18' && (
        <Midnight18Category
          movies={movies}
          activeProfile={activeProfile}
          onPlayMovie={startWatching}
          onSelectMovie={openMovie}
          onExitCategory={() => navigate('home')}
        />
      )}

      {selectedMovie &&
        MovieDetails()}

      {selectedSeason &&
        SeasonDetails()}

      {showProfile &&
        ProfilePanel()}

      {showStudio && (
        <AdminStudio
          onClose={() =>
            setShowStudio(false)
          }
        />
      )}

      {/* SMART DISCOVERY MODALS */}
      <WorldCinemaModal
        isOpen={showWorldCinema}
        onClose={() => setShowWorldCinema(false)}
        movies={safeCatalogMovies}
        onSelectMovie={(movie) => {
          setShowWorldCinema(false)
          openMovie(movie)
        }}
      />

      <SurpriseMeModal
        isOpen={showRoulette}
        onClose={() => setShowRoulette(false)}
        movies={safeCatalogMovies}
        onPlayMovie={(movie) => {
          setShowRoulette(false)
          startWatching(movie)
        }}
        onExploreMovie={(movie) => {
          setShowRoulette(false)
          openMovie(movie)
        }}
      />

      <WatchPartyModal
        isOpen={Boolean(watchPartyMovie)}
        onClose={() => setWatchPartyMovie(null)}
        movie={watchPartyMovie}
      />

      {/* PERSISTENT MOBILE BOTTOM NAVIGATION (Reference Images 1 & 2) */}
      {!watchingMovie && (
        <PMFBottomNavigation
          currentSection={section}
          onNavigate={(sec) => navigate(sec as Section)}
          onOpenMe={() => setShowProfile(true)}
          downloadsCount={downloadsCount}
          profileAvatar={profile.avatar}
        />
      )}

      {watchingMovie && renderPlayer()}
    </div>
  )
}

export default function App() {
  return <AppShell />
}
