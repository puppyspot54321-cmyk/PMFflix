import { useEffect, useMemo, useRef, useState } from 'react'
import heroImage from './assets/hero.png'
import type { Movie } from './movieData/movies'
import { getMovies } from './services/movieService'
import { mapCanonicalMovieToLegacy } from './services/movieMapper'
import { supabase } from './supabase'
import type { Session } from '@supabase/supabase-js'
import AuthScreen from './Auth'

import {
  Check,
  Film,
  Heart,
  ListPlus,
  LoaderCircle,
  Menu,
  Pause,
  Play,
  Search,
  Settings,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'

type Section =
  | 'Home'
  | 'Movies'
  | 'TV Series'
  | 'My List'

type Profile = {
  name: string
  avatar: string
}

type HistoryItem = {
  id: string
  watchedAt: number
}

type Progress = {
  id: string
  currentTime: number
  duration: number
  updatedAt: number
}

type Filters = {
  category: string
  year: string
  rating: string
  sort: string
}

const PROFILE_KEY = 'pmf-profile'
const MY_LIST_KEY = 'pmf-my-list'
const CONTINUE_KEY = 'pmf-continue'
const HISTORY_KEY = 'pmf-history'
const PROGRESS_KEY = 'pmf-progress'

const AVATARS = [
  'https://api.dicebear.com/9.x/thumbs/svg?seed=Prince',
  'https://api.dicebear.com/9.x/thumbs/svg?seed=Flix',
  'https://api.dicebear.com/9.x/thumbs/svg?seed=PMF',
  'https://api.dicebear.com/9.x/thumbs/svg?seed=Cinema',
]

function readStorage<T>(
  key: string,
  fallback: T,
): T {
  try {
    const value = localStorage.getItem(key)

    if (!value) {
      return fallback
    }

    return JSON.parse(value) as T
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
    // Ignore storage failures.
  }
}

function getMovieId(movie: Movie) {
  return String(movie.id)
}

function getRating(movie: Movie) {
  const value = String(
    movie.rating ?? '',
  )

  const numeric = Number.parseFloat(
    value,
  )

  return Number.isFinite(numeric)
    ? numeric
    : 0
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) {
    return '0:00'
  }

  const safe = Math.max(
    0,
    Math.floor(seconds),
  )

  const minutes = Math.floor(
    safe / 60,
  )

  const remaining = String(
    safe % 60,
  ).padStart(2, '0')

  return `${minutes}:${remaining}`
}

function getYouTubeId(url: string) {
  if (!url) {
    return ''
  }

  const patterns = [
    /youtu\.be\/([^?&/]+)/i,
    /youtube\.com\/watch\?v=([^?&/]+)/i,
    /youtube\.com\/embed\/([^?&/]+)/i,
    /youtube\.com\/shorts\/([^?&/]+)/i,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)

    if (match?.[1]) {
      return match[1]
    }
  }

  return ''
}

function getVideoUrl(movie: Movie) {
  return movie.videoUrl || ''
}

function isYouTube(movie: Movie) {
  const url = getVideoUrl(movie)

  return (
    movie.videoType === 'youtube' ||
    /youtube\.com|youtu\.be/i.test(url)
  )
}

function getYouTubeEmbed(movie: Movie) {
  const id = getYouTubeId(
    getVideoUrl(movie),
  )

  if (!id) {
    return ''
  }

  return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`
}

export default function App() {
  return <AppShell />
}

function AppShell() {
  const [session, setSession] =
    useState<Session | null>(null)

  const [authLoading, setAuthLoading] =
    useState(true)

  const [section, setSection] =
    useState<Section>('Home')

  const [search, setSearch] =
    useState('')

  const [movies, setMovies] =
    useState<Movie[]>([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  const [selectedMovie, setSelectedMovie] =
    useState<Movie | null>(null)

  const [watchingMovie, setWatchingMovie] =
    useState<Movie | null>(null)

  const [profile, setProfile] =
    useState<Profile>(() =>
      readStorage<Profile>(
        PROFILE_KEY,
        {
          name: 'Prince',
          avatar: AVATARS[0],
        },
      ),
    )

  const [myList, setMyList] =
    useState<string[]>(() =>
      readStorage<string[]>(
        MY_LIST_KEY,
        [],
      ),
    )

  const [continueWatching, setContinueWatching] =
    useState<string[]>(() =>
      readStorage<string[]>(
        CONTINUE_KEY,
        [],
      ),
    )

  const [history, setHistory] =
    useState<HistoryItem[]>(() =>
      readStorage<HistoryItem[]>(
        HISTORY_KEY,
        [],
      ),
    )

  const [progress, setProgress] =
    useState<Progress[]>(() =>
      readStorage<Progress[]>(
        PROGRESS_KEY,
        [],
      ),
    )

  const [filters, setFilters] =
    useState<Filters>({
      category: 'All',
      year: 'All',
      rating: 'All',
      sort: 'Featured',
    })

  const [showFilters, setShowFilters] =
    useState(false)

  const [showProfile, setShowProfile] =
    useState(false)

  const [mobileMenu, setMobileMenu] =
    useState(false)

  const [playerPlaying, setPlayerPlaying] =
    useState(false)

  const [playerTime, setPlayerTime] =
    useState(0)

  const [playerDuration, setPlayerDuration] =
    useState(0)

  const [volume, setVolume] =
    useState(1)

  const [muted, setMuted] =
    useState(false)

  const [speed, setSpeed] =
    useState(1)

  const [showPlayerSettings, setShowPlayerSettings] =
    useState(false)

  const [showPlayerControls, setShowPlayerControls] =
    useState(true)

  const [playerMessage, setPlayerMessage] =
    useState('')

  const videoRef =
    useRef<HTMLVideoElement | null>(null)

  const playerRef =
    useRef<HTMLDivElement | null>(null)

  const controlsTimer =
    useRef<ReturnType<typeof setTimeout> | null>(null)

  const messageTimer =
    useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let mounted = true

    const loadSession = async () => {
      const { data } =
        await supabase.auth.getSession()

      if (!mounted) {
        return
      }

      setSession(data.session)
      setAuthLoading(false)
    }

    void loadSession()

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        (_event, nextSession) => {
          if (!mounted) {
            return
          }

          setSession(nextSession)
          setAuthLoading(false)
        },
      )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    writeStorage(
      PROFILE_KEY,
      profile,
    )
  }, [profile])

  useEffect(() => {
    writeStorage(
      MY_LIST_KEY,
      myList,
    )
  }, [myList])

  useEffect(() => {
    writeStorage(
      CONTINUE_KEY,
      continueWatching,
    )
  }, [continueWatching])

  useEffect(() => {
    writeStorage(
      HISTORY_KEY,
      history,
    )
  }, [history])

  useEffect(() => {
    writeStorage(
      PROGRESS_KEY,
      progress,
    )
  }, [progress])

  useEffect(() => {
    let active = true

    const loadMovies = async () => {
      try {
        setLoading(true)
        setError('')

        const result =
          await getMovies()

        if (!active) {
          return
        }

        setMovies(
          result.map(
            mapCanonicalMovieToLegacy,
          ),
        )
      } catch (loadError) {
        console.error(
          'PMF catalogue error:',
          loadError,
        )

        if (active) {
          setError(
            'Unable to load the PMF catalogue. Please try again.',
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadMovies()

    const channel =
      supabase
        .channel('pmf-movie-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'movies',
          },
          () => {
            void loadMovies()
          },
        )
        .subscribe()

    return () => {
      active = false
      void supabase.removeChannel(
        channel,
      )
    }
  }, [])

  const findMovie = (
    id: string,
  ) =>
    movies.find(
      (movie) =>
        getMovieId(movie) === id,
    )

  const getProgress = (
    movie: Movie,
  ) =>
    progress.find(
      (item) =>
        item.id ===
        getMovieId(movie),
    )

  const progressPercent = (
    movie: Movie,
  ) => {
    const item =
      getProgress(movie)

    if (
      !item ||
      item.duration <= 0
    ) {
      return 0
    }

    return Math.min(
      100,
      Math.round(
        (item.currentTime /
          item.duration) *
          100,
      ),
    )
  }

  const isInMyList = (
    movie: Movie,
  ) =>
    myList.includes(
      getMovieId(movie),
    )

  const toggleMyList = (
    movie: Movie,
  ) => {
    const id =
      getMovieId(movie)

    setMyList((current) =>
      current.includes(id)
        ? current.filter(
            (item) =>
              item !== id,
          )
        : [id, ...current],
    )

    showMessage(
      isInMyList(movie)
        ? 'Removed from My List'
        : 'Added to My List',
    )
  }

  const addToHistory = (
    movie: Movie,
  ) => {
    const id =
      getMovieId(movie)

    setHistory((current) => [
      {
        id,
        watchedAt: Date.now(),
      },
      ...current.filter(
        (item) =>
          item.id !== id,
      ),
    ].slice(0, 30))
  }

  const addToContinueWatching = (
    movie: Movie,
  ) => {
    const id =
      getMovieId(movie)

    setContinueWatching(
      (current) => [
        id,
        ...current.filter(
          (item) =>
            item !== id,
        ),
      ].slice(0, 20),
    )
  }

  const saveProgress = (
    movie: Movie,
    currentTime: number,
    duration: number,
  ) => {
    const id =
      getMovieId(movie)

    if (
      !Number.isFinite(currentTime) ||
      !Number.isFinite(duration) ||
      duration <= 0
    ) {
      return
    }

    setProgress((current) => [
      {
        id,
        currentTime,
        duration,
        updatedAt: Date.now(),
      },
      ...current.filter(
        (item) =>
          item.id !== id,
      ),
    ].slice(0, 30))
  }

  const openMovie = (
    movie: Movie,
  ) => {
    setSelectedMovie(movie)
    setShowProfile(false)
  }

  const startWatching = (
    movie: Movie,
  ) => {
    setSelectedMovie(null)
    setWatchingMovie(movie)
    setPlayerTime(
      getProgress(movie)
        ?.currentTime || 0,
    )
    setPlayerPlaying(true)
    addToHistory(movie)
    addToContinueWatching(movie)
  }

  const closePlayer = () => {
    if (watchingMovie) {
      saveProgress(
        watchingMovie,
        playerTime,
        playerDuration,
      )
    }

    setWatchingMovie(null)
    setPlayerPlaying(false)
    setPlayerTime(0)
    setPlayerDuration(0)
    setShowPlayerSettings(false)
  }

  const showMessage = (
    message: string,
  ) => {
    setPlayerMessage(message)

    if (messageTimer.current) {
      clearTimeout(
        messageTimer.current,
      )
    }

    messageTimer.current =
      setTimeout(() => {
        setPlayerMessage('')
      }, 2200)
  }

  const playPause = () => {
    const video =
      videoRef.current

    if (!video) {
      setPlayerPlaying(
        (current) => !current,
      )
      return
    }

    if (video.paused) {
      void video.play()
      setPlayerPlaying(true)
    } else {
      video.pause()
      setPlayerPlaying(false)
    }
  }

  const seek = (
    amount: number,
  ) => {
    const video =
      videoRef.current

    if (!video) {
      return
    }

    video.currentTime =
      Math.max(
        0,
        Math.min(
          video.duration || 0,
          video.currentTime +
            amount,
        ),
      )
  }

  const changeVolume = (
    nextVolume: number,
  ) => {
    const safeVolume =
      Math.max(
        0,
        Math.min(1, nextVolume),
      )

    setVolume(safeVolume)
    setMuted(
      safeVolume === 0,
    )

    if (videoRef.current) {
      videoRef.current.volume =
        safeVolume
      videoRef.current.muted =
        safeVolume === 0
    }
  }

  const changeSpeed = (
    nextSpeed: number,
  ) => {
    setSpeed(nextSpeed)

    if (videoRef.current) {
      videoRef.current.playbackRate =
        nextSpeed
    }

    showMessage(
      `Playback speed ${nextSpeed}x`,
    )
  }

  const navigate = (
    next: Section,
  ) => {
    setSection(next)
    setSearch('')
    setSelectedMovie(null)
    setShowFilters(false)
    setShowProfile(false)
    setMobileMenu(false)

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  const updateFilter = (
    key: keyof Filters,
    value: string,
  ) => {
    setFilters(
      (current) => ({
        ...current,
        [key]: value,
      }),
    )
  }

  const resetFilters = () => {
    setFilters({
      category: 'All',
      year: 'All',
      rating: 'All',
      sort: 'Featured',
    })
    }

    const filteredMovies = useMemo(() => {
    let result = [...movies]

    if (search.trim()) {
      const query =
        search.toLowerCase().trim()

      result = result.filter(
        (movie) =>
          movie.title
            .toLowerCase()
            .includes(query) ||
          movie.category
            .toLowerCase()
            .includes(query) ||
          movie.description
            .toLowerCase()
            .includes(query),
      )
    }

    if (
      filters.category !== 'All'
    ) {
      result = result.filter(
        (movie) =>
          movie.category ===
          filters.category,
      )
    }

    if (filters.year !== 'All') {
      result = result.filter(
        (movie) =>
          String(movie.year) ===
          filters.year,
      )
    }

    if (filters.rating !== 'All') {
      result = result.filter(
        (movie) =>
          getRating(movie) >=
          Number(filters.rating),
      )
    }

    if (filters.sort === 'Newest') {
      result.sort(
        (a, b) =>
          b.year - a.year,
      )
    }

    if (filters.sort === 'Oldest') {
      result.sort(
        (a, b) =>
          a.year - b.year,
      )
    }

    if (filters.sort === 'A-Z') {
      result.sort(
        (a, b) =>
          a.title.localeCompare(
            b.title,
          ),
      )
    }

    if (filters.sort === 'Rating') {
      result.sort(
        (a, b) =>
          getRating(b) -
          getRating(a),
      )
    }

    return result
  }, [
    movies,
    search,
    filters,
  ])

  const continueMovies =
    continueWatching
      .map(findMovie)
      .filter(
        (movie): movie is Movie =>
          Boolean(movie),
      )

  const historyMovies =
    [...history]
      .sort(
        (a, b) =>
          b.watchedAt -
          a.watchedAt,
      )
      .map(
        (item) =>
          findMovie(item.id),
      )
      .filter(
        (movie): movie is Movie =>
          Boolean(movie),
      )

  const featuredMovies =
    movies.filter(
      (movie) =>
        movie.featured,
    )

  const trendingMovies =
    [...movies]
      .sort(
        (a, b) =>
          getRating(b) -
          getRating(a),
      )
      .slice(0, 10)

  const latestMovies =
    [...movies]
      .sort(
        (a, b) =>
          b.year - a.year,
      )
      .slice(0, 10)

  const personalizedMovies =
    movies.filter(
      (movie) =>
        historyMovies.some(
          (watched) =>
            watched.category ===
            movie.category,
        ),
    )

  const categories = [
    'All',
    ...Array.from(
      new Set(
        movies.map(
          (movie) =>
            movie.category,
        ),
      ),
    ),
  ]

  const years = [
    'All',
    ...Array.from(
      new Set(
        movies.map(
          (movie) =>
            String(movie.year),
        ),
      ),
    ).sort(
      (a, b) =>
        b.localeCompare(a),
    ),
  ]

  const categoryRows =
    categories
      .filter(
        (category) =>
          category !== 'All',
      )
      .map((category) => ({
        category,
        items: movies.filter(
          (movie) =>
            movie.category ===
            category,
        ),
      }))
      .filter(
        (row) =>
          row.items.length > 0,
      )

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <div className="flex flex-col items-center gap-4">
          <LoaderCircle
            size={28}
            className="animate-spin text-white/50"
          />

          <p className="text-[9px] font-black uppercase tracking-[0.28em] text-white/30">
            Loading PMF-Flix
          </p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <AuthScreen
        onAuthenticated={(
          nextSession: Session,
        ) => {
          setSession(
            nextSession,
          )
        }}
      />
    )
  }

  const SectionTitle = ({
    eyebrow,
    title,
    subtitle,
  }: {
    eyebrow?: string
    title: string
    subtitle?: string
  }) => (
    <div className="mb-5">
      {eyebrow && (
        <p className="mb-2 text-[8px] font-black uppercase tracking-[0.24em] text-white/25">
          {eyebrow}
        </p>
      )}

      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-[-0.035em] text-white sm:text-2xl">
            {title}
          </h2>

          {subtitle && (
            <p className="mt-1 max-w-xl text-[10px] leading-5 text-white/30 sm:text-xs">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  )

  const MovieCard = ({
    movie,
  }: {
    movie: Movie
  }) => {
    const percent =
      progressPercent(movie)

    return (
      <article className="group relative w-[145px] shrink-0 sm:w-[175px] md:w-[190px]">
        <button
          type="button"
          onClick={() =>
            openMovie(movie)
          }
          className="block w-full text-left"
        >
          <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] shadow-2xl transition duration-300 group-hover:-translate-y-1 group-hover:border-white/15">
            <img
              src={movie.poster}
              alt={movie.title}
              className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.045]"
              loading="lazy"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent opacity-80" />

            <div className="absolute left-2.5 top-2.5 flex gap-1.5">
              <span className="rounded-full border border-white/10 bg-black/65 px-2 py-1 text-[7px] font-black uppercase tracking-[0.12em] text-white/70 backdrop-blur-md">
                {movie.type}
              </span>

              {movie.featured && (
                <span className="rounded-full bg-white px-2 py-1 text-[7px] font-black uppercase tracking-[0.12em] text-black">
                  PMF
                </span>
              )}
            </div>

            <div className="absolute inset-x-3 bottom-3">
              <p className="truncate text-sm font-black text-white">
                {movie.title}
              </p>

              <div className="mt-1 flex items-center gap-2 text-[8px] font-bold text-white/45">
                <span>
                  {movie.year}
                </span>

                <span>•</span>

                <span>
                  {movie.category}
                </span>
              </div>
            </div>

            {percent > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                <div
                  className="h-full bg-white"
                  style={{
                    width: `${percent}%`,
                  }}
                />
              </div>
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            toggleMyList(movie)
          }
          aria-label={
            isInMyList(movie)
              ? 'Remove from My List'
              : 'Add to My List'
          }
          className="absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/65 text-white/65 opacity-0 backdrop-blur-md transition group-hover:opacity-100 hover:bg-white hover:text-black"
        >
          {isInMyList(movie) ? (
            <Check size={14} />
          ) : (
            <ListPlus size={14} />
          )}
        </button>
      </article>
    )
  }

  const MovieRow = ({
    title,
    subtitle,
    items,
    eyebrow,
  }: {
    title: string
    subtitle?: string
    items: Movie[]
    eyebrow?: string
  }) => {
    if (!items.length) {
      return null
    }

    return (
      <section className="mb-12">
        <SectionTitle
          eyebrow={eyebrow}
          title={title}
          subtitle={subtitle}
        />

        <div className="no-scrollbar flex gap-3 overflow-x-auto pb-3 sm:gap-4">
          {items.map(
            (movie) => (
              <MovieCard
                key={getMovieId(movie)}
                movie={movie}
              />
            ),
          )}
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
            Try another search,
            category, year or
            rating.
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.map(
          (movie) => (
            <div
              key={getMovieId(movie)}
              className="min-w-0"
            >
              <MovieCard
                movie={movie}
              />
            </div>
          ),
        )}
      </div>
    )
   } 

  const HomePage = () => {
    const featured =
      featuredMovies[0] ||
      movies[0]

    return (
      <>
        <section className="relative min-h-[78vh] overflow-hidden bg-[#050505]">
          {featured && (
            <>
              <img
                src={
                  featured.poster ||
                  heroImage
                }
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-45"
              />

              <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/20" />

              <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-black/30" />
            </>
          )}

          <div className="relative mx-auto flex min-h-[78vh] max-w-[1600px] items-end px-5 pb-20 pt-32 sm:px-10 lg:px-16">
            <div className="max-w-2xl">
              <div className="mb-5 flex items-center gap-3">
                <span className="text-[8px] font-black uppercase tracking-[0.28em] text-white/40">
                  PMF — Prince Mufasa Flix
                </span>

                <span className="h-px w-10 bg-white/20" />

                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/30">
                  Featured
                </span>
              </div>

              <h1 className="text-5xl font-black leading-[0.9] tracking-[-0.065em] text-white sm:text-7xl lg:text-8xl">
                {featured
                  ? featured.title
                  : 'Your World. Your Stories. Your Flix.'}
              </h1>

              {featured && (
                <>
                  <div className="mt-6 flex flex-wrap items-center gap-3 text-[9px] font-black uppercase tracking-[0.12em] text-white/45">
                    <span>
                      {featured.year}
                    </span>

                    <span>•</span>

                    <span>
                      {featured.type}
                    </span>

                    <span>•</span>

                    <span>
                      {featured.category}
                    </span>

                    {featured.duration && (
                      <>
                        <span>•</span>

                        <span>
                          {featured.duration}
                        </span>
                      </>
                    )}
                  </div>

                  <p className="mt-5 max-w-xl text-sm leading-7 text-white/55">
                    {featured.description}
                  </p>

                  <div className="mt-8 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        startWatching(
                          featured,
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-[9px] font-black uppercase tracking-[0.16em] text-black transition hover:scale-[1.02]"
                    >
                      <Play
                        size={14}
                        fill="currentColor"
                      />
                      Play Now
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        openMovie(featured)
                      }
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 text-[9px] font-black uppercase tracking-[0.16em] text-white/70 backdrop-blur-md transition hover:bg-white/10 hover:text-white"
                    >
                      More Info
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        toggleMyList(
                          featured,
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-5 py-3.5 text-[9px] font-black uppercase tracking-[0.16em] text-white/60 backdrop-blur-md"
                    >
                      {isInMyList(
                        featured,
                      ) ? (
                        <Check size={14} />
                      ) : (
                        <Heart size={14} />
                      )}

                      {isInMyList(
                        featured,
                      )
                        ? 'In My List'
                        : 'My List'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        <main className="relative mx-auto max-w-[1600px] overflow-hidden px-5 pb-24 pt-12 sm:px-10 lg:px-16">
          {continueMovies.length >
            0 && (
            <MovieRow
              eyebrow="Pick up where you left off"
              title="Continue Watching"
              subtitle="Your unfinished stories, ready when you are."
              items={
                continueMovies
              }
            />
          )}

          {featuredMovies.length >
            1 && (
            <MovieRow
              eyebrow="PMF selection"
              title="Featured"
              subtitle="Stories selected for the PMF experience."
              items={
                featuredMovies
              }
            />
          )}

          {trendingMovies.length >
            0 && (
            <MovieRow
              eyebrow="What's moving"
              title="Trending Now"
              subtitle="The titles creating the most excitement on PMF-Flix."
              items={
                trendingMovies
              }
            />
          )}

          {personalizedMovies.length >
            0 && (
            <MovieRow
              eyebrow="Made for your journey"
              title="Made For You"
              subtitle="Recommendations shaped by your viewing journey."
              items={
                personalizedMovies
              }
            />
          )}

          {latestMovies.length >
            0 && (
            <MovieRow
              eyebrow="Fresh from the catalogue"
              title="New & Noteworthy"
              subtitle="Fresh stories waiting to be discovered."
              items={
                latestMovies
              }
            />
          )}

          {categoryRows.map(
            (row) => (
              <MovieRow
                key={row.category}
                eyebrow="Explore by category"
                title={row.category}
                subtitle={`Discover ${row.category.toLowerCase()} stories on PMF-Flix.`}
                items={row.items}
              />
            ),
          )}

          {historyMovies.length >
            0 && (
            <MovieRow
              eyebrow="Your activity"
              title="Recently Watched"
              subtitle="Your latest PMF-Flix activity."
              items={
                historyMovies.slice(
                  0,
                  10,
                )
              }
            />
          )}

          <section className="relative mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.025] px-6 py-12 sm:px-10 lg:px-16">
            <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-white/[0.035] blur-3xl" />

            <div className="relative max-w-3xl">
              <div className="mb-4 flex items-center gap-2 text-white/35">
                <Sparkles
                  size={15}
                />

                <span className="text-[8px] font-black uppercase tracking-[0.25em]">
                  PMF Intelligence
                </span>
              </div>

              <h2 className="text-3xl font-black tracking-[-0.05em] text-white sm:text-5xl">
                Entertainment,
                <br />
                shaped around you.
              </h2>

              <p className="mt-5 max-w-2xl text-sm leading-7 text-white/35">
                PMF-Flix learns from
                your journey to help
                you discover stories
                that fit your taste,
                mood and curiosity.
              </p>

              <button
                type="button"
                onClick={() =>
                  navigate('Movies')
                }
                className="mt-7 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-[8px] font-black uppercase tracking-[0.18em] text-white/65 transition hover:bg-white/10 hover:text-white"
              >
                Explore the Universe
              </button>
            </div>
          </section>

          <section className="py-20 text-center">
            <p className="text-[8px] font-black uppercase tracking-[0.3em] text-white/20">
              PMF — Prince Mufasa
              Flix
            </p>

            <h2 className="mt-4 text-3xl font-black tracking-[-0.05em] text-white/90 sm:text-5xl">
              Your world.
              <br />
              Your stories.
              <br />
              Your Flix.
            </h2>

            <p className="mx-auto mt-5 max-w-xl text-xs leading-6 text-white/25">
              A cinematic entertainment
              universe built for stories
              from everywhere.
            </p>
          </section>
        </main>
      </>
    )
  }

  const CatalogPage = ({
    type,
  }: {
    type: 'Movie' | 'Series'
  }) => {
    const catalogItems =
      filteredMovies.filter(
        (movie) =>
          String(
            movie.type || '',
          ).toLowerCase() ===
          type.toLowerCase(),
      )

    return (
      <main className="mx-auto min-h-screen max-w-[1600px] px-5 pb-24 pt-32 sm:px-10 lg:px-16">
        <div className="mb-10">
          <p className="text-[8px] font-black uppercase tracking-[0.28em] text-white/25">
            PMF Catalogue
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-white sm:text-6xl">
            {type === 'Movie'
              ? 'Movies'
              : 'TV Series'}
          </h1>

          <p className="mt-3 max-w-2xl text-xs leading-6 text-white/30">
            Discover stories across
            the PMF entertainment
            universe.
          </p>
        </div>

        <div className="mb-7 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setShowFilters(
                (value) =>
                  !value,
              )
            }
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[8px] font-black uppercase tracking-[0.15em] text-white/55"
          >
            Filters
          </button>

          {showFilters && (
            <>
              <select
                value={
                  filters.category
                }
                onChange={(event) =>
                  updateFilter(
                    'category',
                    event.target.value,
                  )
                }
                className="rounded-xl border border-white/10 bg-black px-4 py-3 text-[8px] font-black uppercase tracking-[0.12em] text-white/60 outline-none"
              >
                {categories.map(
                  (category) => (
                    <option
                      key={category}
                      value={
                        category
                      }
                    >
                      {category}
                    </option>
                  ),
                )}
              </select>

              <select
                value={filters.year}
                onChange={(event) =>
                  updateFilter(
                    'year',
                    event.target.value,
                  )
                }
                className="rounded-xl border border-white/10 bg-black px-4 py-3 text-[8px] font-black uppercase tracking-[0.12em] text-white/60 outline-none"
              >
                {years.map(
                  (year) => (
                    <option
                      key={year}
                      value={year}
                    >
                      {year}
                    </option>
                  ),
                )}
              </select>

              <select
                value={
                  filters.sort
                }
                onChange={(event) =>
                  updateFilter(
                    'sort',
                    event.target.value,
                  )
                }
                className="rounded-xl border border-white/10 bg-black px-4 py-3 text-[8px] font-black uppercase tracking-[0.12em] text-white/60 outline-none"
              >
                <option value="Featured">
                  Featured
                </option>
                <option value="Newest">
                  Newest
                </option>
                <option value="Oldest">
                  Oldest
                </option>
                <option value="A-Z">
                  A-Z
                </option>
                <option value="Rating">
                  Rating
                </option>
              </select>

              <button
                type="button"
                onClick={
                  resetFilters
                }
                className="rounded-xl px-4 py-3 text-[8px] font-black uppercase tracking-[0.15em] text-white/30 hover:text-white"
              >
                Reset
              </button>
            </>
          )}
        </div>

        <MovieGrid
          items={catalogItems}
        />
      </main>
    )
  }

  const MyListPage = () => {
    const savedMovies =
      myList
        .map(findMovie)
        .filter(
          (movie): movie is Movie =>
            Boolean(movie),
        )

    return (
      <main className="mx-auto min-h-screen max-w-[1600px] px-5 pb-24 pt-32 sm:px-10 lg:px-16">
        <div className="mb-10">
          <p className="text-[8px] font-black uppercase tracking-[0.28em] text-white/25">
            Your Collection
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-white sm:text-6xl">
            My List
          </h1>

          <p className="mt-3 max-w-2xl text-xs leading-6 text-white/30">
            Stories you have saved
            for later.
          </p>
        </div>

        <MovieGrid
          items={savedMovies}
        />
      </main>
    )
  }

  const MovieDetails = () => {
    if (!selectedMovie) {
      return null
    }

    const movie =
      selectedMovie

    const percent =
      progressPercent(movie)

    const relatedMovies =
      movies
        .filter(
          (item) =>
            item.id !== movie.id &&
            item.category ===
              movie.category,
        )
        .slice(0, 6)

    return (
      <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#050505]">
        <div className="relative min-h-screen">
          <img
            src={movie.poster}
            alt=""
            className="absolute inset-x-0 top-0 h-[75vh] w-full object-cover opacity-25"
          />

          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-[#050505]/80 to-[#050505]" />

          <div className="relative mx-auto max-w-[1600px] px-5 pb-24 pt-24 sm:px-10 lg:px-16">
            <button
              type="button"
              onClick={() =>
                setSelectedMovie(null)
              }
              className="mb-10 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-[8px] font-black uppercase tracking-[0.16em] text-white/55 backdrop-blur-md hover:text-white"
            >
              <X size={14} />
              Close
            </button>

            <div className="grid items-end gap-10 lg:grid-cols-[280px_1fr]">
              <div className="mx-auto w-full max-w-[280px]">
                <div className="overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
                  <img
                    src={movie.poster}
                    alt={movie.title}
                    className="aspect-[2/3] w-full object-cover"
                  />
                </div>
              </div>

              <div className="max-w-3xl">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[7px] font-black uppercase tracking-[0.15em] text-white/45">
                    {movie.type}
                  </span>

                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[7px] font-black uppercase tracking-[0.15em] text-white/45">
                    {movie.category}
                  </span>

                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[7px] font-black uppercase tracking-[0.15em] text-white/45">
                    {movie.year}
                  </span>
                </div>

                <h1 className="mt-5 text-5xl font-black tracking-[-0.065em] text-white sm:text-7xl">
                  {movie.title}
                </h1>

                <div className="mt-5 flex flex-wrap items-center gap-4 text-[9px] font-black uppercase tracking-[0.14em] text-white/40">
                  {movie.rating && (
                    <span>
                      {movie.rating}
                    </span>
                  )}

                  {movie.duration && (
                    <>
                      <span>•</span>
                      <span>
                        {movie.duration}
                      </span>
                    </>
                  )}

                  <span>•</span>

                  <span>
                    PMF Original
                  </span>
                </div>

                <p className="mt-6 max-w-2xl text-sm leading-7 text-white/50">
                  {movie.description}
                </p>

                {percent > 0 && (
                  <div className="mt-7 max-w-xl">
                    <div className="mb-2 flex items-center justify-between text-[8px] font-black uppercase tracking-[0.15em] text-white/30">
                      <span>
                        Continue Watching
                      </span>

                      <span>
                        {percent}%
                      </span>
                    </div>

                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-white"
                        style={{
                          width: `${percent}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-8 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      startWatching(movie)
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-[9px] font-black uppercase tracking-[0.16em] text-black transition hover:scale-[1.02]"
                  >
                    <Play
                      size={14}
                      fill="currentColor"
                    />

                    {percent > 0
                      ? 'Continue Watching'
                      : 'Play Now'}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      toggleMyList(movie)
                    }
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 text-[9px] font-black uppercase tracking-[0.16em] text-white/65 hover:bg-white/10 hover:text-white"
                  >
                    {isInMyList(
                      movie,
                    ) ? (
                      <Check
                        size={14}
                      />
                    ) : (
                      <ListPlus
                        size={14}
                      />
                    )}

                    {isInMyList(movie)
                      ? 'In My List'
                      : 'Add To My List'}
                  </button>
                </div>
              </div>
            </div>

            {relatedMovies.length >
              0 && (
              <section className="mt-20">
                <SectionTitle
                  eyebrow="Keep exploring"
                  title="More Like This"
                  subtitle={`More ${movie.category.toLowerCase()} stories from PMF-Flix.`}
                />

                <div className="no-scrollbar flex gap-3 overflow-x-auto pb-3 sm:gap-4">
                  {relatedMovies.map(
                    (item) => (
                      <MovieCard
                        key={getMovieId(
                          item,
                        )}
                        movie={item}
                      />
                    ),
                  )}
                </div>
              </section>
            )}

            <section className="mt-20 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.025] px-6 py-12 sm:px-10 lg:px-16">
              <div className="flex max-w-3xl items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  <Sparkles
                    size={18}
                    className="text-white/55"
                  />
                </div>

                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.25em] text-white/25">
                    PMF Intelligence
                  </p>

                  <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-white">
                    A story worth
                    staying for.
                  </h2>

                  <p className="mt-3 text-xs leading-6 text-white/30">
                    Keep discovering,
                    keep watching, and
                    build your own
                    entertainment journey
                    with PMF-Flix.
                  </p>
                </div>
              </div>
            </section>
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
      <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm">
        <div className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-[#090909] p-6 shadow-2xl sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.25em] text-white/25">
                PMF Account
              </p>

              <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">
                Your Profile
              </h2>
            </div>

            <button
              type="button"
              onClick={() =>
                setShowProfile(false)
              }
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/50 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-10 flex flex-col items-center">
            <div className="h-24 w-24 overflow-hidden rounded-full border border-white/10 bg-white/5">
              <img
                src={profile.avatar}
                alt="Profile"
                className="h-full w-full object-cover"
              />
            </div>

            <h3 className="mt-4 text-xl font-black text-white">
              {profile.name}
            </h3>

            <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/25">
              PMF Member
            </p>
          </div>

          <div className="mt-10">
            <label className="text-[8px] font-black uppercase tracking-[0.18em] text-white/30">
              Profile Name
            </label>

            <input
              value={profile.name}
              onChange={(event) =>
                setProfile(
                  (current) => ({
                    ...current,
                    name:
                      event.target.value,
                  }),
                )
              }
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/25"
              placeholder="Your name"
            />
          </div>

          <div className="mt-7">
            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/30">
              Choose Avatar
            </p>

            <div className="mt-3 grid grid-cols-4 gap-3">
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
                    className={`overflow-hidden rounded-2xl border p-1 ${
                      profile.avatar ===
                      avatar
                        ? 'border-white/60'
                        : 'border-white/10'
                    }`}
                  >
                    <img
                      src={avatar}
                      alt=""
                      className="aspect-square w-full rounded-xl bg-white/5"
                    />
                  </button>
                ),
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut()
              setShowProfile(false)
              setSession(null)
            }}
            className="mt-10 w-full rounded-xl border border-white/10 bg-white/5 px-5 py-3.5 text-[8px] font-black uppercase tracking-[0.18em] text-white/50 hover:bg-white/10 hover:text-white"
          >
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  const Player = () => {
    if (!watchingMovie) {
      return null
    }

    const movie =
      watchingMovie

    const videoUrl =
      getVideoUrl(movie)

    const youtube =
      isYouTube(movie)

    const embedUrl =
      youtube
        ? getYouTubeEmbed(movie)
        : ''

    const resetControlsTimer =
      () => {
        setShowPlayerControls(true)

        if (controlsTimer.current) {
          clearTimeout(
            controlsTimer.current,
          )
        }

        controlsTimer.current =
          setTimeout(() => {
            setShowPlayerControls(
              false,
            )
          }, 3000)
      }

    return (
      <div
        ref={playerRef}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
        onMouseMove={
          resetControlsTimer
        }
        onTouchStart={
          resetControlsTimer
        }
      >
        {youtube && embedUrl ? (
          <iframe
            src={embedUrl}
            title={movie.title}
            className="h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="h-full w-full object-contain"
            autoPlay
            playsInline
            onLoadedMetadata={
              (event) => {
                const duration =
                  event.currentTarget
                    .duration

                setPlayerDuration(
                  duration,
                )

                const saved =
                  getProgress(movie)

                if (
                  saved &&
                  saved.currentTime <
                    duration - 5
                ) {
                  event.currentTarget.currentTime =
                    saved.currentTime

                  setPlayerTime(
                    saved.currentTime,
                  )
                }
              }
            }
            onTimeUpdate={
              (event) => {
                const current =
                  event.currentTarget
                    .currentTime

                setPlayerTime(
                  current,
                )

                saveProgress(
                  movie,
                  current,
                  event
                    .currentTarget
                    .duration,
                )
              }
            }
            onPlay={() =>
              setPlayerPlaying(
                true,
              )
            }
            onPause={() =>
              setPlayerPlaying(
                false,
              )
            }
            onEnded={() => {
              setPlayerPlaying(
                false,
              )
              showMessage(
                'Movie completed',
              )
            }}
          />
        ) : (
          <div className="flex max-w-md flex-col items-center px-6 text-center">
            <Film
              size={44}
              className="text-white/15"
            />

            <h2 className="mt-5 text-2xl font-black text-white">
              Video unavailable
            </h2>

            <p className="mt-3 text-xs leading-6 text-white/30">
              This title does not
              have a playable video
              source yet.
            </p>
          </div>
        )}

        {showPlayerControls && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent px-5 pb-6 pt-20 sm:px-10">
            <div className="mx-auto max-w-6xl">
              {!youtube && (
                <input
                  type="range"
                  min="0"
                  max={
                    playerDuration || 0
                  }
                  step="0.1"
                  value={Math.min(
                    playerTime,
                    playerDuration ||
                      playerTime,
                  )}
                  onChange={(
                    event,
                  ) => {
                    const value =
                      Number(
                        event.target
                          .value,
                      )

                    setPlayerTime(
                      value,
                    )

                    if (
                      videoRef.current
                    ) {
                      videoRef.current.currentTime =
                        value
                    }
                  }}
                  className="mb-5 w-full accent-white"
                />
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={
                    playPause
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black"
                >
                  {playerPlaying ? (
                    <Pause
                      size={16}
                      fill="currentColor"
                    />
                  ) : (
                    <Play
                      size={16}
                      fill="currentColor"
                    />
                  )}
                </button>

                {!youtube && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        seek(-10)
                      }
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[8px] font-black text-white/60"
                    >
                      -10
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        seek(10)
                      }
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[8px] font-black text-white/60"
                    >
                      +10
                    </button>

                    <span className="text-[9px] font-bold text-white/35">
                      {formatTime(
                        playerTime,
                      )}{' '}
                      /{' '}
                      {formatTime(
                        playerDuration,
                      )}
                    </span>
                  </>
                )}

                <div className="ml-auto flex items-center gap-2">
                  {!youtube && (
                    <button
                      type="button"
                      onClick={() => {
                        setMuted(
                          (current) =>
                            !current,
                        )

                        if (
                          videoRef.current
                        ) {
                          videoRef.current.muted =
                            !muted
                        }
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60"
                    >
                      {muted ? (
                        <VolumeX
                          size={15}
                        />
                      ) : (
                        <Volume2
                          size={15}
                        />
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setShowPlayerSettings(
                        (value) =>
                          !value,
                      )
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60"
                  >
                    <Settings
                      size={15}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={
                      closePlayer
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {showPlayerSettings && (
                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-black/80 p-4 backdrop-blur-xl">
                  <span className="mr-2 text-[8px] font-black uppercase tracking-[0.16em] text-white/25">
                    Speed
                  </span>

                  {[0.75, 1, 1.25, 1.5, 2].map(
                    (value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          changeSpeed(
                            value,
                          )
                        }
                        className={`rounded-lg px-3 py-2 text-[8px] font-black ${
                          speed ===
                          value
                            ? 'bg-white text-black'
                            : 'bg-white/5 text-white/50'
                        }`}
                      >
                        {value}x
                      </button>
                    ),
                  )}

                  {!youtube && (
                    <>
                      <span className="ml-3 mr-1 text-[8px] font-black uppercase tracking-[0.16em] text-white/25">
                        Volume
                      </span>

                      {[0.25, 0.5, 0.75, 1].map(
                        (value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() =>
                              changeVolume(
                                value,
                              )
                            }
                            className={`rounded-lg px-3 py-2 text-[8px] font-black ${
                              volume ===
                              value
                                ? 'bg-white text-black'
                                : 'bg-white/5 text-white/50'
                            }`}
                          >
                            {Math.round(
                              value *
                                100,
                            )}
                            %
                          </button>
                        ),
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {playerMessage && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/85 px-5 py-3 text-[8px] font-black uppercase tracking-[0.15em] text-white/60 backdrop-blur-xl">
            {playerMessage}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-black/55 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1600px] items-center gap-6 px-5 sm:px-10 lg:px-16">
          <button
            type="button"
            onClick={() =>
              navigate('Home')
            }
            className="shrink-0 text-left"
          >
            <p className="text-lg font-black tracking-[-0.06em] text-white">
              PMF<span className="text-white/30">-FLIX</span>
            </p>

            <p className="hidden text-[6px] font-black uppercase tracking-[0.28em] text-white/20 sm:block">
              Prince Mufasa Flix
            </p>
          </button>

          <nav className="hidden items-center gap-6 md:flex">
            {(
              [
                'Home',
                'Movies',
                'TV Series',
                'My List',
              ] as Section[]
            ).map(
              (item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() =>
                    navigate(item)
                  }
                  className={`text-[8px] font-black uppercase tracking-[0.17em] transition ${
                    section === item
                      ? 'text-white'
                      : 'text-white/30 hover:text-white'
                  }`}
                >
                  {item}
                </button>
              ),
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center rounded-xl border border-white/10 bg-white/5 px-3 sm:flex">
              <Search
                size={14}
                className="text-white/25"
              />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search PMF..."
                className="w-36 bg-transparent px-2 py-2.5 text-[9px] text-white outline-none placeholder:text-white/20"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                setShowProfile(true)
              }
              className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5"
            >
              <img
                src={profile.avatar}
                alt="Profile"
                className="h-full w-full object-cover"
              />
            </button>

            <button
              type="button"
              onClick={() =>
                setMobileMenu(
                  (value) =>
                    !value,
                )
              }
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 md:hidden"
            >
              {mobileMenu ? (
                <X size={16} />
              ) : (
                <Menu size={16} />
              )}
            </button>
          </div>
        </div>

        {mobileMenu && (
          <div className="border-t border-white/[0.06] bg-black/95 px-5 py-4 md:hidden">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  'Home',
                  'Movies',
                  'TV Series',
                  'My List',
                ] as Section[]
              ).map(
                (item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() =>
                      navigate(item)
                    }
                    className={`rounded-xl border px-4 py-3 text-left text-[8px] font-black uppercase tracking-[0.15em] ${
                      section === item
                        ? 'border-white/20 bg-white text-black'
                        : 'border-white/10 bg-white/5 text-white/50'
                    }`}
                  >
                    {item}
                  </button>
                ),
              )}
            </div>

            <div className="mt-3 flex items-center rounded-xl border border-white/10 bg-white/5 px-3">
              <Search
                size={14}
                className="text-white/25"
              />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search PMF..."
                className="w-full bg-transparent px-2 py-3 text-[9px] text-white outline-none placeholder:text-white/20"
              />
            </div>
          </div>
        )}
      </header>

      {loading && (
        <div className="fixed left-1/2 top-24 z-[55] -translate-x-1/2 rounded-full border border-white/10 bg-black/80 px-4 py-2 text-[8px] font-black uppercase tracking-[0.16em] text-white/35 backdrop-blur-xl">
          <span className="inline-flex items-center gap-2">
            <LoaderCircle
              size={12}
              className="animate-spin"
            />
            Loading catalogue
          </span>
        </div>
      )}

      {error && (
        <div className="fixed left-1/2 top-24 z-[55] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-2xl border border-white/10 bg-black/90 px-5 py-4 text-center text-[9px] font-black uppercase tracking-[0.12em] text-white/50 backdrop-blur-xl">
          {error}
        </div>
      )}

      {section === 'Home' && (
        <HomePage />
      )}

      {section === 'Movies' && (
        <CatalogPage
          type="Movie"
        />
      )}

      {section === 'TV Series' && (
        <CatalogPage
          type="Series"
        />
      )}

      {section === 'My List' && (
        <MyListPage />
      )}

      {search.trim() &&
        section !== 'Movies' &&
        section !== 'TV Series' && (
          <div className="fixed inset-x-0 top-20 z-40 mx-auto max-w-2xl px-5 pt-3">
            <div className="rounded-2xl border border-white/10 bg-black/95 p-4 shadow-2xl backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/25">
                  Search Results
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setSearch('')
                  }
                  className="text-white/30 hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>

              {filteredMovies
                .slice(0, 6)
                .map((movie) => (
                  <button
                    key={getMovieId(
                      movie,
                    )}
                    type="button"
                    onClick={() =>
                      openMovie(
                        movie,
                      )
                    }
                    className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-white/5"
                  >
                    <img
                      src={
                        movie.poster
                      }
                      alt=""
                      className="h-14 w-10 rounded-lg object-cover"
                    />

                    <div>
                      <p className="text-xs font-black text-white">
                        {movie.title}
                      </p>

                      <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.12em] text-white/25">
                        {movie.year} •{' '}
                        {
                          movie.category
                        }
                      </p>
                    </div>
                  </button>
                ))}

              {!filteredMovies
                .length && (
                <p className="py-8 text-center text-[9px] font-black uppercase tracking-[0.16em] text-white/25">
                  No stories found
                </p>
              )}
            </div>
          </div>
        )}

      {playerMessage &&
        !watchingMovie &&
        !showProfile && (
          <div className="fixed bottom-5 left-1/2 z-[75] -translate-x-1/2 rounded-full border border-white/10 bg-black/85 px-5 py-3 text-[8px] font-black uppercase tracking-[0.14em] text-white/65 shadow-2xl backdrop-blur-xl">
            {playerMessage}
          </div>
        )}

      <footer className="border-t border-white/[0.06] bg-[#050505] px-5 py-10 sm:px-10 lg:px-16">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black tracking-[-0.04em] text-white">
              PMF-FLIX
            </p>

            <p className="mt-1 text-[7px] font-black uppercase tracking-[0.2em] text-white/20">
              Prince Mufasa Flix
            </p>
          </div>

          <p className="text-[8px] font-black uppercase tracking-[0.14em] text-white/20">
            Your World. Your
            Stories. Your Flix.
          </p>
        </div>
      </footer>

      <MovieDetails />
      <ProfilePanel />
      <Player />
    </div>
  )
}
