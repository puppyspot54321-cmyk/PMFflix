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

export async function getGenres(): Promise<Genre[]> {
  const { data, error } = await supabase
    .from('genres')
    .select('*')
    .order('name')

  if (error) {
    throw error
  }

  return data ?? []
}

export async function getSubgenres(): Promise<Subgenre[]> {
  const { data, error } = await supabase
    .from('subgenres')
    .select('*')
    .order('name')

  if (error) {
    throw error
  }

  return data ?? []
}

export async function getRegions(): Promise<Region[]> {
  const { data, error } = await supabase
    .from('regions')
    .select('*')
    .order('name')

  if (error) {
    throw error
  }

  return data ?? []
}

export async function getCountries(): Promise<Country[]> {
  const { data, error } = await supabase
    .from('countries')
    .select('*')
    .order('name')

  if (error) {
    throw error
  }

  return data ?? []
}

export async function getFilmIndustries(): Promise<FilmIndustry[]> {
  const { data, error } = await supabase
    .from('film_industries')
    .select('*')
    .order('name')

  if (error) {
    throw error
  }

  return data ?? []
}

export async function getLanguages(): Promise<Language[]> {
  const { data, error } = await supabase
    .from('languages')
    .select('*')
    .order('name')

  if (error) {
    throw error
  }

  return data ?? []
}

export async function getTags(): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('name')

  if (error) {
    throw error
  }

  return data ?? []
}

export async function getCollections(): Promise<Collection[]> {
  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .order('name')

  if (error) {
    throw error
  }

  return data ?? []
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

  return data ?? []
    }
