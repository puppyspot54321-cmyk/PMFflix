import { supabase, isSupabaseConfigured } from '../supabase'
import {
  movies as initialMovies,
  resolveMovieStreamUrl,
  isUnapprovedDemoMovie,
  type Movie,
  type MoviePublishStatus,
} from '../movieData/movies'

export const OWNER_EMAIL = 'puppyspot54321@gmail.com'

export function isVerifiedOwnerEmail(email?: string | null): boolean {
  return String(email || '').trim().toLowerCase() === OWNER_EMAIL
}

const LOCAL_ADMIN_CACHE_KEY = 'pmf_admin_movies_cache'
const LEGACY_OWNER_CACHE_KEY = 'pmf_owner_movies_cache_v1'
const EXTENDED_META_KEY = 'pmf_movie_extended_meta_v1'

export type ExtendedMovieMeta = {
  seriesTitle?: string
  seasonNumber?: number
  episodeNumber?: number
  telegramMessageId?: string | number
  isMidnight18?: boolean
  isKids?: boolean
  status?: MoviePublishStatus
}

export type ParsedTelegramCaption = {
  type: 'movie' | 'series' | 'skit' | 'short' | 'novel' | 'sport' | 'midnight18'
  title: string
  category: string
  seriesTitle: string
  seasonNumber?: number
  episodeNumber?: number
  mature: boolean
  kidsSafe: boolean
  downloadable: boolean
  summary: string
  year?: number
  duration?: string
  rating?: string
  telegramMessageId?: string
  videoUrl?: string
  posterUrl?: string
  status: MoviePublishStatus
}

export function parseTelegramChannelCaption(caption: string): ParsedTelegramCaption {
  const lines = String(caption || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const kv: Record<string, string> = {}
  const freeformSummaryLines: string[] = []

  for (const line of lines) {
    const match = line.match(/^([A-Z_a-z0-9\s]+?)\s*:\s*(.+)$/)
    if (match) {
      const key = match[1].trim().toUpperCase().replace(/\s+/g, '_')
      const val = match[2].trim()
      kv[key] = val
    } else {
      freeformSummaryLines.push(line)
    }
  }

  const rawType = (kv.TYPE || 'movie').toLowerCase().trim()
  let normalizedType: ParsedTelegramCaption['type'] = 'movie'
  if (rawType.includes('series') || rawType.includes('episode')) normalizedType = 'series'
  else if (rawType.includes('skit')) normalizedType = 'skit'
  else if (rawType.includes('short')) normalizedType = 'short'
  else if (rawType.includes('novel') || rawType.includes('story') || rawType.includes('book'))
    normalizedType = 'novel'
  else if (rawType.includes('sport')) normalizedType = 'sport'
  else if (rawType.includes('midnight') || rawType.includes('18')) normalizedType = 'midnight18'

  const mature =
    normalizedType === 'midnight18' ||
    /^(true|yes|1|18\+)$/i.test(kv.MATURE || kv.ADULT || kv.MIDNIGHT18 || '')
  const kidsSafe =
    !mature && /^(true|yes|1)$/i.test(kv.KIDS_SAFE || kv.KIDS || kv.FAMILY_SAFE || '')
  const downloadable = !/^(false|no|0)$/i.test(kv.DOWNLOADABLE || 'true')

  const seasonNumber = kv.SEASON ? Number(kv.SEASON) : undefined
  const episodeNumber = kv.EPISODE ? Number(kv.EPISODE) : undefined
  const year = kv.YEAR ? Number(kv.YEAR) : new Date().getFullYear()
  const telegramMessageId = kv.MESSAGE_ID || kv.TELEGRAM_ID || kv.BRIDGE_ID || undefined

  // Telegram message IDs are metadata, not PMF-Flix movie IDs.
  // The stream URL is resolved later using the movie ID after the bridge maps the upload.
  const videoUrl = kv.STREAM_URL || kv.VIDEO_URL || ''

  const rawStatus = (kv.STATUS || 'pending').toLowerCase().trim()
  const status: MoviePublishStatus =
    rawStatus === 'published' ||
    rawStatus === 'draft' ||
    rawStatus === 'pending' ||
    rawStatus === 'rejected' ||
    rawStatus === 'unpublished' ||
    rawStatus === 'archived'
      ? rawStatus
      : 'pending'

  return {
    type: normalizedType,
    title: kv.TITLE || kv.NAME || '',
    category:
      kv.CATEGORY ||
      kv.GENRE ||
      (normalizedType === 'midnight18'
        ? 'Midnight 18+'
        : normalizedType === 'sport'
          ? 'Live Sports'
          : 'Drama'),
    seriesTitle: kv.SERIES || '',
    seasonNumber: Number.isFinite(seasonNumber) ? seasonNumber : undefined,
    episodeNumber: Number.isFinite(episodeNumber) ? episodeNumber : undefined,
    mature,
    kidsSafe,
    downloadable,
    summary: kv.SUMMARY || kv.DESCRIPTION || freeformSummaryLines.join(' ').trim(),
    year: Number.isFinite(year) ? year : new Date().getFullYear(),
    duration: kv.DURATION || undefined,
    rating: kv.RATING || (mature ? '18+' : undefined),
    telegramMessageId,
    videoUrl: videoUrl || undefined,
    posterUrl: kv.POSTER_URL || kv.POSTER || kv.COVER || undefined,
    status,
  }
}

export function getExtendedMovieMetaMap(): Record<string, ExtendedMovieMeta> {
  try {
    const raw = localStorage.getItem(EXTENDED_META_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveExtendedMovieMeta(movieId: string | number, meta: ExtendedMovieMeta): void {
  try {
    const current = getExtendedMovieMetaMap()
    current[String(movieId)] = {
      ...current[String(movieId)],
      ...meta,
    }
    localStorage.setItem(EXTENDED_META_KEY, JSON.stringify(current))
  } catch {}
}

export type DbMovieRow = {
  id: string | number
  title?: string | null
  year?: number | string | null
  category?: string | null
  type?: 'Movie' | 'Series' | string | null
  rating?: number | string | null
  duration?: string | null
  description?: string | null
  poster?: string | null
  poster_url?: string | null
  backdrop?: string | null
  backdrop_url?: string | null
  featured?: boolean | null
  video_url?: string | null
  videoUrl?: string | null
  video_type?: string | null
  videoType?: string | null
  trailer_url?: string | null
  trailerUrl?: string | null
  downloadable?: boolean | null
  series_title?: string | null
  season_number?: number | null
  episode_number?: number | null
  telegram_message_id?: string | number | null
  is_midnight_18?: boolean | null
  is_kids?: boolean | null
  status?: MoviePublishStatus | null
}

function detectVideoType(url: string, explicitType?: string | null): 'youtube' | 'mp4' | 'hls' | string {
  const cleanExplicit = String(explicitType || '').trim().toLowerCase()
  const cleanUrl = String(url || '').trim()

  if (!cleanUrl) return cleanExplicit || 'mp4'
  if (/youtube\.com|youtu\.be/i.test(cleanUrl)) return 'youtube'
  if (/\.m3u8(\?|$)/i.test(cleanUrl)) return 'hls'
  if (cleanExplicit && cleanExplicit !== 'youtube') return cleanExplicit
  return 'mp4'
}

function normalizeMovie(row: DbMovieRow): Movie {
  const id = String(row.id)
  const ext = getExtendedMovieMetaMap()[id] || {}
  const baselineMatch = initialMovies.find((m) => String(m.id) === id)

  const rawVideoUrl = String(row.videoUrl || row.video_url || '').trim()
  const resolvedUrl = resolveMovieStreamUrl({
    id,
    videoUrl: rawVideoUrl,
    telegramMessageId: row.telegram_message_id ?? ext.telegramMessageId,
  })

  const videoType = detectVideoType(resolvedUrl, row.videoType || row.video_type)
  const category = String(row.category || baselineMatch?.category || 'Action')
  const rating = row.rating ?? baselineMatch?.rating ?? '16+'

  const isMidnight18 =
    Boolean(row.is_midnight_18) ||
    Boolean(ext.isMidnight18) ||
    /midnight|18\+|adult|nc-17|tv-ma/i.test(`${category} ${rating}`)

  const isKids =
    !isMidnight18 &&
    (Boolean(row.is_kids) ||
      Boolean(ext.isKids) ||
      /kids|family|animation/i.test(category))

  const status: MoviePublishStatus =
    row.status || ext.status || baselineMatch?.status || 'published'

  return {
    id,
    title: String(row.title || baselineMatch?.title || 'Untitled'),
    year: Number(row.year || baselineMatch?.year || 2026),
    category,
    type: (row.type as 'Movie' | 'Series') || baselineMatch?.type || 'Movie',
    rating,
    duration: row.duration || baselineMatch?.duration || '2h 00m',
    description: row.description || baselineMatch?.description || '',
    poster:
      row.poster ||
      row.poster_url ||
      baselineMatch?.poster ||
      '',
    backdrop:
      row.backdrop ||
      row.backdrop_url ||
      row.poster ||
      row.poster_url ||
      baselineMatch?.poster ||
      undefined,
    featured: !isMidnight18 && status === 'published' && Boolean(row.featured ?? baselineMatch?.featured),
    videoUrl: resolvedUrl,
    videoType,
    trailerUrl: row.trailerUrl || row.trailer_url || baselineMatch?.trailerUrl || undefined,
    downloadable:
      row.downloadable !== undefined && row.downloadable !== null
        ? Boolean(row.downloadable)
        : true,
    isMidnight18,
    isKids,
    seriesTitle: row.series_title || ext.seriesTitle || undefined,
    seasonNumber: row.season_number ?? ext.seasonNumber ?? undefined,
    episodeNumber: row.episode_number ?? ext.episodeNumber ?? undefined,
    telegramMessageId: row.telegram_message_id ?? ext.telegramMessageId ?? undefined,
    status,
  }
}

export function filterOutUnapprovedMovies<
  T extends {
    title?: string | null
    seriesTitle?: string | null
    series_title?: string | null
  },
>(list: T[]): T[] {
  return list.filter((item) => !isUnapprovedDemoMovie(item))
}

export function getCachedAdminMovies(): Movie[] {
  try {
    // Also clean legacy cache key if present
    localStorage.removeItem(LEGACY_OWNER_CACHE_KEY)
    const raw = localStorage.getItem(LOCAL_ADMIN_CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const sanitized = filterOutUnapprovedMovies(parsed as DbMovieRow[])
    if (sanitized.length !== parsed.length) {
      localStorage.setItem(LOCAL_ADMIN_CACHE_KEY, JSON.stringify(sanitized))
    }
    return sanitized.map((m) => normalizeMovie(m))
  } catch {
    return []
  }
}

export function saveCachedAdminMovies(moviesList: Movie[]): void {
  try {
    const sanitized = filterOutUnapprovedMovies(moviesList)
    localStorage.setItem(LOCAL_ADMIN_CACHE_KEY, JSON.stringify(sanitized))
  } catch {}
}

export function upsertMovieInCache(movie: DbMovieRow | Movie): Movie {
  const normalized = normalizeMovie(movie as DbMovieRow)
  if (isUnapprovedDemoMovie(normalized)) {
    return normalized
  }
  const current = getCachedAdminMovies()
  const existingIndex = current.findIndex((m) => String(m.id) === String(normalized.id))

  if (existingIndex >= 0) {
    current[existingIndex] = { ...current[existingIndex], ...normalized }
  } else {
    current.unshift(normalized)
  }

  saveCachedAdminMovies(current)
  return normalized
}

export function setMoviePublishStatus(
  movieId: string | number,
  status: MoviePublishStatus,
): void {
  saveExtendedMovieMeta(movieId, { status })
  const current = getCachedAdminMovies()
  const idx = current.findIndex((m) => String(m.id) === String(movieId))
  if (idx >= 0) {
    current[idx] = {
      ...current[idx],
      status,
      featured: status === 'published' ? current[idx].featured : false,
    }
    saveCachedAdminMovies(current)
  }
  notifyMovieUpdates()
}

export function deleteMovieFromCache(id: string | number): void {
  const current = getCachedAdminMovies()
  const filtered = current.filter((m) => String(m.id) !== String(id))
  saveCachedAdminMovies(filtered)
}

/**
 * Duplicate prevention helper for Telegram ingestion & Studio catalogue creation.
 */
export interface DuplicateCheckCandidate {
  id?: string | number | null
  title?: string | null
  seriesTitle?: string | null
  series_title?: string | null
  seasonNumber?: number | string | null
  season_number?: number | string | null
  episodeNumber?: number | string | null
  episode_number?: number | string | null
  telegramMessageId?: string | number | null
  telegram_message_id?: string | number | null
}

export function findDuplicateMovie<T extends DuplicateCheckCandidate>(
  candidate: DuplicateCheckCandidate,
  existingList: T[],
): T | null {
  const editingId = candidate.id !== undefined && candidate.id !== null ? String(candidate.id) : null
  const candMsgId = String(candidate.telegramMessageId || '').trim()
  const candTitle = String(candidate.title || '').trim().toLowerCase()
  const candSeries = String(candidate.seriesTitle || '').trim().toLowerCase()
  const candSeason = candidate.seasonNumber ? Number(candidate.seasonNumber) : 0
  const candEpisode = candidate.episodeNumber ? Number(candidate.episodeNumber) : 0

  for (const item of existingList) {
    if (editingId && String(item.id) === editingId) continue
    const ext = getExtendedMovieMetaMap()[String(item.id)] || {}
    const itemMsgId = String(
      item.telegramMessageId ?? item.telegram_message_id ?? ext.telegramMessageId ?? '',
    ).trim()

    if (candMsgId && itemMsgId && candMsgId === itemMsgId) {
      return item
    }

    const itemTitle = String(item.title || '').trim().toLowerCase()
    const itemSeries = String(item.seriesTitle || item.series_title || ext.seriesTitle || '')
      .trim()
      .toLowerCase()
    const itemSeason = Number(item.seasonNumber ?? item.season_number ?? ext.seasonNumber ?? 0)
    const itemEpisode = Number(item.episodeNumber ?? item.episode_number ?? ext.episodeNumber ?? 0)

    if (
      candTitle &&
      candTitle === itemTitle &&
      candSeries === itemSeries &&
      candSeason === itemSeason &&
      candEpisode === itemEpisode
    ) {
      return item
    }
  }

  return null
}

export async function getMovies(onlyPublished = true): Promise<Movie[]> {
  const applyVisibilityFilter = (items: Movie[]): Movie[] => {
    const clean = filterOutUnapprovedMovies(items)
    if (!onlyPublished) return clean
    return clean.filter((m) => (m.status || 'published') === 'published')
  }

  // The configured Supabase catalogue is the single source of truth.
  // Never re-introduce bundled starter titles or stale local cache entries:
  // deleted database rows must stay deleted in every fresh build.
  if (!isSupabaseConfigured) {
    return []
  }

  try {
    const { data, error } = await supabase
      .from('movies')
      .select('*')
      .order('id', { ascending: false })

    if (error) {
      console.error('PMF catalogue could not be refreshed from Supabase:', error)
      throw error
    }

    const rows = filterOutUnapprovedMovies((data || []) as DbMovieRow[])
    const dbMovies = rows.map(normalizeMovie)
    const movieIds = rows.map((row) => Number(row.id)).filter((id) => Number.isSafeInteger(id))

    if (!movieIds.length) return applyVisibilityFilter(dbMovies)

    const [genreLinks, collectionLinks, industryLinks, peopleLinks, partnerLinks] = await Promise.all([
      supabase.from('movie_genres').select('movie_id,genre_id').in('movie_id', movieIds),
      supabase.from('movie_collections').select('movie_id,collection_id').in('movie_id', movieIds),
      supabase.from('movie_industries').select('movie_id,industry_id').in('movie_id', movieIds),
      supabase.from('movie_people').select('movie_id,person_id,role,character_name').in('movie_id', movieIds),
      supabase.from('movie_content_partners').select('movie_id,partner_id,role').in('movie_id', movieIds),
    ])

    const relationError = [genreLinks.error, collectionLinks.error, industryLinks.error, peopleLinks.error, partnerLinks.error].find(Boolean)
    if (relationError) {
      console.warn('PMF catalogue metadata could not be fully loaded:', relationError.message)
    }

    const groupByMovie = <T extends { movie_id: number }>(items: T[] | null | undefined) => {
      const grouped = new Map<number, T[]>()
      for (const item of items || []) {
        const current = grouped.get(Number(item.movie_id)) || []
        current.push(item)
        grouped.set(Number(item.movie_id), current)
      }
      return grouped
    }

    const genresByMovie = groupByMovie(genreLinks.data)
    const collectionsByMovie = groupByMovie(collectionLinks.data)
    const industriesByMovie = groupByMovie(industryLinks.data)
    const peopleByMovie = groupByMovie(peopleLinks.data)
    const partnersByMovie = groupByMovie(partnerLinks.data)

    const enrichedMovies = dbMovies.map((movie) => {
      const id = Number(movie.id)
      return {
        ...movie,
        genreIds: (genresByMovie.get(id) || []).map((item) => String((item as { genre_id: string }).genre_id)),
        collectionIds: (collectionsByMovie.get(id) || []).map((item) => String((item as { collection_id: string }).collection_id)),
        industryIds: (industriesByMovie.get(id) || []).map((item) => String((item as { industry_id: string }).industry_id)),
        peopleCredits: (peopleByMovie.get(id) || []).map((item) => ({
          personId: String((item as { person_id: string }).person_id),
          role: String((item as { role: string }).role),
          characterName: (item as { character_name?: string | null }).character_name || undefined,
        })),
        partnerCredits: (partnersByMovie.get(id) || []).map((item) => ({
          partnerId: String((item as { partner_id: string }).partner_id),
          role: String((item as { role: string }).role),
        })),
      }
    })
    return applyVisibilityFilter(enrichedMovies)
  } catch (error) {
    console.error('PMF catalogue refresh failed:', error)
    throw error
  }
}
export async function getMovieById(id: string | number): Promise<Movie | null> {
  const all = await getMovies(false)
  return all.find((m) => String(m.id) === String(id)) || null
}

export function notifyMovieUpdates(): void {
  window.dispatchEvent(new CustomEvent('pmf-movies-updated'))
}
