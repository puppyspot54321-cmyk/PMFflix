import type { Subgenre } from '../types/genre'

export const subgenres: Subgenre[] = [
  {
    id: 'romantic-comedy',
    name: 'Romantic Comedy',
    slug: 'romantic-comedy',
    parentGenreIds: ['romance', 'comedy'],
  },
  {
    id: 'action-comedy',
    name: 'Action Comedy',
    slug: 'action-comedy',
    parentGenreIds: ['action', 'comedy'],
  },
  {
    id: 'action-thriller',
    name: 'Action Thriller',
    slug: 'action-thriller',
    parentGenreIds: ['action', 'thriller'],
  },
  {
    id: 'crime-thriller',
    name: 'Crime Thriller',
    slug: 'crime-thriller',
    parentGenreIds: ['crime', 'thriller'],
  },
  {
    id: 'psychological-thriller',
    name: 'Psychological Thriller',
    slug: 'psychological-thriller',
    parentGenreIds: ['psychological', 'thriller'],
  },
  {
    id: 'dark-comedy',
    name: 'Dark Comedy',
    slug: 'dark-comedy',
    parentGenreIds: ['comedy'],
  },
  {
    id: 'supernatural',
    name: 'Supernatural',
    slug: 'supernatural',
    parentGenreIds: ['fantasy', 'horror'],
  },
  {
    id: 'paranormal',
    name: 'Paranormal',
    slug: 'paranormal',
    parentGenreIds: ['horror', 'mystery'],
  },
  {
    id: 'monster',
    name: 'Monster',
    slug: 'monster',
    parentGenreIds: ['horror'],
  },
  {
    id: 'slasher',
    name: 'Slasher',
    slug: 'slasher',
    parentGenreIds: ['horror', 'thriller'],
  },
  {
    id: 'historical-drama',
    name: 'Historical Drama',
    slug: 'historical-drama',
    parentGenreIds: ['historical', 'drama'],
  },
  {
    id: 'period-drama',
    name: 'Period Drama',
    slug: 'period-drama',
    parentGenreIds: ['historical', 'drama'],
  },
  {
    id: 'coming-of-age',
    name: 'Coming of Age',
    slug: 'coming-of-age',
    parentGenreIds: ['drama', 'teen'],
  },
  {
    id: 'feel-good',
    name: 'Feel-Good',
    slug: 'feel-good',
    parentGenreIds: ['comedy', 'drama'],
  },
  {
    id: 'inspirational',
    name: 'Inspirational',
    slug: 'inspirational',
    parentGenreIds: ['drama'],
  },
  {
    id: 'faith-religious',
    name: 'Faith & Religious',
    slug: 'faith-religious',
    parentGenreIds: ['drama'],
  },
  {
    id: 'independent',
    name: 'Independent',
    slug: 'independent',
    parentGenreIds: [],
  },
  {
    id: 'art-house',
    name: 'Art House',
    slug: 'art-house',
    parentGenreIds: [],
  },
  {
    id: 'short-film',
    name: 'Short Film',
    slug: 'short-film',
    parentGenreIds: [],
  },
]
