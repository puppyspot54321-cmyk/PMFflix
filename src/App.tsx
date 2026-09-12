import heroImage from './assets/hero.png'
import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

import {
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Film,
  Globe2,
  Heart,
  Home,
  Info,
  Layers3,
  LogOut,
  Menu,
  Play,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  Tv,
  X,
} from 'lucide-react'

import AuthScreen from './Auth'
import { supabase } from './supabase'

import {
  getMetadataCatalog,
  getMovies,
} from './services'

import type { MetadataCatalog } from './services'
import type { Movie as CanonicalMovie } from './types/movie'

import {
  mapCanonicalMovieToLegacy,
} from './utils/movieMapper'

import VideoPlayer from './components/VideoPlayer'

type Section =
  | 'home'
  | 'movies'
  | 'tv'
  | 'my-list'

type SortMode =
  | 'popular'
  | 'newest'
  | 'rating'
  | 'title'

type DisplayMovie =
  ReturnType<typeof mapCanonicalMovieToLegacy>

type ContinueWatchingEntry = {
  id: number
  position: number
  duration: number
  updatedAt: number
}

type NavItem = {
  value: Section
  label: string
  icon: LucideIcon
}

const MY_LIST_STORAGE_KEY = 'pmf-my-list'
const CONTINUE_WATCHING_STORAGE_KEY =
  'pmf-continue-watching'

const NAV_ITEMS: NavItem[] = [
  {
    value: 'home',
    label: 'Home',
    icon: Home,
  },
  {
    value: 'movies',
    label: 'Movies',
    icon: Film,
  },
  {
    value: 'tv',
    label: 'TV Series',
    icon: Tv,
  },
  {
    value: 'my-list',
    label: 'My List',
    icon: Bookmark,
  },
]

function normalizeText(value: string): string {
  return value.trim().toLowerCase()
}

function safeNumber(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function getMovieVideoUrl(
  movie: DisplayMovie,
): string {
  const directUrl = movie.videoUrl?.trim()

  if (directUrl) {
    return directUrl
  }

  if (
    normalizeText(movie.title) ===
    normalizeText('The Journey')
  ) {
    return '/movies/the-journey.mp4'
  }

  return ''
}

function isYouTubeUrl(
  value: string,
): boolean {
  try {
    const parsed = new URL(value)

    return (
      parsed.hostname.includes('youtube.com') ||
      parsed.hostname.includes('youtu.be')
    )
  } catch {
    return false
  }
}

function getYouTubeEmbedUrl(
  value: string,
): string {
  try {
    const parsed = new URL(value)

    if (
      parsed.hostname.includes('youtu.be')
    ) {
      const id = parsed.pathname
        .replace('/', '')
        .trim()

      return id
        ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`
        : value
    }

    const videoId =
      parsed.searchParams.get('v')

    return videoId
      ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`
      : value
  } catch {
    return value
  }
}

function getMyListIds(): number[] {
  try {
    const saved = localStorage.getItem(
      MY_LIST_STORAGE_KEY,
    )

    if (!saved) return []

    const parsed: unknown =
      JSON.parse(saved)

    if (!Array.isArray(parsed)) return []

    return parsed.filter(
      (value): value is number =>
        typeof value === 'number' &&
        Number.isFinite(value),
    )
  } catch {
    return []
  }
}

function saveMyListIds(
  ids: number[],
): void {
  try {
    localStorage.setItem(
      MY_LIST_STORAGE_KEY,
      JSON.stringify(ids),
    )
  } catch {
    // Local storage may be unavailable.
  }
}

function getContinueWatchingEntries():
  ContinueWatchingEntry[] {
  try {
    const saved = localStorage.getItem(
      CONTINUE_WATCHING_STORAGE_KEY,
    )

    if (!saved) return []

    const parsed: unknown =
      JSON.parse(saved)

    if (!Array.isArray(parsed)) return []

    return parsed.filter(
      (
        value,
      ): value is ContinueWatchingEntry => {
        if (
          typeof value !== 'object' ||
          value === null
        ) {
          return false
        }

        const item =
          value as Record<
            string,
            unknown
          >

        return (
          typeof item.id === 'number' &&
          typeof item.position === 'number' &&
          typeof item.duration === 'number' &&
          typeof item.updatedAt === 'number'
        )
      },
    )
  } catch {
    return []
  }
}

function saveContinueWatching(
  id: number,
  position: number,
  duration: number,
): void {
  try {
    const current =
      getContinueWatchingEntries()

    const nextEntry: ContinueWatchingEntry = {
      id,
      position: Math.max(0, position),
      duration: Math.max(0, duration),
      updatedAt: Date.now(),
    }

    const next = [
      ...current.filter(
        (entry) => entry.id !== id,
      ),
      nextEntry,
    ]
      .sort(
        (a, b) =>
          b.updatedAt - a.updatedAt,
      )
      .slice(0, 30)

    localStorage.setItem(
      CONTINUE_WATCHING_STORAGE_KEY,
      JSON.stringify(next),
    )
  } catch {
    // Ignore storage failures.
  }
}

function removeContinueWatching(
  id: number,
): void {
  try {
    const next =
      getContinueWatchingEntries().filter(
        (entry) => entry.id !== id,
      )

    localStorage.setItem(
      CONTINUE_WATCHING_STORAGE_KEY,
      JSON.stringify(next),
    )
  } catch {
    // Ignore storage failures.
  }
}

function getProgressPercent(
  entry: ContinueWatchingEntry | null,
): number {
  if (
    !entry ||
    entry.duration <= 0
  ) {
    return 0
  }

  return Math.min(
    100,
    Math.max(
      0,
      (entry.position /
        entry.duration) *
        100,
    ),
  )
}

function formatRuntime(
  movie: CanonicalMovie,
): string {
  if (
    movie.runtimeMinutes !== undefined &&
    movie.runtimeMinutes > 0
  ) {
    const hours = Math.floor(
      movie.runtimeMinutes / 60,
    )

    const minutes =
      movie.runtimeMinutes % 60

    if (hours > 0) {
      return minutes > 0
        ? `${hours}h ${minutes}m`
        : `${hours}h`
    }

    return `${minutes}m`
  }

  return movie.duration ?? ''
}

function metadataName(
  catalog: MetadataCatalog | null,
  id: string,
): string {
  if (!catalog) return id

  const groups = [
    catalog.genres,
    catalog.subgenres,
    catalog.regions,
    catalog.countries,
    catalog.industries,
    catalog.languages,
    catalog.tags,
    catalog.collections,
    catalog.ageRatings,
  ]

  for (const group of groups) {
    const item = group.find(
      (value) => value.id === id,
    )

    if (item) return item.name
  }

  return id
}

function sortMovies(
  movies: CanonicalMovie[],
  mode: SortMode,
): CanonicalMovie[] {
  return [...movies].sort(
    (a, b) => {
      if (mode === 'title') {
        return a.title.localeCompare(
          b.title,
        )
      }

      if (mode === 'newest') {
        return (
          safeNumber(b.releaseYear) -
          safeNumber(a.releaseYear)
        )
      }

      if (mode === 'rating') {
        return (
          safeNumber(b.rating) -
          safeNumber(a.rating)
        )
      }

      return (
        safeNumber(b.viewCount) -
          safeNumber(a.viewCount) ||
        safeNumber(b.rating) -
          safeNumber(a.rating) ||
        safeNumber(b.releaseYear) -
          safeNumber(a.releaseYear)
      )
    },
  )
}

function matchesSection(
  movie: CanonicalMovie,
  section: Section,
): boolean {
  if (section === 'movies') {
    return [
      'movie',
      'documentary',
      'short_film',
      'special',
    ].includes(movie.contentType)
  }

  if (section === 'tv') {
    return movie.contentType === 'tv_show'
  }

  return true
}

function AppShell({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#030303] text-white selection:bg-red-600/40">
      {children}
    </div>
  )
}

function SectionTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1 text-[10px] font-black uppercase tracking-[0.28em] text-red-500">
            {eyebrow}
          </p>
        )}

        <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
          {title}
        </h2>

        {description && (
          <p className="mt-2 max-w-2xl text-sm text-white/45">
            {description}
          </p>
        )}
      </div>

      {action}
    </div>
  )
}

function MovieCard({
  movie,
  canonical,
  myList,
  continueEntry,
  onOpen,
  onToggleMyList,
  onPlay,
}: {
  movie: DisplayMovie
  canonical: CanonicalMovie
  myList: boolean
  continueEntry: ContinueWatchingEntry | null
  onOpen: (
    movie: DisplayMovie,
  ) => void
  onToggleMyList: (
    id: number,
  ) => void
  onPlay: (
    movie: DisplayMovie,
  ) => void
}) {
  const progress =
    getProgressPercent(
      continueEntry,
    )

  return (
    <article className="group relative w-[150px] shrink-0 sm:w-[185px] lg:w-[205px]">
      <button
        type="button"
        onClick={() => onOpen(movie)}
        className="relative block w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] text-left shadow-xl transition duration-300 hover:-translate-y-1 hover:border-white/25"
      >
        <div className="aspect-[2/3] overflow-hidden bg-white/5">
          {movie.poster ? (
            <img
              src={movie.poster}
              alt={movie.title}
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-zinc-900 to-black">
              <Film className="h-10 w-10 text-white/20" />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/10 opacity-75" />

          <div className="absolute inset-x-0 bottom-0 p-3">
            <div className="flex items-center gap-2 text-[10px] font-bold text-white/70">
              {canonical.rating !== undefined && (
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-current text-yellow-400" />
                  {canonical.rating}
                </span>
              )}

              {canonical.releaseYear && (
                <span>
                  {canonical.releaseYear}
                </span>
              )}
            </div>

            <h3 className="mt-1 line-clamp-2 text-sm font-black leading-tight">
              {movie.title}
            </h3>
          </div>

          {canonical.isPmfOriginal && (
            <div className="absolute left-2 top-2 rounded-full bg-red-600 px-2 py-1 text-[8px] font-black uppercase tracking-wider">
              PMF Original
            </div>
          )}

          {canonical.isPremium && (
            <div className="absolute right-2 top-2 rounded-full border border-yellow-400/30 bg-black/75 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-yellow-300">
              Premium
            </div>
          )}
        </div>
      </button>

      {progress > 0 && (
        <div className="absolute bottom-[61px] left-2 right-2 z-10 h-1 overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full bg-red-600"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>
      )}

      <div className="mt-2 flex gap-1">
        <button
          type="button"
          onClick={() => onPlay(movie)}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-white text-xs font-black text-black transition hover:bg-red-600 hover:text-white"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          {progress > 0
            ? 'Resume'
            : 'Play'}
        </button>

        <button
          type="button"
          aria-label={
            myList
              ? 'Remove from My List'
              : 'Add to My List'
          }
          onClick={() =>
            onToggleMyList(
              Number(movie.id),
            )
          }
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-white/70 transition hover:border-white/30 hover:text-white"
        >
          {myList ? (
            <Check className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </button>
      </div>
    </article>
  )
 }

function MovieRail({
  title,
  eyebrow,
  movies,
  movieMap,
  myListIds,
  continueWatchingEntries,
  onOpen,
  onToggleMyList,
  onPlay,
}: {
  title: string
  eyebrow?: string
  movies: CanonicalMovie[]
  movieMap: Map<
    number,
    DisplayMovie
  >
  myListIds: number[]
  continueWatchingEntries: ContinueWatchingEntry[]
  onOpen: (
    movie: DisplayMovie,
  ) => void
  onToggleMyList: (
    id: number,
  ) => void
  onPlay: (
    movie: DisplayMovie,
  ) => void
}) {
  if (movies.length === 0) {
    return null
  }

  return (
    <section className="mb-12">
      <SectionTitle
        eyebrow={eyebrow}
        title={title}
        action={
          <div className="hidden items-center gap-1 sm:flex">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      />

      <div className="flex gap-3 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4">
        {movies.map((canonical) => {
          const movie =
            movieMap.get(
              Number(canonical.id),
            )

          if (!movie) {
            return null
          }

          const continueEntry =
            continueWatchingEntries.find(
              (entry) =>
                entry.id ===
                Number(canonical.id),
            ) ?? null

          return (
            <MovieCard
              key={canonical.id}
              movie={movie}
              canonical={canonical}
              myList={myListIds.includes(
                Number(canonical.id),
              )}
              continueEntry={
                continueEntry
              }
              onOpen={onOpen}
              onToggleMyList={
                onToggleMyList
              }
              onPlay={onPlay}
            />
          )
        })}
      </div>
    </section>
  )
}

function AuthenticatedApp() {
  const [movies, setMovies] =
    useState<CanonicalMovie[]>([])

  const [
    metadataCatalog,
    setMetadataCatalog,
  ] = useState<MetadataCatalog | null>(
    null,
  )

  const [loading, setLoading] =
    useState(true)

  const [errorMessage, setErrorMessage] =
    useState('')

  const [section, setSection] =
    useState<Section>('home')

  const [
    selectedMovie,
    setSelectedMovie,
  ] = useState<DisplayMovie | null>(
    null,
  )

  const [
    watchingMovie,
    setWatchingMovie,
  ] = useState<DisplayMovie | null>(
    null,
  )

  const [myListIds, setMyListIds] =
    useState<number[]>(getMyListIds)

  const [
    continueWatchingEntries,
    setContinueWatchingEntries,
  ] = useState<
    ContinueWatchingEntry[]
  >(
    getContinueWatchingEntries,
  )

  const [searchQuery, setSearchQuery] =
    useState('')

  const [sortMode, setSortMode] =
    useState<SortMode>('popular')

  const [showFilters, setShowFilters] =
    useState(false)

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false)

  const [genreFilter, setGenreFilter] =
    useState('')

  const [yearFilter, setYearFilter] =
    useState('')

  const [minRating, setMinRating] =
    useState('')

  const [contentTypeFilter, setContentTypeFilter] =
    useState('')

  const navigate = (
    nextSection: Section,
  ) => {
    setSection(nextSection)
    setMobileMenuOpen(false)
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  const refreshLocalState = () => {
    setMyListIds(getMyListIds())
    setContinueWatchingEntries(
      getContinueWatchingEntries(),
    )
  }

  useEffect(() => {
    let mounted = true

    async function loadCatalog() {
      setLoading(true)
      setErrorMessage('')

      try {
        const [
          movieData,
          metadataData,
        ] = await Promise.all([
          getMovies(),
          getMetadataCatalog(),
        ])

        if (!mounted) return

        setMovies(movieData)
        setMetadataCatalog(
          metadataData,
        )
      } catch (error) {
        if (!mounted) return

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to load PMF Flix.',
        )
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void loadCatalog()

    const channel =
      supabase
        .channel('pmf-movies-live')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'movies',
          },
          () => {
            void loadCatalog()
          },
        )
        .subscribe()

    return () => {
      mounted = false
      void supabase.removeChannel(
        channel,
      )
    }
  }, [])

  useEffect(() => {
    const handleStorage = () => {
      refreshLocalState()
    }

    window.addEventListener(
      'storage',
      handleStorage,
    )

    return () => {
      window.removeEventListener(
        'storage',
        handleStorage,
      )
    }
  }, [])

  const movieMap = useMemo(() => {
    const map = new Map<
      number,
      DisplayMovie
    >()

    movies.forEach((movie) => {
      map.set(
        Number(movie.id),
        mapCanonicalMovieToLegacy(
          movie,
        ),
      )
    })

    return map
  }, [movies])

  const continueWatchingMovies =
    useMemo(() => {
      const entries = [
        ...continueWatchingEntries,
      ].sort(
        (a, b) =>
          b.updatedAt -
          a.updatedAt,
      )

      return entries
        .map((entry) =>
          movies.find(
            (movie) =>
              Number(movie.id) ===
              entry.id,
          ),
        )
        .filter(
          (
            movie,
          ): movie is CanonicalMovie =>
            Boolean(movie),
        )
    }, [
      continueWatchingEntries,
      movies,
    ])

  const myListMovies = useMemo(
    () =>
      movies.filter((movie) =>
        myListIds.includes(
          Number(movie.id),
        ),
      ),
    [movies, myListIds],
  )

  const filteredMovies = useMemo(() => {
    const query =
      normalizeText(searchQuery)

    const genre =
      normalizeText(genreFilter)

    const year =
      Number(yearFilter)

    const rating =
      Number(minRating)

    const type =
      normalizeText(contentTypeFilter)

    const result = movies.filter(
      (movie) => {
        if (
          section !== 'home' &&
          section !== 'my-list' &&
          !matchesSection(
            movie,
            section,
          )
        ) {
          return false
        }

        if (
          section === 'my-list' &&
          !myListIds.includes(
            Number(movie.id),
          )
        ) {
          return false
        }

        if (query) {
          const searchable = [
            movie.title,
            movie.originalTitle ?? '',
            movie.slug,
            movie.tagline ?? '',
            movie.synopsis,
            ...movie.genres,
            ...movie.tags,
            ...movie.directors.map(
              (person) =>
                person.name,
            ),
            ...movie.writers.map(
              (person) =>
                person.name,
            ),
          ]
            .join(' ')
            .toLowerCase()

          if (
            !searchable.includes(query)
          ) {
            return false
          }
        }

        if (genre) {
          const genreNames =
            movie.genres.map(
              (id) =>
                metadataName(
                  metadataCatalog,
                  id,
                ).toLowerCase(),
            )

          if (
            !genreNames.some(
              (name) =>
                name.includes(genre),
            )
          ) {
            return false
          }
        }

        if (
          year &&
          movie.releaseYear !==
            year
        ) {
          return false
        }

        if (
          rating &&
          safeNumber(movie.rating) <
            rating
        ) {
          return false
        }

        if (
          type &&
          movie.contentType !== type
        ) {
          return false
        }

        return true
      },
    )

    return sortMovies(
      result,
      sortMode,
    )
  }, [
    movies,
    section,
    myListIds,
    searchQuery,
    genreFilter,
    yearFilter,
    minRating,
    contentTypeFilter,
    metadataCatalog,
    sortMode,
  ])

  const featuredMovie =
    useMemo(
      () =>
        movies.find(
          (movie) =>
            movie.isFeatured,
        ) ??
        movies.find(
          (movie) =>
            movie.isPmfOriginal,
        ) ??
        movies[0] ??
        null,
      [movies],
    )

  const trendingMovies =
    useMemo(
      () =>
        sortMovies(
          movies.filter(
            (movie) =>
              movie.isTrending,
          ),
          'popular',
        ).slice(0, 12),
      [movies],
    )

  const newReleaseMovies =
    useMemo(
      () =>
        sortMovies(
          movies.filter(
            (movie) =>
              movie.isNewRelease,
          ),
          'newest',
        ).slice(0, 12),
      [movies],
    )

  const pmfOriginals =
    useMemo(
      () =>
        sortMovies(
          movies.filter(
            (movie) =>
              movie.isPmfOriginal,
          ),
          'popular',
        ).slice(0, 12),
      [movies],
    )

  const popularMovies =
    useMemo(
      () =>
        sortMovies(
          movies,
          'popular',
        ).slice(0, 12),
      [movies],
    )

  const featuredDisplay =
    featuredMovie
      ? movieMap.get(
          Number(featuredMovie.id),
        ) ?? null
      : null

  const toggleMyList = (
    id: number,
  ) => {
    setMyListIds((current) => {
      const next = current.includes(id)
        ? current.filter(
            (value) => value !== id,
          )
        : [...current, id]

      saveMyListIds(next)

      return next
    })
  }

  const openMovie = (
    movie: DisplayMovie,
  ) => {
    setSelectedMovie(movie)
  }

  const closeMovie = () => {
    setSelectedMovie(null)
  }

  const playMovie = (
    movie: DisplayMovie,
  ) => {
    setSelectedMovie(null)
    setWatchingMovie(movie)
  }

  const closePlayer = () => {
    setWatchingMovie(null)
    refreshLocalState()
  }

  const continueEntry = watchingMovie
    ? getContinueWatchingEntries().find(
        (entry) =>
          entry.id ===
          Number(watchingMovie.id),
      ) ?? null
    : null

  const handleTimeUpdate = (
    currentTime: number,
  ) => {
    if (!watchingMovie) return

    const movie =
      movies.find(
        (item) =>
          Number(item.id) ===
          Number(watchingMovie.id),
      )

    if (!movie) return

    const estimatedDuration =
      movie.runtimeMinutes
        ? movie.runtimeMinutes * 60
        : 0

    saveContinueWatching(
      Number(watchingMovie.id),
      currentTime,
      estimatedDuration,
    )

    setContinueWatchingEntries(
      getContinueWatchingEntries(),
    )
  }

  const handleEnded = () => {
    if (!watchingMovie) return

    removeContinueWatching(
      Number(watchingMovie.id),
    )

    setContinueWatchingEntries(
      getContinueWatchingEntries(),
    )
  }

  const resetFilters = () => {
    setGenreFilter('')
    setYearFilter('')
    setMinRating('')
    setContentTypeFilter('')
    setSortMode('popular')
  }

  const canonicalWatchingMovie =
    watchingMovie
      ? movies.find(
          (movie) =>
            Number(movie.id) ===
            Number(watchingMovie.id),
        ) ?? null
      : null

  return (
    <AppShell>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-black/75 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-5 px-4 sm:px-6 lg:px-10">
          <button
            type="button"
            onClick={() =>
              navigate('home')
            }
            className="shrink-0 text-left"
          >
            <div className="text-2xl font-black tracking-tight sm:text-3xl">
              <span className="text-red-600">
                PMF
              </span>
              LIX
            </div>

            <div className="hidden text-[7px] font-bold uppercase tracking-[0.25em] text-white/30 sm:block">
              Prince Mufasa Flix
            </div>
          </button>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV_ITEMS.map(
              ({
                value,
                label,
                icon: Icon,
              }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    navigate(value)
                  }
                  className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                    section === value
                      ? 'bg-white/10 text-white'
                      : 'text-white/45 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ),
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden w-56 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 md:flex">
              <Search className="h-4 w-4 text-white/35" />

              <input
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(
                    event.target.value,
                  )
                }
                placeholder="Search PMF..."
                className="w-full bg-transparent py-2.5 text-xs outline-none placeholder:text-white/25"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                setShowFilters(
                  (value) => !value,
                )
              }
              className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                showFilters
                  ? 'border-red-600/40 bg-red-600/10 text-red-400'
                  : 'border-white/10 bg-white/[0.04] text-white/60'
              }`}
              aria-label="Filters"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() =>
                setMobileMenuOpen(
                  (value) => !value,
                )
              }
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/60 lg:hidden"
              aria-label="Menu"
            >
              <Menu className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut()
              }}
              className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-white/60 transition hover:text-white sm:flex"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-white/[0.06] bg-black/95 px-4 py-4 lg:hidden">
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3">
              <Search className="h-4 w-4 text-white/35" />

              <input
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(
                    event.target.value,
                  )
                }
                placeholder="Search movies, shows..."
                className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-white/25"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {NAV_ITEMS.map(
                ({
                  value,
                  label,
                  icon: Icon,
                }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      navigate(value)
                    }
                    className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm font-bold ${
                      section === value
                        ? 'border-red-600/40 bg-red-600/10 text-white'
                        : 'border-white/10 bg-white/[0.03] text-white/50'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ),
              )}
            </div>

            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut()
              }}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-sm font-bold text-white/50"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        )}
      </header>

      <main className="pt-16">
        {loading ? (
          <div className="min-h-[85vh]">
            <div className="relative h-[65vh] animate-pulse bg-white/[0.03]">
              <div className="absolute bottom-16 left-5 sm:left-10 lg:left-16">
                <div className="h-3 w-32 rounded bg-white/10" />
                <div className="mt-4 h-12 w-72 rounded bg-white/10 sm:w-[480px]" />
                <div className="mt-4 h-4 w-80 rounded bg-white/10 sm:w-[600px]" />
              </div>
            </div>

            <div className="space-y-8 px-4 py-10 sm:px-6 lg:px-10">
              {[1, 2, 3].map(
                (row) => (
                  <div key={row}>
                    <div className="mb-5 h-7 w-48 rounded bg-white/10" />

                    <div className="flex gap-4 overflow-hidden">
                      {[1, 2, 3, 4, 5].map(
                        (item) => (
                          <div
                            key={item}
                            className="h-64 w-44 shrink-0 animate-pulse rounded-2xl bg-white/[0.04]"
                          />
                        ),
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        ) : errorMessage ? (
          <div className="flex min-h-[80vh] items-center justify-center px-6">
            <div className="max-w-lg rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
              <X className="mx-auto h-10 w-10 text-red-400" />

              <h1 className="mt-5 text-2xl font-black">
                PMF could not load
              </h1>

              <p className="mt-3 text-sm leading-6 text-white/45">
                {errorMessage}
              </p>

              <button
                type="button"
                onClick={() =>
                  window.location.reload()
                }
                className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-black text-black"
              >
                Reload PMF
              </button>
            </div>
          </div>
        ) : (
          <>
            {section === 'home' &&
              featuredDisplay &&
              featuredMovie && (
                <section className="relative min-h-[72vh] overflow-hidden">
                  <div className="absolute inset-0">
                    <img
                      src={
                        featuredMovie.backdropUrl ||
                        featuredMovie.posterUrl ||
                        heroImage
                      }
                      alt=""
                      className="h-full w-full object-cover opacity-65"
                    />

                    <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-transparent to-black/30" />
                  </div>

                  <div className="relative mx-auto flex min-h-[72vh] max-w-[1600px] items-end px-5 pb-16 sm:px-10 lg:px-16">
                    <div className="max-w-2xl">
                      <div className="mb-4 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em]">
                        <span className="rounded-full bg-red-600 px-3 py-1">
                          Featured Film
                        </span>

                        {featuredMovie.isPmfOriginal && (
                          <span className="rounded-full border border-white/20 bg-black/30 px-3 py-1 text-white/70">
                            PMF Original
                          </span>
                        )}
                      </div>

                      <h1 className="max-w-3xl text-5xl font-black tracking-[-0.04em] sm:text-6xl lg:text-8xl">
                        {featuredMovie.title}
                      </h1>

                      {featuredMovie.tagline && (
                        <p className="mt-4 text-lg font-bold text-white/80 sm:text-xl">
                          {featuredMovie.tagline}
                        </p>
                      )}

                      <p className="mt-4 line-clamp-3 max-w-xl text-sm leading-6 text-white/50 sm:text-base">
                        {featuredMovie.synopsis}
                      </p>

                      <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-bold text-white/55">
                        {featuredMovie.releaseYear && (
                          <span>
                            {featuredMovie.releaseYear}
                          </span>
                        )}

                        {featuredMovie.rating !==
                          undefined && (
                          <span className="flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 fill-current text-yellow-400" />
                            {featuredMovie.rating}
                          </span>
                        )}

                        {formatRuntime(
                          featuredMovie,
                        ) && (
                          <span className="flex items-center gap-1">
                            <Clock3 className="h-3.5 w-3.5" />
                            {formatRuntime(
                              featuredMovie,
                            )}
                          </span>
                        )}
                      </div>

                      <div className="mt-7 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            playMovie(
                              featuredDisplay,
                            )
                          }
                          className="flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-black text-black transition hover:bg-red-600 hover:text-white"
                        >
                          <Play className="h-4 w-4 fill-current" />
                          Play Now
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            openMovie(
                              featuredDisplay,
                            )
                          }
                          className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.07] px-6 py-3.5 text-sm font-black backdrop-blur-xl transition hover:bg-white/15"
                        >
                          <Info className="h-4 w-4" />
                          More Info
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              )}

            <div className="mx-auto max-w-[1600px] px-4 py-10 sm:px-6 lg:px-10">
              {showFilters && (
                <section className="mb-10 rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                      <div className="flex-1">
                        <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-white/35">
                          Genre
                        </label>

                        <input
                          value={genreFilter}
                          onChange={(event) =>
                            setGenreFilter(
                              event.target.value,
                            )
                          }
                          placeholder="e.g. Action, Drama..."
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-red-600/50"
                        />
                      </div>

                      <div className="w-full lg:w-40">
                        <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-white/35">
                          Year
                        </label>

                        <input
                          value={yearFilter}
                          onChange={(event) =>
                            setYearFilter(
                              event.target.value,
                            )
                          }
                          placeholder="2026"
                          inputMode="numeric"
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-red-600/50"
                        />
                      </div>

                      <div className="w-full lg:w-40">
                        <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-white/35">
                          Min Rating
                        </label>

                        <input
                          value={minRating}
                          onChange={(event) =>
                            setMinRating(
                              event.target.value,
                            )
                          }
                          placeholder="7"
                          inputMode="decimal"
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-red-600/50"
                        />
                      </div>

                      <div className="w-full lg:w-44">
                        <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-white/35">
                          Content
                        </label>

                        <select
                          value={
                            contentTypeFilter
                          }
                          onChange={(event) =>
                            setContentTypeFilter(
                              event.target.value,
                            )
                          }
                          className="w-full rounded-xl border border-white/10 bg-[#111] px-4 py-3 text-sm outline-none"
                        >
                          <option value="">
                            All Types
                          </option>
                          <option value="movie">
                            Movies
                          </option>
                          <option value="tv_show">
                            TV Series
                          </option>
                          <option value="documentary">
                            Documentaries
                          </option>
                          <option value="short_film">
                            Short Films
                          </option>
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs text-white/40">
                        <SlidersHorizontal className="h-4 w-4" />
                        Discovery controls
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            [
                              'popular',
                              'Popular',
                            ],
                            [
                              'newest',
                              'Newest',
                            ],
                            [
                              'rating',
                              'Top Rated',
                            ],
                            [
                              'title',
                              'A–Z',
                            ],
                          ] as const
                        ).map(
                          ([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() =>
                                setSortMode(
                                  value,
                                )
                              }
                              className={`rounded-lg px-3 py-2 text-xs font-bold ${
                                sortMode ===
                                value
                                  ? 'bg-red-600 text-white'
                                  : 'bg-white/5 text-white/45'
                              }`}
                            >
                              {label}
                            </button>
                          ),
                        )}

                        <button
                          type="button"
                          onClick={resetFilters}
                          className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-white/50"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {section === 'home' ? (
                <>
                  {continueWatchingMovies.length >
                    0 && (
                    <MovieRail
                      eyebrow="Pick up where you left off"
                      title="Continue Watching"
                      movies={
                        continueWatchingMovies
                      }
                      movieMap={movieMap}
                      myListIds={
                        myListIds
                      }
                      continueWatchingEntries={
                        continueWatchingEntries
                      }
                      onOpen={openMovie}
                      onToggleMyList={
                        toggleMyList
                      }
                      onPlay={playMovie}
                    />
                  )}

                  <MovieRail
                    eyebrow="What's hot"
                    title="Trending Now"
                    movies={trendingMovies}
                    movieMap={movieMap}
                    myListIds={myListIds}
                    continueWatchingEntries={
                      continueWatchingEntries
                    }
                    onOpen={openMovie}
                    onToggleMyList={
                      toggleMyList
                    }
                    onPlay={playMovie}
                  />

                  <MovieRail
                    eyebrow="Fresh on PMF"
                    title="New Releases"
                    movies={newReleaseMovies}
                    movieMap={movieMap}
                    myListIds={myListIds}
                    continueWatchingEntries={
                      continueWatchingEntries
                    }
                    onOpen={openMovie}
                    onToggleMyList={
                      toggleMyList
                    }
                    onPlay={playMovie}
                  />

                  <MovieRail
                    eyebrow="Made by PMF"
                    title="PMF Originals"
                    movies={pmfOriginals}
                    movieMap={movieMap}
                    myListIds={myListIds}
                    continueWatchingEntries={
                      continueWatchingEntries
                    }
                    onOpen={openMovie}
                    onToggleMyList={
                      toggleMyList
                    }
                    onPlay={playMovie}
                  />

                  <MovieRail
                    eyebrow="The audience is watching"
                    title="Popular on PMF"
                    movies={popularMovies}
                    movieMap={movieMap}
                    myListIds={myListIds}
                    continueWatchingEntries={
                      continueWatchingEntries
                    }
                    onOpen={openMovie}
                    onToggleMyList={
                      toggleMyList
                    }
                    onPlay={playMovie}
                  />
                </>
              ) : (
                <>
                  <SectionTitle
                    eyebrow={
                      section ===
                      'my-list'
                        ? 'Your collection'
                        : section ===
                            'tv'
                          ? 'Series'
                          : 'Cinema'
                    }
                    title={
                      section ===
                      'my-list'
                        ? 'My List'
                        : section ===
                            'tv'
                          ? 'TV Series'
                          : 'Movies'
                    }
                    description={
                      searchQuery
                        ? `Showing results for “${searchQuery}”`
                        : `${filteredMovies.length} titles available`
                    }
                  />

                  {filteredMovies.length >
                  0 ? (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-5 xl:grid-cols-6">
                      {filteredMovies.map(
                        (canonical) => {
                          const movie =
                            movieMap.get(
                              Number(
                                canonical.id,
                              ),
                            )

                          if (!movie) {
                            return null
                          }

                          const entry =
                            continueWatchingEntries.find(
                              (item) =>
                                item.id ===
                                Number(
                                  canonical.id,
                                ),
                            ) ?? null

                          return (
                            <MovieCard
                              key={
                                canonical.id
                              }
                              movie={
                                movie
                              }
                              canonical={
                                canonical
                              }
                              myList={myListIds.includes(
                                Number(
                                  canonical.id,
                                ),
                              )}
                              continueEntry={
                                entry
                              }
                              onOpen={
                                openMovie
                              }
                              onToggleMyList={
                                toggleMyList
                              }
                              onPlay={
                                playMovie
                              }
                            />
                          )
                        },
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-20 text-center">
                      <Search className="mx-auto h-10 w-10 text-white/20" />

                      <h3 className="mt-5 text-xl font-black">
                        Nothing found
                      </h3>

                      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/40">
                        Try another title, genre,
                        year, rating or content
                        type.
                      </p>

                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('')
                          resetFilters()
                        }}
                        className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-black text-black"
                      >
                        Clear Discovery
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </main>

            {selectedMovie && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-md sm:p-8">
          <div className="relative my-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b0b] shadow-2xl">
            <button
              type="button"
              onClick={closeMovie}
              className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white/70 backdrop-blur transition hover:bg-white hover:text-black"
              aria-label="Close movie details"
            >
              <X className="h-5 w-5" />
            </button>

            {(() => {
              const canonical =
                movies.find(
                  (movie) =>
                    Number(movie.id) ===
                    Number(
                      selectedMovie.id,
                    ),
                )

              if (!canonical) {
                return (
                  <div className="p-10">
                    Movie unavailable.
                  </div>
                )
              }

              return (
                <>
                  <div className="relative aspect-[16/8] min-h-[260px] overflow-hidden">
                    <img
                      src={
                        canonical.backdropUrl ||
                        canonical.posterUrl ||
                        heroImage
                      }
                      alt={canonical.title}
                      className="h-full w-full object-cover"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0b] via-black/30 to-transparent" />

                    <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
                      <div className="flex flex-wrap gap-2">
                        {canonical.isPmfOriginal && (
                          <span className="rounded-full bg-red-600 px-3 py-1 text-[9px] font-black uppercase tracking-widest">
                            PMF Original
                          </span>
                        )}

                        {canonical.isPremium && (
                          <span className="rounded-full border border-yellow-400/30 bg-black/60 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-yellow-300">
                            Premium
                          </span>
                        )}
                      </div>

                      <h2 className="mt-3 text-3xl font-black sm:text-5xl">
                        {canonical.title}
                      </h2>
                    </div>
                  </div>

                  <div className="p-5 sm:p-8">
                    <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-white/50">
                      {canonical.releaseYear && (
                        <span>
                          {canonical.releaseYear}
                        </span>
                      )}

                      {canonical.rating !==
                        undefined && (
                        <span className="flex items-center gap-1 text-white">
                          <Star className="h-3.5 w-3.5 fill-current text-yellow-400" />
                          {canonical.rating}
                        </span>
                      )}

                      {formatRuntime(
                        canonical,
                      ) && (
                        <span className="flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5" />
                          {formatRuntime(
                            canonical,
                          )}
                        </span>
                      )}

                      <span className="flex items-center gap-1">
                        <Globe2 className="h-3.5 w-3.5" />
                        {canonical.languageIds
                          .slice(0, 2)
                          .map((id) =>
                            metadataName(
                              metadataCatalog,
                              id,
                            ),
                          )
                          .join(', ') ||
                          'Global'}
                      </span>
                    </div>

                    {canonical.tagline && (
                      <p className="mt-5 text-lg font-bold text-white/80">
                        {canonical.tagline}
                      </p>
                    )}

                    <p className="mt-4 max-w-3xl text-sm leading-7 text-white/50">
                      {canonical.synopsis}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {canonical.genres
                        .slice(0, 6)
                        .map((id) => (
                          <span
                            key={id}
                            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold text-white/55"
                          >
                            {metadataName(
                              metadataCatalog,
                              id,
                            )}
                          </span>
                        ))}
                    </div>

                    <div className="mt-7 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          playMovie(
                            selectedMovie,
                          )
                        }
                        className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-black text-black transition hover:bg-red-600 hover:text-white"
                      >
                        <Play className="h-4 w-4 fill-current" />
                        Watch Now
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          toggleMyList(
                            Number(
                              selectedMovie.id,
                            ),
                          )
                        }
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-black"
                      >
                        {myListIds.includes(
                          Number(
                            selectedMovie.id,
                          ),
                        ) ? (
                          <>
                            <Check className="h-4 w-4" />
                            In My List
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" />
                            My List
                          </>
                        )}
                      </button>
                    </div>

                    <div className="mt-8 grid gap-5 border-t border-white/[0.07] pt-7 sm:grid-cols-2">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-white/30">
                          Genres
                        </p>

                        <p className="mt-2 text-sm text-white/55">
                          {canonical.genres
                            .map((id) =>
                              metadataName(
                                metadataCatalog,
                                id,
                              ),
                            )
                            .join(', ') ||
                            'Not specified'}
                        </p>
                      </div>

                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-white/30">
                          Directors
                        </p>

                        <p className="mt-2 text-sm text-white/55">
                          {canonical.directors
                            .map(
                              (person) =>
                                person.name,
                            )
                            .join(', ') ||
                            'Not specified'}
                        </p>
                      </div>

                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-white/30">
                          Cast
                        </p>

                        <p className="mt-2 text-sm text-white/55">
                          {canonical.cast
                            .slice(0, 8)
                            .map(
                              (member) =>
                                member.personId,
                            )
                            .join(', ') ||
                            'Not specified'}
                        </p>
                      </div>

                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-white/30">
                          Quality
                        </p>

                        <p className="mt-2 text-sm text-white/55">
                          {canonical.videoQualities
                            .join(' • ') ||
                            'Auto'}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {watchingMovie && (
        <div className="fixed inset-0 z-[80] bg-black">
          <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/90 to-transparent px-4 py-5 sm:px-8">
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-red-500">
                Now Playing
              </p>

              <h2 className="truncate text-base font-black sm:text-xl">
                {watchingMovie.title}
              </h2>
            </div>

            <button
              type="button"
              onClick={closePlayer}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white hover:text-black"
              aria-label="Close player"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex h-full items-center justify-center p-2 pt-16 sm:p-8 sm:pt-20">
            {(() => {
              const videoUrl =
                getMovieVideoUrl(
                  watchingMovie,
                )

              if (
                videoUrl &&
                isYouTubeUrl(videoUrl)
              ) {
                return (
                  <div className="aspect-video w-full max-w-7xl overflow-hidden rounded-2xl bg-black shadow-2xl">
                    <iframe
                      src={getYouTubeEmbedUrl(
                        videoUrl,
                      )}
                      title={
                        watchingMovie.title
                      }
                      className="h-full w-full"
                      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )
              }

              if (
                canonicalWatchingMovie
              ) {
                return (
                  <div className="w-full max-w-7xl">
                    <VideoPlayer
                      videoUrl={
                        videoUrl ||
                        undefined
                      }
                      videoAssets={
                        canonicalWatchingMovie.videoAssets ??
                        []
                      }
                      subtitles={
                        canonicalWatchingMovie.subtitles ??
                        []
                      }
                      posterUrl={
                        canonicalWatchingMovie.posterUrl ||
                        watchingMovie.poster ||
                        heroImage
                      }
                      title={
                        watchingMovie.title
                      }
                      autoPlay
                      initialTime={
                        continueEntry?.position ??
                        0
                      }
                      onTimeUpdate={
                        handleTimeUpdate
                      }
                      onEnded={
                        handleEnded
                      }
                    />

                    {!videoUrl && (
                      <div className="mt-4 rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4 text-center text-sm text-yellow-200/70">
                        This title does not
                        have a playable video
                        source yet. Add a licensed
                        video URL or video asset
                        in the PMF catalog.
                      </div>
                    )}
                  </div>
                )
              }

              return (
                <div className="text-center">
                  <Film className="mx-auto h-12 w-12 text-white/20" />
                  <p className="mt-4 text-white/50">
                    Video unavailable.
                  </p>
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </AppShell>
  )
}

export default function App() {
  const [sessionReady, setSessionReady] =
    useState(false)

  const [authenticated, setAuthenticated] =
    useState(false)

  useEffect(() => {
    let mounted = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return

        setAuthenticated(
          Boolean(data.session),
        )
        setSessionReady(true)
      })
      .catch(() => {
        if (!mounted) return

        setAuthenticated(false)
        setSessionReady(true)
      })

    const {
      data: listener,
    } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          setAuthenticated(
            Boolean(session),
          )
          setSessionReady(true)
        },
      )

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  if (!sessionReady) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="text-4xl font-black">
              <span className="text-red-600">
                PMF
              </span>
              LIX
            </div>

            <div className="mt-4 h-1 w-16 animate-pulse rounded-full bg-red-600" />
          </div>
        </div>
      </AppShell>
    )
  }

  if (!authenticated) {
    return <AuthScreen />
  }

  return <AuthenticatedApp />
}
