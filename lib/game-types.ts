export type Attribute = 'aura' | 'skill' | 'stamina'
export type PlayerKey = 'player1' | 'player2'
export type GamePhase = 'challenge' | 'defense' | 'game_over'

export type PlayerState = {
  userId: string
  email: string
  deck: number[]        // shuffled remaining card IDs (top = index 0)
  graveyard: number[]   // played card IDs
  points: { aura: number; skill: number; stamina: number }
  currentCard: number | null
}

export type TieBank = { aura: number; skill: number; stamina: number }

export type LastRound = {
  attribute: Attribute | 'sprint'
  p1Value: number
  p2Value: number
  winner: PlayerKey | 'tie'
  p1CardId: number
  p2CardId: number
  pointsAwarded: TieBank  // per-attribute points earned by winner (all 0 on tie)
}

export const EMPTY_BANK: TieBank = { aura: 0, skill: 0, stamina: 0 }

export type GameState = {
  phase: GamePhase
  attacker: PlayerKey
  turn: number
  player1: PlayerState
  player2: PlayerState
  currentRound: {
    attribute: Attribute | null
    declinedAttributes: Attribute[]
    tieCount: number
    currentDefender: PlayerKey | null  // who must accept/decline the current attribute
  }
  sprintUsed: { player1: boolean; player2: boolean }
  tieBank: TieBank
  winner: PlayerKey | null
  lastRound: LastRound | null
  rematch?: { player1: boolean; player2: boolean; newGameId?: string }
}

export type Card = {
  id: number
  name: string
  aura: number
  skill: number
  stamina: number
  total_score: number
  rarity: 'Core' | 'Rare' | 'Very Rare' | 'Epic' | 'Spectacular'
  rarity_points: number
  image_url?: string | null
}

export type GameAction =
  | { type: 'challenge'; attribute: Attribute }
  | { type: 'sprint' }
  | { type: 'accept' }
  | { type: 'decline'; attribute: Attribute | null }  // attribute = counter-offer; null = 3rd decline (force faceoff)

// Rarity multipliers for Sprint Score
export const RARITY_MULTIPLIER: Record<string, number> = {
  Core: 1,
  Rare: 1.25,
  'Very Rare': 1.5,
  Epic: 2,
  Spectacular: 4,
}

export function getSprintScore(card: Card): number {
  return Math.round(card.total_score * RARITY_MULTIPLIER[card.rarity])
}

export function checkWinner(state: GameState): PlayerKey | null {
  const { player1, player2 } = state
  if (player1.points.aura >= 7 || player1.points.skill >= 7 || player1.points.stamina >= 7) return 'player1'
  if (player2.points.aura >= 7 || player2.points.skill >= 7 || player2.points.stamina >= 7) return 'player2'
  return null
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Draw the top card for a player; reshuffles graveyard into deck if empty
export function drawCard(player: PlayerState): PlayerState {
  const p = { ...player, deck: [...player.deck], graveyard: [...player.graveyard] }
  if (p.deck.length === 0) {
    p.deck = shuffle(p.graveyard)
    p.graveyard = []
  }
  p.currentCard = p.deck.shift() ?? null
  return p
}
