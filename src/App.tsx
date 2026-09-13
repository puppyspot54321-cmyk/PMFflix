import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Filter,
  Info,
  LogOut,
  Menu,
  Play,
  Plus,
  Search,
  Sparkles,
  Star,
  X,
} from 'lucide-react'
import type { Session } from '@supabase/supabase-js'

import heroImage from './assets/hero.png'
import type { Movie } from './movieData/movies'
import { getMovies } from './services/movieService'
import { mapCanonicalMovieToLegacy } from './utils/movieMapper'
import { supabase } from './supabase'
import AuthScreen from './Auth'

type Section = 'home' | 'movies' | 'series' | 'my-list'

type SortMode =
  | 'featured'
  | 'newest'
  | 'oldest'
  | 'rating'
  | 'title'

type DiscoveryFilters = {
  category: string
  type: string
  year: string
  minRating: string
  sort: SortMode
}

function AuthenticatedApp({
  session,
}: {
  session: Session
}) {
  const [activeSection, setActiveSection] =
    useState<Section>('home')

  const [searchQuery, setSearchQuery] =
    useState('')

  const [selectedMovie, setSelectedMovie] =
    useState<Movie | null>(null)

  const [watchingMovie, setWatchingMovie] =
    useState<Movie | null>(null)

  const [movies, setMovies] = useState<Movie[]>([])
  const [moviesLoading, setMoviesLoading] =
    useState(true)

  const [moviesError, setMoviesError] =
    useState('')

  const [showMobileSearch, setShowMobileSearch] =
    useState(false)

  const [showFilters, setShowFilters] =
    useState(false)

  const [mobileMenu, setMobileMenu] =
    useState(false)

  const [heroIndex, setHeroIndex] =
    useState(0)

  const [searchFocused, setSearchFocused] =
    useState(false)

  const [filters, setFilters] =
    useState<DiscoveryFilters>({
      category: '',
      type: '',
      year: '',
      minRating: '',
      sort: 'featured',
    })

  const [myList, setMyList] =
    useState<number[]>(() => {
      try {
        const saved =
          localStorage.getItem('pmf-my-list')

        if (!saved) return []

        const parsed: unknown =
          JSON.parse(saved)

        if (!Array.isArray(parsed)) return []

        return parsed.filter(
          (value): value is number =>
            typeof value === 'number',
        )
      } catch {
        return []
      }
    })

  const [continueWatching, setContinueWatching] =
    useState<number[]>(() => {
      try {
        const saved = localStorage.getItem(
          'pmf-continue-watching',
        )

        if (!saved) return []

        const parsed: unknown =
          JSON.parse(saved)

        if (!Array.isArray(parsed)) return []

        return parsed.filter(
          (value): value is number =>
            typeof value === 'number',
        )
      } catch {
        return []
      }
    })

  useEffect(() => {
    let mounted = true

    const loadMovies = async () => {
      setMoviesLoading(true)
      setMoviesError('')

      try {
        const canonicalMovies =
          await getMovies()

        if (!mounted) return

        const mappedMovies: Movie[] =
          canonicalMovies.map(
            mapCanonicalMovieToLegacy,
          )

        setMovies(mappedMovies)
        setMoviesLoading(false)
      } catch (error) {
        if (!mounted) return

        console.error(
          'PMF Supabase movie error:',
          error,
        )

        setMoviesError(
          'We could not load the PMF movie catalogue right now.',
        )

        setMoviesLoading(false)
      }
    }

    void loadMovies()

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
          void loadMovies()
        },
      )
      .subscribe()

    return () => {
      mounted = false
      void supabase.removeChannel(channel)
    }
  }, [])

  const saveMyList = (list: number[]) => {
    try {
      localStorage.setItem(
        'pmf-my-list',
        JSON.stringify(list),
      )
    } catch {
      // Ignore storage failures.
    }
  }

  const toggleMyList = (movieId: number) => {
    setMyList((current) => {
      const updated = current.includes(movieId)
        ? current.filter((id) => id !== movieId)
        : [...current, movieId]

      saveMyList(updated)
      return updated
    })
  }

  const addToContinueWatching = (
    movieId: number,
  ) => {
    setContinueWatching((current) => {
      const updated = [
        movieId,
        ...current.filter(
          (id) => id !== movieId,
        ),
      ].slice(0, 10)

      try {
        localStorage.setItem(
          'pmf-continue-watching',
          JSON.stringify(updated),
        )
      } catch {
        // Ignore storage failures.
      }

      return updated
    })
  }

  const openMovie = (movie: Movie) => {
    setSelectedMovie(movie)

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  const startWatching = (movie: Movie) => {
    setSelectedMovie(null)
    setWatchingMovie(movie)
    addToContinueWatching(movie.id)
  }

  const closeWatching = () => {
    setWatchingMovie(null)
  }

  const goHome = () => {
    setActiveSection('home')
    setSearchQuery('')
    setSelectedMovie(null)
    setWatchingMovie(null)
    setShowFilters(false)
    setMobileMenu(false)
    setSearchFocused(false)

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  const navigateTo = (section: Section) => {
    setActiveSection(section)
    setSearchQuery('')
    setShowFilters(false)
    setMobileMenu(false)
    setSearchFocused(false)

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const getVideoUrl = (movie: Movie) => {
    if (
      movie.videoUrl &&
      movie.videoUrl.trim()
    ) {
      return movie.videoUrl.trim()
    }

    if (
      movie.title.trim().toLowerCase() ===
      'the journey'
    ) {
      return '/movies/the-journey.mp4'
    }

    return ''
  }

  const isYouTubeUrl = (url: string) =>
    /youtube\.com|youtu\.be/i.test(url)

  useEffect(() => {
    if (!movies.length) return

    const featured = movies.filter(
      (movie) => movie.featured,
    )

    if (featured.length <= 1) return

    const timer = window.setInterval(() => {
      setHeroIndex((current) =>
        current >= featured.length - 1
          ? 0
          : current + 1,
      )
    }, 7000)

    return () => window.clearInterval(timer)
  }, [movies])

  useEffect(() => {
    const handleEscape = (
      event: KeyboardEvent,
    ) => {
      if (event.key !== 'Escape') return

      if (watchingMovie) {
        closeWatching()
      } else if (selectedMovie) {
        setSelectedMovie(null)
      } else if (mobileMenu) {
        setMobileMenu(false)
      } else if (searchFocused) {
        setSearchFocused(false)
      }
    }

    window.addEventListener(
      'keydown',
      handleEscape,
    )

    return () => {
      window.removeEventListener(
        'keydown',
        handleEscape,
      )
    }
  }, [
    watchingMovie,
    selectedMovie,
    mobileMenu,
    searchFocused,
  ])

  useEffect(() => {
    if (!selectedMovie) return

    const updatedMovie = movies.find(
      (movie) =>
        movie.id === selectedMovie.id,
    )

    if (
      updatedMovie &&
      updatedMovie !== selectedMovie
    ) {
      setSelectedMovie(updatedMovie)
    }
  }, [movies, selectedMovie])

  useEffect(() => {
    if (!watchingMovie) return

    const updatedMovie = movies.find(
      (movie) =>
        movie.id === watchingMovie.id,
    )

    if (
      updatedMovie &&
      updatedMovie !== watchingMovie
    ) {
      setWatchingMovie(updatedMovie)
    }
  }, [movies, watchingMovie])

  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          movies
            .map((movie) =>
              movie.category?.trim(),
            )
            .filter(
              (value): value is string =>
                Boolean(value),
            ),
        ),
      ).sort(),
    [movies],
  )

  const typeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          movies
            .map((movie) => movie.type?.trim())
            .filter(
              (value): value is string =>
                Boolean(value),
            ),
        ),
      ).sort(),
    [movies],
  )

  const yearOptions = useMemo(
    () =>
      Array.from(
        new Set(
          movies
            .map((movie) => movie.year)
            .filter(
              (year): year is number =>
                typeof year === 'number',
            ),
        ),
      ).sort((a, b) => b - a),
    [movies],
  )

  const filteredMovies = useMemo(() => {
    const query = searchQuery
      .trim()
      .toLowerCase()

    let result = movies.filter((movie) => {
      if (
        activeSection === 'movies' &&
        movie.type !== 'Movie'
      ) {
        return false
      }

      if (
        activeSection === 'series' &&
        movie.type !== 'Series'
      ) {
        return false
      }

      if (
        activeSection === 'my-list' &&
        !myList.includes(movie.id)
      ) {
        return false
      }

      if (
        filters.category &&
        movie.category !== filters.category
      ) {
        return false
      }

      if (
        filters.type &&
        movie.type !== filters.type
      ) {
        return false
      }

      if (
        filters.year &&
        String(movie.year) !== filters.year
      ) {
        return false
      }

      if (query) {
        const searchable = [
          movie.title,
          movie.description,
          movie.category,
          movie.type,
          String(movie.year),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        if (!searchable.includes(query)) {
          return false
        }
      }

      return true
    })

    result = [...result].sort((a, b) => {
      switch (filters.sort) {
        case 'newest':
          return b.year - a.year

        case 'oldest':
          return a.year - b.year

        case 'rating':
          return (
            Number(b.rating ?? 0) -
            Number(a.rating ?? 0)
          )

        case 'title':
          return a.title.localeCompare(
            b.title,
          )

        case 'featured':
        default:
          return (
            Number(Boolean(b.featured)) -
            Number(Boolean(a.featured))
          )
      }
    })

    return result
  }, [
    movies,
    activeSection,
    myList,
    filters,
    searchQuery,
  ])

  const featuredMovies = useMemo(
    () =>
      movies.filter(
        (movie) => movie.featured,
      ),
    [movies],
  )

  const heroMovie =
    featuredMovies[heroIndex] ??
    featuredMovies[0] ??
    movies[0]

  const latestMovies = useMemo(
    () =>
      [...movies]
        .sort((a, b) => b.year - a.year)
        .slice(0, 10),
    [movies],
  )

  const trendingMovies = useMemo(
    () =>
      [...movies]
        .sort(
          (a, b) =>
            Number(Boolean(b.featured)) -
              Number(Boolean(a.featured)) ||
            b.year - a.year,
        )
        .slice(0, 10),
    [movies],
  )

  const actionMovies = useMemo(
    () =>
      movies.filter((movie) =>
        movie.category
          ?.toLowerCase()
          .includes('action'),
      ),
    [movies],
  )

  const adventureMovies = useMemo(
    () =>
      movies.filter((movie) =>
        movie.category
          ?.toLowerCase()
          .includes('adventure'),
      ),
    [movies],
  )

  const continueMovies = useMemo(
    () =>
      continueWatching
        .map((id) =>
          movies.find(
            (movie) => movie.id === id,
          ),
        )
        .filter(
          (movie): movie is Movie =>
            Boolean(movie),
        ),
    [continueWatching, movies],
  )

  const recommendedMovies = useMemo(() => {
    if (!heroMovie) return []

    const heroCategory =
      heroMovie.category?.toLowerCase()

    return movies
      .filter(
        (movie) =>
          movie.id !== heroMovie.id &&
          movie.category?.toLowerCase() ===
            heroCategory,
      )
      .slice(0, 8)
  }, [movies, heroMovie])

  const genreMovies = useMemo(() => {
    const seen = new Set<string>()
    const result: {
      name: string
      items: Movie[]
    }[] = []

    movies.forEach((movie) => {
      const category =
        movie.category?.trim()

      if (!category) return

      if (seen.has(category)) {
        const existing = result.find(
          (item) => item.name === category,
        )

        if (existing) {
          existing.items.push(movie)
        }

        return
      }

      seen.add(category)

      result.push({
        name: category,
        items: [movie],
      })
    })

    return result.slice(0, 5)
  }, [movies])

  const resetFilters = () => {
    setFilters({
      category: '',
      type: '',
      year: '',
      minRating: '',
      sort: 'featured',
    })
  }

  const hasActiveFilters =
    Boolean(filters.category) ||
    Boolean(filters.type) ||
    Boolean(filters.year) ||
    Boolean(filters.minRating) ||
    filters.sort !== 'featured'

  const nextHero = () => {
    if (featuredMovies.length <= 1) return

    setHeroIndex((current) =>
      current >= featuredMovies.length - 1
        ? 0
        : current + 1,
    )
  }

  const previousHero = () => {
    if (featuredMovies.length <= 1) return

    setHeroIndex((current) =>
      current <= 0
        ? featuredMovies.length - 1
        : current - 1,
    )
  }

  const sectionTitle =
    activeSection === 'home'
      ? 'Discover your next obsession'
      : activeSection === 'movies'
        ? 'Movies'
        : activeSection === 'series'
          ? 'TV Series'
          : 'My List'

  const sectionDescription =
    activeSection === 'home'
      ? 'A premium world of stories, selected for your next great watch.'
      : activeSection === 'my-list'
        ? `${myList.length} title${
            myList.length === 1 ? '' : 's'
          } saved for later.`
        : 'Explore the PMF-Flix catalogue and find something worth watching.'

  const MovieCard = ({
    movie,
    compact = false,
  }: {
    movie: Movie
    compact?: boolean
  }) => {
    const inMyList = myList.includes(
      movie.id,
    )

    return (
      <article
        className={`group relative shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] shadow-xl shadow-black/20 transition duration-500 hover:-translate-y-2 hover:border-red-500/30 hover:bg-white/[0.07] hover:shadow-red-950/20 ${
          compact
            ? 'w-[155px] sm:w-[180px]'
            : 'w-[180px] sm:w-[210px]'
        }`}
        onClick={() => openMovie(movie)}
      >
        <div className="relative aspect-[2/3] overflow-hidden bg-zinc-950">
          {movie.poster ? (
            <img
              src={movie.poster}
              alt={movie.title}
              loading="lazy"
              className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-5 text-center">
              <span className="text-sm font-black text-white/25">
                {movie.title}
              </span>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />

          <div className="absolute inset-0 bg-red-600/0 transition duration-500 group-hover:bg-red-600/10" />

          {movie.featured && (
            <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full border border-white/10 bg-red-600 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.16em]">
              <Sparkles size={10} />
              Featured
            </div>
          )}

          <button
            type="button"
            aria-label={
              inMyList
                ? `Remove ${movie.title} from My List`
                : `Add ${movie.title} to My List`
            }
            onClick={(event) => {
              event.stopPropagation()
              toggleMyList(movie.id)
            }}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/65 text-white backdrop-blur-xl transition hover:scale-110 hover:bg-red-600"
          >
            {inMyList ? (
              <span className="text-sm font-black">
                ✓
              </span>
            ) : (
              <Plus size={17} />
            )}
          </button>

          <button
            type="button"
            aria-label={`Play ${movie.title}`}
            onClick={(event) => {
              event.stopPropagation()
              startWatching(movie)
            }}
            className="absolute bottom-14 left-3 flex h-9 w-9 translate-y-3 items-center justify-center rounded-full bg-white text-black opacity-0 shadow-xl transition duration-300 group-hover:translate-y-0 group-hover:opacity-100"
          >
            <Play
              size={15}
              fill="currentColor"
            />
          </button>

          <div className="absolute bottom-0 left-0 right-0 translate-y-1 p-3.5 transition duration-500 group-hover:translate-y-0">
            <h3 className="truncate text-sm font-black text-white sm:text-base">
              {movie.title}
            </h3>

            <div className="mt-1.5 flex items-center gap-1.5 overflow-hidden text-[9px] font-semibold text-white/55">
              <span>{movie.year}</span>
              <span>•</span>
              <span className="truncate">
                {movie.category}
              </span>

              {movie.rating && (
                <>
                  <span>•</span>
                  <span className="shrink-0">
                    {movie.rating}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </article>
    )
    }

  const MovieRail = ({
    title,
    subtitle,
    items,
    accent = false,
  }: {
    title: string
    subtitle?: string
    items: Movie[]
    accent?: boolean
  }) => {
    const [offset, setOffset] = useState(0)

    if (!items.length) return null

    const visibleItems = items.slice(
      offset,
      offset + 8,
    )

    const canBack = offset > 0

    const canForward =
      offset + 8 < items.length

    return (
      <section className="mt-12">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              {accent && (
                <span className="h-2 w-2 rounded-full bg-red-600 shadow-lg shadow-red-600/50" />
              )}

              <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">
                {title}
              </h2>
            </div>

            {subtitle && (
              <p className="mt-1 text-xs text-white/35 sm:text-sm">
                {subtitle}
              </p>
            )}
          </div>

          <div className="hidden gap-2 sm:flex">
            <button
              type="button"
              disabled={!canBack}
              onClick={() =>
                setOffset((value) =>
                  Math.max(0, value - 4),
                )
              }
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-20"
            >
              <ChevronLeft size={17} />
            </button>

            <button
              type="button"
              disabled={!canForward}
              onClick={() =>
                setOffset((value) =>
                  Math.min(
                    Math.max(
                      0,
                      items.length - 8,
                    ),
                    value + 4,
                  ),
                )
              }
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-20"
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4">
          {visibleItems.map((movie) => (
            <MovieCard
              key={movie.id}
              movie={movie}
            />
          ))}
        </div>
      </section>
    )
  }

  const SearchResults = () => {
    if (!searchQuery.trim()) return null

    return (
      <section className="mt-8">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-red-500">
              Search results
            </p>

            <h2 className="mt-1 text-2xl font-black">
              Results for “{searchQuery}”
            </h2>
          </div>

          <button
            type="button"
            onClick={() => {
              setSearchQuery('')
              setSearchFocused(false)
            }}
            className="rounded-full border border-white/10 px-3 py-2 text-[10px] font-bold text-white/50 hover:bg-white/10 hover:text-white"
          >
            Clear
          </button>
        </div>

        {filteredMovies.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filteredMovies.map((movie) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                compact
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-[300px] flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/[0.025] px-6 text-center">
            <Search
              size={32}
              className="text-white/15"
            />

            <h3 className="mt-4 text-lg font-black text-white">
              Nothing found
            </h3>

            <p className="mt-2 max-w-sm text-xs leading-6 text-white/30">
              Try another title, genre or
              keyword.
            </p>
          </div>
        )}
      </section>
    )
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050505] text-white selection:bg-red-600 selection:text-white">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-black/65 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 sm:h-[72px] sm:px-7 lg:px-10">
          <button
            type="button"
            onClick={goHome}
            className="group flex items-center gap-2"
            aria-label="PMF-Flix home"
          >
            <span className="text-2xl font-black tracking-[-0.08em] text-white sm:text-3xl">
              PMF
              <span className="text-red-600 transition group-hover:text-red-500">
                LIX
              </span>
            </span>

            <span className="hidden border-l border-white/10 pl-2 text-[8px] font-bold uppercase tracking-[0.22em] text-white/30 sm:block">
              Prince Mufasa Flix
            </span>
          </button>

          <nav className="hidden items-center gap-7 lg:flex">
            {(
              [
                ['home', 'Home'],
                ['movies', 'Movies'],
                ['series', 'TV Series'],
                ['my-list', 'My List'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  navigateTo(value)
                }
                className={`relative py-2 text-xs font-bold transition ${
                  activeSection === value
                    ? 'text-white'
                    : 'text-white/45 hover:text-white'
                }`}
              >
                {label}

                {activeSection === value && (
                  <span className="absolute -bottom-1 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-red-600" />
                )}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div
              className={`hidden items-center rounded-full border transition md:flex ${
                searchFocused
                  ? 'border-red-500/40 bg-white/[0.07] shadow-lg shadow-red-950/20'
                  : 'border-white/10 bg-white/[0.04]'
              }`}
            >
              <Search
                size={15}
                className="ml-3 text-white/30"
              />

              <input
                value={searchQuery}
                onFocus={() =>
                  setSearchFocused(true)
                }
                onChange={(event) =>
                  setSearchQuery(
                    event.target.value,
                  )
                }
                placeholder="Search PMF-Flix..."
                className="ml-2 w-36 bg-transparent px-2 py-2.5 text-xs font-semibold text-white outline-none placeholder:text-white/25 lg:w-48"
              />

              {searchQuery && (
                <button
                  type="button"
                  onClick={() =>
                    setSearchQuery('')
                  }
                  className="mr-2 text-white/30 hover:text-white"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                setShowMobileSearch(
                  (value) => !value,
                )
              }
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/10 md:hidden"
            >
              <Search size={17} />
            </button>

            <button
              type="button"
              onClick={() =>
                setMobileMenu(
                  (value) => !value,
                )
              }
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white lg:hidden"
            >
              {mobileMenu ? (
                <X size={18} />
              ) : (
                <Menu size={18} />
              )}
            </button>

            <button
              type="button"
              onClick={() => void signOut()}
              title={`Sign out ${
                session.user.email ?? ''
              }`}
              className="hidden h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/50 transition hover:border-red-500/30 hover:bg-red-600 hover:text-white sm:flex"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {showMobileSearch && (
          <div className="border-t border-white/[0.06] px-4 py-3 md:hidden">
            <div className="flex items-center rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
              <Search
                size={16}
                className="text-white/30"
              />

              <input
                autoFocus
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(
                    event.target.value,
                  )
                }
                placeholder="Search movies, series..."
                className="ml-2 w-full bg-transparent text-sm text-white outline-none placeholder:text-white/25"
              />
            </div>
          </div>
        )}

        {mobileMenu && (
          <div className="border-t border-white/[0.06] bg-black/95 px-4 py-4 lg:hidden">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['home', 'Home'],
                  ['movies', 'Movies'],
                  ['series', 'TV Series'],
                  ['my-list', 'My List'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    navigateTo(value)
                  }
                  className={`rounded-xl px-4 py-3 text-left text-sm font-bold ${
                    activeSection === value
                      ? 'bg-red-600 text-white'
                      : 'bg-white/[0.04] text-white/60'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-2 flex w-full items-center gap-2 rounded-xl bg-white/[0.04] px-4 py-3 text-sm font-bold text-white/60"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        )}
      </header>

            {activeSection === 'home' &&
        !searchQuery &&
        !selectedMovie && (
          <section className="relative min-h-[680px] overflow-hidden pt-16 sm:min-h-[760px] sm:pt-[72px]">
            <div className="absolute inset-0">
              <img
                src={
                  heroMovie?.poster ||
                  heroImage
                }
                alt=""
                className="h-full w-full object-cover opacity-45 transition duration-1000"
              />

              <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/20" />

              <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-black/10 to-black/30" />

              <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_35%,rgba(220,38,38,0.18),transparent_32%)]" />
            </div>

            <div className="relative mx-auto flex min-h-[680px] max-w-[1500px] items-end px-5 pb-20 sm:min-h-[760px] sm:px-8 sm:pb-28 lg:px-12">
              <div className="max-w-2xl">
                <div className="mb-5 flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] shadow-lg shadow-red-950/30">
                    <Sparkles size={11} />
                    PMF Original
                  </span>

                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                    Featured Film
                  </span>
                </div>

                <h1 className="max-w-xl text-5xl font-black leading-[0.92] tracking-[-0.06em] text-white transition duration-700 sm:text-7xl lg:text-8xl">
                  {heroMovie?.title ||
                    'Your World. Your Stories.'}
                </h1>

                <p className="mt-6 max-w-xl text-sm leading-7 text-white/60 sm:text-base sm:leading-8">
                  {heroMovie?.description ||
                    'Enter a cinematic world built for unforgettable stories.'}
                </p>

                {heroMovie && (
                  <div className="mt-5 flex flex-wrap items-center gap-3 text-[10px] font-bold text-white/50">
                    <span>{heroMovie.year}</span>

                    <span>•</span>

                    <span>
                      {heroMovie.category}
                    </span>

                    {heroMovie.duration && (
                      <>
                        <span>•</span>
                        <span>
                          {heroMovie.duration}
                        </span>
                      </>
                    )}

                    {heroMovie.rating && (
                      <>
                        <span>•</span>
                        <span className="rounded border border-white/15 px-1.5 py-0.5">
                          {heroMovie.rating}
                        </span>
                      </>
                    )}
                  </div>
                )}

                <div className="mt-8 flex flex-wrap gap-3">
                  {heroMovie && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          startWatching(
                            heroMovie,
                          )
                        }
                        className="group flex items-center gap-2 rounded-xl bg-white px-5 py-3.5 text-xs font-black text-black shadow-xl shadow-black/30 transition hover:scale-[1.03] hover:bg-white/90"
                      >
                        <Play
                          size={16}
                          fill="currentColor"
                        />
                        Watch Now

                        <ArrowRight
                          size={14}
                          className="transition group-hover:translate-x-1"
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          openMovie(heroMovie)
                        }
                        className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.08] px-5 py-3.5 text-xs font-black text-white backdrop-blur-xl transition hover:bg-white/15"
                      >
                        <Info size={16} />
                        More Info
                      </button>
                    </>
                  )}
                </div>
              </div>

              {featuredMovies.length > 1 && (
                <div className="absolute bottom-8 right-5 flex items-center gap-2 sm:right-8 lg:right-12">
                  <button
                    type="button"
                    onClick={previousHero}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur-xl transition hover:bg-white/10"
                  >
                    <ChevronLeft size={17} />
                  </button>

                  <button
                    type="button"
                    onClick={nextHero}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur-xl transition hover:bg-white/10"
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

      <main className="mx-auto max-w-[1500px] px-4 pb-20 sm:px-7 lg:px-10">
        {!selectedMovie && (
          <section
            className={
              activeSection === 'home' &&
              !searchQuery
                ? 'pt-2'
                : 'pt-28 sm:pt-32'
            }
          >
            {!searchQuery && (
              <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.25em] text-red-500">
                    <span className="h-1 w-1 rounded-full bg-red-500" />
                    PMF Discovery
                  </div>

                  <h2 className="text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
                    {sectionTitle}
                  </h2>

                  <p className="mt-2 max-w-xl text-sm text-white/35">
                    {sectionDescription}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setShowFilters(
                        (value) => !value,
                      )
                    }
                    className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition ${
                      hasActiveFilters
                        ? 'border-red-600/50 bg-red-600/10 text-red-400'
                        : 'border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08]'
                    }`}
                  >
                    <Filter size={14} />
                    Filters

                    {hasActiveFilters && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[8px] text-white">
                        !
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {showFilters && (
              <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-2xl shadow-black/20 sm:p-5">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <select
                    value={filters.category}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        category:
                          event.target.value,
                      }))
                    }
                    className="rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-xs font-semibold text-white outline-none"
                  >
                    <option value="">
                      All categories
                    </option>

                    {categoryOptions.map(
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
                      setFilters((current) => ({
                        ...current,
                        type: event.target.value,
                      }))
                    }
                    className="rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-xs font-semibold text-white outline-none"
                  >
                    <option value="">
                      All types
                    </option>

                    {typeOptions.map((type) => (
                      <option
                        key={type}
                        value={type}
                      >
                        {type}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filters.year}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        year: event.target.value,
                      }))
                    }
                    className="rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-xs font-semibold text-white outline-none"
                  >
                    <option value="">
                      All years
                    </option>

                    {yearOptions.map((year) => (
                      <option
                        key={year}
                        value={String(year)}
                      >
                        {year}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filters.minRating}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        minRating:
                          event.target.value,
                      }))
                    }
                    className="rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-xs font-semibold text-white outline-none"
                  >
                    <option value="">
                      Any rating
                    </option>
                    <option value="8">
                      8+ rating
                    </option>
                    <option value="7">
                      7+ rating
                    </option>
                    <option value="6">
                      6+ rating
                    </option>
                  </select>

                  <select
                    value={filters.sort}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        sort: event.target
                          .value as SortMode,
                      }))
                    }
                    className="rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-xs font-semibold text-white outline-none"
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
                      Highest rated
                    </option>
                    <option value="title">
                      Title A-Z
                    </option>
                  </select>
                </div>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-4 text-xs font-bold text-red-400 hover:text-red-300"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            )}

            {moviesLoading ? (
              <div className="flex min-h-[360px] items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-white/10 border-t-red-600" />

                  <p className="mt-5 text-[10px] font-black uppercase tracking-[0.25em] text-white/25">
                    Loading your cinematic
                    world
                  </p>
                </div>
              </div>
            ) : moviesError ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-8 text-center">
                <p className="text-sm font-bold text-white">
                  {moviesError}
                </p>

                <p className="mt-2 text-xs text-white/35">
                  Please refresh and try again.
                </p>
              </div>
            ) : searchQuery ? (
              <SearchResults />
            ) : activeSection !== 'home' ||
              hasActiveFilters ? (
              <section>
                <div className="mb-5 flex items-center justify-between">
                  <p className="text-xs font-bold text-white/30">
                    {filteredMovies.length}{' '}
                    result
                    {filteredMovies.length ===
                    1
                      ? ''
                      : 's'}
                  </p>
                </div>

                {filteredMovies.length ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {filteredMovies.map(
                      (movie) => (
                        <MovieCard
                          key={movie.id}
                          movie={movie}
                          compact
                        />
                      ),
                    )}
                  </div>
                ) : (
                  <div className="flex min-h-[300px] flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/[0.025] px-6 text-center">
                    <Search
                      size={30}
                      className="text-white/15"
                    />

                    <h3 className="mt-4 text-lg font-black text-white">
                      Nothing found
                    </h3>

                    <p className="mt-2 max-w-sm text-xs leading-6 text-white/30">
                      Try another search or
                      clear your filters to
                      explore more of PMF-Flix.
                    </p>
                  </div>
                )}
              </section>
            ) : (
              <div>
                {continueMovies.length > 0 && (
                  <MovieRail
                    title="Continue Watching"
                    subtitle="Pick up where your story left off."
                    items={continueMovies}
                    accent
                  />
                )}

                <MovieRail
                  title="Trending Now"
                  subtitle="What the PMF world is watching."
                  items={
                    trendingMovies.length
                      ? trendingMovies
                      : movies
                  }
                  accent
                />

                <MovieRail
                  title="Latest Releases"
                  subtitle="Fresh stories, ready for discovery."
                  items={latestMovies}
                />

                                {recommendedMovies.length > 0 && (
                  <MovieRail
                    title="Because You Might Like This"
                    subtitle="More stories from the same cinematic world."
                    items={recommendedMovies}
                  />
                )}

                {actionMovies.length > 0 && (
                  <MovieRail
                    title="Action"
                    subtitle="Intensity, ambition and impossible missions."
                    items={actionMovies}
                  />
                )}

                {adventureMovies.length > 0 && (
                  <MovieRail
                    title="Adventure"
                    subtitle="Go beyond the expected."
                    items={adventureMovies}
                  />
                )}

                {genreMovies.map((genre) => (
                  <MovieRail
                    key={genre.name}
                    title={genre.name}
                    subtitle={`Explore ${genre.name.toLowerCase()} stories on PMF-Flix.`}
                    items={genre.items}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {selectedMovie && (
          <section className="min-h-screen pt-28 sm:pt-32">
            <button
              type="button"
              onClick={() =>
                setSelectedMovie(null)
              }
              className="mb-6 flex items-center gap-2 text-xs font-bold text-white/45 transition hover:text-white"
            >
              <ChevronLeft size={16} />
              Back to discovery
            </button>

            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.035]">
              <div className="absolute inset-0">
                {selectedMovie.poster && (
                  <img
                    src={selectedMovie.poster}
                    alt=""
                    className="h-full w-full object-cover opacity-20 blur-2xl"
                  />
                )}

                <div className="absolute inset-0 bg-gradient-to-r from-black via-black/95 to-black/60" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20" />
              </div>

              <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[300px_1fr] lg:p-12">
                <div className="mx-auto w-full max-w-[300px]">
                  {selectedMovie.poster && (
                    <img
                      src={selectedMovie.poster}
                      alt={selectedMovie.title}
                      className="w-full rounded-2xl shadow-2xl shadow-black/60"
                    />
                  )}
                </div>

                <div className="flex flex-col justify-center">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-[8px] font-black uppercase tracking-[0.18em]">
                      <Sparkles size={10} />
                      PMF
                    </span>

                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                      {selectedMovie.type}
                    </span>
                  </div>

                  <h1 className="mt-5 text-4xl font-black tracking-[-0.05em] sm:text-6xl">
                    {selectedMovie.title}
                  </h1>

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-bold text-white/50">
                    <span>
                      {selectedMovie.year}
                    </span>

                    <span>•</span>

                    <span>
                      {selectedMovie.category}
                    </span>

                    {selectedMovie.duration && (
                      <>
                        <span>•</span>
                        <span>
                          {selectedMovie.duration}
                        </span>
                      </>
                    )}

                    {selectedMovie.rating && (
                      <>
                        <span>•</span>
                        <span className="rounded border border-white/15 px-1.5 py-0.5">
                          {selectedMovie.rating}
                        </span>
                      </>
                    )}
                  </div>

                  <p className="mt-6 max-w-2xl text-sm leading-7 text-white/55 sm:text-base">
                    {selectedMovie.description}
                  </p>

                  <div className="mt-8 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        startWatching(
                          selectedMovie,
                        )
                      }
                      className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3.5 text-xs font-black text-white shadow-xl shadow-red-950/40 transition hover:scale-[1.02] hover:bg-red-500"
                    >
                      <Play
                        size={16}
                        fill="currentColor"
                      />
                      Play Now
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        toggleMyList(
                          selectedMovie.id,
                        )
                      }
                      className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-5 py-3.5 text-xs font-black text-white transition hover:bg-white/10"
                    >
                      {myList.includes(
                        selectedMovie.id,
                      ) ? (
                        '✓ In My List'
                      ) : (
                        <>
                          <Plus size={16} />
                          My List
                        </>
                      )}
                    </button>
                  </div>

                  <div className="mt-8 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                      <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/25">
                        Year
                      </p>

                      <p className="mt-2 text-sm font-black">
                        {selectedMovie.year}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                      <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/25">
                        Genre
                      </p>

                      <p className="mt-2 truncate text-sm font-black">
                        {selectedMovie.category}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                      <p className="flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.18em] text-white/25">
                        <Star size={9} />
                        Rating
                      </p>

                      <p className="mt-2 text-sm font-black">
                        {selectedMovie.rating ||
                          'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-white/[0.06] bg-black/40">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-5 py-10 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-12">
          <div>
            <div className="text-2xl font-black tracking-[-0.07em]">
              PMF
              <span className="text-red-600">
                LIX
              </span>
            </div>

            <p className="mt-2 max-w-sm text-xs leading-5 text-white/25">
              Your World. Your Stories. Your
              Flix.
            </p>
          </div>

          <div className="text-left lg:text-right">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">
              Signed in as
            </p>

            <p className="mt-1 max-w-xs truncate text-xs font-semibold text-white/45">
              {session.user.email ||
                'PMF member'}
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-[1500px] border-t border-white/[0.05] px-5 py-5 text-[9px] font-bold uppercase tracking-[0.18em] text-white/15 sm:px-8 lg:px-12">
          © {new Date().getFullYear()} PMF-Flix
          • Built for cinematic discovery
        </div>
      </footer>

      {watchingMovie && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-3 backdrop-blur-xl sm:p-6"
          onMouseDown={(event) => {
            if (
              event.currentTarget ===
              event.target
            ) {
              closeWatching()
            }
          }}
        >
          <div className="relative w-full max-w-6xl overflow-hidden rounded-2xl border border-white/10 bg-[#080808] shadow-2xl shadow-black">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">
                  {watchingMovie.title}
                </p>

                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-white/25">
                  PMF-Flix • Now Playing
                </p>
              </div>

              <button
                type="button"
                onClick={closeWatching}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/60 transition hover:bg-red-600 hover:text-white"
                aria-label="Close player"
              >
                <X size={17} />
              </button>
            </div>

            <div className="aspect-video bg-black">
              {getVideoUrl(
                watchingMovie,
              ) ? (
                isYouTubeUrl(
                  getVideoUrl(
                    watchingMovie,
                  ),
                ) ? (
                  <iframe
                    title={watchingMovie.title}
                    src={getVideoUrl(
                      watchingMovie,
                    )}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : (
                  <video
                    src={getVideoUrl(
                      watchingMovie,
                    )}
                    className="h-full w-full"
                    controls
                    autoPlay
                    playsInline
                  />
                )
              ) : (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                  <Play
                    size={34}
                    className="text-white/15"
                  />

                  <h3 className="mt-4 text-lg font-black text-white">
                    Coming Soon
                  </h3>

                  <p className="mt-2 max-w-md text-xs leading-6 text-white/30">
                    This title does not have a
                    licensed video source
                    connected yet.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-white/[0.06] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <p className="text-xs font-bold text-white/60">
                  {watchingMovie.category}
                </p>

                <p className="mt-1 text-[10px] text-white/25">
                  {watchingMovie.year}
                  {watchingMovie.duration
                    ? ` • ${watchingMovie.duration}`
                    : ''}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  toggleMyList(
                    watchingMovie.id,
                  )
                }
                className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-xs font-bold text-white/70 transition hover:bg-white/10"
              >
                {myList.includes(
                  watchingMovie.id,
                )
                  ? '✓ In My List'
                  : '+ Add to My List'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [session, setSession] =
    useState<Session | null>(null)

  const [authLoading, setAuthLoading] =
    useState(true)

  useEffect(() => {
    let mounted = true

    const loadSession = async () => {
      try {
        const {
          data: {
            session: currentSession,
          },
        } = await supabase.auth.getSession()

        if (!mounted) return

        setSession(currentSession)
      } catch (error) {
        console.error(
          'PMF session error:',
          error,
        )
      } finally {
        if (mounted) {
          setAuthLoading(false)
        }
      }
    }

    void loadSession()

    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        (_event, currentSession) => {
          if (!mounted) return

          setSession(currentSession)
          setAuthLoading(false)
        },
      )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <div className="text-center">
          <div className="text-4xl font-black tracking-[-0.08em]">
            PMF
            <span className="text-red-600">
              LIX
            </span>
          </div>

          <div className="relative mx-auto mt-7 h-10 w-10">
            <div className="absolute inset-0 rounded-full border border-white/10" />

            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-red-600" />
          </div>

          <p className="mt-5 text-[9px] font-black uppercase tracking-[0.28em] text-white/25">
            Preparing your cinematic
            experience
          </p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <AuthScreen />
  }

  return (
    <AuthenticatedApp
      session={session}
    />
   )
  }
