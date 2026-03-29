// Lightweight sound effect helpers.
// All files live in /public/sounds/

const cache: Record<string, HTMLAudioElement> = {}

function getAudio(path: string): HTMLAudioElement {
  if (!cache[path]) {
    cache[path] = new Audio(path)
  }
  return cache[path]
}

export function playSfx(path: string, volume = 0.7) {
  try {
    const base = getAudio(path)
    const sfx = base.cloneNode() as HTMLAudioElement
    sfx.volume = volume
    sfx.play().catch(() => {})
  } catch {
    // silently ignore if audio isn't available
  }
}

export const SFX = {
  roundWin:  () => playSfx('/sounds/round-win.mp3'),
  roundLose: () => playSfx('/sounds/round-lose.mp3'),
  click:     () => playSfx('/sounds/click.mp3', 0.5),
}
