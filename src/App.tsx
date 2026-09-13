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

  const [myList, setMyList] = useState<number[]>(() => {
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
      (movie) =>
        movie.id === selectedMovie.id,
    )

    if (updatedMovie) {
      setSelectedMovie(updatedMovie)
    }
  }, [movies, selectedMovie?.id])

  useEffect(() => {
    if (!watchingMovie) return

    const updatedMovie = movies.find(
      (movie) =>
        movie.id === watchingMovie.id,
    )

    if (updatedMovie) {
      setWatchingMovie(updatedMovie)
    }
  }, [movies, watchingMovie?.id])

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

      if (filters.minRating) {
        const minimum = Number(
          filters.minRating,
        )
        const rating = Number(
          movie.rating ?? 0,
        )

        if (rating < minimum) return false
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
        className="group relative cursor-pointer overflow-hidden rounded-2xl bg-white/[0.035] ring-1 ring-white/10 transition-all duration-500 hover:-translate-y-2 hover:bg-white/[0.07] hover:ring-white/25 hover:shadow-2xl hover:shadow-red-950/20"
        onClick={() => openMovie(movie)}
      >
        <div className="relative aspect-[2/3] overflow-hidden bg-zinc-950">
          {movie.poster ? (
            <img
              src={movie.poster}
              alt={movie.title}
              loading="lazy"
              className="h-full w-full object-cover transition duration-700 group-hover:scale-110 group-hover:saturate-125"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-4 text-center">
              <span className="text-sm font-bold text-white/30">
                {movie.title}
              </span>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/5 to-transparent opacity-90" />

          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />

          {movie.featured && (
            <span className="absolute left-3 top-3 rounded-full border border-white/10 bg-red-600 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] shadow-lg shadow-red-950/40">
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
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/65 text-lg text-white backdrop-blur-xl transition-all hover:scale-110 hover:bg-red-600"
          >
            {inMyList ? '✓' : '+'}
          </button>

          <div className="absolute bottom-0 left-0 right-0 p-3.5">
            <h3 className="truncate text-sm font-black text-white sm:text-base">
              {movie.title}
            </h3>

            <div className="mt-1.5 flex items-center gap-1.5 overflow-hidden text-[10px] text-white/55">
              <span className="shrink-0">
                {movie.year}
              </span>

              {movie.category && (
                <>
                  <span>•</span>
                  <span className="truncate">
                    {movie.category}
                  </span>
                </>
              )}

              {movie.rating && (
                <>
                  <span>•</span>
                  <span className="shrink-0 text-white/75">
                    ★ {movie.rating}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="absolute bottom-20 left-3 right-3 translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                startWatching(movie)
              }}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-2.5 text-xs font-black text-black shadow-xl"
            >
              ▶ Watch
            </button>
          </div>
        </div>
      </article>
    )
  }

  const MovieRow = ({
    title,
    items,
    eyebrow = 'PMF FLIX',
  }: {
    title: string
    items: Movie[]
    eyebrow?: string
  }) => {
    if (!items.length) return null

    return (
      <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.35em] text-red-500">
              {eyebrow}
            </p>

            <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">
              {title}
            </h2>
          </div>

          <button
            type="button"
            onClick={() =>
              setActiveSection('movies')
            }
            className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-bold text-white/45 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
          >
            Explore →
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
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
      <div className="mb-8 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] p-4 shadow-2xl backdrop-blur-2xl sm:p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-red-500">
              Discovery Engine
            </p>

            <h3 className="mt-1 text-lg font-black text-white">
              Find your next story
            </h3>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-full px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300"
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
                category:
                  event.target.value,
              }))
            }
            className="rounded-xl border border-white/10 bg-black/60 px-3 py-3 text-sm text-white outline-none transition focus:border-red-500/60"
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
            className="rounded-xl border border-white/10 bg-black/60 px-3 py-3 text-sm text-white outline-none transition focus:border-red-500/60"
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
            className="rounded-xl border border-white/10 bg-black/60 px-3 py-3 text-sm text-white outline-none transition focus:border-red-500/60"
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
            className="rounded-xl border border-white/10 bg-black/60 px-3 py-3 text-sm text-white outline-none transition focus:border-red-500/60"
          >
            <option value="">
              Any rating
            </option>
            <option value="5">5+</option>
            <option value="6">6+</option>
            <option value="7">7+</option>
            <option value="8">8+</option>
            <option value="9">9+</option>
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
            className="rounded-xl border border-white/10 bg-black/60 px-3 py-3 text-sm text-white outline-none transition focus:border-red-500/60"
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
    <div className="min-h-screen overflow-x-hidden bg-black text-white">
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-black/75 backdrop-blur-2xl">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center gap-5 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={goHome}
            className="group shrink-0 text-left"
          >
            <div className="text-[21px] font-black tracking-[-0.06em]">
              PMF
              <span className="text-red-600 transition group-hover:text-red-500">
                LIX
              </span>
            </div>

            <div className="hidden text-[7px] font-bold uppercase tracking-[0.28em] text-white/30 sm:block">
              Prince Mufasa Flix
            </div>
          </button>

          <nav className="hidden items-center gap-6 md:flex">
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
                className={`relative py-2 text-sm font-semibold transition ${
                  activeSection === section
                    ? 'text-white'
                    : 'text-white/45 hover:text-white'
                }`}
              >
                {label}

                {activeSection ===
                  section && (
                  <span className="absolute -bottom-1 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-red-600 shadow-lg shadow-red-600/50" />
                )}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden lg:block">
              <div className="relative">
                <input
                  value={searchQuery}
                  onChange={(event) =>
                    setSearchQuery(
                      event.target.value,
                    )
                  }
                  placeholder="Search PMF..."
                  className="w-56 rounded-full border border-white/10 bg-white/[0.045] py-2.5 pl-4 pr-4 text-xs text-white outline-none transition placeholder:text-white/25 focus:w-64 focus:border-white/20 focus:bg-white/[0.07]"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setShowMobileSearch(
                  (current) => !current,
                )
              }
              className="rounded-full border border-white/10 px-3 py-2 text-[10px] font-bold text-white/60 transition hover:bg-white/10 hover:text-white lg:hidden"
            >
              Search
            </button>

            <button
              type="button"
              onClick={() =>
                supabase.auth.signOut()
              }
              className="rounded-full border border-white/10 px-3 py-2 text-[10px] font-bold text-white/55 transition hover:border-red-500/40 hover:bg-red-500/5 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </div>

        {showMobileSearch && (
          <div className="border-t border-white/[0.06] px-4 py-3 lg:hidden">
            <input
              autoFocus
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(
                  event.target.value,
                )
              }
              placeholder="Search movies, genres..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-red-500/50"
            />
          </div>
        )}

        <div className="border-t border-white/[0.04] md:hidden">
          <div className="mx-auto flex max-w-7xl overflow-x-auto px-4 py-2 [scrollbar-width:none]">
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
                className={`mr-6 whitespace-nowrap py-2 text-xs font-bold ${
                  activeSection === section
                    ? 'text-red-500'
                    : 'text-white/40'
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
          <section className="relative min-h-[68vh] overflow-hidden">
            <img
              src={heroImage}
              alt="PMF Cinematic Hero"
              className="absolute inset-0 h-full w-full object-cover object-center"
            />

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_35%,transparent_0%,rgba(0,0,0,.25)_35%,rgba(0,0,0,.9)_100%)]" />

            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/55 to-transparent" />

            <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black via-black/60 to-transparent" />

            <div className="relative mx-auto flex min-h-[68vh] max-w-7xl items-end px-4 pb-16 pt-28 sm:px-6 sm:pb-20 lg:px-8">
              <div className="max-w-2xl">
                <div className="mb-5 flex items-center gap-3">
                  <span className="h-px w-8 bg-red-600" />

                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-red-500">
                    PMF Original Experience
                  </p>
                </div>

                <h1 className="text-5xl font-black leading-[0.9] tracking-[-0.06em] sm:text-7xl lg:text-8xl">
                  Your World.
                  <br />
                  Your Stories.
                  <br />
                  <span className="text-red-600 drop-shadow-[0_0_25px_rgba(229,9,20,.25)]">
                    Your Flix.
                  </span>
                </h1>

                <p className="mt-6 max-w-xl text-sm leading-7 text-white/60 sm:text-base">
                  Discover cinematic stories,
                  unforgettable characters and
                  premium entertainment built
                  for the next generation of
                  African and global audiences.
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
                        className="rounded-full bg-white px-7 py-3.5 text-sm font-black text-black shadow-2xl shadow-black/30 transition hover:scale-105 hover:bg-white/90"
                      >
                        ▶ Play Now
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          openMovie(
                            trendingMovies[0],
                          )
                        }
                        className="rounded-full border border-white/10 bg-white/[0.09] px-7 py-3.5 text-sm font-black text-white backdrop-blur-xl transition hover:scale-105 hover:bg-white/[0.16]"
                      >
                        More Info
                      </button>
                    </>
                  )}
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-4 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                  <span>Premium Cinema</span>
                  <span className="h-1 w-1 rounded-full bg-red-600" />
                  <span>Original Stories</span>
                  <span className="h-1 w-1 rounded-full bg-red-600" />
                  <span>Global Entertainment</span>
                </div>
              </div>
            </div>
          </section>
        )}

      <main>
        <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
          {searchQuery.trim() && (
            <div className="mb-8 rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
              <p className="text-[9px] font-black uppercase tracking-[0.35em] text-red-500">
                PMF Search
              </p>

              <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                Results for “
                {searchQuery.trim()}
                ”
              </h1>
            </div>
          )}

          {activeSection !== 'home' &&
            !searchQuery.trim() && (
              <div className="mb-8 pt-4">
                <p className="text-[9px] font-black uppercase tracking-[0.35em] text-red-500">
                  PMF Catalogue
                </p>

                <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                  {activeSection ===
                  'my-list'
                    ? 'My List'
                    : activeSection ===
                        'series'
                      ? 'TV Series'
                      : 'Movies'}
                </h1>

                <p className="mt-2 max-w-xl text-sm text-white/40">
                  {activeSection ===
                  'my-list'
                    ? 'Your personal collection of stories saved for later.'
                    : 'Explore the PMF catalogue and discover your next story.'}
                </p>
              </div>
            )}

          {(activeSection !== 'home' ||
            searchQuery.trim()) && (
            <div className="mb-5 flex items-center justify-between gap-3">
              <p className="text-xs text-white/35">
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
                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-bold text-white/60 transition hover:border-red-500/30 hover:bg-white/[0.07] hover:text-white"
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
              <div className="relative mx-auto h-12 w-12">
                <div className="absolute inset-0 rounded-full border border-white/10" />
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-red-600" />
              </div>

              <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-white/30">
                Preparing PMF
              </p>
            </div>
          </section>
        )}

        {!moviesLoading && moviesError && (
          <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="rounded-3xl border border-red-500/20 bg-red-500/[0.04] p-10 text-center">
              <div className="text-4xl">
                !
              </div>

              <p className="mt-4 text-sm font-bold text-red-400">
                {moviesError}
              </p>

              <button
                type="button"
                onClick={() =>
                  window.location.reload()
                }
                className="mt-6 rounded-full bg-red-600 px-6 py-3 text-xs font-black text-white transition hover:bg-red-500"
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
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
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
                <div className="flex min-h-[38vh] items-center justify-center rounded-3xl border border-white/10 bg-white/[0.02] p-10 text-center">
                  <div>
                    <div className="text-5xl">
                      🎬
                    </div>

                    <h2 className="mt-5 text-xl font-black">
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
                      className="mt-6 rounded-full bg-red-600 px-6 py-3 text-xs font-black transition hover:bg-red-500"
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
                eyebrow="What's Hot"
              />

              <MovieRow
                title="Continue Watching"
                items={continueMovies}
                eyebrow="Pick Up Where You Left Off"
              />

              <MovieRow
                title="Latest Releases"
                items={latestMovies}
                eyebrow="Fresh On PMF"
              />

              <MovieRow
                title="Action"
                items={actionMovies}
                eyebrow="High Energy"
              />

              <MovieRow
                title="Adventure"
                items={adventureMovies}
                eyebrow="Go Beyond"
              />
            </div>
          )}
      </main>

            {selectedMovie && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 backdrop-blur-xl sm:p-5"
          onClick={() =>
            setSelectedMovie(null)
          }
        >
          <div
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto overflow-hidden rounded-3xl border border-white/10 bg-[#080808] shadow-2xl shadow-black"
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

              <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-black/20 to-black/30" />

              <button
                type="button"
                aria-label="Close movie details"
                onClick={() =>
                  setSelectedMovie(null)
                }
                className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/65 text-xl text-white backdrop-blur-xl transition hover:scale-105 hover:bg-white/20"
              >
                ×
              </button>

              <div className="absolute bottom-6 left-5 right-5 sm:left-8 sm:right-8">
                <p className="mb-2 text-[9px] font-black uppercase tracking-[0.35em] text-red-500">
                  PMF Flix
                </p>

                <h2 className="text-3xl font-black tracking-tight sm:text-5xl">
                  {selectedMovie.title}
                </h2>
              </div>
            </div>

            <div className="p-5 sm:p-8">
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-white/45">
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
                  <span className="text-white/75">
                    ★ {selectedMovie.rating}
                  </span>
                )}
              </div>

              {selectedMovie.description && (
                <p className="mt-6 max-w-3xl text-sm leading-7 text-white/55 sm:text-base">
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
                  className="rounded-full bg-white px-7 py-3 text-sm font-black text-black transition hover:scale-105 hover:bg-white/90"
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
                  className="rounded-full border border-white/10 bg-white/[0.06] px-7 py-3 text-sm font-black text-white transition hover:scale-105 hover:bg-white/[0.1]"
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
            <div className="absolute left-4 top-4 z-10 rounded-full border border-white/10 bg-black/60 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/60 backdrop-blur-xl">
              PMF • Now Playing
            </div>

            <button
              type="button"
              onClick={closeWatching}
              className="absolute right-4 top-4 z-20 rounded-full border border-white/10 bg-black/70 px-4 py-2 text-xs font-bold text-white backdrop-blur-xl transition hover:bg-white/20"
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
                        is currently available
                        for this title.
                      </p>

                      <button
                        type="button"
                        onClick={
                          closeWatching
                        }
                        className="mt-6 rounded-full bg-red-600 px-6 py-3 text-sm font-black transition hover:bg-red-500"
                      >
                        Back to PMF
                      </button>
                    </div>
                  </div>
                )
              }

              if (
                isYouTubeUrl(videoUrl)
              ) {
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
                  // Keep original URL.
                }

                return (
                  <iframe
                    src={embedUrl}
                    title={
                      watchingMovie.title
                    }
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
                  onError={() =>
                    console.error(
                      'PMF video failed to load:',
                      videoUrl,
                    )
                  }
                />
              )
            })()}
          </div>
        </div>
      )}

      <footer className="border-t border-white/[0.08] bg-[#020202]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <button
                type="button"
                onClick={goHome}
                className="text-2xl font-black tracking-[-0.05em]"
              >
                PMF
                <span className="text-red-600">
                  LIX
                </span>
              </button>

              <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.3em] text-white/25">
                Prince Mufasa Flix
              </p>

              <p className="mt-3 max-w-sm text-xs leading-5 text-white/25">
                Your World. Your Stories.
                Your Flix.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-5 py-4 text-xs text-white/30">
              Signed in as
              <br />
              <span className="mt-1 inline-block font-semibold text-white/55">
                {session.user.email ??
                  'PMF member'}
              </span>
            </div>
          </div>

          <div className="mt-10 border-t border-white/[0.05] pt-6 text-[10px] leading-5 text-white/20">
            © {new Date().getFullYear()}{' '}
            Prince Mufasa Flix. All rights
            reserved. Content available on
            PMF Flix must be properly licensed,
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
          <div className="text-3xl font-black tracking-[-0.05em]">
            PMF
            <span className="text-red-600">
              LIX
            </span>
          </div>

          <div className="relative mx-auto mt-6 h-9 w-9">
            <div className="absolute inset-0 rounded-full border border-white/10" />
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-red-600" />
          </div>

          <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.25em] text-white/25">
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
