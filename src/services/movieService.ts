import { supabase } from '../supabase'
import {
  mapSupabaseMoviesToCanonical,
  type LegacyMovieRow,
} from '../utils/movieMapper'
import type { Movie } from '../types/movie'

export async function getMovies(): Promise<Movie[]> {
  const { data, error } = await supabase
    .from('movies')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(
      `Unable to load movies: ${error.message}`,
    )
  }

  const rows = (data ?? []) as LegacyMovieRow[]

  return mapSupabaseMoviesToCanonical(rows)
}

export async function getMovieById(
  id: string,
): Promise<Movie | null> {
  const { data, error } = await supabase
    .from('movies')
    .select('*')
    .eq('id', Number(id))
    .maybeSingle()

  if (error) {
    throw new Error(
      `Unable to load movie: ${error.message}`,
    )
  }

  if (!data) {
    return null
  }

  return mapSupabaseMoviesToCanonical([
    data as LegacyMovieRow,
  ])[0] ?? null
}
