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

const uniqueStrings = (values: string[]): string[] => {
  return Array.from(
    new Set(values.filter(Boolean)),
  )
}

const getRelationshipRows = async (
  table: string,
): Promise<MetadataRelationRow[]> => {
  const { data, error } = await supabase
    .from(table)
    .select('*')

  if (error) {
    throw error
  }

  return (data ?? []) as MetadataRelationRow[]
}

const loadAllRelationships = async (): Promise<
  Record<RelationKey, MetadataRelationRow[]>
> => {
  const [
    genres,
    subgenres,
    countries,
    regions,
    industries,
    languages,
    tags,
    collections,
  ] = await Promise.all([
    getRelationshipRows(relationTables.genres),
    getRelationshipRows(relationTables.subgenres),
    getRelationshipRows(relationTables.countries),
    getRelationshipRows(relationTables.regions),
    getRelationshipRows(relationTables.industries),
    getRelationshipRows(relationTables.languages),
    getRelationshipRows(relationTables.tags),
    getRelationshipRows(relationTables.collections),
  ])

  return {
    genres,
    subgenres,
    countries,
    regions,
    industries,
    languages,
    tags,
    collections,
  }
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

    const genreIds = relationships.genres
      .filter(
        (row) =>
          row.movie_id === movieId &&
          row.genre_id,
      )
      .map((row) => row.genre_id as string)

    const subgenreIds = relationships.subgenres
      .filter(
        (row) =>
          row.movie_id === movieId &&
          row.subgenre_id,
      )
      .map(
        (row) => row.subgenre_id as string,
      )

    const countryIds = relationships.countries
      .filter(
        (row) =>
          row.movie_id === movieId &&
          row.country_id,
      )
      .map(
        (row) => row.country_id as string,
      )

    const regionIds = relationships.regions
      .filter(
        (row) =>
          row.movie_id === movieId &&
          row.region_id,
      )
      .map(
        (row) => row.region_id as string,
      )

    const industryIds = relationships.industries
      .filter(
        (row) =>
          row.movie_id === movieId &&
          row.industry_id,
      )
      .map(
        (row) => row.industry_id as string,
      )

    const languageIds = relationships.languages
      .filter(
        (row) =>
          row.movie_id === movieId &&
          row.language_id,
      )
      .map(
        (row) => row.language_id as string,
      )

    const tagIds = relationships.tags
      .filter(
        (row) =>
          row.movie_id === movieId &&
          row.tag_id,
      )
      .map((row) => row.tag_id as string)

    const collectionIds =
      relationships.collections
        .filter(
          (row) =>
            row.movie_id === movieId &&
            row.collection_id,
        )
        .map(
          (row) =>
            row.collection_id as string,
        )

    return {
      ...movie,

      genres: uniqueStrings([
        ...movie.genres,
        ...genreIds,
      ]),

      subgenres: uniqueStrings([
        ...movie.subgenres,
        ...subgenreIds,
      ]),

      countryIds: uniqueStrings([
        ...movie.countryIds,
        ...countryIds,
      ]),

      regionIds: uniqueStrings([
        ...movie.regionIds,
        ...regionIds,
      ]),

      industryIds: uniqueStrings([
        ...movie.industryIds,
        ...industryIds,
      ]),

      languageIds: uniqueStrings([
        ...movie.languageIds,
        ...languageIds,
      ]),

      tags: uniqueStrings([
        ...movie.tags,
        ...tagIds,
      ]),

      collectionIds: uniqueStrings([
        ...movie.collectionIds,
        ...collectionIds,
      ]),
    }
  })
}

export const getMovies = async (): Promise<Movie[]> => {
  const { data, error } = await supabase
    .from('movies')
    .select('*')
    .order('created_at', {
      ascending: false,
    })

  if (error) {
    throw error
  }

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

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

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
