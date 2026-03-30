// Lightweight sound effect helpers.
// All files live in /public/sounds/

const cache: Record<string, HTMLAudioElement> = {}

function getAudio(path: string): HTMLAudioElement {
  if (!cache[path]) {
    cache[path] = new Audio(path)
  }
  return cache[path]
}

export function isSfxMuted(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('sfxMuted') === 'true'
}

export function setSfxMuted(muted: boolean) {
  if (typeof window === 'undefined') return
  localStorage.setItem('sfxMuted', String(muted))
}

export function playSfx(path: string, volume = 0.7) {
  if (isSfxMuted()) return
  try {
    const base = getAudio(path)
    const sfx = base.cloneNode() as HTMLAudioElement
    sfx.volume = volume
    sfx.play().catch(() => {})
  } catch {
    // silently ignore if audio isn't available
  }
}

function playSfxRandom(paths: string[], volume = 0.7) {
  if (isSfxMuted()) return
  const path = paths[Math.floor(Math.random() * paths.length)]
  try {
    const sfx = new Audio(path)
    sfx.volume = volume
    sfx.play().catch(() => {})
  } catch {
    // silently ignore
  }
}

export const SFX = {
  roundWin:    () => playSfxRandom(['/sounds/round-win-1.mp3', '/sounds/round-win-2.mp3', '/sounds/round-win-3.mp3']),
  roundLose:   () => playSfxRandom(['/sounds/round-lose-1.mp3', '/sounds/round-lose-2.mp3', '/sounds/round-lose-3.mp3']),
  click:       () => playSfx('/sounds/click.mp3', 0.5),
  matchStart:  () => playSfx('/sounds/match-start.mp3', 0.8),
  tie:         () => playSfx('/sounds/tie.mp3', 0.7),
  matchWin:    () => playSfx('/sounds/match-win.mp3', 0.9),
  matchLoss:   () => playSfx('/sounds/match-loss.mp3', 0.9),
}
