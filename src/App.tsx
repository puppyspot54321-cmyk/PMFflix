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
  Tv,
  Home,
  Bookmark,
  Clock3,
  Star,
  Download,
  Sparkles,
  Globe2,
  Layers3,
} from 'lucide-react'
import type { Session } from '@supabase/supabase-js'

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

type Section = 'home' | 'movies' | 'tv' | 'my-list'

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
      const id = parsed.pathname.replace('/', '').trim()

      return id
        ? `https://www.youtube.com/embed/${id}?autoplay=1`
        : url
    }

    const videoId = parsed.searchParams.get('v')

    return videoId
      ? `https://www.youtube.com/embed/${videoId}?autoplay=1`
      : url
  } catch {
    return url
  }
}

function getMovieVideoUrl(movie: DisplayMovie): string {
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
  const normalizedQuery = normalizeText(query)

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
          : Number.parseFloat(String(a.rating ?? '0'))

      const ratingB =
        typeof b.rating === 'number'
          ? b.rating
          : Number.parseFloat(String(b.rating ?? '0'))

      return (
        (Number.isFinite(ratingB) ? ratingB : 0) -
        (Number.isFinite(ratingA) ? ratingA : 0)
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
  try {
    const saved = localStorage.getItem(
      'pmf-continue-watching',
    )

    if (!saved) {
      return []
    }

    const parsed: unknown = JSON.parse(saved)

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

function saveContinueWatching(id: number): void {
  try {
    const current = getContinueWatchingIds()

    if (!current.includes(id)) {
      localStorage.setItem(
        'pmf-continue-watching',
        JSON.stringify([
          ...current,
          id,
        ]),
      )
    }
  } catch {
    // Ignore localStorage failures.
  }
}

function removeContinueWatching(id: number): void {
  try {
    const current = getContinueWatchingIds()

    localStorage.setItem(
      'pmf-continue-watching',
      JSON.stringify(
        current.filter(
          (value) => value !== id,
        ),
      ),
    )
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

    const parsed: unknown = JSON.parse(saved)

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
  const [movies, setMovies] = useState<CanonicalMovie[]>(
    [],
  )

  const [metadataCatalog, setMetadataCatalog] =
    useState<MetadataCatalog | null>(null)

  const [loading, setLoading] = useState(true)

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

  const [continueWatchingIds, setContinueWatchingIds] =
    useState<number[]>(getContinueWatchingIds)

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
        collectionIds: filters.collectionIds,
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
        canonicalIds.has(String(movie.id)) &&
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
      movieOnlyMovies.filter(
        (_, index) =>
          index < 12,
      ),
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
          canonical?.isPmfOriginal === true ||
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

  const continueWatchingMovies = useMemo(
    () =>
      movieOnlyMovies.filter((movie) =>
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
    [
      displayMovies,
      myListIds,
    ],
  )

  const featuredMovie =
    featuredMovies[0] ??
    movieOnlyMovies[0] ??
    null

  const updateFilter = <
    K extends keyof DiscoveryFilters,
  >(
    key: K,
    value: DiscoveryFilters[K],
  ) => {
    setFilters(
      (current) => ({
        ...current,
        [key]: value,
      }),
    )
  }

      const toggleMyList = (movieId: number) => {
    setMyListIds((current) => {
      const next = current.includes(movieId)
        ? current.filter((id) => id !== movieId)
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

  const openMovie = (movie: DisplayMovie) => {
    setSelectedMovie(movie)
  }

  const closeMovie = () => {
    setSelectedMovie(null)
  }

  const startWatching = (movie: DisplayMovie) => {
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

  const closeWatching = () => {
    setWatchingMovie(null)
    setContinueWatchingIds(
      getContinueWatchingIds(),
    )
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  const clearFilters = () => {
    setFilters({
      ...EMPTY_FILTERS,
    })
  }

  const MovieCard = ({
    movie,
  }: {
    movie: DisplayMovie
  }) => {
    const isInList = myListIds.includes(
      Number(movie.id),
    )

    return (
      <article className="group min-w-0">
        <div
          className="relative aspect-[2/3] cursor-pointer overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03]"
          onClick={() => openMovie(movie)}
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

          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent opacity-70" />

          <div className="absolute inset-x-0 bottom-0 p-3">
            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold text-white">
                  {movie.title}
                </h3>

                <p className="mt-1 truncate text-[11px] text-white/45">
                  {movie.year} • {movie.category}
                </p>
              </div>

              {movie.rating && (
                <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-white/70">
                  <Star size={11} />
                  {movie.rating}
                </span>
              )}
            </div>
          </div>

          <div className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition group-hover:opacity-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black shadow-xl">
              <Play
                size={19}
                fill="currentColor"
              />
            </div>
          </div>

          <button
            type="button"
            aria-label={
              isInList
                ? `Remove ${movie.title} from My List`
                : `Add ${movie.title} to My List`
            }
            onClick={(event) => {
              event.stopPropagation()
              toggleMyList(Number(movie.id))
            }}
            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/65 text-white backdrop-blur transition hover:bg-white hover:text-black"
          >
            {isInList ? (
              <Check size={16} />
            ) : (
              <Plus size={16} />
            )}
          </button>
        </div>
      </article>
    )
  }

  const MovieRow = ({
    title,
    movies: rowMovies,
    onSelect,
  }: {
    title: string
    movies: DisplayMovie[]
    onSelect: (movie: DisplayMovie) => void
  }) => {
    if (rowMovies.length === 0) {
      return null
    }

    return (
      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-black tracking-tight sm:text-2xl">
            {title}
          </h2>

          <button
            type="button"
            onClick={() => setSection('movies')}
            className="flex shrink-0 items-center gap-1 text-xs font-semibold text-white/35 transition hover:text-white"
          >
            See all
            <ChevronDown
              size={14}
              className="-rotate-90"
            />
          </button>
        </div>

        <div className="grid grid-flow-col auto-cols-[145px] gap-3 overflow-x-auto pb-3 sm:auto-cols-[175px] sm:gap-4 lg:auto-cols-[190px]">
          {rowMovies.map((movie) => (
            <div
              key={movie.id}
              onClick={() => onSelect(movie)}
            >
              <MovieCard movie={movie} />
            </div>
          ))}
        </div>
      </section>
    )
  }

  const renderFilters = () => (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-white/40">
            Search
          </span>

          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
            />

            <input
              value={filters.title}
              onChange={(event) =>
                updateFilter(
                  'title',
                  event.target.value,
                )
              }
              placeholder="Title, keyword..."
              className="h-10 w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/25"
            />
          </div>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-white/40">
            Type
          </span>

          <select
            value={filters.contentType}
            onChange={(event) =>
              updateFilter(
                'contentType',
                event.target.value as DiscoveryFilters['contentType'],
              )
            }
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none"
          >
            <option value="">All types</option>
            <option value="movie">Movie</option>
            <option value="tv_show">TV Show</option>
            <option value="documentary">
              Documentary
            </option>
            <option value="short_film">
              Short Film
            </option>
            <option value="special">Special</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-white/40">
            Genre
          </span>

          <select
            value={filters.genreIds[0] ?? ''}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                genreIds: event.target.value
                  ? [event.target.value]
                  : [],
              }))
            }
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none"
          >
            <option value="">All genres</option>

            {(metadataCatalog?.genres ?? []).map(
              (genre) => (
                <option
                  key={genre.id}
                  value={genre.id}
                >
                  {genre.name}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-white/40">
            Quality
          </span>

          <select
            value={filters.quality}
            onChange={(event) =>
              updateFilter(
                'quality',
                event.target.value as DiscoveryFilters['quality'],
              )
            }
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none"
          >
            <option value="">Any quality</option>
            <option value="480p">480p</option>
            <option value="720p">720p</option>
            <option value="1080p">1080p</option>
            <option value="1440p">1440p</option>
            <option value="4k">4K</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-white/40">
            Release Year
          </span>

          <input
            type="number"
            min="1900"
            max="2100"
            value={filters.year}
            onChange={(event) =>
              updateFilter(
                'year',
                event.target.value,
              )
            }
            placeholder="2026"
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/25"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-white/40">
            Minimum Rating
          </span>

          <select
            value={filters.minRating}
            onChange={(event) =>
              updateFilter(
                'minRating',
                event.target.value,
              )
            }
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none"
          >
            <option value="">Any rating</option>
            <option value="9">9+</option>
            <option value="8">8+</option>
            <option value="7">7+</option>
            <option value="6">6+</option>
            <option value="5">5+</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-white/40">
            Country
          </span>

          <select
            value={filters.countryIds[0] ?? ''}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                countryIds: event.target.value
                  ? [event.target.value]
                  : [],
              }))
            }
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none"
          >
            <option value="">All countries</option>

            {(metadataCatalog?.countries ?? []).map(
              (country) => (
                <option
                  key={country.id}
                  value={country.id}
                >
                  {country.name}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-white/40">
            Language
          </span>

          <select
            value={filters.languageIds[0] ?? ''}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                languageIds: event.target.value
                  ? [event.target.value]
                  : [],
              }))
            }
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none"
          >
            <option value="">All languages</option>

            {(metadataCatalog?.languages ?? []).map(
              (language) => (
                <option
                  key={language.id}
                  value={language.id}
                >
                  {language.name}
                </option>
              ),
            )}
          </select>
        </label>
      </div>
    </div>
  )
  const toggleMetadataFilter = (
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
  ) => {
    setFilters((current) => {
      const values = current[key]

      return {
        ...current,
        [key]: values.includes(id)
          ? values.filter((value) => value !== id)
          : [...values, id],
      }
    })
  }

  const activeFilterCount =
    filters.genreIds.length +
    filters.subgenreIds.length +
    filters.countryIds.length +
    filters.regionIds.length +
    filters.industryIds.length +
    filters.languageIds.length +
    filters.collectionIds.length +
    filters.tags.length +
    (filters.actor ? 1 : 0) +
    (filters.director ? 1 : 0) +
    (filters.year ? 1 : 0) +
    (filters.minRating ? 1 : 0) +
    (filters.contentType ? 1 : 0) +
    (filters.quality ? 1 : 0)

  const clearAllFilters = () => {
    setFilters({
      ...EMPTY_FILTERS,
    })
  }

  const toggleMyList = (movieId: number) => {
    setMyListIds((current) => {
      const next = current.includes(movieId)
        ? current.filter((id) => id !== movieId)
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

  const openMovie = (movie: DisplayMovie) => {
    setSelectedMovie(movie)
  }

  const closeMovie = () => {
    setSelectedMovie(null)
  }

  const startWatching = (movie: DisplayMovie) => {
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

  const closeWatching = () => {
    setWatchingMovie(null)

    setContinueWatchingIds(
      getContinueWatchingIds(),
    )
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  const mobileNavItems = [
    {
      id: 'home' as Section,
      label: 'Home',
      icon: Home,
    },
    {
      id: 'movies' as Section,
      label: 'Movies',
      icon: Film,
    },
    {
      id: 'tv' as Section,
      label: 'TV Series',
      icon: Tv,
    },
    {
      id: 'my-list' as Section,
      label: 'My List',
      icon: Bookmark,
    },
  ]

  const metadataSection = (
    title: string,
    icon: ReactNode,
    items: Array<{ id: string; name: string }>,
    selected: string[],
    onToggle: (id: string) => void,
  ) => {
    if (items.length === 0) {
      return null
    }

    return (
      <div>
        <div className="mb-2 flex items-center gap-2">
          {icon}

          <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/35">
            {title}
          </p>
        </div>

        <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto pr-1">
          {items.map((item) => {
            const active = selected.includes(item.id)

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggle(item.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'border-white bg-white text-black'
                    : 'border-white/10 bg-white/5 text-white/55 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.name}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const renderAdvancedFilters = () => (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-white/40">
            Actor
          </span>

          <input
            value={filters.actor}
            onChange={(event) =>
              updateFilter(
                'actor',
                event.target.value,
              )
            }
            placeholder="Search by actor"
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/25"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-white/40">
            Director
          </span>

          <input
            value={filters.director}
            onChange={(event) =>
              updateFilter(
                'director',
                event.target.value,
              )
            }
            placeholder="Search by director"
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/25"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-white/40">
            Release Year
          </span>

          <input
            type="number"
            min="1900"
            max="2100"
            value={filters.year}
            onChange={(event) =>
              updateFilter(
                'year',
                event.target.value,
              )
            }
            placeholder="e.g. 2026"
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/25"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-white/40">
            Minimum Rating
          </span>

          <select
            value={filters.minRating}
            onChange={(event) =>
              updateFilter(
                'minRating',
                event.target.value,
              )
            }
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none"
          >
            <option value="">Any rating</option>
            <option value="9">9+</option>
            <option value="8">8+</option>
            <option value="7">7+</option>
            <option value="6">6+</option>
            <option value="5">5+</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-white/40">
            Content Type
          </span>

          <select
            value={filters.contentType}
            onChange={(event) =>
              updateFilter(
                'contentType',
                event.target.value as DiscoveryFilters['contentType'],
              )
            }
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none"
          >
            <option value="">All content</option>
            <option value="movie">Movies</option>
            <option value="tv_show">TV Shows</option>
            <option value="season">Seasons</option>
            <option value="episode">Episodes</option>
            <option value="short_film">Short Films</option>
            <option value="documentary">Documentaries</option>
            <option value="special">Specials</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-white/40">
            Video Quality
          </span>

          <select
            value={filters.quality}
            onChange={(event) =>
              updateFilter(
                'quality',
                event.target.value as DiscoveryFilters['quality'],
              )
            }
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none"
          >
            <option value="">Any quality</option>
            <option value="480p">480p</option>
            <option value="720p">720p HD</option>
            <option value="1080p">1080p Full HD</option>
            <option value="1440p">1440p</option>
            <option value="4k">4K Ultra HD</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-white/40">
            Region
          </span>

          <select
            value={filters.regionIds[0] ?? ''}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                regionIds: event.target.value
                  ? [event.target.value]
                  : [],
              }))
            }
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none"
          >
            <option value="">All regions</option>

            {(metadataCatalog?.regions ?? []).map(
              (region) => (
                <option
                  key={region.id}
                  value={region.id}
                >
                  {region.name}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-white/40">
            Film Industry
          </span>

          <select
            value={filters.industryIds[0] ?? ''}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                industryIds: event.target.value
                  ? [event.target.value]
                  : [],
              }))
            }
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none"
          >
            <option value="">All industries</option>

            {(metadataCatalog?.industries ?? []).map(
              (industry) => (
                <option
                  key={industry.id}
                  value={industry.id}
                >
                  {industry.name}
                </option>
              ),
            )}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {metadataSection(
          'Genres',
          <Layers3
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

     const renderAdvancedFilters = () => (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-white/40">
            Actor
          </span>

          <input
            value={filters.actor}
            onChange={(event) =>
              updateFilter(
                'actor',
                event.target.value,
              )
            }
            placeholder="Search by actor"
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/25"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-white/40">
            Director
          </span>

          <input
            value={filters.director}
            onChange={(event) =>
              updateFilter(
                'director',
                event.target.value,
              )
            }
            placeholder="Search by director"
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/25"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-white/40">
            Release Year
          </span>

          <input
            type="number"
            min="1900"
            max="2100"
            value={filters.year}
            onChange={(event) =>
              updateFilter(
                'year',
                event.target.value,
              )
            }
            placeholder="e.g. 2026"
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/25"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-white/40">
            Minimum Rating
          </span>

          <select
            value={filters.minRating}
            onChange={(event) =>
              updateFilter(
                'minRating',
                event.target.value,
              )
            }
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none"
          >
            <option value="">Any rating</option>
            <option value="9">9+</option>
            <option value="8">8+</option>
            <option value="7">7+</option>
            <option value="6">6+</option>
            <option value="5">5+</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-white/40">
            Content Type
          </span>

          <select
            value={filters.contentType}
            onChange={(event) =>
              updateFilter(
                'contentType',
                event.target.value as DiscoveryFilters['contentType'],
              )
            }
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none"
          >
            <option value="">All content</option>
            <option value="movie">Movies</option>
            <option value="tv_show">TV Shows</option>
            <option value="documentary">
              Documentaries
            </option>
            <option value="short_film">
              Short Films
            </option>
            <option value="special">Specials</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-white/40">
            Video Quality
          </span>

          <select
            value={filters.quality}
            onChange={(event) =>
              updateFilter(
                'quality',
                event.target.value as DiscoveryFilters['quality'],
              )
            }
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none"
          >
            <option value="">Any quality</option>
            <option value="480p">480p</option>
            <option value="720p">720p HD</option>
            <option value="1080p">
              1080p Full HD
            </option>
            <option value="1440p">1440p</option>
            <option value="4k">4K Ultra HD</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-white/40">
            Region
          </span>

          <select
            value={filters.regionIds[0] ?? ''}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                regionIds: event.target.value
                  ? [event.target.value]
                  : [],
              }))
            }
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none"
          >
            <option value="">All regions</option>

            {(metadataCatalog?.regions ?? []).map(
              (region) => (
                <option
                  key={region.id}
                  value={region.id}
                >
                  {region.name}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-white/40">
            Film Industry
          </span>

          <select
            value={filters.industryIds[0] ?? ''}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                industryIds: event.target.value
                  ? [event.target.value]
                  : [],
              }))
            }
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none"
          >
            <option value="">All industries</option>

            {(metadataCatalog?.industries ?? []).map(
              (industry) => (
                <option
                  key={industry.id}
                  value={industry.id}
                >
                  {industry.name}
                </option>
              ),
            )}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {metadataSection(
          'Genres',
          <Layers3
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
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
        <span className="text-xs text-white/35">
          {activeFilterCount === 0
            ? 'No filters applied'
            : `${activeFilterCount} filter${
                activeFilterCount === 1
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
  )

  const renderFilterBar = () => (
    <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-white">
            Discover PMF
          </p>

          <p className="mt-1 text-xs text-white/35">
            Search and explore the global content catalog.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={sortMode}
            onChange={(event) =>
              setSortMode(
                event.target.value as SortMode,
              )
            }
            className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white outline-none"
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
              A–Z
            </option>
          </select>

          <button
            type="button"
            onClick={() =>
              setShowFilters(
                (current) => !current,
              )
            }
            className="flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-bold text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <SlidersHorizontal size={14} />

            Filters

            {activeFilterCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-black text-black">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="mt-5 border-t border-white/5 pt-5">
          {renderAdvancedFilters()}
        </div>
      )}
    </div>
  )

  const getSortedMovies = (
    values: DisplayMovie[],
  ): DisplayMovie[] => {
    return sortDisplayMovies(
      values,
      sortMode,
    )
  }

  const renderMovieGrid = (
    values: DisplayMovie[],
    emptyText: string,
  ) => {
    const sorted = getSortedMovies(values)

    if (sorted.length === 0) {
      return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center">
          <Film
            size={38}
            className="mx-auto text-white/15"
          />

          <p className="mt-4 text-sm font-semibold text-white/55">
            {emptyText}
          </p>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white"
            >
              Clear filters
            </button>
          )}
        </div>
      )
    }

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
  const renderHero = () => {
    if (!featuredMovie) {
      return null
    }

    const heroCanonical = movies.find(
      (movie) =>
        String(movie.id) ===
        String(featuredMovie.id),
    )

    const isInList = myListIds.includes(
      Number(featuredMovie.id),
    )

    return (
      <section className="relative -mx-4 mb-10 overflow-hidden sm:-mx-6 lg:-mx-8">
        <div className="relative min-h-[520px]">
          <img
            src={
              heroCanonical?.backdropUrl ||
              featuredMovie.poster ||
              heroImage
            }
            alt={featuredMovie.title}
            className="absolute inset-0 h-full w-full object-cover"
          />

          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/15" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-black/20" />

          <div className="relative flex min-h-[520px] max-w-3xl items-end px-5 pb-12 pt-28 sm:px-8 lg:px-12">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-black">
                  Featured Film
                </span>

                {featuredMovie.featured && (
                  <span className="rounded-md border border-white/15 bg-black/40 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/70 backdrop-blur">
                    PMF Selection
                  </span>
                )}
              </div>

              <h1 className="max-w-2xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-7xl">
                {featuredMovie.title}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/55">
                <span>{featuredMovie.year}</span>

                <span className="text-white/20">
                  •
                </span>

                <span>
                  {featuredMovie.type}
                </span>

                {featuredMovie.duration && (
                  <>
                    <span className="text-white/20">
                      •
                    </span>

                    <span>
                      {featuredMovie.duration}
                    </span>
                  </>
                )}

                {featuredMovie.rating && (
                  <>
                    <span className="text-white/20">
                      •
                    </span>

                    <span className="flex items-center gap-1">
                      <Star size={13} />
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
                  className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-black transition hover:scale-[1.02] hover:bg-white/90"
                >
                  <Play
                    size={17}
                    fill="currentColor"
                  />
                  Play Now
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
                  className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15"
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

                <button
                  type="button"
                  onClick={() =>
                    openMovie(
                      featuredMovie,
                    )
                  }
                  className="rounded-xl border border-white/10 bg-black/35 px-5 py-3 text-sm font-bold text-white/65 backdrop-blur transition hover:bg-white/10 hover:text-white"
                >
                  More Info
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  const renderHome = () => (
    <>
      {renderHero()}

      {renderFilterBar()}

      {continueWatchingMovies.length > 0 && (
        <MovieRow
          title="Continue Watching"
          movies={continueWatchingMovies}
          onSelect={openMovie}
        />
      )}

      {trendingMovies.length > 0 && (
        <MovieRow
          title="Trending Now"
          movies={trendingMovies}
          onSelect={openMovie}
        />
      )}

      {newReleaseMovies.length > 0 && (
        <MovieRow
          title="New Releases"
          movies={newReleaseMovies}
          onSelect={openMovie}
        />
      )}

      {popularMovies.length > 0 && (
        <MovieRow
          title="Popular on PMF"
          movies={popularMovies}
          onSelect={openMovie}
        />
      )}

      {pmfOriginalMovies.length > 0 && (
        <MovieRow
          title="PMF Originals"
          movies={pmfOriginalMovies}
          onSelect={openMovie}
        />
      )}

      {featuredMovies.length > 1 && (
        <MovieRow
          title="Featured"
          movies={featuredMovies}
          onSelect={openMovie}
        />
      )}

      {movieOnlyMovies.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center">
          <Film
            size={42}
            className="mx-auto text-white/15"
          />

          <h2 className="mt-4 text-lg font-bold text-white">
            Your PMF catalog is ready
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/35">
            Add licensed movie and TV content through the PMF catalog to begin building the full streaming library.
          </p>
        </div>
      )}
    </>
  )

  const renderMoviesSection = () => (
    <>
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/30">
          PMF Library
        </p>

        <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
          Movies
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/35">
          Explore the movie catalog using professional global metadata and discovery filters.
        </p>
      </div>

      {renderFilterBar()}

      {renderMovieGrid(
        movieOnlyMovies,
        'No movies match your current filters.',
      )}
    </>
  )

  const renderTVSection = () => (
    <>
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/30">
          PMF Library
        </p>

        <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
          TV Series
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/35">
          TV shows, seasons, and episodes are part of the PMF universal content foundation.
        </p>
      </div>

      {renderFilterBar()}

      {renderMovieGrid(
        tvMovies,
        'No TV series are available yet.',
      )}
    </>
  )

  const renderMyListSection = () => (
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


      const renderMovieDetails = () => {
    if (!selectedMovie) {
      return null
    }

    const canonical = movies.find(
      (movie) =>
        String(movie.id) ===
        String(selectedMovie.id),
    )

    const isInList = myListIds.includes(
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
      <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-md">
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

          <div className="relative -mt-20 px-5 pb-7 sm:px-8 lg:px-10">
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

              <div className="mt-6 flex flex-wrap gap-2">
                {genreNames
                  .filter(
                    (name) =>
                      name &&
                      name !==
                        canonical?.genres[0],
                  )
                  .slice(0, 8)
                  .map((name) => (
                    <span
                      key={name}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/55"
                    >
                      {name}
                    </span>
                  ))}
              </div>

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

              {(countryNames.length > 0 ||
                languageNames.length > 0) && (
                <div className="mt-8 grid gap-4 border-t border-white/5 pt-6 sm:grid-cols-2">
                  {countryNames.length > 0 && (
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

                  {languageNames.length > 0 && (
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

  const renderWatching = () => {
    if (!watchingMovie) {
      return null
    }

    const videoUrl =
      getMovieVideoUrl(watchingMovie)

    const playableUrl =
      videoUrl.includes('youtube.com') ||
      videoUrl.includes('youtu.be')
        ? getYouTubeEmbedUrl(videoUrl)
        : videoUrl

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
              videoUrl.includes(
                'youtube.com',
              ) ||
              videoUrl.includes('youtu.be') ? (
                <iframe
                  src={playableUrl}
                  title={watchingMovie.title}
                  allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                  allowFullScreen
                  className="aspect-video w-full"
                />
              ) : (
                <video
                  src={playableUrl}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[calc(100vh-110px)] w-full object-contain"
                  onEnded={() =>
                    removeContinueWatching(
                      Number(
                        watchingMovie.id,
                      ),
                    )
                  }
                />
              )
            ) : (
              <div className="px-6 py-20 text-center">
                <Film
                  size={46}
                  className="mx-auto text-white/15"
                />

                <h2 className="mt-4 text-lg font-bold text-white">
                  Video unavailable
                </h2>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/35">
                  This title does not have a playable video source yet.
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-white/10 bg-black/95 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {watchingMovie.title}
                </h2>

                <p className="mt-1 text-xs text-white/35">
                  {watchingMovie.description}
                </p>
              </div>

              {watchingMovie.downloadable && (
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/65 transition hover:bg-white/10 hover:text-white"
                >
                  <Download size={14} />
                  Download
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderHeader = () => (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#050505]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() =>
            setSection('home')
          }
          className="shrink-0 text-left"
        >
          <div className="text-xl font-black tracking-[-0.06em] text-white">
            PMF<span className="text-white/35">-FLIX</span>
          </div>

          <div className="hidden text-[8px] font-bold uppercase tracking-[0.28em] text-white/25 sm:block">
            Your World. Your Stories. Your Flix.
          </div>
        </button>

        <nav className="hidden items-center gap-1 md:flex">
          {mobileNavItems.map((item) => {
            const Icon = item.icon
            const active =
              section === item.id

            return (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  setSection(item.id)
                }
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${
                  active
                    ? 'bg-white text-black'
                    : 'text-white/40 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon size={14} />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden max-w-[180px] truncate text-[11px] text-white/30 lg:block">
            Signed in
          </span>

          <button
            type="button"
            onClick={handleSignOut}
            className="flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-bold text-white/55 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">
              Sign out
            </span>
          </button>
        </div>
      </div>
    </header>
  )

  const renderMobileNavigation = () => (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#050505]/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur-xl md:hidden">
      <div className="grid grid-cols-4 gap-1">
        {mobileNavItems.map((item) => {
          const Icon = item.icon
          const active =
            section === item.id

          return (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                setSection(item.id)
              }
              className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-bold transition ${
                active
                  ? 'bg-white text-black'
                  : 'text-white/35'
              }`}
            >
              <Icon size={16} />
              {item.label}
            </button>
          )
        })}
      </div>
    </nav>
  )

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-white" />

            <p className="mt-4 text-sm text-white/35">
              Loading PMF catalog...
            </p>
          </div>
        </div>
      )
    }

    if (errorMessage) {
      return (
        <div className="rounded-2xl border border-red-400/10 bg-red-400/5 px-6 py-16 text-center">
          <X
            size={40}
            className="mx-auto text-red-300/40"
          />

          <h2 className="mt-4 text-lg font-bold text-white">
            Catalog unavailable
          </h2>

          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/35">
            {errorMessage}
          </p>

          <button
            type="button"
            onClick={() =>
              window.location.reload()
            }
            className="mt-5 rounded-lg bg-white px-4 py-2 text-xs font-black text-black"
          >
            Reload PMF
          </button>
        </div>
      )
    }

    if (section === 'movies') {
      return renderMoviesSection()
    }

    if (section === 'tv') {
      return renderTVSection()
    }

    if (section === 'my-list') {
      return renderMyListSection()
    }

    return renderHome()
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {renderHeader()}

      <main className="mx-auto min-h-screen max-w-[1600px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12">
        {renderContent()}
      </main>

      {renderMobileNavigation()}

      {renderMovieDetails()}

      {renderWatching()}
    </div>
  )
}

function AuthenticatedAppFooter() {
  return (
    <footer className="border-t border-white/5 bg-[#050505] px-4 py-10 text-center">
      <div className="text-lg font-black tracking-[-0.05em] text-white">
        PMF<span className="text-white/30">-FLIX</span>
      </div>

      <p className="mt-2 text-xs text-white/25">
        Your World. Your Stories. Your Flix.
      </p>

      <p className="mt-4 text-[10px] text-white/15">
        © {new Date().getFullYear()} PMF Flix. Licensed and authorized content only.
      </p>
    </footer>
  )
}

export default function App() {
  const [session, setSession] =
    useState<Session | null>(null)

  const [checkingSession, setCheckingSession] =
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
        setCheckingSession(false)
      })

    const {
      data: {
        subscription,
      },
    } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession)
        setCheckingSession(false)
      },
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505]">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-white" />

          <p className="mt-4 text-xs font-semibold text-white/30">
            Preparing PMF Flix...
          </p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <AuthScreen />
  }

  return (
    <>
      <AuthenticatedApp />
      <AuthenticatedAppFooter />
    </>
  )
}
    
