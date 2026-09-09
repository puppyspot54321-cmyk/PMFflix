export interface Person {
  id: string
  name: string
  slug: string
  profileUrl?: string
}

export interface CastMember {
  personId: string
  characterName?: string
  billingOrder?: number
}
