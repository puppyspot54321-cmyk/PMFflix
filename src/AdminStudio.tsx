import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Film,
  Loader2,
  LockKeyhole,
  Pencil,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Video,
  X,
} from 'lucide-react'
import { supabase } from './supabase'

type AdminRole = 'owner' | 'admin' | 'editor'

type StudioMovie = {
  id: number
  title: string
  year: number | null
  description: string | null
  category: string | null
  type: string | null
  duration: string | null
  rating: string | null
  poster_url: string | null
  video_url: string | null
  trailer_url: string | null
  featured: boolean
  downloadable: boolean
  created_at: string | null
  updated_at: string | null
}

type StudioAsset = {
  id: string
  movie_id: number | null
  title: string
  slug: string
  description: string | null
  media_type: string | null
  category: string | null
  year: number | null
  languages: string[]
  countries: string[]
  duration_seconds: number | null
  rating: string | null
  poster_url: string | null
  backdrop_url: string | null
  trailer_url: string | null
  status: string | null
  processing_status: string | null
  featured: boolean
  downloadable: boolean
  active_variant_id: string | null
  created_by: string | null
  created_at: string | null
  updated_at: string | null
}

type AdminStudioProps = {
  onClose?: () => void
}

type MovieForm = {
  title: string
  year: string
  description: string
  category: string
  type: string
  duration: string
  rating: string
  poster_url: string
  video_url: string
  trailer_url: string
  featured: boolean
  downloadable: boolean
}

const ADMIN_ROLES: AdminRole[] = [
  'owner',
  'admin',
  'editor',
]

function isAdminRole(value: unknown): value is AdminRole {
  return (
    typeof value === 'string' &&
    ADMIN_ROLES.includes(value as AdminRole)
  )
}

function formatStatus(
  value: string | null | undefined,
) {
  if (!value) return 'Unknown'

  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    )
}

function isReadyStatus(
  value: string | null | undefined,
) {
  const normalized = value?.toLowerCase()

  return (
    normalized === 'ready' ||
    normalized === 'published'
  )
}

function formatDuration(
  seconds: number | null | undefined,
) {
  if (
    seconds === null ||
    seconds === undefined ||
    !Number.isFinite(seconds) ||
    seconds < 0
  ) {
    return 'Not available'
  }

  const totalSeconds = Math.floor(seconds)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor(
    (totalSeconds % 3600) / 60,
  )
  const remainingSeconds =
    totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`
  }

  return `${minutes}m ${remainingSeconds}s`
}

function formatDate(
  value: string | null | undefined,
) {
  if (!value) return 'Not available'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Not available'
  }

  return date.toLocaleString()
}

function createMovieForm(
  movie: StudioMovie,
): MovieForm {
  return {
    title: movie.title,
    year:
      movie.year === null
        ? ''
        : String(movie.year),
    description:
      movie.description ?? '',
    category:
      movie.category ?? '',
    type:
      movie.type ?? '',
    duration:
      movie.duration ?? '',
    rating:
      movie.rating ?? '',
    poster_url:
      movie.poster_url ?? '',
    video_url:
      movie.video_url ?? '',
    trailer_url:
      movie.trailer_url ?? '',
    featured: movie.featured,
    downloadable:
      movie.downloadable,
  }
}

export default function AdminStudio({
  onClose,
}: AdminStudioProps) {
  const [role, setRole] =
    useState<AdminRole | null>(null)

  const [movies, setMovies] = useState<
    StudioMovie[]
  >([])

  const [assets, setAssets] = useState<
    StudioAsset[]
  >([])

  const [selectedAsset, setSelectedAsset] =
    useState<StudioAsset | null>(null)

  const [selectedMovie, setSelectedMovie] =
    useState<StudioMovie | null>(null)

  const [movieForm, setMovieForm] =
    useState<MovieForm | null>(null)

  const [savingMovie, setSavingMovie] =
    useState(false)

  const [saveMessage, setSaveMessage] =
    useState<string | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [refreshing, setRefreshing] =
    useState(false)

  const [authorized, setAuthorized] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const openMovieEditor = (
    movie: StudioMovie,
  ) => {
    setSelectedMovie(movie)
    setMovieForm(createMovieForm(movie))
    setSaveMessage(null)
    setError(null)
  }

  const closeMovieEditor = () => {
    if (savingMovie) return

    setSelectedMovie(null)
    setMovieForm(null)
    setSaveMessage(null)
  }

  const loadStudio = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError(null)

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) {
          throw userError
        }

        if (!user) {
          setAuthorized(false)
          setRole(null)
          setMovies([])
          setAssets([])
          setSelectedAsset(null)
          setSelectedMovie(null)
          setMovieForm(null)
          setError(
            'No active session was found.',
          )
          return
        }

        const {
          data: adminRecord,
          error: adminError,
        } = await supabase
          .from('media_admins')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle()

        if (adminError) {
          throw adminError
        }

        if (
          !adminRecord ||
          !isAdminRole(adminRecord.role)
        ) {
          setAuthorized(false)
          setRole(null)
          setMovies([])
          setAssets([])
          setSelectedAsset(null)
          setSelectedMovie(null)
          setMovieForm(null)
          return
        }

        setAuthorized(true)
        setRole(adminRecord.role)

        const [
          moviesResult,
          assetsResult,
        ] = await Promise.all([
          supabase
            .from('movies')
            .select(
              'id,title,year,description,category,type,duration,rating,poster_url,video_url,trailer_url,featured,downloadable,created_at,updated_at',
            )
            .order('created_at', {
              ascending: false,
            }),

          supabase
            .from('media_assets')
            .select(
              'id,movie_id,title,slug,description,media_type,category,year,languages,countries,duration_seconds,rating,poster_url,backdrop_url,trailer_url,status,processing_status,featured,downloadable,active_variant_id,created_by,created_at,updated_at',
            )
            .order('created_at', {
              ascending: false,
            }),
        ])

        if (moviesResult.error) {
          throw moviesResult.error
        }

        if (assetsResult.error) {
          throw assetsResult.error
        }

        setMovies(
          (moviesResult.data ??
            []) as StudioMovie[],
        )

        setAssets(
          (assetsResult.data ??
            []) as StudioAsset[],
        )
      } catch (loadError) {
        console.error(
          'PMF Studio load error:',
          loadError,
        )

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'PMF Studio could not load its data.',
        )
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [],
  )

  useEffect(() => {
    void loadStudio()
  }, [loadStudio])

  const stats = useMemo(() => {
    const featured =
      movies.filter(
        (movie) => movie.featured,
      ).length

    const ready =
      assets.filter((asset) =>
        isReadyStatus(
          asset.processing_status ||
            asset.status,
        ),
      ).length

    const processing =
      assets.filter((asset) => {
        const status = (
          asset.processing_status ||
          asset.status ||
          ''
        ).toLowerCase()

        return (
          status !== '' &&
          ![
            'ready',
            'published',
            'failed',
          ].includes(status)
        )
      }).length

    return {
      catalogue: movies.length,
      featured,
      assets: assets.length,
      ready,
      processing,
    }
  }, [movies, assets])

  const recentAssets = assets.slice(0, 5)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#08090d] text-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-9 w-9 animate-spin text-amber-300" />

          <p className="text-sm text-white/50">
            Opening PMF Studio…
          </p>
        </div>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#08090d] px-5 text-white">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.045] p-7 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/10">
            <LockKeyhole className="h-7 w-7 text-amber-300" />
          </div>

          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-300/80">
            PMF Studio
          </p>

          <h1 className="text-2xl font-semibold">
            Authorized access only
          </h1>

          <p className="mt-3 text-sm leading-6 text-white/50">
            This workspace is available only
            to authorized PMF media
            administrators.
          </p>

          <div className="mt-7 flex gap-3">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/70 transition hover:bg-white/[0.08]"
              >
                Return
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                void loadStudio(true)
              }
              className="flex-1 rounded-xl bg-amber-300 px-4 py-3 text-sm font-semibold text-black transition hover:bg-amber-200"
            >
              Try again
            </button>
          </div>

          {error && (
            <p className="mt-4 text-xs text-white/30">
              {error}
            </p>
          )}
        </div>
      </div>
    )
  }

    const saveMovie = async () => {
    if (
      !selectedMovie ||
      !movieForm
    ) {
      return
    }

    const title =
      movieForm.title.trim()

    if (!title) {
      setSaveMessage(
        'Movie title is required.',
      )
      return
    }

    let year: number | null = null

    if (movieForm.year.trim()) {
      const parsedYear = Number(
        movieForm.year.trim(),
      )

      if (
        !Number.isInteger(parsedYear) ||
        parsedYear < 1800 ||
        parsedYear > 3000
      ) {
        setSaveMessage(
          'Please enter a valid year.',
        )
        return
      }

      year = parsedYear
    }

    setSavingMovie(true)
    setSaveMessage(null)
    setError(null)

    try {
      const { error: updateError } =
        await supabase
          .from('movies')
          .update({
            title,
            year,
            description:
              movieForm.description.trim() ||
              null,
            category:
              movieForm.category.trim() ||
              null,
            type:
              movieForm.type.trim() ||
              null,
            duration:
              movieForm.duration.trim() ||
              null,
            rating:
              movieForm.rating.trim() ||
              null,
            poster_url:
              movieForm.poster_url.trim() ||
              null,
            video_url:
              movieForm.video_url.trim() ||
              null,
            trailer_url:
              movieForm.trailer_url.trim() ||
              null,
            featured:
              movieForm.featured,
            downloadable:
              movieForm.downloadable,
          })
          .eq('id', selectedMovie.id)

      if (updateError) {
        throw updateError
      }

      const updatedMovie: StudioMovie = {
        ...selectedMovie,
        title,
        year,
        description:
          movieForm.description.trim() ||
          null,
        category:
          movieForm.category.trim() ||
          null,
        type:
          movieForm.type.trim() ||
          null,
        duration:
          movieForm.duration.trim() ||
          null,
        rating:
          movieForm.rating.trim() ||
          null,
        poster_url:
          movieForm.poster_url.trim() ||
          null,
        video_url:
          movieForm.video_url.trim() ||
          null,
        trailer_url:
          movieForm.trailer_url.trim() ||
          null,
        featured:
          movieForm.featured,
        downloadable:
          movieForm.downloadable,
      }

      setMovies((currentMovies) =>
        currentMovies.map((movie) =>
          movie.id === updatedMovie.id
            ? updatedMovie
            : movie,
        ),
      )

      setSelectedMovie(updatedMovie)
      setMovieForm(
        createMovieForm(updatedMovie),
      )

      setSaveMessage(
        'Movie changes saved successfully.',
      )
    } catch (saveError) {
      console.error(
        'PMF Studio movie update error:',
        saveError,
      )

      setSaveMessage(
        saveError instanceof Error
          ? saveError.message
          : 'Could not save movie changes.',
      )
    } finally {
      setSavingMovie(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#08090d] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#08090d]/85 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Return to PMF-Flix"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/60 transition hover:bg-white/[0.08] hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-300 text-black">
              <Film className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-semibold">
                  PMF Studio
                </h1>

                <span className="hidden rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300 sm:inline-flex">
                  {role}
                </span>
              </div>

              <p className="truncate text-[11px] text-white/40">
                Media & catalogue command center
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadStudio(true)
            }
            disabled={refreshing}
            aria-label="Refresh PMF Studio"
            className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-white/60 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
          >
            <RefreshCw
              className={
                refreshing
                  ? 'h-3.5 w-3.5 animate-spin'
                  : 'h-3.5 w-3.5'
              }
            />

            <span className="hidden sm:inline">
              Refresh
            </span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-5 py-7 sm:px-7 lg:py-9">
        <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-amber-300/[0.12] via-white/[0.035] to-transparent p-6 sm:p-8">
          <div className="relative max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300">
              <Sparkles className="h-3 w-3" />
              Studio command center
            </div>

            <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              Build the PMF universe from
              one command center.
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50 sm:text-base">
              Manage your catalogue, inspect
              media assets and keep PMF-Flix
              content organized from one
              protected workspace.
            </p>

            <div className="mt-6 flex flex-wrap gap-4 text-xs text-white/45">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                Authorized session
              </span>

              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-amber-300" />
                Catalogue editing enabled
              </span>
            </div>
          </div>
        </section>

        {error && (
          <div className="mt-5 rounded-2xl border border-red-400/15 bg-red-400/[0.06] p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            icon={<Film />}
            label="Catalogue"
            value={stats.catalogue}
          />

          <StatCard
            icon={<Sparkles />}
            label="Featured"
            value={stats.featured}
          />

          <StatCard
            icon={<Video />}
            label="Media assets"
            value={stats.assets}
          />

          <StatCard
            icon={<CheckCircle2 />}
            label="Ready"
            value={stats.ready}
          />

          <StatCard
            icon={<BarChart3 />}
            label="Processing"
            value={stats.processing}
          />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold">
                  Catalogue overview
                </h3>

                <p className="mt-1 text-xs text-white/35">
                  Tap any title to edit its
                  PMF-Flix information
                </p>
              </div>

              <Film className="h-4 w-4 text-white/30" />
            </div>

            {movies.length === 0 ? (
              <EmptyState label="No catalogue titles found." />
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {movies
                  .slice(0, 8)
                  .map((movie) => (
                    <button
                      key={movie.id}
                      type="button"
                      onClick={() =>
                        openMovieEditor(movie)
                      }
                      className="group flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-inset focus:ring-amber-300/40"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
                          {movie.poster_url ? (
                            <img
                              src={movie.poster_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Film className="h-4 w-4 text-white/25" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-white/90">
                              {movie.title}
                            </p>

                            {movie.featured && (
                              <span className="shrink-0 rounded-full bg-amber-300/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300">
                                Featured
                              </span>
                            )}
                          </div>

                          <p className="mt-1 text-xs text-white/35">
                            {[
                              movie.year,
                              movie.type,
                              movie.category,
                            ]
                              .filter(Boolean)
                              .join(' • ') ||
                              'No metadata'}
                          </p>
                        </div>
                      </div>

                      <span className="flex shrink-0 items-center gap-1.5 text-[10px] text-white/25 transition group-hover:text-amber-300">
                        <Pencil className="h-3 w-3" />
                        Edit
                      </span>
                    </button>
                  ))}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold">
                  Media Core
                </h3>

                <p className="mt-1 text-xs text-white/35">
                  Latest ingested assets
                </p>
              </div>

              <Video className="h-4 w-4 text-white/30" />
            </div>

            {recentAssets.length === 0 ? (
              <EmptyState label="No media assets found." />
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {recentAssets.map(
                  (asset) => {
                    const status =
                      asset.processing_status ||
                      asset.status

                    const ready =
                      isReadyStatus(status)

                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() =>
                          setSelectedAsset(asset)
                        }
                        className="block w-full px-5 py-4 text-left transition hover:bg-white/[0.04] focus:outline-none focus:ring-1 focus:ring-inset focus:ring-amber-300/40"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-white/90">
                              {asset.title}
                            </p>

                            <p className="mt-1 text-xs text-white/35">
                              {formatStatus(
                                asset.media_type,
                              )}
                            </p>
                          </div>

                          <span
                            className={
                              ready
                                ? 'shrink-0 rounded-full bg-emerald-400/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-emerald-300'
                                : 'shrink-0 rounded-full bg-amber-300/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-amber-300'
                            }
                          >
                            {formatStatus(status)}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3 text-[10px] text-white/25">
                          <span>
                            {asset.movie_id
                              ? `Movie #${asset.movie_id}`
                              : 'Not linked'}
                          </span>

                          <span>
                            View details →
                          </span>
                        </div>
                      </button>
                    )
                  },
                )}
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-300" />

            <div>
              <h3 className="text-sm font-semibold">
                Studio controls online
              </h3>

              <p className="mt-1 text-xs leading-5 text-white/35">
                Catalogue titles can now be
                edited directly from PMF Studio.
                Media asset management remains
                read-only.
              </p>
            </div>
          </div>
        </section>
      </main>

      {selectedAsset && (
        <AssetDetailPanel
          asset={selectedAsset}
          onClose={() =>
            setSelectedAsset(null)
          }
        />
      )}

      {selectedMovie &&
        movieForm && (
          <MovieEditor
            movie={selectedMovie}
            form={movieForm}
            saving={savingMovie}
            message={saveMessage}
            onChange={setMovieForm}
            onSave={() =>
              void saveMovie()
            }
            onClose={closeMovieEditor}
          />
        )}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: number
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/45">
          {icon}
        </span>

        <span className="text-2xl font-semibold tracking-tight">
          {value}
        </span>
      </div>

      <p className="mt-4 text-xs font-medium text-white/40">
        {label}
      </p>
    </div>
  )
}

function EmptyState({
  label,
}: {
  label: string
}) {
  return (
    <div className="flex min-h-36 items-center justify-center px-5 text-center text-xs text-white/30">
      {label}
    </div>
  )
}

function MovieEditor({
  movie,
  form,
  saving,
  message,
  onChange,
  onSave,
  onClose,
}: {
  movie: StudioMovie
  form: MovieForm
  saving: boolean
  message: string | null
  onChange: (
    nextForm: MovieForm,
  ) => void
  onSave: () => void
  onClose: () => void
}) {
  const updateField = <
    K extends keyof MovieForm,
  >(
    field: K,
    value: MovieForm[K],
  ) => {
    onChange({
      ...form,
      [field]: value,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-3 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="movie-editor-title"
    >
      <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-white/10 bg-[#0c0d12] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-white/10 bg-[#0c0d12]/95 px-5 py-4 backdrop-blur-xl sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-300/80">
              PMF Catalogue Editor
            </p>

            <h3
              id="movie-editor-title"
              className="mt-1 truncate text-lg font-semibold sm:text-xl"
            >
              Edit {movie.title}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close movie editor"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/60 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          {message && (
            <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] p-4 text-sm text-amber-100">
              {message}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Movie title"
              value={form.title}
              onChange={(value) =>
                updateField(
                  'title',
                  value,
                )
              }
              placeholder="Enter movie title"
              required
            />

            <FormField
              label="Year"
              value={form.year}
              onChange={(value) =>
                updateField(
                  'year',
                  value,
                )
              }
              placeholder="2026"
              type="number"
            />

            <FormField
              label="Category"
              value={form.category}
              onChange={(value) =>
                updateField(
                  'category',
                  value,
                )
              }
              placeholder="Adventure"
            />

            <FormField
              label="Type"
              value={form.type}
              onChange={(value) =>
                updateField(
                  'type',
                  value,
                )
              }
              placeholder="Movie"
            />

            <FormField
              label="Duration"
              value={form.duration}
              onChange={(value) =>
                updateField(
                  'duration',
                  value,
                )
              }
              placeholder="2h 15m"
            />

            <FormField
              label="Rating"
              value={form.rating}
              onChange={(value) =>
                updateField(
                  'rating',
                  value,
                )
              }
              placeholder="PG-13"
            />
          </div>

          <FormTextArea
            label="Synopsis / description"
            value={form.description}
            onChange={(value) =>
              updateField(
                'description',
                value,
              )
            }
            placeholder="Write a compelling synopsis for this movie..."
          />

          <div className="grid gap-4">
            <FormField
              label="Poster URL"
              value={form.poster_url}
              onChange={(value) =>
                updateField(
                  'poster_url',
                  value,
                )
              }
              placeholder="https://..."
            />

            <FormField
              label="Backdrop URL"
              value=""
              onChange={() => undefined}
              placeholder="Backdrop is not stored in the movies table yet"
              disabled
            />

            <FormField
              label="Video URL"
              value={form.video_url}
              onChange={(value) =>
                updateField(
                  'video_url',
                  value,
                )
              }
              placeholder="https://..."
            />

            <FormField
              label="Trailer URL"
              value={form.trailer_url}
              onChange={(value) =>
                updateField(
                  'trailer_url',
                  value,
                )
              }
              placeholder="https://..."
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ToggleField
              label="Featured"
              description="Show this title as featured."
              checked={form.featured}
              onChange={(value) =>
                updateField(
                  'featured',
                  value,
                )
              }
            />

            <ToggleField
              label="Downloadable"
              description="Allow the title to be downloaded."
              checked={form.downloadable}
              onChange={(value) =>
                updateField(
                  'downloadable',
                  value,
                )
              }
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/70 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="flex items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 py-3 text-sm font-semibold text-black transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}

              {saving
                ? 'Saving…'
                : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
 }

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
  disabled = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  required?: boolean
  disabled?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
        {label}
        {required && (
          <span className="ml-1 text-amber-300">
            *
          </span>
        )}
      </span>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-amber-300/40 focus:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
      />
    </label>
  )
}

function FormTextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
        {label}
      </span>

      <textarea
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        rows={6}
        className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/20 focus:border-amber-300/40 focus:bg-white/[0.06]"
      />
    </label>
  )
}

function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <div>
        <p className="text-sm font-medium text-white/85">
          {label}
        </p>

        <p className="mt-1 text-xs leading-5 text-white/35">
          {description}
        </p>
      </div>

      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(
            event.target.checked,
          )
        }
        className="h-5 w-5 shrink-0 accent-amber-300"
      />
    </label>
  )
}

function AssetDetailPanel({
  asset,
  onClose,
}: {
  asset: StudioAsset
  onClose: () => void
}) {
  const status =
    asset.processing_status ||
    asset.status

  const ready = isReadyStatus(status)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-3 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="asset-detail-title"
    >
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-white/10 bg-[#0c0d12] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-white/10 bg-[#0c0d12]/95 px-5 py-4 backdrop-blur-xl sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-300/80">
              Media Core Asset
            </p>

            <h3
              id="asset-detail-title"
              className="mt-1 truncate text-lg font-semibold sm:text-xl"
            >
              {asset.title}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close asset details"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/60 transition hover:bg-white/[0.08] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap gap-2">
            <StatusBadge
              label={formatStatus(
                asset.media_type,
              )}
            />

            <StatusBadge
              label={formatStatus(status)}
              success={ready}
            />

            {asset.featured && (
              <StatusBadge
                label="Featured"
                success
              />
            )}

            {asset.downloadable && (
              <StatusBadge
                label="Downloadable"
              />
            )}
          </div>

          {asset.poster_url && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
              <img
                src={asset.poster_url}
                alt=""
                className="max-h-72 w-full object-cover object-center"
              />
            </div>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <DetailItem
              label="Asset ID"
              value={asset.id}
            />

            <DetailItem
              label="Slug"
              value={asset.slug}
            />

            <DetailItem
              label="Movie"
              value={
                asset.movie_id
                  ? `Movie #${asset.movie_id}`
                  : 'Not linked'
              }
            />

            <DetailItem
              label="Category"
              value={
                asset.category ||
                'Not available'
              }
            />

            <DetailItem
              label="Year"
              value={
                asset.year
                  ? String(asset.year)
                  : 'Not available'
              }
            />

            <DetailItem
              label="Rating"
              value={
                asset.rating ||
                'Not available'
              }
            />

            <DetailItem
              label="Duration"
              value={formatDuration(
                asset.duration_seconds,
              )}
            />

            <DetailItem
              label="Languages"
              value={
                asset.languages.length > 0
                  ? asset.languages.join(', ')
                  : 'Not available'
              }
            />

            <DetailItem
              label="Countries"
              value={
                asset.countries.length > 0
                  ? asset.countries.join(', ')
                  : 'Not available'
              }
            />

            <DetailItem
              label="Publishing"
              value={formatStatus(
                asset.status,
              )}
            />

            <DetailItem
              label="Processing"
              value={formatStatus(
                asset.processing_status,
              )}
            />

            <DetailItem
              label="Created"
              value={formatDate(
                asset.created_at,
              )}
            />

            <DetailItem
              label="Updated"
              value={formatDate(
                asset.updated_at,
              )}
            />

            <DetailItem
              label="Active variant"
              value={
                asset.active_variant_id ||
                'Not assigned'
              }
            />

            <DetailItem
              label="Created by"
              value={
                asset.created_by ||
                'Not available'
              }
            />
          </div>

          {asset.description && (
            <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
                Description
              </p>

              <p className="mt-2 text-sm leading-6 text-white/65">
                {asset.description}
              </p>
            </section>
          )}

          <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
              Media references
            </p>

            <div className="mt-3 space-y-3">
              <UrlRow
                label="Poster"
                value={asset.poster_url}
              />

              <UrlRow
                label="Backdrop"
                value={asset.backdrop_url}
              />

              <UrlRow
                label="Trailer"
                value={asset.trailer_url}
              />
            </div>
          </section>

          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.04] p-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />

            <p className="text-xs leading-5 text-white/45">
              Asset information is currently
              read-only. Catalogue editing is
              available separately.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/70 transition hover:bg-white/[0.08] hover:text-white"
          >
            Close details
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailItem({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
        {label}
      </p>

      <p className="mt-2 break-all text-sm text-white/80">
        {value}
      </p>
    </div>
  )
}

function StatusBadge({
  label,
  success = false,
}: {
  label: string
  success?: boolean
}) {
  return (
    <span
      className={
        success
          ? 'rounded-full border border-emerald-400/15 bg-emerald-400/10 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-300'
          : 'rounded-full border border-amber-300/15 bg-amber-300/10 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300'
      }
    >
      {label}
    </span>
  )
}

function UrlRow({
  label,
  value,
}: {
  label: string
  value: string | null
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/10 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/25">
        {label}
      </p>

      <p className="mt-1 break-all text-xs text-white/50">
        {value || 'Not available'}
      </p>
    </div>
  )
 }    
