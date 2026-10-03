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
  ListPlus,
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

const formatPlayerTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '00:00'
  }

  const totalSeconds =
    Math.floor(seconds)

  const hours =
    Math.floor(totalSeconds / 3600)

  const minutes =
    Math.floor(
      (totalSeconds % 3600) / 60,
    )

  const remainingSeconds =
    totalSeconds % 60

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
  }

  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
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

    // Never allow an older getSession() result
    // to overwrite a newer authentication event.
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
        setSession(nextSession)
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
        ['owner', 'admin', 'editor'].includes(
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

  const [section, setSection] =
    useState<Section>('home')

  const [search, setSearch] =
    useState('')

  const [movies, setMovies] =
    useState<Movie[]>([])

  const [, setError] =
    useState<string | null>(null)

  const [, setLoading] =
  useState(true)

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

  const [audioBoost, setAudioBoost] =
  useState(1)

  useEffect(() => {
  if (audioGainRef.current) {
    audioGainRef.current.gain.value =
      audioBoost
  }
}, [audioBoost])

  const [speed, setSpeed] =
    useState(1)

  const [showPlayerSettings, setShowPlayerSettings] =
    useState(false)

const [showAudioHub, setShowAudioHub] =
  useState(false)

  const [showUpNext, setShowUpNext] =
  useState(false)

const [upNextCountdown, setUpNextCountdown] =
  useState(8)

const autoNextRef =
  useRef(false)

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

  const audioContextRef =
  useRef<AudioContext | null>(null)

const audioSourceRef =
  useRef<MediaElementAudioSourceNode | null>(null)

const audioGainRef =
  useRef<GainNode | null>(null)

const audioElementRef =
  useRef<HTMLVideoElement | null>(null)

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
  setPlayerPlaying(false)

  addToHistory(movie)
  addToContinueWatching(movie)
}
  
const ensureAudioGraph = async () => {
  const video = videoRef.current

  if (!video) return

  try {
    video.volume = volume
    video.muted = muted

    if (
      audioElementRef.current === video &&
      audioContextRef.current &&
      audioGainRef.current
    ) {
      if (
        audioContextRef.current.state ===
        'suspended'
      ) {
        await audioContextRef.current.resume()
      }

      audioGainRef.current.gain.value =
        audioBoost

      return
    }

    const AudioContextClass =
      window.AudioContext ||
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext
        }
      ).webkitAudioContext

    if (!AudioContextClass) return

    const audioContext =
      new AudioContextClass()

    const source =
      audioContext.createMediaElementSource(
        video,
      )

    const gain =
      audioContext.createGain()

    gain.gain.value = audioBoost

    source.connect(gain)
    gain.connect(
      audioContext.destination,
    )

    audioContextRef.current =
      audioContext

    audioSourceRef.current = source
    audioGainRef.current = gain
    audioElementRef.current = video

    if (
      audioContext.state ===
      'suspended'
    ) {
      await audioContext.resume()
    }

    video.volume = volume
    video.muted = muted
  } catch (error) {
    console.warn(
      'PMF audio booster unavailable:',
      error,
    )
  }
}
  
  const lockPlayerOrientation = async () => {
  try {
    const orientation =
      screen.orientation as ScreenOrientation & {
        lock?: (
          orientation:
            | 'any'
            | 'natural'
            | 'landscape'
            | 'portrait'
            | 'portrait-primary'
            | 'portrait-secondary'
            | 'landscape-primary'
            | 'landscape-secondary',
        ) => Promise<void>
        unlock?: () => void
      }

    if (orientation.lock) {
      await orientation.lock('landscape')
    }
  } catch {
    // Some mobile browsers do not allow programmatic orientation locking.
  }
}

const unlockPlayerOrientation = () => {
  try {
    const orientation =
      screen.orientation as ScreenOrientation & {
        unlock?: () => void
      }

    orientation.unlock?.()
  } catch {
    // Orientation unlock is best-effort.
  }
}

const closePlayer = async () => {
  if (watchingMovie) {
    saveProgress(
      watchingMovie,
      playerTime,
      playerDuration,
    )
  }

  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen()
    } catch {
      // Fullscreen may already have been exited by the browser.
    }
  }

  unlockPlayerOrientation()

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
  await ensureAudioGraph()
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

  const changeAudioBoost = (
  value: number,
) => {
  const next = Math.max(
    1,
    Math.min(3, value),
  )

  setAudioBoost(next)

  if (audioGainRef.current) {
    audioGainRef.current.gain.value =
      next
  }

  showMessage(
    `${Math.round(next * 100)}% audio boost`,
  )
}

  const fullscreen = async () => {
  try {
    if (!document.fullscreenElement) {
      await playerRef.current?.requestFullscreen()
      await lockPlayerOrientation()
    } else {
      await document.exitFullscreen()
      unlockPlayerOrientation()
    }
  } catch {
    unlockPlayerOrientation()

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
    
const playNextMovie = (
  movie: Movie,
) => {
  setShowUpNext(false)
  setUpNextCountdown(8)

  autoNextRef.current = true

  setSelectedMovie(null)
  setWatchingMovie(movie)
  setPlayerTime(0)
  setPlayerDuration(0)
  setPlayerPlaying(false)

  addToHistory(movie)
  addToContinueWatching(movie)
}

useEffect(() => {
  if (!showUpNext) {
    return
  }

  const nextMovie = getNextMovie()

  if (!nextMovie) {
    return
  }

  if (upNextCountdown <= 0) {
    playNextMovie(nextMovie)
    return
  }

  const timer = window.setTimeout(() => {
    setUpNextCountdown(
      (current) =>
        Math.max(
          0,
          current - 1,
        ),
    )
  }, 1000)

  return () => {
    window.clearTimeout(timer)
  }
}, [
  showUpNext,
  upNextCountdown,
  watchingMovie,
  movies,
])
  
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
}: {
  movie: Movie
  compact?: boolean
}) => {
  const progressPercent =
    getProgressPercent(movie)

  const saved = isInMyList(movie)

  return (
    <article
      className={`group/card relative shrink-0 ${
        compact
          ? 'w-[145px] sm:w-[175px]'
          : 'w-[165px] sm:w-[205px] lg:w-[225px]'
      }`}
    >
      <div className="relative overflow-hidden rounded-[22px] border border-purple-300/[0.08] bg-[#080611] shadow-[0_18px_55px_rgba(0,0,0,0.32)] transition-all duration-500 ease-out group-hover/card:-translate-y-2 group-hover/card:border-purple-300/20 group-hover/card:shadow-[0_24px_70px_rgba(0,0,0,0.48),0_0_38px_rgba(168,85,247,0.10)]">

        {/* Poster */}
        <button
          type="button"
          onClick={() =>
            openMovie(movie)
          }
          className="block w-full text-left"
        >
          <div className="relative aspect-[2/3] overflow-hidden bg-[#05040b]">

            <img
              src={getMoviePoster(movie)}
              alt={movie.title}
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover/card:scale-[1.07]"
              loading="lazy"
            />

            {/* Cinematic colour treatment */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#030208] via-transparent to-transparent opacity-95" />

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(168,85,247,0.18),transparent_35%)] opacity-0 transition-opacity duration-500 group-hover/card:opacity-100" />

            {/* Subtle poster sheen */}
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.07] to-transparent transition-transform duration-1000 group-hover/card:translate-x-full" />

            {/* PMF label */}
            <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-purple-300/15 bg-black/55 px-2.5 py-1.5 backdrop-blur-xl">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.9)]" />

              <span className="text-[6px] font-black uppercase tracking-[0.2em] text-white/60">
                PMF
              </span>
            </div>

            {/* Featured marker */}
            {movie.featured && (
              <div className="absolute right-3 top-3 rounded-full border border-[#d8b36a]/20 bg-[#080611]/75 px-2.5 py-1.5 backdrop-blur-xl">
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
          <div className="relative px-3.5 pb-4 pt-3.5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="min-w-0 truncate text-[12px] font-black tracking-[-0.02em] text-white transition-colors duration-300 group-hover/card:text-purple-200">
                {movie.title}
              </h3>
            </div>

            <div className="mt-2 flex items-center gap-2 overflow-hidden">
              <span className="shrink-0 text-[7px] font-black uppercase tracking-[0.14em] text-purple-300/65">
                {movie.year}
              </span>

              <span className="h-0.5 w-0.5 shrink-0 rounded-full bg-white/20" />

              <span className="truncate text-[7px] font-bold uppercase tracking-[0.12em] text-white/30">
                {movie.type || 'Film'}
              </span>

              {movie.category && (
                <>
                  <span className="h-0.5 w-0.5 shrink-0 rounded-full bg-white/15" />

                  <span className="truncate text-[7px] font-bold uppercase tracking-[0.1em] text-white/25">
                    {movie.category}
                  </span>
                </>
              )}
            </div>
          </div>
        </button>

        {/* My List */}
        <button
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
        </button>
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
            <section className="mb-10 rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="block">
                  <span className="mb-2 block text-[8px] font-black uppercase tracking-[0.16em] text-white/30">
                    Category
                  </span>

                  <select
                    value={
                      filters.category
                    }
                    onChange={(
                      event,
                    ) =>
                      setFilters(
                        (current) => ({
                          ...current,
                          category:
                            event.target
                              .value,
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
                          .filter(
                            Boolean,
                          )
                          .map(String),
                      ),
                    ).map(
                      (category) => (
                        <option
                          key={
                            category
                          }
                          value={
                            category
                          }
                        >
                          {category}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-[8px] font-black uppercase tracking-[0.16em] text-white/30">
                    Year
                  </span>

                  <select
                    value={
                      filters.year
                    }
                    onChange={(
                      event,
                    ) =>
                      setFilters(
                        (current) => ({
                          ...current,
                          year:
                            event.target
                              .value,
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
                          .filter(
                            Boolean,
                          ),
                      ),
                    )
                      .sort(
                        (a, b) =>
                          Number(b) -
                          Number(a),
                      )
                      .map(
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
                </label>

                <label className="block">
                  <span className="mb-2 block text-[8px] font-black uppercase tracking-[0.16em] text-white/30">
                    Rating
                  </span>

                  <select
                    value={
                      filters.rating
                    }
                    onChange={(
                      event,
                    ) =>
                      setFilters(
                        (current) => ({
                          ...current,
                          rating:
                            event.target
                              .value,
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
                    value={
                      filters.sort
                    }
                    onChange={(
                      event,
                    ) =>
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
                onClick={
                  resetFilters
                }
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
    const savedMovies =
      myList
        .map((id) =>
          findMovie(id),
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
      <section className="relative min-h-[88vh] overflow-hidden bg-[#030208]">
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600/10 blur-[180px]"
        />

        <div className="relative mx-auto flex min-h-[88vh] max-w-[1600px] items-center px-5 pt-28 sm:px-10 lg:px-16">
          <div className="max-w-4xl">
            <div className="mb-7 flex items-center gap-3">
              <span className="h-px w-12 bg-gradient-to-r from-purple-400 to-transparent" />

              <p className="text-[8px] font-black uppercase tracking-[0.4em] text-purple-300/70">
                Prince Mufasa Flix
              </p>
            </div>

            <h1 className="text-6xl font-black leading-[0.82] tracking-[-0.075em] text-white sm:text-8xl lg:text-[112px]">
              Your world.
              <br />
              <span className="bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
                Your stories.
              </span>
              <br />
              <span className="text-white/80">
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
    <section className="group/hero relative min-h-[92vh] overflow-hidden bg-[#030208]">

      {/* =====================================================
          DEEP CINEMATIC ATMOSPHERE
          ===================================================== */}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-[15%] top-[20%] h-[650px] w-[650px] rounded-full bg-purple-700/[0.12] blur-[180px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[-12%] top-[5%] h-[600px] w-[600px] rounded-full bg-cyan-400/[0.035] blur-[190px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-25%] left-[35%] h-[500px] w-[500px] rounded-full bg-purple-500/[0.08] blur-[170px]"
      />

      {/* =====================================================
          HERO ARTWORK
          ===================================================== */}

      <div className="absolute inset-0 overflow-hidden">

        <img
          src={
            featured.poster ||
            heroImage
          }
          alt=""
          className="h-full w-full scale-[1.035] object-cover object-center opacity-[0.68] transition-transform duration-[4000ms] ease-out group-hover/hero:scale-[1.065]"
        />

        {/* Purple cinematic light */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_72%_38%,rgba(168,85,247,0.22),transparent_32%)]"
        />

        {/* Cyan atmospheric light */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_85%_18%,rgba(103,232,249,0.07),transparent_25%)]"
        />

        {/* Left cinematic darkness */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#030208] via-[#030208]/85 via-[48%] to-transparent" />

        {/* Bottom cinematic fade */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#030208] via-[#030208]/35 via-[45%] to-transparent" />

        {/* Top protection for navigation */}
        <div className="absolute inset-x-0 top-0 h-[34%] bg-gradient-to-b from-[#030208]/80 to-transparent" />

        {/* Edge vignette */}
        <div className="absolute inset-0 shadow-[inset_0_0_180px_rgba(0,0,0,0.72)]" />

        {/* Cinematic glass haze */}
        <div className="absolute inset-0 bg-white/[0.008] backdrop-blur-[0.2px]" />
      </div>

      {/* =====================================================
          CINEMATIC CONTENT
          ===================================================== */}

      <div className="relative mx-auto flex min-h-[92vh] max-w-[1600px] items-end px-5 pb-20 pt-32 sm:px-10 sm:pb-24 lg:px-16 lg:pb-28">

        <div className="w-full max-w-4xl">

          {/* PMF SIGNATURE */}
          <div className="mb-7 flex items-center gap-3">

            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-purple-300/20 bg-purple-500/10 text-purple-300 shadow-[0_0_35px_rgba(168,85,247,0.18)] backdrop-blur-xl">

              <div
                aria-hidden="true"
                className="absolute inset-0 rounded-xl bg-purple-400/10 blur-md"
              />

              <Sparkles
                size={14}
                className="relative"
              />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-black uppercase tracking-[0.35em] text-purple-300">
                  PMF Signature
                </span>

                <span className="h-1 w-1 rounded-full bg-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.9)]" />
              </div>

              <p className="mt-1 text-[7px] font-bold uppercase tracking-[0.22em] text-white/30">
                A cinematic experience
              </p>
            </div>
          </div>

          {/* =================================================
              TITLE
              ================================================= */}

          <h1 className="max-w-5xl text-5xl font-black leading-[0.86] tracking-[-0.075em] text-white sm:text-7xl md:text-8xl lg:text-[96px]">

            {featured.title}

          </h1>

          {/* =================================================
              METADATA
              ================================================= */}

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

                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/45">
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

          {/* =================================================
              DESCRIPTION
              ================================================= */}

          <p className="mt-6 max-w-2xl text-sm leading-7 text-white/50 sm:text-[15px] sm:leading-7">
            {featured.description ||
              'Discover remarkable stories, unforgettable characters and cinematic worlds on PMF-Flix.'}
          </p>

          {/* =================================================
              ACTIONS
              ================================================= */}

          <div className="mt-9 flex flex-wrap items-center gap-3">

            {/* ENTER EXPERIENCE */}

            <button
              type="button"
              onClick={() =>
                startWatching(
                  featured,
                )
              }
              className="group/enter relative inline-flex items-center gap-3 overflow-hidden rounded-2xl border border-purple-300/30 bg-gradient-to-r from-purple-600 to-purple-500 px-6 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-white shadow-[0_14px_55px_rgba(168,85,247,0.28)] transition-all duration-300 hover:-translate-y-1 hover:from-purple-500 hover:to-purple-400 hover:shadow-[0_18px_65px_rgba(168,85,247,0.42)] active:scale-[0.97]"
            >

              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover/enter:translate-x-full" />

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

            {/* EXPLORE */}

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

          {/* =================================================
              SIGNATURE FOOTER
              ================================================= */}

          <div className="mt-10 flex items-center gap-3">

            <div className="relative h-px w-16 overflow-hidden bg-white/10">

              <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-purple-400 to-transparent" />

            </div>

            <p className="text-[7px] font-black uppercase tracking-[0.32em] text-white/25">
              Your World. Your Stories. Your Flix.
            </p>

          </div>

        </div>
      </div>

      {/* =====================================================
          CINEMATIC CORNER DETAILS
          ===================================================== */}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-8 right-6 hidden items-center gap-3 text-[7px] font-black uppercase tracking-[0.3em] text-white/20 sm:flex lg:right-12"
      >
        <span className="h-px w-8 bg-white/10" />
        <span>PMF / CINEMATIC UNIVERSE</span>
      </div>

    </section>
  )
 }

  const Header = () => (
  <header className="fixed left-0 right-0 top-0 z-50">
    <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-purple-500/[0.06] to-transparent pointer-events-none" />

    <div className="relative border-b border-purple-300/[0.08] bg-[#05040b]/80 shadow-[0_12px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
      <div className="mx-auto flex h-[72px] max-w-[1600px] items-center gap-4 px-4 sm:px-8 lg:px-12">
        
        {/* PMF BRAND */}
        <button
          type="button"
          onClick={() =>
            navigate('home')
          }
          className="group flex shrink-0 items-center gap-3"
          aria-label="PMF-Flix home"
        >
          <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-purple-300/25 bg-gradient-to-br from-purple-500 to-purple-800 text-white shadow-[0_0_30px_rgba(168,85,247,0.18)] transition duration-300 group-hover:shadow-[0_0_40px_rgba(168,85,247,0.35)]">
            <div className="absolute inset-0 bg-white/10 opacity-0 transition group-hover:opacity-100" />

            <Film
              size={17}
              className="relative"
            />
          </div>

          <div className="hidden sm:block">
            <div className="text-[15px] font-black tracking-[-0.04em] text-white">
              PMF
              <span className="text-purple-300">
                -FLIX
              </span>
            </div>

            <div className="mt-0.5 text-[6px] font-black uppercase tracking-[0.28em] text-white/25">
              Prince Mufasa Flix
            </div>
          </div>
        </button>

        {/* DESKTOP NAVIGATION */}
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
                className={`group relative rounded-xl px-4 py-2.5 text-[8px] font-black uppercase tracking-[0.17em] transition-all ${
                  section === key
                    ? 'text-white'
                    : 'text-white/35 hover:text-white'
                }`}
              >
                {label}

                <span
                  className={`absolute bottom-0 left-1/2 h-px -translate-x-1/2 bg-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.7)] transition-all ${
                    section === key
                      ? 'w-7'
                      : 'w-0 group-hover:w-4'
                  }`}
                />
              </button>
            ),
          )}
        </nav>

        {/* RIGHT SIDE */}
        <div className="ml-auto flex min-w-0 items-center gap-2">
          {/* SEARCH */}
          <div className="hidden w-[240px] items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 transition-all focus-within:border-purple-300/25 focus-within:bg-purple-500/[0.04] sm:flex">
            <Search
              size={14}
              className="shrink-0 text-purple-300/40"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search the PMF universe"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-xs text-white outline-none placeholder:text-white/20"
            />

            {search && (
              <button
                type="button"
                onClick={clearSearch}
                className="text-white/25 transition hover:text-purple-300"
              >
                <X size={12} />
              </button>
            )}
          </div>

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
          </button>

          {/* STUDIO */}
          {isStudioAdmin && (
            <button
              type="button"
              onClick={() =>
                setShowStudio(true)
              }
              className="hidden h-10 items-center gap-2 rounded-xl border border-[#d8b36a]/20 bg-[#d8b36a]/[0.05] px-3 text-[8px] font-black uppercase tracking-[0.14em] text-[#d8b36a]/65 transition hover:border-[#d8b36a]/35 hover:bg-[#d8b36a]/[0.09] hover:text-[#d8b36a] lg:flex"
              aria-label="Open PMF Studio"
            >
              <Sparkles size={12} />
              Studio
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

          {isStudioAdmin && (
            <button
              type="button"
              onClick={() => {
                setShowStudio(true)
                setMobileMenu(false)
              }}
              className="mt-2 w-full rounded-xl border border-[#d8b36a]/20 bg-[#d8b36a]/[0.04] px-4 py-3.5 text-left text-[8px] font-black uppercase tracking-[0.16em] text-[#d8b36a]/60 transition hover:bg-[#d8b36a]/[0.08] hover:text-[#d8b36a]"
            >
              <span className="inline-flex items-center gap-2">
                <Sparkles size={12} />
                PMF Studio
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  </header>
)


    const HomeContent = () => (
    <>
      <Hero />

      <main className="relative mx-auto max-w-[1600px] overflow-hidden px-5 pb-24 sm:px-10 lg:px-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-white/[0.025] blur-[140px]"
        />

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

        {personalizedMovies.length > 0 && (
          <section className="relative">
            <MovieRow
              eyebrow="Made for your journey"
              title="Made For You"
              subtitle="Recommendations shaped by your viewing journey."
              items={personalizedMovies}
            />

const HomeContent = () => (
  <>
    <Hero />

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
          CONTINUE WATCHING
          ===================================================== */}

      {continueMovies.length > 0 && (
        <section className="relative pt-14 sm:pt-20">
          <MovieRow
            eyebrow="Pick up where you left off"
            title="Continue Watching"
            subtitle="Your unfinished stories, ready when you are."
            items={continueMovies}
          />
        </section>
      )}

      {/* =====================================================
          FEATURED
          ===================================================== */}

      {featuredMovies.length > 1 && (
        <section className="relative">
          <MovieRow
            eyebrow="The PMF selection"
            title="Featured"
            subtitle="Stories selected for the PMF cinematic experience."
            items={featuredMovies}
          />
        </section>
      )}

      {/* =====================================================
          TRENDING
          ===================================================== */}

      {trendingMovies.length > 0 && (
        <section className="relative">
          <MovieRow
            eyebrow="What's moving"
            title="Trending Now"
            subtitle="The titles creating the most excitement across PMF-Flix."
            items={trendingMovies}
          />
        </section>
      )}

      {/* =====================================================
          PERSONALIZED
          ===================================================== */}

      {personalizedMovies.length > 0 && (
        <section className="relative">
          <MovieRow
            eyebrow="Made for your journey"
            title="Made For You"
            subtitle="Recommendations shaped by the stories you've explored."
            items={personalizedMovies}
          />
        </section>
      )}

      {/* =====================================================
          NEW & NOTEWORTHY
          ===================================================== */}

      {latestMovies.length > 0 && (
        <section className="relative">
          <MovieRow
            eyebrow="Fresh from the catalogue"
            title="New & Noteworthy"
            subtitle="Fresh stories waiting to become your next obsession."
            items={latestMovies}
          />
        </section>
      )}

      {/* =====================================================
          CATEGORY UNIVERSE
          ===================================================== */}

      {categoryRows.length > 0 && (
        <section className="relative">
          {categoryRows.map((row) => (
            <MovieRow
              key={row.category}
              eyebrow="Explore the universe"
              title={row.category}
              subtitle={`Discover ${row.category.toLowerCase()} stories on PMF-Flix.`}
              items={row.items}
            />
          ))}
        </section>
      )}

      {/* =====================================================
          RECENTLY WATCHED
          ===================================================== */}

      {historyMovies.length > 0 && (
        <section className="relative">
          <MovieRow
            eyebrow="Your activity"
            title="Recently Watched"
            subtitle="Your latest journey through the PMF universe."
            items={historyMovies.slice(0, 10)}
          />
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
      movies
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

  const renderPlayer = () => {
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

    const nextMovie = getNextMovie()
    
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
  crossOrigin="anonymous"
  src={videoUrl}
              poster={
                watchingMovie.poster ||
                heroImage
              }
              className="max-h-full max-w-full object-contain"
              playsInline
              preload="auto"
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
                  saved.currentTime > 0 &&
                  saved.currentTime <
                    safeDuration - 5
                ) {
                  event.currentTarget.currentTime =
                    saved.currentTime

                  setPlayerTime(
                    saved.currentTime,
                  )
                }

                event.currentTarget.muted =
                  muted

                event.currentTarget.playbackRate =
                  speed

              if (autoNextRef.current) {
  autoNextRef.current = false

  void ensureAudioGraph()
    .then(async () => {
      try {
        await event.currentTarget.play()
      } catch (error) {
        console.warn(
          'PMF auto-next playback could not start:',
          error,
        )

        setPlayerPlaying(false)
        setShowPlayerControls(true)

        showMessage(
          'Tap Play to continue.',
        )
      }
    })
              }
                
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

  setPlayerPlaying(false)
  setPlayerTime(0)
  setShowPlayerControls(true)

  if (nextMovie) {
    setUpNextCountdown(8)
    setShowUpNext(true)
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

            {showUpNext &&
  nextMovie && (
    <div className="absolute inset-x-0 bottom-28 z-20 flex justify-center px-4 sm:bottom-32">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-black/90 shadow-2xl backdrop-blur-2xl">
        <div className="relative h-36 overflow-hidden sm:h-44">
          <img
            src={
              nextMovie.poster ||
              heroImage
            }
            alt={nextMovie.title}
            className="h-full w-full object-cover opacity-70"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

          <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 backdrop-blur-md">
            <span className="text-[8px] font-black uppercase tracking-[0.18em] text-white/70">
              Up Next
            </span>
          </div>

          <div className="absolute bottom-4 left-4 right-4">
            <p className="text-[8px] font-black uppercase tracking-[0.16em] text-white/40">
              Playing next
            </p>

            <h3 className="mt-1 truncate text-lg font-black tracking-tight text-white sm:text-xl">
              {nextMovie.title}
            </h3>
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-medium text-white/40">
                Starting automatically in
              </p>

              <p className="mt-1 text-xl font-black tabular-nums text-white">
                {upNextCountdown}s
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowUpNext(false)
                  setUpNextCountdown(8)
                }}
                className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.12em] text-white/55 transition-all hover:bg-white/10 hover:text-white active:scale-95"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() =>
                  playNextMovie(
                    nextMovie,
                  )
                }
                className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.12em] text-black transition-all hover:bg-white/90 active:scale-95"
              >
                <Play
                  size={12}
                  fill="currentColor"
                />

                Play Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )}
                
              </div>

              {hasPlayableVideo &&
  !youtube && (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between px-0.5">
        <span className="text-[9px] font-semibold tabular-nums text-white/60">
          {formatPlayerTime(playerTime)}
        </span>

        <span className="text-[9px] font-semibold tabular-nums text-white/35">
          {formatPlayerTime(playerDuration)}
        </span>
      </div>

      <input
        type="range"
        min="0"
        max={Math.max(
          1,
          playerDuration,
        )}
        value={Math.min(
          playerTime,
          playerDuration || 1,
        )}
        onChange={(
          event,
        ) => {
          seek(
            Number(
              event.target.value,
            ),
          )
        }}
        className="h-1 w-full cursor-pointer accent-white"
        style={{
          background: `linear-gradient(to right, white ${percent}%, rgba(255,255,255,.15) ${percent}%)`,
        }}
        aria-label="Playback progress"
      />
    </div>
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

                      <div className="group relative">
  <button
    type="button"
    onClick={() =>
      setShowAudioHub(
        (current) => !current,
      )
    }
    className="relative flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-2 text-white/75 backdrop-blur-md transition-all duration-200 hover:border-white/20 hover:bg-white/10 hover:text-white active:scale-95"
    aria-label="Open audio controls"
    aria-expanded={showAudioHub}
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

    <span className="hidden text-[9px] font-bold tabular-nums tracking-wide sm:inline">
      {Math.round(
        audioBoost * 100,
      )}%
    </span>
  </button>

  <div
    className={`absolute bottom-full left-1/2 mb-3 w-56 -translate-x-1/2 rounded-2xl border border-white/10 bg-black/85 p-3 shadow-2xl backdrop-blur-xl transition-all duration-200 ${
      showAudioHub
        ? 'pointer-events-auto translate-y-0 opacity-100'
        : 'pointer-events-none translate-y-2 opacity-0'
    } group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100`}
    onClick={(event) =>
      event.stopPropagation()
    }
  >
    <div className="mb-3 flex items-center justify-between">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/80">
          PMF Audio
        </p>

        <p className="mt-0.5 text-[9px] text-white/40">
          Volume & boost
        </p>
      </div>

      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-bold tabular-nums text-white/70">
        {Math.round(
          audioBoost * 100,
        )}%
      </span>
    </div>

    <div className="mb-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[9px] font-medium text-white/45">
          Volume
        </span>

        <span className="text-[9px] font-semibold tabular-nums text-white/60">
          {muted
            ? 0
            : Math.round(
                volume * 100,
              )}%
        </span>
      </div>

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
              event.target.value,
            ),
          )
        }
        className="h-1 w-full cursor-pointer accent-white"
        aria-label="Volume"
      />
    </div>

    <div className="mb-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[9px] font-medium text-white/45">
          Audio boost
        </span>

        <span className="text-[9px] font-semibold text-white/60">
          Up to 300%
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {[1, 1.25, 1.5, 2, 2.5, 3].map(
          (boost) => (
            <button
              key={boost}
              type="button"
              onClick={() =>
                changeAudioBoost(
                  boost,
                )
              }
              className={`rounded-lg border px-2 py-1.5 text-[9px] font-bold tabular-nums transition-all ${
                audioBoost === boost
                  ? 'border-white/40 bg-white text-black'
                  : 'border-white/10 bg-white/[0.04] text-white/55 hover:bg-white/10 hover:text-white'
              }`}
              aria-label={`Set audio boost to ${Math.round(boost * 100)}%`}
            >
              {Math.round(
                boost * 100,
              )}%
            </button>
          ),
        )}
      </div>
    </div>

    <button
      type="button"
      onClick={toggleMute}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.12em] text-white/65 transition-all hover:bg-white/10 hover:text-white active:scale-[0.98]"
      aria-label={
        muted
          ? 'Unmute audio'
          : 'Mute audio'
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

      {muted
        ? 'Unmute'
        : 'Mute'}
    </button>
  </div>
</div>
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
                   <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/80 p-2 backdrop-blur">
  <div className="flex items-center gap-1">
    <span className="mr-1 text-[8px] font-black uppercase tracking-wider text-white/40">
      Speed
    </span>

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

  <div className="flex items-center gap-1">
    <span className="mr-1 text-[8px] font-black uppercase tracking-wider text-white/40">
      Boost
    </span>

    {[
      1,
      1.25,
      1.5,
      2,
      2.5,
      3,
    ].map(
      (value) => (
        <button
          key={value}
          type="button"
          onClick={() =>
            changeAudioBoost(
              value,
            )
          }
          className={`rounded-lg px-3 py-2 text-[8px] font-black ${
            audioBoost ===
            value
              ? 'bg-white text-black'
              : 'text-white/45 hover:bg-white/10 hover:text-white'
          }`}
        >{Math.round(
            value * 100,
          )}%
        </button>
      ),
    )}
  </div>
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

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-black">
            <Film size={20} />
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
        onAuthenticated={(
          nextSession: Session,
        ) => {
          setSession(nextSession)
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
        <MovieDetails />
      )}

      {showProfile && (
        <ProfilePanel />
      )}

      {showStudio && (
        <AdminStudio
          onClose={() =>
            setShowStudio(false)
          }
        />
      )}

      {watchingMovie && renderPlayer()}
    </div>
  )
}

export default function App() {
  return <AppShell />
}
