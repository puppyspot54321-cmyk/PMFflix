import type { Movie } from '../types/movie'
import type { ContentType } from '../types/content'

export interface LegacyMovieRow {
  id: number
  created_at: string
  title: string | null
  year: number | null
  description: string | null
  category: string | null
  type: string | null
  duration: string | null
  rating: string | null
  poster_url: string | null
  video_url: string | null
  trailer_url: string | null
  featured: boolean | null
  downloadable: boolean | null
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function toContentType(
  value: string | null,
): ContentType {
  const normalized =
    value?.toLowerCase().trim()

  if (
    normalized === 'series' ||
    normalized === 'tv show' ||
    normalized === 'tv series' ||
    normalized === 'tv_show'
  ) {
    return 'tv_show'
  }

  if (normalized === 'season') {
    return 'season'
  }

  if (normalized === 'episode') {
    return 'episode'
  }

  if (normalized === 'documentary') {
    return 'documentary'
  }

  if (
    normalized === 'short film' ||
    normalized === 'short_film'
  ) {
    return 'short_film'
  }

  if (normalized === 'special') {
    return 'special'
  }

  return 'movie'
}

function parseRating(
  value: string | null,
): number | undefined {
  if (!value) {
    return undefined
  }

  const numericValue =
    Number.parseFloat(value)

  return Number.isFinite(numericValue)
    ? numericValue
    : undefined
}

function parseRuntimeMinutes(
  value: string | null,
): number | undefined {
  if (!value) {
    return undefined
  }

  const normalized = value.trim()

  const hourMatch = normalized.match(
    /(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i,
  )

  const minuteMatch = normalized.match(
    /(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b/i,
  )

  const hours = hourMatch
    ? Number.parseFloat(hourMatch[1])
    : 0

  const minutes = minuteMatch
    ? Number.parseFloat(minuteMatch[1])
    : 0

  if (
    Number.isFinite(hours) &&
    Number.isFinite(minutes) &&
    (hours > 0 || minutes > 0)
  ) {
    return Math.round(
      hours * 60 + minutes,
    )
  }

  const numericValue =
    Number.parseFloat(normalized)

  return Number.isFinite(numericValue)
    ? Math.round(numericValue)
    : undefined
}

function toBoolean(
  value: boolean | null,
): boolean {
  return value === true
}

export function mapSupabaseMovieToCanonical(
  row: LegacyMovieRow,
): Movie {
  const title =
    row.title?.trim() || 'Untitled'

  const category =
    row.category?.trim() || ''

  const contentType =
    toContentType(row.type)

  return {
    id: String(row.id),

    title,
    originalTitle: title,
    slug: slugify(title),

    synopsis:
      row.description?.trim() ||
      'No description available.',

    contentType,

    releaseYear:
      row.year ?? undefined,

    runtimeMinutes:
      parseRuntimeMinutes(row.duration),

    genres: category
      ? [slugify(category)]
      : [],

    subgenres: [],
    tags: [],

    countryIds: [],
    regionIds: [],
    industryIds: [],

    languageIds: [],
    originalLanguageId: undefined,

    cast: [],
    directors: [],
    writers: [],
    producers: [],

    posterUrl:
      row.poster_url?.trim() ||
      undefined,

    backdropUrl: undefined,
    logoUrl: undefined,

    trailerUrl:
      row.trailer_url?.trim() ||
      undefined,

    videoUrl:
      row.video_url?.trim() ||
      undefined,

    videoAssets: [],

    subtitles: [],
    audioTracks: [],

    downloadAvailability: {
      available:
        toBoolean(row.downloadable),
    },

    rating:
      parseRating(row.rating),

    ratingCount: undefined,

    ageRating:
      row.rating?.trim() ||
      undefined,

    videoQualities: [],

    collectionIds: [],

    isFeatured:
      toBoolean(row.featured),

    isTrending: false,
    isNewRelease: false,
    isComingSoon: false,
    isPmfOriginal: false,
    isPremium: false,

    viewCount: 0,

    createdAt: row.created_at,
    updatedAt: row.created_at,
  }
}

export function mapSupabaseMoviesToCanonical(
  rows: LegacyMovieRow[],
): Movie[] {
  return rows.map(
    mapSupabaseMovieToCanonical,
  )
}

export function mapCanonicalMovieToLegacy(
  movie: Movie,
): {
  id: number
  title: string
  year: number
  poster: string
  type: 'Movie' | 'Series'
  description: string
  category: string
  duration?: string
  rating?: string
  videoUrl?: string
  trailerUrl?: string
  featured: boolean
  downloadable: boolean
} {
  return {
    id: Number(movie.id),

    title: movie.title,

    year:
      movie.releaseYear ??
      new Date().getFullYear(),

    poster:
      movie.posterUrl ?? '',

    type:
      movie.contentType === 'tv_show'
        ? 'Series'
        : 'Movie',

    description:
      movie.synopsis,

    category:
      movie.genres[0] ?? 'Other',

    duration:
      movie.runtimeMinutes !== undefined
        ? `${movie.runtimeMinutes} min`
        : undefined,

    rating:
      movie.rating !== undefined
        ? String(movie.rating)
        : undefined,

    videoUrl:
      movie.videoUrl,

    trailerUrl:
      movie.trailerUrl,

    featured:
      movie.isFeatured,

    downloadable:
      movie.downloadAvailability
        ?.available ?? false,
  }
}
