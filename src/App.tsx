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
  Download,
  Film,
  Globe2,
  Heart,
  Home,
  Info,
  LogOut,
  Menu,
  Play,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tv,
  UserRound,
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

const MY_LIST_STORAGE_KEY =
  'pmf-my-list'

const CONTINUE_WATCHING_STORAGE_KEY =
  'pmf-continue-watching'

const RECENTLY_VIEWED_STORAGE_KEY =
  'pmf-recently-viewed'

const LIKED_STORAGE_KEY =
  'pmf-liked'

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

function normalizeText(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
}

function safeNumber(
  value: unknown,
): number {
  const number = Number(value)

  return Number.isFinite(number)
    ? number
    : 0
}

function getMovieVideoUrl(
  movie: DisplayMovie,
): string {
  const directUrl =
    movie.videoUrl?.trim()

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
      parsed.hostname.includes(
        'youtube.com',
      ) ||
      parsed.hostname.includes(
        'youtu.be',
      )
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
      parsed.hostname.includes(
        'youtu.be',
      )
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

    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`
    }

    if (
      parsed.pathname.includes(
        '/embed/',
      )
    ) {
      return `${value}${value.includes('?') ? '&' : '?'}autoplay=1&rel=0`
    }

    if (
      parsed.pathname.includes(
        '/shorts/',
      )
    ) {
      const id =
        parsed.pathname.split(
          '/shorts/',
        )[1]

      return id
        ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`
        : value
    }

    return value
  } catch {
    return value
  }
}

function getMyListIds(): number[] {
  try {
    const saved =
      localStorage.getItem(
        MY_LIST_STORAGE_KEY,
      )

    if (!saved) return []

    const parsed: unknown =
      JSON.parse(saved)

    if (!Array.isArray(parsed)) {
      return []
    }

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
    // Storage may be unavailable.
  }
}

function getLikedIds(): number[] {
  try {
    const saved =
      localStorage.getItem(
        LIKED_STORAGE_KEY,
      )

    if (!saved) return []

    const parsed: unknown =
      JSON.parse(saved)

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(
      (value): value is number =>
        typeof value === 'number' &&
        Number.isFinite(value),
    )
  } catch {
    return []
  }
}

function saveLikedIds(
  ids: number[],
): void {
  try {
    localStorage.setItem(
      LIKED_STORAGE_KEY,
      JSON.stringify(ids),
    )
  } catch {
    // Storage may be unavailable.
  }
}

function getRecentlyViewedIds(): number[] {
  try {
    const saved =
      localStorage.getItem(
        RECENTLY_VIEWED_STORAGE_KEY,
      )

    if (!saved) return []

    const parsed: unknown =
      JSON.parse(saved)

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(
      (value): value is number =>
        typeof value === 'number' &&
        Number.isFinite(value),
    )
  } catch {
    return []
  }
}

function saveRecentlyViewedId(
  id: number,
): void {
  try {
    const current =
      getRecentlyViewedIds()

    const next = [
      id,
      ...current.filter(
        (item) => item !== id,
      ),
    ].slice(0, 20)

    localStorage.setItem(
      RECENTLY_VIEWED_STORAGE_KEY,
      JSON.stringify(next),
    )
  } catch {
    // Storage may be unavailable.
  }
}

function getContinueWatchingEntries():
  ContinueWatchingEntry[] {
  try {
    const saved =
      localStorage.getItem(
        CONTINUE_WATCHING_STORAGE_KEY,
      )

    if (!saved) return []

    const parsed: unknown =
      JSON.parse(saved)

    if (!Array.isArray(parsed)) {
      return []
    }

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
      position: Math.max(
        0,
        position,
      ),
      duration: Math.max(
        0,
        duration,
      ),
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
          b.updatedAt -
          a.updatedAt,
      )
      .slice(0, 30)

    localStorage.setItem(
      CONTINUE_WATCHING_STORAGE_KEY,
      JSON.stringify(next),
    )
  } catch {
    // Storage may be unavailable.
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
    // Storage may be unavailable.
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
    movie.runtimeMinutes !==
      undefined &&
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

    if (item) {
      return item.name
    }
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
          safeNumber(
            b.releaseYear,
          ) -
          safeNumber(
            a.releaseYear,
          )
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
    ].includes(
      movie.contentType,
    )
  }

  if (section === 'tv') {
    return (
      movie.contentType ===
      'tv_show'
    )
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
          <p className="mb-1 text-[10px] font-black uppercase tracking-[0.3em] text-red-500">
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
  liked,
  continueEntry,
  onOpen,
  onToggleMyList,
  onToggleLike,
  onPlay,
}: {
  movie: DisplayMovie
  canonical: CanonicalMovie
  myList: boolean
  liked: boolean
  continueEntry:
    | ContinueWatchingEntry
    | null
  onOpen: (
    movie: DisplayMovie,
  ) => void
  onToggleMyList: (
    id: number,
  ) => void
  onToggleLike: (
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
        className="relative block w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] text-left shadow-2xl transition duration-300 hover:-translate-y-1 hover:border-white/25"
      >
        <div className="aspect-[2/3] overflow-hidden bg-white/5">
          {movie.poster ? (
            <img
              src={movie.poster}
              alt={movie.title}
              loading="lazy"
              className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-950 to-black">
              <Film className="h-10 w-10 text-white/15" />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-black/20 opacity-90" />

          <div className="absolute inset-x-0 bottom-0 p-3">
            <div className="flex items-center gap-2 text-[10px] font-bold text-white/70">
              {canonical.rating !==
                undefined && (
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

              {formatRuntime(
                canonical,
              ) && (
                <span className="flex items-center gap-1">
                  <Clock3 className="h-3 w-3" />
                  {formatRuntime(
                    canonical,
                  )}
                </span>
              )}
            </div>

            <h3 className="mt-1 line-clamp-2 text-sm font-black leading-tight">
              {movie.title}
            </h3>
          </div>

          {canonical.isPmfOriginal && (
            <div className="absolute left-2 top-2 rounded-full bg-red-600 px-2 py-1 text-[8px] font-black uppercase tracking-wider shadow-lg">
              PMF Original
            </div>
          )}

          {canonical.isPremium && (
            <div className="absolute right-2 top-2 rounded-full border border-yellow-400/30 bg-black/80 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-yellow-300">
              Premium
            </div>
          )}

          {progress > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
              <div
                className="h-full bg-red-600"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>
          )}
        </div>
      </button>

      <div className="mt-2 flex gap-1">
        <button
          type="button"
          onClick={() =>
            onPlay(movie)
          }
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-white text-xs font-black text-black transition hover:bg-red-600 hover:text-white"
        >
          <Play className="h-3.5 w-3.5 fill-current" />

          {progress > 0
            ? 'Resume'
            : 'Play'}
        </button>

        <button
          type="button"
          onClick={() =>
            onToggleMyList(
              Number(movie.id),
            )
          }
          aria-label={
            myList
              ? 'Remove from My List'
              : 'Add to My List'
          }
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-white/70 transition hover:border-white/30 hover:text-white"
        >
          {myList ? (
            <Check className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </button>

        <button
          type="button"
          onClick={() =>
            onToggleLike(
              Number(movie.id),
            )
          }
          aria-label={
            liked
              ? 'Unlike'
              : 'Like'
          }
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition ${
            liked
              ? 'border-red-500/30 bg-red-600/20 text-red-400'
              : 'border-white/10 bg-white/[0.05] text-white/50 hover:text-white'
          }`}
        >
          <Heart
            className={`h-4 w-4 ${
              liked
                ? 'fill-current'
                : ''
            }`}
          />
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
  likedIds,
  continueWatchingEntries,
  onOpen,
  onToggleMyList,
  onToggleLike,
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
  likedIds: number[]
  continueWatchingEntries:
    ContinueWatchingEntry[]
  onOpen: (
    movie: DisplayMovie,
  ) => void
  onToggleMyList: (
    id: number,
  ) => void
  onToggleLike: (
    id: number,
  ) => void
  onPlay: (
    movie: DisplayMovie,
  ) => void
}) {
  const [offset, setOffset] =
    useState(0)

  const visibleMovies =
    movies.slice(offset)

  if (!movies.length) {
    return null
  }

  return (
    <section className="mb-12">
      <SectionTitle
        eyebrow={eyebrow}
        title={title}
        action={
          movies.length > 4 ? (
            <div className="hidden gap-2 sm:flex">
              <button
                type="button"
                onClick={() =>
                  setOffset(
                    Math.max(
                      0,
                      offset - 4,
                    ),
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] transition hover:bg-white/10"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() =>
                  setOffset(
                    Math.min(
                      Math.max(
                        0,
                        movies.length -
                          4,
                      ),
                      offset + 4,
                    ),
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] transition hover:bg-white/10"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : undefined
        }
      />

      <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide">
        {visibleMovies.map(
          (canonical) => {
            const id = safeNumber(
              canonical.id,
            )

            const display =
              movieMap.get(id)

            if (!display) {
              return null
            }

            const continueEntry =
              continueWatchingEntries.find(
                (entry) =>
                  entry.id === id,
              ) ?? null

            return (
              <MovieCard
                key={canonical.id}
                movie={display}
                canonical={
                  canonical
                }
                myList={myListIds.includes(
                  id,
                )}
                liked={likedIds.includes(
                  id,
                )}
                continueEntry={
                  continueEntry
                }
                onOpen={onOpen}
                onToggleMyList={
                  onToggleMyList
                }
                onToggleLike={
                  onToggleLike
                }
                onPlay={onPlay}
              />
            )
          },
        )}
      </div>
    </section>
  )
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.025] px-6 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.05] text-white/40">
        {icon}
      </div>

      <h3 className="text-xl font-black">
        {title}
      </h3>

      <p className="mt-2 max-w-md text-sm leading-6 text-white/40">
        {description}
      </p>

      {action && (
        <div className="mt-5">
          {action}
        </div>
      )}
    </div>
  )
 }

export default function App() {
  const [session, setSession] =
    useState<any>(null)

  const [authLoading, setAuthLoading] =
    useState(true)

  const [movies, setMovies] =
    useState<CanonicalMovie[]>([])

  const [
    metadataCatalog,
    setMetadataCatalog,
  ] =
    useState<MetadataCatalog | null>(
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
  ] =
    useState<DisplayMovie | null>(
      null,
    )

  const [
    watchingMovie,
    setWatchingMovie,
  ] =
    useState<DisplayMovie | null>(
      null,
    )

  const [
    myListIds,
    setMyListIds,
  ] = useState<number[]>([])

  const [
    likedIds,
    setLikedIds,
  ] = useState<number[]>([])

  const [
    continueWatchingEntries,
    setContinueWatchingEntries,
  ] =
    useState<ContinueWatchingEntry[]>(
      [],
    )

  const [
    searchQuery,
    setSearchQuery,
  ] = useState('')

  const [
    searchOpen,
    setSearchOpen,
  ] = useState(false)

  const [
    mobileMenuOpen,
    setMobileMenuOpen,
  ] = useState(false)

  const [
    showFilters,
    setShowFilters,
  ] = useState(false)

  const [
    sortMode,
    setSortMode,
  ] = useState<SortMode>('popular')

  const [
    genreFilter,
    setGenreFilter,
  ] = useState('')

  const [
    yearFilter,
    setYearFilter,
  ] = useState('')

  const [
    minRating,
    setMinRating,
  ] = useState('')

  const [
    contentTypeFilter,
    setContentTypeFilter,
  ] = useState('')

  const [
    scrolled,
    setScrolled,
  ] = useState(false)

  const [toast, setToast] =
    useState('')

  const [showPlayer, setShowPlayer] =
    useState(false)

  useEffect(() => {
    let mounted = true

    const loadSession =
      async () => {
        const {
          data,
        } =
          await supabase.auth.getSession()

        if (mounted) {
          setSession(
            data.session,
          )
          setAuthLoading(false)
        }
      }

    loadSession()

    const {
      data: listener,
    } =
      supabase.auth.onAuthStateChange(
        (_event, nextSession) => {
          if (mounted) {
            setSession(
              nextSession,
            )
          }
        },
      )

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const onScroll =
      () => {
        setScrolled(
          window.scrollY > 24,
        )
      }

    window.addEventListener(
      'scroll',
      onScroll,
      { passive: true },
    )

    onScroll()

    return () =>
      window.removeEventListener(
        'scroll',
        onScroll,
      )
  }, [])

  useEffect(() => {
    setMyListIds(
      getMyListIds(),
    )

    setLikedIds(
      getLikedIds(),
    )

    setContinueWatchingEntries(
      getContinueWatchingEntries(),
    )
  }, [])

  useEffect(() => {
    if (!session) {
      setLoading(false)
      return
    }

    let mounted = true

    const loadCatalog =
      async () => {
        try {
          setLoading(true)
          setErrorMessage('')

          const [
            movieResult,
            metadataResult,
          ] = await Promise.all([
            getMovies(),
            getMetadataCatalog(),
          ])

          if (!mounted) return

          setMovies(
            movieResult,
          )

          setMetadataCatalog(
            metadataResult,
          )
        } catch (error) {
          console.error(
            'PMF catalog error:',
            error,
          )

          if (mounted) {
            setErrorMessage(
              'PMF could not load the catalogue. Please refresh and try again.',
            )
          }
        } finally {
          if (mounted) {
            setLoading(false)
          }
        }
      }

    loadCatalog()

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
          async () => {
            try {
              const freshMovies =
                await getMovies()

              if (mounted) {
                setMovies(
                  freshMovies,
                )
              }
            } catch {
              // Keep the existing catalogue.
            }
          },
        )
        .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(
        channel,
      )
    }
  }, [session])

  useEffect(() => {
    const onKeyDown =
      (event: KeyboardEvent) => {
        if (
          event.key === 'Escape'
        ) {
          setSelectedMovie(
            null,
          )
          setWatchingMovie(
            null,
          )
          setShowPlayer(
            false,
          )
          setSearchOpen(
            false,
          )
          setMobileMenuOpen(
            false,
          )
        }
      }

    window.addEventListener(
      'keydown',
      onKeyDown,
    )

    return () =>
      window.removeEventListener(
        'keydown',
        onKeyDown,
      )
  }, [])

  useEffect(() => {
    if (!toast) return

    const timer =
      window.setTimeout(
        () => setToast(''),
        2600,
      )

    return () =>
      window.clearTimeout(
        timer,
      )
  }, [toast])

  const movieMap = useMemo(
    () =>
      new Map(
        movies.map(
          (movie) => [
            safeNumber(
              movie.id,
            ),
            mapCanonicalMovieToLegacy(
              movie,
            ),
          ],
        ),
      ),
    [movies],
  )

  const displayMovies = useMemo(
    () =>
      movies.map(
        (movie) =>
          mapCanonicalMovieToLegacy(
            movie,
          ),
      ),
    [movies],
  )

  const availableYears =
    useMemo(() => {
      return Array.from(
        new Set(
          movies
            .map(
              (movie) =>
                movie.releaseYear,
            )
            .filter(
              (
                year,
              ): year is number =>
                Boolean(year),
            ),
        ),
      ).sort((a, b) => b - a)
    }, [movies])

  const searchResults =
    useMemo(() => {
      const query =
        normalizeText(
          searchQuery,
        )

      if (!query) return []

      return movies.filter(
        (movie) => {
          const people = [
            ...movie.cast.map(
              (person) =>
                person.personId,
            ),
            ...movie.directors.map(
              (person) =>
                person.id,
            ),
            ...movie.writers.map(
              (person) =>
                person.id,
            ),
            ...movie.producers.map(
              (person) =>
                person.id,
            ),
          ]
            .filter(Boolean)
            .join(' ')

          const metadata = [
            ...movie.genres,
            ...movie.subgenres,
            ...movie.tags,
            ...movie.countryIds,
            ...movie.regionIds,
            ...movie.industryIds,
            ...movie.languageIds,
            ...movie.collectionIds,
          ]
            .join(' ')
            .toLowerCase()

          return [
            movie.title,
            movie.originalTitle ??
              '',
            movie.slug,
            movie.synopsis,
            movie.tagline ??
              '',
            people,
            metadata,
          ]
            .join(' ')
            .toLowerCase()
            .includes(query)
        },
      )
    }, [movies, searchQuery])

  const filteredMovies =
    useMemo(() => {
      let result =
        movies.filter(
          (movie) =>
            matchesSection(
              movie,
              section,
            ),
        )

      if (genreFilter) {
        result =
          result.filter(
            (movie) =>
              movie.genres.includes(
                genreFilter,
              ) ||
              movie.subgenres.includes(
                genreFilter,
              ),
          )
      }

      if (yearFilter) {
        result =
          result.filter(
            (movie) =>
              String(
                movie.releaseYear ??
                  '',
              ) ===
              yearFilter,
          )
      }

      if (minRating) {
        result =
          result.filter(
            (movie) =>
              safeNumber(
                movie.rating,
              ) >=
              safeNumber(
                minRating,
              ),
          )
      }

      if (contentTypeFilter) {
        result =
          result.filter(
            (movie) =>
              movie.contentType ===
              contentTypeFilter,
          )
      }

      return sortMovies(
        result,
        sortMode,
      )
    }, [
      movies,
      section,
      genreFilter,
      yearFilter,
      minRating,
      contentTypeFilter,
      sortMode,
    ])

  const trendingMovies =
    useMemo(
      () =>
        sortMovies(
          movies.filter(
            (movie) =>
              movie.isTrending,
          ),
          'popular',
        ),
      [movies],
    )

  const featuredMovies =
    useMemo(
      () =>
        movies.filter(
          (movie) =>
            movie.isFeatured,
        ),
      [movies],
    )

  const newReleases =
    useMemo(
      () =>
        sortMovies(
          movies.filter(
            (movie) =>
              movie.isNewRelease ||
              safeNumber(
                movie.releaseYear,
              ) >=
                new Date().getFullYear() -
                  1,
          ),
          'newest',
        ),
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
        ),
      [movies],
    )

  const topRated =
    useMemo(
      () =>
        sortMovies(
          movies,
          'rating',
        ),
      [movies],
    )

  const popularMovies =
    useMemo(
      () =>
        sortMovies(
          movies,
          'popular',
        ),
      [movies],
    )

  const myListMovies =
    useMemo(
      () =>
        movies.filter(
          (movie) =>
            myListIds.includes(
              safeNumber(
                movie.id,
              ),
            ),
        ),
      [movies, myListIds],
    )

  const continueWatchingMovies =
    useMemo(() => {
      const ordered =
        [...continueWatchingEntries].sort(
          (a, b) =>
            b.updatedAt -
            a.updatedAt,
        )

      return ordered
        .map(
          (entry) =>
            movies.find(
              (movie) =>
                safeNumber(
                  movie.id,
                ) === entry.id,
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

  const recommendedMovies =
    useMemo(() => {
      if (!movies.length) {
        return []
      }

      const likedMovies =
        movies.filter(
          (movie) =>
            likedIds.includes(
              safeNumber(
                movie.id,
              ),
            ),
        )

      const preferredGenres =
        new Set(
          likedMovies.flatMap(
            (movie) =>
              movie.genres,
          ),
        )

      if (!preferredGenres.size) {
        return popularMovies.slice(
          0,
          12,
        )
      }

      return sortMovies(
        movies.filter(
          (movie) =>
            movie.genres.some(
              (genre) =>
                preferredGenres.has(
                  genre,
                ),
            ),
        ),
        'popular',
      ).slice(0, 12)
    }, [
      movies,
      likedIds,
      popularMovies,
    ])

  const heroMovie =
    featuredMovies[0] ??
    trendingMovies[0] ??
    movies[0] ??
    null

  const navigate = (
    value: Section,
  ) => {
    setSection(value)
    setMobileMenuOpen(false)
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  const toggleMyList = (
    id: number,
  ) => {
    setMyListIds(
      (current) => {
        const exists =
          current.includes(id)

        const next = exists
          ? current.filter(
              (item) =>
                item !== id,
            )
          : [
              ...current,
              id,
            ]

        saveMyListIds(next)

        setToast(
          exists
            ? 'Removed from My List'
            : 'Added to My List',
        )

        return next
      },
    )
  }

  const toggleLike = (
    id: number,
  ) => {
    setLikedIds(
      (current) => {
        const exists =
          current.includes(id)

        const next = exists
          ? current.filter(
              (item) =>
                item !== id,
            )
          : [
              ...current,
              id,
            ]

        saveLikedIds(next)

        setToast(
          exists
            ? 'Removed from favourites'
            : 'Added to favourites',
        )

        return next
      },
    )
  }

  const openMovie = (
    movie: DisplayMovie,
  ) => {
    setSelectedMovie(
      movie,
    )

    saveRecentlyViewedId(
      Number(movie.id),
    )
  }

  const playMovie = (
    movie: DisplayMovie,
  ) => {
    setWatchingMovie(
      movie,
    )

    setShowPlayer(true)

    saveRecentlyViewedId(
      Number(movie.id),
    )
  }

  const handleTimeUpdate = (
    currentTime: number,
  ) => {
    if (!watchingMovie) {
      return
    }

    const canonical =
      movies.find(
        (movie) =>
          safeNumber(
            movie.id,
          ) ===
          safeNumber(
            watchingMovie.id,
          ),
      )

    const runtime =
      canonical?.runtimeMinutes
        ? canonical.runtimeMinutes *
          60
        : 0

    if (
      runtime <= 0 ||
      currentTime <= 0
    ) {
      return
    }

    saveContinueWatching(
      Number(
        watchingMovie.id,
      ),
      currentTime,
      runtime,
    )

    setContinueWatchingEntries(
      getContinueWatchingEntries(),
    )
  }

  const handleEnded = () => {
    if (!watchingMovie) {
      return
    }

    removeContinueWatching(
      Number(
        watchingMovie.id,
      ),
    )

    setContinueWatchingEntries(
      getContinueWatchingEntries(),
    )

    setToast(
      'You finished watching this title.',
    )
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setSelectedMovie(null)
    setWatchingMovie(null)
    setShowPlayer(false)
  }

  if (authLoading) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-2 border-white/10 border-t-red-600" />
            <p className="text-sm font-bold text-white/50">
              Preparing PMF...
            </p>
          </div>
        </div>
      </AppShell>
    )
  }

  if (!session) {
    return <AuthScreen />
  }

  return (
    <AppShell>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'border-b border-white/10 bg-black/90 backdrop-blur-2xl'
            : 'bg-gradient-to-b from-black/90 via-black/50 to-transparent'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-4 sm:h-20 sm:px-6 lg:px-10">
          <button
            type="button"
            onClick={() =>
              navigate('home')
            }
            className="group shrink-0"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 shadow-lg shadow-red-600/20 transition group-hover:scale-105">
                <Film className="h-5 w-5" />
              </div>

              <div className="hidden sm:block">
                <div className="text-lg font-black tracking-tight">
                  PMF
                  <span className="text-red-500">
                    LIX
                  </span>
                </div>

                <div className="-mt-1 text-[7px] font-bold uppercase tracking-[0.3em] text-white/35">
                  Prince Mufasa Flix
                </div>
              </div>
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
                    navigate(
                      value,
                    )
                  }
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition ${
                    section ===
                    value
                      ? 'bg-white/10 text-white'
                      : 'text-white/45 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ),
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div
              className={`hidden items-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.05] transition-all sm:flex ${
                searchOpen
                  ? 'w-72'
                  : 'w-10'
              }`}
            >
              <button
                type="button"
                onClick={() =>
                  setSearchOpen(
                    true,
                  )
                }
                className="flex h-10 w-10 shrink-0 items-center justify-center text-white/60 hover:text-white"
              >
                <Search className="h-4 w-4" />
              </button>

              {searchOpen && (
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(event) =>
                    setSearchQuery(
                      event.target
                        .value,
                    )
                  }
                  onFocus={() =>
                    setSearchOpen(
                      true,
                    )
                  }
                  placeholder="Search movies, actors, genres..."
                  className="min-w-0 flex-1 bg-transparent pr-3 text-xs font-medium text-white outline-none placeholder:text-white/25"
                />
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                setSearchOpen(
                  (value) =>
                    !value,
                )
              }
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:text-white sm:hidden"
            >
              <Search className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() =>
                setMobileMenuOpen(
                  (value) =>
                    !value,
                )
              }
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={signOut}
              title="Sign out"
              className="hidden h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/50 transition hover:text-white sm:flex"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-white/10 bg-black/95 px-4 py-4 backdrop-blur-2xl lg:hidden">
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
                      navigate(
                        value,
                      )
                    }
                    className={`flex items-center gap-3 rounded-xl p-3 text-left text-sm font-bold ${
                      section ===
                      value
                        ? 'bg-red-600 text-white'
                        : 'bg-white/[0.05] text-white/60'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ),
              )}

              <button
                type="button"
                onClick={signOut}
                className="col-span-2 flex items-center gap-3 rounded-xl bg-white/[0.05] p-3 text-left text-sm font-bold text-white/60"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>

            <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <Search className="h-4 w-4 text-white/40" />
              <input
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(
                    event.target.value,
                  )
                }
                placeholder="Search PMF..."
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/25"
              />
            </div>
          </div>
        )}

        {searchQuery &&
          searchResults.length > 0 && (
            <div className="absolute inset-x-0 top-full border-t border-white/10 bg-black/95 backdrop-blur-2xl">
              <div className="mx-auto max-w-4xl px-4 py-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-wider text-white/40">
                    Search results
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      setSearchQuery(
                        '',
                      )
                    }
                    className="text-white/40 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {searchResults
                    .slice(0, 8)
                    .map(
                      (
                        canonical,
                      ) => {
                        const display =
                          movieMap.get(
                            safeNumber(
                              canonical.id,
                            ),
                          )

                        if (!display) {
                          return null
                        }

                        return (
                          <button
                            key={
                              canonical.id
                            }
                            type="button"
                            onClick={() => {
                              openMovie(
                                display,
                              )
                              setSearchQuery(
                                '',
                              )
                              setSearchOpen(
                                false,
                              )
                            }}
                            className="flex items-center gap-3 rounded-xl bg-white/[0.05] p-2 text-left transition hover:bg-white/10"
                          >
                            <div className="h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-white/10">
                              {display.poster && (
                                <img
                                  src={
                                    display.poster
                                  }
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              )}
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-black">
                                {
                                  canonical.title
                                }
                              </p>

                              <p className="mt-1 truncate text-xs text-white/40">
                                {
                                  canonical.contentType
                                }{' '}
                                •{' '}
                                {canonical.releaseYear ??
                                  '—'}
                              </p>
                            </div>
                          </button>
                        )
                      },
                    )}
                </div>
              </div>
            </div>
          )}
      </header>

      <main className="pb-24 lg:pb-10">
        {loading ? (
          <div className="flex min-h-screen items-center justify-center px-6 pt-20">
            <div className="text-center">
              <div className="mx-auto mb-6 h-14 w-14 animate-spin rounded-full border-2 border-white/10 border-t-red-600" />

              <h2 className="text-xl font-black">
                Loading PMF
              </h2>

              <p className="mt-2 text-sm text-white/40">
                Building your cinematic world...
              </p>
            </div>
          </div>
        ) : errorMessage ? (
          <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-6 pt-20 text-center">
            <EmptyState
              icon={
                <Info className="h-7 w-7" />
              }
              title="PMF needs a moment"
              description={
                errorMessage
              }
              action={
                <button
                  type="button"
                  onClick={() =>
                    window.location.reload()
                  }
                  className="rounded-xl bg-white px-5 py-3 text-sm font-black text-black hover:bg-red-600 hover:text-white"
                >
                  Refresh PMF
                </button>
              }
            />
          </div>
        ) : (
          <>
            {section ===
              'home' && (
              <>
                <section className="relative min-h-[680px] overflow-hidden sm:min-h-[760px]">
                  <div className="absolute inset-0">
                    <img
                      src={
                        heroMovie?.backdropUrl ||
                        heroImage
                      }
                      alt=""
                      className="h-full w-full object-cover object-center"
                    />

                    <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/20" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-transparent to-black/30" />
                  </div>

                  <div className="relative mx-auto flex min-h-[680px] max-w-[1600px] items-end px-5 pb-20 pt-32 sm:min-h-[760px] sm:px-8 sm:pb-28 lg:px-12">
                    <div className="max-w-2xl">
                      <div className="mb-5 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-red-600 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em]">
                          Featured Film
                        </span>

                        {heroMovie?.isPmfOriginal && (
                          <span className="rounded-full border border-white/20 bg-black/30 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-white/70 backdrop-blur">
                            PMF Original
                          </span>
                        )}

                        {heroMovie?.releaseYear && (
                          <span className="text-xs font-bold text-white/50">
                            {
                              heroMovie.releaseYear
                            }
                          </span>
                        )}
                      </div>

                      <h1 className="max-w-3xl text-5xl font-black tracking-[-0.05em] sm:text-7xl lg:text-8xl">
                        {heroMovie?.title ||
                          'Your World. Your Stories. Your Flix.'}
                      </h1>

                      {heroMovie?.tagline && (
                        <p className="mt-4 text-lg font-bold text-white/75 sm:text-xl">
                          {
                            heroMovie.tagline
                          }
                        </p>
                      )}

                      <p className="mt-5 max-w-xl text-sm leading-7 text-white/55 sm:text-base">
                        {heroMovie?.synopsis ||
                          'Discover cinematic stories, original productions and unforgettable entertainment on PMF.'}
                      </p>

                      {heroMovie && (
                        <div className="mt-7 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              const display =
                                movieMap.get(
                                  safeNumber(
                                    heroMovie.id,
                                  ),
                                )

                              if (
                                display
                              ) {
                                playMovie(
                                  display,
                                )
                              }
                            }}
                            className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-red-600 hover:text-white"
                          >
                            <Play className="h-4 w-4 fill-current" />
                            Watch Now
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const display =
                                movieMap.get(
                                  safeNumber(
                                    heroMovie.id,
                                  ),
                                )

                              if (
                                display
                              ) {
                                openMovie(
                                  display,
                                )
                              }
                            }}
                            className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-black backdrop-blur transition hover:bg-white/20"
                          >
                            <Info className="h-4 w-4" />
                            More Info
                          </button>
                        </div>
                      )}

                      <div className="mt-8 flex flex-wrap items-center gap-4 text-xs font-bold text-white/45">
                        {heroMovie?.rating !==
                          undefined && (
                          <span className="flex items-center gap-1 text-white/75">
                            <Star className="h-3.5 w-3.5 fill-current text-yellow-400" />
                            {
                              heroMovie.rating
                            }
                          </span>
                        )}

                        {heroMovie &&
                          formatRuntime(
                            heroMovie,
                          ) && (
                            <span className="flex items-center gap-1">
                              <Clock3 className="h-3.5 w-3.5" />
                              {formatRuntime(
                                heroMovie,
                              )}
                            </span>
                          )}

                        {heroMovie?.genres
                          .slice(
                            0,
                            3,
                          )
                          .map(
                            (genre) => (
                              <span
                                key={
                                  genre
                                }
                                className="rounded-full border border-white/10 px-2 py-1"
                              >
                                {metadataName(
                                  metadataCatalog,
                                  genre,
                                )}
                              </span>
                            ),
                          )}
                      </div>
                    </div>
                  </div>
                </section>

                <div className="mx-auto max-w-[1600px] px-5 pt-12 sm:px-8 lg:px-12">
  {continueWatchingMovies.length > 0 && (
    <MovieRail
      eyebrow="Pick up where you left off"
      title="Continue Watching"
      movies={continueWatchingMovies}
      movieMap={movieMap}
      myListIds={myListIds}
      likedIds={likedIds}
      continueWatchingEntries={continueWatchingEntries}
      onOpen={openMovie}
      onToggleMyList={toggleMyList}
      onToggleLike={toggleLike}
      onPlay={playMovie}
    />
  )}
</div>
</>
)}

{section !== 'home' && (
  <div className="mx-auto max-w-[1600px] px-5 pt-28 sm:px-8 lg:px-12">
    <SectionTitle
      eyebrow="Explore PMF"
      title={
        section === 'my-list'
          ? 'My List'
          : section === 'tv'
            ? 'TV Series'
            : 'Movies'
      }
      description={
        section === 'my-list'
          ? 'Your personal collection of stories you want to watch.'
          : 'Explore the PMF catalogue with global discovery, filters and smart sorting.'
      }
      action={
        section !== 'my-list' && (
          <button
            type="button"
            onClick={() =>
              setShowFilters((value) => !value)
            }
            className={`hidden items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black transition sm:flex ${
              showFilters
                ? 'border-red-500/30 bg-red-600/15 text-red-400'
                : 'border-white/10 bg-white/[0.04] text-white/60 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </button>
        )
      }
    />

                {section !==
                  'my-list' && (
                  <div className="mb-8 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setShowFilters(
                          (
                            value,
                          ) =>
                            !value,
                        )
                      }
                      className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-black text-white/70 sm:hidden"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      Filters
                    </button>

                    <select
                      value={
                        sortMode
                      }
                      onChange={(
                        event,
                      ) =>
                        setSortMode(
                          event
                            .target
                            .value as SortMode,
                        )
                      }
                      className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-bold text-white outline-none"
                    >
                      <option
                        value="popular"
                        className="bg-black"
                      >
                        Most Popular
                      </option>
                      <option
                        value="newest"
                        className="bg-black"
                      >
                        Newest
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
                        A-Z
                      </option>
                    </select>

                    <span className="ml-auto text-xs font-bold text-white/30">
                      {
                        filteredMovies.length
                      }{' '}
                      titles
                    </span>
                  </div>
                )}

                {showFilters &&
                  section !==
                    'my-list' && (
                    <div className="mb-8 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:grid-cols-2 lg:grid-cols-4">
                      <select
                        value={
                          genreFilter
                        }
                        onChange={(
                          event,
                        ) =>
                          setGenreFilter(
                            event
                              .target
                              .value,
                          )
                        }
                        className="rounded-xl border border-white/10 bg-black/50 px-3 py-3 text-xs font-bold text-white outline-none"
                      >
                        <option
                          value=""
                          className="bg-black"
                        >
                          All Genres
                        </option>

                        {metadataCatalog?.genres.map(
                          (
<div className="mx-auto max-w-[1600px] px-5 pt-12 sm:px-8 lg:px-12">
  {continueWatchingMovies.length > 0 && (
    <MovieRail
      eyebrow="Pick up where you left off"
      title="Continue Watching"
      movies={continueWatchingMovies}
      movieMap={movieMap}
      myListIds={myListIds}
      likedIds={likedIds}
      continueWatchingEntries={continueWatchingEntries}
      onOpen={openMovie}
      onToggleMyList={toggleMyList}
      onToggleLike={toggleLike}
      onPlay={playMovie}
    />
  )}

  {newReleases.length > 0 && (
    <MovieRail
      eyebrow="Fresh from PMF"
      title="New Releases"
      movies={newReleases}
      movieMap={movieMap}
      myListIds={myListIds}
      likedIds={likedIds}
      continueWatchingEntries={continueWatchingEntries}
      onOpen={openMovie}
      onToggleMyList={toggleMyList}
      onToggleLike={toggleLike}
      onPlay={playMovie}
    />
  )}

  {pmfOriginals.length > 0 && (
    <MovieRail
      eyebrow="Made for PMF"
      title="PMF Originals"
      movies={pmfOriginals}
      movieMap={movieMap}
      myListIds={myListIds}
      likedIds={likedIds}
      continueWatchingEntries={continueWatchingEntries}
      onOpen={openMovie}
      onToggleMyList={toggleMyList}
      onToggleLike={toggleLike}
      onPlay={playMovie}
    />
  )}

  {topRated.length > 0 && (
    <MovieRail
      eyebrow="Critically loved"
      title="Top Rated"
      movies={topRated}
      movieMap={movieMap}
      myListIds={myListIds}
      likedIds={likedIds}
      continueWatchingEntries={continueWatchingEntries}
      onOpen={openMovie}
      onToggleMyList={toggleMyList}
      onToggleLike={toggleLike}
      onPlay={playMovie}
    />
  )}

  {recommendedMovies.length > 0 && (
    <MovieRail
      eyebrow="Picked for you"
      title="Recommended for You"
      movies={recommendedMovies}
      movieMap={movieMap}
      myListIds={myListIds}
      likedIds={likedIds}
      continueWatchingEntries={continueWatchingEntries}
      onOpen={openMovie}
      onToggleMyList={toggleMyList}
      onToggleLike={toggleLike}
      onPlay={playMovie}
    />
  )}
</div>

</>
)}

{section !== 'home' && (
  <div className="mx-auto max-w-[1600px] px-5 pt-28 sm:px-8 lg:px-12">
    <SectionTitle
      eyebrow="Explore PMF"
      title={
        section === 'my-list'
          ? 'My List'
          : section === 'tv'
            ? 'TV Series'
            : 'Movies'
      }
      description={
        section === 'my-list'
          ? 'Your personal collection of stories you want to watch.'
          : 'Explore the PMF catalogue with global discovery, filters and smart sorting.'
      }
      action={
        section !== 'my-list' && (
          <button
            type="button"
            onClick={() =>
              setShowFilters((value) => !value)
            }
            className={`hidden items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black transition sm:flex ${
              showFilters
                ? 'border-red-500/30 bg-red-600/15 text-red-400'
                : 'border-white/10 bg-white/[0.04] text-white/60 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </button>
        )
      }
    />

    {section !== 'my-list' && (
      <div className="mb-8 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            setShowFilters((value) => !value)
          }
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-black text-white/70 sm:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
        </button>

        <select
          value={sortMode}
          onChange={(event) =>
            setSortMode(event.target.value as SortMode)
          }
          className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-bold text-white outline-none"
        >
          <option value="popular" className="bg-black">
            Most Popular
          </option>
          <option value="newest" className="bg-black">
            Newest
          </option>
          <option value="rating" className="bg-black">
            Highest Rated
          </option>
          <option value="title" className="bg-black">
            A-Z
          </option>
        </select>

        <span className="ml-auto text-xs font-bold text-white/30">
          {filteredMovies.length} titles
        </span>
      </div>
    )}

    {showFilters && section !== 'my-list' && (
      <div className="mb-8 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:grid-cols-2 lg:grid-cols-4">
        <select
          value={genreFilter}
          onChange={(event) =>
            setGenreFilter(event.target.value)
          }
          className="rounded-xl border border-white/10 bg-black/50 px-3 py-3 text-xs font-bold text-white outline-none"
        >
          <option value="" className="bg-black">
            All Genres
          </option>

          {metadataCatalog?.genres.map((genre) => (
            <option
              key={genre.id}
              value={genre.id}
              className="bg-black"
            >
              {genre.name}
            </option>
          ))}
        </select>

        <select
          value={yearFilter}
          onChange={(event) =>
            setYearFilter(event.target.value)
          }
          className="rounded-xl border border-white/10 bg-black/50 px-3 py-3 text-xs font-bold text-white outline-none"
        >
          <option value="" className="bg-black">
            All Years
          </option>

                        {availableYears.map(
                          (
                            year,
                          ) => (
                            <option
                              key={
                                year
                              }
                              value={
                                year
                              }
                              className="bg-black"
                            >
                              {
                                year
                              }
                            </option>
                          ),
                        )}
                      </select>

                      <select
                        value={
                          minRating
                        }
                        onChange={(
                          event,
                        ) =>
                          setMinRating(
                            event
                              .target
                              .value,
                          )
                        }
                        className="rounded-xl border border-white/10 bg-black/50 px-3 py-3 text-xs font-bold text-white outline-none"
                      >
                        <option
                          value=""
                          className="bg-black"
                        >
                          Any Rating
                        </option>
                        <option
                          value="8"
                          className="bg-black"
                        >
                          8.0+
                        </option>
                        <option
                          value="7"
                          className="bg-black"
                        >
                          7.0+
                        </option>
                        <option
                          value="6"
                          className="bg-black"
                        >
                          6.0+
                        </option>
                      </select>

                      <select
                        value={
                          contentTypeFilter
                        }
                        onChange={(
                          event,
                        ) =>
                          setContentTypeFilter(
                            event
                              .target
                              .value,
                          )
                        }
                        className="rounded-xl border border-white/10 bg-black/50 px-3 py-3 text-xs font-bold text-white outline-none"
                      >
                        <option
                          value=""
                          className="bg-black"
                        >
                          All Content
                        </option>
                        <option
                          value="movie"
                          className="bg-black"
                        >
                          Movies
                        </option>
                        <option
                          value="tv_show"
                          className="bg-black"
                        >
                          TV Series
                        </option>
                        <option
                          value="documentary"
                          className="bg-black"
                        >
                          Documentaries
                        </option>
                        <option
                          value="short_film"
                          className="bg-black"
                        >
                          Short Films
                        </option>
                      </select>
                    </div>
                  )}

                {section ===
                'my-list' ? (
                  myListMovies.length >
                  0 ? (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-5 xl:grid-cols-6">
                      {myListMovies.map(
                        (
                          canonical,
                        ) => {
                          const display =
                            movieMap.get(
                              safeNumber(
                                canonical.id,
                              ),
                            )

                          if (
                            !display
                          ) {
                            return null
                          }

                          return (
                            <MovieCard
                              key={
                                canonical.id
                              }
                              movie={
                                display
                              }
                              canonical={
                                canonical
                              }
                              myList={
                                true
                              }
                              liked={likedIds.includes(
                                safeNumber(
                                  canonical.id,
                                ),
                              )}
                              continueEntry={
                                continueWatchingEntries.find(
                                  (
                                    entry,
                                  ) =>
                                    entry.id ===
                                    safeNumber(
                                      canonical.id,
                                    ),
                                ) ??
                                null
                              }
                              onOpen={
                                openMovie
                              }
                              onToggleMyList={
                                toggleMyList
                              }
                              onToggleLike={
                                toggleLike
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
                    <EmptyState
                      icon={
                        <Bookmark className="h-7 w-7" />
                      }
                      title="Your My List is empty"
                      description="Save movies and series here so your next great watch is always close."
                      action={
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              'movies',
                            )
                          }
                          className="rounded-xl bg-white px-5 py-3 text-xs font-black text-black hover:bg-red-600 hover:text-white"
                        >
                          Explore PMF
                        </button>
                      }
                    />
                  )
                ) : filteredMovies.length >
                  0 ? (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-5 xl:grid-cols-6">
                    {filteredMovies.map(
                      (
                        canonical,
                      ) => {
                        const display =
                          movieMap.get(
                            safeNumber(
                              canonical.id,
                            ),
                          )

                        if (!display) {
                          return null
                        }

                        return (
                          <MovieCard
                            key={
                              canonical.id
                            }
                            movie={
                              display
                            }
                            canonical={
                              canonical
                            }
                            myList={myListIds.includes(
                              safeNumber(
                                canonical.id,
                              ),
                            )}
                            liked={likedIds.includes(
                              safeNumber(
                                canonical.id,
                              ),
                            )}
                            continueEntry={
                              continueWatchingEntries.find(
                                (
                                  entry,
                                ) =>
                                  entry.id ===
                                  safeNumber(
                                    canonical.id,
                                  ),
                              ) ??
                              null
                            }
                            onOpen={
                              openMovie
                            }
                            onToggleMyList={
                              toggleMyList
                            }
                            onToggleLike={
                              toggleLike
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
                  <EmptyState
                    icon={
                      <Search className="h-7 w-7" />
                    }
                    title="Nothing found"
                    description="Try another filter, search term or content type."
                    action={
                      <button
                        type="button"
                        onClick={() => {
                          setGenreFilter(
                            '',
                          )
                          setYearFilter(
                            '',
                          )
                          setMinRating(
                            '',
                          )
                          setContentTypeFilter(
                            '',
                          )
                        }}
                        className="rounded-xl bg-white px-5 py-3 text-xs font-black text-black hover:bg-red-600 hover:text-white"
                      >
                        Clear Filters
                      </button>
                    }
                  />
                )}
              </div>
            )}
          </>
        )}
      </main>

                      {selectedMovie && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/90 backdrop-blur-xl">
          <div className="min-h-full px-0 py-0 sm:px-6 sm:py-10">
            <div className="relative mx-auto min-h-screen max-w-5xl overflow-hidden bg-[#080808] shadow-2xl sm:min-h-0 sm:rounded-3xl sm:border sm:border-white/10">
              <button
                type="button"
                onClick={() =>
                  setSelectedMovie(
                    null,
                  )
                }
                className="absolute right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white/70 backdrop-blur hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="relative aspect-[16/10] max-h-[520px] overflow-hidden">
                {(() => {
                  const canonical =
                    movies.find(
                      (movie) =>
                        safeNumber(
                          movie.id,
                        ) ===
                        safeNumber(
                          selectedMovie.id,
                        ),
                    )

                  const backdrop =
                    canonical?.backdropUrl ||
                    selectedMovie.poster ||
                    heroImage

                  return (
                    <>
                      <img
                        src={
                          backdrop
                        }
                        alt=""
                        className="h-full w-full object-cover"
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-black/30 to-black/10" />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
                    </>
                  )
                })()}

                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {movies.find(
                      (movie) =>
                        safeNumber(
                          movie.id,
                        ) ===
                        safeNumber(
                          selectedMovie.id,
                        ),
                    )?.isPmfOriginal && (
                      <span className="rounded-full bg-red-600 px-2.5 py-1 text-[8px] font-black uppercase tracking-wider">
                        PMF Original
                      </span>
                    )}

                    {selectedMovie.year && (
                      <span className="text-xs font-bold text-white/60">
                        {
                          selectedMovie.year
                        }
                      </span>
                    )}

                    {selectedMovie.rating && (
                      <span className="flex items-center gap-1 text-xs font-bold text-white/60">
                        <Star className="h-3 w-3 fill-current text-yellow-400" />
                        {
                          selectedMovie.rating
                        }
                      </span>
                    )}
                  </div>

                  <h2 className="max-w-3xl text-4xl font-black tracking-tight sm:text-6xl">
                    {
                      selectedMovie.title
                    }
                  </h2>
                </div>
              </div>

              <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[1fr_280px]">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const current =
                          selectedMovie

                        setSelectedMovie(
                          null,
                        )

                        playMovie(
                          current,
                        )
                      }}
                      className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-black hover:bg-red-600 hover:text-white"
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
                      className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-black hover:bg-white/10"
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

                    <button
                      type="button"
                      onClick={() =>
                        toggleLike(
                          Number(
                            selectedMovie.id,
                          ),
                        )
                      }
                      className={`flex h-11 w-11 items-center justify-center rounded-xl border ${
                        likedIds.includes(
                          Number(
                            selectedMovie.id,
                          ),
                        )
                          ? 'border-red-500/30 bg-red-600/15 text-red-400'
                          : 'border-white/10 bg-white/[0.05] text-white/60'
                      }`}
                    >
                      <Heart
                        className={`h-4 w-4 ${
                          likedIds.includes(
                            Number(
                              selectedMovie.id,
                            ),
                          )
                            ? 'fill-current'
                            : ''
                        }`}
                      />
                    </button>

                    {selectedMovie.trailerUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          playMovie({
                            ...selectedMovie,
                            videoUrl:
                              selectedMovie.trailerUrl,
                          })
                        }
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-black text-white/70 hover:text-white"
                      >
                        <Sparkles className="h-4 w-4" />
                        Trailer
                      </button>
                    )}
                  </div>

                  <p className="mt-7 text-sm leading-7 text-white/60">
                    {
                      selectedMovie.description
                    }
                  </p>

                  {(() => {
                    const canonical =
                      movies.find(
                        (movie) =>
                          safeNumber(
                            movie.id,
                          ) ===
                          safeNumber(
                            selectedMovie.id,
                          ),
                      )

                    if (!canonical) {
                      return null
                    }

                    return (
                      <div className="mt-7 space-y-5">
                        <div className="flex flex-wrap gap-2">
                          {canonical.genres.map(
                            (genre) => (
                              <span
                                key={
                                  genre
                                }
                                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] font-bold text-white/50"
                              >
                                {metadataName(
                                  metadataCatalog,
                                  genre,
                                )}
                              </span>
                            ),
                          )}
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                            <p className="text-[9px] font-black uppercase tracking-wider text-white/25">
                              Content
                            </p>
                            <p className="mt-1 text-sm font-bold">
                              {
                                canonical.contentType
                              }
                            </p>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                            <p className="text-[9px] font-black uppercase tracking-wider text-white/25">
                              Runtime
                            </p>
                            <p className="mt-1 text-sm font-bold">
                              {formatRuntime(
                                canonical,
                              ) ||
                                'Not specified'}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                            <p className="text-[9px] font-black uppercase tracking-wider text-white/25">
                              Languages
                            </p>
                            <p className="mt-1 text-sm font-bold">
                              {canonical.languageIds
                                .slice(
                                  0,
                                  3,
                                )
                                .map(
                                  (
                                    id,
                                  ) =>
                                    metadataName(
                                      metadataCatalog,
                                      id,
                                    ),
                                )
                                .join(
                                  ', ',
                                ) ||
                                'Not specified'}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                            <p className="text-[9px] font-black uppercase tracking-wider text-white/25">
                              Country
                            </p>
                            <p className="mt-1 text-sm font-bold">
                              {canonical.countryIds
                                .slice(
                                  0,
                                  3,
                                )
                                .map(
                                  (
                                    id,
                                  ) =>
                                    metadataName(
                                      metadataCatalog,
                                      id,
                                    ),
                                )
                                .join(
                                  ', ',
                                ) ||
                                'Not specified'}
                            </p>
                          </div>
                        </div>

                        {(canonical.cast.length >
                          0 ||
                          canonical.directors
                            .length >
                            0) && (
                          <div>
                            <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-white/25">
                              Cast & Crew
                            </p>

                            <div className="flex flex-wrap gap-2">
                              {canonical.cast
                                .slice(
                                  0,
                                  8,
                                )
                                .map(
                                  (
                                    member,
                                  ) => (
                                    <span
                                      key={`${member.personId}-${member.characterName ?? ''}`}
                                      className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-bold text-white/50"
                                    >
                                      {
                                        member.personId
                                      }
                                    </span>
                                  ),
                                )}

                              {canonical.directors
                                .slice(
                                  0,
                                  4,
                                )
                                .map(
                                  (
                                    director,
                                  ) => (
                                    <span
                                      key={
                                        director.id
                                      }
                                      className="rounded-lg border border-red-500/20 bg-red-600/10 px-3 py-2 text-[10px] font-bold text-red-300"
                                    >
                                      Director:{' '}
                                      {
                                        director.id
                                      }
                                    </span>
                                  ),
                                )}
                            </div>
                          </div>
                        )}

                        {canonical.downloadAvailability
                          ?.available &&
                          canonical
                            .downloadAvailability
                            .url && (
                            <a
                              href={
                                canonical
                                  .downloadAvailability
                                  .url
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-xs font-black text-white/70 hover:bg-white/10 hover:text-white"
                            >
                              <Download className="h-4 w-4" />
                              Download
                            </a>
                          )}
                      </div>
                    )
                  })()}
                </div>

                <aside className="space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-red-500" />
                      <p className="text-xs font-black">
                        PMF Experience
                      </p>
                    </div>

                    <div className="space-y-4 text-xs text-white/45">
                      <div className="flex items-center gap-3">
                        <Globe2 className="h-4 w-4 text-white/25" />
                        Global catalogue
                      </div>

                      <div className="flex items-center gap-3">
                        <Play className="h-4 w-4 text-white/25" />
                        Resume playback
                      </div>

                      <div className="flex items-center gap-3">
                        <Bookmark className="h-4 w-4 text-white/25" />
                        Personal My List
                      </div>

                      <div className="flex items-center gap-3">
                        <Heart className="h-4 w-4 text-white/25" />
                        Smart recommendations
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPlayer &&
        watchingMovie && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/95 p-0 sm:p-5">
            <button
              type="button"
              onClick={() => {
                setShowPlayer(
                  false,
                )
                setWatchingMovie(
                  null,
                )
                setContinueWatchingEntries(
                  getContinueWatchingEntries(),
                )
              }}
              className="absolute right-4 top-4 z-[100] flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white/70 backdrop-blur hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="w-full max-w-7xl overflow-hidden rounded-none border border-white/10 bg-black shadow-2xl sm:rounded-2xl">
              {(() => {
                const videoUrl =
                  getMovieVideoUrl(
                    watchingMovie,
                  )

                if (
                  videoUrl &&
                  isYouTubeUrl(
                    videoUrl,
                  )
                ) {
                  return (
                    <div className="aspect-video bg-black">
                      <iframe
                        src={getYouTubeEmbedUrl(
                          videoUrl,
                        )}
                        title={
                          watchingMovie.title
                        }
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowFullScreen
                        className="h-full w-full border-0"
                      />
                    </div>
                  )
                }

                   if (videoUrl) {
                  const entry =
                    continueWatchingEntries.find(
                      (
                        item,
                      ) =>
                        item.id ===
                        Number(
                          watchingMovie.id,
                        ),
                    )

                  return (
                    <VideoPlayer
                      videoUrl={
                        videoUrl
                      }
                      videoAssets={
                        movies.find(
                          (
                            movie,
                          ) =>
                            safeNumber(
                              movie.id,
                            ) ===
                            safeNumber(
                              watchingMovie.id,
                            ),
                        )
                          ?.videoAssets
                      }
                      subtitles={
                        movies.find(
                          (
                            movie,
                          ) =>
                            safeNumber(
                              movie.id,
                            ) ===
                            safeNumber(
                              watchingMovie.id,
                            ),
                        )
                          ?.subtitles
                      }
                      posterUrl={
                        watchingMovie.poster
                      }
                      title={
                        watchingMovie.title
                      }
                      autoPlay
                      initialTime={
                        entry?.position ??
                        0
                      }
                      onTimeUpdate={
                        handleTimeUpdate
                      }
                      onEnded={
                        handleEnded
                      }
                    />
                  )
                }

                return (
                  <div className="flex aspect-video flex-col items-center justify-center bg-gradient-to-br from-zinc-950 via-black to-red-950/20 px-6 text-center">
                    <Film className="mb-5 h-12 w-12 text-white/15" />

                    <h3 className="text-xl font-black">
                      Video coming soon
                    </h3>

                    <p className="mt-2 max-w-md text-sm leading-6 text-white/40">
                      The title is in the PMF catalogue, but a licensed playback asset has not been connected yet.
                    </p>
                  </div>
                )
              })()}
            </div>
          </div>
        )}

      {toast && (
        <div className="fixed bottom-20 left-1/2 z-[120] -translate-x-1/2 rounded-full border border-white/10 bg-black/90 px-5 py-3 text-xs font-black text-white shadow-2xl backdrop-blur-xl lg:bottom-8">
          {toast}
        </div>
      )}

      <footer className="border-t border-white/5 bg-black/60 px-5 py-12 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600">
                <Film className="h-5 w-5" />
              </div>

              <div className="text-xl font-black">
                PMF
                <span className="text-red-500">
                  LIX
                </span>
              </div>
            </div>

            <p className="mt-3 max-w-md text-xs leading-6 text-white/30">
              Your World. Your Stories. Your Flix.
              <br />
              A cinematic entertainment platform built for global stories.
            </p>
          </div>

          <div className="text-xs text-white/25 sm:text-right">
            <p>
              © {new Date().getFullYear()} Prince Mufasa Flix
            </p>
            <p className="mt-1">
              Built for the next generation of streaming.
            </p>
          </div>
        </div>
      </footer>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-black/90 px-2 py-2 backdrop-blur-2xl lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4">
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
                  navigate(
                    value,
                  )
                }
                className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[9px] font-black transition ${
                  section ===
                  value
                    ? 'text-red-500'
                    : 'text-white/35'
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${
                    section ===
                    value
                      ? 'fill-current'
                      : ''
                  }`}
                />
                {label}
              </button>
            ),
          )}
        </div>
      </div>
    </AppShell>
  )
 }
                
                  
  
