export interface AgeRatingDefinition {
  id: string
  name: string
  minimumAge?: number
  description: string
}

export const ageRatings: AgeRatingDefinition[] = [
  {
    id: 'g',
    name: 'G',
    minimumAge: 0,
    description: 'General audiences.',
  },
  {
    id: 'pg',
    name: 'PG',
    minimumAge: 0,
    description: 'Parental guidance suggested.',
  },
  {
    id: 'pg-13',
    name: 'PG-13',
    minimumAge: 13,
    description: 'Parents strongly cautioned.',
  },
  {
    id: 'r',
    name: 'R',
    minimumAge: 17,
    description: 'Restricted content.',
  },
  {
    id: 'nc-17',
    name: 'NC-17',
    minimumAge: 18,
    description: 'Adults only.',
  },
  {
    id: 'u',
    name: 'U',
    minimumAge: 0,
    description: 'Suitable for general audiences.',
  },
  {
    id: '12',
    name: '12',
    minimumAge: 12,
    description: 'Suitable for viewers aged 12 and above.',
  },
  {
    id: '12a',
    name: '12A',
    minimumAge: 12,
    description: 'Under-12 viewing requires adult guidance.',
  },
  {
    id: '15',
    name: '15',
    minimumAge: 15,
    description: 'Suitable for viewers aged 15 and above.',
  },
  {
    id: '18',
    name: '18',
    minimumAge: 18,
    description: 'Adults only.',
  },
]
