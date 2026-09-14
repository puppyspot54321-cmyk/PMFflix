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

type UserProfile = {
  name: string
  avatar: string
}

type WatchHistoryItem = {
  movieId: string
  watchedAt: number
}

const PROFILE_STORAGE_KEY = 'pmf-profile'
const MY_LIST_STORAGE_KEY = 'pmf-my-list'
const CONTINUE_STORAGE_KEY = 'pmf-continue-watching'
const HISTORY_STORAGE_KEY = 'pmf-watch-history'

const defaultProfile: UserProfile = {
  name: 'PMF Member',
  avatar: '🎬',
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
    useState<string | null>(null)

  const [showMobileSearch, setShowMobileSearch] =
    useState(false)

  const [showFilters, setShowFilters] =
    useState(false)

  const [showProfile, setShowProfile] =
    useState(false)

  const [profile, setProfile] =
    useState<UserProfile>(() => {
      try {
        const saved = localStorage.getItem(
          PROFILE_STORAGE_KEY,
        )

        return saved
          ? {
              ...defaultProfile,
              ...JSON.parse(saved),
            }
          : defaultProfile
      } catch {
        return defaultProfile
      }
    })

  const [myList, setMyList] = useState<string[]>(
    () => {
      try {
        return JSON.parse(
          localStorage.getItem(
            MY_LIST_STORAGE_KEY,
          ) || '[]',
        )
      } catch {
        return []
      }
    },
  )

  const [continueWatching, setContinueWatching] =
    useState<string[]>(() => {
      try {
        return JSON.parse(
          localStorage.getItem(
            CONTINUE_STORAGE_KEY,
          ) || '[]',
        )
      } catch {
        return []
      }
    })

  const [watchHistory, setWatchHistory] =
    useState<WatchHistoryItem[]>(() => {
      try {
        return JSON.parse(
          localStorage.getItem(
            HISTORY_STORAGE_KEY,
          ) || '[]',
        )
      } catch {
        return []
      }
    })

  const [filters, setFilters] =
    useState<DiscoveryFilters>({
      category: 'All',
      type: 'All',
      year: 'All',
      minRating: '0',
      sort: 'featured',
    })

  useEffect(() => {
    localStorage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify(profile),
    )
  }, [profile])

  useEffect(() => {
    localStorage.setItem(
      MY_LIST_STORAGE_KEY,
      JSON.stringify(myList),
    )
  }, [myList])

  useEffect(() => {
    localStorage.setItem(
      CONTINUE_STORAGE_KEY,
      JSON.stringify(continueWatching),
    )
  }, [continueWatching])

  useEffect(() => {
    localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify(watchHistory),
    )
  }, [watchHistory])

  useEffect(() => {
    let mounted = true

    const loadMovies = async () => {
      try {
        setMoviesLoading(true)
        setMoviesError(null)

        const result = await getMovies()

        if (!mounted) return

        const mapped = result.map(
          mapCanonicalMovieToLegacy,
        )

        setMovies(mapped)
      } catch (error) {
        console.error(
          'PMF movie catalogue error:',
          error,
        )

        if (mounted) {
          setMoviesError(
            'We could not load the PMF catalogue right now.',
          )
        }
      } finally {
        if (mounted) {
          setMoviesLoading(false)
        }
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

  const saveProfile = (
    nextProfile: UserProfile,
  ) => {
    setProfile(nextProfile)
    setShowProfile(false)
  }

  const toggleMyList = (movieId: string) => {
    setMyList((current) =>
      current.includes(movieId)
        ? current.filter((id) => id !== movieId)
        : [movieId, ...current],
    )
  }

  const addToContinueWatching = (
    movieId: string,
  ) => {
    setContinueWatching((current) => [
      movieId,
      ...current.filter((id) => id !== movieId),
    ])
  }

  const addToHistory = (movieId: string) => {
    setWatchHistory((current) => [
      {
        movieId,
        watchedAt: Date.now(),
      },
      ...current.filter(
        (item) => item.movieId !== movieId,
      ),
    ].slice(0, 50))
  }

  const getMovieById = (movieId: string) =>
    movies.find((movie) => movie.id === movieId)

  const getVideoUrl = (movie: Movie) =>
    movie.videoUrl || ''

  const isYouTubeUrl = (url: string) =>
    /youtube\.com|youtu\.be/i.test(url)

  const openMovie = (movie: Movie) => {
    setSelectedMovie(movie)
  }

  const startWatching = (movie: Movie) => {
    setSelectedMovie(null)
    setWatchingMovie(movie)

    addToContinueWatching(movie.id)
    addToHistory(movie.id)
  }

  const closeWatching = () => {
    setWatchingMovie(null)
  }

  const goHome = () => {
    setActiveSection('home')
    setSearchQuery('')
    setSelectedMovie(null)
    setShowMobileSearch(false)
    setShowFilters(false)
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  const navigateTo = (section: Section) => {
    setActiveSection(section)
    setSearchQuery('')
    setSelectedMovie(null)
    setShowMobileSearch(false)
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return

      setSelectedMovie(null)
      setWatchingMovie(null)
      setShowProfile(false)
      setShowFilters(false)
    }

    window.addEventListener(
      'keydown',
      handleEscape,
    )

    return () =>
      window.removeEventListener(
        'keydown',
        handleEscape,
      )
  }, [])

  useEffect(() => {
    if (!selectedMovie) return

    const refreshed = movies.find(
      (movie) => movie.id === selectedMovie.id,
    )

    if (refreshed) {
      setSelectedMovie(refreshed)
    }
  }, [movies, selectedMovie])

  useEffect(() => {
    if (!watchingMovie) return

    const refreshed = movies.find(
      (movie) => movie.id === watchingMovie.id,
    )

    if (refreshed) {
      setWatchingMovie(refreshed)
    }
  }, [movies, watchingMovie])

  const categories = useMemo(() => {
    const values = movies
      .map((movie) => movie.genre)
      .filter(Boolean)

    return [
      'All',
      ...Array.from(new Set(values)),
    ]
  }, [movies])

  const years = useMemo(() => {
    const values = movies
      .map((movie) => String(movie.year))
      .filter(Boolean)

    return [
      'All',
      ...Array.from(new Set(values)).sort(
        (a, b) => Number(b) - Number(a),
      ),
    ]
  }, [movies])

  const filteredMovies = useMemo(() => {
    let result = [...movies]

    const query = searchQuery
      .trim()
      .toLowerCase()

    if (query) {
      result = result.filter((movie) =>
        [
          movie.title,
          movie.genre,
          movie.description,
          movie.year,
          movie.type,
        ]
          .join(' ')
          .toLowerCase()
          .includes(query),
      )
    }

    if (activeSection === 'movies') {
      result = result.filter(
        (movie) =>
          String(movie.type).toLowerCase() !==
          'series',
      )
    }

    if (activeSection === 'series') {
      result = result.filter(
        (movie) =>
          String(movie.type).toLowerCase() ===
          'series',
      )
    }

    if (activeSection === 'my-list') {
      result = result.filter((movie) =>
        myList.includes(movie.id),
      )
    }

    if (
      filters.category !== 'All'
    ) {
      result = result.filter(
        (movie) =>
          movie.genre === filters.category,
      )
    }

    if (filters.type !== 'All') {
      result = result.filter(
        (movie) =>
          String(movie.type) === filters.type,
      )
    }

    if (filters.year !== 'All') {
      result = result.filter(
        (movie) =>
          String(movie.year) === filters.year,
      )
    }

    if (filters.minRating !== '0') {
      const minimum =
        Number(filters.minRating)

      result = result.filter((movie) => {
        const rating = Number(
          String(movie.rating).replace(
            /[^0-9.]/g,
            '',
          ),
        )

        return rating >= minimum
      })
    }

    switch (filters.sort) {
      case 'newest':
        result.sort(
          (a, b) =>
            Number(b.year) - Number(a.year),
        )
        break

      case 'oldest':
        result.sort(
          (a, b) =>
            Number(a.year) - Number(b.year),
        )
        break

      case 'rating':
        result.sort(
          (a, b) =>
            Number(
              String(b.rating).replace(
                /[^0-9.]/g,
                '',
              ),
            ) -
            Number(
              String(a.rating).replace(
                /[^0-9.]/g,
                '',
              ),
            ),
        )
        break

      case 'title':
        result.sort((a, b) =>
          a.title.localeCompare(b.title),
        )
        break

      default:
        break
    }

    return result
  }, [
    movies,
    searchQuery,
    activeSection,
    myList,
    filters,
  ])

  const trendingMovies = useMemo(
    () => movies.slice(0, 10),
    [movies],
  )

  const latestMovies = useMemo(
    () =>
      [...movies].sort(
        (a, b) =>
          Number(b.year) - Number(a.year),
      ),
    [movies],
  )

  const continueMovies = useMemo(
    () =>
      continueWatching
        .map(getMovieById)
        .filter(
          (movie): movie is Movie =>
            Boolean(movie),
        ),
    [continueWatching, movies],
  )

  const historyMovies = useMemo(
    () =>
      [...watchHistory]
        .sort(
          (a, b) =>
            b.watchedAt - a.watchedAt,
        )
        .map((item) =>
          getMovieById(item.movieId),
        )
        .filter(
          (movie): movie is Movie =>
            Boolean(movie),
        ),
    [watchHistory, movies],
  )

  const myListMovies = useMemo(
    () =>
      myList
        .map(getMovieById)
        .filter(
          (movie): movie is Movie =>
            Boolean(movie),
        ),
    [myList, movies],
  )

  const personalizedMovies = useMemo(() => {
    if (!movies.length) return []

    const watchedIds = new Set(
      watchHistory.map(
        (item) => item.movieId,
      ),
    )

    const favoriteGenres = historyMovies
      .flatMap((movie) =>
        String(movie.genre || '')
          .split(',')
          .map((genre) =>
            genre.trim().toLowerCase(),
          ),
      )
      .filter(Boolean)

    return [...movies]
      .filter(
        (movie) =>
          !watchedIds.has(movie.id),
      )
      .sort((a, b) => {
        const aGenres = String(
          a.genre || '',
        )
          .split(',')
          .map((genre) =>
            genre.trim().toLowerCase(),
          )

        const bGenres = String(
          b.genre || '',
        )
          .split(',')
          .map((genre) =>
            genre.trim().toLowerCase(),
          )

        const aScore =
          aGenres.filter((genre) =>
            favoriteGenres.includes(genre),
          ).length

        const bScore =
          bGenres.filter((genre) =>
            favoriteGenres.includes(genre),
          ).length

        return bScore - aScore
      })
      .slice(0, 10)
  }, [movies, watchHistory, historyMovies])

  const actionMovies = useMemo(
    () =>
      movies.filter((movie) =>
        String(movie.genre)
          .toLowerCase()
          .includes('action'),
      ),
    [movies],
  )

  const adventureMovies = useMemo(
    () =>
      movies.filter((movie) =>
        String(movie.genre)
          .toLowerCase()
          .includes('adventure'),
      ),
    [movies],
  )

  const relatedMovies = useMemo(() => {
    if (!selectedMovie) return []

    const genres = String(
      selectedMovie.genre || '',
    )
      .split(',')
      .map((genre) =>
        genre.trim().toLowerCase(),
      )
      .filter(Boolean)

    return movies
      .filter(
        (movie) =>
          movie.id !== selectedMovie.id,
      )
      .filter((movie) => {
        const movieGenres = String(
          movie.genre || '',
        )
          .split(',')
          .map((genre) =>
            genre.trim().toLowerCase(),
          )

        return movieGenres.some((genre) =>
          genres.includes(genre),
        )
      })
      .slice(0, 8)
  }, [movies, selectedMovie])

  const resetFilters = () => {
    setFilters({
      category: 'All',
      type: 'All',
      year: 'All',
      minRating: '0',
      sort: 'featured',
    })
  }

  const FilterPanel = () => (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-xl">
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
          className="rounded-xl border border-white/10 bg-black px-3 py-3 text-xs text-white outline-none"
        >
          {categories.map((category) => (
            <option
              key={category}
              value={category}
            >
              {category}
            </option>
          ))}
        </select>

        <select
          value={filters.type}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              type: event.target.value,
            }))
          }
          className="rounded-xl border border-white/10 bg-black px-3 py-3 text-xs text-white outline-none"
        >
          <option value="All">All Types</option>
          <option value="Movie">Movies</option>
          <option value="Series">Series</option>
        </select>

        <select
          value={filters.year}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              year: event.target.value,
            }))
          }
          className="rounded-xl border border-white/10 bg-black px-3 py-3 text-xs text-white outline-none"
        >
          {years.map((year) => (
            <option
              key={year}
              value={year}
            >
              {year === 'All'
                ? 'All Years'
                : year}
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
          className="rounded-xl border border-white/10 bg-black px-3 py-3 text-xs text-white outline-none"
        >
          <option value="0">
            Any Rating
          </option>
          <option value="5">
            5+ Rating
          </option>
          <option value="7">
            7+ Rating
          </option>
          <option value="8">
            8+ Rating
          </option>
          <option value="9">
            9+ Rating
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
          className="rounded-xl border border-white/10 bg-black px-3 py-3 text-xs text-white outline-none"
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
            Highest Rated
          </option>
          <option value="title">
            A–Z
          </option>
        </select>
      </div>

      <button
        type="button"
        onClick={resetFilters}
        className="mt-3 text-[9px] font-black uppercase tracking-[0.2em] text-white/35 transition hover:text-white"
      >
        Reset Filters
      </button>
    </div>
  )

  const MovieCard = ({
    movie,
  }: {
    movie: Movie
  }) => {
    const inMyList = myList.includes(movie.id)

    return (
      <article className="group relative min-w-[155px] flex-1 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] transition duration-500 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.05] sm:min-w-[185px]">
        <div className="relative aspect-[2/3] overflow-hidden bg-white/5">
          <img
            src={movie.poster}
            alt={movie.title}
            className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />

          {movie.isOriginal && (
            <div className="absolute left-2 top-2 rounded-full bg-red-600 px-2 py-1 text-[7px] font-black uppercase tracking-[0.18em]">
              PMF Original
            </div>
          )}

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              toggleMyList(movie.id)
            }}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/60 text-sm backdrop-blur-md transition hover:bg-white hover:text-black"
            aria-label={
              inMyList
                ? 'Remove from My List'
                : 'Add to My List'
            }
          >
            {inMyList ? '✓' : '+'}
          </button>

          <button
            type="button"
            onClick={() => openMovie(movie)}
            className="absolute inset-x-3 bottom-3 rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-[8px] font-black uppercase tracking-[0.18em] opacity-0 backdrop-blur-md transition group-hover:opacity-100 hover:bg-white hover:text-black"
          >
            View Details
          </button>
        </div>

        <div className="p-3">
          <h3 className="truncate text-xs font-bold text-white">
            {movie.title}
          </h3>

          <div className="mt-2 flex items-center justify-between gap-2 text-[8px] font-bold uppercase tracking-[0.12em] text-white/35">
            <span>{movie.year}</span>
            <span>{movie.rating}</span>
            <span className="truncate">
              {movie.type}
            </span>
          </div>
        </div>
      </article>
    )
  }

  const MovieRail = ({
    title,
    subtitle,
    items,
  }: {
    title: string
    subtitle?: string
    items: Movie[]
  }) => {
    if (!items.length) return null

    return (
      <section className="mb-12">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-black tracking-[-0.04em] sm:text-2xl">
              {title}
            </h2>

            {subtitle && (
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.2em] text-white/25">
                {subtitle}
              </p>
            )}
          </div>

          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">
            {items.length} titles
          </span>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide">
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

  const CinematicHero = () => {
    const heroMovie =
      personalizedMovies[0] ||
      latestMovies[0] ||
      movies[0]

    if (!heroMovie) return null

    return (
      <section className="relative min-h-[560px] overflow-hidden">
        <img
          src={
            heroMovie.backdrop ||
            heroMovie.poster ||
            heroImage
          }
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />

        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-black/20" />

        <div className="relative mx-auto flex min-h-[560px] max-w-7xl items-end px-5 pb-16 pt-32 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <div className="mb-5 flex items-center gap-3">
              <span className="rounded-full bg-red-600 px-3 py-1 text-[8px] font-black uppercase tracking-[0.2em]">
                Featured Film
              </span>

              {heroMovie.isOriginal && (
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/50">
                  PMF Original
                </span>
              )}
            </div>

            <h1 className="text-4xl font-black leading-[0.95] tracking-[-0.07em] sm:text-6xl lg:text-7xl">
              {heroMovie.title}
            </h1>

            <p className="mt-6 max-w-xl text-sm leading-7 text-white/55 sm:text-base">
              {heroMovie.description}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-[9px] font-black uppercase tracking-[0.18em] text-white/45">
              <span>{heroMovie.year}</span>
              <span>•</span>
              <span>{heroMovie.rating}</span>
              <span>•</span>
              <span>{heroMovie.genre}</span>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  startWatching(heroMovie)
                }
                className="rounded-full bg-white px-6 py-3 text-[9px] font-black uppercase tracking-[0.2em] text-black transition hover:scale-105"
              >
                ▶ Watch Now
              </button>

              <button
                type="button"
                onClick={() =>
                  openMovie(heroMovie)
                }
                className="rounded-full border border-white/20 bg-white/10 px-6 py-3 text-[9px] font-black uppercase tracking-[0.2em] backdrop-blur-md transition hover:bg-white/20"
              >
                More Info
              </button>
            </div>
          </div>
        </div>
      </section>
    )
  }

  const renderMovieGrid = (
    items: Movie[],
  ) => {
    if (!items.length) {
      return (
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] px-6 py-16 text-center">
          <div className="text-3xl">🎬</div>

          <h3 className="mt-4 text-lg font-black">
            Nothing found
          </h3>

          <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-white/30">
            Try another search or adjust your
            discovery filters.
          </p>

          <button
            type="button"
            onClick={resetFilters}
            className="mt-5 rounded-full border border-white/15 px-5 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-white/60 transition hover:bg-white hover:text-black"
          >
            Reset Discovery
          </button>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((movie) => (
          <MovieCard
            key={movie.id}
            movie={movie}
          />
        ))}
      </div>
    )
  }

  const homeContent = (
    <>
      <CinematicHero />

      <div className="mx-auto max-w-7xl px-5 pb-16 pt-10 sm:px-8 lg:px-12">
        {continueMovies.length > 0 && (
          <MovieRail
            title="Continue Watching"
            subtitle="Pick up where you left off"
            items={continueMovies}
          />
        )}

        {historyMovies.length > 0 && (
          <MovieRail
            title="Recently Watched"
            subtitle="Your viewing history"
            items={historyMovies}
          />
        )}

        <MovieRail
          title="For You"
          subtitle={
            historyMovies.length
              ? `Curated from your viewing`
              : `Discover something new`
          }
          items={
            personalizedMovies.length
              ? personalizedMovies
              : trendingMovies
          }
        />

        <MovieRail
          title="Trending Now"
          subtitle="What everyone's watching"
          items={trendingMovies}
        />

        <MovieRail
          title="Latest Releases"
          subtitle="Fresh from the PMF catalogue"
          items={latestMovies}
        />

        <MovieRail
          title="Action"
          items={actionMovies}
        />

        <MovieRail
          title="Adventure"
          items={adventureMovies}
        />
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-black/70 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-5 sm:px-8 lg:px-12">
          <button
            type="button"
            onClick={goHome}
            className="shrink-0 text-xl font-black tracking-[-0.08em]"
          >
            PMF<span className="text-red-600">.</span>
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
                className={`text-[9px] font-black uppercase tracking-[0.2em] transition ${
                  activeSection === section
                    ? 'text-white'
                    : 'text-white/35 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setShowMobileSearch(
                  (value) => !value,
                )
              }
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-xs text-white/60 transition hover:bg-white hover:text-black"
              aria-label="Search"
            >
              ⌕
            </button>

            <button
              type="button"
              onClick={() =>
                setShowProfile(true)
              }
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1.5 transition hover:border-white/20"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-sm">
                {profile.avatar}
              </span>

              <span className="hidden max-w-[100px] truncate text-[9px] font-black uppercase tracking-[0.15em] text-white/55 sm:block">
                {profile.name}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                supabase.auth.signOut()
              }
              className="hidden rounded-full border border-white/10 px-3 py-2 text-[8px] font-black uppercase tracking-[0.18em] text-white/35 transition hover:border-red-500/30 hover:text-white sm:block"
            >
              Sign Out
            </button>
          </div>
        </div>

        {showMobileSearch && (
          <div className="border-t border-white/[0.06] px-5 py-3 md:hidden">
            <input
              autoFocus
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(
                  event.target.value,
                )
              }
              placeholder="Search movies, genres, titles..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-xs text-white outline-none placeholder:text-white/25"
            />
          </div>
        )}

        <div className="flex border-t border-white/[0.04] px-5 py-2 md:hidden">
          {(
            [
              ['home', 'Home'],
              ['movies', 'Movies'],
              ['series', 'Series'],
              ['my-list', 'My List'],
            ] as const
          ).map(([section, label]) => (
            <button
              key={section}
              type="button"
              onClick={() =>
                navigateTo(section)
              }
              className={`flex-1 py-2 text-[8px] font-black uppercase tracking-[0.15em] ${
                activeSection === section
                  ? 'text-white'
                  : 'text-white/30'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="pt-16">
        {activeSection === 'home' &&
        !searchQuery ? (
          homeContent
        ) : (
          <div className="mx-auto max-w-7xl px-5 pb-20 pt-10 sm:px-8 lg:px-12">
            <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-red-500">
                  PMF Discovery
                </p>

                <h1 className="mt-2 text-3xl font-black tracking-[-0.06em] sm:text-4xl">
                  {searchQuery
                    ? `Results for "${searchQuery}"`
                    : activeSection ===
                        'my-list'
                      ? 'My List'
                      : activeSection ===
                          'series'
                        ? 'TV Series'
                        : 'Movies'}
                </h1>

                <p className="mt-2 text-xs text-white/30">
                  {filteredMovies.length}{' '}
                  title
                  {filteredMovies.length ===
                  1
                    ? ''
                    : 's'}{' '}
                  available
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowFilters(
                    (value) => !value,
                  )
                }
                className="rounded-full border border-white/10 px-5 py-2.5 text-[8px] font-black uppercase tracking-[0.2em] text-white/55 transition hover:bg-white hover:text-black"
              >
                {showFilters
                  ? 'Hide Filters'
                  : 'Filter & Sort'}
              </button>
            </div>

            {showFilters && (
              <div className="mb-8">
                <FilterPanel />
              </div>
            )}

            {moviesLoading ? (
              <div className="flex min-h-[320px] items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-red-600" />

                  <p className="mt-4 text-[9px] font-black uppercase tracking-[0.25em] text-white/25">
                    Loading catalogue
                  </p>
                </div>
              </div>
            ) : moviesError ? (
              <div className="rounded-3xl border border-red-500/20 bg-red-500/[0.04] px-6 py-16 text-center">
                <div className="text-3xl">
                  ⚠
                </div>

                <h2 className="mt-4 text-lg font-black">
                  Catalogue unavailable
                </h2>

                <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-white/30">
                  {moviesError}
                </p>
              </div>
            ) : (
              renderMovieGrid(
                filteredMovies,
              )
            )}
          </div>
        )}
      </main>

      {showProfile && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-5 backdrop-blur-xl"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              setShowProfile(false)
            }
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b0b] shadow-2xl">
            <div className="relative h-28 overflow-hidden">
              <img
                src={heroImage}
                alt=""
                className="h-full w-full object-cover opacity-50"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0b] to-transparent" />
            </div>

            <div className="p-6">
              <div className="-mt-12 flex items-end gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/15 bg-[#111] text-4xl shadow-xl">
                  {profile.avatar}
                </div>

                <div className="pb-1">
                  <p className="text-[8px] font-black uppercase tracking-[0.25em] text-red-500">
                    PMF Profile
                  </p>

                  <h2 className="mt-1 text-xl font-black">
                    Your Experience
                  </h2>
                </div>
              </div>

              <div className="mt-7">
                <label className="text-[8px] font-black uppercase tracking-[0.2em] text-white/30">
                  Profile Name
                </label>

                <input
                  value={profile.name}
                  onChange={(event) =>
                    setProfile(
                      (current) => ({
                        ...current,
                        name:
                          event.target.value,
                      }),
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-white/25"
                  placeholder="Enter your name"
                />
              </div>

              <div className="mt-5">
                <label className="text-[8px] font-black uppercase tracking-[0.2em] text-white/30">
                  Choose Avatar
                </label>

                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    '🎬',
                    '🍿',
                    '🎭',
                    '🚀',
                    '🔥',
                    '🦁',
                    '👑',
                    '🌍',
                  ].map((avatar) => (
                    <button
                      key={avatar}
                      type="button"
                      onClick={() =>
                        setProfile(
                          (current) => ({
                            ...current,
                            avatar,
                          }),
                        )
                      }
                      className={`flex h-11 w-11 items-center justify-center rounded-xl border text-xl transition ${
                        profile.avatar === avatar
                          ? 'border-red-500 bg-red-500/10'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                      }`}
                    >
                      {avatar}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-7 grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-center">
                  <p className="text-lg font-black">
                    {myListMovies.length}
                  </p>

                  <p className="mt-1 text-[7px] font-black uppercase tracking-[0.15em] text-white/25">
                    My List
                  </p>
                </div>

                <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-center">
                  <p className="text-lg font-black">
                    {historyMovies.length}
                  </p>

                  <p className="mt-1 text-[7px] font-black uppercase tracking-[0.15em] text-white/25">
                    Watched
                  </p>
                </div>

                <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-center">
                  <p className="text-lg font-black">
                    {continueMovies.length}
                  </p>

                  <p className="mt-1 text-[7px] font-black uppercase tracking-[0.15em] text-white/25">
                    Continue
                  </p>
                </div>
              </div>

              <div className="mt-7 flex gap-3">
                <button
                  type="button"
                  onClick={() =>
                    saveProfile(profile)
                  }
                  className="flex-1 rounded-full bg-white px-5 py-3 text-[9px] font-black uppercase tracking-[0.2em] text-black transition hover:bg-white/90"
                >
                  Save Profile
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setShowProfile(false)
                  }
                  className="rounded-full border border-white/10 px-5 py-3 text-[9px] font-black uppercase tracking-[0.2em] text-white/45 transition hover:text-white"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedMovie && (
        <div
          className="fixed inset-0 z-[90] overflow-y-auto bg-black/90 backdrop-blur-md"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              setSelectedMovie(null)
            }
          }}
        >
          <div className="mx-auto min-h-screen max-w-5xl py-6 sm:py-10">
            <div className="relative overflow-hidden rounded-none border-y border-white/10 bg-[#090909] sm:rounded-3xl sm:border">
              <div className="relative h-[280px] sm:h-[390px]">
                <img
                  src={
                    selectedMovie.backdrop ||
                    selectedMovie.poster ||
                    heroImage
                  }
                  alt={selectedMovie.title}
                  className="h-full w-full object-cover"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-[#090909] via-black/20 to-black/20" />

                <button
                  type="button"
                  onClick={() =>
                    setSelectedMovie(null)
                  }
                  className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white/70 backdrop-blur-xl transition hover:bg-white hover:text-black"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="relative -mt-20 px-5 pb-8 sm:px-10">
                <div className="flex flex-col gap-7 sm:flex-row">
                  <div className="hidden w-40 shrink-0 overflow-hidden rounded-2xl border border-white/10 shadow-2xl sm:block">
                    <img
                      src={
                        selectedMovie.poster ||
                        heroImage
                      }
                      alt={selectedMovie.title}
                      className="aspect-[2/3] w-full object-cover"
                    />
                  </div>

                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedMovie.isOriginal && (
                        <span className="rounded-full bg-red-600 px-3 py-1 text-[7px] font-black uppercase tracking-[0.2em]">
                          PMF Original
                        </span>
                      )}

                      <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/40">
                        {selectedMovie.genre}
                      </span>
                    </div>

                    <h1 className="mt-3 text-4xl font-black tracking-[-0.06em] sm:text-5xl">
                      {selectedMovie.title}
                    </h1>

                    <div className="mt-4 flex flex-wrap gap-3 text-[9px] font-black uppercase tracking-[0.15em] text-white/40">
                      <span>
                        {selectedMovie.year}
                      </span>
                      <span>
                        {selectedMovie.rating}
                      </span>
                      <span>
                        {selectedMovie.type}
                      </span>
                    </div>

                    <p className="mt-5 max-w-2xl text-sm leading-7 text-white/50">
                      {
                        selectedMovie.description
                      }
                    </p>

                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          startWatching(
                            selectedMovie,
                          )
                        }
                        className="rounded-full bg-white px-6 py-3 text-[9px] font-black uppercase tracking-[0.2em] text-black transition hover:scale-105"
                      >
                        ▶ Watch Now
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          toggleMyList(
                            selectedMovie.id,
                          )
                        }
                        className="rounded-full border border-white/15 bg-white/[0.05] px-6 py-3 text-[9px] font-black uppercase tracking-[0.2em] transition hover:bg-white hover:text-black"
                      >
                        {myList.includes(
                          selectedMovie.id,
                        )
                          ? '✓ In My List'
                          : '+ My List'}
                      </button>
                    </div>

                    <div className="mt-8 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                        <p className="text-[7px] font-black uppercase tracking-[0.2em] text-white/25">
                          Genre
                        </p>
                        <p className="mt-2 text-xs font-bold">
                          {selectedMovie.genre ||
                            '—'}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                        <p className="text-[7px] font-black uppercase tracking-[0.2em] text-white/25">
                          Release
                        </p>
                        <p className="mt-2 text-xs font-bold">
                          {selectedMovie.year ||
                            '—'}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                        <p className="text-[7px] font-black uppercase tracking-[0.2em] text-white/25">
                          Rating
                        </p>
                        <p className="mt-2 text-xs font-bold">
                          {selectedMovie.rating ||
                            '—'}
                        </p>
                      </div>
                    </div>

                    {relatedMovies.length >
                      0 && (
                      <div className="mt-10">
                        <h2 className="text-lg font-black">
                          More Like This
                        </h2>

                          <div className="mt-4 flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                          {relatedMovies.map(
                            (movie) => (
                              <div
                                key={movie.id}
                                className="w-28 shrink-0"
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    openMovie(
                                      movie,
                                    )
                                  }
                                  className="overflow-hidden rounded-xl border border-white/10"
                                >
                                  <img
                                    src={
                                      movie.poster ||
                                      heroImage
                                    }
                                    alt={
                                      movie.title
                                    }
                                    className="aspect-[2/3] w-full object-cover transition hover:scale-105"
                                  />
                                </button>

                                <p className="mt-2 truncate text-[9px] font-bold text-white/55">
                                  {movie.title}
                                </p>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {watchingMovie && (
        <div className="fixed inset-0 z-[110] bg-black">
          <div className="flex h-16 items-center justify-between border-b border-white/[0.06] px-5">
            <div>
              <p className="text-[7px] font-black uppercase tracking-[0.25em] text-red-500">
                Now Playing
              </p>

              <p className="mt-1 max-w-[220px] truncate text-xs font-bold">
                {watchingMovie.title}
              </p>
            </div>

            <button
              type="button"
              onClick={closeWatching}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-lg text-white/60 transition hover:bg-white hover:text-black"
              aria-label="Close player"
            >
              ×
            </button>
          </div>

          <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-[#020202] p-4">
            {getVideoUrl(watchingMovie) ? (
              isYouTubeUrl(
                getVideoUrl(watchingMovie),
              ) ? (
                <iframe
                  src={getVideoUrl(watchingMovie)}
                  title={watchingMovie.title}
                  className="aspect-video w-full max-w-6xl rounded-xl border border-white/10"
                  allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={getVideoUrl(watchingMovie)}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-full max-w-full rounded-xl"
                />
              )
            ) : (
              <div className="max-w-md text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-2xl">
                  ▶
                </div>

                <h2 className="mt-6 text-xl font-black">
                  Coming Soon
                </h2>

                <p className="mt-3 text-xs leading-6 text-white/30">
                  This title is available in the
                  PMF catalogue, but its playback
                  source has not been connected
                  yet.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

            <footer className="border-t border-white/[0.06] bg-black px-5 py-12 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 md:grid-cols-3">
            <div>
              <div className="text-2xl font-black tracking-[-0.08em]">
                PMF<span className="text-red-600">.</span>
              </div>

              <p className="mt-3 max-w-sm text-xs leading-6 text-white/30">
                Prince Mufasa Flix — a cinematic
                entertainment platform built for
                stories, discovery and the next
                generation of audiences.
              </p>
            </div>

            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30">
                Explore
              </p>

              <div className="mt-4 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={goHome}
                  className="w-fit text-xs text-white/45 transition hover:text-white"
                >
                  Home
                </button>

                <button
                  type="button"
                  onClick={() => navigateTo('movies')}
                  className="w-fit text-xs text-white/45 transition hover:text-white"
                >
                  Movies
                </button>

                <button
                  type="button"
                  onClick={() => navigateTo('series')}
                  className="w-fit text-xs text-white/45 transition hover:text-white"
                >
                  TV Series
                </button>

                <button
                  type="button"
                  onClick={() => navigateTo('my-list')}
                  className="w-fit text-xs text-white/45 transition hover:text-white"
                >
                  My List
                </button>
              </div>
            </div>

            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30">
                Account
              </p>

              <p className="mt-4 break-all text-xs leading-6 text-white/35">
                {session.user.email || 'PMF Member'}
              </p>

              <button
                type="button"
                onClick={() => supabase.auth.signOut()}
                className="mt-4 rounded-full border border-white/10 px-4 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-white/45 transition hover:border-red-500/40 hover:text-white"
              >
                Sign Out
              </button>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 border-t border-white/[0.06] pt-6 text-[9px] font-bold uppercase tracking-[0.2em] text-white/20 sm:flex-row sm:items-center sm:justify-between">
            <span>
              © {new Date().getFullYear()} PMF-Flix
            </span>

            <span>
              Your World. Your Stories. Your Flix.
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const loadSession = async () => {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession()

        if (!mounted) return

        setSession(currentSession)
      } catch (error) {
        console.error('PMF session error:', error)

        if (mounted) {
          setSession(null)
        }
      } finally {
        if (mounted) {
          setAuthLoading(false)
        }
      }
    }

    void loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
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
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-white/10 border-t-red-600" />

          <p className="mt-5 text-[9px] font-black uppercase tracking-[0.35em] text-white/30">
            Preparing PMF
          </p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <AuthScreen />
  }

  return <AuthenticatedApp session={session} />
}
