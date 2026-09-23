import heroImage from './assets/hero.png'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
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

  const [, setAuthLoading] =
    useState(true)

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
      data: { subscription },
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

  const [section, setSection] =
    useState<Section>('home')

  const [search, setSearch] =
    useState('')

  const [movies, setMovies] =
    useState<Movie[]>([])

  const [loading, setLoading] =
    useState(true)

  const [, setError] =
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

  const [showStudio, setShowStudio] =
    useState(false)

  const [isStudioAdmin, setIsStudioAdmin] =
    useState(false)

  useEffect(() => {
    let active = true

    const checkStudioAccess = async () => {
      if (!session?.user?.id) {
        setIsStudioAdmin(false)
        setShowStudio(false)
        return
      }

      const { data, error } =
        await supabase
          .from('media_admins')
          .select('role')
          .eq(
            'user_id',
            session.user.id,
          )
          .maybeSingle()

      if (!active) {
        return
      }

      const allowed =
        !error &&
        data &&
        [
          'owner',
          'admin',
          'editor',
        ].includes(
          String(data.role),
        )

      setIsStudioAdmin(
        Boolean(allowed),
      )

      if (!allowed) {
        setShowStudio(false)
      }
    }

    void checkStudioAccess()

    return () => {
      active = false
    }
  }, [session])

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

  const [, setTheaterMode] =
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
    const video =
      videoRef.current

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
    const video =
      videoRef.current

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
    showMessage(
      '−10 seconds',
    )
  }

  const forward = () => {
    seek(playerTime + 10)
    showMessage(
      '+10 seconds',
    )
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
      event: globalThis.KeyboardEvent,
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
    const progress =
      getProgressPercent(movie)

    return (
      <button
        type="button"
        onClick={() =>
          setSelectedMovie(movie)
        }
        className={`group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] text-left transition duration-300 hover:-translate-y-1 hover:border-white/[0.16] hover:bg-white/[0.05] ${
          compact
            ? 'w-[150px] shrink-0 sm:w-[175px]'
            : ''
        }`}
      >
        <div className="relative aspect-[2/3] overflow-hidden bg-white/[0.04]">
          {movie.poster_url ? (
            <img
              src={movie.poster_url}
              alt={movie.title}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-white/[0.04]">
              <Film
                size={28}
                className="text-white/20"
              />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/10 opacity-70" />

          {movie.featured && (
            <div className="absolute left-2 top-2 rounded-full border border-white/10 bg-black/60 px-2 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-white backdrop-blur">
              Featured
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 p-3">
            <p className="truncate text-sm font-black text-white">
              {movie.title}
            </p>

            <div className="mt-1 flex items-center gap-2 text-[9px] font-bold text-white/55">
              <span>
                {movie.year}
              </span>

              {movie.category && (
                <>
                  <span>•</span>
                  <span className="truncate">
                    {movie.category}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
            <div
              className="h-full bg-white"
              style={{
                width: `${progress}%`,
              }}
            />
          </div>
        )}
      </button>
    )
  }

  const MovieRow = ({
    title,
    eyebrow,
    movies: rowMovies,
    subtitle,
  }: {
    title: string
    eyebrow?: string
    movies: Movie[]
    subtitle?: string
  }) => {
    if (!rowMovies.length) {
      return null
    }

    return (
      <section className="mb-10">
        <SectionTitle
          eyebrow={eyebrow}
          title={title}
          subtitle={subtitle}
        />

        <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide">
          {rowMovies.map(
            (movie) => (
              <MovieCard
                key={getMovieId(movie)}
                movie={movie}
                compact
              />
            ),
          )}
        </div>
      </section>
    )
  }

  const Hero = () => {
    const heroMovie =
      featuredMovies[0] ||
      movies[0]

    if (!heroMovie) {
      return null
    }

    return (
      <section className="relative min-h-[520px] overflow-hidden rounded-[2rem] border border-white/[0.06] bg-white/[0.025]">
        {heroMovie.backdrop_url ||
        heroMovie.poster_url ? (
          <img
            src={
              heroMovie.backdrop_url ||
              heroMovie.poster_url ||
              ''
            }
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}

        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20" />

        <div className="relative flex min-h-[520px] max-w-2xl items-end px-6 py-10 sm:px-10 sm:py-14">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-[8px] font-black uppercase tracking-[0.2em] text-white/80 backdrop-blur">
                PMF-Flix Original
              </span>

              {heroMovie.year && (
                <span className="text-xs font-bold text-white/50">
                  {heroMovie.year}
                </span>
              )}

              {heroMovie.rating && (
                <span className="text-xs font-bold text-white/50">
                  {heroMovie.rating}
                </span>
              )}
            </div>

            <h1 className="max-w-2xl text-4xl font-black tracking-[-0.05em] text-white sm:text-6xl">
              {heroMovie.title}
            </h1>

            {heroMovie.description && (
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/55 sm:text-base">
                {heroMovie.description}
              </p>
            )}

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  setWatchingMovie(
                    heroMovie,
                  )
                }
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-xs font-black text-black transition hover:scale-[1.02]"
              >
                <Play
                  size={15}
                  fill="currentColor"
                />
                Watch now
              </button>

              <button
                type="button"
                onClick={() =>
                  setSelectedMovie(
                    heroMovie,
                  )
                }
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-5 py-3 text-xs font-black text-white backdrop-blur transition hover:bg-white/10"
              >
                <Info size={15} />
                Details
              </button>
            </div>
          </div>
        </div>
      </section>
    )
  }

  const HomeContent = () => (
    <div className="space-y-10">
      <Hero />

      {continueMovies.length > 0 && (
        <MovieRow
          eyebrow="Keep watching"
          title="Continue Watching"
          subtitle="Pick up exactly where you left off."
          movies={continueMovies}
        />
      )}

      <MovieRow
        eyebrow="Discover"
        title="Trending Now"
        movies={trendingMovies}
      />

      <MovieRow
        eyebrow="Fresh on PMF"
        title="Latest Releases"
        movies={latestMovies}
      />

      {personalizedMovies.length > 0 && (
        <MovieRow
          eyebrow="For you"
          title="Made For Your Journey"
          subtitle="A selection shaped by what you've been watching."
          movies={personalizedMovies}
        />
      )}

      {categoryRows.map(
        (row) => (
          <MovieRow
            key={row.category}
            title={row.category}
            movies={row.items}
          />
        ),
      )}
    </div>
  )

  const CatalogContent = () => (
    <div>
      <SectionTitle
        eyebrow="Explore"
        title={
          section === 'series'
            ? 'TV Series'
            : 'Movies'
        }
        subtitle={`${filteredMovies.length} title${
          filteredMovies.length === 1
            ? ''
            : 's'
        } available`}
      />

      <div className="mb-7 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search titles, genres, years..."
              className="h-10 w-full rounded-xl border border-white/[0.07] bg-black/20 pl-9 pr-9 text-xs text-white outline-none placeholder:text-white/20 focus:border-white/20"
            />

            {search && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <select
            value={filters.category}
            onChange={(event) =>
              updateFilter(
                'category',
                event.target.value,
              )
            }
            className="h-10 rounded-xl border border-white/[0.07] bg-black/30 px-3 text-xs text-white outline-none"
          >
            {categories.map(
              (category) => (
                <option
                  key={category}
                  value={category}
                >
                  {category}
                </option>
              ),
            )}
          </select>

          <select
            value={filters.type}
            onChange={(event) =>
              updateFilter(
                'type',
                event.target.value,
              )
            }
            className="h-10 rounded-xl border border-white/[0.07] bg-black/30 px-3 text-xs text-white outline-none"
          >
            {typeOptions.map(
              (type) => (
                <option
                  key={type}
                  value={type}
                >
                  {type}
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
            className="h-10 rounded-xl border border-white/[0.07] bg-black/30 px-3 text-xs text-white outline-none"
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
            value={filters.rating}
            onChange={(event) =>
              updateFilter(
                'rating',
                event.target.value,
              )
            }
            className="h-10 rounded-xl border border-white/[0.07] bg-black/30 px-3 text-xs text-white outline-none"
          >
            <option value="0">
              Any rating
            </option>
            <option value="5">
              5+
            </option>
            <option value="6">
              6+
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

          <select
            value={filters.sort}
            onChange={(event) =>
              updateFilter(
                'sort',
                event.target.value,
              )
            }
            className="h-10 rounded-xl border border-white/[0.07] bg-black/30 px-3 text-xs text-white outline-none"
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

          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.07] px-4 text-xs font-bold text-white/55 transition hover:bg-white/[0.06] hover:text-white"
          >
            <RotateCcw size={13} />
            Reset
          </button>
        </div>
      </div>

      {filteredMovies.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filteredMovies.map(
            (movie) => (
              <MovieCard
                key={getMovieId(movie)}
                movie={movie}
              />
            ),
          )}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-white/[0.08] px-6 py-16 text-center">
          <Search
            size={30}
            className="mx-auto text-white/15"
          />

          <h3 className="mt-4 text-lg font-black text-white">
            No titles found
          </h3>

          <p className="mt-2 text-xs text-white/30">
            Try another search or clear your filters.
          </p>

          <button
            type="button"
            onClick={() => {
              clearSearch()
              resetFilters()
            }}
            className="mt-5 rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-white/70 hover:bg-white/10"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  )

  const MyListPage = () => (
    <div>
      <SectionTitle
        eyebrow="Your collection"
        title="My List"
        subtitle="Titles you've saved for later."
      />

      {myListMovies.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {myListMovies.map(
            (movie) => (
              <MovieCard
                key={getMovieId(movie)}
                movie={movie}
              />
            ),
          )}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-white/[0.08] px-6 py-16 text-center">
          <Heart
            size={30}
            className="mx-auto text-white/15"
          />

          <h3 className="mt-4 text-lg font-black text-white">
            Your list is empty
          </h3>

          <p className="mt-2 text-xs text-white/30">
            Save titles from their details page and they'll appear here.
          </p>
        </div>
      )}
    </div>
  )

  const HistoryPage = () => (
    <div>
      <SectionTitle
        eyebrow="Your activity"
        title="Watch History"
        subtitle="Recently watched titles."
      />

      {historyMovies.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {historyMovies.map(
            (movie) => (
              <MovieCard
                key={getMovieId(movie)}
                movie={movie}
              />
            ),
          )}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-white/[0.08] px-6 py-16 text-center">
          <Clock3
            size={30}
            className="mx-auto text-white/15"
          />

          <h3 className="mt-4 text-lg font-black text-white">
            No watch history yet
          </h3>

          <p className="mt-2 text-xs text-white/30">
            Movies and series you watch will appear here.
          </p>
        </div>
      )}
    </div>
  )

  const ProfilePanel = () => (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-white/[0.08] bg-[#101010] p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/25">
              Account
            </p>

            <h2 className="mt-1 text-xl font-black text-white">
              Your Profile
            </h2>
          </div>

          <button
            type="button"
            onClick={() =>
              setShowProfile(false)
            }
            className="rounded-full p-2 text-white/40 hover:bg-white/10 hover:text-white"
            aria-label="Close profile"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6">
          <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">
            Display name
          </label>

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
            className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/20"
            placeholder="Your name"
          />
        </div>

        <div className="mt-5">
          <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">
            Avatar
          </label>

          <div className="mt-2 flex gap-2">
            {[
              '🎬',
              '🍿',
              '🎥',
              '🌍',
              '⭐',
              '🔥',
            ].map(
              (avatar) => (
                <button
                  type="button"
                  key={avatar}
                  onClick={() =>
                    setProfile(
                      (current) => ({
                        ...current,
                        avatar,
                      }),
                    )
                  }
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border text-lg ${
                    profile.avatar === avatar
                      ? 'border-white/30 bg-white/10'
                      : 'border-white/[0.06] bg-white/[0.03]'
                  }`}
                >
                  {avatar}
                </button>
              ),
            )}
          </div>
        </div>

        <div className="mt-7 flex gap-3">
          <button
            type="button"
            onClick={() =>
              setShowProfile(false)
            }
            className="flex-1 rounded-xl border border-white/10 py-3 text-xs font-bold text-white/60 hover:bg-white/5"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={saveProfile}
            className="flex-1 rounded-xl bg-white py-3 text-xs font-black text-black hover:bg-white/90"
          >
            Save profile
          </button>
        </div>

        <button
          type="button"
          onClick={signOut}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/10 py-3 text-xs font-bold text-red-300/70 hover:bg-red-500/10"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </div>
  )

  const MovieDetails = () => {
    if (!selectedMovie) {
      return null
    }

    const inList =
      myList.includes(
        getMovieId(selectedMovie),
      )

    return (
      <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/90 backdrop-blur-md">
        <div className="mx-auto min-h-screen w-full max-w-5xl">
          <div className="relative min-h-[75vh] overflow-hidden">
            {selectedMovie.backdrop_url ||
            selectedMovie.poster_url ? (
              <img
                src={
                  selectedMovie.backdrop_url ||
                  selectedMovie.poster_url ||
                  ''
                }
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-50"
              />
            ) : null}

            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/10" />

            <div className="relative flex min-h-[75vh] items-end px-5 py-8 sm:px-10 sm:py-12">
              <div className="max-w-2xl">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedMovie(
                      null,
                    )
                  }
                  className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-xs font-bold text-white/60 backdrop-blur hover:bg-white/10 hover:text-white"
                >
                  <ArrowLeft
                    size={14}
                  />
                  Back
                </button>

                <div className="flex flex-wrap items-center gap-2">
                  {selectedMovie.year && (
                    <span className="text-xs font-bold text-white/50">
                      {selectedMovie.year}
                    </span>
                  )}

                  {selectedMovie.type && (
                    <>
                      <span className="text-white/20">
                        •
                      </span>
                      <span className="text-xs font-bold text-white/50">
                        {selectedMovie.type}
                      </span>
                    </>
                  )}

                  {selectedMovie.category && (
                    <>
                      <span className="text-white/20">
                        •
                      </span>
                      <span className="text-xs font-bold text-white/50">
                        {selectedMovie.category}
                      </span>
                    </>
                  )}
                </div>

                <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-white sm:text-6xl">
                  {selectedMovie.title}
                </h1>

                {selectedMovie.description && (
                  <p className="mt-4 text-sm leading-6 text-white/55 sm:text-base">
                    {selectedMovie.description}
                  </p>
                )}

                <div className="mt-7 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMovie(
                        null,
                      )
                      setWatchingMovie(
                        selectedMovie,
                      )
                    }}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-xs font-black text-black"
                  >
                    <Play
                      size={15}
                      fill="currentColor"
                    />
                    Watch now
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      toggleMyList(
                        selectedMovie,
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-xs font-bold text-white"
                  >
                    <Heart
                      size={15}
                      fill={
                        inList
                          ? 'currentColor'
                          : 'none'
                      }
                    />
                    {inList
                      ? 'In My List'
                      : 'Add to My List'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  
