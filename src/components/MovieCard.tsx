import React from 'react'
import { Check, Info, Play, Plus } from 'lucide-react'

export type MovieCardProps = {
  id: string | number
  title: string
  year?: number | string
  poster?: string
  type?: string
  description?: string
  category?: string
  duration?: string
  rating?: string | number
  featured?: boolean
  downloadable?: boolean
  inMyList?: boolean
  onClick?: () => void
  onPlay?: () => void
  onMyList?: () => void
}

export default function MovieCard({
  title,
  year,
  poster,
  type = 'Movie',
  description,
  category,
  duration,
  rating,
  featured = false,
  downloadable = false,
  inMyList = false,
  onClick,
  onPlay,
  onMyList,
}: MovieCardProps) {
  const handleCardClick = () => {
    onClick?.()
  }

  const handlePlay = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    onPlay?.()
  }

  const handleMyList = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    onMyList?.()
  }

  return (
    <article
      className="group relative w-full cursor-pointer overflow-hidden rounded-2xl bg-white/[0.04] shadow-lg ring-1 ring-white/[0.08] transition-all duration-500 hover:-translate-y-1 hover:bg-white/[0.07] hover:shadow-2xl hover:ring-white/[0.16] focus-within:ring-2 focus-within:ring-white/30"
      onClick={handleCardClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onClick) return

        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
      aria-label={onClick ? `Open ${title}` : undefined}
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-900">
        {poster ? (
          <img
            src={poster}
            alt={title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 via-zinc-900 to-black px-5 text-center">
            <span className="text-sm font-semibold tracking-wide text-white/60">
              {title}
            </span>
          </div>
        )}

        {/* Cinematic gradient */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent opacity-90" />

        {/* Hover cinematic glow */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-white/[0.03] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

        {/* Featured badge */}
        {featured && (
          <div className="absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-black shadow-lg">
            Featured
          </div>
        )}

        {/* Type badge */}
        {type && (
          <div className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur-md ring-1 ring-white/10">
            {type}
          </div>
        )}

        {/* Bottom hover controls */}
        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 opacity-0 translate-y-2 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePlay}
              disabled={!onPlay}
              aria-label={`Play ${title}`}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black shadow-xl transition-transform hover:scale-105 disabled:cursor-default disabled:opacity-50"
            >
              <Play className="ml-0.5 h-4 w-4 fill-current" />
            </button>

            <button
              type="button"
              onClick={handleMyList}
              disabled={!onMyList}
              aria-label={inMyList ? `Remove ${title} from My List` : `Add ${title} to My List`}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-md ring-1 ring-white/20 transition-transform hover:scale-105 disabled:cursor-default disabled:opacity-50"
            >
              {inMyList ? (
                <Check className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </button>

            {onClick && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onClick()
                }}
                aria-label={`More information about ${title}`}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-md ring-1 ring-white/20 transition-transform hover:scale-105"
              >
                <Info className="h-4 w-4" />
              </button>
            )}
          </div>

          {downloadable && (
            <span className="rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-semibold text-white/80 backdrop-blur-md ring-1 ring-white/10">
              Download
            </span>
          )}
        </div>
      </div>

      {/* Information */}
      <div className="space-y-2 p-3.5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-1 text-sm font-bold tracking-tight text-white transition-colors group-hover:text-white">
            {title}
          </h3>

          {rating !== undefined && rating !== null && String(rating).trim() !== '' && (
            <span className="shrink-0 rounded border border-white/15 px-1.5 py-0.5 text-[10px] font-semibold text-white/65">
              {rating}
            </span>
          )}
        </div>

        <div className="flex min-h-4 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-white/45">
          {year !== undefined && year !== null && <span>{year}</span>}

          {year !== undefined && (category || duration) && (
            <span aria-hidden="true">•</span>
          )}

          {category && <span className="line-clamp-1">{category}</span>}

          {category && duration && <span aria-hidden="true">•</span>}

          {duration && <span>{duration}</span>}
        </div>

        {description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-white/45">
            {description}
          </p>
        )}
      </div>
    </article>
  )
 } 
