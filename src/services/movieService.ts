import { supabase } from '../supabase'
import {
  mapSupabaseMoviesToCanonical,
  type LegacyMovieRow,
} from '../utils/movieMapper'
import type { Movie } from '../types/movie'

interface MetadataRelationRow {
  movie_id: number
  genre_id?: string
  subgenre_id?: string
  country_id?: string
  region_id?: string
  industry_id?: string
  language_id?: string
  tag_id?: string
  collection_id?: string
  person_id?: string
  role?: string
  character_name?: string | null
  billing_order?: number | null
}

interface MetadataLookupRow {
  id: string
  name: string
  slug?: string
}

async function getRelationshipRows(
  table:
    | 'movie_genres'
    | 'movie_subgenres'
    | 'movie_countries'
    | 'movie_regions'
    | 'movie_industries'
    | 'movie_languages'
    | 'movie_tags'
    | 'movie_collections'
    | 'movie_people',
): Promise<MetadataRelationRow[]> {
  const { data, error } = await supabase
    .from(table)
    .select('*')

  if (error) {
    throw new Error(`Unable to load ${table}: ${error.message}`)
  }

  return (data ?? []) as MetadataRelationRow[]
}

async function getLookupRows(
  table:
    | 'genres'
    | 'subgenres'
    | 'countries'
    | 'regions'
    | 'film_industries'
    | 'languages'
    | 'tags'
    | 'collections'
    | 'people',
): Promise<MetadataLookupRow[]> {
  const { data, error } = await supabase
    .from(table)
    .select('id, name, slug')

  if (error) {
    throw new Error(`Unable to load ${table}: ${error.message}`)
  }

  return (data ?? []) as MetadataLookupRow[]
}

function buildLookupMap(
  rows: MetadataLookupRow[],
): Map<string, MetadataLookupRow> {
  return new Map(rows.map((row) => [row.id, row]))
}

function attachMetadata(
  movies: Movie[],
  relationships: {
    genres: MetadataRelationRow[]
    subgenres: MetadataRelationRow[]
    countries: MetadataRelationRow[]
    regions: MetadataRelationRow[]
    industries: MetadataRelationRow[]
    languages: MetadataRelationRow[]
    tags: MetadataRelationRow[]
    collections: MetadataRelationRow[]
    people: MetadataRelationRow[]
  },
  lookups: {
    genres: Map<string, MetadataLookupRow>
    subgenres: Map<string, MetadataLookupRow>
    countries: Map<string, MetadataLookupRow>
    regions: Map<string, MetadataLookupRow>
    industries: Map<string, MetadataLookupRow>
    languages: Map<string, MetadataLookupRow>
    tags: Map<string, MetadataLookupRow>
    collections: Map<string, MetadataLookupRow>
  },
): Movie[] {
  return movies.map((movie) => {
    const movieId = Number(movie.id)

    const movieGenres = relationships.genres
      .filter((row) => row.movie_id === movieId && row.genre_id)
      .map((row) => row.genre_id as string)

    const movieSubgenres = relationships.subgenres
      .filter((row) => row.movie_id === movieId && row.subgenre_id)
      .map((row) => row.subgenre_id as string)

    const movieCountries = relationships.countries
      .filter((row) => row.movie_id === movieId && row.country_id)
      .map((row) => row.country_id as string)

    const movieRegions = relationships.regions
      .filter((row) => row.movie_id === movieId && row.region_id)
      .map((row) => row.region_id as string)

    const movieIndustries = relationships.industries
      .filter((row) => row.movie_id === movieId && row.industry_id)
      .map((row) => row.industry_id as string)

    const movieLanguages = relationships.languages
      .filter((row) => row.movie_id === movieId && row.language_id)
      .map((row) => row.language_id as string)

    const movieTags = relationships.tags
      .filter((row) => row.movie_id === movieId && row.tag_id)
      .map((row) => row.tag_id as string)

    const movieCollections = relationships.collections
      .filter((row) => row.movie_id === movieId && row.collection_id)
      .map((row) => row.collection_id as string)

    const originalLanguageId = movieLanguages[0]

    return {
      ...movie,
      genres: uniqueStrings(
        movieGenres.length > 0
          ? movieGenres
          : [movie.genres[0]].filter(Boolean),
      ),
      subgenres: uniqueStrings(movieSubgenres),
      countryIds: uniqueStrings(movieCountries),
      regionIds: uniqueStrings(movieRegions),
      industryIds: uniqueStrings(movieIndustries),
      languageIds: uniqueStrings(movieLanguages),
      originalLanguageId,
      tags: uniqueStrings(movieTags),
      collectionIds: uniqueStrings(movieCollections),
      directors: movie.directors,
      writers: movie.writers,
      producers: movie.producers,
      cast: movie.cast,
    }
  })
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)]
}

export async function getMovies(): Promise<Movie[]> {
  const { data, error } = await supabase
    .from('movies')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Unable to load movies: ${error.message}`)
  }

  const rows = (data ?? []) as LegacyMovieRow[]
  const movies = mapSupabaseMoviesToCanonical(rows)

  const [
    genres,
    subgenres,
    countries,
    regions,
    industries,
    languages,
    tags,
    collections,
    movieGenres,
    movieSubgenres,
    movieCountries,
    movieRegions,
    movieIndustries,
    movieLanguages,
    movieTags,
    movieCollections,
  ] = await Promise.all([
    getLookupRows('genres'),
    getLookupRows('subgenres'),
    getLookupRows('countries'),
    getLookupRows('regions'),
    getLookupRows('film_industries'),
    getLookupRows('languages'),
    getLookupRows('tags'),
    getLookupRows('collections'),
    getRelationshipRows('movie_genres'),
    getRelationshipRows('movie_subgenres'),
    getRelationshipRows('movie_countries'),
    getRelationshipRows('movie_regions'),
    getRelationshipRows('movie_industries'),
    getRelationshipRows('movie_languages'),
    getRelationshipRows('movie_tags'),
    getRelationshipRows('movie_collections'),
  ])

  return attachMetadata(
    movies,
    {
      genres: movieGenres,
      subgenres: movieSubgenres,
      countries: movieCountries,
      regions: movieRegions,
      industries: movieIndustries,
      languages: movieLanguages,
      tags: movieTags,
      collections: movieCollections,
      people: [],
    },
    {
      genres: buildLookupMap(genres),
      subgenres: buildLookupMap(subgenres),
      countries: buildLookupMap(countries),
      regions: buildLookupMap(regions),
      industries: buildLookupMap(industries),
      languages: buildLookupMap(languages),
      tags: buildLookupMap(tags),
      collections: buildLookupMap(collections),
    },
  )
}

export async function getMovieById(id: string): Promise<Movie | null> {
  const { data, error } = await supabase
    .from('movies')
    .select('*')
    .eq('id', Number(id))
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to load movie: ${error.message}`)
  }

  if (!data) {
    return null
  }

  const rows = [data as LegacyMovieRow]
  const movies = mapSupabaseMoviesToCanonical(rows)

  const [
    movieGenres,
    movieSubgenres,
    movieCountries,
    movieRegions,
    movieIndustries,
    movieLanguages,
    movieTags,
    movieCollections,
  ] = await Promise.all([
    getRelationshipRows('movie_genres'),
    getRelationshipRows('movie_subgenres'),
    getRelationshipRows('movie_countries'),
    getRelationshipRows('movie_regions'),
    getRelationshipRows('movie_industries'),
    getRelationshipRows('movie_languages'),
    getRelationshipRows('movie_tags'),
    getRelationshipRows('movie_collections'),
  ])

  return (
    attachMetadata(
      movies,
      {
        genres: movieGenres,
        subgenres: movieSubgenres,
        countries: movieCountries,
        regions: movieRegions,
        industries: movieIndustries,
        languages: movieLanguages,
        tags: movieTags,
        collections: movieCollections,
        people: [],
      },
      {
        genres: new Map(),
        subgenres: new Map(),
        countries: new Map(),
        regions: new Map(),
        industries: new Map(),
        languages: new Map(),
        tags: new Map(),
        collections: new Map(),
      },
    )[0] ?? null
  )
    }
