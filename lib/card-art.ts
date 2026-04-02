import manifest from './card-art-manifest.json'

/**
 * Maps Supabase `cards.id` → path under `public/card-art/` (no leading slash).
 * Example: `"42": "some-character/rare.webp"` → URL `/card-art/some-character/rare.webp`
 *
 * Populate via `scripts/link-card-art.mjs` or by editing this file after placing art in
 * `public/card-art/<character-folder>/...`.
 */
const byId = manifest as Record<string, string>

export const CARD_ART_PLACEHOLDER_URL = '/card-art/_placeholder.svg'

export function hasCardArt(cardId: number): boolean {
  return Boolean(byId[String(cardId)]?.trim())
}

export function getCardArtUrl(cardId: number): string {
  const rel = byId[String(cardId)]
  if (!rel?.trim()) return CARD_ART_PLACEHOLDER_URL
  const path = rel.replace(/^\/+/, '')
  return `/card-art/${path}`
}
