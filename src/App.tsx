import heroImage from './assets/hero.png'
import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'

import {
  ArrowRight,
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
  Sparkles,
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

import {
  filterMovies,
} from './utils/movieFilters'

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

type DiscoveryFilters = {
  title: string
  actor: string
  director: string
  genreIds: string[]
  subgenreIds: string[]
  countryIds: string[]
  regionIds: string[]
  industryIds: string[]
  languageIds: string[]
  collectionIds: string[]
  tags: string[]
  year: string
  minRating: string
  contentType: '' | CanonicalMovie['contentType']
  quality: '' | CanonicalMovie['videoQualities'][number]
}

type DisplayMovie =
  ReturnType<typeof mapCanonicalMovieToLegacy>

type ContinueWatchingEntry = {
  id: number
  position: number
  duration: number
  updatedAt: number
}

const EMPTY_FILTERS: DiscoveryFilters = {
  title: '',
  actor: '',
  director: '',
  genreIds: [],
  subgenreIds: [],
  countryIds: [],
  regionIds: [],
  industryIds: [],
  languageIds: [],
  collectionIds: [],
  tags: [],
  year: '',
  minRating: '',
  contentType: '',
  quality: '',
}

const MY_LIST_STORAGE_KEY = 'pmf-my-list'
const CONTINUE_WATCHING_STORAGE_KEY =
  'pmf-continue-watching'

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

    return videoId
      ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`
      : value
  } catch {
    return value
  }
}

function getContinueWatchingEntries():
  ContinueWatchingEntry[] {
  try {
    const saved = localStorage.getItem(
      CONTINUE_WATCHING_STORAGE_KEY,
    )

    if (!saved) {
      return []
    }

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

function getContinueWatchingIds(): number[] {
  return getContinueWatchingEntries()
    .sort(
      (a, b) =>
        b.updatedAt -
        a.updatedAt,
    )
    .map(
      (entry) => entry.id,
    )
}

function getContinueWatchingEntry(
  id: number,
): ContinueWatchingEntry | null {
  return (
    getContinueWatchingEntries().find(
      (entry) =>
        entry.id === id,
    ) ?? null
  )
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
        (entry) =>
          entry.id !== id,
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
    // Ignore localStorage failures.
  }
}

function removeContinueWatching(
  id: number,
): void {
  try {
    const next =
      getContinueWatchingEntries()
        .filter(
          (entry) =>
            entry.id !== id,
        )

    localStorage.setItem(
      CONTINUE_WATCHING_STORAGE_KEY,
      JSON.stringify(next),
    )
  } catch {
    // Ignore localStorage failures.
  }
}

function getMyListIds(): number[] {
  try {
    const saved = localStorage.getItem(
      MY_LIST_STORAGE_KEY,
    )

    if (!saved) {
      return []
    }

    const parsed: unknown =
      JSON.parse(saved)

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(
      (
        value,
      ): value is number =>
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
    // Ignore localStorage failures.
  }
}

function formatRuntime(
  movie: CanonicalMovie | undefined,
): string {
  if (!movie) {
    return ''
  }

  if (
    movie.runtimeMinutes !==
    undefined
  ) {
    const hours =
      Math.floor(
        movie.runtimeMinutes /
          60,
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

function metadataName(
  catalog: MetadataCatalog | null,
  id: string,
): string {
  if (!catalog) {
    return id
  }

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
    const item =
      group.find(
        (value) =>
          value.id === id,
      )

    if (item) {
      return item.name
    }
  }

  return id
}

function sortMovies(
  values: CanonicalMovie[],
  mode: SortMode,
): CanonicalMovie[] {
  return [...values].sort(
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
        safeNumber(
          b.releaseYear,
        ) -
          safeNumber(
            a.releaseYear,
          )
      )
    },
  )
}

function matchesSection(
  movie: CanonicalMovie,
  section: Section,
): boolean {
  if (section === 'movies') {
    return (
      movie.contentType ===
        'movie' ||
      movie.contentType ===
        'documentary' ||
      movie.contentType ===
        'short_film' ||
      movie.contentType ===
        'special'
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
        onClick={() =>
          onOpen(movie)
        }
        className="relative block w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] text-left shadow-xl transition duration-300 hover:-translate-y-1 hover:border-white/25 hover:shadow-red-950/30"
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

          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/10 opacity-70" />

          <div className="absolute inset-x-0 bottom-0 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/70">
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
            <div className="absolute right-2 top-2 rounded-full border border-yellow-400/30 bg-black/70 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-yellow-300">
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

      <div className="mt-2 flex items-center gap-1">
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
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/50 transition hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/50 transition hover:text-white"
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
    useState<number[]>(
      getMyListIds,
    )

  const [
    continueWatchingIds,
    setContinueWatchingIds,
  ] = useState<number[]>(
    getContinueWatchingIds,
  )

  const [
    continueWatchingEntries,
    setContinueWatchingEntries,
  ] = useState<
    ContinueWatchingEntry[]
  >(
    getContinueWatchingEntries,
  )

  const [
    filters,
    setFilters,
  ] = useState<DiscoveryFilters>(
    EMPTY_FILTERS,
  )

  const [
    showFilters,
    setShowFilters,
  ] = useState(false)

  const [
    sortMode,
    setSortMode,
  ] = useState<SortMode>(
    'popular',
  )

  const [searchQuery, setSearchQuery] =
    useState('')

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false)

  useEffect(() => {
    let active = true

    const loadCatalog = async () => {
      setLoading(true)
      setErrorMessage('')

      try {
        const [
          movieData,
          metadata,
        ] = await Promise.all([
          getMovies(),
          getMetadataCatalog(),
        ])

        if (!active) {
          return
        }

        setMovies(movieData)
        setMetadataCatalog(
          metadata,
        )
      } catch (error) {
        if (!active) {
          return
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to load the PMF catalog.',
        )
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadCatalog()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const handleStorage = () => {
      setMyListIds(
        getMyListIds(),
      )
      setContinueWatchingIds(
        getContinueWatchingIds(),
      )
      setContinueWatchingEntries(
        getContinueWatchingEntries(),
      )
    }

    window.addEventListener(
      'storage',
      handleStorage,
    )

    return () =>
      window.removeEventListener(
        'storage',
        handleStorage,
      )
  }, [])

  const displayMovies =
    useMemo(
      () =>
        movies.map(
          mapCanonicalMovieToLegacy,
        ),
      [movies],
    )

  const movieMap =
    useMemo(() => {
      const map = new Map<
        number,
        DisplayMovie
      >()

      for (const movie of displayMovies) {
        map.set(
          Number(movie.id),
          movie,
        )
      }

      return map
    }, [displayMovies])

  const canonicalMap =
    useMemo(() => {
      const map = new Map<
        number,
        CanonicalMovie
      >()

      for (const movie of movies) {
        map.set(
          Number(movie.id),
          movie,
        )
      }

      return map
    }, [movies])

  
    const filteredMovies =
    useMemo(() => {
      let result =
        filterMovies(
          movies,
          {
            title:
              filters.title,
            actor:
              filters.actor,
            director:
              filters.director,
            genreIds:
              filters.genreIds,
            subgenreIds:
              filters.subgenreIds,
            countryIds:
              filters.countryIds,
            regionIds:
              filters.regionIds,
            industryIds:
              filters.industryIds,
            languageIds:
              filters.languageIds,
            collectionIds:
              filters.collectionIds,
            tags:
              filters.tags,
            year: filters.year
              ? Number(
                  filters.year,
                )
              : undefined,
            minRating:
              filters.minRating
                ? Number(
                    filters.minRating,
                  )
                : undefined,
            contentType:
              filters.contentType ||
              undefined,
            quality:
              filters.quality ||
              undefined,
          },
        )

      if (
        searchQuery.trim()
      ) {
        const query =
          normalizeText(
            searchQuery,
          )

        result =
          result.filter(
            (movie) => {
              const people =
                [
                  ...movie.directors,
                  ...movie.writers,
                ]
                  .map(
                    (person) =>
                      person.name,
                  )
                  .join(' ')

              const searchable =
                [
                  movie.title,
                  movie.originalTitle ??
                    '',
                  movie.slug,
                  movie.synopsis,
                  movie.genres.join(
                    ' ',
                  ),
                  movie.tags.join(
                    ' ',
                  ),
                  people,
                ]
                  .join(' ')
                  .toLowerCase()

              return searchable.includes(
                query,
              )
            },
          )
      }

      return sortMovies(
        result,
        sortMode,
      )
    }, [
      movies,
      filters,
      searchQuery,
      sortMode,
    ])

  const sectionMovies =
    useMemo(
      () =>
        filteredMovies.filter(
          (movie) =>
            matchesSection(
              movie,
              section,
            ),
        ),
      [
        filteredMovies,
        section,
      ],
    )

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

  const continueWatchingMovies =
    useMemo(() => {
      return continueWatchingIds
        .map((id) =>
          canonicalMap.get(id),
        )
        .filter(
          (
            movie,
          ): movie is CanonicalMovie =>
            Boolean(movie),
        )
    }, [
      continueWatchingIds,
      canonicalMap,
    ])

  const myListMovies =
    useMemo(
      () =>
        myListIds
          .map((id) =>
            canonicalMap.get(id),
          )
          .filter(
            (
              movie,
            ): movie is CanonicalMovie =>
              Boolean(movie),
          ),
      [
        myListIds,
        canonicalMap,
      ],
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

  const pmfOriginalMovies =
    useMemo(
      () =>
        movies
          .filter(
            (movie) =>
              movie.isPmfOriginal,
          )
          .slice(0, 12),
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

  const recommendedMovies =
    useMemo(() => {
      const preferredGenres =
        new Set(
          myListMovies.flatMap(
            (movie) =>
              movie.genres,
          ),
        )

      if (
        preferredGenres.size ===
        0
      ) {
        return popularMovies.slice(
          0,
          10,
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
        'rating',
      ).slice(0, 10)
    }, [
      movies,
      myListMovies,
      popularMovies,
    ])

  const openMovie = (
    movie: DisplayMovie,
  ) => {
    setSelectedMovie(movie)
  }

  const playMovie = (
    movie: DisplayMovie,
  ) => {
    setSelectedMovie(null)
    setWatchingMovie(movie)
  }

  const toggleMyList = (
    id: number,
  ) => {
    setMyListIds((current) => {
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

      return next
    })
  }

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

  const resetFilters = () => {
    setFilters(
      EMPTY_FILTERS,
    )
    setSearchQuery('')
    setSortMode('popular')
  }

  const updateFilter = <
    K extends keyof DiscoveryFilters,
  >(
    key: K,
    value: DiscoveryFilters[K],
  ) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }))
   }

      const renderMovieRail = (
    title: string,
    values: CanonicalMovie[],
    eyebrow?: string,
  ) => (
    <MovieRail
      title={title}
      eyebrow={eyebrow}
      movies={values}
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
  )

  const heroCanonical =
    featuredMovie

  const heroDisplay =
    heroCanonical
      ? movieMap.get(
          Number(
            heroCanonical.id,
          ),
        )
      : undefined

  const heroBackdrop =
    heroCanonical?.backdropUrl ||
    heroCanonical?.posterUrl ||
    heroImage

  return (
    <AppShell>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-black/70 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-5 px-4 sm:px-6 lg:px-10">
          <button
            type="button"
            onClick={() =>
              navigate('home')
            }
            className="shrink-0 text-left"
          >
            <div className="text-xl font-black tracking-tight sm:text-2xl">
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
            {[
              ['home', 'Home'],
              ['movies', 'Movies'],
              ['tv', 'TV Series'],
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
                  className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
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
            <div className="hidden w-[220px] items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 md:flex">
              <Search className="h-4 w-4 text-white/35" />

              <input
                value={
                  searchQuery
                }
                onChange={(
                  event,
                ) =>
                  setSearchQuery(
                    event.target.value,
                  )
                }
                placeholder="Search PMF..."
                className="w-full bg-transparent py-2 text-xs text-white outline-none placeholder:text-white/25"
              />

              {searchQuery && (
                <button
                  type="button"
                  onClick={() =>
                    setSearchQuery(
                      '',
                    )
                  }
                  className="text-white/35 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                setShowFilters(
                  (value) =>
                    !value,
                )
              }
              className="hidden h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/50 transition hover:text-white sm:flex"
              aria-label="Filters"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() =>
                setMobileMenuOpen(
                  (value) =>
                    !value,
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
                value={
                  searchQuery
                }
                onChange={(
                  event,
                ) =>
                  setSearchQuery(
                    event.target.value,
                  )
                }
                placeholder="Search movies, shows..."
                className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-white/25"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                [
                  'home',
                  'Home',
                  Home,
                ],
                [
                  'movies',
                  'Movies',
                  Film,
                ],
                [
                  'tv',
                  'TV Series',
                  Tv,
                ],
                [
                  'my-list',
                  'My List',
                  Bookmark,
                ],
              ].map(
                ([
                  value,
                  label,
                  Icon,
                ]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      navigate(
                        value as Section,
                      )
                    }
                    className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm font-bold ${
                      section ===
                      value
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
          <div className="min-h-[80vh]">
            <div className="relative h-[65vh] overflow-hidden bg-white/[0.03]">
              <div className="absolute inset-0 animate-pulse bg-white/[0.03]" />

              <div className="absolute bottom-16 left-5 max-w-2xl px-0 sm:left-10 lg:left-16">
                <div className="h-3 w-32 rounded bg-white/10" />
                <div className="mt-4 h-12 w-72 rounded bg-white/10 sm:w-[480px]" />
                <div className="mt-4 h-4 w-full max-w-xl rounded bg-white/10" />
                <div className="mt-2 h-4 w-4/5 max-w-lg rounded bg-white/10" />
              </div>
            </div>

            <div className="px-5 py-10 sm:px-10 lg:px-16">
              <div className="mb-5 h-8 w-52 animate-pulse rounded bg-white/10" />

              <div className="flex gap-4 overflow-hidden">
                {Array.from({
                  length: 6,
                }).map(
                  (_, index) => (
                    <div
                      key={index}
                      className="aspect-[2/3] w-[160px] shrink-0 animate-pulse rounded-2xl bg-white/[0.05]"
                    />
                  ),
                )}
              </div>
            </div>
          </div>
        ) : errorMessage ? (
          <div className="flex min-h-[75vh] items-center justify-center px-5">
            <div className="max-w-lg rounded-3xl border border-red-500/20 bg-red-500/[0.05] p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600/10 text-red-500">
                <Info className="h-7 w-7" />
              </div>

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
                className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-red-600 hover:text-white"
              >
                Reload PMF
              </button>
            </div>
          </div>
        ) : section === 'home' ? (
          <>
            <section className="relative min-h-[620px] overflow-hidden sm:min-h-[680px]">
              <img
                src={heroBackdrop}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />

              <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black/10" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-transparent to-black/30" />
              <div className="absolute inset-0 bg-black/10" />

              <div className="relative mx-auto flex min-h-[620px] max-w-[1600px] items-end px-5 pb-20 sm:min-h-[680px] sm:px-10 lg:px-16">
                <div className="max-w-2xl">
                  <div className="mb-4 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em]">
                    <span className="rounded-full bg-red-600 px-3 py-1.5 text-white">
                      Featured Film
                    </span>

                    {heroCanonical?.isPmfOriginal && (
                      <span className="rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-white/70">
                        PMF Original
                      </span>
                    )}
                  </div>

                  <h1 className="text-5xl font-black tracking-[-0.04em] sm:text-6xl lg:text-8xl">
                    {heroCanonical?.title ||
                      'Prince Mufasa Flix'}
                  </h1>

                  <div className="mt-5 flex flex-wrap items-center gap-3 text-sm font-bold text-white/65">
                    {heroCanonical?.releaseYear && (
                      <span>
                        {
                          heroCanonical.releaseYear
                        }
                      </span>
                    )}

                    {heroCanonical?.rating !==
                      undefined && (
                      <span className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-current text-yellow-400" />
                        {
                          heroCanonical.rating
                        }
                      </span>
                    )}

                    {heroCanonical && (
                      <span>
                        {formatRuntime(
                          heroCanonical,
                        )}
                      </span>
                    )}

                    {heroCanonical?.ageRating && (
                      <span className="rounded border border-white/20 px-2 py-0.5 text-[10px]">
                        {
                          heroCanonical.ageRating
                        }
                      </span>
                    )}
                  </div>

                  <p className="mt-5 max-w-xl text-sm leading-7 text-white/60 sm:text-base">
                    {heroCanonical?.tagline ||
                      heroCanonical?.synopsis ||
                      'Your world. Your stories. Your flix.'}
                  </p>

                  <div className="mt-7 flex flex-wrap gap-3">
                    {heroDisplay && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            playMovie(
                              heroDisplay,
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
                              heroDisplay,
                            )
                          }
                          className="flex items-center gap-2 rounded-xl bg-white/10 px-6 py-3.5 text-sm font-black backdrop-blur-md transition hover:bg-white/20"
                        >
                          <Info className="h-4 w-4" />
                          More Info
                        </button>
                      </>
                    )}
                  </div>

                  <div className="mt-7 flex flex-wrap gap-2">
                    {heroCanonical?.genres
                      .slice(0, 4)
                      .map(
                        (genreId) => (
                          <span
                            key={
                              genreId
                            }
                            className="text-xs text-white/35"
                          >
                            {metadataName(
                              metadataCatalog,
                              genreId,
                            )}
                          </span>
                        ),
                      )}
                  </div>
                </div>
              </div>
            </section>

            <div className="mx-auto max-w-[1600px] px-5 py-12 sm:px-10 lg:px-16">
              {continueWatchingMovies.length >
                0 &&
                renderMovieRail(
                  'Continue Watching',
                  continueWatchingMovies,
                  'Pick up where you left off',
                )}

              {trendingMovies.length >
                0 &&
                renderMovieRail(
                  'Trending Now',
                  trendingMovies,
                  'What everyone is watching',
                )}

              {newReleaseMovies.length >
                0 &&
                renderMovieRail(
                  'New Releases',
                  newReleaseMovies,
                  'Fresh on PMF',
                )}

              {pmfOriginalMovies.length >
                0 &&
                renderMovieRail(
                  'PMF Originals',
                  pmfOriginalMovies,
                  'Original stories',
                )}

              {recommendedMovies.length >
                0 &&
                renderMovieRail(
                  'Recommended For You',
                  recommendedMovies,
                  'Selected from your taste',
                )}

              {popularMovies.length >
                0 &&
                renderMovieRail(
                  'Popular on PMF',
                  popularMovies,
                  'The PMF audience favourites',
                )}

              {movies.length ===
                0 && (
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center">
                  <Film className="mx-auto h-10 w-10 text-white/20" />

                  <h2 className="mt-4 text-xl font-black">
                    Your PMF catalog is ready for content
                  </h2>

                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/40">
                    Add licensed or public-domain movie records to Supabase and they will appear here automatically.
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="mx-auto max-w-[1600px] px-5 py-10 sm:px-10 lg:px-16">
            <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.3em] text-red-500">
                  PMF Discovery
                </p>

                <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
                  {section === 'movies'
                    ? 'Movies'
                    : section === 'tv'
                      ? 'TV Series'
                      : 'My List'}
                </h1>

                <p className="mt-2 max-w-2xl text-sm text-white/40">
                  {section ===
                  'my-list'
                    ? 'Your personal collection of movies and shows.'
                    : 'Explore the PMF catalog your way.'}
                </p>
              </div>

              {section !==
                'my-list' && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setShowFilters(
                        (value) =>
                          !value,
                      )
                    }
                    className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black transition ${
                      showFilters
                        ? 'border-red-600/40 bg-red-600/10 text-white'
                        : 'border-white/10 bg-white/[0.04] text-white/60'
                    }`}
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
                        event.target
                          .value as SortMode,
                      )
                    }
                    className="rounded-xl border border-white/10 bg-[#0b0b0b] px-4 py-2.5 text-xs font-bold text-white outline-none"
                  >
                    <option value="popular">
                      Most Popular
                    </option>
                    <option value="newest">
                      Newest
                    </option>
                    <option value="rating">
                      Highest Rated
                    </option>
                    <option value="title">
                      A-Z
                         </option>
                  </select>
                </div>
              )}
            </div>

            {showFilters &&
              section !==
                'my-list' && (
                <div className="mb-8 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="lg:col-span-2">
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-white/40">
                        Search
                      </label>

                      <input
                        value={
                          filters.title
                        }
                        onChange={(
                          event,
                        ) =>
                          updateFilter(
                            'title',
                            event.target
                              .value,
                          )
                        }
                        placeholder="Title, actor, director..."
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-red-600/60"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-white/40">
                        Year
                      </label>

                      <input
                        value={
                          filters.year
                        }
                        onChange={(
                          event,
                        ) =>
                          updateFilter(
                            'year',
                            event.target
                              .value,
                          )
                        }
                        placeholder="2026"
                        inputMode="numeric"
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-red-600/60"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-white/40">
                        Minimum Rating
                      </label>

                      <select
                        value={
                          filters.minRating
                        }
                        onChange={(
                          event,
                        ) =>
                          updateFilter(
                            'minRating',
                            event.target
                              .value,
                          )
                        }
                        className="w-full rounded-xl border border-white/10 bg-[#080808] px-4 py-3 text-sm outline-none"
                      >
                        <option value="">
                          Any rating
                        </option>
                        <option value="9">
                          9+
                        </option>
                        <option value="8">
                          8+
                        </option>
                        <option value="7">
                          7+
                        </option>
                        <option value="6">
                          6+
                        </option>
                        <option value="5">
                          5+
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-white/40">
                        Content Type
                      </label>

                      <select
                        value={
                          filters.contentType
                        }
                        onChange={(
                          event,
                        ) =>
                          updateFilter(
                            'contentType',
                            event.target
                              .value as DiscoveryFilters['contentType'],
                          )
                        }
                        className="w-full rounded-xl border border-white/10 bg-[#080808] px-4 py-3 text-sm outline-none"
                      >
                        <option value="">
                          All types
                        </option>
                        <option value="movie">
                          Movies
                        </option>
                        <option value="tv_show">
                          TV Shows
                        </option>
                        <option value="documentary">
                          Documentaries
                        </option>
                        <option value="short_film">
                          Short Films
                        </option>
                        <option value="special">
                          Specials
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-white/40">
                        Quality
                      </label>

                      <select
                        value={
                          filters.quality
                        }
                        onChange={(
                          event,
                        ) =>
                          updateFilter(
                            'quality',
                            event.target
                              .value as DiscoveryFilters['quality'],
                          )
                        }
                        className="w-full rounded-xl border border-white/10 bg-[#080808] px-4 py-3 text-sm outline-none"
                      >
                        <option value="">
                          Any quality
                        </option>
                        <option value="480p">
                          480p
                        </option>
                        <option value="720p">
                          720p
                        </option>
                        <option value="1080p">
                          1080p
                        </option>
                        <option value="1440p">
                          1440p
                        </option>
                        <option value="4k">
                          4K
                        </option>
                      </select>
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={
                          resetFilters
                        }
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black text-white/60 transition hover:bg-white/10 hover:text-white"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  </div>
                </div>
              )}

            {section ===
              'my-list' ? (
              myListMovies.length >
              0 ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {myListMovies.map(
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
                          myList
                          continueEntry={
                            getContinueWatchingEntry(
                              Number(
                                canonical.id,
                              ),
                            )
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
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center">
                  <Bookmark className="mx-auto h-12 w-12 text-white/15" />

                  <h2 className="mt-5 text-2xl font-black">
                    Your My List is empty
                  </h2>

                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/40">
                    Save movies and shows you want to watch later. They will appear here instantly.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        'home',
                      )
                    }
                    className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-black text-black"
                  >
                    Discover PMF
                  </button>
                </div>
              )
            ) : sectionMovies.length >
              0 ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {sectionMovies.map(
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
                          getContinueWatchingEntry(
                            Number(
                              canonical.id,
                            ),
                          )
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
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center">
                <Search className="mx-auto h-12 w-12 text-white/15" />

                <h2 className="mt-5 text-2xl font-black">
                  Nothing found
                </h2>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/40">
                  Try another search, remove a filter, or explore another PMF section.
                </p>

                <button
                  type="button"
                  onClick={
                    resetFilters
                  }
                  className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-black text-black"
                >
                  Clear Search
                </button>
              </div>
            )}
          </div>
        )}
      </main>

            {selectedMovie && (
        <MovieDetailsModal
          movie={
            selectedMovie
          }
          canonical={
            canonicalMap.get(
              Number(
                selectedMovie.id,
              ),
            ) ?? null
          }
          metadataCatalog={
            metadataCatalog
          }
          myListIds={
            myListIds
          }
          onClose={() =>
            setSelectedMovie(
              null,
            )
          }
          onPlay={() =>
            playMovie(
              selectedMovie,
            )
          }
          onToggleMyList={
            toggleMyList
          }
        />
      )}

      {watchingMovie && (
        <WatchingModal
          movie={
            watchingMovie
          }
          canonical={
            canonicalMap.get(
              Number(
                watchingMovie.id,
              ),
            ) ?? null
          }
          continueEntry={
            getContinueWatchingEntry(
              Number(
                watchingMovie.id,
              ),
            )
          }
          onClose={() => {
            setWatchingMovie(
              null,
            )

            setContinueWatchingIds(
              getContinueWatchingIds(),
            )

            setContinueWatchingEntries(
              getContinueWatchingEntries(),
            )
          }}
          onTimeUpdate={(
            currentTime,
          ) => {
            const canonical =
              canonicalMap.get(
                Number(
                  watchingMovie.id,
                ),
              )

            const estimatedDuration =
              canonical?.runtimeMinutes
                ? canonical.runtimeMinutes *
                  60
                : getContinueWatchingEntry(
                    Number(
                      watchingMovie.id,
                    ),
                  )?.duration ?? 0

            saveContinueWatching(
              Number(
                watchingMovie.id,
              ),
              currentTime,
              estimatedDuration,
            )

            setContinueWatchingEntries(
              getContinueWatchingEntries(),
            )

            setContinueWatchingIds(
              getContinueWatchingIds(),
            )
          }}
          onEnded={() => {
            removeContinueWatching(
              Number(
                watchingMovie.id,
              ),
            )

            setContinueWatchingEntries(
              getContinueWatchingEntries(),
            )

            setContinueWatchingIds(
              getContinueWatchingIds(),
            )
          }}
        />
      )}

      <footer className="border-t border-white/[0.06] px-5 py-12 sm:px-10 lg:px-16">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-2xl font-black">
              <span className="text-red-600">
                PMF
              </span>
              LIX
            </div>

            <p className="mt-2 max-w-md text-sm leading-6 text-white/30">
              Prince Mufasa Flix — a cinematic home for stories from around the world.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 text-xs font-bold text-white/30">
            <span>
              Licensed content only
            </span>
            <span>
              Secure streaming
            </span>
            <span>
              © 2026 PMF Flix
            </span>
          </div>
        </div>
      </footer>
    </AppShell>
  )
}

function MovieDetailsModal({
  movie,
  canonical,
  metadataCatalog,
  myListIds,
  onClose,
  onPlay,
  onToggleMyList,
}: {
  movie: DisplayMovie
  canonical: CanonicalMovie | null
  metadataCatalog: MetadataCatalog | null
  myListIds: number[]
  onClose: () => void
  onPlay: () => void
  onToggleMyList: (
    id: number,
  ) => void
}) {
  const myList = myListIds.includes(
    Number(movie.id),
  )

  const backdrop =
    canonical?.backdropUrl ||
    canonical?.posterUrl ||
    heroImage

  const videoUrl =
    canonical
      ? getMovieVideoUrl(movie)
      : ''

  const trailerUrl =
    canonical?.trailerUrl?.trim() ||
    ''

  const hasTrailer =
    Boolean(trailerUrl)

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/90 backdrop-blur-xl">
      <div className="min-h-full p-3 sm:p-6">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#090909] shadow-2xl">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white/70 backdrop-blur transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="relative aspect-[16/8] min-h-[300px] overflow-hidden">
            <img
              src={backdrop}
              alt=""
              className="h-full w-full object-cover"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-[#090909] via-black/35 to-black/10" />

            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8 lg:p-10">
              <div className="flex flex-wrap gap-2">
                {canonical?.isPmfOriginal && (
                  <span className="rounded-full bg-red-600 px-3 py-1 text-[9px] font-black uppercase tracking-wider">
                    PMF Original
                  </span>
                )}

                {canonical?.isPremium && (
                  <span className="rounded-full bg-yellow-400 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-black">
                    Premium
                  </span>
                )}
              </div>

              <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                {movie.title}
              </h1>
            </div>
          </div>

          <div className="p-5 sm:p-8 lg:p-10">
            <div className="flex flex-wrap items-center gap-3 text-sm text-white/55">
              {canonical?.releaseYear && (
                <span>
                  {canonical.releaseYear}
                </span>
              )}

              {canonical?.rating !==
                undefined && (
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-current text-yellow-400" />
                  {canonical.rating}
                </span>
              )}

              {canonical && (
                <span>
                  {formatRuntime(
                    canonical,
                  )}
                </span>
              )}

              {canonical?.ageRating && (
                <span className="rounded border border-white/15 px-2 py-0.5 text-xs">
                  {
                    canonical.ageRating
                  }
                </span>
              )}

              <span className="rounded border border-white/10 px-2 py-0.5 text-xs">
                {canonical?.contentType ===
                'tv_show'
                  ? 'TV Series'
                  : 'Film'}
              </span>
            </div>

            {canonical?.tagline && (
              <p className="mt-5 text-lg font-bold text-white/80">
                {canonical.tagline}
              </p>
            )}

            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/55 sm:text-base">
              {canonical?.synopsis ||
                movie.description ||
                'No description available.'}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onPlay}
                className="flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-black text-black transition hover:bg-red-600 hover:text-white"
              >
                <Play className="h-4 w-4 fill-current" />
                Watch Now
              </button>

              <button
                type="button"
                onClick={() =>
                  onToggleMyList(
                    Number(
                      movie.id,
                    ),
                  )
                }
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-5 py-3.5 text-sm font-black transition hover:bg-white/10"
              >
                {myList ? (
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

            <div className="mt-10 grid gap-6 border-t border-white/[0.08] pt-7 sm:grid-cols-2">
              <MetadataBlock
                icon={
                  <Globe2 className="h-4 w-4" />
                }
                title="Genres"
              >
                <div className="flex flex-wrap gap-2">
                  {canonical?.genres
                    .slice(0, 8)
                    .map(
                      (id) => (
                        <span
                          key={id}
                          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/50"
                        >
                          {metadataName(
                            metadataCatalog,
                            id,
                          )}
                        </span>
                      ),
                    )}

                  {(!canonical ||
                    canonical.genres
                      .length ===
                      0) && (
                    <span className="text-sm text-white/30">
                      Not specified
                    </span>
                  )}
                </div>
              </MetadataBlock>

              <MetadataBlock
                icon={
                  <Layers3 className="h-4 w-4" />
                }
                title="Format"
              >
                <div className="space-y-2 text-sm text-white/45">
                  <p>
                    Type:{' '}
                    <span className="text-white/75">
                      {canonical?.contentType ===
                      'tv_show'
                        ? 'TV Series'
                        : 'Movie'}
                    </span>
                  </p>

                  <p>
                    Runtime:{' '}
                    <span className="text-white/75">
                      {canonical
                        ? formatRuntime(
                            canonical,
                          ) ||
                          'Not specified'
                        : 'Not specified'}
                    </span>
                  </p>

                  <p>
                    Quality:{' '}
                    <span className="text-white/75">
                      {canonical?.videoQualities
                        .length
                        ? canonical.videoQualities.join(
                            ', ',
                          )
                        : 'Auto'}
                    </span>
                  </p>
                </div>
              </MetadataBlock>

              <MetadataBlock
                icon={
                  <Heart className="h-4 w-4" />
                }
                title="Cast & Crew"
              >
                <div className="space-y-2 text-sm text-white/45">
                  <p>
                    Directors:{' '}
                    <span className="text-white/75">
                      {canonical?.directors
                        .map(
                          (person) =>
                            person.name,
                        )
                        .join(
                          ', ',
                        ) ||
                        'Not specified'}
                    </span>
                  </p>

                  <p>
                    Writers:{' '}
                    <span className="text-white/75">
                      {canonical?.writers
                        .map(
                          (person) =>
                            person.name,
                        )
                        .join(
                          ', ',
                        ) ||
                        'Not specified'}
                    </span>
                  </p>

                  <p>
                    Cast IDs:{' '}
                    <span className="text-white/75">
                      {canonical?.cast
                        .slice(
                          0,
                          6,
                        )
                        .map(
                          (person) =>
                            person.personId,
                        )
                        .join(
                          ', ',
                        ) ||
                        'Not specified'}
                    </span>
                  </p>
                </div>
              </MetadataBlock>

              <MetadataBlock
                icon={
                  <Clock3 className="h-4 w-4" />
                }
                title="Availability"
              >
                <div className="space-y-2 text-sm text-white/45">
                  <p>
                    Streaming:{' '}
                    <span className="text-white/75">
                      {videoUrl
                        ? 'Available'
                        : 'Coming soon'}
                    </span>
                  </p>

                  <p>
                    Download:{' '}
                    <span className="text-white/75">
                      {canonical?.downloadAvailability
                        ?.available
                        ? 'Available'
                        : 'Not available'}
                    </span>
                  </p>
                </div>
              </MetadataBlock>
            </div>

            {hasTrailer && (
              <div className="mt-10 border-t border-white/[0.08] pt-8">
                <SectionTitle
                  eyebrow="Preview"
                  title="Official Trailer"
                />

                {isYouTubeUrl(
                  trailerUrl,
                ) ? (
                  <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
                    <iframe
                      src={getYouTubeEmbedUrl(
                        trailerUrl,
                      )}
                      title={`${movie.title} trailer`}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <video
                    controls
                    poster={
                      canonical?.posterUrl
                    }
                    className="aspect-video w-full rounded-2xl bg-black"
                    src={trailerUrl}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MetadataBlock({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-white/55">
        {icon}
        {title}
      </div>

      {children}
    </div>
  )
}

function WatchingModal({
  movie,
  canonical,
  continueEntry,
  onClose,
  onTimeUpdate,
  onEnded,
}: {
  movie: DisplayMovie
  canonical: CanonicalMovie | null
  continueEntry: ContinueWatchingEntry | null
  onClose: () => void
  onTimeUpdate: (
    currentTime: number,
  ) => void
  onEnded: () => void
}) {
  const videoUrl =
    getMovieVideoUrl(movie)

  const trailerUrl =
    canonical?.trailerUrl?.trim() ||
    ''

  const initialTime =
    continueEntry?.position ?? 0

  const hasPlayableVideo =
    Boolean(videoUrl) &&
    !isYouTubeUrl(videoUrl)

  const hasYouTubeVideo =
    Boolean(videoUrl) &&
    isYouTubeUrl(videoUrl)

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 p-2 backdrop-blur-xl sm:p-5">
      <div className="relative w-full max-w-6xl overflow-hidden rounded-2xl border border-white/10 bg-[#050505] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-black sm:text-base">
              {movie.title}
            </p>

            <p className="text-[10px] uppercase tracking-wider text-white/30">
              PMF Player
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="ml-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/60 transition hover:text-white"
            aria-label="Close player"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="bg-black">
          {hasPlayableVideo ? (
            <VideoPlayer
              videoUrl={
                videoUrl
              }
              posterUrl={
                canonical?.backdropUrl ||
                canonical?.posterUrl ||
                movie.poster
              }
              subtitles={
                canonical?.subtitles ??
                []
              }
              initialTime={
                initialTime
              }
              autoPlay
              title={
                movie.title
              }
              onTimeUpdate={
                onTimeUpdate
              }
              onEnded={
                onEnded
              }
            />
          ) : hasYouTubeVideo ? (
            <div className="aspect-video">
              <iframe
                src={getYouTubeEmbedUrl(
                  videoUrl,
                )}
                title={movie.title}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : trailerUrl &&
            isYouTubeUrl(
              trailerUrl,
            ) ? (
            <div className="aspect-video">
              <iframe
                src={getYouTubeEmbedUrl(
                  trailerUrl,
                )}
                title={`${movie.title} trailer`}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : trailerUrl ? (
            <video
              controls
              autoPlay
              poster={
                canonical?.posterUrl ||
                movie.poster
              }
              src={trailerUrl}
              className="aspect-video w-full bg-black"
            />
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center px-6 text-center">
              <Film className="h-12 w-12 text-white/15" />

              <h2 className="mt-5 text-xl font-black">
                Video not available yet
              </h2>

              <p className="mt-2 max-w-md text-sm leading-6 text-white/35">
                This title has catalog information but no playable licensed video source has been connected yet.
              </p>

              <button
                type="button"
                onClick={onClose}
                className="mt-5 rounded-xl bg-white px-5 py-3 text-sm font-black text-black"
              >
                Back to PMF
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-white/[0.08] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-600/10 text-red-500">
              <Play className="h-4 w-4 fill-current" />
            </div>

            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-white/70">
                {movie.title}
              </p>

              <p className="text-[10px] text-white/30">
                {continueEntry &&
                continueEntry.position >
                  0
                  ? 'Resume position restored'
                  : 'Starting from the beginning'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-black text-white/60 transition hover:text-white"
          >
            Close Player
          </button>
        </div>
      </div>
    </div>
  )
 }

    function App() {
  const [sessionReady, setSessionReady] =
    useState(false)

  const [authenticated, setAuthenticated] =
    useState(false)

  useEffect(() => {
    let active = true

    const loadSession = async () => {
      const {
        data,
      } =
        await supabase.auth.getSession()

      if (!active) {
        return
      }

      setAuthenticated(
        Boolean(data.session),
      )

      setSessionReady(true)
    }

    void loadSession()

    const {
      data: listener,
    } =
      supabase.auth.onAuthStateChange(
        (
          _event,
          session,
        ) => {
          if (!active) {
            return
          }

          setAuthenticated(
            Boolean(session),
          )

          setSessionReady(
            true,
          )
        },
      )

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  if (!sessionReady) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center bg-[#030303]">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-red-600/20 bg-red-600/10">
              <span className="text-xl font-black text-red-600">
                PMF
              </span>
            </div>

            <div className="mt-5 text-sm font-bold text-white/50">
              Loading PMF Flix...
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  if (!authenticated) {
    return <AuthScreen />
  }

  return (
    <AuthenticatedApp />
  )
}

export default App

            
