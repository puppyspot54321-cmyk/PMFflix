import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Film,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Video,
} from 'lucide-react'
import { supabase } from './supabase'

type AdminRole = 'owner' | 'admin' | 'editor'

type StudioMovie = {
  id: number
  title: string
  year: number | null
  type: string | null
  category: string | null
  featured: boolean
}

type StudioAsset = {
  id: string
  title: string
  media_type: string | null
  status: string | null
  processing_status: string | null
  featured: boolean
  created_at: string | null
}

type AdminStudioProps = {
  onClose?: () => void
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

  const [loading, setLoading] =
    useState(true)

  const [refreshing, setRefreshing] =
    useState(false)

  const [authorized, setAuthorized] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

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
              'id,title,year,type,category,featured',
            )
            .order('created_at', {
              ascending: false,
            }),

          supabase
            .from('media_assets')
            .select(
              'id,title,media_type,status,processing_status,featured,created_at',
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
              Studio foundation
            </div>

            <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              Build the PMF universe from
              one command center.
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50 sm:text-base">
              Catalogue intelligence, media
              readiness and publishing signals
              are now visible in one protected
              workspace.
            </p>

            <div className="mt-6 flex flex-wrap gap-4 text-xs text-white/45">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                Authorized session
              </span>

              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-amber-300" />
                Read-only foundation
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
                  Current titles connected to
                  PMF-Flix
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
                    <div
                      key={movie.id}
                      className="flex items-center justify-between gap-4 px-5 py-4"
                    >
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

                      <span className="shrink-0 text-[10px] text-white/25">
                        #{movie.id}
                      </span>
                    </div>
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
                      <div
                        key={asset.id}
                        className="px-5 py-4"
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
                      </div>
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
                Foundation online
              </h3>

              <p className="mt-1 text-xs leading-5 text-white/35">
                This first layer is intentionally
                read-only. Editing, ingestion and
                publishing controls will be added
                separately.
              </p>
            </div>
          </div>
        </section>
      </main>
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
