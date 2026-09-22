import heroImage from './assets/hero.png'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import type { Movie } from './movieData/movies'
import { getMovies } from './services/movieService'
import { mapCanonicalMovieToLegacy } from './utils/movieMapper'
import { supabase } from './supabase'
import type { Session } from '@supabase/supabase-js'
import AuthScreen from './Auth'
import AdminStudio from './AdminStudio'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Film,
  Heart,
  ListPlus,
  LoaderCircle,
  Menu,
  Pause,
  Play,
  Search,
  Settings,
  SkipBack,
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
  const minutes = Math.floor(total / 60)
  const remaining = total % 60

  return `${minutes}:${String(
    remaining,
  ).padStart(2, '0')}`
}

function getYouTubeId(
  url: string,
): string {
  try {
    const parsed = new URL(url)

    if (
      parsed.hostname.includes(
        'youtu.be',
      )
    ) {
      return parsed.pathname
        .replace('/', '')
        .split('/')[0]
    }

    const videoId =
      parsed.searchParams.get('v')

    if (videoId) {
      return videoId
    }

    const match =
      parsed.pathname.match(
        /\/embed\/([^/?]+)/,
      )

    return match?.[1] || ''
  } catch {
    return ''
  }
}

function getVideoUrl(
  movie: Movie,
): string {
  return movie.videoUrl || ''
}

function isYouTube(
  movie: Movie,
): boolean {
  const url = movie.videoUrl || ''

  return (
    movie.videoType === 'youtube' ||
    /youtube\.com|youtu\.be/i.test(url)
  )
}

function getYouTubeEmbed(
  movie: Movie,
): string {
  const id = getYouTubeId(
    movie.videoUrl || '',
  )

  if (!id) {
    return ''
  }

  return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`
}

function AppShell() {
  const [session, setSession] =
    useState<Session | null>(null)

  const [authLoading, setAuthLoading] =
    useState(true)

  useEffect(() => {
    let mounted = true

    const loadSession = async () => {
      const { data } =
        await supabase.auth.getSession()

      if (!mounted) return

      if (data.session) {
  setSession(data.session)
      }

      setAuthLoading(false)
     }

    void loadSession()

    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        (_event, nextSession) => {
          if (!mounted) return

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
    let active = true

    const checkStudioAccess = async () => {
      if (!session?.user?.id) {
        setIsStudioAdmin(false)
        setShowStudio(false)
        return
      }

      const { data, error } = await supabase
        .from('media_admins')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (!active) {
        return
      }

      const allowed =
        !error &&
        data &&
        ['owner', 'admin', 'editor'].includes(
          String(data.role),
        )

      setIsStudioAdmin(Boolean(allowed))

      if (!allowed) {
        setShowStudio(false)
      }
    }

    void checkStudioAccess()

    return () => {
      active = false
    }
  }, [session])

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
    useState<
      Record<string, Progress>
    >(() =>
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

  const [showStudio, setShowStudio] = useState(false)

  const [isStudioAdmin, setIsStudioAdmin] = useState(false)

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

    const loadMovies = async () => {
      try {
        setLoading(true)
        setError(null)

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

  const openMovie = (
    movie: Movie,
  ) => {
    setSelectedMovie(movie)
  }

  const startWatching = (
    movie: Movie,
  ) => {
    const saved = getProgress(movie)

    setSelectedMovie(null)
    setWatchingMovie(movie)
    setPlayerTime(
      saved.currentTime,
    )
    setPlayerDuration(
      saved.duration,
    )

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
      }, 1800)
  }

  const playPause = async () => {
    const video = videoRef.current

    if (!video) {
      showMessage(
        'This title does not have a playable video source yet.',
      )
      return
    }

    try {
      if (video.paused) {
        await video.play()
      } else {
        video.pause()
      }
    } catch (playError) {
      console.error(
        'PMF playback error:',
        playError,
      )

      showMessage(
        'Playback could not start.',
      )
    }
  }

  const seek = (
    time: number,
  ) => {
    const video = videoRef.current

    if (!video) {
      return
    }

    const next = Math.max(
      0,
      Math.min(
        playerDuration || 0,
        time,
      ),
    )

    video.currentTime = next
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
      videoRef.current.muted = next
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
      videoRef.current.volume = next
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
        'Fullscreen is unavailable on this device.',
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
          setShowPlayerControls(false)
        }
      }, 3500)
  }

  useEffect(() => {
    if (!watchingMovie) {
      return
    }

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

      if (event.key === 'ArrowLeft') {
        rewind()
      }

      if (event.key === 'ArrowRight') {
        forward()
      }

      if (
        event.key.toLowerCase() === 'm'
      ) {
        toggleMute()
      }

      if (
        event.key.toLowerCase() === 'f'
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

    return () => {
      window.removeEventListener(
        'keydown',
        handleKey,
      )
    }
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
        String(
          movie.category || '',
        ).trim(),
      )
      .filter(Boolean)

    return [
      'All',
      ...Array.from(
        new Set(values),
      ),
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

  const typeOptions = useMemo(
    () => [
      'All',
      ...Array.from(
        new Set(
          movies
            .map((movie) =>
              String(
                movie.type || '',
              ).trim(),
            )
            .filter(Boolean),
        ),
      ),
    ],
    [movies],
  )

  const normalizedSearch =
    search.trim().toLowerCase()

  const searchableMovies = useMemo(
    () =>
      movies.filter((movie) =>
        [
          movie.title,
          movie.description,
          movie.category,
          movie.type,
          movie.year,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(
            normalizedSearch,
          ),
      ),
    [movies, normalizedSearch],
  )

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

    return result
  }, [
    searchableMovies,
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
        .slice(0, 12),
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
        .slice(0, 12),
    [movies],
  )

  const featuredMovies = useMemo(
    () =>
      movies
        .filter(
          (movie) =>
            movie.featured,
        )
        .slice(0, 12),
    [movies],
  )

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

      const scored = movies
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
      movies,
      history,
      historyMovies,
      trendingMovies,
    ])

  const categoryRows = useMemo(
    () => {
      const seen =
        new Set<string>()

      return movies
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
          items: movies
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
    [movies],
  )

  const getProgressPercent = (
    movie: Movie,
  ) => {
    const item =
      getProgress(movie)

    if (
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

  const playNextMovie = () => {
    const next =
      getNextMovie()

    if (!next) {
      return
    }

    setWatchingMovie(next)
    setPlayerTime(
      getProgress(next)
        .currentTime,
    )
    setPlayerDuration(
      getProgress(next)
        .duration,
    )

    addToHistory(next)
    addToContinueWatching(next)
    setPlayerPlaying(false)
    setShowPlayerSettings(false)

    window.setTimeout(() => {
      void videoRef.current?.play()
    }, 150)
  }

  const handleVideoLoaded = () => {
    const video =
      videoRef.current

    if (!video) {
      return
    }

    const saved =
      watchingMovie
        ? getProgress(
            watchingMovie,
          )
        : null

    const duration =
      Number.isFinite(
        video.duration,
      )
        ? video.duration
        : 0

    if (duration > 0) {
      setPlayerDuration(
        duration,
      )

      if (
        saved &&
        saved.currentTime > 0 &&
        saved.currentTime <
          duration - 3
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

  const handleTimeUpdate = () => {
    const video =
      videoRef.current

    if (!video) {
      return
    }

    setPlayerTime(
      video.currentTime,
    )

    if (
      watchingMovie &&
      video.duration > 0
    ) {
      saveProgress(
        watchingMovie,
        video.currentTime,
        video.duration,
      )
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

  const clearSearch = () => {
    setSearch('')
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

  const signOut = async () => {
    await supabase.auth.signOut()
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
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1 flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.22em] text-white/25">
            <Sparkles size={10} />
            {eyebrow}
          </p>
        )}

        <h2 className="text-xl font-black tracking-[-0.03em] text-white sm:text-2xl">
          {title}
        </h2>

        {subtitle && (
          <p className="mt-1 max-w-2xl text-xs leading-5 text-white/30">
            {subtitle}
          </p>
        )}
      </div>

      {action}
    </div>
  )

  const MovieCard = ({
    movie,
    compact = false,
  }: {
    movie: Movie
    compact?: boolean
  }) => {
    const percent =
      getProgressPercent(movie)

    const listed =
      isInMyList(movie)

    return (
      <article
        className={`group relative shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] transition duration-500 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.055] hover:shadow-2xl ${
          compact
            ? 'w-[145px] sm:w-[170px]'
            : 'w-[160px] sm:w-[190px] lg:w-[205px]'
        }`}
        onClick={() =>
          openMovie(movie)
        }
      >
        <div className="relative aspect-[2/3] overflow-hidden bg-white/5">
          <img
            src={
              movie.poster ||
              heroImage
            }
            alt={movie.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/10 opacity-70" />

          {movie.featured && (
            <div className="absolute left-2 top-2 rounded-full border border-white/10 bg-black/55 px-2 py-1 text-[7px] font-black uppercase tracking-[0.14em] text-white backdrop-blur">
              Featured
            </div>
          )}

          {listed && (
            <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white backdrop-blur">
              <Check size={12} />
            </div>
          )}

          {percent > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
              <div
                className="h-full bg-red-500"
                style={{
                  width: `${percent}%`,
                }}
              />
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 translate-y-3 p-3 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                startWatching(movie)
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black shadow-xl"
              aria-label={`Play ${movie.title}`}
            >
              <Play
                size={14}
                fill="currentColor"
              />
            </button>
          </div>
        </div>

        <div className="p-3">
          <h3 className="truncate text-xs font-black text-white">
            {movie.title}
          </h3>

          <div className="mt-1.5 flex items-center gap-2 text-[8px] font-bold text-white/30">
            <span>{movie.year}</span>

            <span>•</span>

            <span>
              {movie.type ||
                'Film'}
            </span>

            {getRating(movie) >
              0 && (
              <>
                <span>•</span>

                <span className="inline-flex items-center gap-0.5 text-white/50">
                  <Star
                    size={8}
                    fill="currentColor"
                  />
                  {getRating(movie).toFixed(
                    1,
                  )}
                </span>
              </>
            )}
          </div>
        </div>
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

        <div className="relative">
          <div className="no-scrollbar flex gap-3 overflow-x-auto pb-3 sm:gap-4">
            {items.map((movie) => (
              <MovieCard
                key={getMovieId(movie)}
                movie={movie}
              />
            ))}
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((movie) => (
          <div
            key={getMovieId(movie)}
            className="min-w-0"
          >
            <MovieCard
              movie={movie}
            />
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
    const catalogItems = filteredMovies.filter(
      (movie) => {
        const movieType = String(
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
                      (current) => !current,
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
            <section className="mb-10 rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="block">
                  <span className="mb-2 block text-[8px] font-black uppercase tracking-[0.16em] text-white/30">
                    Category
                  </span>

                  <select
                    value={filters.category}
                    onChange={(event) =>
                      setFilters(
                        (current) => ({
                          ...current,
                          category:
                            event.target.value,
                        }),
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-xs text-white outline-none"
                  >
                    <option value="All">
                      All
                    </option>

                    {Array.from(
                      new Set(
                        movies
                          .map(
                            (movie) =>
                              movie.category,
                          )
                          .filter(Boolean)
                          .map(String),
                      ),
                    ).map((category) => (
                      <option
                        key={category}
                        value={category}
                      >
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-[8px] font-black uppercase tracking-[0.16em] text-white/30">
                    Year
                  </span>

                  <select
                    value={filters.year}
                    onChange={(event) =>
                      setFilters(
                        (current) => ({
                          ...current,
                          year:
                            event.target.value,
                        }),
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-xs text-white outline-none"
                  >
                    <option value="All">
                      All
                    </option>

                    {Array.from(
                      new Set(
                        movies
                          .map(
                            (movie) =>
                              String(
                                movie.year ||
                                  '',
                              ),
                          )
                          .filter(Boolean),
                      ),
                    )
                      .sort(
                        (a, b) =>
                          Number(b) -
                          Number(a),
                      )
                      .map((year) => (
                        <option
                          key={year}
                          value={year}
                        >
                          {year}
                        </option>
                      ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-[8px] font-black uppercase tracking-[0.16em] text-white/30">
                    Rating
                  </span>

                  <select
                    value={filters.rating}
                    onChange={(event) =>
                      setFilters(
                        (current) => ({
                          ...current,
                          rating:
                            event.target.value,
                        }),
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-xs text-white outline-none"
                  >
                    <option value="0">
                      Any Rating
                    </option>

                    <option value="5">
                      5+
                    </option>

                    <option value="7">
                      7+
                    </option>

                    <option value="8">
                      8+
                    </option>

                    <option value="9">
                      9+
                    </option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-[8px] font-black uppercase tracking-[0.16em] text-white/30">
                    Sort
                  </span>

                  <select
                    value={filters.sort}
                    onChange={(event) =>
                      setFilters(
                        (current) => ({
                          ...current,
                          sort:
                            event.target
                              .value as SortMode,
                        }),
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-xs text-white outline-none"
                  >
                    <option value="featured">
                      Featured
                    </option>

                    <option value="newest">
                      Newest
                    </option>

                    <option value="oldest">
                      Oldest
                    </option>

                    <option value="rating">
                      Rating
                    </option>

                    <option value="title">
                      Title
                    </option>
                  </select>
                </label>
              </div>

              <button
                type="button"
                onClick={resetFilters}
                className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-[8px] font-black uppercase tracking-[0.16em] text-white/50 transition hover:bg-white/[0.08] hover:text-white"
              >
                Reset Filters
              </button>
            </section>
          )}

          <div className="mb-6 flex items-center justify-between">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/25">
              {catalogItems.length}{' '}
              {type === 'Movie'
                ? 'movies'
                : 'series'}{' '}
              available
            </p>
          </div>

          <MovieGrid
            items={catalogItems}
          />
        </div>
      </main>
    )
  }

  const MyListPage = () => {
    const savedMovies = myList
      .map((id) => findMovie(id))
      .filter(
        (movie): movie is Movie =>
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
            <MovieGrid
              items={savedMovies}
            />
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
      featuredMovies[0] ||
      movies[0]

    if (!featured) {
      return (
        <section className="relative flex min-h-[78vh] items-center overflow-hidden bg-[#050505]">
          <div className="mx-auto max-w-1600px px-5 pt-28 sm:px-10 lg:px-16">
            <p className="text-[9px] font-black uppercase tracking-[0.28em] text-white/30">
              PMF — Prince Mufasa Flix
            </p>

            <h1 className="mt-4 max-w-3xl text-5xl font-black tracking-[-0.06em] text-white sm:text-7xl">
              Your world.
              <br />
              Your stories.
              <br />
              Your Flix.
            </h1>
          </div>
        </section>
      )
    }

    return (
      <section className="relative min-h-[78vh] overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={
              featured.poster ||
              heroImage
            }
            alt=""
            className="h-full w-full scale-105 object-cover opacity-45 blur-[1px]"
          />

          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/65 to-black/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-black/20" />
        </div>

        <div className="relative mx-auto flex min-h-[78vh] max-w-[1600px] items-end px-5 pb-16 pt-32 sm:px-10 sm:pb-20 lg:px-16">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.2em] text-white/65 backdrop-blur">
              <Sparkles size={10} />
              Featured on PMF-Flix
            </div>

            <h1 className="text-5xl font-black tracking-[-0.065em] text-white sm:text-7xl lg:text-8xl">
              {featured.title}
            </h1>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-[9px] font-bold uppercase tracking-[0.12em] text-white/50">
              <span>{featured.year}</span>

              <span>•</span>

              <span>
                {featured.type ||
                  'Film'}
              </span>

              {featured.duration && (
                <>
                  <span>•</span>
                  <span>
                    {featured.duration}
                  </span>
                </>
              )}

              {getRating(featured) >
                0 && (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 text-white">
                    <Star
                      size={10}
                      fill="currentColor"
                    />
                    {getRating(
                      featured,
                    ).toFixed(1)}
                  </span>
                </>
              )}
            </div>

            <p className="mt-5 max-w-xl text-sm leading-7 text-white/55 sm:text-base">
              {featured.description ||
                'Discover remarkable stories, unforgettable characters and cinematic worlds on PMF-Flix.'}
            </p>

            <div className="mt-8 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  startWatching(
                    featured,
                  )
                }
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-[9px] font-black uppercase tracking-[0.17em] text-black transition hover:scale-[1.02]"
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
                  openMovie(
                    featured,
                  )
                }
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-5 py-3.5 text-[9px] font-black uppercase tracking-[0.17em] text-white backdrop-blur transition hover:bg-white/10"
              >
                <Film size={13} />
                More Info
              </button>
            </div>
          </div>
        </div>
      </section>
    )
  }

  const Header = () => (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/[0.06] bg-black/55 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-4 sm:px-8 lg:px-12">
        <button
          type="button"
          onClick={() =>
            navigate('home')
          }
          className="flex shrink-0 items-center gap-2"
          aria-label="PMF-Flix home"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black">
            <Film size={17} />
          </div>

          <div className="hidden sm:block">
            <div className="text-sm font-black tracking-[-0.03em] text-white">
              PMF
              <span className="text-white/35">
                -FLIX
              </span>
            </div>

            <div className="text-[6px] font-black uppercase tracking-[0.22em] text-white/25">
              Prince Mufasa Flix
            </div>
          </div>
        </button>

        <nav className="hidden items-center gap-1 lg:flex">
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
                className={`rounded-lg px-3 py-2 text-[8px] font-black uppercase tracking-[0.16em] transition ${
                  section === key
                    ? 'bg-white/10 text-white'
                    : 'text-white/35 hover:bg-white/5 hover:text-white'
                }`}
              >
                {label}
              </button>
            ),
          )}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          <div className="hidden w-[220px] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 sm:flex">
            <Search
              size={14}
              className="shrink-0 text-white/25"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search PMF-Flix"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-xs text-white outline-none placeholder:text-white/20"
            />

            {search && (
              <button
                type="button"
                onClick={clearSearch}
                className="text-white/30 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              setShowProfile(true)
            }
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-lg transition hover:bg-white/10"
            aria-label="Open profile"
          >
            {profile.avatar}
          </button>

          {isStudioAdmin && (
  <button
    type="button"
    onClick={() => setShowStudio(true)}
    className="hidden h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-[8px] font-black uppercase tracking-[0.14em] text-white/45 transition hover:bg-white/10 hover:text-white lg:flex"
    aria-label="Open PMF Studio"
  >
    <Film size={13} />
    Studio
  </button>
)}
          
          <button
            type="button"
            onClick={() =>
              setMobileMenu(
                (value) => !value,
              )
            }
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/55 lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={16} />
          </button>
        </div>
      </div>

      {mobileMenu && (
        <div className="border-t border-white/[0.06] bg-black/95 px-4 py-4 lg:hidden">
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3">
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
              placeholder="Search PMF-Flix"
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
                  className={`rounded-xl border px-4 py-3 text-left text-[8px] font-black uppercase tracking-[0.16em] ${
                    section === key
                      ? 'border-white/20 bg-white/10 text-white'
                      : 'border-white/10 bg-white/[0.025] text-white/35'
                  }`}
                >
                  {label}
                </button>
              ),
            )}
          </div>

         {isStudioAdmin && (
  <button
    type="button"
    onClick={() => {
      setShowStudio(true)
      setMobileMenu(false)
    }}
    className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-left text-[8px] font-black uppercase tracking-[0.16em] text-white/35 transition hover:bg-white/10 hover:text-white"
  >
    <span className="inline-flex items-center gap-2">
      <Film size={13} />
      PMF Studio
    </span>
  </button>
)}       
      </div>
      )}
    </header>
  )

  const DiscoveryToolbar = () => (
    <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-[8px] font-black uppercase tracking-[0.22em] text-white/25">
          Explore the universe
        </p>

        <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-white">
          {section === 'movies'
            ? 'Movies'
            : section ===
                'series'
              ? 'TV Series'
              : section ===
                  'my-list'
                ? 'My List'
                : 'Discover'}
        </h1>
      </div>

      <button
        type="button"
        onClick={() =>
          setShowFilters(
            (value) => !value,
          )
        }
        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[8px] font-black uppercase tracking-[0.16em] text-white/55 hover:bg-white/10 hover:text-white"
      >
        <Settings size={13} />
        Filters
      </button>
    </div>
  )

  const FilterPanel = () => {
    if (!showFilters) {
      return null
    }

    return (
      <div className="mb-8 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label>
            <span className="mb-2 block text-[7px] font-black uppercase tracking-[0.16em] text-white/25">
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
              className="w-full rounded-xl border border-white/10 bg-black px-3 py-3 text-xs text-white outline-none"
            >
              {categories.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            <span className="mb-2 block text-[7px] font-black uppercase tracking-[0.16em] text-white/25">
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
              className="w-full rounded-xl border border-white/10 bg-black px-3 py-3 text-xs text-white outline-none"
            >
              {typeOptions.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            <span className="mb-2 block text-[7px] font-black uppercase tracking-[0.16em] text-white/25">
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
              className="w-full rounded-xl border border-white/10 bg-black px-3 py-3 text-xs text-white outline-none"
            >
              {years.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                ),
              )}
            </select>
          </label>

    <label>
            <span className="mb-2 block text-[7px] font-black uppercase tracking-[0.16em] text-white/25">
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
              className="w-full rounded-xl border border-white/10 bg-black px-3 py-3 text-xs text-white outline-none"
            >
              {[
                '0',
                '5',
                '6',
                '7',
                '8',
                '9',
              ].map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item === '0'
                      ? 'Any rating'
                      : `${item}+`}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            <span className="mb-2 block text-[7px] font-black uppercase tracking-[0.16em] text-white/25">
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
              className="w-full rounded-xl border border-white/10 bg-black px-3 py-3 text-xs text-white outline-none"
            >
              <option value="featured">
                Featured
              </option>
              <option value="newest">
                Newest
              </option>
              <option value="oldest">
                Oldest
              </option>
              <option value="rating">
                Highest Rated
              </option>
              <option value="title">
                A–Z
              </option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={resetFilters}
            className="text-[8px] font-black uppercase tracking-[0.16em] text-white/30 hover:text-white"
          >
            Reset all filters
          </button>
        </div>
      </div>
    )
  }

  const HomeContent = () => (
  <>
    {/* CINEMATIC HERO */}
    <Hero />

    {/* PMF HOME EXPERIENCE */}
    <main className="relative mx-auto max-w-[1600px] overflow-hidden px-5 pb-24 sm:px-10 lg:px-16">

      {/* Atmospheric glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-white/[0.025] blur-[140px]"
      />

      {/* CONTINUE WATCHING */}
      {continueMovies.length > 0 && (
        <section className="relative">
          <MovieRow
            eyebrow="Pick up where you left off"
            title="Continue Watching"
            subtitle="Your unfinished stories, ready when you are."
            items={continueMovies}
          />
        </section>
      )}

      {/* FEATURED */}
      {featuredMovies.length > 1 && (
        <section className="relative">
          <MovieRow
            eyebrow="PMF selection"
            title="Featured"
            subtitle="Stories selected for the PMF experience."
            items={featuredMovies}
          />
        </section>
      )}

      {/* TRENDING */}
      {trendingMovies.length > 0 && (
        <section className="relative">
          <MovieRow
            eyebrow="What's moving"
            title="Trending Now"
            subtitle="The titles creating the most excitement on PMF-Flix."
            items={trendingMovies}
          />
        </section>
      )}

      {/* PERSONALIZED */}
      {personalizedMovies.length > 0 && (
        <section className="relative">
          <MovieRow
            eyebrow="Made for your journey"
            title="Made For You"
            subtitle="Recommendations shaped by your viewing journey."
            items={personalizedMovies}
          />
        </section>
      )}

      {/* NEW RELEASES */}
      {latestMovies.length > 0 && (
        <section className="relative">
          <MovieRow
            eyebrow="Fresh from the catalogue"
            title="New & Noteworthy"
            subtitle="Fresh stories waiting to be discovered."
            items={latestMovies}
          />
        </section>
      )}

      {/* CATEGORY DISCOVERY */}
      {categoryRows.length > 0 && (
        <section className="relative">
          {categoryRows.map((row) => (
            <MovieRow
              key={row.category}
              eyebrow="Explore by category"
              title={row.category}
              subtitle={`Discover ${row.category.toLowerCase()} stories on PMF-Flix.`}
              items={row.items}
            />
          ))}
        </section>
      )}

      {/* WATCH HISTORY */}
      {historyMovies.length > 0 && (
        <section className="relative">
          <MovieRow
            eyebrow="Your activity"
            title="Recently Watched"
            subtitle="Your latest PMF-Flix activity."
            items={historyMovies.slice(0, 10)}
          />
        </section>
      )}

      {/* PMF UNIVERSE */}
      <section className="relative mt-16 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.025] px-6 py-12 sm:px-10 lg:px-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full bg-white/[0.05] blur-[100px]"
        />

        <div className="relative max-w-3xl">
          <p className="mb-3 text-[9px] font-black uppercase tracking-[0.35em] text-white/40">
            The PMF Universe
          </p>

          <h2 className="text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl lg:text-5xl">
            Your world.
            <br />
            Your stories.
            <br />
            Your Flix.
          </h2>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-white/50 sm:text-base">
            Discover stories from every corner of the entertainment world —
            from global cinema and African stories to PMF Originals and the
            next title waiting to become your favourite.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate('movies')}
              className="rounded-full bg-white px-6 py-3 text-[9px] font-black uppercase tracking-[0.18em] text-black transition-transform duration-300 hover:scale-105"
            >
              Explore the Universe
            </button>

            <button
              type="button"
              onClick={() => navigate('movies')}
              className="rounded-full border border-white/15 bg-white/[0.04] px-6 py-3 text-[9px] font-black uppercase tracking-[0.18em] text-white/70 transition-colors duration-300 hover:bg-white/[0.08] hover:text-white"
            >
              Browse Movies
            </button>
          </div>
        </div>
      </section>

      {/* FINAL DISCOVERY STATEMENT */}
      <section className="relative py-20 text-center">
        <p className="text-[8px] font-black uppercase tracking-[0.4em] text-white/25">
          PMF-Flix
        </p>

        <h2 className="mt-4 text-2xl font-black tracking-[-0.04em] text-white/90 sm:text-3xl">
          There is always another story.
        </h2>

        <p className="mx-auto mt-3 max-w-xl text-xs leading-6 text-white/35 sm:text-sm">
          Keep exploring. Keep discovering. Keep watching.
        </p>
      </section>
    </main>
  </>
)
  
  const LibraryContent = () => (
    <main className="mx-auto max-w-[1600px] px-5 pb-24 pt-28 sm:px-10 lg:px-16">
      <DiscoveryToolbar />
      <FilterPanel />

      {loading ? (
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-white/30">
            <LoaderCircle
              size={28}
              className="animate-spin"
            />

            <span className="text-[8px] font-black uppercase tracking-[0.2em]">
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
    <main className="mx-auto max-w-[1600px] px-5 pb-24 pt-28 sm:px-10 lg:px-16">
      <DiscoveryToolbar />

      {myListMovies.length > 0 ? (
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
            Save movies and series you want
            to watch later. They will appear
            here instantly.
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

    const related = movies
      .filter(
        (movie) =>
          getMovieId(movie) !==
            getMovieId(selectedMovie) &&
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
                setSelectedMovie(
                  null,
                )
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
                <SectionTitle
                  eyebrow="Keep exploring"
                  title="You May Also Like"
                  subtitle="More stories from the same world."
                />

                <div className="no-scrollbar flex gap-3 overflow-x-auto pb-3 sm:gap-4">
                  {related.map(
                    (movie) => (
                      <MovieCard
                        key={getMovieId(
                          movie,
                        )}
                        movie={movie}
                      />
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
                        name: event.target.value,
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

            <div className="mt-7 flex gap-2">
              <button
                type="button"
                onClick={saveProfile}
                className="flex-1 rounded-xl bg-white px-4 py-3 text-[8px] font-black uppercase tracking-[0.16em] text-black"
              >
                Save Profile
              </button>

              <button
                type="button"
                onClick={signOut}
                className="rounded-xl border border-white/10 px-4 py-3 text-[8px] font-black uppercase tracking-[0.16em] text-white/40 hover:bg-white/5 hover:text-white"
              >
                Sign Out
              </button>
            </div>

            {playerMessage && (
  <p className="mt-4 text-center text-[9px] font-bold text-white/40">
    {playerMessage}
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

        <div className="no-scrollbar flex gap-3 overflow-x-auto">
          {filteredMovies
            .slice(0, 8)
            .map((movie) => (
              <MovieCard
                key={getMovieId(
                  movie,
                )}
                movie={movie}
                compact
              />
            ))}
        </div>
      </div>
    )
  }

  const Player = () => {
    if (!watchingMovie) {
      return null
    }

    const videoUrl =
      getVideoUrl(watchingMovie)

    const youtube =
      isYouTube(watchingMovie)

    const embedUrl =
      youtube
        ? getYouTubeEmbed(
            watchingMovie,
          )
        : ''

    const hasVideo =
      Boolean(videoUrl)

    const hasYouTubeVideo =
      youtube && Boolean(embedUrl)

    const hasPlayableVideo =
      hasVideo ||
      hasYouTubeVideo

    const percent =
      playerDuration > 0
        ? Math.min(
            100,
            Math.max(
              0,
              (playerTime /
                playerDuration) *
                100,
            ),
          )
        : 0

    return (
      <div
        ref={playerRef}
        className="fixed inset-0 z-[100] bg-black"
        tabIndex={0}
        onMouseMove={
          resetPlayerControls
        }
        onClick={
          resetPlayerControls
        }
      >
        <div className="relative flex h-full w-full items-center justify-center">

          {hasYouTubeVideo ? (
            <iframe
              src={embedUrl}
              title={watchingMovie.title}
              className="h-full w-full border-0"
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
            />
          ) : hasVideo ? (
            <video
              ref={videoRef}
              src={videoUrl}
              poster={
                watchingMovie.poster ||
                heroImage
              }
              className="max-h-full max-w-full object-contain"
              playsInline
              preload="metadata"
              onLoadedMetadata={(
                event,
              ) => {
                const duration =
                  event.currentTarget
                    .duration

                const safeDuration =
                  Number.isFinite(
                    duration,
                  )
                    ? duration
                    : 0

                setPlayerDuration(
                  safeDuration,
                )

                const saved =
                  getProgress(
                    watchingMovie,
                  )

                if (
                  saved.currentTime >
                    0 &&
                  saved.currentTime <
                    safeDuration - 5
                ) {
                  event.currentTarget.currentTime =
                    saved.currentTime

                  setPlayerTime(
                    saved.currentTime,
                  )
                }

                event.currentTarget.volume =
                  volume

                event.currentTarget.muted =
                  muted

                event.currentTarget.playbackRate =
                  speed
              }}
              onTimeUpdate={(
                event,
              ) => {
                const current =
                  event.currentTarget
                    .currentTime

                const duration =
                  event.currentTarget
                    .duration

                setPlayerTime(
                  current,
                )

                if (
                  Number.isFinite(
                    duration,
                  ) &&
                  duration > 0
                ) {
                  saveProgress(
                    watchingMovie,
                    current,
                    duration,
                  )
                }

                if (
                  current > 10
                ) {
                  addToContinueWatching(
                    watchingMovie,
                  )
                }
              }}
              onPlay={() => {
                setPlayerPlaying(
                  true,
                )

                resetPlayerControls()
              }}
              onPause={() => {
                setPlayerPlaying(
                  false,
                )

                setShowPlayerControls(
                  true,
                )
              }}
              onEnded={() => {
                saveProgress(
                  watchingMovie,
                  0,
                  0,
                )

                setPlayerPlaying(
                  false,
                )

                setPlayerTime(0)

                setShowPlayerControls(
                  true,
                )

                if (nextMovie) {
                  showMessage(
                    `Up next: ${nextMovie.title}`,
                  )
                }
              }}
              onError={() => {
                setPlayerPlaying(
                  false,
                )

                setShowPlayerControls(
                  true,
                )

                showMessage(
                  'This video could not be played.',
                )
              }}
            />
          ) : (
            <div className="flex max-w-lg flex-col items-center px-6 text-center">

              <div className="relative flex h-24 w-24 items-center justify-center rounded-[2rem] border border-white/10 bg-white/[0.035] shadow-2xl">
                <div className="absolute inset-0 rounded-[2rem] bg-white/[0.025] blur-xl" />

                <Film
                  size={34}
                  className="relative text-white/30"
                />
              </div>

              <p className="mt-7 text-[8px] font-black uppercase tracking-[0.3em] text-white/25">
                PMF-FLIX WATCH
              </p>

              <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
                {watchingMovie.title}
              </h2>

              <p className="mt-4 max-w-md text-xs leading-6 text-white/40">
                This title is already part of
                the PMF-Flix catalogue, but
                its video source has not been
                connected yet.
              </p>

              <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-4">
                <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/25">
                  Media connection pending
                </p>

                <p className="mt-2 text-[10px] leading-5 text-white/35">
                  Your future PMF media-storage
                  layer can be connected here
                  without rebuilding the player.
                </p>
              </div>
            </div>
          )}

          <div
            className={`pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${
              showPlayerControls
                ? 'opacity-100'
                : 'opacity-0'
            }`}
          />

          <div
            className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent px-4 pb-5 pt-20 transition-opacity duration-300 sm:px-8 ${
              showPlayerControls
                ? 'opacity-100'
                : 'opacity-0'
            }`}
          >
            <div className="mx-auto max-w-[1400px]">

              <div className="mb-3 flex items-center justify-between">
                <div className="min-w-0 pr-4">
                  <h2 className="truncate text-sm font-black text-white sm:text-lg">
                    {watchingMovie.title}
                  </h2>

                  <p className="mt-1 text-[8px] font-black uppercase tracking-[0.14em] text-white/30">
                    {watchingMovie.year}
                    {' • '}
                    {watchingMovie.type ||
                      'Film'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    closePlayer
                  }
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                  aria-label="Close player"
                >
                  <X size={15} />
                </button>
              </div>

              {hasPlayableVideo &&
                !youtube && (
                  <input
                    type="range"
                    min="0"
                    max={Math.max(
                      1,
                      playerDuration,
                    )}
                    value={Math.min(
                      playerTime,
                      playerDuration ||
                        1,
                    )}
                    onChange={(
                      event,
                    ) => {
                      seek(
                        Number(
                          event.target
                            .value,
                        ),
                      )
                    }}
                    className="mb-4 h-1 w-full cursor-pointer accent-white"
                    style={{
                      background: `linear-gradient(to right, white ${percent}%, rgba(255,255,255,.15) ${percent}%)`,
                    }}
                    aria-label="Playback progress"
                  />
                )}

              <div className="flex items-center justify-between gap-2">

                <div className="flex items-center gap-1 sm:gap-2">

                  {hasPlayableVideo && (
                    <button
                      type="button"
                      onClick={
                        playPause
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black"
                      aria-label={
                        playerPlaying
                          ? 'Pause'
                          : 'Play'
                      }
                    >
                      {playerPlaying ? (
                        <Pause
                          size={14}
                          fill="currentColor"
                        />
                      ) : (
                        <Play
                          size={14}
                          fill="currentColor"
                        />
                      )}
                    </button>
                  )}

                  {hasVideo && (
                    <>
                      <button
                        type="button"
                        onClick={
                          rewind
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
                        aria-label="Rewind 10 seconds"
                      >
                        <SkipBack
                          size={14}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={
                          forward
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
                        aria-label="Forward 10 seconds"
                      >
                        <SkipForward
                          size={14}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={
                          toggleMute
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
                        aria-label={
                          muted
                            ? 'Unmute'
                            : 'Mute'
                        }
                      >
                        {muted ? (
                          <VolumeX
                            size={14}
                          />
                        ) : (
                          <Volume2
                            size={14}
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
                              event.target
                                .value,
                            ),
                          )
                        }
                        className="hidden w-20 accent-white sm:block"
                        aria-label="Volume"
                      />
                    </>
                  )}
                </div>

                <div className="flex items-center gap-1 sm:gap-2">

                  {hasVideo && (
                    <button
                      type="button"
                      onClick={() =>
                        setShowPlayerSettings(
                          (value) =>
                            !value,
                        )
                      }
                      className="flex h-8 items-center gap-1 rounded-lg px-2 text-[8px] font-black uppercase tracking-[0.12em] text-white/45 hover:bg-white/10 hover:text-white"
                    >
                      <Settings
                        size={12}
                      />

                      <span className="hidden sm:inline">
                        Speed
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setTheaterMode(
                        (value) =>
                          !value,
                      )
                    }
                    className="hidden h-8 rounded-lg px-2 text-[8px] font-black uppercase tracking-[0.12em] text-white/45 hover:bg-white/10 hover:text-white sm:block"
                  >
                    Theater
                  </button>

                  <button
                    type="button"
                    onClick={
                      fullscreen
                    }
                    className="flex h-8 items-center rounded-lg px-2 text-[8px] font-black uppercase tracking-[0.12em] text-white/45 hover:bg-white/10 hover:text-white"
                  >
                    Fullscreen
                  </button>
                </div>
              </div>

              {showPlayerSettings &&
                hasVideo && (
                  <div className="mt-3 flex justify-end">
                    <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/80 p-1 backdrop-blur">
                      {[
                        0.75,
                        1,
                        1.25,
                        1.5,
                        2,
                      ].map(
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
                                : 'text-white/45 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {value}x
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const Footer = () => (
    <footer className="border-t border-white/[0.06] bg-black px-5 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">

        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-black">
              <Film size={14} />
            </div>

            <span className="text-sm font-black text-white">
              PMF-FLIX
            </span>
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

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-white selection:text-black">
      <Header />

      <MobileSearchResults />

      {playerMessage &&
        !showProfile && (
          <div className="fixed bottom-5 left-1/2 z-[75] -translate-x-1/2 rounded-full border border-white/10 bg-black/85 px-5 py-3 text-[8px] font-black uppercase tracking-[0.14em] text-white/65 shadow-2xl backdrop-blur-xl">
            {playerMessage}
          </div>
        )}

      {section === 'home' && (
        <>
          <HomeContent />
          <Footer />
        </>
      )}

      {(section === 'movies' ||
        section === 'series') && (
        <CatalogPage
          type={
            section === 'movies'
              ? 'Movie'
              : 'Series'
          }
        />
      )}

      {section === 'my-list' && (
        <MyListPage />
      )}

      {selectedMovie && (
        <MovieDetails
          movie={selectedMovie}
        />
      )}

{showProfile && (
  <ProfilePanel />
)}

{showStudio && (
  <AdminStudio
    onClose={() => setShowStudio(false)}
  />
)}

{watchingMovie && (
  <Player />
)}
    </div>
  )
}

export default function App() {
  return <AppShell />
}  




