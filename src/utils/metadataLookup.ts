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

export interface MetadataLookup {
  genres: Map<string, Genre>
  subgenres: Map<string, Subgenre>
  countries: Map<string, Country>
  regions: Map<string, Region>
  industries: Map<string, FilmIndustry>
  languages: Map<string, Language>
  tags: Map<string, Tag>
  collections: Map<string, Collection>
  ageRatings: Map<string, AgeRating>
}

function createLookup<T extends { id: string }>(
  values: T[],
): Map<string, T> {
  return new Map(
    values.map((value) => [
      value.id,
      value,
    ]),
  )
}

export function createMetadataLookup(
  catalog: {
    genres: Genre[]
    subgenres: Subgenre[]
    countries: Country[]
    regions: Region[]
    industries: FilmIndustry[]
    languages: Language[]
    tags: Tag[]
    collections: Collection[]
    ageRatings: AgeRating[]
  },
): MetadataLookup {
  return {
    genres: createLookup(catalog.genres),
    subgenres: createLookup(catalog.subgenres),
    countries: createLookup(catalog.countries),
    regions: createLookup(catalog.regions),
    industries: createLookup(catalog.industries),
    languages: createLookup(catalog.languages),
    tags: createLookup(catalog.tags),
    collections: createLookup(catalog.collections),
    ageRatings: createLookup(catalog.ageRatings),
  }
}

export function getMetadataName<T extends { id: string; name: string }>(
  lookup: Map<string, T>,
  id: string,
): string {
  return lookup.get(id)?.name ?? id
}

export function getMetadataNames<
  T extends { id: string; name: string },
>(
  lookup: Map<string, T>,
  ids: string[],
): string[] {
  return ids
    .map((id) => lookup.get(id)?.name)
    .filter(
      (name): name is string =>
        Boolean(name),
    )
    }
