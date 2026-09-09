import type { Person, CastMember } from './person'
import type {
  SubtitleTrack,
  AudioTrack,
  VideoAsset,
} from './media'

export interface Episode {
  id: string
  seasonId: string

  title: string
  episodeNumber: number
  seasonNumber: number

  synopsis?: string
  runtimeMinutes?: number
  releaseDate?: string

  posterUrl?: string

  cast: CastMember[]
  directors: Person[]
  writers: Person[]

  videoAssets: VideoAsset[]
  subtitles: SubtitleTrack[]
  audioTracks: AudioTrack[]

  isPremium: boolean

  viewCount: number

  createdAt: string
  updatedAt: string
}

export interface Season {
  id: string
  showId: string

  title: string
  seasonNumber: number

  synopsis?: string
  posterUrl?: string

  episodes: Episode[]

  createdAt: string
  updatedAt: string
}

export interface TVShow {
  id: string

  title: string
  originalTitle?: string
  slug: string
  tagline?: string
  synopsis: string

  releaseYear?: number

  genres: string[]
  subgenres: string[]
  tags: string[]

  countryIds: string[]
  regionIds: string[]
  industryIds: string[]
  languageIds: string[]

  originalLanguageId?: string

  cast: CastMember[]
  directors: Person[]
  writers: Person[]
  producers: Person[]

  posterUrl?: string
  backdropUrl?: string
  logoUrl?: string

  trailerUrl?: string

  seasons: Season[]

  collectionIds: string[]

  ageRating?: string

  rating?: number
  ratingCount?: number

  isFeatured: boolean
  isTrending: boolean
  isNewRelease: boolean
  isComingSoon: boolean
  isPmfOriginal: boolean
  isPremium: boolean

  viewCount: number

  createdAt: string
  updatedAt: string
  }
