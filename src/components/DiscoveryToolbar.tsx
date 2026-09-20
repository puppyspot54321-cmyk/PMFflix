import {
  ArrowDownAZ,
  ArrowUpAZ,
  ChevronDown,
  Filter,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { useState } from 'react'

export type DiscoverySort =
  | 'relevance'
  | 'newest'
  | 'oldest'
  | 'title-asc'
  | 'title-desc'
  | 'rating-desc'

export type DiscoveryToolbarProps = {
  searchQuery?: string
  onSearchChange?: (value: string) => void

  contentType?: string
  onContentTypeChange?: (value: string) => void

  genre?: string
  onGenreChange?: (value: string) => void

  year?: string
  onYearChange?: (value: string) => void

  rating?: string
  onRatingChange?: (value: string) => void

  sort?: DiscoverySort
  onSortChange?: (value: DiscoverySort) => void

  contentTypes?: string[]
  genres?: string[]
  years?: string[]
  ratings?: string[]

  onReset?: () => void

  showSearch?: boolean
  showContentType?: boolean
  showGenre?: boolean
  showYear?: boolean
  showRating?: boolean
  showSort?: boolean

  mobileCollapsible?: boolean
  className?: string
}

const DEFAULT_CONTENT_TYPES = [
  'All',
  'Movie',
  'TV Series',
  'Documentary',
  'Short Film',
  'Special',
]

const DEFAULT_GENRES = [
  'All Genres',
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Romance',
  'Science Fiction',
  'Thriller',
  'Documentary',
]

const DEFAULT_YEARS = [
  'All Years',
  '2026',
  '2025',
  '2024',
  '2023',
  '2022',
  '2021',
  '2020',
]

const DEFAULT_RATINGS = [
  'All Ratings',
  '18+',
  '16+',
  '13+',
  'PG',
  'PG-13',
  'G',
]

const SORT_OPTIONS: Array<{
  value: DiscoverySort
  label: string
}> = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'title-asc', label: 'Title A–Z' },
  { value: 'title-desc', label: 'Title Z–A' },
  { value: 'rating-desc', label: 'Highest Rated' },
]

function SelectControl({
  value,
  options,
  placeholder,
  onChange,
}: {
  value: string
  options: string[]
  placeholder: string
  onChange: (value: string) => void
}) {
  return (
    <div className="relative min-w-0">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={placeholder}
        className="h-11 w-full min-w-[140px] appearance-none rounded-xl border border-white/10 bg-white/[0.05] px-4 pr-10 text-sm font-medium text-white outline-none transition-all duration-200 hover:border-white/20 hover:bg-white/[0.08] focus:border-white/30 focus:bg-white/[0.08] focus:ring-2 focus:ring-white/10"
      >
        <option value="" className="bg-zinc-950 text-white">
          {placeholder}
        </option>

        {options.map((option) => (
          <option
            key={option}
            value={option}
            className="bg-zinc-950 text-white"
          >
            {option}
          </option>
        ))}
      </select>

      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45"
      />
    </div>
  )
}

function SortControl({
  value,
  onChange,
}: {
  value: DiscoverySort
  onChange: (value: DiscoverySort) => void
}) {
  return (
    <div className="relative min-w-0">
      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value as DiscoverySort)
        }
        aria-label="Sort content"
        className="h-11 w-full min-w-[150px] appearance-none rounded-xl border border-white/10 bg-white/[0.05] px-4 pr-10 text-sm font-medium text-white outline-none transition-all duration-200 hover:border-white/20 hover:bg-white/[0.08] focus:border-white/30 focus:bg-white/[0.08] focus:ring-2 focus:ring-white/10"
      >
        {SORT_OPTIONS.map((option) => (
          <option
            key={option.value}
            value={option.value}
            className="bg-zinc-950 text-white"
          >
            {option.label}
          </option>
        ))}
      </select>

      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45"
      />
    </div>
  )
}

export default function DiscoveryToolbar({
  searchQuery = '',
  onSearchChange,

  contentType = '',
  onContentTypeChange,

  genre = '',
  onGenreChange,

  year = '',
  onYearChange,

  rating = '',
  onRatingChange,

  sort = 'relevance',
  onSortChange,

  contentTypes = DEFAULT_CONTENT_TYPES,
  genres = DEFAULT_GENRES,
  years = DEFAULT_YEARS,
  ratings = DEFAULT_RATINGS,

  onReset,

  showSearch = true,
  showContentType = true,
  showGenre = true,
  showYear = true,
  showRating = true,
  showSort = true,

  mobileCollapsible = true,
  className = '',
}: DiscoveryToolbarProps) {
  const [filtersOpen, setFiltersOpen] = useState(!mobileCollapsible)

  const hasActiveFilters =
    Boolean(searchQuery) ||
    Boolean(contentType) ||
    Boolean(genre) ||
    Boolean(year) ||
    Boolean(rating) ||
    sort !== 'relevance'

  const activeFilterCount = [
    contentType,
    genre,
    year,
    rating,
  ].filter(Boolean).length

  const handleReset = () => {
    onReset?.()
  }

  const searchPlaceholder = 'Search movies, series, people...'

  return (
    <section
      aria-label="Content discovery controls"
      className={`w-full ${className}`}
    >
      <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-3 shadow-xl backdrop-blur-xl sm:p-4">
        {/* Search + mobile filter button */}
        <div className="flex items-center gap-2">
          {showSearch && (
            <div className="relative min-w-0 flex-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
              />

              <input
                type="search"
                value={searchQuery}
                onChange={(event) =>
                  onSearchChange?.(event.target.value)
                }
                placeholder={searchPlaceholder}
                aria-label="Search content"
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.05] pl-11 pr-10 text-sm font-medium text-white placeholder:text-white/35 outline-none transition-all duration-200 hover:border-white/20 hover:bg-white/[0.08] focus:border-white/30 focus:bg-white/[0.08] focus:ring-2 focus:ring-white/10"
              />

              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange?.('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {mobileCollapsible && (
            <button
              type="button"
              onClick={() => setFiltersOpen((current) => !current)}
              aria-expanded={filtersOpen}
              aria-controls="pmf-discovery-filters"
              className={`relative flex h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-all duration-200 ${
                filtersOpen || hasActiveFilters
                  ? 'border-white/20 bg-white/10 text-white'
                  : 'border-white/10 bg-white/[0.05] text-white/70 hover:border-white/20 hover:bg-white/[0.08] hover:text-white'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>

              {activeFilterCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[10px] font-black text-black">
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Filters */}
        <div
          id="pmf-discovery-filters"
          className={`${
            filtersOpen ? 'mt-3 block' : 'hidden'
          }`}
        >
          <div className="flex flex-col gap-2 border-t border-white/[0.06] pt-3 sm:flex-row sm:flex-wrap sm:items-center">
            {showContentType && onContentTypeChange && (
              <div className="w-full sm:w-auto sm:flex-1">
                <SelectControl
                  value={contentType}
                  options={contentTypes}
                  placeholder="All Content"
                  onChange={onContentTypeChange}
                />
              </div>
            )}

            {showGenre && onGenreChange && (
              <div className="w-full sm:w-auto sm:flex-1">
                <SelectControl
                  value={genre}
                  options={genres}
                  placeholder="All Genres"
                  onChange={onGenreChange}
                />
              </div>
            )}

            {showYear && onYearChange && (
              <div className="w-full sm:w-auto sm:flex-1">
                <SelectControl
                  value={year}
                  options={years}
                  placeholder="All Years"
                  onChange={onYearChange}
                />
              </div>
            )}

            {showRating && onRatingChange && (
              <div className="w-full sm:w-auto sm:flex-1">
                <SelectControl
                  value={rating}
                  options={ratings}
                  placeholder="All Ratings"
                  onChange={onRatingChange}
                />
              </div>
            )}

            {showSort && onSortChange && (
              <div className="w-full sm:w-auto sm:flex-1">
                <SortControl
                  value={sort}
                  onChange={onSortChange}
                />
              </div>
            )}

            {onReset && (
              <button
                type="button"
                onClick={handleReset}
                disabled={!hasActiveFilters}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-white/60 transition-all duration-200 hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-35 sm:w-auto"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Active state indicator */}
        {hasActiveFilters && (
          <div className="mt-3 flex items-center gap-2 text-[11px] text-white/40">
            <Filter className="h-3.5 w-3.5" />

            <span>
              {activeFilterCount > 0
                ? `${activeFilterCount} filter${
                    activeFilterCount === 1 ? '' : 's'
                  } active`
                : 'Search or sorting active'}
            </span>

            {sort !== 'relevance' && (
              <>
                <span aria-hidden="true">•</span>

                {sort === 'title-asc' ? (
                  <ArrowDownAZ className="h-3.5 w-3.5" />
                ) : sort === 'title-desc' ? (
                  <ArrowUpAZ className="h-3.5 w-3.5" />
                ) : null}

                <span>
                  {
                    SORT_OPTIONS.find(
                      (option) => option.value === sort,
                    )?.label
                  }
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  )
  }
