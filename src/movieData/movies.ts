import journeyPoster from '../assets/journey.jpg (2).png'
import nightCityPoster from '../assets/night-city.jpg'
import finalHorizonPoster from '../assets/final-horizon.jpg'
import hiddenWallPoster from '../assets/hidden-wall.jpg'
import lastMissionPoster from '../assets/last-mission.jpg'

export type Movie = {
  id: number
  title: string
  year: number
  poster: string
  type: string
  description: string
  category: string
  duration?: string
  rating?: string | number
  videoUrl?: string
  videoType?: 'youtube' | 'mp4'
  featured?: boolean
  downloadable?: boolean
}

export const movies: Movie[] = [
  {
    id: 1,
    title: 'The Journey',
    year: 2026,
    poster: journeyPoster,
    type: 'Movie',
    description:
      'A cinematic journey through unexpected places, difficult choices, and unforgettable moments.',
    category: 'Adventure',
    duration: '2h 04m',
    rating: '16+',
    videoUrl:
      'https://youtu.be/M6h5AS971hY?si=dqE8EzTprzoacOPr',
    videoType: 'youtube',
  },

  {
    id: 2,
    title: 'Night City',
    year: 2026,
    poster: nightCityPoster,
    type: 'Movie',
    description:
      'A mysterious story unfolding after dark in a city where nothing is quite what it seems.',
    category: 'Thriller',
    duration: '1h 52m',
    rating: '16+',
    videoUrl:
      'https://www.w3schools.com/html/mov_bbb.mp4',
    videoType: 'mp4',
  },

  {
    id: 3,
    title: 'Final Horizon',
    year: 2025,
    poster: finalHorizonPoster,
    type: 'Movie',
    description:
      'A group of explorers faces an uncertain future beyond the limits of their world.',
    category: 'Science Fiction',
    duration: '2h 08m',
    rating: '13+',
    videoUrl:
      'https://www.w3schools.com/html/mov_bbb.mp4',
    videoType: 'mp4',
  },

  {
    id: 4,
    title: 'Hidden World',
    year: 2025,
    poster: hiddenWallPoster,
    type: 'Movie',
    description:
      'An unexpected discovery reveals a world hidden from humanity for generations.',
    category: 'Fantasy',
    duration: '1h 58m',
    rating: '13+',
    videoUrl:
      'https://www.w3schools.com/html/mov_bbb.mp4',
    videoType: 'mp4',
  },

  {
    id: 5,
    title: 'The Last Mission',
    year: 2024,
    poster: lastMissionPoster,
    type: 'Movie',
    description:
      'One final mission becomes a race against time when everything begins to go wrong.',
    category: 'Action',
    duration: '2h 01m',
    rating: '16+',
    videoUrl:
      'https://www.w3schools.com/html/mov_bbb.mp4',
    videoType: 'mp4',
  },
]
