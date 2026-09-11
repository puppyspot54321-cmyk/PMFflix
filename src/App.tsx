import heroImage from './assets/hero.png'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Search,
  Play,
  Plus,
  Check,
  X,
  LogOut,
  SlidersHorizontal,
  ChevronDown,
  Film,
  Bookmark,
  Star,
  Sparkles,
  Globe2,
  Layers3,
} from 'lucide-react'

import AuthScreen from './Auth'
import { supabase } from './supabase'
import {
  getMovies,
  getMetadataCatalog,
} from './services'
import type { Movie as CanonicalMovie } from './types/movie'
import type { MetadataCatalog } from './services'
import { mapCanonicalMovieToLegacy } from './utils/movieMapper'
import { filterMovies } from './utils/movieFilters'
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

type DisplayMovie = ReturnType<
  typeof mapCanonicalMovieToLegacy
>

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

function normalizeText(value: string): string {
  return value.trim().toLowerCase()
}

function getYouTubeEmbedUrl(url: string): string {
  try {
    const parsed = new URL(url)

    if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname
        .replace('/', '')
        .trim()

      return id
        ? `https://www.youtube.com/embed/${id}?autoplay=1`
        : url
    }

    const videoId =
      parsed.searchParams.get('v')

    return videoId
      ? `https://www.youtube.com/embed/${videoId}?autoplay=1`
      : url
  } catch {
    return url
  }
}

function getMovieVideoUrl(
  movie: DisplayMovie,
): string {
  const value = movie.videoUrl?.trim()

  if (value) {
    return value
  }

  if (
    normalizeText(movie.title) ===
    normalizeText('The Journey')
  ) {
    return '/movies/the-journey.mp4'
  }

  return ''
}

function matchesDisplaySearch(
  movie: DisplayMovie,
  query: string,
): boolean {
  const normalizedQuery =
    normalizeText(query)

  if (!normalizedQuery) {
    return true
  }

  return [
    movie.title,
    movie.description,
    movie.category,
    movie.type,
    String(movie.year),
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalizedQuery)
}

function sortDisplayMovies(
  values: DisplayMovie[],
  mode: SortMode,
): DisplayMovie[] {
  return [...values].sort((a, b) => {
    if (mode === 'title') {
      return a.title.localeCompare(b.title)
    }

    if (mode === 'newest') {
      return b.year - a.year
    }

    if (mode === 'rating') {
      const ratingA =
        typeof a.rating === 'number'
          ? a.rating
          : Number.parseFloat(
              String(a.rating ?? '0'),
            )

      const ratingB =
        typeof b.rating === 'number'
          ? b.rating
          : Number.parseFloat(
              String(b.rating ?? '0'),
            )

      return (
        (Number.isFinite(ratingB)
          ? ratingB
          : 0) -
        (Number.isFinite(ratingA)
          ? ratingA
          : 0)
      )
    }

    return 0
  })
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
    const item = group.find(
      (value) => value.id === id,
    )

    if (item) {
      return item.name
    }
  }

  return id
}

function getContinueWatchingIds(): number[] {

type ContinueWatchingEntry = {
  id: number
  position: number
  duration: number
  updatedAt: number
}

function getContinueWatchingEntries(): ContinueWatchingEntry[] {
  try {
    const saved = localStorage.getItem(
      'pmf-continue-watching',
    )

    if (!saved) {
      return []
    }

    const parsed: unknown =
      JSON.parse(saved)

    if (!Array.isArray(parsed)) {
      return []
    }

    if (
      parsed.every(
        (value): value is number =>
          typeof value === 'number',
      )
    ) {
      return parsed.map((id) => ({
        id,
        position: 0,
        duration: 0,
        updatedAt: 0,
      }))
    }

    return parsed.filter(
      (value): value is ContinueWatchingEntry =>
        typeof value === 'object' &&
        value !== null &&
        typeof (value as ContinueWatchingEntry).id ===
          'number' &&
        typeof (value as ContinueWatchingEntry).position ===
          'number' &&
        typeof (value as ContinueWatchingEntry).duration ===
          'number' &&
        typeof (value as ContinueWatchingEntry).updatedAt ===
          'number',
    )
  } catch {
    return []
  }
}

function getContinueWatchingIds(): number[] {
  return getContinueWatchingEntries().map(
    (entry) => entry.id,
  )
}

function getContinueWatchingEntry(
  id: number,
): ContinueWatchingEntry | null {
  const entry =
    getContinueWatchingEntries().find(
      (item) => item.id === id,
    )

  return entry ?? null
}

function saveContinueWatching(
  id: number,
  position = 0,
  duration = 0,
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

    localStorage.setItem(
      'pmf-continue-watching',
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
    const current =
      getContinueWatchingEntries()

    const next = current.filter(
      (entry) => entry.id !== id,
    )

    localStorage.setItem(
      'pmf-continue-watching',
      JSON.stringify(next),
    )
  } catch {
    // Ignore localStorage failures.
  }
}

function getContinueWatchingIds(): number[] {
  return getContinueWatchingEntries().map(
    (entry) => entry.id,
  )
}

function getContinueWatchingEntry(
  id: number,
): ContinueWatchingEntry | null {
  const entry =
    getContinueWatchingEntries().find(
      (item) => item.id === id,
    )

  return entry ?? null
}

function saveContinueWatching(
  id: number,
  position = 0,
  duration = 0,
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

    localStorage.setItem(
      'pmf-continue-watching',
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
    const current =
      getContinueWatchingEntries()

    const next = current.filter(
      (entry) => entry.id !== id,
    )

    localStorage.setItem(
      'pmf-continue-watching',
      JSON.stringify(next),
    )
  } catch {
    // Ignore localStorage failures.
  }
}
  
  } catch {
    // Ignore localStorage failures.
  }
}

function getMyListIds(): number[] {
  try {
    const saved = localStorage.getItem(
      'pmf-my-list',
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
      (value): value is number =>
        typeof value === 'number',
    )
  } catch {
    return []
  }
}

function AuthenticatedApp() {
  const [movies, setMovies] =
    useState<CanonicalMovie[]>([])

  const [metadataCatalog, setMetadataCatalog] =
    useState<MetadataCatalog | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [errorMessage, setErrorMessage] =
    useState('')

  const [section, setSection] =
    useState<Section>('home')

  const [selectedMovie, setSelectedMovie] =
    useState<DisplayMovie | null>(null)

  const [watchingMovie, setWatchingMovie] =
    useState<DisplayMovie | null>(null)

  const [myListIds, setMyListIds] =
    useState<number[]>(getMyListIds)

  const [
    continueWatchingIds,
    setContinueWatchingIds,
  ] = useState<number[]>(
    getContinueWatchingIds,
  )

  const [filters, setFilters] =
    useState<DiscoveryFilters>({
      ...EMPTY_FILTERS,
    })

  const [showFilters, setShowFilters] =
    useState(false)

  const [sortMode, setSortMode] =
    useState<SortMode>('popular')

  useEffect(() => {
    let mounted = true

    async function loadCatalog(): Promise<void> {
      try {
        setLoading(true)
        setErrorMessage('')

        const [
          movieData,
          catalog,
        ] = await Promise.all([
          getMovies(),
          getMetadataCatalog(),
        ])

        if (!mounted) {
          return
        }

        setMovies(movieData)
        setMetadataCatalog(catalog)
      } catch (error) {
        if (!mounted) {
          return
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to load the PMF catalog.',
        )
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void loadCatalog()

    const channel = supabase
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
      void supabase.removeChannel(channel)
    }
  }, [])

  const displayMovies = useMemo(
    () =>
      movies.map(
        mapCanonicalMovieToLegacy,
      ),
    [movies],
  )

  const filteredCanonicalMovies =
    useMemo(() => {
      return filterMovies(movies, {
        title: filters.title,
        actor: filters.actor,
        director: filters.director,
        genreIds: filters.genreIds,
        subgenreIds: filters.subgenreIds,
        countryIds: filters.countryIds,
        regionIds: filters.regionIds,
        industryIds: filters.industryIds,
        languageIds: filters.languageIds,
        collectionIds:
          filters.collectionIds,
        tags: filters.tags,
        year: filters.year
          ? Number(filters.year)
          : undefined,
        minRating: filters.minRating
          ? Number(filters.minRating)
          : undefined,
        contentType:
          filters.contentType || undefined,
        quality:
          filters.quality || undefined,
      })
    }, [movies, filters])

  const filteredMovies = useMemo(() => {
    const canonicalIds = new Set(
      filteredCanonicalMovies.map(
        (movie) => movie.id,
      ),
    )

    return displayMovies.filter(
      (movie) =>
        canonicalIds.has(
          String(movie.id),
        ) &&
        matchesDisplaySearch(
          movie,
          filters.title,
        ),
    )
  }, [
    displayMovies,
    filteredCanonicalMovies,
    filters.title,
  ])

  const tvMovies = useMemo(
    () =>
      filteredMovies.filter(
        (movie) =>
          movie.type === 'Series',
      ),
    [filteredMovies],
  )

  const movieOnlyMovies = useMemo(
    () =>
      filteredMovies.filter(
        (movie) =>
          movie.type !== 'Series',
      ),
    [filteredMovies],
  )

  const trendingMovies = useMemo(
    () =>
      movieOnlyMovies.slice(0, 12),
    [movieOnlyMovies],
  )

  const featuredMovies = useMemo(
    () =>
      movieOnlyMovies.filter(
        (movie) => movie.featured,
      ),
    [movieOnlyMovies],
  )

  const newReleaseMovies = useMemo(
    () =>
      sortDisplayMovies(
        movieOnlyMovies,
        'newest',
      ).slice(0, 12),
    [movieOnlyMovies],
  )

  const popularMovies = useMemo(
    () =>
      sortDisplayMovies(
        movieOnlyMovies,
        'popular',
      ).slice(0, 12),
    [movieOnlyMovies],
  )

  const pmfOriginalMovies = useMemo(
    () =>
      movieOnlyMovies.filter((movie) => {
        const canonical = movies.find(
          (value) =>
            String(value.id) ===
            String(movie.id),
        )

        return (
          canonical?.isPmfOriginal ===
            true ||
          canonical?.tags.some(
            (tag) =>
              metadataName(
                metadataCatalog,
                tag,
              ).toLowerCase() ===
              'pmf original',
          ) === true
        )
      }),
    [
      movieOnlyMovies,
      movies,
      metadataCatalog,
    ],
  )

  const continueWatchingMovies =
    useMemo(
      () =>
        movieOnlyMovies.filter(
          (movie) =>
            continueWatchingIds.includes(
              Number(movie.id),
            ),
        ),
      [
        movieOnlyMovies,
        continueWatchingIds,
      ],
    )

  const myListMovies = useMemo(
    () =>
      displayMovies.filter((movie) =>
        myListIds.includes(
          Number(movie.id),
        ),
      ),
    [displayMovies, myListIds],
  )

  const featuredMovie =
    featuredMovies[0] ??
    movieOnlyMovies[0] ??
    null

    const discoveryCollections = useMemo(() => {
    if (!metadataCatalog) {
      return []
    }

    const getIds = (
      items: Array<{
        id: string
        name: string
      }>,
      names: string[],
    ): string[] => {
      const wanted = names.map(normalizeText)

      return items
        .filter((item) => {
          const name = normalizeText(item.name)
          const id = normalizeText(item.id)

          return (
            wanted.includes(name) ||
            wanted.includes(id)
          )
        })
        .map((item) => item.id)
    }

    const buildRow = (
      title: string,
      ids: string[],
      field:
        | 'collectionIds'
        | 'industryIds'
        | 'regionIds',
    ): {
      title: string
      movies: DisplayMovie[]
    } | null => {
      if (ids.length === 0) {
        return null
      }

      const idSet = new Set(ids)

      const matches = movies
        .filter((movie) => {
          const values = movie[field]

          return values.some((id) =>
            idSet.has(id),
          )
        })
       .filter((movie) => {
  return movie.contentType !== 'episode'
})

      const display = matches
        .map(mapCanonicalMovieToLegacy)
        .filter((movie) =>
          movie.type !== 'Series',
        )

      if (display.length === 0) {
        return null
      }

      return {
        title,
        movies: sortDisplayMovies(
          display,
          'popular',
        ).slice(0, 12),
      }
    }

    const africanCinema = buildRow(
      'African Cinema',
      getIds(
        metadataCatalog.collections,
        ['African Cinema', 'african-cinema'],
      ),
      'collectionIds',
    )

    const nollywood = buildRow(
      'Nollywood',
      getIds(
        metadataCatalog.industries,
        ['Nollywood', 'nollywood'],
      ),
      'industryIds',
    )

    const hollywood = buildRow(
      'Hollywood',
      getIds(
        metadataCatalog.industries,
        ['Hollywood', 'hollywood'],
      ),
      'industryIds',
    )

    const africanRegion = buildRow(
      'African Cinema',
      getIds(
        metadataCatalog.regions,
        ['Africa', 'africa'],
      ),
      'regionIds',
    )

    return [
      africanCinema,
      nollywood,
      hollywood,
      africanRegion,
    ].filter(
      (
        row,
      ): row is {
        title: string
        movies: DisplayMovie[]
      } => row !== null,
    )
  }, [
    metadataCatalog,
    movies,
  ])

  function updateFilter<
    K extends keyof DiscoveryFilters
  >(
    key: K,
    value: DiscoveryFilters[K],
  ): void {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function startWatching(
  movie: DisplayMovie,
): void {
  setSelectedMovie(null)
  setWatchingMovie(movie)

  const numericId = Number(movie.id)

  if (Number.isFinite(numericId)) {
    const existing =
      getContinueWatchingEntry(numericId)

    saveContinueWatching(
      numericId,
      existing?.position ?? 0,
      existing?.duration ?? 0,
    )

    setContinueWatchingIds(
      getContinueWatchingIds(),
    )
  }
  }
    setSelectedMovie(movie)
  }

  function closeMovie(): void {
    setSelectedMovie(null)
  }

  function startWatching(
    movie: DisplayMovie,
  ): void {
    setSelectedMovie(null)
    setWatchingMovie(movie)

    const numericId = Number(movie.id)

    if (Number.isFinite(numericId)) {
      saveContinueWatching(numericId)

      setContinueWatchingIds(
        getContinueWatchingIds(),
      )
    }
  }

  function closeWatching(): void {
    setWatchingMovie(null)
    setContinueWatchingIds(
      getContinueWatchingIds(),
    )
  }

  async function handleSignOut(): Promise<void> {
    await supabase.auth.signOut()
  }

  function clearFilters(): void {
    setFilters({
      ...EMPTY_FILTERS,
    })
  }

  function toggleMyList(
    movieId: number,
  ): void {
    setMyListIds((current) => {
      const next = current.includes(movieId)
        ? current.filter(
            (id) => id !== movieId,
          )
        : [...current, movieId]

      try {
        localStorage.setItem(
          'pmf-my-list',
          JSON.stringify(next),
        )
      } catch {
        // Ignore localStorage failures.
      }

      return next
    })
  }

  function toggleMetadataFilter(
    key:
      | 'genreIds'
      | 'subgenreIds'
      | 'countryIds'
      | 'regionIds'
      | 'industryIds'
      | 'languageIds'
      | 'collectionIds'
      | 'tags',
    id: string,
  ): void {
    setFilters((current) => {
      const values = current[key]
      const next = values.includes(id)
        ? values.filter(
            (value) => value !== id,
          )
        : [...values, id]

      return {
        ...current,
        [key]: next,
      }
    })
  }

  function MovieCard({
    movie,
  }: {
    movie: DisplayMovie
  }) {
    const isInList = myListIds.includes(
      Number(movie.id),
    )

    return (
      <article className="group min-w-0">
        <div
          className="relative aspect-[2/3] cursor-pointer overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03]"
          onClick={() =>
            openMovie(movie)
          }
        >
          {movie.poster ? (
            <img
              src={movie.poster}
              alt={movie.title}
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Film
                size={38}
                className="text-white/15"
              />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent opacity-80" />

          <button
            type="button"
            aria-label={
              isInList
                ? `Remove ${movie.title} from My List`
                : `Add ${movie.title} to My List`
            }
            onClick={(event) => {
              event.stopPropagation()
              toggleMyList(
                Number(movie.id),
              )
            }}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white backdrop-blur transition hover:bg-white hover:text-black"
          >
            {isInList ? (
              <Check size={16} />
            ) : (
              <Plus size={16} />
            )}
          </button>

          <div className="absolute inset-x-0 bottom-0 p-3">
            <h3 className="truncate text-sm font-bold text-white">
              {movie.title}
            </h3>

            <p className="mt-1 truncate text-[11px] text-white/45">
              {movie.year} •{' '}
              {movie.category}
            </p>
          </div>
        </div>
      </article>
    )
  }

  function MovieRow({
    title,
    movies: rowMovies,
  }: {
    title: string
    movies: DisplayMovie[]
  }) {
    return (
      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-black tracking-tight text-white">
            {title}
          </h2>

          <span className="text-xs text-white/25">
            {rowMovies.length}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {rowMovies.map((movie) => (
            <MovieCard
              key={movie.id}
              movie={movie}
            />
          ))}
        </div>
      </section>
    )
  }

  function renderMovieGrid(
    values: DisplayMovie[],
    emptyMessage: string,
  ): ReactNode {
    if (values.length === 0) {
      return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center">
          <Film
            size={42}
            className="mx-auto text-white/15"
          />

          <p className="mt-4 text-sm text-white/35">
            {emptyMessage}
          </p>
        </div>
      )
    }

    const sorted = sortDisplayMovies(
      values,
      sortMode,
    )

    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {sorted.map((movie) => (
          <MovieCard
            key={movie.id}
            movie={movie}
          />
        ))}
      </div>
    )
  }

  function metadataSection(
    title: string,
    icon: ReactNode,
    items: Array<{
      id: string
      name: string
    }>,
    selected: string[],
    onToggle: (id: string) => void,
  ): ReactNode {
    if (items.length === 0) {
      return null
    }

    return (
      <div>
        <div className="mb-2 flex items-center gap-2">
          {icon}

          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/30">
            {title}
          </p>
        </div>

        <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto pr-1">
          {items.map((item) => {
            const active =
              selected.includes(item.id)

            return (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  onToggle(item.id)
                }
                className={
                  active
                    ? 'rounded-full border border-white/30 bg-white px-3 py-1.5 text-[11px] font-bold text-black'
                    : 'rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/45 transition hover:bg-white/10 hover:text-white'
                }
              >
                {item.name}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const activeFilterCount =
    filters.title.trim() ||
    filters.actor.trim() ||
    filters.director.trim() ||
    filters.year ||
    filters.minRating ||
    filters.contentType ||
    filters.quality
      ? 1
      : 0

  const metadataFilterCount =
    filters.genreIds.length +
    filters.subgenreIds.length +
    filters.countryIds.length +
    filters.regionIds.length +
    filters.industryIds.length +
    filters.languageIds.length +
    filters.collectionIds.length +
    filters.tags.length

  const totalActiveFilters =
    activeFilterCount +
    metadataFilterCount

  function renderFilterBar(): ReactNode {
    return (
      <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/25"
            />

            <input
              value={filters.title}
              onChange={(event) =>
                updateFilter(
                  'title',
                  event.target.value,
                )
              }
              placeholder="Search movies, shows, titles..."
              className="h-11 w-full rounded-xl border border-white/10 bg-black/30 pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/25"
            />
          </div>

          <select
            value={sortMode}
            onChange={(event) =>
              setSortMode(
                event.target.value as SortMode,
              )
            }
            className="h-11 rounded-xl border border-white/10 bg-black px-4 text-sm text-white/70 outline-none"
          >
            <option value="popular">
              Popular
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

          <button
            type="button"
            onClick={() =>
              setShowFilters(
                (current) => !current,
              )
            }
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white/65 transition hover:bg-white/10 hover:text-white"
          >
            <SlidersHorizontal
              size={16}
            />

            Filters

            {totalActiveFilters > 0 && (
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-black">
                {totalActiveFilters}
              </span>
            )}

            <ChevronDown
              size={15}
              className={
                showFilters
                  ? 'rotate-180 transition'
                  : 'transition'
              }
            />
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 space-y-5 border-t border-white/5 pt-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <input
                value={filters.actor}
                onChange={(event) =>
                  updateFilter(
                    'actor',
                    event.target.value,
                  )
                }
                placeholder="Actor"
                className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-white/25"
              />

              <input
                value={filters.director}
                onChange={(event) =>
                  updateFilter(
                    'director',
                    event.target.value,
                  )
                }
                placeholder="Director"
                className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-white/25"
              />

              <input
                value={filters.year}
                onChange={(event) =>
                  updateFilter(
                    'year',
                    event.target.value,
                  )
                }
                placeholder="Release year"
                inputMode="numeric"
                className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-white/25"
              />

              <input
                value={filters.minRating}
                onChange={(event) =>
                  updateFilter(
                    'minRating',
                    event.target.value,
                  )
                }
                placeholder="Minimum rating"
                inputMode="decimal"
                className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-white/25"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <select
                value={filters.contentType}
                onChange={(event) =>
                  updateFilter(
                    'contentType',
                    event.target
                      .value as DiscoveryFilters['contentType'],
                  )
                }
                className="h-10 rounded-xl border border-white/10 bg-black px-3 text-sm text-white/60 outline-none"
              >
                <option value="">
                  All content types
                </option>
                <option value="Movie">
                  Movie
                </option>
                <option value="Series">
                  Series
                </option>
                <option value="TV Series">
                  TV Series
                </option>
                <option value="Episode">
                  Episode
                </option>
                <option value="Documentary">
                  Documentary
                </option>
              </select>

              <select
                value={filters.quality}
                onChange={(event) =>
                  updateFilter(
                    'quality',
                    event.target
                      .value as DiscoveryFilters['quality'],
                  )
                }
                className="h-10 rounded-xl border border-white/10 bg-black px-3 text-sm text-white/60 outline-none"
              >
                <option value="">
                  Any video quality
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

            {metadataSection(
              'Genres',
              <Film
                size={14}
                className="text-white/35"
              />,
              metadataCatalog?.genres ?? [],
              filters.genreIds,
              (id) =>
                toggleMetadataFilter(
                  'genreIds',
                  id,
                ),
            )}

            {metadataSection(
              'Subgenres',
              <Layers3
                size={14}
                className="text-white/35"
              />,
              metadataCatalog?.subgenres ?? [],
              filters.subgenreIds,
              (id) =>
                toggleMetadataFilter(
                  'subgenreIds',
                  id,
                ),
            )}

            {metadataSection(
              'Countries',
              <Globe2
                size={14}
                className="text-white/35"
              />,
              metadataCatalog?.countries ?? [],
              filters.countryIds,
              (id) =>
                toggleMetadataFilter(
                  'countryIds',
                  id,
                ),
            )}

            {metadataSection(
              'Regions',
              <Globe2
                size={14}
                className="text-white/35"
              />,
              metadataCatalog?.regions ?? [],
              filters.regionIds,
              (id) =>
                toggleMetadataFilter(
                  'regionIds',
                  id,
                ),
            )}

            {metadataSection(
              'Film Industries',
              <Film
                size={14}
                className="text-white/35"
              />,
              metadataCatalog?.industries ?? [],
              filters.industryIds,
              (id) =>
                toggleMetadataFilter(
                  'industryIds',
                  id,
                ),
            )}

            {metadataSection(
              'Languages',
              <Globe2
                size={14}
                className="text-white/35"
              />,
              metadataCatalog?.languages ?? [],
              filters.languageIds,
              (id) =>
                toggleMetadataFilter(
                  'languageIds',
                  id,
                ),
            )}

            {metadataSection(
              'Collections',
              <Layers3
                size={14}
                className="text-white/35"
              />,
              metadataCatalog?.collections ?? [],
              filters.collectionIds,
              (id) =>
                toggleMetadataFilter(
                  'collectionIds',
                  id,
                ),
            )}

            {metadataSection(
              'Tags',
              <Sparkles
                size={14}
                className="text-white/35"
              />,
              metadataCatalog?.tags ?? [],
              filters.tags,
              (id) =>
                toggleMetadataFilter(
                  'tags',
                  id,
                ),
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
              <span className="text-xs text-white/35">
                {totalActiveFilters === 0
                  ? 'No filters applied'
                  : `${totalActiveFilters} filter${
                      totalActiveFilters ===
                      1
                        ? ''
                        : 's'
                    } applied`}
              </span>

              <button
                type="button"
                onClick={clearFilters}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                Reset Filters
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderHero(): ReactNode {
    if (!featuredMovie) {
      return null
    }

    const isInList =
      myListIds.includes(
        Number(featuredMovie.id),
      )

    return (
      <section className="relative mb-12 overflow-hidden rounded-3xl border border-white/10 bg-black">
        <img
          src={
            featuredMovie.poster ||
            heroImage
          }
          alt={featuredMovie.title}
          className="absolute inset-0 h-full w-full object-cover opacity-50"
        />

        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/10" />

        <div className="relative flex min-h-[500px] items-end px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-white/45">
              Featured Film
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-6xl">
              {featuredMovie.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-white/45">
              <span>
                {featuredMovie.year}
              </span>

              <span>•</span>

              <span>
                {featuredMovie.category}
              </span>

              {featuredMovie.duration && (
                <>
                  <span>•</span>
                  <span>
                    {featuredMovie.duration}
                  </span>
                </>
              )}

              {featuredMovie.rating && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Star size={12} />
                    {featuredMovie.rating}
                  </span>
                </>
              )}
            </div>

            <p className="mt-5 max-w-xl text-sm leading-7 text-white/55 sm:text-base">
              {featuredMovie.description}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  startWatching(
                    featuredMovie,
                  )
                }
                className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-white/90"
              >
                <Play
                  size={17}
                  fill="currentColor"
                />
                Play
              </button>

              <button
                type="button"
                onClick={() =>
                  toggleMyList(
                    Number(
                      featuredMovie.id,
                    ),
                  )
                }
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white/75 transition hover:bg-white/10 hover:text-white"
              >
                {isInList ? (
                  <>
                    <Check size={17} />
                    In My List
                  </>
                ) : (
                  <>
                    <Plus size={17} />
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

  function renderHomeSection(): ReactNode {
    return (
      <>
        {renderHero()}

        {continueWatchingMovies.length >
          0 && (
          <MovieRow
            title="Continue Watching"
            movies={
              continueWatchingMovies
            }
          />
        )}

        {trendingMovies.length > 0 && (
          <MovieRow
            title="Trending Now"
            movies={trendingMovies}
          />
        )}

        {newReleaseMovies.length >
          0 && (
          <MovieRow
            title="New Releases"
            movies={
              newReleaseMovies
            }
          />
        )}

        {popularMovies.length > 0 && (
          <MovieRow
            title="Popular on PMF"
            movies={popularMovies}
          />
        )}

        {pmfOriginalMovies.length >
          0 && (
          <MovieRow
            title="PMF Originals"
            movies={
              pmfOriginalMovies
            }
          />
        )}

        {featuredMovies.length > 1 && (
          <MovieRow
            title="Featured"
            movies={featuredMovies}
          />
        )}

                {discoveryCollections.map(
          (row) => (
            <MovieRow
              key={row.title}
              title={row.title}
              movies={row.movies}
            />
          ),
        )}

        {movieOnlyMovies.length === 0 &&
          !loading && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center">
              <Film
                size={42}
                className="mx-auto text-white/15"
              />

              <h2 className="mt-4 text-lg font-bold text-white">
                Your PMF catalog is ready
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/35">
                Add licensed movie and TV
                content through the PMF
                catalog to begin building
                the full streaming library.
              </p>
            </div>
          )}
      </>
    )
  }

  function renderMoviesSection(): ReactNode {
    return (
      <>
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/30">
            PMF Library
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Movies
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/35">
            Explore the movie catalog
            using professional global
            metadata and discovery filters.
          </p>
        </div>

        {renderFilterBar()}

        {renderMovieGrid(
          movieOnlyMovies,
          'No movies match your current filters.',
        )}
      </>
    )
  }

  function renderTVSection(): ReactNode {
    return (
      <>
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/30">
            PMF Library
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
            TV Series
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/35">
            TV shows, seasons, and
            episodes are part of the PMF
            universal content foundation.
          </p>
        </div>

        {renderFilterBar()}

        {renderMovieGrid(
          tvMovies,
          'No TV series are available yet.',
        )}
      </>
    )
  }

  function renderMyListSection(): ReactNode {
    return (
      <>
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <Bookmark
              size={24}
              className="text-white/70"
            />

            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              My List
            </h1>
          </div>

          <p className="mt-2 text-sm text-white/35">
            Your saved movies and shows.
          </p>
        </div>

        {renderMovieGrid(
          myListMovies,
          'Your My List is empty. Add movies using the + button.',
        )}
      </>
    )
  }

  function renderMovieDetails(): ReactNode {
    if (!selectedMovie) {
      return null
    }

    const canonical = movies.find(
      (movie) =>
        String(movie.id) ===
        String(selectedMovie.id),
    )

    const isInList =
      myListIds.includes(
        Number(selectedMovie.id),
      )

    const genreNames =
      canonical?.genres.map((id) =>
        metadataName(
          metadataCatalog,
          id,
        ),
      ) ?? []

    const countryNames =
      canonical?.countryIds.map((id) =>
        metadataName(
          metadataCatalog,
          id,
        ),
      ) ?? []

    const languageNames =
      canonical?.languageIds.map((id) =>
        metadataName(
          metadataCatalog,
          id,
        ),
      ) ?? []

    return (
      <div
        className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-md"
        onClick={closeMovie}
      >
        <div
          className="relative my-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b0b] shadow-2xl"
          onClick={(event) =>
            event.stopPropagation()
          }
        >
          <button
            type="button"
            onClick={closeMovie}
            aria-label="Close movie details"
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white/70 backdrop-blur transition hover:bg-white hover:text-black"
          >
            <X size={18} />
          </button>

          <div className="relative min-h-[280px] sm:min-h-[360px]">
            <img
              src={
                canonical?.backdropUrl ||
                selectedMovie.poster ||
                heroImage
              }
              alt={selectedMovie.title}
              className="absolute inset-0 h-full w-full object-cover"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0b] via-black/40 to-black/10" />
          </div>

          <div className="relative -mt-20 px-5 pb-8 sm:px-8 lg:px-10">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-black">
                  {selectedMovie.type}
                </span>

                {selectedMovie.year && (
                  <span className="text-xs text-white/45">
                    {selectedMovie.year}
                  </span>
                )}

                {selectedMovie.rating && (
                  <span className="flex items-center gap-1 text-xs text-white/45">
                    <Star size={12} />
                    {selectedMovie.rating}
                  </span>
                )}

                {selectedMovie.duration && (
                  <span className="text-xs text-white/45">
                    {selectedMovie.duration}
                  </span>
                )}
              </div>

              <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
                {selectedMovie.title}
              </h2>

              {canonical?.originalTitle &&
                canonical.originalTitle !==
                  selectedMovie.title && (
                  <p className="mt-2 text-xs text-white/30">
                    Original title:{' '}
                    {canonical.originalTitle}
                  </p>
                )}

              {canonical?.tagline && (
                <p className="mt-3 text-sm font-semibold italic text-white/50">
                  “{canonical.tagline}”
                </p>
              )}

              <p className="mt-5 text-sm leading-7 text-white/55 sm:text-base">
                {selectedMovie.description}
              </p>

              {genreNames.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2">
                  {genreNames.map(
                    (name) => (
                      <span
                        key={name}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/55"
                      >
                        {name}
                      </span>
                    ),
                  )}
                </div>
              )}

              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    startWatching(
                      selectedMovie,
                    )
                  }
                  className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-white/90"
                >
                  <Play
                    size={17}
                    fill="currentColor"
                  />
                  Play
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
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white/75 transition hover:bg-white/10 hover:text-white"
                >
                  {isInList ? (
                    <>
                      <Check size={17} />
                      In My List
                    </>
                  ) : (
                    <>
                      <Plus size={17} />
                      My List
                    </>
                  )}
                </button>
              </div>

              {(countryNames.length >
                0 ||
                languageNames.length >
                  0) && (
                <div className="mt-8 grid gap-4 border-t border-white/5 pt-6 sm:grid-cols-2">
                  {countryNames.length >
                    0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-white/25">
                        Countries
                      </p>

                      <p className="mt-2 text-sm text-white/55">
                        {countryNames.join(
                          ', ',
                        )}
                      </p>
                    </div>
                  )}

                  {languageNames.length >
                    0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-white/25">
                        Languages
                      </p>

                      <p className="mt-2 text-sm text-white/55">
                        {languageNames.join(
                          ', ',
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  function renderWatching(): ReactNode {
  if (!watchingMovie) {
    return null
  }

  const videoUrl = getMovieVideoUrl(
    watchingMovie,
  )

  const isYouTube =
    videoUrl.includes('youtube.com') ||
    videoUrl.includes('youtu.be')

  const playableUrl = isYouTube
    ? getYouTubeEmbedUrl(videoUrl)
    : videoUrl

  const canonical = movies.find(
    (movie) =>
      String(movie.id) ===
      String(watchingMovie.id),
  )

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black p-0 sm:p-4">
      <div className="relative flex h-full w-full max-w-7xl flex-col overflow-hidden bg-black sm:h-auto sm:max-h-[95vh] sm:rounded-2xl sm:border sm:border-white/10">
        <div className="flex items-center justify-between border-b border-white/10 bg-black/90 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">
              {watchingMovie.title}
function renderWatching(): ReactNode {
  if (!watchingMovie) {
    return null
  }

  const videoUrl = getMovieVideoUrl(
    watchingMovie,
  )

  const isYouTube =
    videoUrl.includes('youtube.com') ||
    videoUrl.includes('youtu.be')

  const numericId = Number(
    watchingMovie.id,
  )

  const continueEntry =
    Number.isFinite(numericId)
      ? getContinueWatchingEntry(
          numericId,
        )
      : null

  const resumeTime =
    continueEntry?.position ?? 0

  const getYouTubeResumeUrl = (
    url: string,
    startTime: number,
  ): string => {
    const baseUrl =
      getYouTubeEmbedUrl(url)

    if (startTime <= 0) {
      return baseUrl
    }

    try {
      const parsed = new URL(baseUrl)

      parsed.searchParams.set(
        'start',
        String(
          Math.floor(startTime),
        ),
      )

      return parsed.toString()
    } catch {
      return baseUrl
    }
  }

  const playableUrl = isYouTube
    ? getYouTubeResumeUrl(
        videoUrl,
        resumeTime,
      )
    : videoUrl

  const canonical = movies.find(
    (movie) =>
      String(movie.id) ===
      String(watchingMovie.id),
  )

  const handlePlaybackUpdate = (
    currentTime: number,
  ): void => {
    if (
      !Number.isFinite(numericId) ||
      currentTime <= 0
    ) {
      return
    }

    const currentEntry =
      getContinueWatchingEntry(
        numericId,
      )

    saveContinueWatching(
      numericId,
      currentTime,
      currentEntry?.duration ?? 0,
    )
  }

  const handlePlaybackEnded = (): void => {
    if (Number.isFinite(numericId)) {
      removeContinueWatching(
        numericId,
      )

      setContinueWatchingIds(
        getContinueWatchingIds(),
      )
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black p-0 sm:p-4">
      <div className="relative flex h-full w-full max-w-7xl flex-col overflow-hidden bg-black sm:h-auto sm:max-h-[95vh] sm:rounded-2xl sm:border sm:border-white/10">
        <div className="flex items-center justify-between border-b border-white/10 bg-black/90 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">
              {watchingMovie.title}
            </p>

            <p className="text-[11px] text-white/35">
              {watchingMovie.year} •{' '}
              {watchingMovie.type}
            </p>
          </div>

          <button
            type="button"
            onClick={closeWatching}
            aria-label="Close player"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white hover:text-black"
          >
            <X size={17} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center bg-black">
          {playableUrl ? (
            isYouTube ? (
              <iframe
                src={playableUrl}
                title={watchingMovie.title}
                className="aspect-video h-auto w-full"
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <VideoPlayer
                videoUrl={playableUrl}
                videoAssets={
                  canonical?.videoAssets ?? []
                }
                subtitles={
                  canonical?.subtitles ?? []
                }
                posterUrl={
                  canonical?.posterUrl ||
                  watchingMovie.poster
                }
                title={watchingMovie.title}
                autoPlay
                initialTime={resumeTime}
                onTimeUpdate={
                  handlePlaybackUpdate
                }
                onEnded={
                  handlePlaybackEnded
                }
              />
            )
          ) : (
            <div className="px-6 text-center">
              <Film
                size={44}
                className="mx-auto text-white/15"
              />

              <h2 className="mt-4 text-lg font-bold text-white">
                Video unavailable
              </h2>

              <p className="mt-2 text-sm text-white/35">
                This title does not have a
                playable video source yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
        }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-white">
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-white" />

            <p className="mt-4 text-sm text-white/40">
              Loading PMF...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#050505]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() =>
              setSection('home')
            }
            className="shrink-0 text-left"
          >
            <div className="text-lg font-black tracking-tight text-white">
              PMF
              <span className="text-white/35">
                -FLIX
              </span>
            </div>

            <div className="hidden text-[8px] font-bold uppercase tracking-[0.22em] text-white/25 sm:block">
              Your World. Your Stories.
              Your Flix.
            </div>
          </button>

          <nav className="hidden items-center gap-1 md:flex">
            <button
              type="button"
              onClick={() =>
                setSection('home')
              }
              className={
                section === 'home'
                  ? 'rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white'
                  : 'rounded-lg px-3 py-2 text-xs font-semibold text-white/40 transition hover:bg-white/5 hover:text-white'
              }
            >
              Home
            </button>

            <button
              type="button"
              onClick={() =>
                setSection('movies')
              }
              className={
                section === 'movies'
                  ? 'rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white'
                  : 'rounded-lg px-3 py-2 text-xs font-semibold text-white/40 transition hover:bg-white/5 hover:text-white'
              }
            >
              Movies
            </button>

            <button
              type="button"
              onClick={() =>
                setSection('tv')
              }
              className={
                section === 'tv'
                  ? 'rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white'
                  : 'rounded-lg px-3 py-2 text-xs font-semibold text-white/40 transition hover:bg-white/5 hover:text-white'
              }
            >
              TV Series
            </button>

            <button
              type="button"
              onClick={() =>
                setSection('my-list')
              }
              className={
                section === 'my-list'
                  ? 'rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white'
                  : 'rounded-lg px-3 py-2 text-xs font-semibold text-white/40 transition hover:bg-white/5 hover:text-white'
              }
            >
              My List
            </button>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setSection('my-list')
              }
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/55 transition hover:bg-white/10 hover:text-white md:hidden"
              aria-label="My List"
            >
              <Bookmark size={16} />
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-bold text-white/55 transition hover:bg-white hover:text-black"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">
                Sign out
              </span>
            </button>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto border-t border-white/5 px-4 py-2 md:hidden">
          <button
            type="button"
            onClick={() =>
              setSection('home')
            }
            className={
              section === 'home'
                ? 'rounded-lg bg-white px-3 py-1.5 text-[11px] font-black text-black'
                : 'rounded-lg px-3 py-1.5 text-[11px] font-bold text-white/40'
            }
          >
            Home
          </button>

          <button
            type="button"
            onClick={() =>
              setSection('movies')
            }
            className={
              section === 'movies'
                ? 'rounded-lg bg-white px-3 py-1.5 text-[11px] font-black text-black'
                : 'rounded-lg px-3 py-1.5 text-[11px] font-bold text-white/40'
            }
          >
            Movies
          </button>

          <button
            type="button"
            onClick={() =>
              setSection('tv')
            }
            className={
              section === 'tv'
                ? 'rounded-lg bg-white px-3 py-1.5 text-[11px] font-black text-black'
                : 'rounded-lg px-3 py-1.5 text-[11px] font-bold text-white/40'
            }
          >
            TV
          </button>

          <button
            type="button"
            onClick={() =>
              setSection('my-list')
            }
            className={
              section === 'my-list'
                ? 'rounded-lg bg-white px-3 py-1.5 text-[11px] font-black text-black'
                : 'rounded-lg px-3 py-1.5 text-[11px] font-bold text-white/40'
            }
          >
            My List
          </button>
        </div>
      </header>

      {errorMessage && (
        <div className="mx-auto mt-4 max-w-[1600px] px-4 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
            {errorMessage}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        {section === 'home' &&
          renderHomeSection()}

        {section === 'movies' &&
          renderMoviesSection()}

        {section === 'tv' &&
          renderTVSection()}

        {section === 'my-list' &&
          renderMyListSection()}
      </main>

      <footer className="border-t border-white/5 px-4 py-8 text-center text-[11px] text-white/20">
        © {new Date().getFullYear()}{' '}
        Prince Mufasa Flix. All rights
        reserved.
      </footer>

      {renderMovieDetails()}
      {renderWatching()}
    </div>
  )
}

export default function App() {
  const [session, setSession] =
    useState<
      Awaited<
        ReturnType<
          typeof supabase.auth.getSession
        >
      >['data']['session']
    >(null)

  const [checkingAuth, setCheckingAuth] =
    useState(true)

  useEffect(() => {
    let mounted = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) {
          return
        }

        setSession(data.session)
        setCheckingAuth(false)
      })
      .catch(() => {
        if (mounted) {
          setSession(null)
          setCheckingAuth(false)
        }
      })

    const {
      data: listener,
    } =
      supabase.auth.onAuthStateChange(
        (_event, nextSession) => {
          if (!mounted) {
            return
          }

          setSession(nextSession)
          setCheckingAuth(false)
        },
      )

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505]">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-white" />

          <p className="mt-4 text-sm text-white/40">
            Loading PMF...
          </p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <AuthScreen />
  }

  return <AuthenticatedApp />
}
