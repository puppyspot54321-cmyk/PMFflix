import heroImage from './assets/hero.png'
import { useEffect, useMemo, useState } from 'react'
import type { Movie } from './movieData/movies'
import { getMovies } from './services/movieService'
import { mapCanonicalMovieToLegacy } from './utils/movieMapper'
import { supabase } from './supabase'
import type { Session } from '@supabase/supabase-js'
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

  const [searchQuery, setSearchQuery] = useState('')

  const [selectedMovie, setSelectedMovie] =
    useState<Movie | null>(null)

  const [watchingMovie, setWatchingMovie] =
    useState<Movie | null>(null)

  const [movies, setMovies] = useState<Movie[]>([])
  const [moviesLoading, setMoviesLoading] = useState(true)
  const [moviesError, setMoviesError] = useState('')

  const [showMobileSearch, setShowMobileSearch] =
    useState(false)

  const [showFilters, setShowFilters] =
    useState(false)

  const [filters, setFilters] =
    useState<DiscoveryFilters>({
      category: '',
      type: '',
      year: '',
      minRating: '',
      sort: 'featured',
    })

  const [myList, setMyList] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('pmf-my-list')

      if (!saved) return []

      const parsed: unknown = JSON.parse(saved)

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

        const parsed: unknown = JSON.parse(saved)

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
        const canonicalMovies = await getMovies()

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
      .subscribe((status) => {
        console.log(
          'PMF movie realtime status:',
          status,
        )
      })

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
      // Ignore localStorage failures.
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

  const addToContinueWatching = (movieId: number) => {
    setContinueWatching((current) => {
      const updated = [
        movieId,
        ...current.filter((id) => id !== movieId),
      ].slice(0, 10)

      try {
        localStorage.setItem(
          'pmf-continue-watching',
          JSON.stringify(updated),
        )
      } catch {
        // Ignore localStorage failures.
      }

      return updated
    })
  }

  const getVideoUrl = (movie: Movie) => {
    if (
      movie.videoUrl &&
      movie.videoUrl.trim() !== ''
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

  const openMovie = (movie: Movie) => {
    setSelectedMovie(movie)
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

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  const navigateTo = (section: Section) => {
    setActiveSection(section)
    setSearchQuery('')
    setShowFilters(false)

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  useEffect(() => {
    const handleEscape = (
      event: KeyboardEvent,
    ) => {
      if (event.key !== 'Escape') return

      if (watchingMovie) {
        closeWatching()
      } else if (selectedMovie) {
        setSelectedMovie(null)
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
  }, [watchingMovie, selectedMovie])

  useEffect(() => {
    if (!selectedMovie) return

    const updatedMovie = movies.find(
      (movie) => movie.id === selectedMovie.id,
    )

    if (updatedMovie) {
      setSelectedMovie(updatedMovie)
    }
  }, [movies, selectedMovie?.id])

  useEffect(() => {
    if (!watchingMovie) return

    const updatedMovie = movies.find(
      (movie) => movie.id === watchingMovie.id,
    )

    if (updatedMovie) {
      setWatchingMovie(updatedMovie)
    }
  }, [movies, watchingMovie?.id])

  const categoryOptions = useMemo(() => {
    return Array.from(
      new Set(
        movies
          .map((movie) => movie.category?.trim())
          .filter(
            (category): category is string =>
              Boolean(category),
          ),
      ),
    ).sort()
  }, [movies])

  const typeOptions = useMemo(() => {
    return Array.from(
      new Set(
        movies
          .map((movie) => movie.type?.trim())
          .filter(
            (type): type is string => Boolean(type),
          ),
      ),
    ).sort()
  }, [movies])

  const yearOptions = useMemo(() => {
    return Array.from(
      new Set(
        movies
          .map((movie) => movie.year)
          .filter(
            (year): year is number =>
              typeof year === 'number',
          ),
      ),
    ).sort((a, b) => b - a)
  }, [movies])

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

      if (filters.minRating) {
        const minimum = Number(
          filters.minRating,
        )

        const rating = Number(
          movie.rating ?? 0,
        )

        if (rating < minimum) {
          return false
        }
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
          return a.title.localeCompare(b.title)

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

  const trendingMovies = useMemo(
    () =>
      movies.filter(
        (movie) => movie.featured,
      ),
    [movies],
  )

  const latestMovies = useMemo(
    () =>
      [...movies].sort(
        (a, b) => b.year - a.year,
      ),
    [movies],
  )

  const actionMovies = useMemo(
    () =>
      movies.filter(
        (movie) =>
          movie.category
            ?.toLowerCase()
            .includes('action'),
      ),
    [movies],
  )

  const adventureMovies = useMemo(
    () =>
      movies.filter(
        (movie) =>
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

  const MovieCard = ({
    movie,
  }: {
    movie: Movie
  }) => {
    const inMyList = myList.includes(movie.id)

    return (
      <article
        className="group relative min-w-0 cursor-pointer overflow-hidden rounded-xl bg-white/[0.04] ring-1 ring-white/10 transition duration-300 hover:-translate-y-1 hover:bg-white/[0.08] hover:ring-white/20"
        onClick={() => openMovie(movie)}
      >
        <div className="relative aspect-[2/3] overflow-hidden bg-zinc-900">
          {movie.poster ? (
            <img
              src={movie.poster}
              alt={movie.title}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-zinc-900 to-black p-4 text-center">
              <span className="text-sm font-bold text-white/40">
                {movie.title}
              </span>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />

          {movie.featured && (
            <span className="absolute left-2 top-2 rounded-full bg-red-600 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white shadow-lg">
              Featured
            </span>
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
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-lg text-white backdrop-blur transition hover:bg-red-600"
          >
            {inMyList ? '✓' : '+'}
          </button>

          <div className="absolute bottom-0 left-0 right-0 p-3">
            <h3 className="truncate text-sm font-bold text-white">
              {movie.title}
            </h3>

            <div className="mt-1 flex items-center gap-2 text-[10px] text-white/60">
              <span>{movie.year}</span>

              {movie.category && (
                <>
                  <span>•</span>
                  <span>
                    {movie.category}
                  </span>
                </>
              )}

              {movie.rating && (
                <>
                  <span>•</span>
                  <span>
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

  const MovieRow = ({
    title,
    items,
  }: {
    title: string
    items: Movie[]
  }) => {
    if (!items.length) return null

    return (
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.3em] text-red-500">
              PMF Flix
            </p>

            <h2 className="text-xl font-black text-white sm:text-2xl">
              {title}
            </h2>
          </div>

          <button
            type="button"
            onClick={() =>
              setActiveSection('movies')
            }
            className="text-xs font-bold text-white/50 transition hover:text-white"
          >
            See all
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items
            .slice(0, 10)
            .map((movie) => (
              <MovieCard
                key={movie.id}
                movie={movie}
              />
            ))}
        </div>
      </section>
    )
  }

  const FilterPanel = () => {
    if (!showFilters) return null

    return (
      <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-500">
              Discovery
            </p>

            <h3 className="mt-1 text-lg font-bold text-white">
              Find your next story
            </h3>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-bold text-red-400 hover:text-red-300"
            >
              Reset
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <select
            value={filters.category}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                category: event.target.value,
              }))
            }
            className="rounded-lg border border-white/10 bg-black/60 px-3 py-3 text-sm text-white outline-none focus:border-red-500"
          >
            <option value="">
              All genres
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
            className="rounded-lg border border-white/10 bg-black/60 px-3 py-3 text-sm text-white outline-none focus:border-red-500"
          >
            <option value="">
              All content
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
            className="rounded-lg border border-white/10 bg-black/60 px-3 py-3 text-sm text-white outline-none focus:border-red-500"
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
                minRating: event.target.value,
              }))
            }
            className="rounded-lg border border-white/10 bg-black/60 px-3 py-3 text-sm text-white outline-none focus:border-red-500"
          >
            <option value="">
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
              setFilters((current) => ({
                ...current,
                sort: event.target
                  .value as SortMode,
              }))
            }
            className="rounded-lg border border-white/10 bg-black/60 px-3 py-3 text-sm text-white outline-none focus:border-red-500"
          >
            <option value="featured">
              Featured first
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
              A–Z
            </option>
          </select>
        </div>
      </div>
    )
  }
    return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-5 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={goHome}
            className="shrink-0 text-left"
          >
            <div className="text-xl font-black tracking-tight">
              PMF
              <span className="text-red-600">
                LIX
              </span>
            </div>

            <div className="hidden text-[8px] font-bold uppercase tracking-[0.25em] text-white/30 sm:block">
              Prince Mufasa Flix
            </div>
          </button>

          <nav className="hidden items-center gap-5 md:flex">
            {(
              [
                ['home', 'Home'],
                ['movies', 'Movies'],
                ['series', 'TV Series'],
                ['my-list', 'My List'],
              ] as const
            ).map(([section, label]) => (
              <button
                key={section}
                type="button"
                onClick={() =>
                  navigateTo(section)
                }
                className={`text-sm font-semibold transition ${
                  activeSection === section
                    ? 'text-white'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden lg:block">
              <input
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(
                    event.target.value,
                  )
                }
                placeholder="Search movies, genres..."
                className="w-56 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs text-white outline-none placeholder:text-white/30 focus:border-red-500"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                setShowMobileSearch(
                  (current) => !current,
                )
              }
              className="rounded-full px-3 py-2 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
            >
              Search
            </button>

            <button
              type="button"
              onClick={() =>
                supabase.auth.signOut()
              }
              className="rounded-full border border-white/10 px-3 py-2 text-[10px] font-bold text-white/60 transition hover:border-red-500/40 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </div>

        {showMobileSearch && (
          <div className="border-t border-white/10 px-4 py-3 lg:hidden">
            <input
              autoFocus
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(
                  event.target.value,
                )
              }
              placeholder="Search PMF Flix..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-red-500"
            />
          </div>
        )}

        <div className="border-t border-white/[0.05] md:hidden">
          <div className="mx-auto flex max-w-7xl overflow-x-auto px-4 py-2">
            {(
              [
                ['home', 'Home'],
                ['movies', 'Movies'],
                ['series', 'TV Series'],
                ['my-list', 'My List'],
              ] as const
            ).map(([section, label]) => (
              <button
                key={section}
                type="button"
                onClick={() =>
                  navigateTo(section)
                }
                className={`mr-5 whitespace-nowrap py-2 text-xs font-bold ${
                  activeSection === section
                    ? 'text-red-500'
                    : 'text-white/45'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

            {activeSection === 'home' &&
        !searchQuery.trim() && (
          <section className="relative min-h-[62vh] overflow-hidden">
            <img
              src={heroImage}
              alt="PMF Cinematic Hero"
              className="absolute inset-0 h-full w-full object-cover"
            />

            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/65 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20" />

            <div className="relative mx-auto flex min-h-[62vh] max-w-7xl items-end px-4 pb-16 pt-24 sm:px-6 lg:px-8">
              <div className="max-w-2xl">
                <p className="mb-3 text-xs font-black uppercase tracking-[0.35em] text-red-500">
                  Featured Film
                </p>

                <h1 className="text-4xl font-black leading-none tracking-tight sm:text-6xl">
                  Your World.
                  <br />
                  Your Stories.
                  <br />
                  <span className="text-red-600">
                    Your Flix.
                  </span>
                </h1>

                <p className="mt-5 max-w-xl text-sm leading-6 text-white/60 sm:text-base">
                  Discover cinematic stories,
                  unforgettable characters and
                  premium entertainment on PMF
                  Flix.
                </p>

                <div className="mt-7 flex flex-wrap gap-3">
                  {trendingMovies[0] && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          startWatching(
                            trendingMovies[0],
                          )
                        }
                        className="rounded-full bg-white px-6 py-3 text-sm font-black text-black transition hover:bg-white/90"
                      >
                        ▶ Play
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          openMovie(
                            trendingMovies[0],
                          )
                        }
                        className="rounded-full bg-white/10 px-6 py-3 text-sm font-black text-white backdrop-blur transition hover:bg-white/20"
                      >
                        More Info
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

      <main>
        <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
          {searchQuery.trim() && (
            <div className="mb-7">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">
                PMF Search
              </p>

              <h1 className="mt-2 text-2xl font-black">
                Results for “
                {searchQuery.trim()}
                ”
              </h1>
            </div>
          )}

          {activeSection !== 'home' &&
            !searchQuery.trim() && (
              <div className="mb-8 pt-4">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">
                  PMF Catalogue
                </p>

                <h1 className="mt-2 text-3xl font-black">
                  {activeSection ===
                  'my-list'
                    ? 'My List'
                    : activeSection ===
                        'series'
                      ? 'TV Series'
                      : 'Movies'}
                </h1>
              </div>
            )}

          {(activeSection !== 'home' ||
            searchQuery.trim()) && (
            <div className="mb-5 flex items-center justify-between gap-3">
              <p className="text-xs text-white/40">
                {filteredMovies.length}{' '}
                {filteredMovies.length ===
                1
                  ? 'title'
                  : 'titles'}{' '}
                found
              </p>

              <button
                type="button"
                onClick={() =>
                  setShowFilters(
                    (current) => !current,
                  )
                }
                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-bold text-white/70 transition hover:border-red-500/40 hover:text-white"
              >
                {showFilters
                  ? 'Hide Filters'
                  : 'Filters'}
              </button>
            </div>
          )}

          {(activeSection !== 'home' ||
            searchQuery.trim()) && (
            <FilterPanel />
          )}
        </div>

        {moviesLoading && (
          <section className="mx-auto flex min-h-[45vh] max-w-7xl items-center justify-center px-4">
            <div className="text-center">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-red-600" />

              <p className="text-sm font-semibold text-white/50">
                Loading PMF catalogue...
              </p>
            </div>
          </section>
        )}

        {!moviesLoading && moviesError && (
          <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
              <p className="text-sm font-bold text-red-400">
                {moviesError}
              </p>

              <button
                type="button"
                onClick={() =>
                  window.location.reload()
                }
                className="mt-5 rounded-full bg-red-600 px-5 py-2 text-xs font-black text-white hover:bg-red-500"
              >
                Try Again
              </button>
            </div>
          </section>
        )}

        {!moviesLoading &&
          !moviesError &&
          (activeSection !== 'home' ||
            searchQuery.trim()) && (
            <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
              {filteredMovies.length ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {filteredMovies.map(
                    (movie) => (
                      <MovieCard
                        key={movie.id}
                        movie={movie}
                      />
                    ),
                  )}
                </div>
              ) : (
                <div className="flex min-h-[35vh] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center">
                  <div>
                    <div className="text-4xl">
                      🎬
                    </div>

                    <h2 className="mt-4 text-lg font-black">
                      Nothing found
                    </h2>

                    <p className="mt-2 text-sm text-white/40">
                      Try another search or
                      adjust your filters.
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('')
                        resetFilters()
                      }}
                      className="mt-5 rounded-full bg-red-600 px-5 py-2 text-xs font-black"
                    >
                      Clear Discovery
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

        {!moviesLoading &&
          !moviesError &&
          activeSection === 'home' &&
          !searchQuery.trim() && (
            <div className="pb-16">
              <MovieRow
                title="Trending Now"
                items={trendingMovies}
              />

              <MovieRow
                title="Continue Watching"
                items={continueMovies}
              />

              <MovieRow
                title="Latest Releases"
                items={latestMovies}
              />

              <MovieRow
                title="Action"
                items={actionMovies}
              />

              <MovieRow
                title="Adventure"
                items={adventureMovies}
              />
            </div>
          )}
      </main>

                    {selectedMovie && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() =>
            setSelectedMovie(null)
          }
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="relative aspect-video overflow-hidden bg-black">
              {selectedMovie.poster ? (
                <img
                  src={selectedMovie.poster}
                  alt={selectedMovie.title}
                  className="h-full w-full object-cover opacity-60"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-zinc-900 to-black" />
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-black/20" />

              <button
                type="button"
                onClick={() =>
                  setSelectedMovie(null)
                }
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white hover:bg-white/20"
              >
                ×
              </button>

              <div className="absolute bottom-5 left-5 right-5">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.3em] text-red-500">
                  PMF Flix
                </p>

                <h2 className="text-3xl font-black sm:text-5xl">
                  {selectedMovie.title}
                </h2>
              </div>
            </div>

            <div className="p-5 sm:p-7">
              <div className="flex flex-wrap items-center gap-3 text-xs text-white/50">
                <span>
                  {selectedMovie.year}
                </span>

                {selectedMovie.type && (
                  <span>
                    {selectedMovie.type}
                  </span>
                )}

                {selectedMovie.category && (
                  <span>
                    {selectedMovie.category}
                  </span>
                )}

                {selectedMovie.duration && (
                  <span>
                    {selectedMovie.duration}
                  </span>
                )}

                {selectedMovie.rating && (
                  <span>
                    ★ {selectedMovie.rating}
                  </span>
                )}
              </div>

              {selectedMovie.description && (
                <p className="mt-5 text-sm leading-7 text-white/60">
                  {selectedMovie.description}
                </p>
              )}

              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    startWatching(
                      selectedMovie,
                    )
                  }
                  className="rounded-full bg-white px-6 py-3 text-sm font-black text-black transition hover:bg-white/90"
                >
                  ▶ Play
                </button>

                <button
                  type="button"
                  onClick={() =>
                    toggleMyList(
                      selectedMovie.id,
                    )
                  }
                  className="rounded-full border border-white/10 bg-white/[0.06] px-6 py-3 text-sm font-black text-white transition hover:bg-white/10"
                >
                  {myList.includes(
                    selectedMovie.id,
                  )
                    ? '✓ In My List'
                    : '+ My List'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {watchingMovie && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black">
          <div className="relative h-full w-full">
            <button
              type="button"
              onClick={closeWatching}
              className="absolute right-4 top-4 z-10 rounded-full bg-black/70 px-4 py-2 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20"
            >
              Close
            </button>

            {(() => {
              const videoUrl =
                getVideoUrl(
                  watchingMovie,
                )

              if (!videoUrl) {
                return (
                  <div className="flex h-full items-center justify-center p-6">
                    <div className="max-w-md text-center">
                      <div className="text-5xl">
                        🎬
                      </div>

                      <h2 className="mt-5 text-xl font-black">
                        Video coming soon
                      </h2>

                      <p className="mt-3 text-sm leading-6 text-white/40">
                        No licensed video source
                        is currently available for
                        this title.
                      </p>

                      <button
                        type="button"
                        onClick={
                          closeWatching
                        }
                        className="mt-6 rounded-full bg-red-600 px-6 py-3 text-sm font-black"
                      >
                        Back to PMF
                      </button>
                    </div>
                  </div>
                )
              }

              if (isYouTubeUrl(videoUrl)) {
                let embedUrl = videoUrl

                try {
                  const parsed =
                    new URL(videoUrl)

                  if (
                    parsed.hostname.includes(
                      'youtu.be',
                    )
                  ) {
                    embedUrl = `https://www.youtube.com/embed/${parsed.pathname.replace('/', '')}`
                  } else {
                    const id =
                      parsed.searchParams.get(
                        'v',
                      )

                    if (id) {
                      embedUrl = `https://www.youtube.com/embed/${id}`
                    }
                  }
                } catch {
                  // Keep original URL if parsing fails.
                }

                return (
                  <iframe
                    src={embedUrl}
                    title={watchingMovie.title}
                    className="h-full w-full"
                    allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                )
              }

              return (
                <video
                  key={videoUrl}
                  src={videoUrl}
                  controls
                  autoPlay
                  playsInline
                  className="h-full w-full bg-black object-contain"
                  onError={() => {
                    console.error(
                      'PMF video failed to load:',
                      videoUrl,
                    )
                  }}
                />
              )
            })()}
          </div>
        </div>
      )}

      <footer className="border-t border-white/10 bg-black">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <button
                type="button"
                onClick={goHome}
                className="text-xl font-black"
              >
                PMF
                <span className="text-red-600">
                  LIX
                </span>
              </button>

              <p className="mt-2 text-xs text-white/30">
                Prince Mufasa Flix
              </p>
            </div>

            <div className="text-xs text-white/25">
              Signed in as{' '}
              {session.user.email ??
                'PMF member'}
            </div>
          </div>

          <div className="mt-8 border-t border-white/5 pt-5 text-[10px] leading-5 text-white/20">
            © {new Date().getFullYear()}{' '}
            Prince Mufasa Flix. All rights
            reserved. Content available on PMF
            Flix must be properly licensed,
            owned, or otherwise legally
            authorized for streaming.
          </div>
        </div>
      </footer>
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
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()

      if (!mounted) return

      setSession(currentSession)
      setAuthLoading(false)
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
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="text-3xl font-black">
            PMF
            <span className="text-red-600">
              LIX
            </span>
          </div>

          <div className="mx-auto mt-5 h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-red-600" />

          <p className="mt-4 text-xs text-white/30">
            Preparing your cinematic
            experience...
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
