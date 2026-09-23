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
