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
  Film,
  Bookmark,
  Star,
  Sparkles,
  Globe2,
  Layers3,
  Clock3,
  Heart,
  Menu,
  Home,
  Tv,
  Info,
  ArrowRight,
  RotateCcw,
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
  canonicalMovies: CanonicalMovie[],
): DisplayMovie[] {
  return [...values].sort((a, b) => {
    const canonicalA =
      canonicalMovies.find(
        (movie) =>
          String(movie.id) === String(a.id),
      )

    const canonicalB =
      canonicalMovies.find(
        (movie) =>
          String(movie.id) === String(b.id),
      )

    if (mode === 'title') {
      return a.title.localeCompare(b.title)
    }

    if (mode === 'newest') {
      return safeNumber(b.year) -
        safeNumber(a.year)
    }

    if (mode === 'rating') {
      return (
        safeNumber(canonicalB?.rating) -
        safeNumber(canonicalA?.rating)
      )
    }

    /*
     * Popularity uses the canonical viewCount.
     * If older records do not have a populated
     * view count, rating and release year become
     * sensible fallback signals.
     */
    const popularityA =
      safeNumber(canonicalA?.viewCount) * 10 +
      safeNumber(canonicalA?.rating) * 100 +
      safeNumber(a.year) / 100

    const popularityB =
      safeNumber(canonicalB?.viewCount) * 10 +
      safeNumber(canonicalB?.rating) * 100 +
      safeNumber(b.year) / 100

    return popularityB - popularityA
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

    /*
     * Backwards compatibility with the older
     * PMF format that stored only movie IDs.
     */
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
        typeof (value as ContinueWatchingEntry)
          .id === 'number' &&
        typeof (value as ContinueWatchingEntry)
          .position === 'number' &&
        typeof (value as ContinueWatchingEntry)
          .duration === 'number' &&
        typeof (value as ContinueWatchingEntry)
          .updatedAt === 'number',
    )
  } catch {
    return []
  }
}

function getContinueWatchingIds(): number[] {
  return getContinueWatchingEntries()
    .sort(
      (a, b) =>
        b.updatedAt - a.updatedAt,
    )
    .map((entry) => entry.id)
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
      (value): value is number =>
        typeof value === 'number' &&
        Number.isFinite(value),
    )
  } catch {
    return []
  }
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

function formatRuntime(
  movie: CanonicalMovie | undefined,
): string {
  if (!movie) {
    return ''
  }

  if (movie.runtimeMinutes) {
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

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false)

  const [searchFocused, setSearchFocused] =
    useState(false)

  /*
   * Load the PMF catalog from Supabase.
   *
   * The realtime subscription means the interface
   * can react when the movie catalog changes.
   */
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
      void supabase.removeChannel(
        channel,
      )
    }
  }, [])

  /*
   * Convert canonical PMF records into the
   * display format currently used by the UI.
   */
  const displayMovies = useMemo(
    () =>
      movies.map(
        mapCanonicalMovieToLegacy,
      ),
    [movies],
  )

  /*
   * Apply the universal PMF discovery filters.
   */
  const filteredCanonicalMovies =
    useMemo(() => {
      return filterMovies(movies, {
        title: filters.title,
        actor: filters.actor,
        director: filters.director,
        genreIds: filters.genreIds,
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
        tags: filters.tags,
        year: filters.year
          ? Number(filters.year)
          : undefined,
        minRating: filters.minRating
          ? Number(filters.minRating)
          : undefined,
        contentType:
          filters.contentType ||
          undefined,
        quality:
          filters.quality ||
          undefined,
      })
    }, [movies, filters])

  const filteredMovies =
    useMemo(() => {
      const canonicalIds =
        new Set(
          filteredCanonicalMovies.map(
            (movie) =>
              String(movie.id),
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

  /*
   * Cinematic home rails.
   */
  const trendingMovies = useMemo(
    () =>
      sortDisplayMovies(
        movieOnlyMovies,
        'popular',
        movies,
      ).slice(0, 12),
    [movieOnlyMovies, movies],
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
        movies,
      ).slice(0, 12),
    [movieOnlyMovies, movies],
  )

  const popularMovies = useMemo(
    () =>
      sortDisplayMovies(
        movieOnlyMovies,
        'popular',
        movies,
      ).slice(0, 12),
    [movieOnlyMovies, movies],
  )

  const topRatedMovies = useMemo(
    () =>
      sortDisplayMovies(
        movieOnlyMovies,
        'rating',
        movies,
      ).slice(0, 12),
    [movieOnlyMovies, movies],
  )

  const pmfOriginalMovies = useMemo(
    () =>
      movieOnlyMovies.filter(
        (movie) => {
          const canonical =
            movies.find(
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
        },
      ),
    [
      movieOnlyMovies,
      movies,
      metadataCatalog,
    ],
  )

  const continueWatchingMovies =
    useMemo(() => {
      const ids =
        new Set(
          continueWatchingIds,
        )

      return movieOnlyMovies.filter(
        (movie) =>
          ids.has(
            Number(movie.id),
          ),
      )
    }, [
      movieOnlyMovies,
      continueWatchingIds,
    ])

  const myListMovies = useMemo(
    () =>
      displayMovies.filter(
        (movie) =>
          myListIds.includes(
            Number(movie.id),
          ),
      ),
    [displayMovies, myListIds],
  )

  /*
   * The hero always has a safe fallback.
   * This prevents the previous null-state
   * crash from affecting the entire page.
   */
  const featuredMovie =
    featuredMovies[0] ??
    trendingMovies[0] ??
    movieOnlyMovies[0] ??
    null

    featuredMovie
      ? movies.find(
          (movie) =>
            String(movie.id) ===
            String(featuredMovie.id),
        )
      : undefined

  /*
   * Discovery collections.
   */
  const discoveryCollections =
    useMemo(() => {
      if (!metadataCatalog) {
        return []
      }

      const getIds = (
        items: {
          id: string
          name: string
        }[],
        terms: string[],
      ): string[] => {
        const normalizedTerms =
          terms.map(normalizeText)

        return items
          .filter((item) => {
            const name =
              normalizeText(item.name)

            const id =
              normalizeText(item.id)

            return normalizedTerms.some(
              (term) =>
                name === term ||
                id === term ||
                name.includes(term),
            )
          })
          .map(
            (item) => item.id,
          )
      }

      const collections: {
        title: string
        icon: ReactNode
        movies: DisplayMovie[]
      }[] = []

      const africanCountryIds =
        getIds(
          metadataCatalog.countries,
          [
            'Nigeria',
            'Ghana',
            'South Africa',
            'Kenya',
            'Egypt',
          ],
        )

      const africanRegionIds =
        getIds(
          metadataCatalog.regions,
          ['Africa'],
        )

      const nollywoodIndustryIds =
        getIds(
          metadataCatalog.industries,
          [
            'Nollywood',
          ],
        )

      const hollywoodIndustryIds =
        getIds(
          metadataCatalog.industries,
          [
            'Hollywood',
          ],
        )

      const africanMovies =
        movieOnlyMovies.filter(
          (movie) => {
            const canonical =
              movies.find(
                (value) =>
                  String(value.id) ===
                  String(movie.id),
              )

            if (!canonical) {
              return false
            }

            return (
              canonical.regionIds.some(
                (id) =>
                  africanRegionIds.includes(
                    id,
                  ),
              ) ||
              canonical.countryIds.some(
                (id) =>
                  africanCountryIds.includes(
                    id,
                  ),
              )
            )
          },
        )

      const nollywoodMovies =
        movieOnlyMovies.filter(
          (movie) => {
            const canonical =
              movies.find(
                (value) =>
                  String(value.id) ===
                  String(movie.id),
              )

            return Boolean(
              canonical?.industryIds.some(
                (id) =>
                  nollywoodIndustryIds.includes(
                    id,
                  ),
              ),
            )
          },
        )

      const hollywoodMovies =
        movieOnlyMovies.filter(
          (movie) => {
            const canonical =
              movies.find(
                (value) =>
                  String(value.id) ===
                  String(movie.id),
              )

            return Boolean(
              canonical?.industryIds.some(
                (id) =>
                  hollywoodIndustryIds.includes(
                    id,
                  ),
              ),
            )
          },
        )

      if (africanMovies.length > 0) {
        collections.push({
          title: 'African Cinema',
          icon: <Globe2 size={17} />,
          movies:
            africanMovies.slice(0, 12),
        })
      }

      if (nollywoodMovies.length > 0) {
        collections.push({
          title: 'Nollywood',
          icon: <Film size={17} />,
          movies:
            nollywoodMovies.slice(0, 12),
        })
      }

      if (hollywoodMovies.length > 0) {
        collections.push({
          title: 'Hollywood',
          icon: <Sparkles size={17} />,
          movies:
            hollywoodMovies.slice(0, 12),
        })
      }

      if (collections.length === 0) {
        const fallback =
          movieOnlyMovies.slice(0, 12)

        if (fallback.length > 0) {
          collections.push({
            title: 'Discover PMF',
            icon: <Layers3 size={17} />,
            movies: fallback,
          })
        }
      }

      return collections
    }, [
      metadataCatalog,
      movieOnlyMovies,
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

  function openMovie(
    movie: DisplayMovie,
  ): void {
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

    const numericId =
      Number(movie.id)

    if (
      Number.isFinite(numericId)
    ) {
      const existing =
        getContinueWatchingEntry(
          numericId,
        )

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
    if (!Number.isFinite(movieId)) {
      return
    }

    setMyListIds((current) => {
      const next = current.includes(
        movieId,
      )
        ? current.filter(
            (id) => id !== movieId,
          )
        : [
            ...current,
            movieId,
          ]

      try {
        localStorage.setItem(
          MY_LIST_STORAGE_KEY,
          JSON.stringify(next),
        )
      } catch {
        // Ignore localStorage failures.
      }

      return next
    })
  }

  function handleNavigation(
    nextSection: Section,
  ): void {
    setSection(nextSection)
    setMobileMenuOpen(false)

    if (
      nextSection === 'movies' ||
      nextSection === 'tv'
    ) {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      })
    }
  }

  function handleSearchChange(
    value: string,
  ): void {
    updateFilter(
      'title',
      value,
    )

    if (
      value.trim() &&
      section === 'home'
    ) {
      setSection('movies')
    }
  }

  function clearSearch(): void {
    updateFilter(
      'title',
      '',
    )
   } 

function MovieCard({
  movie,
  compact = false,
}: {
  movie: DisplayMovie
  compact?: boolean
}) {
  const numericId = Number(movie.id)

  const isInList =
    myListIds.includes(numericId)

  const continueEntry =
    getContinueWatchingEntry(
      numericId,
    )

  const progress =
    getProgressPercent(
      continueEntry,
    )

  const canonical =
    movies.find(
      (value) =>
        String(value.id) ===
        String(movie.id),
    )

  const rating =
    safeNumber(canonical?.rating)

  const isOriginal =
    canonical?.isPmfOriginal === true

  return (
    <article
      className={`group relative min-w-0 ${
        compact
          ? 'w-[148px] shrink-0 sm:w-[175px] lg:w-[190px]'
          : ''
      }`}
    >
      <div
        className="relative aspect-[2/3] cursor-pointer overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035] shadow-2xl shadow-black/30 transition duration-500 ease-out group-hover:-translate-y-1 group-hover:border-white/20 group-hover:shadow-black/60"
        onClick={() =>
          openMovie(movie)
        }
      >
        {movie.poster ? (
          <img
            src={movie.poster}
            alt={movie.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/[0.08] to-black">
            <Film
              size={38}
              className="text-white/15"
            />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/5 to-transparent opacity-90" />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <div className="flex flex-col gap-1">
            {isOriginal && (
              <span className="w-fit rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-white backdrop-blur-xl">
                PMF Original
              </span>
            )}

            {movie.type === 'Series' && (
              <span className="w-fit rounded-full border border-white/10 bg-black/50 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.14em] text-white/70 backdrop-blur-xl">
                Series
              </span>
            )}
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

              toggleMyList(
                numericId,
              )
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/55 text-white backdrop-blur-xl transition hover:scale-110 hover:bg-white hover:text-black"
          >
            {isInList ? (
              <Check size={15} />
            ) : (
              <Plus size={15} />
            )}
          </button>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-3">
          <div className="mb-2 flex items-center gap-2 text-[10px] text-white/60">
            {movie.year > 0 && (
              <span>
                {movie.year}
              </span>
            )}

            {rating > 0 && (
              <>
                <span className="text-white/20">
                  •
                </span>

                <span className="flex items-center gap-1">
                  <Star
                    size={10}
                    fill="currentColor"
                  />
                  {rating.toFixed(1)}
                </span>
              </>
            )}
          </div>

          <h3 className="truncate text-sm font-bold tracking-tight text-white sm:text-[15px]">
            {movie.title}
          </h3>

          <p className="mt-1 truncate text-[10px] uppercase tracking-[0.12em] text-white/40">
            {movie.category ||
              'Featured'}
          </p>
        </div>

        {progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/10">
            <div
              className="h-full bg-white transition-all"
              style={{
                width: `${progress}%`,
              }}
            />
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition duration-300 group-hover:opacity-100">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white text-black shadow-2xl transition group-hover:scale-100 scale-75">
            <Play
              size={17}
              fill="currentColor"
              className="ml-0.5"
            />
          </div>
        </div>
      </div>
    </article>
  )
}

function SectionHeading({
  eyebrow,
  title,
  icon,
  action,
}: {
  eyebrow?: string
  title: string
  icon?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <div className="mb-1 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.25em] text-white/35">
            {icon}
            {eyebrow}
          </div>
        )}

        <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">
          {title}
        </h2>
      </div>

      {action}
    </div>
  )
}

function MovieRail({
  title,
  eyebrow,
  icon,
  movies: railMovies,
  compact = true,
  action,
}: {
  title: string
  eyebrow?: string
  icon?: ReactNode
  movies: DisplayMovie[]
  compact?: boolean
  action?: ReactNode
}) {
  if (railMovies.length === 0) {
    return null
  }

  return (
    <section className="relative">
      <SectionHeading
        eyebrow={eyebrow}
        title={title}
        icon={icon}
        action={action}
      />

      <div className="-mx-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="flex gap-3 sm:gap-4 lg:gap-5">
          {railMovies.map(
            (movie) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                compact={compact}
              />
            ),
          )}
        </div>
      </div>
    </section>
  )
}

function HeroSection({
  movie,
}: {
  movie: DisplayMovie | null
}) {
  const canonical =
    movie
      ? movies.find(
          (value) =>
            String(value.id) ===
            String(movie.id),
        )
      : undefined

  if (!movie) {
    return (
      <section className="relative flex min-h-[520px] items-center overflow-hidden rounded-[2rem] border border-white/[0.06] bg-white/[0.025]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.09),transparent_45%)]" />

        <div className="relative z-10 max-w-xl p-8 sm:p-12">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-white/60">
            <Sparkles size={12} />
            PMF Streaming
          </div>

          <h1 className="text-4xl font-black tracking-[-0.04em] text-white sm:text-6xl">
            Your World.
            <br />
            Your Stories.
            <br />
            Your Flix.
          </h1>

          <p className="mt-5 max-w-md text-sm leading-7 text-white/50">
            Discover a growing world of
            cinema, original stories and
            unforgettable entertainment.
          </p>
        </div>
      </section>
    )
  }

  const backdrop =
    canonical?.backdropUrl || movie.poster || heroImage

  const rating =
    safeNumber(canonical?.rating)

  const runtime =
    formatRuntime(canonical)

  const isOriginal =
    canonical?.isPmfOriginal === true

  return (
    <section className="group relative min-h-[560px] overflow-hidden rounded-[2rem] border border-white/[0.08] bg-black shadow-2xl shadow-black/50 sm:min-h-[620px] lg:min-h-[680px]">
      <img
        src={backdrop}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-center opacity-75 transition duration-[1600ms] group-hover:scale-[1.015]"
      />

      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/50" />

      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/60 to-transparent" />

      <div className="relative z-10 flex min-h-[560px] items-end sm:min-h-[620px] lg:min-h-[680px]">
        <div className="max-w-2xl p-6 pb-12 sm:p-10 sm:pb-14 lg:p-14 lg:pb-20">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-white/80 backdrop-blur-xl">
              <Sparkles size={11} />
              Featured Film
            </span>

            {isOriginal && (
              <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-white/70 backdrop-blur-xl">
                PMF Original
              </span>
            )}
          </div>

          <h1 className="max-w-2xl text-4xl font-black leading-[0.95] tracking-[-0.05em] text-white sm:text-6xl lg:text-7xl">
            {movie.title}
          </h1>

          {canonical?.tagline && (
            <p className="mt-4 text-sm font-medium italic text-white/65 sm:text-base">
              {canonical.tagline}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/60">
            {movie.year > 0 && (
              <span>
                {movie.year}
              </span>
            )}

            {runtime && (
              <span>
                {runtime}
              </span>
            )}

            {rating > 0 && (
              <span className="flex items-center gap-1.5">
                <Star
                  size={12}
                  fill="currentColor"
                />
                {rating.toFixed(1)}
              </span>
            )}

            <span className="rounded border border-white/20 px-2 py-0.5 text-[9px] uppercase tracking-wider text-white/65">
              {movie.type}
            </span>
          </div>

          <p className="mt-5 max-w-xl line-clamp-3 text-sm leading-7 text-white/55 sm:text-[15px]">
            {movie.description}
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                startWatching(movie)
              }
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-black text-black transition hover:scale-[1.02] hover:bg-white/90"
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
                openMovie(movie)
              }
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.08] px-6 text-sm font-bold text-white backdrop-blur-xl transition hover:bg-white/[0.14]"
            >
              <Info size={17} />
              More Info
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10">
        <div className="h-14 animate-pulse rounded-2xl bg-white/[0.04]" />

        <div className="mt-6 min-h-[560px] animate-pulse rounded-[2rem] bg-white/[0.04]" />

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({
            length: 6,
          }).map((_, index) => (
            <div
              key={index}
              className="aspect-[2/3] animate-pulse rounded-2xl bg-white/[0.04]"
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="max-w-lg rounded-3xl border border-white/10 bg-white/[0.035] p-8 text-center shadow-2xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.06]">
          <RotateCcw
            size={22}
            className="text-white/60"
          />
        </div>

        <h2 className="mt-5 text-xl font-black">
          PMF couldn't load the catalog
        </h2>

        <p className="mt-3 text-sm leading-6 text-white/45">
          {message}
        </p>

        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-black transition hover:bg-white/90"
        >
          <RotateCcw size={15} />
          Try Again
        </button>
      </div>
    </div>
  )
}

function EmptyState({
  title,
  description,
  icon,
}: {
  title: string
  description: string
  icon?: ReactNode
}) {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.05] text-white/40">
        {icon ?? (
          <Bookmark size={22} />
        )}
      </div>

      <h3 className="mt-5 text-lg font-black text-white">
        {title}
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/40">
        {description}
      </p>
    </div>
  )
}

function SearchBar({
  value,
  onChange,
  focused,
  onFocus,
  onBlur,
}: {
  value: string
  onChange: (value: string) => void
  focused: boolean
  onFocus: () => void
  onBlur: () => void
}) {
  return (
    <div
      className={`relative flex h-10 w-full max-w-[320px] items-center rounded-full border transition sm:h-11 ${
        focused
          ? 'border-white/20 bg-white/[0.08]'
          : 'border-white/[0.08] bg-white/[0.04]'
      }`}
    >
      <Search
        size={16}
        className="ml-3 shrink-0 text-white/40"
      />

      <input
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder="Search movies, shows, people..."
        className="min-w-0 flex-1 bg-transparent px-3 text-xs text-white outline-none placeholder:text-white/30 sm:text-sm"
        aria-label="Search PMF"
      />

      {value && (
        <button
          type="button"
          onClick={() =>
            onChange('')
          }
          className="mr-2 flex h-7 w-7 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white"
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
 }

function Navigation({
  section,
  onNavigate,
  onSignOut,
}: {
  section: Section
  onNavigate: (section: Section) => void
  onSignOut: () => void
}) {
  const links: {
    id: Section
    label: string
    icon: ReactNode
  }[] = [
    {
      id: 'home',
      label: 'Home',
      icon: <Home size={16} />,
    },
    {
      id: 'movies',
      label: 'Movies',
      icon: <Film size={16} />,
    },
    {
      id: 'tv',
      label: 'TV Series',
      icon: <Tv size={16} />,
    },
    {
      id: 'my-list',
      label: 'My List',
      icon: <Bookmark size={16} />,
    },
  ]

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-black/70 backdrop-blur-2xl">
        <div className="mx-auto flex h-[68px] max-w-[1600px] items-center gap-4 px-4 sm:px-6 lg:px-10">
          <button
            type="button"
            onClick={() =>
              onNavigate('home')
            }
            className="group flex shrink-0 items-center gap-2"
            aria-label="PMF Home"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white text-black shadow-lg transition group-hover:scale-105">
              <span className="text-xs font-black tracking-[-0.08em]">
                PMF
              </span>
            </div>

            <div className="hidden sm:block">
              <div className="text-sm font-black tracking-[-0.03em] text-white">
                PRINCE MUFASA
              </div>
              <div className="text-[8px] font-bold uppercase tracking-[0.35em] text-white/35">
                Flix
              </div>
            </div>
          </button>

          <nav className="hidden items-center gap-1 md:flex">
            {links.map(
              (link) => {
                const active =
                  section ===
                  link.id

                return (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() =>
                      onNavigate(
                        link.id,
                      )
                    }
                    className={`relative flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold transition ${
                      active
                        ? 'bg-white/[0.09] text-white'
                        : 'text-white/45 hover:bg-white/[0.05] hover:text-white'
                    }`}
                  >
                    {link.icon}
                    {link.label}

                    {active && (
                      <span className="absolute bottom-0 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-white" />
                    )}
                  </button>
                )
              },
            )}
          </nav>

          <div className="ml-auto flex min-w-0 items-center gap-2">
            <div className="hidden sm:block">
              <SearchBar
                value={filters.title}
                onChange={
                  handleSearchChange
                }
                focused={
                  searchFocused
                }
                onFocus={() =>
                  setSearchFocused(
                    true,
                  )
                }
                onBlur={() =>
                  setSearchFocused(
                    false,
                  )
                }
              />
            </div>

            <button
              type="button"
              onClick={() =>
                onNavigate(
                  'my-list',
                )
              }
              className="hidden h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/60 transition hover:bg-white/[0.08] hover:text-white sm:flex"
              aria-label="My List"
            >
              <Bookmark size={16} />
            </button>

            <button
              type="button"
              onClick={() =>
                void onSignOut()
              }
              className="hidden h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/50 transition hover:bg-white/[0.08] hover:text-white sm:flex"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>

            <button
              type="button"
              onClick={() =>
                setMobileMenuOpen(
                  (value) => !value,
                )
              }
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/60 md:hidden"
              aria-label="Open menu"
            >
              {mobileMenuOpen ? (
                <X size={18} />
              ) : (
                <Menu size={18} />
              )}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-white/[0.06] bg-black/95 px-4 py-4 backdrop-blur-2xl md:hidden">
            <div className="mb-4">
              <SearchBar
                value={filters.title}
                onChange={
                  handleSearchChange
                }
                focused={true}
                onFocus={() => undefined}
                onBlur={() => undefined}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {links.map(
                (link) => (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() =>
                      onNavigate(
                        link.id,
                      )
                    }
                    className={`flex h-11 items-center gap-2 rounded-xl px-4 text-xs font-bold ${
                      section ===
                      link.id
                        ? 'bg-white text-black'
                        : 'bg-white/[0.05] text-white/65'
                    }`}
                  >
                    {link.icon}
                    {link.label}
                  </button>
                ),
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                void onSignOut()
              }
              className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white/[0.04] text-xs font-bold text-white/50"
            >
              <LogOut size={15} />
              Sign Out
            </button>
          </div>
        )}
      </header>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.07] bg-black/85 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-2xl md:hidden">
        <nav className="mx-auto flex max-w-md items-center justify-around">
          {links.map(
            (link) => {
              const active =
                section ===
                link.id

              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() =>
                    onNavigate(
                      link.id,
                    )
                  }
                  className={`flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-[9px] font-bold transition ${
                    active
                      ? 'bg-white/[0.08] text-white'
                      : 'text-white/35'
                  }`}
                >
                  {link.icon}
                  {link.label}
                </button>
              )
            },
          )}
        </nav>
      </div>
    </>
  )
}

function FilterBar() {
  const activeFilterCount =
    [
      filters.title,
      filters.actor,
      filters.director,
      filters.year,
      filters.minRating,
      filters.contentType,
      filters.quality,
    ].filter(Boolean).length +
    filters.genreIds.length +
    filters.subgenreIds.length +
    filters.countryIds.length +
    filters.regionIds.length +
    filters.industryIds.length +
    filters.languageIds.length +
    filters.collectionIds.length +
    filters.tags.length

  return (
    <section className="mb-8 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Search
            size={17}
            className="shrink-0 text-white/30"
          />

          <input
            value={filters.title}
            onChange={(event) =>
              updateFilter(
                'title',
                event.target.value,
              )
            }
            placeholder="Search titles, descriptions, years..."
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/25"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={sortMode}
            onChange={(event) =>
              setSortMode(
                event.target
                  .value as SortMode,
              )
            }
            className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-xs font-bold text-white/70 outline-none"
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
                (value) =>
                  !value,
              )
            }
            className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-bold transition ${
              showFilters ||
              activeFilterCount > 0
                ? 'border-white/20 bg-white text-black'
                : 'border-white/[0.08] bg-white/[0.04] text-white/65'
            }`}
          >
            <SlidersHorizontal
              size={15}
            />
            Filters

            {activeFilterCount >
              0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-black px-1.5 text-[9px] text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          {activeFilterCount >
            0 && (
            <button
              type="button"
              onClick={
                clearFilters
              }
              className="h-10 rounded-xl px-3 text-xs font-bold text-white/40 transition hover:bg-white/[0.05] hover:text-white"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="mt-4 border-t border-white/[0.06] pt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input
              value={filters.actor}
              onChange={(event) =>
                updateFilter(
                  'actor',
                  event.target.value,
                )
              }
              placeholder="Actor"
              className="h-10 rounded-xl border border-white/[0.08] bg-black/30 px-3 text-xs text-white outline-none placeholder:text-white/25"
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
              className="h-10 rounded-xl border border-white/[0.08] bg-black/30 px-3 text-xs text-white outline-none placeholder:text-white/25"
            />

            <input
              value={filters.year}
              onChange={(event) =>
                updateFilter(
                  'year',
                  event.target.value.replace(
                    /\D/g,
                    '',
                  ),
                )
              }
              placeholder="Release year"
              inputMode="numeric"
              className="h-10 rounded-xl border border-white/[0.08] bg-black/30 px-3 text-xs text-white outline-none placeholder:text-white/25"
            />

            <select
              value={
                filters.minRating
              }
              onChange={(event) =>
                updateFilter(
                  'minRating',
                  event.target.value,
                )
              }
              className="h-10 rounded-xl border border-white/[0.08] bg-black/30 px-3 text-xs text-white/65 outline-none"
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

            <select
              value={
                filters.contentType
              }
              onChange={(event) =>
                updateFilter(
                  'contentType',
                  event.target
                    .value as DiscoveryFilters['contentType'],
                )
              }
              className="h-10 rounded-xl border border-white/[0.08] bg-black/30 px-3 text-xs text-white/65 outline-none"
            >
              <option value="">
                All content
              </option>
              <option value="movie">
                Movies
              </option>
              <option value="tv_show">
                TV Shows
              </option>
              <option value="episode">
                Episodes
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

            <select
              value={
                filters.quality
              }
              onChange={(event) =>
                updateFilter(
                  'quality',
                  event.target
                    .value as DiscoveryFilters['quality'],
                )
              }
              className="h-10 rounded-xl border border-white/[0.08] bg-black/30 px-3 text-xs text-white/65 outline-none"
            >
              <option value="">
                Any quality
              </option>
              <option value="480p">
                480p
              </option>
              <option value="720p">
                720p HD
              </option>
              <option value="1080p">
                1080p Full HD
              </option>
              <option value="1440p">
                1440p
              </option>
              <option value="4k">
                4K Ultra HD
              </option>
            </select>
          </div>

          {metadataCatalog && (
            <div className="mt-4 space-y-3">
              <MetadataFilterGroup
                label="Genres"
                items={
                  metadataCatalog.genres
                }
                selected={
                  filters.genreIds
                }
                onToggle={(id) =>
                  toggleMetadataFilter(
                    'genreIds',
                    id,
                  )
                }
              />

              <MetadataFilterGroup
                label="Languages"
                items={
                  metadataCatalog.languages
                }
                selected={
                  filters.languageIds
                }
                onToggle={(id) =>
                  toggleMetadataFilter(
                    'languageIds',
                    id,
                  )
                }
              />

              <MetadataFilterGroup
                label="Countries"
                items={
                  metadataCatalog.countries
                }
                selected={
                  filters.countryIds
                }
                onToggle={(id) =>
                  toggleMetadataFilter(
                    'countryIds',
                    id,
                  )
                }
              />

              <MetadataFilterGroup
                label="Collections"
                items={
                  metadataCatalog.collections
                }
                selected={
                  filters.collectionIds
                }
                onToggle={(id) =>
                  toggleMetadataFilter(
                    'collectionIds',
                    id,
                  )
                }
              />
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function MetadataFilterGroup({
  label,
  items,
  selected,
  onToggle,
}: {
  label: string
  items: {
    id: string
    name: string
  }[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  if (items.length === 0) {
    return null
  }

  return (
    <div>
      <div className="mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-white/30">
        {label}
      </div>

      <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto">
        {items
          .slice(0, 24)
          .map((item) => {
            const active =
              selected.includes(
                item.id,
              )

            return (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  onToggle(
                    item.id,
                  )
                }
                className={`rounded-full border px-3 py-1.5 text-[10px] font-bold transition ${
                  active
                    ? 'border-white bg-white text-black'
                    : 'border-white/[0.08] bg-white/[0.025] text-white/45 hover:border-white/20 hover:text-white'
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
    const values =
      current[key]

    return {
      ...current,
      [key]: values.includes(
        id,
      )
        ? values.filter(
            (value) =>
              value !== id,
          )
        : [
            ...values,
            id,
          ],
    }
  })
 }

  /*
   * ─────────────────────────────────────────────
   * HOME EXPERIENCE
   * ─────────────────────────────────────────────
   */

  function HomePage() {
    return (
      <div className="space-y-14 pb-24 sm:space-y-16 lg:space-y-20">
        <HeroSection
          movie={featuredMovie}
        />

        {continueWatchingMovies.length >
          0 && (
          <MovieRail
            eyebrow="Pick up where you left off"
            title="Continue Watching"
            icon={<Clock3 size={17} />}
            movies={
              continueWatchingMovies
            }
            action={
              <span className="hidden text-[10px] font-bold uppercase tracking-[0.16em] text-white/25 sm:block">
                Keep watching
              </span>
            }
          />
        )}

        {trendingMovies.length >
          0 && (
          <MovieRail
            eyebrow="What's moving now"
            title="Trending Now"
            icon={<Sparkles size={17} />}
            movies={trendingMovies}
          />
        )}

        {newReleaseMovies.length >
          0 && (
          <MovieRail
            eyebrow="Fresh on PMF"
            title="New Releases"
            icon={<ArrowRight size={17} />}
            movies={
              newReleaseMovies
            }
          />
        )}

        {popularMovies.length >
          0 && (
          <MovieRail
            eyebrow="Loved by viewers"
            title="Popular on PMF"
            icon={<Heart size={17} />}
            movies={popularMovies}
          />
        )}

        {pmfOriginalMovies.length >
          0 && (
          <MovieRail
            eyebrow="Made for PMF"
            title="PMF Originals"
            icon={<Sparkles size={17} />}
            movies={
              pmfOriginalMovies
            }
          />
        )}

        {topRatedMovies.length >
          0 && (
          <MovieRail
            eyebrow="Highest rated"
            title="Top Rated"
            icon={
              <Star
                size={17}
                fill="currentColor"
              />
            }
            movies={
              topRatedMovies
            }
          />
        )}

        {featuredMovies.length >
          1 && (
          <MovieRail
            eyebrow="Hand-picked"
            title="Featured"
            icon={<Bookmark size={17} />}
            movies={
              featuredMovies
            }
          />
        )}

        {discoveryCollections.map(
          (collection) => (
            <MovieRail
              key={collection.title}
              eyebrow="Explore the world"
              title={
                collection.title
              }
              icon={
                collection.icon
              }
              movies={
                collection.movies
              }
            />
          ),
        )}

        {movieOnlyMovies.length ===
          0 &&
          !loading && (
            <EmptyState
              title="Your PMF library is waiting"
              description="Movies and entertainment will appear here as your catalog grows."
              icon={
                <Film size={22} />
              }
            />
          )}
      </div>
    )
  }

  /*
   * ─────────────────────────────────────────────
   * MOVIES / TV / MY LIST PAGE
   * ─────────────────────────────────────────────
   */

  function CatalogPage({
    title,
    description,
    catalogMovies,
    emptyTitle,
    emptyDescription,
  }: {
    title: string
    description: string
    catalogMovies: DisplayMovie[]
    emptyTitle: string
    emptyDescription: string
  }) {
    const sortedMovies =
      sortDisplayMovies(
        catalogMovies,
        sortMode,
        movies,
      )

    return (
      <div className="pb-24">
        <div className="mb-8 max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-white/45">
            <Film size={11} />
            PMF Discovery
          </div>

          <h1 className="text-3xl font-black tracking-[-0.04em] text-white sm:text-5xl">
            {title}
          </h1>

          <p className="mt-3 text-sm leading-7 text-white/40">
            {description}
          </p>
        </div>

        <FilterBar />

        {sortedMovies.length >
        0 ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-5 xl:grid-cols-6">
            {sortedMovies.map(
              (movie) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  compact={false}
                />
              ),
            )}
          </div>
        ) : (
          <EmptyState
            title={emptyTitle}
            description={
              emptyDescription
            }
            icon={
              <Search size={22} />
            }
          />
        )}
      </div>
    )
  }

  /*
   * ─────────────────────────────────────────────
   * MOVIE DETAILS MODAL
   * ─────────────────────────────────────────────
   */

  function MovieDetailsModal() {
    if (!selectedMovie) {
      return null
    }

    const canonical =
      movies.find(
        (movie) =>
          String(movie.id) ===
          String(
            selectedMovie.id,
          ),
      )

    const numericId =
      Number(selectedMovie.id)

    const isInList =
      myListIds.includes(
        numericId,
      )

    const rating =
      safeNumber(canonical?.rating)

    const runtime =
      formatRuntime(canonical)

    const videoUrl =
      getMovieVideoUrl(
        selectedMovie,
      )

    const backdrop =
      canonical?.backdropUrl ||
      selectedMovie.poster ||
      heroImage

    const genreNames =
      canonical?.genres.map(
        (id) =>
          metadataName(
            metadataCatalog,
            id,
          ),
      ) ?? []

    const countryNames =
      canonical?.countryIds.map(
        (id) =>
          metadataName(
            metadataCatalog,
            id,
          ),
      ) ?? []

    const languageNames =
      canonical?.languageIds.map(
        (id) =>
          metadataName(
            metadataCatalog,
            id,
          ),
      ) ?? []

    return (
      <div
        className="fixed inset-0 z-[80] overflow-y-auto bg-black/90 backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        aria-label={`${selectedMovie.title} details`}
        onMouseDown={(event) => {
          if (
            event.target ===
            event.currentTarget
          ) {
            closeMovie()
          }
        }}
      >
        <div className="mx-auto min-h-screen w-full max-w-5xl px-3 py-5 sm:px-6 sm:py-10">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#090909] shadow-2xl shadow-black">
            <div className="relative h-[280px] sm:h-[400px]">
              <img
                src={backdrop}
                alt=""
                aria-hidden="true"
                className="h-full w-full object-cover"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-[#090909] via-black/30 to-black/10" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent" />

              <button
                type="button"
                onClick={
                  closeMovie
                }
                className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur-xl transition hover:bg-white hover:text-black"
                aria-label="Close movie details"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative -mt-24 px-5 pb-8 sm:-mt-32 sm:px-9 sm:pb-10">
              <div className="flex flex-col gap-6 sm:flex-row">
                <div className="hidden w-36 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl sm:block">
                  {selectedMovie.poster ? (
                    <img
                      src={
                        selectedMovie.poster
                      }
                      alt={
                        selectedMovie.title
                      }
                      className="aspect-[2/3] h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[2/3] items-center justify-center">
                      <Film
                        size={30}
                        className="text-white/20"
                      />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {canonical?.isPmfOriginal && (
                      <span className="rounded-full bg-white px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-black">
                        PMF Original
                      </span>
                    )}

                    <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-white/60">
                      {
                        selectedMovie.type
                      }
                    </span>
                  </div>

                  <h2 className="text-3xl font-black tracking-[-0.04em] text-white sm:text-5xl">
                    {
                      selectedMovie.title
                    }
                  </h2>

                  {canonical?.originalTitle &&
                    canonical.originalTitle !==
                      selectedMovie.title && (
                      <p className="mt-2 text-xs text-white/30">
                        {
                          canonical.originalTitle
                        }
                      </p>
                    )}

                  {canonical?.tagline && (
                    <p className="mt-3 text-sm italic text-white/55">
                      {
                        canonical.tagline
                      }
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/55">
                    {selectedMovie.year >
                      0 && (
                      <span>
                        {
                          selectedMovie.year
                        }
                      </span>
                    )}

                    {runtime && (
                      <span>
                        {runtime}
                      </span>
                    )}

                    {rating > 0 && (
                      <span className="flex items-center gap-1">
                        <Star
                          size={12}
                          fill="currentColor"
                        />
                        {rating.toFixed(
                          1,
                        )}
                      </span>
                    )}

                    {canonical?.ageRating && (
                      <span className="rounded border border-white/15 px-2 py-0.5 text-[9px] uppercase">
                        {
                          canonical.ageRating
                        }
                      </span>
                    )}
                  </div>

                  <p className="mt-5 max-w-3xl text-sm leading-7 text-white/50">
                    {
                      selectedMovie.description
                    }
                  </p>

                  {genreNames.length >
                    0 && (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {genreNames.map(
                        (name) => (
                          <span
                            key={name}
                            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold text-white/50"
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
                      className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-black transition hover:bg-white/90"
                    >
                      <Play
                        size={16}
                        fill="currentColor"
                      />
                      Play
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        toggleMyList(
                          numericId,
                        )
                      }
                      className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-5 text-sm font-bold text-white transition hover:bg-white/[0.1]"
                    >
                      {isInList ? (
                        <Check
                          size={16}
                        />
                      ) : (
                        <Plus
                          size={16}
                        />
                      )}

                      {isInList
                        ? 'In My List'
                        : 'My List'}
                    </button>
                  </div>
                </div>
              </div>

              {(countryNames.length >
                0 ||
                languageNames.length >
                  0) && (
                <div className="mt-8 grid gap-4 border-t border-white/[0.06] pt-6 sm:grid-cols-2">
                  {countryNames.length >
                    0 && (
                    <div>
                      <div className="mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-white/25">
                        Countries
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs text-white/50">
                        {countryNames.map(
                          (name) => (
                            <span
                              key={name}
                              className="rounded-lg bg-white/[0.04] px-2.5 py-1.5"
                            >
                              {name}
                            </span>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  {languageNames.length >
                    0 && (
                    <div>
                      <div className="mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-white/25">
                        Languages
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs text-white/50">
                        {languageNames.map(
                          (name) => (
                            <span
                              key={name}
                              className="rounded-lg bg-white/[0.04] px-2.5 py-1.5"
                            >
                              {name}
                            </span>
                          ),
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {canonical?.cast &&
                canonical.cast.length >
                  0 && (
                <div className="mt-8 border-t border-white/[0.06] pt-6">
                  <div className="mb-3 text-[9px] font-black uppercase tracking-[0.2em] text-white/25">
                    Cast
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {canonical.cast
                      .slice(0, 12)
                      .map(
                        (member) => (
                          <span
                            key={`${member.personId}-${member.characterName ?? ''}`}
                            className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs text-white/50"
                          >
                            {member.characterName ||
                              member.personId}
                          </span>
                        ),
                      )}
                  </div>
                </div>
              )}

              {!videoUrl && (
                <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 text-xs text-white/35">
                  <Info size={16} />
                  Playback will become available
                  when a licensed video source is
                  connected to this title.
                </div>
              )}

              {canonical?.downloadAvailability
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
                    className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-white/50 transition hover:text-white"
                  >
                    <ArrowRight
                      size={14}
                    />
                    Download where
                    available
                  </a>
                )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  /*
   * ─────────────────────────────────────────────
   * VIDEO / WATCH PLAYER
   * ─────────────────────────────────────────────
   */

  function WatchingModal() {
    if (!watchingMovie) {
      return null
    }

    const canonical =
      movies.find(
        (movie) =>
          String(movie.id) ===
          String(
            watchingMovie.id,
          ),
      )

    const videoUrl =
      getMovieVideoUrl(
        watchingMovie,
      )

    const numericId =
      Number(watchingMovie.id)

    const continueEntry =
      getContinueWatchingEntry(
        numericId,
      )

    const resumeTime =
      continueEntry?.position ?? 0

    const youtube =
      isYouTubeUrl(videoUrl)

    const handleTimeUpdate = (
      currentTime: number,
      duration: number,
    ) => {
      if (
        !Number.isFinite(
          currentTime,
        )
      ) {
        return
      }

      if (
        Number.isFinite(
          duration,
        ) &&
        duration > 0
      ) {
        saveContinueWatching(
          numericId,
          currentTime,
          duration,
        )
      }

      setContinueWatchingIds(
        getContinueWatchingIds(),
      )
    }

    const handleEnded = () => {
      removeContinueWatching(
        numericId,
      )

      setContinueWatchingIds(
        getContinueWatchingIds(),
      )
    }

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-0 sm:p-5">
        <div className="relative flex h-full w-full max-w-7xl flex-col overflow-hidden bg-black sm:h-auto sm:max-h-[94vh] sm:rounded-2xl sm:border sm:border-white/10">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-black/80 px-4">
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-white">
                {
                  watchingMovie.title
                }
              </div>

              {resumeTime >
                0 && (
                <div className="text-[9px] text-white/30">
                  Resuming from{' '}
                  {Math.floor(
                    resumeTime /
                      60,
                  )}
                  :
                  {String(
                    Math.floor(
                      resumeTime %
                        60,
                    ),
                  ).padStart(
                    2,
                    '0',
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={
                closeWatching
              }
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/60 transition hover:bg-white hover:text-black"
              aria-label="Close player"
            >
              <X size={17} />
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
            {videoUrl ? (
              youtube ? (
                <div className="aspect-video w-full">
                  <iframe
                    src={`${getYouTubeEmbedUrl(
                      videoUrl,
                    )}&start=${Math.floor(
                      resumeTime,
                    )}`}
                    title={
                      watchingMovie.title
                    }
                    className="h-full w-full border-0"
                    allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="h-full w-full">
                  <VideoPlayer
                    src={videoUrl}
                    poster={
                      canonical?.posterUrl ||
                      watchingMovie.poster
                    }
                    subtitles={
                      canonical?.subtitles ??
                      []
                    }
                    initialTime={
                      resumeTime
                    }
                    autoPlay
                    onTimeUpdate={
                      handleTimeUpdate
                    }
                    onEnded={
                      handleEnded
                    }
                  />
                </div>
              )
            ) : (
              <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                  <Film
                    size={24}
                    className="text-white/25"
                  />
                </div>

                <h3 className="mt-5 text-lg font-black text-white">
                  Video unavailable
                </h3>

                <p className="mt-2 max-w-md text-sm leading-6 text-white/35">
                  There is currently no licensed
                  playback source connected to this
                  title.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  /*
   * ─────────────────────────────────────────────
   * MAIN CONTENT SWITCHER
   * ─────────────────────────────────────────────
   */

  function renderPage() {
    if (loading) {
      return <LoadingScreen />
    }

    if (errorMessage) {
      return (
        <ErrorState
          message={errorMessage}
          onRetry={() => {
            window.location.reload()
          }}
        />
      )
    }

    if (section === 'movies') {
      return (
        <CatalogPage
          title="Movies"
          description="Explore the PMF movie universe — from original stories to global cinema."
          catalogMovies={
            movieOnlyMovies
          }
          emptyTitle="No movies found"
          emptyDescription="Try changing your search or filters."
        />
      )
    }

    if (section === 'tv') {
      return (
        <CatalogPage
          title="TV Series"
          description="Discover series, episodic stories and long-form entertainment on PMF."
          catalogMovies={tvMovies}
          emptyTitle="No TV series found"
          emptyDescription="Try changing your search or filters."
        />
      )
    }

    if (section === 'my-list') {
      return (
        <div className="pb-24">
          <div className="mb-8 max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-white/45">
              <Bookmark size={11} />
              Your Library
            </div>

            <h1 className="text-3xl font-black tracking-[-0.04em] text-white sm:text-5xl">
              My List
            </h1>

            <p className="mt-3 text-sm leading-7 text-white/40">
              Everything you've saved for
              later, in one place.
            </p>
          </div>

          {myListMovies.length >
          0 ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-5 xl:grid-cols-6">
              {myListMovies.map(
                (movie) => (
                  <MovieCard
                    key={movie.id}
                    movie={movie}
                    compact={false}
                  />
                ),
              )}
            </div>
          ) : (
            <EmptyState
              title="Your list is empty"
              description="Tap the + button on any movie or show you love and it will appear here."
              icon={
                <Bookmark size={22} />
              }
            />
          )}
        </div>
      )
    }

    return <HomePage />
  }

  /*
   * ─────────────────────────────────────────────
   * FINAL PMF APPLICATION SHELL
   * ─────────────────────────────────────────────
   */

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navigation
        section={section}
        onNavigate={
          handleNavigation
        }
        onSignOut={
          handleSignOut
        }
      />

      <main className="mx-auto w-full max-w-[1600px] px-4 pt-5 sm:px-6 sm:pt-7 lg:px-10 lg:pt-8">
        {filters.title &&
          section === 'home' && (
            <div className="mb-5 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/25">
                    Search
                  </div>

                  <div className="mt-1 truncate text-sm font-bold text-white">
                    Results for "
                    {filters.title}"
                  </div>
                </div>

                <button
                  type="button"
                  onClick={
                    clearSearch
                  }
                  className="shrink-0 rounded-lg px-3 py-2 text-xs font-bold text-white/40 hover:bg-white/[0.05] hover:text-white"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

        {renderPage()}
      </main>

      <footer className="border-t border-white/[0.05] px-5 py-12 pb-28 sm:px-8 sm:pb-12 lg:px-10">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[9px] font-black text-black">
                PMF
              </div>

              <span className="text-xs font-black tracking-wide text-white">
                PRINCE MUFASA FLIX
              </span>
            </div>

            <p className="mt-3 max-w-md text-[10px] leading-5 text-white/25">
              Your World. Your Stories. Your
              Flix.
            </p>
          </div>

          <div className="text-[9px] uppercase tracking-[0.2em] text-white/20">
            PMF • Premium Cinematic
            Entertainment
          </div>
        </div>
      </footer>

      <MovieDetailsModal />

      <WatchingModal />
    </div>
  )
}

/*
 * ─────────────────────────────────────────────
 * AUTHENTICATION GATE
 * ─────────────────────────────────────────────
 */

function App() {
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

    async function loadSession() {
      const {
        data,
        error,
      } =
        await supabase.auth.getSession()

      if (!mounted) {
        return
      }

      if (error) {
        console.error(
          'PMF session error:',
          error,
        )
      }

      setSession(
        data.session,
      )

      setCheckingAuth(false)
    }

    void loadSession()

    const {
      data: listener,
    } =
      supabase.auth.onAuthStateChange(
        (
          _event,
          nextSession,
        ) => {
          if (!mounted) {
            return
          }

          setSession(
            nextSession,
          )
          setCheckingAuth(
            false,
          )
        },
      )

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <div className="flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-black shadow-2xl">
            <span className="text-xs font-black tracking-[-0.08em]">
              PMF
            </span>
          </div>

          <div className="mt-5 text-[9px] font-black uppercase tracking-[0.3em] text-white/30">
            Loading your world
          </div>

          <div className="mt-4 h-1 w-28 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-white" />
          </div>
        </div>
      </div>
    )
  }

  if (!session) {
    return <AuthScreen />
  }

  return <AuthenticatedApp />
}

export default App
