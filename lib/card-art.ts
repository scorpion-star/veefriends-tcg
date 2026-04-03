export const CARD_ART_PLACEHOLDER_URL = '/card-back.png'

export function hasCardArt(imageUrl: string | null | undefined): boolean {
  return Boolean(imageUrl?.trim())
}

export function getCardArtUrl(imageUrl: string | null | undefined): string {
  return imageUrl?.trim() || CARD_ART_PLACEHOLDER_URL
}
