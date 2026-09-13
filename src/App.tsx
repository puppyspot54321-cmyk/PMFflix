import { supabase } from '../supabase'
import type { Movie } from '../types/movie'
import {
  mapSupabaseMovieToCanonical,
  mapSupabaseMoviesToCanonical,
} from '../utils/movieMapper'

type MetadataRelationRow = {
  movie_id: number
  genre_id?: string
  subgenre_id?: string
  country_id?: string
  region_id?: string
  industry_id?: string
  language_id?: string
  tag_id?: string
  collection_id?: string
}

const relationTables = {
  genres: 'movie_genres',
  subgenres: 'movie_subgenres',
  countries: 'movie_countries',
  regions: 'movie_regions',
  industries: 'movie_industries',
  languages: 'movie_languages',
  tags: 'movie_tags',
  collections: 'movie_collections',
} as const

type RelationKey = keyof typeof relationTables

const uniqueStrings = (values: string[]) =>
  Array.from(new Set(values.filter(Boolean)))

const getRelationshipRows = async (
  table: string,
): Promise<MetadataRelationRow[]> => {
  const { data, error } = await supabase
    .from(table)
    .select('*')

  if (error) throw error
  return (data ?? []) as MetadataRelationRow[]
}

const loadAllRelationships = async (): Promise<
  Record<RelationKey, MetadataRelationRow[]>
> => {
  const keys = Object.keys(relationTables) as RelationKey[]

  const rows = await Promise.all(
    keys.map((key) =>
      getRelationshipRows(relationTables[key]),
    ),
  )

  return Object.fromEntries(
    keys.map((key, i) => [key, rows[i]]),
  ) as Record<
    RelationKey,
    MetadataRelationRow[]
  >
}

const attachMetadata = (
  movies: Movie[],
  relationships: Record<
    RelationKey,
    MetadataRelationRow[]
  >,
): Movie[] => {

    return movies.map((movie) => {
    const movieId = Number(movie.id)

    const ids = (
      key: RelationKey,
      field:
        | 'genre_id'
        | 'subgenre_id'
        | 'country_id'
        | 'region_id'
        | 'industry_id'
        | 'language_id'
        | 'tag_id'
        | 'collection_id',
    ) =>
      relationships[key]
        .filter(
          (row) =>
            row.movie_id === movieId &&
            row[field],
        )
        .map((row) => row[field] as string)

    return {
      ...movie,

      genres: uniqueStrings([
        ...movie.genres,
        ...ids('genres', 'genre_id'),
      ]),

      subgenres: uniqueStrings([
        ...movie.subgenres,
        ...ids('subgenres', 'subgenre_id'),
      ]),

      countryIds: uniqueStrings([
        ...movie.countryIds,
        ...ids('countries', 'country_id'),
      ]),

      regionIds: uniqueStrings([
        ...movie.regionIds,
        ...ids('regions', 'region_id'),
      ]),

      industryIds: uniqueStrings([
        ...movie.industryIds,
        ...ids('industries', 'industry_id'),
      ]),

      languageIds: uniqueStrings([
        ...movie.languageIds,
        ...ids('languages', 'language_id'),
      ]),

      tags: uniqueStrings([
        ...movie.tags,
        ...ids('tags', 'tag_id'),
      ]),

      collectionIds: uniqueStrings([
        ...movie.collectionIds,
        ...ids('collections', 'collection_id'),
      ]),
    }
  })
}

export const getMovies = async (): Promise<Movie[]> => {
  const { data, error } = await supabase
    .from('movies')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error

  const movies =
    mapSupabaseMoviesToCanonical(data ?? [])

  const relationships =
    await loadAllRelationships()

  return attachMetadata(
    movies,
    relationships,
  )
}

export const getMovieById = async (
  id: string | number,
): Promise<Movie | null> => {
  const numericId = Number(id)

  if (!Number.isFinite(numericId)) {
    return null
  }

  const { data, error } = await supabase
    .from('movies')
    .select('*')
    .eq('id', numericId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const movie =
    mapSupabaseMovieToCanonical(data)

  const relationships =
    await loadAllRelationships()

  const [result] = attachMetadata(
    [movie],
    relationships,
  )

  return result ?? null
}
