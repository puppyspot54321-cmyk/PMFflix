import type { Movie } from '../types/movie'

export interface MovieFilters {
  title?: string
  actor?: string
  director?: string
  genreIds?: string[]
  subgenreIds?: string[]
  countryIds?: string[]
  regionIds?: string[]
  industryIds?: string[]
  languageIds?: string[]
  collectionIds?: string[]
  tags?: string[]
  year?: number
  minRating?: number
  contentType?: string
  quality?: string
}

function includesValue(
  values: string[],
  filters?: string[],
): boolean {
  if (!filters || filters.length === 0) {
    return true
  }

  return filters.some((filter) =>
    values.includes(filter),
  )
}

function matchesPeople(
  movie: Movie,
  searchTerm: string,
): boolean {
  const normalized = searchTerm.toLowerCase()

  const castMatches = movie.cast.some((member) =>
    member.personId
      .toLowerCase()
      .includes(normalized),
  )

  const directorMatches = movie.directors.some(
    (person) =>
      person.name
        .toLowerCase()
        .includes(normalized),
  )

  const writerMatches = movie.writers.some(
    (person) =>
      person.name
        .toLowerCase()
        .includes(normalized),
  )

  return (
    castMatches ||
    directorMatches ||
    writerMatches
  )
}

function getNumericRating(
  rating: string | number | undefined,
): number | undefined {
  if (rating === undefined) {
    return undefined
  }

  if (typeof rating === 'number') {
    return rating
  }

  const numericRating = Number.parseFloat(rating)

  return Number.isFinite(numericRating)
    ? numericRating
    : undefined
}

export function filterMovies(
  movies: Movie[],
  filters: MovieFilters,
): Movie[] {
  return movies.filter((movie) => {
    if (filters.title) {
      const searchTerm = filters.title
        .trim()
        .toLowerCase()

      const titleMatches =
        movie.title
          .toLowerCase()
          .includes(searchTerm) ||
        movie.originalTitle
          ?.toLowerCase()
          .includes(searchTerm)

      const peopleMatch = matchesPeople(
        movie,
        searchTerm,
      )

      if (!titleMatches && !peopleMatch) {
        return false
      }
    }

    if (
      !includesValue(
        movie.genres,
        filters.genreIds,
      )
    ) {
      return false
    }

    if (
      !includesValue(
        movie.subgenres,
        filters.subgenreIds,
      )
    ) {
      return false
    }

    if (
      !includesValue(
        movie.countryIds,
        filters.countryIds,
      )
    ) {
      return false
    }

    if (
      !includesValue(
        movie.regionIds,
        filters.regionIds,
      )
    ) {
      return false
    }

    if (
      !includesValue(
        movie.industryIds,
        filters.industryIds,
      )
    ) {
      return false
    }

    if (
      !includesValue(
        movie.languageIds,
        filters.languageIds,
      )
    ) {
      return false
    }

    if (
      !includesValue(
        movie.collectionIds,
        filters.collectionIds,
      )
    ) {
      return false
    }

    if (
      !includesValue(
        movie.tags,
        filters.tags,
      )
    ) {
      return false
    }

    if (
      filters.year !== undefined &&
      movie.releaseYear !== filters.year
    ) {
      return false
    }

    if (filters.minRating !== undefined) {
      const numericRating = getNumericRating(
        movie.rating,
      )

      if (
        numericRating === undefined ||
        numericRating < filters.minRating
      ) {
        return false
      }
    }

    if (
      filters.contentType &&
      movie.contentType !== filters.contentType
    ) {
      return false
    }

    if (
      filters.quality &&
      !movie.videoQualities.includes(
        filters.quality as Movie['videoQualities'][number],
      )
    ) {
      return false
    }

    return true
  })
}
