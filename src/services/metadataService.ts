import { supabase } from '../supabase'
import type {
  AgeRating,
  Collection,
  Country,
  FilmIndustry,
  Genre,
  Language,
  Region,
  Subgenre,
  Tag,
} from '../types'

export interface MetadataCatalog {
  genres: Genre[]
  subgenres: Subgenre[]
  regions: Region[]
  countries: Country[]
  industries: FilmIndustry[]
  languages: Language[]
  tags: Tag[]
  collections: Collection[]
  ageRatings: AgeRating[]
}

async function getTable<T>(
  table: string,
): Promise<T[]> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order('name')

  if (error) {
    throw error
  }

  return (data ?? []) as T[]
}

export async function getGenres(): Promise<Genre[]> {
  return getTable<Genre>('genres')
}

export async function getSubgenres(): Promise<Subgenre[]> {
  return getTable<Subgenre>('subgenres')
}

export async function getRegions(): Promise<Region[]> {
  return getTable<Region>('regions')
}

export async function getCountries(): Promise<Country[]> {
  return getTable<Country>('countries')
}

export async function getFilmIndustries(): Promise<FilmIndustry[]> {
  return getTable<FilmIndustry>('film_industries')
}

export async function getLanguages(): Promise<Language[]> {
  return getTable<Language>('languages')
}

export async function getTags(): Promise<Tag[]> {
  return getTable<Tag>('tags')
}

export async function getCollections(): Promise<Collection[]> {
  return getTable<Collection>('collections')
}

export async function getAgeRatings(): Promise<AgeRating[]> {
  const { data, error } = await supabase
    .from('age_ratings')
    .select('*')
    .order('minimum_age', {
      ascending: true,
      nullsFirst: false,
    })

  if (error) {
    throw error
  }

  return (data ?? []) as AgeRating[]
}

export async function getMetadataCatalog(): Promise<MetadataCatalog> {
  const [
    genres,
    subgenres,
    regions,
    countries,
    industries,
    languages,
    tags,
    collections,
    ageRatings,
  ] = await Promise.all([
    getGenres(),
    getSubgenres(),
    getRegions(),
    getCountries(),
    getFilmIndustries(),
    getLanguages(),
    getTags(),
    getCollections(),
    getAgeRatings(),
  ])

  return {
    genres,
    subgenres,
    regions,
    countries,
    industries,
    languages,
    tags,
    collections,
    ageRatings,
  }
}
