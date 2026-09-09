import heroImage from './assets/hero.png'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Movie } from './movieData/movies'
import { getMovies } from './services/movieService'
import { mapCanonicalMovieToLegacy } from './utils/movieMapper'
import { supabase } from './supabase'
import type { Session } from '@supabase/supabase-js'
import AuthScreen from './Auth'
import { VideoPlayer } from './components'

type Section = 'home' | 'movies' | 'series' | 'my-list'

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

  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [videoLoading, setVideoLoading] = useState(true)

  const videoRef = useRef<HTMLVideoElement | null>(null)

  const [myList, setMyList] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('pmf-my-list')
      return saved ? JSON.parse(saved) : []
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

        return saved ? JSON.parse(saved) : []
      } catch {
        return []
      }
    })

  const [showMobileSearch, setShowMobileSearch] =
    useState(false)

  /*
   * LOAD MOVIES FROM SUPABASE
   */
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

    loadMovies()

    /*
     * REALTIME SUPABASE UPDATES
     */
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
          loadMovies()
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
      supabase.removeChannel(channel)
    }
  }, [])

  /*
   * SAVE MY LIST
   */
  const saveMyList = (list: number[]) => {
    localStorage.setItem(
      'pmf-my-list',
      JSON.stringify(list),
    )
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

  /*
   * CONTINUE WATCHING
   */
  const addToContinueWatching = (movieId: number) => {
    setContinueWatching((current) => {
      const updated = [
        movieId,
        ...current.filter((id) => id !== movieId),
      ].slice(0, 10)

      localStorage.setItem(
        'pmf-continue-watching',
        JSON.stringify(updated),
      )

      return updated
    })
  }

  /*
   * GET VIDEO URL
   *
   * IMPORTANT:
   * First use Supabase video_url.
   *
   * If The Journey has no Supabase video URL,
   * use the manually uploaded video inside:
   *
   * public/movies/the-journey.mp4
   */
  const getVideoUrl = (movie: Movie) => {
    if (
      movie.videoUrl &&
      movie.videoUrl.trim() !== ''
    ) {
      return movie.videoUrl.trim()
    }

    /*
     * LOCAL VIDEO FALLBACK
     */
    if (
      movie.title.trim().toLowerCase() ===
      'the journey'
    ) {
      return '/movies/the-journey.mp4'
    }

    return ''
  }

  /*
   * CHECK IF URL IS YOUTUBE
   */
  const isYouTubeUrl = (url: string) => {
    return /youtube\.com|youtu\.be/i.test(url)
  }

  /*
   * OPEN MOVIE DETAILS
   */
  const openMovie = (movie: Movie) => {
    setSelectedMovie(movie)
  }

  /*
   * START WATCHING
   */
  const startWatching = (movie: Movie) => {
    setSelectedMovie(null)
    setWatchingMovie(movie)

    setIsPlaying(false)
    setIsMuted(false)
    setVideoError(false)
    setVideoLoading(true)

    addToContinueWatching(movie.id)
  }

  /*
   * CLOSE VIDEO PLAYER
   */
  const closeWatching = () => {
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }

    setWatchingMovie(null)
    setIsPlaying(false)
    setVideoError(false)
    setVideoLoading(true)
  }

  /*
   * GO HOME
   */
  const goHome = () => {
    setActiveSection('home')
    setSearchQuery('')
    setSelectedMovie(null)
    setWatchingMovie(null)

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  /*
   * PLAY / PAUSE
   */
  const togglePlay = async () => {
    if (!videoRef.current) return

    if (videoRef.current.paused) {
      try {
        await videoRef.current.play()
      } catch (error) {
        console.error(
          'PMF play error:',
          error,
        )

        setIsPlaying(false)
      }
    } else {
      videoRef.current.pause()
    }
  }

  /*
   * MUTE
   */
  const toggleMute = () => {
    if (!videoRef.current) return

    videoRef.current.muted =
      !videoRef.current.muted

    setIsMuted(videoRef.current.muted)
  }

  /*
   * FULLSCREEN
   */
  const toggleFullscreen = async () => {
    if (!videoRef.current) return

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await videoRef.current.requestFullscreen()
      }
    } catch {
      console.log('Fullscreen unavailable')
    }
  }

  /*
   * DOWNLOAD MOVIE
   */
  
    
    
    

    

  /*
   * ESCAPE KEY
   */
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

  /*
   * RESET VIDEO WHEN MOVIE CHANGES
   */
  useEffect(() => {
    if (!watchingMovie) return

    setIsPlaying(false)
    setIsMuted(false)
    setVideoError(false)
    setVideoLoading(true)

    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.currentTime = 0
        videoRef.current.load()
      }
    }, 100)
  }, [watchingMovie?.id])

  /*
   * UPDATE SELECTED MOVIE
   */
  useEffect(() => {
    if (!selectedMovie) return

    const updatedMovie = movies.find(
      (movie) => movie.id === selectedMovie.id,
    )

    if (updatedMovie) {
      setSelectedMovie(updatedMovie)
    }
  }, [movies, selectedMovie?.id])

  /*
   * UPDATE WATCHING MOVIE
   */
  useEffect(() => {
    if (!watchingMovie) return

    const updatedMovie = movies.find(
      (movie) => movie.id === watchingMovie.id,
    )

    if (updatedMovie) {
      setWatchingMovie(updatedMovie)
    }
  }, [movies, watchingMovie?.id])

  /*
   * FILTER MOVIES
   */
  const filteredMovies = useMemo(() => {
    const query =
      searchQuery.trim().toLowerCase()

    let result = movies

    if (activeSection === 'movies') {
      result = result.filter(
        (movie) =>
          movie.type.toLowerCase() === 'movie',
      )
    }

    if (activeSection === 'series') {
      result = result.filter(
        (movie) =>
          movie.type
            .toLowerCase()
            .includes('series') ||
          movie.type
            .toLowerCase()
            .includes('tv'),
      )
    }

    if (activeSection === 'my-list') {
      result = result.filter((movie) =>
        myList.includes(movie.id),
      )
    }

    if (query) {
      result = result.filter(
        (movie) =>
          movie.title
            .toLowerCase()
            .includes(query) ||
          movie.category
            .toLowerCase()
            .includes(query) ||
          movie.type
            .toLowerCase()
            .includes(query) ||
          movie.description
            .toLowerCase()
            .includes(query),
      )
    }

    return result
  }, [
    movies,
    activeSection,
    searchQuery,
    myList,
  ])

  /*
   * MOVIE SECTIONS
   */
  const trendingMovies = movies
    .filter((movie) => movie.featured)
    .slice(0, 5)

  const latestMovies = [...movies]
    .sort((a, b) => b.year - a.year)
    .slice(0, 5)

  const actionMovies = movies.filter(
    (movie) =>
      movie.category.toLowerCase() ===
      'action',
  )

  const adventureMovies = movies.filter(
    (movie) =>
      movie.category.toLowerCase() ===
      'adventure',
  )

  const continueMovies = continueWatching
    .map((id) =>
      movies.find((movie) => movie.id === id),
    )
    .filter(Boolean) as Movie[]

  
  /*
   * MOVIE CARD
   */
  const renderMovieCard = (movie: Movie) => (
    <button
      key={movie.id}
      onClick={() => openMovie(movie)}
      className="group relative min-w-[170px] overflow-hidden rounded-xl border border-white/10 bg-white/5 text-left transition duration-300 hover:-translate-y-2 hover:border-white/30 hover:bg-white/10 sm:min-w-[190px]"
    >
      <div className="relative aspect-[2/3] overflow-hidden bg-black">
        {movie.poster ? (
          <img
            src={movie.poster}
            alt={movie.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-white/30">
            No Poster
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />

        <div className="absolute left-3 right-3 top-3 flex justify-between">
          <span className="rounded bg-black/70 px-2 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur">
            {movie.type}
          </span>

          <span className="rounded bg-red-600 px-2 py-1 text-[10px] font-bold">
            HD
          </span>
        </div>

        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-red-400">
            {movie.category}
          </p>

          <h3 className="mt-1 line-clamp-2 text-base font-bold">
            {movie.title}
          </h3>
        </div>
      </div>

      <div className="p-3">
        <p className="text-xs text-white/50">
          {movie.year} • {movie.category}
        </p>
      </div>
    </button>
  )

  /*
   * MOVIE ROW
   */
  const renderMovieRow = (
    title: string,
    subtitle: string,
    list: Movie[],
  ) => {
    if (list.length === 0) return null

    return (
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-500">
            {subtitle}
          </p>

          <h2 className="mt-1 text-2xl font-black sm:text-3xl">
            {title}
          </h2>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-5 scrollbar-hide">
          {list.map(renderMovieCard)}
        </div>
      </section>
    )
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">

      {/* HEADER */}

      <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-2xl">
  <div className="mx-auto flex h-16 max-w-7xl items-center gap-5 px-4 sm:px-6 lg:px-8">

    <button
      onClick={goHome}
      className="shrink-0 text-2xl font-black tracking-tight"
    >
      <span className="text-red-600">PMF</span>
      <span className="hidden text-white sm:inline">
        LIX
      </span>
    </button>

    <nav className="hidden items-center gap-6 text-sm font-semibold md:flex">

      <button
        onClick={goHome}
        className={
          activeSection === 'home'
            ? 'text-white'
            : 'text-white/50 hover:text-white'
        }
      >
        Home
      </button>

      <button
        onClick={() => {
          setActiveSection('movies')
          setSearchQuery('')
          window.scrollTo({
            top: 0,
            behavior: 'smooth',
          })
        }}
        className={
          activeSection === 'movies'
            ? 'text-white'
            : 'text-white/50 hover:text-white'
        }
      >
        Movies
      </button>

      <button
        onClick={() => {
          setActiveSection('series')
          setSearchQuery('')
          window.scrollTo({
            top: 0,
            behavior: 'smooth',
          })
        }}
        className={
          activeSection === 'series'
            ? 'text-white'
            : 'text-white/50 hover:text-white'
        }
      >
        TV Series
      </button>

      <button
        onClick={() => {
          setActiveSection('my-list')
          setSearchQuery('')
          window.scrollTo({
            top: 0,
            behavior: 'smooth',
          })
        }}
        className={
          activeSection === 'my-list'
            ? 'text-white'
            : 'text-white/50 hover:text-white'
        }
      >
        My List
      </button>

    </nav>

    <div className="ml-auto hidden flex-1 justify-end md:flex">
      <div className="relative w-full max-w-xs">

        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
          🔎
        </span>

        <input
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value)
            setActiveSection('home')
          }}
          placeholder="Search movies..."
          className="w-full rounded-full border border-white/10 bg-white/10 py-2.5 pl-11 pr-4 text-sm outline-none placeholder:text-white/40 focus:border-red-600"
        />

      </div>
    </div>

    <button
      onClick={() =>
        setShowMobileSearch(
          (value) => !value,
        )
      }
      className="rounded-full border border-white/10 bg-white/5 px-3 py-2 md:hidden"
    >
      🔎
    </button>

    <button
      onClick={() => supabase.auth.signOut()}
      className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/10 hover:text-white sm:px-4"
    >
      <span className="hidden max-w-[150px] truncate sm:inline">
        {session.user.email}
      </span>

      <span className="sm:ml-2">
        Sign out
      </span>
    </button>

  </div>
                

        {showMobileSearch && (
          <div className="border-t border-white/10 bg-black p-3 md:hidden">

            <input
              autoFocus
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value)
                setActiveSection('home')
              }}
              placeholder="Search movies..."
              className="w-full rounded-full border border-white/10 bg-white/10 px-5 py-3 text-sm outline-none placeholder:text-white/40"
            />

          </div>
        )}

        <div className="flex border-t border-white/5 md:hidden">

          {(
            [
              'home',
              'movies',
              'series',
              'my-list',
            ] as Section[]
          ).map((section) => (

            <button
              key={section}
              onClick={() => {
                setActiveSection(section)
                setSearchQuery('')

                window.scrollTo({
                  top: 0,
                  behavior: 'smooth',
                })
              }}
              className={`flex-1 py-3 text-xs font-semibold capitalize ${
                activeSection === section
                  ? 'text-white'
                  : 'text-white/40'
              }`}
            >
              {section === 'my-list'
                ? 'My List'
                : section}
            </button>

          ))}

        </div>
      </header>

      {/* MAIN */}

      <main className="pt-16">

        {activeSection === 'home' &&
          !searchQuery.trim() && (

            <section className="relative flex min-h-[75vh] items-end overflow-hidden">

              <img
                src={heroImage}
                alt="PMF cinematic hero"
                className="absolute inset-0 h-full w-full object-cover"
              />

              <div className="absolute inset-0 bg-black/40" />

              <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />

              <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-black/10" />

              <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-16 pt-28 sm:px-6 lg:px-8">

                <div className="max-w-2xl">

                  <div className="mb-5 flex items-center gap-3">

                    <span className="rounded bg-red-600 px-3 py-1 text-xs font-black uppercase tracking-widest">
                      PMF Original
                    </span>

                    <span className="text-sm text-white/60">
                      Premium Entertainment
                    </span>

                  </div>

                  <h1 className="text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl lg:text-8xl">
                    Your World.
                    <br />
                    Your Stories.
                    <br />
                    <span className="text-red-600">
                      Your Flix.
                    </span>
                  </h1>

                  <p className="mt-6 max-w-xl text-base leading-7 text-white/70 sm:text-lg">
                    Discover movies, series, originals
                    and stories worth watching — all
                    brought together in the PMF cinematic
                    experience.
                  </p>

                  <div className="mt-7 flex flex-wrap gap-3">

                    {movies[0] && (
                      <button
                        onClick={() =>
                          openMovie(movies[0])
                        }
                        className="rounded-lg bg-white px-7 py-3 font-black text-black transition hover:scale-105"
                      >
                        ▶ Watch Now
                      </button>
                    )}

                    <button
                      onClick={() =>
                        document
                          .getElementById('trending')
                          ?.scrollIntoView({
                            behavior: 'smooth',
                          })
                      }
                      className="rounded-lg border border-white/20 bg-white/10 px-7 py-3 font-bold backdrop-blur-md transition hover:bg-white/20"
                    >
                      Explore PMF
                    </button>

                  </div>

                </div>

              </div>

            </section>
          )}

        {/* LOADING */}

        {moviesLoading && (
          <section className="mx-auto max-w-7xl px-4 py-12 text-center sm:px-6 lg:px-8">

            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-red-600" />

            <p className="mt-4 text-sm text-white/50">
              Loading PMF catalogue...
            </p>

          </section>
        )}

        {/* ERROR */}

        {moviesError && !moviesLoading && (
          <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">

            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">

              <p className="text-red-400">
                {moviesError}
              </p>

              <button
                onClick={() =>
                  window.location.reload()
                }
                className="mt-5 rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-black"
              >
                Try Again
              </button>

            </div>

          </section>
        )}

        {/* SEARCH */}

        {searchQuery.trim() ? (

          <section className="mx-auto max-w-7xl px-4 pb-20 pt-12 sm:px-6 lg:px-8">

            <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-500">
              PMF Search
            </p>

            <h1 className="mt-2 text-3xl font-black sm:text-4xl">
              Results for "{searchQuery}"
            </h1>

            {filteredMovies.length === 0 ? (

              <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-12 text-center">

                <div className="text-4xl">
                  🎬
                </div>

                <h2 className="mt-4 text-xl font-bold">
                  Nothing found
                </h2>

                <p className="mt-2 text-sm text-white/40">
                  Try another title, category or genre.
                </p>

              </div>

            ) : (

              <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {filteredMovies.map(renderMovieCard)}
              </div>

            )}

          </section>

        ) : activeSection !== 'home' ? (

          <section className="mx-auto max-w-7xl px-4 pb-20 pt-12 sm:px-6 lg:px-8">

            <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-500">
              PMF
            </p>

            <h1 className="mt-2 text-4xl font-black">
              {activeSection === 'my-list'
                ? 'My List'
                : activeSection === 'movies'
                  ? 'Movies'
                  : 'TV Series'}
            </h1>

            {filteredMovies.length === 0 ? (

              <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-12 text-center">

                <div className="text-4xl">
                  ＋
                </div>

                <h2 className="mt-4 text-xl font-bold">
                  Your list is empty
                </h2>

                <p className="mt-2 text-sm text-white/40">
                  Open a movie and select "My List" to
                  save it.
                </p>

              </div>

            ) : (

              <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {filteredMovies.map(renderMovieCard)}
              </div>

            )}

          </section>

        ) : (

          <>

            <div id="trending">

              {renderMovieRow(
                'Trending Now',
                '🔥 Popular',
                trendingMovies.length > 0
                  ? trendingMovies
                  : movies.slice(0, 5),
              )}

            </div>

            {continueMovies.length > 0 &&
              renderMovieRow(
                'Continue Watching',
                '▶ Pick Up Where You Left Off',
                continueMovies,
              )}

            {renderMovieRow(
              'Latest Releases',
              '✨ New',
              latestMovies,
            )}

            {renderMovieRow(
              'Action',
              '⚡ High Intensity',
              actionMovies,
            )}

            {renderMovieRow(
              'Adventure',
              '🌍 Explore',
              adventureMovies,
            )}

          </>

        )}

      </main>

      {/* MOVIE DETAILS MODAL */}

      {selectedMovie && (

        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">

          <div className="relative max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-[#080808] shadow-2xl">

            <button
              onClick={() =>
                setSelectedMovie(null)
              }
              className="absolute right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-xl hover:bg-white hover:text-black"
            >
              ×
            </button>

            <div className="max-h-[92vh] overflow-y-auto">

              <div className="relative aspect-video w-full overflow-hidden bg-black">

                {selectedMovie.poster && (
                  <img
                    src={selectedMovie.poster}
                    alt={selectedMovie.title}
                    className="h-full w-full object-cover opacity-70"
                  />
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-black/20 to-transparent" />

                <div className="absolute bottom-6 left-6 right-6 sm:bottom-10 sm:left-10">

                  <p className="text-xs font-bold uppercase tracking-[0.3em] text-red-500">
                    PMF
                  </p>

                  <h2 className="mt-2 text-3xl font-black sm:text-5xl">
                    {selectedMovie.title}
                  </h2>

                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-white/60">

                    <span>
                      {selectedMovie.year}
                    </span>

                    <span>•</span>

                    <span>
                      {selectedMovie.type}
                    </span>

                    <span>•</span>

                    <span>
                      {selectedMovie.category}
                    </span>

                    <span>•</span>

                    <span>HD</span>

                  </div>

                </div>

              </div>

              <div className="p-6 sm:p-10">

                <div className="grid gap-8 lg:grid-cols-[1fr_240px]">

                  <div>

                    <p className="leading-7 text-white/65">
                      {selectedMovie.description}
                    </p>

                    <div className="mt-7 flex flex-wrap gap-3">

                      <button
                        onClick={() =>
                          startWatching(selectedMovie)
                        }
                        className="rounded-lg bg-white px-7 py-3 font-black text-black hover:scale-105"
                      >
                        ▶ Play
                      </button>

                      <button
                        onClick={() =>
                          toggleMyList(
                            selectedMovie.id,
                          )
                        }
                        className="rounded-lg border border-white/20 bg-white/10 px-6 py-3 font-semibold hover:bg-white/20"
                      >
                        {myList.includes(
                          selectedMovie.id,
                        )
                          ? '✓ In My List'
                          : '＋ My List'}
                      </button>

                    </div>

                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-5">

                    <p className="text-xs font-bold uppercase tracking-widest text-white/40">
                      Details
                    </p>

                    <div className="mt-4 space-y-3 text-sm">

                      <div>
                        <p className="text-white/40">
                          Year
                        </p>

                        <p className="font-semibold">
                          {selectedMovie.year}
                        </p>
                      </div>

                      <div>
                        <p className="text-white/40">
                          Genre
                        </p>

                        <p className="font-semibold">
                          {selectedMovie.category}
                        </p>
                      </div>

                      <div>
                        <p className="text-white/40">
                          Type
                        </p>

                        <p className="font-semibold">
                          {selectedMovie.type}
                        </p>
                      </div>

                    </div>

                  </div>

                </div>

              </div>

            </div>

          </div>

        </div>

      )}

      {/* VIDEO PLAYER */}

      {watchingMovie && (

        <div className="fixed inset-0 z-[200] overflow-y-auto bg-[#050505]">

          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-black/90 px-4 backdrop-blur-xl sm:px-8">

            <button
              onClick={closeWatching}
              className="flex items-center gap-2 text-sm font-semibold text-white/70 hover:text-white"
            >
              <span className="text-xl">
                ←
              </span>

              Back
            </button>

            <div className="text-xl font-black">

              <span className="text-red-600">
                PMF
              </span>

              <span> LIX</span>

            </div>

            <button
              onClick={() =>
                toggleMyList(watchingMovie.id)
              }
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold"
            >
              {myList.includes(watchingMovie.id)
                ? '✓ My List'
                : '＋ My List'}
            </button>

          </header>

          <section className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-8">

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">

              {getVideoUrl(watchingMovie) &&
              !isYouTubeUrl(
                getVideoUrl(watchingMovie),
              ) &&
              !videoError ? (

                <>

                  <div className="relative">

                    <video
                      ref={videoRef}
                      key={getVideoUrl(watchingMovie)}
                      src={getVideoUrl(watchingMovie)}
                      poster={watchingMovie.poster}
                      className="aspect-video w-full bg-black object-contain"
                      controls
                      playsInline
                      preload="auto"
                      onLoadStart={() => {
                        console.log(
                          'PMF VIDEO LOADING:',
                          getVideoUrl(watchingMovie),
                        )

                        setVideoLoading(true)
                        setVideoError(false)
                      }}
                      onLoadedMetadata={() => {
                        console.log(
                          'PMF VIDEO METADATA LOADED',
                        )

                        setVideoLoading(false)
                      }}
                      onCanPlay={() => {
                        console.log(
                          'PMF VIDEO READY TO PLAY',
                        )

                        setVideoLoading(false)
                      }}
                      onWaiting={() => {
                        setVideoLoading(true)
                      }}
                      onPlaying={() => {
                        setVideoLoading(false)
                        setIsPlaying(true)
                      }}
                      onPlay={() => {
                        setIsPlaying(true)
                      }}
                      onPause={() => {
                        setIsPlaying(false)
                      }}
                      onEnded={() => {
                        setIsPlaying(false)
                      }}
                      onVolumeChange={(event) => {
                        setIsMuted(
                          event.currentTarget.muted,
                        )
                      }}
                      onError={(event) => {
                        const video =
                          event.currentTarget

                        console.error(
                          'PMF VIDEO ERROR:',
                          {
                            src:
                              video.currentSrc ||
                              getVideoUrl(
                                watchingMovie,
                              ),
                            error: video.error,
                          },
                        )

                        setVideoLoading(false)
                        setVideoError(true)
                        setIsPlaying(false)
                      }}
                    >
                      Your browser does not support
                      video playback.
                    </video>

                    {videoLoading && (

                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">

                        <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />

                      </div>

                    )}

                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#0b0b0b] px-4 py-3">

                    <div className="flex gap-2">

                      <button
                        onClick={togglePlay}
                        className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-black"
                      >
                        {isPlaying
                          ? '❚❚ Pause'
                          : '▶ Play'}
                      </button>

                      <button
                        onClick={toggleMute}
                        className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm"
                      >
                        {isMuted
                          ? '🔇 Muted'
                          : '🔊 Sound'}
                      </button>

                    </div>

                    <button
                      onClick={toggleFullscreen}
                      className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm"
                    >
                      ⛶ Fullscreen
                    </button>

                  </div>

                </>

              ) : (

                <div
                  className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-black"
                  style={{
                    backgroundImage:
                      watchingMovie.poster
                        ? `url(${watchingMovie.poster})`
                        : undefined,

                    backgroundSize: 'cover',

                    backgroundPosition: 'center',
                  }}
                >

                  <div className="absolute inset-0 bg-black/85 backdrop-blur-md" />

                  <div className="relative z-10 max-w-xl px-6 text-center">

                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-white/20 bg-white/10 text-3xl">
                      ▶
                    </div>

                    <p className="mt-6 text-xs font-bold uppercase tracking-[0.3em] text-red-500">
                      PMF WATCH
                    </p>

                    <h1 className="mt-3 text-3xl font-black sm:text-5xl">
                      {watchingMovie.title}
                    </h1>

                    <p className="mt-4 text-sm leading-6 text-white/50">

                      {videoError
                        ? 'This video could not be played. Please check that the MP4 file is inside public/movies/the-journey.mp4 and that the video format is supported by your browser.'
                        : 'No video has been connected to this title yet.'}

                    </p>

                  </div>

                </div>

              )}

            </div>

            <div className="mt-8">

              <p className="text-xs font-bold uppercase tracking-[0.3em] text-red-500">
                Now Watching
              </p>

              <h1 className="mt-2 text-3xl font-black sm:text-4xl">
                {watchingMovie.title}
              </h1>

              <div className="mt-3 flex flex-wrap gap-3 text-sm text-white/50">

                <span>
                  {watchingMovie.year}
                </span>

                <span>•</span>

                <span>
                  {watchingMovie.type}
                </span>

                <span>•</span>

                <span>
                  {watchingMovie.category}
                </span>

              </div>

              <p className="mt-5 max-w-3xl leading-7 text-white/60">
                {watchingMovie.description}
              </p>

            </div>

          </section>

        </div>

      )}

      {/* FOOTER */}

      {!watchingMovie && (

        <footer className="border-t border-white/10 bg-black px-4 py-10 text-center">

          <div className="text-2xl font-black">

            <span className="text-red-600">
              PMF
            </span>

            <span> LIX</span>

          </div>

          <p className="mt-3 text-sm text-white/30">
            Prince Mufasa Flix
          </p>

          <p className="mt-2 text-xs text-white/20">
            © 2026 PMF. All rights reserved.
          </p>

        </footer>

      )}

    </div>
  )
}

function App() {
  const [session, setSession] =
    useState<Session | null>(null)

  const [authLoading, setAuthLoading] =
    useState(true)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(
      ({ data: { session } }) => {
        if (!mounted) return

        setSession(session)
        setAuthLoading(false)
      },
    )

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
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
          <div className="text-4xl font-black">
            <span className="text-red-600">
              PMF
            </span>
            LIX
          </div>

          <div className="mx-auto mt-6 h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-red-600" />

          <p className="mt-4 text-sm text-white/40">
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
    <AuthenticatedApp session={session} />
  )
}

export default App
