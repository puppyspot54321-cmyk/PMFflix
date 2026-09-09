export type ContentType =
  | 'movie'
  | 'tv_show'
  | 'season'
  | 'episode'
  | 'short_film'
  | 'documentary'
  | 'special'

export interface AgeRating {
  id: string
  name: string
  description?: string
  minimumAge?: number
}
