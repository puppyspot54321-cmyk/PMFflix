import heroImage from './assets/hero.png'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import type { Movie } from './movieData/movies'
import { getMovies } from './services/movieService'
import { mapCanonicalMovieToLegacy } from './utils/movieMapper'
import { supabase } from './supabase'
import type { Session } from '@supabase/supabase-js'
import AuthScreen from './Auth'
import {
  Check,
  ChevronDown,
  Film,
  Heart,
  ListPlus,
  LoaderCircle,
  Maximize,
  Menu,
  Pause,
  Play,
  RotateCcw,
  Search,
  Settings,
  SkipForward,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'

type Section =
  | 'home'
  | 'movies'
  | 'series'
  | 'my-list'

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

function readStorage<T>(
  key: string,
  fallback: T,
): T {
  try {
    const value = localStorage.getItem(key)

    if (!value) return fallback

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
    // Storage may be unavailable.
  }
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

function getVideoUrl(
  movie: Movie,
): string {
  return movie.videoUrl || ''
}

function isYouTube(
  url: string,
): boolean {
  return /youtube\.com|youtu\.be/i.test(
    url,
  )
}

function getYouTubeEmbed(
  url: string,
): string {
  try {
    const parsed = new URL(url)

    if (
      parsed.hostname.includes('youtu.be')
    ) {
      const id =
        parsed.pathname.replace(
          '/',
          '',
        )

      return id
        ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`
        : ''
    }

    const id =
      parsed.searchParams.get('v')

    if (id) {
      return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`
    }

    if (
      parsed.pathname.startsWith(
        '/embed/',
      )
    ) {
      return `${url}${
        url.includes('?')
          ? '&'
          : '?'
      }autoplay=1&rel=0`
    }
  } catch {
    return ''
  }

  return ''
}

function formatTime(
  seconds: number,
): string {
  if (
    !Number.isFinite(seconds) ||
    seconds < 0
  ) {
    return '0:00'
  }

  const total = Math.floor(seconds)
  const minutes = Math.floor(
    total / 60,
  )
  const remaining = total % 60

  return `${minutes}:${String(
    remaining,
  ).padStart(2, '0')}`
}

function AppShell({
  session,
}: {
  session: Session
}) {
  const [section, setSection] =
    useState<Section>('home')

  const [search, setSearch] =
    useState('')

  const [movies, setMovies] =
    useState<Movie[]>([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState<string | null>(null)

  const [selectedMovie, setSelectedMovie] =
    useState<Movie | null>(null)

  const [watchingMovie, setWatchingMovie] =
    useState<Movie | null>(null)

  const [profile, setProfile] =
    useState<Profile>(() =>
      readStorage(
        PROFILE_KEY,
        DEFAULT_PROFILE,
      ),
    )

  const [myList, setMyList] =
    useState<string[]>(() =>
      readStorage(
        MY_LIST_KEY,
        [],
      ),
    )

  const [continueWatching, setContinueWatching] =
    useState<string[]>(() =>
      readStorage(
        CONTINUE_KEY,
        [],
      ),
    )

  const [history, setHistory] =
    useState<HistoryItem[]>(() =>
      readStorage(
        HISTORY_KEY,
        [],
      ),
    )

  const [progress, setProgress] =
    useState<Record<
      string,
      Progress
    >>(() =>
      readStorage(
        PROGRESS_KEY,
        {},
      ),
    )

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

  const [theaterMode, setTheaterMode] =
    useState(false)

  const videoRef =
    useRef<HTMLVideoElement | null>(
      null,
    )

  const playerRef =
    useRef<HTMLDivElement | null>(
      null,
    )

  const controlsTimer =
    useRef<number | null>(null)

  const messageTimer =
    useRef<number | null>(null)

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

    const load = async () => {
      try {
        setLoading(true)
        setError(null)

        const result =
          await getMovies()

        if (!active) return

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
            'Unable to load the PMF catalogue.',
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()

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
            void load()
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
            (item) => item !== id,
          )
        : [id, ...current],
    )
  }

  const addToHistory = (
    movie: Movie,
  ) => {
    const id =
      getMovieId(movie)

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

  const addToContinue = (
    movie: Movie,
  ) => {
    const id =
      getMovieId(movie)

    setContinueWatching(
      (current) => [
        id,
        ...current.filter(
          (item) => item !== id,
        ),
      ],
    )
  }

  const getProgress = (
    movie: Movie,
  ): Progress =>
    progress[getMovieId(movie)] || {
      currentTime: 0,
      duration: 0,
      updatedAt: 0,
    }

  const openMovie = (
    movie: Movie,
  ) => {
    setSelectedMovie(movie)
  }

  const startWatching = (
    movie: Movie,
  ) => {
    const saved =
      getProgress(movie)

    setSelectedMovie(null)
    setWatchingMovie(movie)
    setPlayerTime(
      saved.currentTime,
    )
    setPlayerDuration(
      saved.duration,
    )

    addToHistory(movie)
    addToContinue(movie)
  }

  const saveProgress = (
    movie: Movie,
    currentTime: number,
    duration: number,
  ) => {
    if (
      currentTime <= 0 ||
      duration <= 0
    ) {
      return
    }

    setProgress((current) => ({
      ...current,
      [getMovieId(movie)]: {
        currentTime,
        duration,
        updatedAt: Date.now(),
      },
    }))
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
    setShowPlayerSettings(false)
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

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  const goHome = () => {
    navigate('home')
  }

  const showMessage = (
    message: string,
  ) => {
    setPlayerMessage(message)

    if (messageTimer.current) {
      window.clearTimeout(
        messageTimer.current,
      )
    }

    messageTimer.current =
      window.setTimeout(() => {
        setPlayerMessage('')
      }, 1600)
  }

  const playPause = async () => {
    if (!videoRef.current) {
      showMessage(
        'Playback source not connected',
      )
      return
    }

    try {
      if (
        videoRef.current.paused
      ) {
        await videoRef.current.play()
      } else {
        videoRef.current.pause()
      }
    } catch (playError) {
      console.error(
        'PMF player error:',
        playError,
      )
    }
  }

  const seek = (
    amount: number,
  ) => {
    if (!videoRef.current) return

    const next = Math.max(
      0,
      Math.min(
        playerDuration || 0,
        amount,
      ),
    )

    videoRef.current.currentTime =
      next

    setPlayerTime(next)
  }

  const rewind = () => {
    seek(playerTime - 10)
    showMessage('−10 seconds')
  }

  const forward = () => {
    seek(playerTime + 10)
    showMessage('+10 seconds')
  }

  const toggleMute = () => {
    const next = !muted

    setMuted(next)

    if (videoRef.current) {
      videoRef.current.muted =
        next
    }
  }

  const changeVolume = (
    value: number,
  ) => {
    const next = Math.max(
      0,
      Math.min(1, value),
    )

    setVolume(next)
    setMuted(next === 0)

    if (videoRef.current) {
      videoRef.current.volume =
        next
      videoRef.current.muted =
        next === 0
    }
  }

  const changeSpeed = (
    value: number,
  ) => {
    setSpeed(value)

    if (videoRef.current) {
      videoRef.current.playbackRate =
        value
    }

    showMessage(
      `${value}× playback`,
    )
  }

  const fullscreen = async () => {
    try {
      if (
        !document.fullscreenElement
      ) {
        await playerRef.current?.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch {
      showMessage(
        'Fullscreen unavailable',
      )
    }
  }

  const resetPlayerControls = () => {
    setShowPlayerControls(true)

    if (controlsTimer.current) {
      window.clearTimeout(
        controlsTimer.current,
      )
    }

    controlsTimer.current =
      window.setTimeout(() => {
        if (playerPlaying) {
          setShowPlayerControls(
            false,
          )
        }
      }, 3500)
  }

  useEffect(() => {
    if (!watchingMovie) return

    const handleKey = (
      event: KeyboardEvent,
    ) => {
      if (
        event.target instanceof
          HTMLInputElement ||
        event.target instanceof
          HTMLTextAreaElement
      ) {
        return
      }

      if (event.key === ' ') {
        event.preventDefault()
        void playPause()
      }

      if (
        event.key === 'ArrowLeft'
      ) {
        rewind()
      }

      if (
        event.key === 'ArrowRight'
      ) {
        forward()
      }

      if (
        event.key.toLowerCase() ===
        'm'
      ) {
        toggleMute()
      }

      if (
        event.key.toLowerCase() ===
        'f'
      ) {
        void fullscreen()
      }

      if (event.key === 'Escape') {
        closePlayer()
      }

      resetPlayerControls()
    }

    window.addEventListener(
      'keydown',
      handleKey,
    )

    return () =>
      window.removeEventListener(
        'keydown',
        handleKey,
      )
  }, [
    watchingMovie,
    playerTime,
    playerDuration,
    muted,
    playerPlaying,
  ])

  const categories = useMemo(() => {
    const values = movies
      .map((movie) =>
        String(movie.category || '').trim(),
      )
      .filter(Boolean)

    return [
      'All',
      ...Array.from(new Set(values)),
    ]
  }, [movies])

  const years = useMemo(() => {
    const values = movies
      .map((movie) =>
        Number(movie.year),
      )
      .filter((year) =>
        Number.isFinite(year),
      )

    return [
      'All',
      ...Array.from(
        new Set(values),
      )
        .sort((a, b) => b - a)
        .map(String),
    ]
  }, [movies])

  const filteredMovies = useMemo(() => {
    const query =
      search.trim().toLowerCase()

    let result = [...movies]

    if (section === 'series') {
      result = result.filter(
        (movie) =>
          String(
            movie.type || '',
          ).toLowerCase() ===
          'series',
      )
    }

    if (section === 'movies') {
      result = result.filter(
        (movie) =>
          String(
            movie.type || '',
          ).toLowerCase() !==
          'series',
      )
    }

    if (filters.category !== 'All') {
      result = result.filter(
        (movie) =>
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
      Number.isFinite(
        minimumRating,
      ) &&
      minimumRating > 0
    ) {
      result = result.filter(
        (movie) =>
          getRating(movie) >=
          minimumRating,
      )
    }

    if (query) {
      result = result.filter(
        (movie) => {
          const searchable =
            [
              movie.title,
              movie.description,
              movie.category,
              movie.genre,
              movie.type,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()

          return searchable.includes(
            query,
          )
        },
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
            String(
              a.title || '',
            ).localeCompare(
              String(
                b.title || '',
              ),
            ),
        )
        break

      default:
        break
    }

    return result
  }, [
    movies,
    search,
    section,
    filters,
  ])

  const myListMovies = useMemo(
    () =>
      myList
        .map(findMovie)
        .filter(
          (
            movie,
          ): movie is Movie =>
            Boolean(movie),
        ),
    [myList, movies],
  )

  const continueMovies = useMemo(
    () =>
      continueWatching
        .map(findMovie)
        .filter(
          (
            movie,
          ): movie is Movie =>
            Boolean(movie),
        ),
    [
      continueWatching,
      movies,
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
          findMovie(
            item.movieId,
          ),
        )
        .filter(
          (
            movie,
          ): movie is Movie =>
            Boolean(movie),
        ),
    [history, movies],
  )

  const trendingMovies = useMemo(
    () =>
      [...movies]
        .sort(
          (a, b) =>
            getRating(b) -
            getRating(a),
        )
        .slice(0, 10),
    [movies],
  )

  const latestMovies = useMemo(
    () =>
      [...movies]
        .sort(
          (a, b) =>
            Number(b.year || 0) -
            Number(a.year || 0),
        )
        .slice(0, 10),
    [movies],
  )

  const actionMovies = useMemo(
    () =>
      movies
        .filter((movie) =>
          String(
            movie.category ||
              movie.genre ||
              '',
          )
            .toLowerCase()
            .includes('action'),
        )
        .slice(0, 10),
    [movies],
  )

  const adventureMovies = useMemo(
    () =>
      movies
        .filter((movie) =>
          String(
            movie.category ||
              movie.genre ||
              '',
          )
            .toLowerCase()
            .includes(
              'adventure',
            ),
        )
        .slice(0, 10),
    [movies],
  )

  const personalizedMovies =
    useMemo(() => {
      const preferred =
        new Set(
          historyMovies
            .map(
              (movie) =>
                String(
                  movie.category ||
                    movie.genre ||
                    '',
                ),
            )
            .filter(Boolean),
        )

      if (
        preferred.size === 0
      ) {
        return trendingMovies.slice(
          0,
          8,
        )
      }

      const result =
        movies.filter(
          (movie) =>
            preferred.has(
              String(
                movie.category ||
                  movie.genre ||
                  '',
              ),
            ),
        )

      return (
        result.length
          ? result
          : trendingMovies
      ).slice(0, 10)
    }, [
      movies,
      historyMovies,
      trendingMovies,
    ])

  const clearSearch = () => {
    setSearch('')
  }

  const updateFilter = (
    key: keyof Filters,
    value: string,
  ) => {
    setFilters(
      (current) => ({
        ...current,
        [key]:
          key === 'sort'
            ? (value as SortMode)
            : value,
      }),
    )
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

  const saveProfile = () => {
    setProfile(
      (current) => ({
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

  const playNext = () => {
    const next =
      getNextMovie()

    if (!next) return

    setPlayerTime(
      getProgress(next)
        .currentTime,
    )

    setPlayerDuration(
      getProgress(next)
        .duration,
    )

    setWatchingMovie(next)
    setPlayerPlaying(false)

    addToHistory(next)
    addToContinue(next)

    setShowPlayerSettings(false)
  }

  const updatePlayerTime = (
    value: number,
  ) => {
    setPlayerTime(value)

    if (
      watchingMovie &&
      playerDuration > 0
    ) {
      saveProgress(
        watchingMovie,
        value,
        playerDuration,
      )
    }
  }

  const updatePlayerDuration = (
    value: number,
  ) => {
    if (
      Number.isFinite(value) &&
      value > 0
    ) {
      setPlayerDuration(value)
    }
  }

  const handleVideoEnded = () => {
    if (watchingMovie) {
      saveProgress(
        watchingMovie,
        playerDuration,
        playerDuration,
      )
    }

    setPlayerPlaying(false)

    if (getNextMovie()) {
      showMessage(
        'Next story ready',
      )
    }
  }

  const handleVideoLoaded = () => {
    const video =
      videoRef.current

    if (!video) return

    const saved =
      watchingMovie
        ? getProgress(
            watchingMovie,
          )
        : null

    const actualDuration =
      Number.isFinite(
        video.duration,
      )
        ? video.duration
        : 0

    if (actualDuration > 0) {
      setPlayerDuration(
        actualDuration,
      )

      if (
        saved &&
        saved.currentTime >
          0 &&
        saved.currentTime <
          actualDuration - 3
      ) {
        video.currentTime =
          saved.currentTime

        setPlayerTime(
          saved.currentTime,
        )
      }
    }

    video.volume = volume
    video.muted = muted
    video.playbackRate = speed
  }

  const renderStars = (
    movie: Movie,
  ) => {
    const rating =
      getRating(movie)

    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-black text-white/70">
        <Star
          size={11}
          fill="currentColor"
        />
        {rating
          ? rating.toFixed(1)
          : '—'}
      </span>
    )
  }

  const movieProgress = (
    movie: Movie,
  ) => {
    const item =
      getProgress(movie)

    if (
      !item.duration ||
      item.duration <= 0
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
  }: {
    movie: Movie
  }) => {
    const savedProgress =
      movieProgress(movie)

    const listed =
      isInMyList(movie)

    return (
      <article className="group relative min-w-0">
        <button
          type="button"
          onClick={() =>
            openMovie(movie)
          }
          className="block w-full text-left"
        >
          <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] shadow-xl transition duration-500 group-hover:-translate-y-1 group-hover:border-white/20 group-hover:shadow-2xl">
            <img
              src={movie.poster}
              alt={movie.title}
              loading="lazy"
              className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
              onError={(event) => {
                event.currentTarget.style.display =
                  'none'
              }}
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/10 opacity-80" />

            <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full border border-white/10 bg-black/60 px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-white backdrop-blur">
              <Film size={9} />
              {movie.type ||
                'Film'}
            </div>

            <div className="absolute inset-x-3 bottom-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[9px] font-bold text-white/60">
                  {movie.year}
                </span>

                {renderStars(movie)}
              </div>

              <h3 className="line-clamp-2 text-sm font-black text-white">
                {movie.title}
              </h3>
            </div>

            {savedProgress > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                <div
                  className="h-full bg-red-600"
                  style={{
                    width: `${savedProgress}%`,
                  }}
                />
              </div>
            )}

            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition duration-300 group-hover:opacity-100">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black shadow-2xl">
                <Play
                  size={18}
                  fill="currentColor"
                />
              </span>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            toggleMyList(movie)
          }
          aria-label={
            listed
              ? 'Remove from My List'
              : 'Add to My List'
          }
          className={`absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur transition ${
            listed
              ? 'border-red-500/40 bg-red-600 text-white'
              : 'border-white/10 bg-black/60 text-white/60 hover:bg-white/15 hover:text-white'
          }`}
        >
          {listed ? (
            <Check size={13} />
          ) : (
            <ListPlus size={13} />
          )}
        </button>
      </article>
    )
  }

  const MovieGrid = ({
    items,
  }: {
    items: Movie[]
  }) => {
    if (!items.length) {
      return (
        <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.025] px-6 py-20 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5">
            <Search
              size={22}
              className="text-white/30"
            />
          </div>

          <h3 className="mt-5 text-xl font-black text-white">
            Nothing found
          </h3>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/30">
            PMF could not find a title matching your current search and filters.
          </p>

          <button
            type="button"
            onClick={() => {
              clearSearch()
              resetFilters()
            }}
            className="mt-6 rounded-xl bg-white px-5 py-3 text-[9px] font-black uppercase tracking-[0.16em] text-black"
          >
            Reset Discovery
          </button>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {items.map(
          (movie) => (
            <MovieCard
              key={getMovieId(movie)}
              movie={movie}
            />
          ),
        )}
      </div>
    )
   }

  const SectionTitle = ({
    title,
    subtitle,
    action,
  }: {
    title: string
    subtitle?: string
    action?: ReactNode
  }) => (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">
          {title}
        </h2>

        {subtitle && (
          <p className="mt-1 text-xs text-white/30">
            {subtitle}
          </p>
        )}
      </div>

      {action}
    </div>
  )

  const MovieRow = ({
    title,
    subtitle,
    items,
  }: {
    title: string
    subtitle?: string
    items: Movie[]
  }) => {
    if (!items.length) return null

    return (
      <section className="mt-12">
        <SectionTitle
          title={title}
          subtitle={subtitle}
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((movie) => (
            <MovieCard
              key={getMovieId(movie)}
              movie={movie}
            />
          ))}
        </div>
      </section>
    )
  }

  const FilterPanel = () => {
    if (!showFilters) return null

    return (
      <div className="mb-8 rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end">
          <label className="flex-1">
            <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.16em] text-white/35">
              Category
            </span>

            <select
              value={filters.category}
              onChange={(event) =>
                updateFilter(
                  'category',
                  event.target.value,
                )
              }
              className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none"
            >
              {categories.map(
                (category) => (
                  <option
                    key={category}
                    value={category}
                    className="bg-black"
                  >
                    {category}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="flex-1">
            <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.16em] text-white/35">
              Type
            </span>

            <select
              value={filters.type}
              onChange={(event) =>
                updateFilter(
                  'type',
                  event.target.value,
                )
              }
              className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none"
            >
              <option
                value="All"
                className="bg-black"
              >
                All Types
              </option>
              <option
                value="movie"
                className="bg-black"
              >
                Movies
              </option>
              <option
                value="series"
                className="bg-black"
              >
                Series
              </option>
            </select>
          </label>

          <label className="flex-1">
            <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.16em] text-white/35">
              Year
            </span>

            <select
              value={filters.year}
              onChange={(event) =>
                updateFilter(
                  'year',
                  event.target.value,
                )
              }
              className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none"
            >
              {years.map((year) => (
                <option
                  key={year}
                  value={year}
                  className="bg-black"
                >
                  {year === 'All'
                    ? 'All Years'
                    : year}
                </option>
              ))}
            </select>
          </label>

          <label className="flex-1">
            <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.16em] text-white/35">
              Minimum Rating
            </span>

            <select
              value={filters.rating}
              onChange={(event) =>
                updateFilter(
                  'rating',
                  event.target.value,
                )
              }
              className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none"
            >
              <option
                value="0"
                className="bg-black"
              >
                Any Rating
              </option>
              <option
                value="5"
                className="bg-black"
              >
                5+
              </option>
              <option
                value="6"
                className="bg-black"
              >
                6+
              </option>
              <option
                value="7"
                className="bg-black"
              >
                7+
              </option>
              <option
                value="8"
                className="bg-black"
              >
                8+
              </option>
              <option
                value="9"
                className="bg-black"
              >
                9+
              </option>
            </select>
          </label>

          <label className="flex-1">
            <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.16em] text-white/35">
              Sort
            </span>

            <select
              value={filters.sort}
              onChange={(event) =>
                updateFilter(
                  'sort',
                  event.target.value,
                )
              }
              className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none"
            >
              <option
                value="featured"
                className="bg-black"
              >
                Featured
              </option>
              <option
                value="newest"
                className="bg-black"
              >
                Newest
              </option>
              <option
                value="oldest"
                className="bg-black"
              >
                Oldest
              </option>
              <option
                value="rating"
                className="bg-black"
              >
                Highest Rated
              </option>
              <option
                value="title"
                className="bg-black"
              >
                A–Z
              </option>
            </select>
          </label>

          <button
            type="button"
            onClick={resetFilters}
            className="rounded-xl border border-white/10 px-5 py-3 text-[9px] font-black uppercase tracking-[0.15em] text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            Reset
          </button>
        </div>
      </div>
    )
  }

  const Header = () => (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/[0.06] bg-black/65 backdrop-blur-2xl">
      <div className="mx-auto flex h-[72px] max-w-[1600px] items-center gap-5 px-4 sm:px-7 lg:px-10">
        <button
          type="button"
          onClick={goHome}
          className="group flex shrink-0 items-center gap-2"
          aria-label="PMF-Flix Home"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black shadow-lg transition group-hover:scale-105">
            <Film
              size={18}
              strokeWidth={2.5}
            />
          </div>

          <div className="hidden sm:block">
            <div className="text-sm font-black tracking-[-0.04em] text-white">
              PMF<span className="text-white/40">-FLIX</span>
            </div>

            <div className="text-[7px] font-bold uppercase tracking-[0.28em] text-white/25">
              Your World. Your Stories.
            </div>
          </div>
        </button>

        <nav className="hidden items-center gap-1 lg:flex">
          {[
            ['home', 'Home'],
            ['movies', 'Movies'],
            ['series', 'TV Series'],
            ['my-list', 'My List'],
          ].map(
            ([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  navigate(
                    value as Section,
                  )
                }
                className={`rounded-xl px-4 py-2 text-[9px] font-black uppercase tracking-[0.15em] transition ${
                  section === value
                    ? 'bg-white text-black'
                    : 'text-white/45 hover:bg-white/5 hover:text-white'
                }`}
              >
                {label}
              </button>
            ),
          )}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          <div className="relative hidden min-w-0 sm:block">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/25"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search PMF-Flix..."
              className="h-10 w-[180px] rounded-xl border border-white/10 bg-white/[0.045] pl-9 pr-8 text-xs text-white outline-none transition placeholder:text-white/20 focus:border-white/25 focus:bg-white/[0.07] md:w-[240px]"
            />

            {search && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center text-white/30 hover:text-white"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              setShowProfile(true)
            }
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.045] text-lg transition hover:border-white/20 hover:bg-white/10"
            aria-label="Profile"
          >
            {profile.avatar}
          </button>

          <button
            type="button"
            onClick={() =>
              setMobileMenu(
                (current) =>
                  !current,
              )
            }
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.045] text-white/60 lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
        </div>
      </div>

      {mobileMenu && (
        <div className="border-t border-white/[0.06] bg-black/95 px-4 py-4 lg:hidden">
          <div className="mb-4 flex items-center gap-2">
            <Search
              size={15}
              className="text-white/25"
            />

            <input
              autoFocus
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search movies, series..."
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/25"
            />
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              ['home', 'Home'],
              ['movies', 'Movies'],
              ['series', 'Series'],
              ['my-list', 'My List'],
            ].map(
              ([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    navigate(
                      value as Section,
                    )
                  }
                  className={`rounded-xl px-2 py-3 text-[8px] font-black uppercase tracking-[0.08em] ${
                    section === value
                      ? 'bg-white text-black'
                      : 'bg-white/5 text-white/50'
                  }`}
                >
                  {label}
                </button>
              ),
            )}
          </div>
        </div>
      )}
    </header>
  )

  const Hero = () => {
    const featured =
      trendingMovies[0] ||
      movies[0]

    if (!featured) {
      return (
        <section className="relative flex min-h-[620px] items-center overflow-hidden border-b border-white/[0.05]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_35%,rgba(255,255,255,.09),transparent_38%),linear-gradient(180deg,#090909,#000)]" />

          <div className="relative mx-auto w-full max-w-[1600px] px-5 pt-28 sm:px-10 lg:px-16">
            <div className="max-w-2xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[8px] font-black uppercase tracking-[0.2em] text-white/45">
                <Sparkles size={11} />
                PMF-Flix
              </div>

              <h1 className="text-5xl font-black tracking-[-0.06em] text-white sm:text-7xl">
                Your world.
                <br />
                Your stories.
              </h1>

              <p className="mt-6 max-w-xl text-sm leading-7 text-white/40 sm:text-base">
                A cinematic home for stories worth watching.
              </p>
            </div>
          </div>
        </section>
      )
    }

    return (
      <section className="relative min-h-[620px] overflow-hidden border-b border-white/[0.05]">
        <img
          src={
            featured.backdrop ||
            featured.poster ||
            heroImage
          }
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-70"
        />

        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-black/30" />

        <div className="relative mx-auto flex min-h-[620px] max-w-[1600px] items-end px-5 pb-16 pt-32 sm:px-10 lg:px-16">
          <div className="max-w-2xl">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-[8px] font-black uppercase tracking-[0.18em] text-white backdrop-blur">
                <Sparkles size={10} />
                Featured Film
              </span>

              {featured.category && (
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-2 text-[8px] font-black uppercase tracking-[0.15em] text-white/50 backdrop-blur">
                  {featured.category}
                </span>
              )}
            </div>

            <h1 className="max-w-3xl text-5xl font-black tracking-[-0.065em] text-white sm:text-6xl lg:text-8xl">
              {featured.title}
            </h1>

            <div className="mt-5 flex flex-wrap items-center gap-4 text-[10px] font-bold text-white/55">
              <span>{featured.year}</span>

              {featured.type && (
                <span className="uppercase tracking-[0.14em]">
                  {featured.type}
                </span>
              )}

              <span className="inline-flex items-center gap-1 text-white">
                <Star
                  size={11}
                  fill="currentColor"
                />
                {getRating(
                  featured,
                ).toFixed(1)}
              </span>
            </div>

            <p className="mt-5 max-w-xl text-sm leading-7 text-white/55 sm:text-base">
              {featured.description ||
                'Discover a new story on PMF-Flix.'}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  startWatching(
                    featured,
                  )
                }
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-[9px] font-black uppercase tracking-[0.16em] text-black shadow-2xl transition hover:scale-[1.02]"
              >
                <Play
                  size={14}
                  fill="currentColor"
                />
                Watch Now
              </button>

              <button
                type="button"
                onClick={() =>
                  openMovie(
                    featured,
                  )
                }
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-black/30 px-6 py-3.5 text-[9px] font-black uppercase tracking-[0.16em] text-white backdrop-blur transition hover:bg-white/10"
              >
                More Info
                <ChevronDown size={13} />
              </button>

              <button
                type="button"
                onClick={() =>
                  toggleMyList(
                    featured,
                  )
                }
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3.5 text-[9px] font-black uppercase tracking-[0.16em] text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                {isInMyList(
                  featured,
                ) ? (
                  <>
                    <Check size={13} />
                    In My List
                  </>
                ) : (
                  <>
                    <ListPlus
                      size={13}
                    />
                    My List
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>
    )
  }

  const DiscoveryToolbar = () => (
    <div className="mb-8 flex flex-col gap-4 border-b border-white/[0.06] pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/25">
          {section === 'home'
            ? 'Explore'
            : section === 'my-list'
              ? 'Your Collection'
              : section === 'series'
                ? 'Series'
                : 'Movies'}
        </p>

        <h2 className="mt-1 text-2xl font-black text-white">
          {search
            ? `Results for "${search}"`
            : section ===
                'my-list'
              ? 'My List'
              : section ===
                  'series'
                ? 'TV Series'
                : section ===
                    'movies'
                  ? 'All Movies'
                  : 'Discover'}
        </h2>
      </div>

      <button
        type="button"
        onClick={() =>
          setShowFilters(
            (current) =>
              !current,
          )
        }
        className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-[9px] font-black uppercase tracking-[0.15em] transition ${
          showFilters
            ? 'border-white/20 bg-white text-black'
            : 'border-white/10 bg-white/5 text-white/55 hover:bg-white/10 hover:text-white'
        }`}
      >
        <Settings size={13} />
        Filters
        <ChevronDown
          size={12}
          className={
            showFilters
              ? 'rotate-180'
              : ''
          }
        />
      </button>
    </div>
  )

  const HomeContent = () => (
    <>
      <Hero />

      <main className="mx-auto max-w-[1600px] px-5 pb-24 sm:px-10 lg:px-16">
        {continueMovies.length > 0 && (
          <MovieRow
            title="Continue Watching"
            subtitle="Pick up where your story paused."
            items={continueMovies}
          />
        )}

        <MovieRow
          title="Trending Now"
          subtitle="The titles creating the most excitement on PMF-Flix."
          items={trendingMovies}
        />

        <MovieRow
          title="Made For You"
          subtitle="Recommendations shaped by your viewing journey."
          items={personalizedMovies}
        />

        <MovieRow
          title="New & Noteworthy"
          subtitle="Fresh stories waiting to be discovered."
          items={latestMovies}
        />

        {actionMovies.length > 0 && (
          <MovieRow
            title="Action"
            subtitle="High-energy stories with no brakes."
            items={actionMovies}
          />
        )}

        {adventureMovies.length > 0 && (
          <MovieRow
            title="Adventure"
            subtitle="Go beyond the familiar."
            items={adventureMovies}
          />
        )}

        {historyMovies.length > 0 && (
          <MovieRow
            title="Recently Watched"
            subtitle="Your latest PMF-Flix activity."
            items={historyMovies.slice(
              0,
              6,
            )}
          />
        )}
      </main>
    </>
  )

  const LibraryContent = () => (
    <main className="mx-auto max-w-[1600px] px-5 pb-24 pt-32 sm:px-10 lg:px-16">
      <DiscoveryToolbar />
      <FilterPanel />

      {loading ? (
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-white/30">
            <LoaderCircle
              size={28}
              className="animate-spin"
            />
            <span className="text-[9px] font-black uppercase tracking-[0.2em]">
              Curating your experience
            </span>
          </div>
        </div>
      ) : (
        <MovieGrid
          items={filteredMovies}
        />
      )}
    </main>
  )

  const MyListContent = () => (
    <main className="mx-auto max-w-[1600px] px-5 pb-24 pt-32 sm:px-10 lg:px-16">
      <DiscoveryToolbar />

      {myListMovies.length ? (
        <MovieGrid
          items={myListMovies}
        />
      ) : (
        <div className="rounded-3xl border border-white/10 bg-white/[0.025] px-6 py-24 text-center">
          <Heart
            size={30}
            className="mx-auto text-white/20"
          />

          <h2 className="mt-5 text-2xl font-black text-white">
            Your list is waiting
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/30">
            Save movies and series you want to watch later. They will appear here instantly.
          </p>

          <button
            type="button"
            onClick={() =>
              navigate('movies')
            }
            className="mt-7 rounded-xl bg-white px-6 py-3 text-[9px] font-black uppercase tracking-[0.16em] text-black"
          >
            Explore PMF-Flix
          </button>
        </div>
      )}
    </main>
  )

  const ProfileModal = () => {
    if (!showProfile) return null

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
        <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b0b] shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/30">
                PMF-Flix
              </p>

              <h2 className="mt-1 text-lg font-black text-white">
                Your Profile
              </h2>
            </div>

            <button
              type="button"
              onClick={() =>
                setShowProfile(false)
              }
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-6">
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-3xl">
                {profile.avatar}
              </div>

              <div>
                <p className="text-sm font-black text-white">
                  {profile.name}
                </p>

                <p className="mt-1 text-xs text-white/30">
                  Your personal PMF-Flix space
                </p>
              </div>
            </div>

            <label className="block">
              <span className="mb-2 block text-[8px] font-black uppercase tracking-[0.18em] text-white/30">
                Display Name
              </span>

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
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-white/25"
              />
            </label>

            <div className="mt-5">
              <span className="mb-3 block text-[8px] font-black uppercase tracking-[0.18em] text-white/30">
                Choose Avatar
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
                      className={`flex h-12 items-center justify-center rounded-xl border text-xl transition ${
                        profile.avatar ===
                        avatar
                          ? 'border-white bg-white/10'
                          : 'border-white/10 bg-white/[0.025] hover:bg-white/10'
                      }`}
                    >
                      {avatar}
                    </button>
                  ),
                )}
              </div>
            </div>

            <div className="mt-7 flex gap-2">
              <button
                type="button"
                onClick={() =>
                  setShowProfile(false)
                }
                className="flex-1 rounded-xl border border-white/10 py-3 text-[9px] font-black uppercase tracking-[0.15em] text-white/50 hover:bg-white/5 hover:text-white"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={saveProfile}
                className="flex-1 rounded-xl bg-white py-3 text-[9px] font-black uppercase tracking-[0.15em] text-black"
              >
                Save Profile
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const MovieDetails = () => {
    if (!selectedMovie) return null

    const listed =
      isInMyList(
        selectedMovie,
      )

    const saved =
      getProgress(
        selectedMovie,
      )

    const percent =
      movieProgress(
        selectedMovie,
      )

    return (
      <div className="fixed inset-0 z-[90] overflow-y-auto bg-black/90 backdrop-blur-md">
        <div className="min-h-screen py-6 sm:py-12">
          <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a] shadow-2xl">
            <div className="relative aspect-[16/8] overflow-hidden">
              <img
                src={
                  selectedMovie.backdrop ||
                  selectedMovie.poster ||
                  heroImage
                }
                alt=""
                className="h-full w-full object-cover"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-black/30 to-black/10" />

              <button
                type="button"
                onClick={() =>
                  setSelectedMovie(null)
                }
                className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur hover:bg-white/10"
              >
                <X size={18} />
              </button>

              <div className="absolute bottom-5 left-5 right-5 sm:bottom-8 sm:left-8">
                <span className="mb-3 inline-flex rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.18em] text-white/60 backdrop-blur">
                  {selectedMovie.category ||
                    selectedMovie.type ||
                    'PMF Original'}
                </span>

                <h2 className="max-w-3xl text-3xl font-black tracking-[-0.04em] text-white sm:text-5xl">
                  {selectedMovie.title}
                </h2>
              </div>
            </div>

            <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[1fr_280px]">
              <div>
                <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold text-white/45">
                  <span>
                    {selectedMovie.year}
                  </span>

                  <span>
                    {selectedMovie.type ||
                      'Film'}
                  </span>

                  <span className="inline-flex items-center gap-1 text-white">
                    <Star
                      size={11}
                      fill="currentColor"
                    />
                    {getRating(
                      selectedMovie,
                    ).toFixed(1)}
                  </span>
                </div>

                <p className="mt-5 text-sm leading-7 text-white/50">
                  {selectedMovie.description ||
                    'Experience this story on PMF-Flix.'}
                </p>

                {percent > 0 && (
                  <div className="mt-6">
                    <div className="mb-2 flex justify-between text-[8px] font-black uppercase tracking-[0.15em] text-white/30">
                      <span>
                        Continue Watching
                      </span>

                      <span>
                        {Math.round(
                          percent,
                        )}
                        %
                      </span>
                    </div>

                    <div className="h-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-red-600"
                        style={{
                          width: `${percent}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-7 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      startWatching(
                        selectedMovie,
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-[9px] font-black uppercase tracking-[0.16em] text-black"
                  >
                    <Play
                      size={14}
                      fill="currentColor"
                    />
                    {saved.currentTime >
                    0
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
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3.5 text-[9px] font-black uppercase tracking-[0.16em] text-white/70 hover:bg-white/10 hover:text-white"
                  >
                    {listed ? (
                      <>
                        <Check size={13} />
                        In My List
                      </>
                    ) : (
                      <>
                        <ListPlus
                          size={13}
                        />
                        Add to My List
                      </>
                    )}
                  </button>
                </div>
              </div>

              <aside className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/25">
                  PMF Details
                </p>

                <div className="mt-5 space-y-4">
                  <div>
                    <p className="text-[8px] uppercase tracking-[0.15em] text-white/25">
                      Category
                    </p>

                    <p className="mt-1 text-xs font-bold text-white/70">
                      {selectedMovie.category ||
                        'General'}
                    </p>
                  </div>

                  <div>
                    <p className="text-[8px] uppercase tracking-[0.15em] text-white/25">
                      Release
                    </p>

                    <p className="mt-1 text-xs font-bold text-white/70">
                      {selectedMovie.year ||
                        '—'}
                    </p>
                  </div>

                  <div>
                    <p className="text-[8px] uppercase tracking-[0.15em] text-white/25">
                      Rating
                    </p>

                    <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-white/70">
                      <Star
                        size={11}
                        fill="currentColor"
                      />
                      {getRating(
                        selectedMovie,
                      ).toFixed(1)}
                    </p>
                  </div>

                  <div>
                    <p className="text-[8px] uppercase tracking-[0.15em] text-white/25">
                      Experience
                    </p>

                    <p className="mt-1 text-xs font-bold text-white/70">
                      Cinematic
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const Player = () => {
    if (!watchingMovie) return null

    const videoUrl =
      getVideoUrl(
        watchingMovie,
      )

    const youtube =
      isYouTube(videoUrl)

    const embed =
      youtube
        ? getYouTubeEmbed(
            videoUrl,
          )
        : ''

    return (
      <div
        ref={playerRef}
        onMouseMove={
          resetPlayerControls
        }
        onClick={
          resetPlayerControls
        }
        className={`fixed inset-0 z-[120] flex flex-col bg-black ${
          theaterMode
            ? 'p-0'
            : 'p-0'
        }`}
      >
        <div className="absolute left-0 right-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/90 to-transparent px-4 pb-12 pt-5 sm:px-7">
          <div className="min-w-0">
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/35">
              PMF-FLIX
            </p>

            <h2 className="mt-1 truncate text-sm font-black text-white sm:text-lg">
              {watchingMovie.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={
              closePlayer
            }
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/70 backdrop-blur hover:bg-white/10 hover:text-white"
            aria-label="Close player"
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          {youtube && embed ? (
            <iframe
              src={embed}
              title={
                watchingMovie.title
              }
              className="h-full w-full"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          ) : videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              poster={
                watchingMovie.backdrop ||
                watchingMovie.poster
              }
              className="max-h-full max-w-full object-contain"
              playsInline
              onLoadedMetadata={
                handleVideoLoaded
              }
              onTimeUpdate={(
                event,
              ) => {
                const value =
                  event.currentTarget
                    .currentTime

                setPlayerTime(value)
              }}
              onDurationChange={(
                event,
              ) => {
                updatePlayerDuration(
                  event.currentTarget
                    .duration,
                )
              }}
              onPlay={() => {
                setPlayerPlaying(
                  true,
                )
                resetPlayerControls()
              }}
              onPause={() =>
                setPlayerPlaying(
                  false,
                )
              }
              onEnded={
                handleVideoEnded
              }
            />
          ) : (
            <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
              <img
                src={
                  watchingMovie.backdrop ||
                  watchingMovie.poster ||
                  heroImage
                }
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-20 blur-sm"
              />

              <div className="relative max-w-md px-6 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/5">
                  <Film
                    size={30}
                    className="text-white/40"
                  />
                </div>

                <h3 className="mt-6 text-2xl font-black text-white">
                  {watchingMovie.title}
                </h3>

                <p className="mt-3 text-sm leading-6 text-white/30">
                  This title is ready in the PMF-Flix experience, but a licensed video source has not been attached yet.
                </p>

                <button
                  type="button"
                  onClick={
                    closePlayer
                  }
                  className="mt-6 rounded-xl bg-white px-5 py-3 text-[9px] font-black uppercase tracking-[0.16em] text-black"
                >
                  Back to PMF-Flix
                </button>
              </div>
            </div>
          )}

          {playerMessage && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-black/70 px-5 py-3 text-xs font-black text-white shadow-2xl backdrop-blur-xl">
              {playerMessage}
            </div>
          )}
        </div>

        {!youtube &&
          videoUrl && (
            <div
              className={`absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black via-black/80 to-transparent px-4 pb-5 pt-20 transition-opacity duration-300 sm:px-7 ${
                showPlayerControls
                  ? 'opacity-100'
                  : 'opacity-0'
              }`}
            >
              <div className="mx-auto max-w-6xl">
                <input
                  type="range"
                  min="0"
                  max={
                    playerDuration ||
                    0
                  }
                  step="0.1"
                  value={
                    Math.min(
                      playerTime,
                      playerDuration ||
                        0,
                    )
                  }
                  onChange={(
                    event,
                  ) =>
                    seek(
                      Number(
                        event.target
                          .value,
                      ),
                    )
                  }
                  className="mb-4 h-1 w-full cursor-pointer accent-white"
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void playPause()
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/10"
                    aria-label={
                      playerPlaying
                        ? 'Pause'
                        : 'Play'
                    }
                  >
                    {playerPlaying ? (
                      <Pause
                        size={17}
                        fill="currentColor"
                      />
                    ) : (
                      <Play
                        size={17}
                        fill="currentColor"
                      />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={
                      rewind
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                    aria-label="Rewind 10 seconds"
                  >
                    <RotateCcw
                      size={16}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={
                      forward
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                    aria-label="Forward 10 seconds"
                  >
                    <SkipForward
                      size={16}
                    />
                  </button>

                  <span className="ml-1 text-[10px] font-bold tabular-nums text-white/45">
                    {formatTime(
                      playerTime,
                    )}{' '}
                    /{' '}
                    {formatTime(
                      playerDuration,
                    )}
                  </span>

                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      onClick={
                        toggleMute
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                    >
                      {muted ||
                      volume ===
                        0 ? (
                        <VolumeX
                          size={16}
                        />
                      ) : (
                        <Volume2
                          size={16}
                        />
                      )}
                    </button>

                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={
                        muted
                          ? 0
                          : volume
                      }
                      onChange={(
                        event,
                      ) =>
                        changeVolume(
                          Number(
                            event
                              .target
                              .value,
                          ),
                        )
                      }
                      className="hidden w-20 accent-white sm:block"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPlayerSettings(
                          (
                            current,
                          ) =>
                            !current,
                        )
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                    >
                      <Settings
                        size={16}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={
                        fullscreen
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                    >
                      <Maximize
                        size={16}
                      />
                    </button>
                  </div>
                </div>

                {showPlayerSettings && (
                  <div className="absolute bottom-20 right-4 w-48 rounded-2xl border border-white/10 bg-black/90 p-3 shadow-2xl backdrop-blur-xl sm:right-7">
                    <p className="mb-3 text-[8px] font-black uppercase tracking-[0.18em] text-white/30">
                      Playback Speed
                    </p>

                    <div className="grid grid-cols-4 gap-1">
                      {[0.75, 1, 1.25, 1.5].map(
                        (value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() =>
                              changeSpeed(
                                value,
                              )
                            }
                            className={`rounded-lg px-2 py-2 text-[9px] font-black ${
                              speed ===
                              value
                                ? 'bg-white text-black'
                                : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {value}×
                          </button>
                        ),
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setTheaterMode(
                          (
                            current,
                          ) =>
                            !current,
                        )
                      }
                      className="mt-3 flex w-full items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-[8px] font-black uppercase tracking-[0.12em] text-white/50 hover:bg-white/10 hover:text-white"
                    >
                      Theater Mode
                      <span>
                        {theaterMode
                          ? 'ON'
                          : 'OFF'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
      </div>
    )
  }

  const Footer = () => (
    <footer className="border-t border-white/[0.06] bg-black px-5 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-black">
              <Film size={15} />
            </div>

            <span className="text-sm font-black text-white">
              PMF-FLIX
            </span>
          </div>

          <p className="mt-3 max-w-sm text-xs leading-6 text-white/25">
            Your World. Your Stories. Your Flix.
          </p>
        </div>

        <div className="text-[8px] font-black uppercase tracking-[0.18em] text-white/20">
          Built for the next generation of storytelling
        </div>
      </div>
    </footer>
  )

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />

      {error && (
        <div className="mx-auto max-w-[1600px] px-5 pt-24 sm:px-10 lg:px-16">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-4 text-xs text-white/50">
            {error}
          </div>
        </div>
      )}

      {section === 'home' && (
        <HomeContent />
      )}

      {(section === 'movies' ||
        section === 'series') && (
        <LibraryContent />
      )}

      {section === 'my-list' && (
        <MyListContent />
      )}

      {section !== 'home' && (
        <Footer />
      )}

      <MovieDetails />

      <ProfileModal />

      {watchingMovie && (
        <Player />
      )}
    </div>
  )
}

export default function App() {
  const [session, setSession] =
    useState<Session | null>(
      null,
    )

  const [loading, setLoading] =
    useState(true)

  useEffect(() => {
    let mounted = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return

        setSession(
          data.session,
        )
        setLoading(false)
      })
      .catch((error) => {
        console.error(
          'PMF authentication error:',
          error,
        )

        if (mounted) {
          setLoading(false)
        }
      })

    const {
      data: listener,
    } =
      supabase.auth.onAuthStateChange(
        (_event, nextSession) => {
          setSession(
            nextSession,
          )
          setLoading(false)
        },
      )

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-black shadow-2xl">
            <Film size={26} />
          </div>

          <div className="mt-5 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.22em] text-white/30">
            <LoaderCircle
              size={12}
              className="animate-spin"
            />
            Entering PMF-Flix
          </div>
        </div>
      </div>
    )
  }

  if (!session) {
    return <AuthScreen />
  }

  return (
    <AppShell
      session={session}
    />
   ) 
  }
