export interface Genre {
  id: string
  name: string
  slug: string
  description?: string
}

export interface Subgenre {
  id: string
  name: string
  slug: string
  parentGenreIds: string[]
  description?: string
}
