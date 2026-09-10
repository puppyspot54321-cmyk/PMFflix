import heroImage from './assets/hero.png'
import { useEffect, useMemo, useState } from 'react'
import type { Movie } from './movieData/movies'
import { getMovies } from './services/movieService'
import { mapCanonicalMovieToLegacy } from './utils/movieMapper'
import { supabase } from './supabase'
import type { Session } from '@supabase/supabase-js'
import AuthScreen from './Auth'

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

  const [movies, setMovies] =
    useState<Movie[]>([])

  const [moviesLoading, setMoviesLoading] =
    useState(true)

  const [moviesError, setMoviesError] =
    useState('')

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

  const [myList, setMyList] =
    useState<number[]>(() => {
      try {
        const saved =
          localStorage.getItem(
            'pmf-my-list',
          )

        if (!saved) return []

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
    })

  const [continueWatching, setContinueWatching] =
    useState<number[]>(() => {
      try {
        const saved =
          localStorage.getItem(
            'pmf-continue-watching',
          )

        if (!saved) return []

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
      .subscribe((status) => {
        console.log(
          'PMF movie realtime status:',
          status,
        )
      })

    return () => {
      mounted = false
      void supabase.removeChannel(
        channel,
      )
    }
  }, [])

  const saveMyList = (
    list: number[],
  ) => {
    try {
      localStorage.setItem(
        'pmf-my-list',
        JSON.stringify(list),
      )
    } catch {
      // Ignore localStorage failures.
    }
  }

  const toggleMyList = (
    movieId: number,
  ) => {
    setMyList((current) => {
      const updated =
        current.includes(movieId)
          ? current.filter(
              (id) => id !== movieId,
            )
          : [
              ...current,
              movieId,
            ]

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
        // Ignore localStorage failures.
      }

      return updated
    })
  }

  const getVideoUrl = (
    movie: Movie,
  ) => {
    if (
      movie.videoUrl &&
      movie.videoUrl.trim() !== ''
    ) {
      return movie.videoUrl.trim()
    }

    if (
      movie.title
        .trim()
        .toLowerCase() ===
      'the journey'
    ) {
      return '/movies/the-journey.mp4'
    }

    return ''
  }

  const isYouTubeUrl = (
    url: string,
  ) =>
    /youtube\.com|youtu\.be/i.test(
      url,
    )

  const openMovie = (
    movie: Movie,
  ) => {
    setSelectedMovie(movie)
  }

  const startWatching = (
    movie: Movie,
  ) => {
    if (!movie) return

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

  const navigateTo = (
    section: Section,
  ) => {
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
      if (event.key !== 'Escape') {
        return
      }

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
  }, [
    watchingMovie,
    selectedMovie,
  ])

  useEffect(() => {
    if (!selectedMovie) return

    const updatedMovie =
      movies.find(
        (movie) =>
          movie.id ===
          selectedMovie.id,
      )

    if (updatedMovie) {
      setSelectedMovie(
        updatedMovie,
      )
    }
  }, [
    movies,
    selectedMovie?.id,
  ])

  useEffect(() => {
    if (!watchingMovie) return

    const updatedMovie =
      movies.find(
        (movie) =>
          movie.id ===
          watchingMovie.id,
      )

    if (updatedMovie) {
      setWatchingMovie(
        updatedMovie,
      )
    }
  }, [
    movies,
    watchingMovie?.id,
  ])

  const categoryOptions = useMemo(() => {
    return Array.from(
      new Set(
        movies
          .map((movie) =>
            movie.category?.trim(),
          )
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
          .map((movie) =>
            movie.type?.trim(),
          )
          .filter(
            (type): type is string =>
              Boolean(type),
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
        movie.category !==
          filters.category
      ) {
        return false
      }

      if (
        filters.type &&
        movie.type !==
          filters.type
      ) {
        return false
      }

      if (
        filters.year &&
        String(movie.year) !==
          filters.year
      ) {
        return false
      }

      if (filters.minRating) {
        const minimum =
          Number(
            filters.minRating,
          )

        const numericRating =
          typeof movie.rating ===
          'number'
            ? movie.rating
            : Number(
                String(
                  movie.rating ??
                    '',
                ).replace(
                  /[^\d.]/g,
                  '',
                ),
              )

        if (
          Number.isFinite(
            numericRating,
          ) &&
          numericRating <
            minimum
        ) {
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

        if (
          !searchable.includes(
            query,
          )
        ) {
          return false
        }
      }

      return true
    })

    result = [...result].sort(
      (a, b) => {
        switch (filters.sort) {
          case 'newest':
            return (
              b.year - a.year
            )

          case 'oldest':
            return (
              a.year - b.year
            )

          case 'rating': {
            const ratingA =
              typeof a.rating ===
              'number'
                ? a.rating
                : Number(
                    String(
                      a.rating ??
                        '',
                    ).replace(
                      /[^\d.]/g,
                      '',
                    ),
                  )

            const ratingB =
              typeof b.rating ===
              'number'
                ? b.rating
                : Number(
                    String(
                      b.rating ??
                        '',
                    ).replace(
                      /[^\d.]/g,
                      '',
                    ),
                  )

            return (
              (Number.isFinite(
                ratingB,
              )
                ? ratingB
                : 0) -
              (Number.isFinite(
                ratingA,
              )
                ? ratingA
                : 0)
            )
          }

          case 'title':
            return a.title.localeCompare(
              b.title,
            )

          case 'featured':
          default:
            return (
              Number(
                Boolean(
                  b.featured,
                ),
              ) -
              Number(
                Boolean(
                  a.featured,
                ),
              )
            )
        }
      },
    )

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
        (movie) =>
          movie.featured,
      ),
    [movies],
  )

  const latestMovies = useMemo(
    () =>
      [...movies].sort(
        (a, b) =>
          b.year - a.year,
      ),
    [movies],
  )

  const actionMovies = useMemo(
    () =>
      movies.filter(
        (movie) =>
          movie.category
            ?.toLowerCase()
            .includes(
              'action',
            ),
      ),
    [movies],
  )

  const adventureMovies = useMemo(
    () =>
      movies.filter(
        (movie) =>
          movie.category
            ?.toLowerCase()
            .includes(
              'adventure',
            ),
      ),
    [movies],
  )

  const continueMovies = useMemo(
    () =>
      continueWatching
        .map((id) =>
          movies.find(
            (movie) =>
              movie.id === id,
          ),
        )
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
    Boolean(
      filters.category,
    ) ||
    Boolean(filters.type) ||
    Boolean(filters.year) ||
    Boolean(
      filters.minRating,
    ) ||
    filters.sort !==
      'featured'

  const MovieCard = ({
    movie,
  }: {
    movie: Movie
  }) => {
    const inMyList = myList.includes(movie.id)

    return (
      <article className="group relative overflow-hidden rounded-2xl bg-white/5 shadow-lg ring-1 ring-white/10 transition duration-300 hover:-translate-y-1 hover:shadow-2xl">
        <button
          type="button"
          onClick={() => openMovie(movie)}
          className="block w-full text-left"
        >
          <div className="relative aspect-[2/3] overflow-hidden bg-black">
            <img
              src={movie.poster}
              alt={movie.title}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              loading="lazy"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent opacity-80" />

            {movie.featured && (
              <span className="absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-black">
                Featured
              </span>
            )}

            <div className="absolute bottom-3 left-3 right-3">
              <h3 className="line-clamp-1 text-base font-bold text-white">
                {movie.title}
              </h3>

              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/70">
                <span>{movie.year}</span>

                {movie.type && (
                  <>
                    <span>•</span>
                    <span>{movie.type}</span>
                  </>
                )}

                {movie.category && (
                  <>
                    <span>•</span>
                    <span>{movie.category}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </button>

        <div className="flex items-center justify-between gap-2 border-t border-white/10 bg-black/40 p-2">
          <button
            type="button"
            onClick={() => openMovie(movie)}
            className="min-w-0 flex-1 rounded-lg px-3 py-2 text-left text-xs font-semibold text-white transition hover:bg-white/10"
          >
            View Details
          </button>

          <button
            type="button"
            onClick={() =>
              toggleMyList(movie.id)
            }
            className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
            aria-label={
              inMyList
                ? `Remove ${movie.title} from My List`
                : `Add ${movie.title} to My List`
            }
          >
            {inMyList
              ? '✓ Saved'
              : '+ List'}
          </button>
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
    if (items.length === 0) {
      return null
    }

    return (
      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              {title}
            </h2>
            <div className="mt-1 h-1 w-10 rounded-full bg-white/80" />
          </div>

          <span className="text-xs text-white/40">
            {items.length}{' '}
            {items.length === 1
              ? 'title'
              : 'titles'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((movie) => (
            <MovieCard
              key={movie.id}
              movie={movie}
            />
          ))}
        </div>
      </section>
    )
  }

  const heroMovie =
    movies.find(
      (movie) =>
        movie.featured,
    ) ?? movies[0]

  const searchResults =
    searchQuery.trim() !== ''
      ? filteredMovies
      : []

  const visibleMovies =
    activeSection === 'home'
      ? movies
      : filteredMovies

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#050505]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={goHome}
            className="flex shrink-0 items-center gap-2"
            aria-label="PMF Flix home"
          >
            <span className="text-xl font-black tracking-tighter text-white sm:text-2xl">
              PMF
            </span>
            <span className="hidden text-sm font-semibold tracking-[0.2em] text-white/50 sm:inline">
              FLIX
            </span>
          </button>

          <nav className="hidden items-center gap-1 md:flex">
            {(
              [
                ['home', 'Home'],
                ['movies', 'Movies'],
                ['series', 'TV Series'],
                ['my-list', 'My List'],
              ] as const
            ).map(
              ([
                section,
                label,
              ]) => (
                <button
                  key={section}
                  type="button"
                  onClick={() =>
                    navigateTo(
                      section,
                    )
                  }
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    activeSection ===
                    section
                      ? 'bg-white text-black'
                      : 'text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ),
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center rounded-xl border border-white/10 bg-white/5 px-3 md:flex">
              <span className="mr-2 text-white/40">
                🔎
              </span>

              <input
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(
                    event.target.value,
                  )
                }
                placeholder="Search movies..."
                className="w-40 bg-transparent py-2 text-sm text-white outline-none placeholder:text-white/30 lg:w-56"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                setShowMobileSearch(
                  (value) =>
                    !value,
                )
              }
              className="rounded-lg p-2 text-white/70 transition hover:bg-white/10 hover:text-white md:hidden"
              aria-label="Search"
            >
              🔎
            </button>

            <button
              type="button"
              onClick={() =>
                setShowFilters(
                  (value) =>
                    !value,
                )
              }
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                showFilters ||
                hasActiveFilters
                  ? 'bg-white text-black'
                  : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              Filters
            </button>

            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut()
              }}
              className="hidden rounded-lg bg-white/5 px-3 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/10 hover:text-white sm:block"
            >
              Sign Out
            </button>
          </div>
        </div>

        {showMobileSearch && (
          <div className="border-t border-white/10 px-4 py-3 md:hidden">
            <input
              autoFocus
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(
                  event.target.value,
                )
              }
              placeholder="Search movies..."
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
            />
          </div>
        )}

        {showFilters && (
          <div className="border-t border-white/10 bg-black/80 px-4 py-4 sm:px-6 lg:px-8">
            <div className="mx-auto grid max-w-[1600px] gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <select
                value={filters.category}
                onChange={(event) =>
                  setFilters(
                    (current) => ({
                      ...current,
                      category:
                        event.target
                          .value,
                    }),
                  )
                }
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none"
              >
                <option
                  value=""
                  className="bg-black"
                >
                  All Genres
                </option>

                {categoryOptions.map(
                  (category) => (
                    <option
                      key={category}
                      value={category}
                      className="bg-black"
                    >
                      {category}
                    </option>
                  ),
                )}
              </select>

              <select
                value={filters.type}
                onChange={(event) =>
                  setFilters(
                    (current) => ({
                      ...current,
                      type:
                        event.target
                          .value,
                    }),
                  )
                }
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none"
              >
                <option
                  value=""
                  className="bg-black"
                >
                  All Types
                </option>

                {typeOptions.map(
                  (type) => (
                    <option
                      key={type}
                      value={type}
                      className="bg-black"
                    >
                      {type}
                    </option>
                  ),
                )}
              </select>

              <select
                value={filters.year}
                onChange={(event) =>
                  setFilters(
                    (current) => ({
                      ...current,
                      year:
                        event.target
                          .value,
                    }),
                  )
                }
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none"
              >
                <option
                  value=""
                  className="bg-black"
                >
                  All Years
                </option>

                {yearOptions.map(
                  (year) => (
                    <option
                      key={year}
                      value={year}
                      className="bg-black"
                    >
                      {year}
                    </option>
                  ),
                )}
              </select>

              <select
                value={filters.minRating}
                onChange={(event) =>
                  setFilters(
                    (current) => ({
                      ...current,
                      minRating:
                        event.target
                          .value,
                    }),
                  )
                }
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none"
              >
                <option
                  value=""
                  className="bg-black"
                >
                  Any Rating
                </option>

                <option
                  value="5"
                  className="bg-black"
                >
                  5+
                </option>

                <option
                  value="6"
                  className="bg-black"
                >
                  6+
                </option>

                <option
                  value="7"
                  className="bg-black"
                >
                  7+
                </option>

                <option
                  value="8"
                  className="bg-black"
                >
                  8+
                </option>
              </select>

              <select
                value={filters.sort}
                onChange={(event) =>
                  setFilters(
                    (current) => ({
                      ...current,
                      sort:
                        event.target
                          .value as SortMode,
                    }),
                  )
                }
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none"
              >
                <option
                  value="featured"
                  className="bg-black"
                >
                  Featured
                </option>

                <option
                  value="newest"
                  className="bg-black"
                >
                  Newest
                </option>

                <option
                  value="oldest"
                  className="bg-black"
                >
                  Oldest
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
                  A–Z
                </option>
              </select>
            </div>

            <div className="mx-auto mt-3 flex max-w-[1600px] justify-end">
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-lg px-3 py-2 text-xs font-semibold text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                Reset Filters
              </button>
            </div>
          </div>
        )}
      </header>

        <main className="mx-auto max-w-[1600px] px-4 pb-20 sm:px-6 lg:px-8">
    {activeSection === 'home' &&
      !searchQuery.trim() &&
      heroMovie && (
        <section className="relative -mx-4 min-h-[520px] overflow-hidden sm:-mx-6 lg:-mx-8 lg:min-h-[620px]">
          <img
            src={heroImage}
            alt="PMF Cinematic Hero"
            className="absolute inset-0 h-full w-full object-cover"
          />

          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-black/20" />

          <div className="relative flex min-h-[520px] items-end px-4 pb-12 sm:px-6 lg:min-h-[620px] lg:px-8 lg:pb-16">
            <div className="max-w-2xl">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-white/50">
                PMF Flix Original
              </p>

              <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl">
                {heroMovie.title}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/70">
                <span>{heroMovie.year}</span>
                <span>•</span>
                <span>{heroMovie.type}</span>

                {heroMovie.category && (
                  <>
                    <span>•</span>
                    <span>{heroMovie.category}</span>
                  </>
                )}

                {heroMovie.duration && (
                  <>
                    <span>•</span>
                    <span>{heroMovie.duration}</span>
                  </>
                )}

                {heroMovie.rating && (
                  <>
                    <span>•</span>
                    <span>{heroMovie.rating}</span>
                  </>
                )}
              </div>

              <p className="mt-5 max-w-xl text-sm leading-7 text-white/65 sm:text-base">
                {heroMovie.description}
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    startWatching(heroMovie)
                  }
                  className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-white/85"
                >
                  ▶ Play Now
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openMovie(heroMovie)
                  }
                  className="rounded-xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15"
                >
                  More Info
                </button>

                <button
                  type="button"
                  onClick={() =>
                    toggleMyList(
                      heroMovie.id,
                    )
                  }
                  className="rounded-xl border border-white/15 bg-black/30 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/10"
                >
                  {myList.includes(
                    heroMovie.id,
                  )
                    ? '✓ In My List'
                    : '+ My List'}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

    {searchQuery.trim() && (
      <section className="pt-8">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/40">
            Search
          </p>

          <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
            Results for “{searchQuery.trim()}”
          </h1>
        </div>

        {searchResults.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {searchResults.map(
              (movie) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                />
              ),
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center">
            <p className="text-lg font-semibold text-white">
              No titles found
            </p>

            <p className="mt-2 text-sm text-white/40">
              Try another movie, genre, year, or title.
            </p>
          </div>
        )}
      </section>
    )}

    {!searchQuery.trim() &&
      activeSection === 'home' && (
        <>
          <MovieRow
            title="Trending Now"
            items={trendingMovies}
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

          <MovieRow
            title="Continue Watching"
            items={continueMovies}
          />
        </>
      )}

    {!searchQuery.trim() &&
      activeSection !== 'home' && (
        <section className="pt-8">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/40">
                PMF Catalogue
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
                {activeSection ===
                'movies'
                  ? 'Movies'
                  : activeSection ===
                      'series'
                    ? 'TV Series'
                    : 'My List'}
              </h1>
            </div>

            <p className="text-sm text-white/40">
              {visibleMovies.length}{' '}
              {visibleMovies.length ===
              1
                ? 'title'
                : 'titles'}
            </p>
          </div>

          {moviesLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {Array.from({
                length: 6,
              }).map((_, index) => (
                <div
                  key={index}
                  className="aspect-[2/3] animate-pulse rounded-2xl bg-white/5"
                />
              ))}
            </div>
          ) : visibleMovies.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {visibleMovies.map(
                (movie) => (
                  <MovieCard
                    key={movie.id}
                    movie={movie}
                  />
                ),
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center">
              <p className="text-lg font-semibold text-white">
                {activeSection ===
                'my-list'
                  ? 'Your My List is empty'
                  : 'No titles found'}
              </p>

              <p className="mt-2 text-sm text-white/40">
                {activeSection ===
                'my-list'
                  ? 'Add movies to My List and they will appear here.'
                  : 'Try changing your filters or search terms.'}
              </p>
            </div>
          )}
        </section>
      )}

    {moviesError && (
      <div className="mt-8 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
        {moviesError}
      </div>
    )}
  </main>

  {selectedMovie && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          setSelectedMovie(null)
        }
      }}
    >
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-[#111] shadow-2xl">
        <button
          type="button"
          onClick={() =>
            setSelectedMovie(null)
          }
          className="absolute right-4 top-4 z-10 rounded-full bg-black/60 px-3 py-2 text-sm text-white backdrop-blur hover:bg-black"
          aria-label="Close movie details"
        >
          ✕
        </button>

        <div className="relative aspect-[16/8] overflow-hidden bg-black">
          <img
            src={selectedMovie.poster}
            alt={selectedMovie.title}
            className="h-full w-full object-cover opacity-60"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-transparent to-transparent" />

          <div className="absolute bottom-5 left-5 right-5 sm:left-8 sm:right-8">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/50">
              {selectedMovie.type}
            </p>

            <h2 className="mt-2 text-3xl font-black text-white sm:text-4xl">
              {selectedMovie.title}
            </h2>
          </div>
        </div>

        <div className="space-y-5 p-5 sm:p-8">
          <div className="flex flex-wrap gap-2 text-xs text-white/60">
            <span className="rounded-full bg-white/5 px-3 py-1.5">
              {selectedMovie.year}
            </span>

            {selectedMovie.category && (
              <span className="rounded-full bg-white/5 px-3 py-1.5">
                {selectedMovie.category}
              </span>
            )}

            {selectedMovie.duration && (
              <span className="rounded-full bg-white/5 px-3 py-1.5">
                {selectedMovie.duration}
              </span>
            )}

            {selectedMovie.rating && (
              <span className="rounded-full bg-white/5 px-3 py-1.5">
                {selectedMovie.rating}
              </span>
            )}
          </div>

          <p className="text-sm leading-7 text-white/65 sm:text-base">
            {selectedMovie.description}
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                startWatching(
                  selectedMovie,
                )
              }
              className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-white/85"
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
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              {myList.includes(
                selectedMovie.id,
              )
                ? '✓ In My List'
                : '+ My List'}
            </button>

            <button
              type="button"
              onClick={() =>
                setSelectedMovie(null)
              }
              className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-white/60 transition hover:bg-white/5 hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )}

    {watchingMovie && (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black p-0">
      <button
        type="button"
        onClick={closeWatching}
        className="absolute right-4 top-4 z-20 rounded-full bg-white/10 px-4 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
      >
        ✕ Close
      </button>

      <div className="w-full max-w-6xl px-4">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
          {(() => {
            const videoUrl =
              getVideoUrl(watchingMovie)

            if (!videoUrl) {
              return (
                <div className="flex aspect-video items-center justify-center bg-[#111] p-8 text-center">
                  <div>
                    <p className="text-lg font-bold text-white">
                      Video unavailable
                    </p>

                    <p className="mt-2 text-sm text-white/40">
                      This title does not have a playable video yet.
                    </p>
                  </div>
                </div>
              )
            }

            if (isYouTubeUrl(videoUrl)) {
              const embedUrl = videoUrl
                .replace(
                  'watch?v=',
                  'embed/',
                )
                .replace(
                  'youtu.be/',
                  'youtube.com/embed/',
                )
                .split('&')[0]

              return (
                <iframe
                  src={embedUrl}
                  title={watchingMovie.title}
                  className="aspect-video w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              )
            }

            return (
              <video
                key={videoUrl}
                src={videoUrl}
                controls
                playsInline
                className="aspect-video w-full bg-black"
                autoPlay
              />
            )
          })()}
        </div>

        <div className="mt-4">
          <h2 className="text-xl font-bold text-white">
            {watchingMovie.title}
          </h2>

          <p className="mt-1 text-sm text-white/40">
            {watchingMovie.year} • {watchingMovie.type}
          </p>
        </div>
      </div>
    </div>
    )}

    </main>
  </div>
  )
}

function AuthenticatedAppFooter() {
  return (
    <footer className="border-t border-white/10 bg-black px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 text-center text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <div>
          <span className="font-bold text-white/60">
            PMF FLIX
          </span>

          <span className="ml-2">
            Your World. Your Stories. Your Flix.
          </span>
        </div>

        <span>
          © {new Date().getFullYear()} PMF Flix
        </span>
      </div>
    </footer>
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
        data,
        error,
      } = await supabase.auth.getSession()

      if (!mounted) return

      if (error) {
        console.error(
          'PMF auth session error:',
          error,
        )
      }

      setSession(data.session)
      setAuthLoading(false)
    }

    void loadSession()

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        (_event, nextSession) => {
          if (!mounted) return

          setSession(nextSession)
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
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />

          <p className="mt-4 text-sm text-white/50">
            Loading PMF Flix...
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
      <AuthenticatedApp
        session={session}
      />

      <AuthenticatedAppFooter />
    </>
  )
}
