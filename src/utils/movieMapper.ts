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

function toContentType(value: string | null): ContentType {
  const normalized = value?.toLowerCase().trim()

  if (normalized === 'series' || normalized === 'tv show') {
    return 'tv_show'
  }

  if (normalized === 'documentary') {
    return 'documentary'
  }

  if (normalized === 'short film') {
    return 'short_film'
  }

  return 'movie'
}

function parseRating(value: string | null): number | undefined {
  if (!value) {
    return undefined
  }

  const numericValue = Number.parseFloat(value)

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

  const match = value.match(
    /(\d+(?:\.\d+)?)\s*(?:min|mins|minutes|m)\b/i,
  )

  if (!match) {
    return undefined
  }

  const minutes = Number.parseFloat(match[1])

  return Number.isFinite(minutes)
    ? Math.round(minutes)
    : undefined
}

export function mapSupabaseMovieToCanonical(
  row: LegacyMovieRow,
): Movie {
  const title = row.title?.trim() || 'Untitled'

  return {
    id: String(row.id),

    title,
    originalTitle: title,
    slug: slugify(title),

    synopsis:
      row.description?.trim() ||
      'No description available.',

    contentType: toContentType(row.type),

    releaseYear: row.year ?? undefined,
    runtimeMinutes: parseRuntimeMinutes(row.duration),

    genres: row.category
      ? [slugify(row.category)]
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

    posterUrl: row.poster_url?.trim() || undefined,
    backdropUrl: undefined,
    logoUrl: undefined,

    trailerUrl: row.trailer_url?.trim() || undefined,
    videoUrl: row.video_url?.trim() || undefined,

    videoAssets: [],

    subtitles: [],
    audioTracks: [],

    downloadAvailability: {
      available: row.downloadable === true,
    },

    rating: parseRating(row.rating),
    ratingCount: undefined,

    ageRating: row.rating?.trim() || undefined,
    videoQualities: [],

    collectionIds: [],

    isFeatured: row.featured === true,
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
  return rows.map(mapSupabaseMovieToCanonical)
  }
