import {
  ChevronRight,
  Play,
  Plus,
  Sparkles,
  Star,
} from 'lucide-react'
import type { Movie } from '../movieData/movies'

type WowHomeProps = {
  movies: Movie[]
  profileName: string
  continueIds: string[]
  isInMyList: (movie: Movie) => boolean
  onOpenMovie: (movie: Movie) => void
  onPlayMovie: (movie: Movie) => void
  onToggleMyList: (movie: Movie) => void
  onBrowseMovies: () => void
}

function movieId(movie: Movie) {
  return String(movie.id)
}

function ratingValue(movie: Movie) {
  const value = Number(
    String(movie.rating ?? '')
      .replace(/[^0-9.]/g, ''),
  )

  return Number.isFinite(value) ? value : 0
}

function uniqueMovies(movies: Movie[]) {
  return Array.from(
    new Map(
      movies.map((movie) => [
        movieId(movie),
        movie,
      ]),
    ).values(),
  )
}

function MovieCard({
  movie,
  onOpenMovie,
  onPlayMovie,
  onToggleMyList,
  isInMyList,
}: {
  movie: Movie
  onOpenMovie: (movie: Movie) => void
  onPlayMovie: (movie: Movie) => void
  onToggleMyList: (movie: Movie) => void
  isInMyList: boolean
}) {
  return (
    <article
      className="
        group relative min-w-[154px] max-w-[154px]
        overflow-hidden rounded-2xl
        border border-white/[0.08]
        bg-white/[0.035]
        transition-all duration-500
        hover:-translate-y-2
        hover:border-white/[0.18]
        hover:bg-white/[0.07]
        sm:min-w-[190px] sm:max-w-[190px]
        md:min-w-[210px] md:max-w-[210px]
      "
    >
      <button
        type="button"
        onClick={() => onOpenMovie(movie)}
        className="block w-full text-left"
      >
        <div className="relative aspect-[2/3] overflow-hidden">
          <img
            src={movie.poster}
            alt={movie.title}
            className="
              h-full w-full object-cover
              transition duration-700
              group-hover:scale-110
            "
            loading="lazy"
          />

          <div
            className="
              absolute inset-0
              bg-gradient-to-t
              from-black
              via-black/10
              to-transparent
              opacity-90
            "
          />

          <div
            className="
              absolute inset-x-0 bottom-0
              translate-y-2 p-3
              opacity-0 transition duration-300
              group-hover:translate-y-0
              group-hover:opacity-100
            "
          >
            <span
              className="
                inline-flex h-9 w-9
                items-center justify-center
                rounded-full bg-white text-black
                shadow-xl
              "
            >
              <Play
                size={14}
                fill="currentColor"
              />
            </span>
          </div>

          <div
            className="
              absolute left-2 top-2
              rounded-full border border-white/10
              bg-black/65 px-2 py-1
              text-[8px] font-black
              uppercase tracking-[0.16em]
              text-white/80 backdrop-blur-xl
            "
          >
            {movie.type}
          </div>
        </div>

        <div className="space-y-1.5 p-3">
          <h3
            className="
              truncate text-[12px]
              font-black tracking-tight text-white
            "
          >
            {movie.title}
          </h3>

          <div
            className="
              flex items-center gap-2
              text-[8px] font-bold
              uppercase tracking-[0.12em]
              text-white/45
            "
          >
            <span>{movie.year}</span>

            <span>•</span>

            <span>{movie.category}</span>
          </div>
        </div>
      </button>

      <button
        type="button"
        aria-label={
          isInMyList
            ? `Remove ${movie.title} from My List`
            : `Add ${movie.title} to My List`
        }
        onClick={() => onToggleMyList(movie)}
        className="
          absolute right-2 top-2
          flex h-8 w-8 items-center justify-center
          rounded-full border border-white/10
          bg-black/65 text-white
          backdrop-blur-xl
          transition hover:bg-white hover:text-black
        "
      >
        {isInMyList ? (
          <span className="text-[13px] font-black">
            ✓
          </span>
        ) : (
          <Plus size={14} />
        )}
      </button>
    </article>
  )
}

function Row({
  title,
  eyebrow,
  movies,
  onOpenMovie,
  onPlayMovie,
  onToggleMyList,
  isInMyList,
  onMore,
}: {
  title: string
  eyebrow?: string
  movies: Movie[]
  onOpenMovie: (movie: Movie) => void
  onPlayMovie: (movie: Movie) => void
  onToggleMyList: (movie: Movie) => void
  isInMyList: (movie: Movie) => boolean
  onMore?: () => void
}) {
  if (!movies.length) {
    return null
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          {eyebrow && (
            <div
              className="
                mb-1 flex items-center gap-2
                text-[8px] font-black
                uppercase tracking-[0.22em]
                text-white/35
              "
            >
              <Sparkles size={11} />
              {eyebrow}
            </div>
          )}

          <h2
            className="
              text-xl font-black tracking-tight
              text-white sm:text-2xl
            "
          >
            {title}
          </h2>
        </div>

        {onMore && (
          <button
            type="button"
            onClick={onMore}
            className="
              hidden items-center gap-1
              text-[9px] font-black
              uppercase tracking-[0.16em]
              text-white/45 transition
              hover:text-white sm:flex
            "
          >
            Explore
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      <div
        className="
          flex gap-3 overflow-x-auto pb-3
          [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden
        "
      >
        {movies.map((movie) => (
          <MovieCard
            key={movieId(movie)}
            movie={movie}
            onOpenMovie={onOpenMovie}
            onPlayMovie={onPlayMovie}
            onToggleMyList={onToggleMyList}
            isInMyList={isInMyList(movie)}
          />
        ))}
      </div>
    </section>
  )
}

export default function WowHome({
  movies,
  profileName,
  continueIds,
  isInMyList,
  onOpenMovie,
  onPlayMovie,
  onToggleMyList,
  onBrowseMovies,
}: WowHomeProps) {
  const featured =
    movies.find((movie) => movie.featured) ||
    movies[0]

  if (!featured) {
    return (
      <main
        className="
          flex min-h-[70vh]
          items-center justify-center
          px-6 text-center
        "
      >
        <div>
          <Sparkles
            className="mx-auto mb-4 text-white/50"
            size={28}
          />

          <h1
            className="
              text-2xl font-black
              tracking-tight text-white
            "
          >
            Your PMF universe is loading.
          </h1>

          <p className="mt-2 text-sm text-white/45">
            New stories are preparing for you.
          </p>
        </div>
      </main>
    )
  }

  const continueMovies = uniqueMovies(
    continueIds
      .map((id) =>
        movies.find(
          (movie) => movieId(movie) === id,
        ),
      )
      .filter(
        (movie): movie is Movie =>
          Boolean(movie),
      ),
  )

  const newest = [...movies]
    .sort((a, b) => b.year - a.year)
    .slice(0, 10)

  const highestRated = [...movies]
    .sort(
      (a, b) =>
        ratingValue(b) -
        ratingValue(a),
    )
    .slice(0, 10)

  const adventure = movies.filter(
    (movie) =>
      /adventure/i.test(
        movie.category,
      ),
  )

  const action = movies.filter(
    (movie) =>
      /action/i.test(
        movie.category,
      ),
  )

  const thriller = movies.filter(
    (movie) =>
      /thriller/i.test(
        movie.category,
      ),
  )

  const discovery = uniqueMovies([
    ...highestRated,
    ...newest,
  ]).slice(0, 10)

  const greeting =
    profileName.trim()
      ? `Welcome back, ${profileName}`
      : 'Welcome back'

  return (
    <main
      className="
        min-h-screen overflow-hidden
        bg-[#050505] text-white
      "
    >
      {/* CINEMATIC HERO */}
      <section
        className="
          relative min-h-[680px]
          overflow-hidden
          sm:min-h-[730px]
        "
      >
        <img
          src={featured.poster}
          alt=""
          aria-hidden="true"
          className="
            absolute inset-0
            h-full w-full object-cover
            scale-105 opacity-45
            blur-[1px]
          "
        />

        <div
          className="
            absolute inset-0
            bg-gradient-to-r
            from-black
            via-black/75
            to-black/15
          "
        />

        <div
          className="
            absolute inset-0
            bg-gradient-to-t
            from-[#050505]
            via-transparent
            to-black/35
          "
        />

        <div
          className="
            absolute -left-32 top-20
            h-72 w-72 rounded-full
            bg-white/[0.06] blur-[100px]
          "
        />

        <div
          className="
            relative z-10 mx-auto
            flex min-h-[680px]
            max-w-7xl items-end
            px-5 pb-20 pt-36
            sm:min-h-[730px]
            sm:px-8 sm:pb-24
            lg:px-12
          "
        >
          <div className="max-w-2xl">
            <div
              className="
                mb-5 flex items-center gap-3
                text-[9px] font-black
                uppercase tracking-[0.24em]
                text-white/50
              "
            >
              <span
                className="
                  h-1.5 w-1.5 rounded-full
                  bg-white
                  shadow-[0_0_18px_rgba(255,255,255,.9)]
                "
              />

              PMF • YOUR WORLD. YOUR STORIES.
            </div>

            <p
              className="
                mb-3 text-[10px]
                font-black uppercase
                tracking-[0.2em]
                text-white/50
              "
            >
              {greeting}
            </p>

            <h1
              className="
                text-5xl font-black
                leading-[0.9]
                tracking-[-0.055em]
                sm:text-7xl
                lg:text-8xl
              "
            >
              {featured.title}
            </h1>

            <div
              className="
                mt-5 flex flex-wrap
                items-center gap-3
                text-[9px] font-black
                uppercase tracking-[0.14em]
                text-white/60
              "
            >
              <span>{featured.year}</span>
              <span>•</span>
              <span>{featured.category}</span>

              {featured.duration && (
                <>
                  <span>•</span>
                  <span>{featured.duration}</span>
                </>
              )}

              {featured.rating && (
                <>
                  <span>•</span>
                  <span>{featured.rating}</span>
                </>
              )}
            </div>

            <p
              className="
                mt-5 max-w-xl
                text-sm leading-7
                text-white/60
                sm:text-base
              "
            >
              {featured.description}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  onPlayMovie(featured)
                }
                className="
                  inline-flex items-center
                  gap-2 rounded-full
                  bg-white px-6 py-3.5
                  text-[10px] font-black
                  uppercase tracking-[0.16em]
                  text-black
                  shadow-[0_12px_50px_rgba(255,255,255,.12)]
                  transition hover:scale-[1.03]
                "
              >
                <Play
                  size={14}
                  fill="currentColor"
                />
                Play Now
              </button>

              <button
                type="button"
                onClick={() =>
                  onOpenMovie(featured)
                }
                className="
                  inline-flex items-center
                  gap-2 rounded-full
                  border border-white/15
                  bg-white/[0.07]
                  px-6 py-3.5
                  text-[10px] font-black
                  uppercase tracking-[0.16em]
                  text-white
                  backdrop-blur-xl
                  transition hover:bg-white/15
                "
              >
                More Info
              </button>

              <button
                type="button"
                onClick={() =>
                  onToggleMyList(featured)
                }
                className="
                  inline-flex items-center
                  gap-2 rounded-full
                  border border-white/10
                  bg-black/30
                  px-5 py-3.5
                  text-[10px] font-black
                  uppercase tracking-[0.16em]
                  text-white/80
                  backdrop-blur-xl
                "
              >
                <Plus size={14} />
                {isInMyList(featured)
                  ? 'In My List'
                  : 'My List'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* DISCOVERY UNIVERSE */}
      <div
        className="
          relative z-20
          mx-auto max-w-7xl
          space-y-14
          px-5 pb-24
          sm:px-8 lg:px-12
        "
      >
        <section
          className="
            -mt-8 rounded-3xl
            border border-white/[0.08]
            bg-white/[0.035]
            p-5 shadow-2xl
            backdrop-blur-2xl
            sm:p-7
          "
        >
          <div
            className="
              flex flex-col gap-5
              md:flex-row md:items-center
              md:justify-between
            "
          >
            <div>
              <div
                className="
                  mb-2 flex items-center gap-2
                  text-[8px] font-black
                  uppercase tracking-[0.22em]
                  text-white/35
                "
              >
                <Sparkles size={11} />
                PMF Intelligence
              </div>

              <h2
                className="
                  text-2xl font-black
                  tracking-tight text-white
                "
              >
                Discover your next obsession.
              </h2>

              <p
                className="
                  mt-2 max-w-xl
                  text-xs leading-6
                  text-white/40
                "
              >
                Fresh releases, highly rated stories,
                and titles selected from your PMF world.
              </p>
            </div>

            <button
              type="button"
              onClick={onBrowseMovies}
              className="
                inline-flex shrink-0
                items-center justify-center
                gap-2 rounded-full
                border border-white/10
                bg-white/[0.06]
                px-5 py-3
                text-[9px] font-black
                uppercase tracking-[0.16em]
                text-white
                transition hover:bg-white/10
              "
            >
              Explore Catalogue
              <ChevronRight size={14} />
            </button>
          </div>
        </section>

        <Row
          title={
            continueMovies.length
              ? 'Continue Watching'
              : 'Made For You'
          }
          eyebrow={
            continueMovies.length
              ? 'Pick up where you left off'
              : 'Curated discovery'
          }
          movies={
            continueMovies.length
              ? continueMovies
              : discovery
          }
          onOpenMovie={onOpenMovie}
          onPlayMovie={onPlayMovie}
          onToggleMyList={onToggleMyList}
          isInMyList={isInMyList}
          onMore={onBrowseMovies}
        />

        <Row
          title="Fresh on PMF"
          eyebrow="New stories"
          movies={newest}
          onOpenMovie={onOpenMovie}
          onPlayMovie={onPlayMovie}
          onToggleMyList={onToggleMyList}
          isInMyList={isInMyList}
          onMore={onBrowseMovies}
        />

        {adventure.length > 0 && (
          <Row
            title="Adventure Awaits"
            eyebrow="Go beyond the ordinary"
            movies={adventure}
            onOpenMovie={onOpenMovie}
            onPlayMovie={onPlayMovie}
            onToggleMyList={onToggleMyList}
            isInMyList={isInMyList}
          />
        )}

        {action.length > 0 && (
          <Row
            title="High Impact"
            eyebrow="Action & adrenaline"
            movies={action}
            onOpenMovie={onOpenMovie}
            onPlayMovie={onPlayMovie}
            onToggleMyList={onToggleMyList}
            isInMyList={isInMyList}
          />
        )}

        {thriller.length > 0 && (
          <Row
            title="Keep Watching"
            eyebrow="Thrillers & mysteries"
            movies={thriller}
            onOpenMovie={onOpenMovie}
            onPlayMovie={onPlayMovie}
            onToggleMyList={onToggleMyList}
            isInMyList={isInMyList}
          />
        )}

        <Row
          title="Top Rated"
          eyebrow="Audience favourites"
          movies={highestRated}
          onOpenMovie={onOpenMovie}
          onPlayMovie={onPlayMovie}
          onToggleMyList={onToggleMyList}
          isInMyList={isInMyList}
          onMore={onBrowseMovies}
        />

        {/* PMF SIGNATURE */}
        <section
          className="
            relative overflow-hidden
            rounded-[2rem]
            border border-white/10
            bg-white/[0.035]
            px-6 py-12
            sm:px-10 sm:py-16
          "
        >
          <div
            className="
              absolute -right-20 -top-20
              h-60 w-60 rounded-full
              bg-white/[0.05] blur-[80px]
            "
          />

          <div className="relative z-10 max-w-2xl">
            <div
              className="
                mb-4 flex items-center gap-2
                text-[8px] font-black
                uppercase tracking-[0.24em]
                text-white/35
              "
            >
              <Star size={11} />
              The PMF Universe
            </div>

            <h2
              className="
                text-3xl font-black
                leading-tight tracking-[-0.035em]
                sm:text-5xl
              "
            >
              One platform.
              <br />
              Endless stories.
            </h2>

            <p
              className="
                mt-4 max-w-xl
                text-sm leading-7
                text-white/45
              "
            >
              PMF-Flix is built to become a living
              entertainment universe — connecting
              cinema, discovery, culture and stories
              from around the world.
            </p>

            <button
              type="button"
              onClick={onBrowseMovies}
              className="
                mt-7 inline-flex
                items-center gap-2
                rounded-full
                bg-white px-6 py-3.5
                text-[9px] font-black
                uppercase tracking-[0.17em]
                text-black
              "
            >
              Enter the Catalogue
              <ChevronRight size={14} />
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}
