export type BackgroundId =
  | 'arena'
  | 'space'
  | 'neon'
  | 'inferno'
  | 'emerald'
  | 'ocean'
  | 'void'

export type Background = {
  id: BackgroundId
  name: string
  /** Value for the CSS `background` property */
  css: string
  /** Show the ken-burns animated image overlay (only for arena) */
  kenBurns?: boolean
}

export const BACKGROUNDS: Background[] = [
  {
    id: 'arena',
    name: 'Arena',
    css: "url('/bg.jpg') center/cover fixed, #050510",
    kenBurns: true,
  },
  {
    id: 'space',
    name: 'Deep Space',
    css: 'radial-gradient(ellipse at 30% 20%, #0f0c29 0%, #302b63 50%, #24243e 100%)',
  },
  {
    id: 'neon',
    name: 'Neon Grid',
    css: 'linear-gradient(160deg, #070714 0%, #0d1b2a 40%, #1a0a2e 100%)',
  },
  {
    id: 'inferno',
    name: 'Inferno',
    css: 'radial-gradient(ellipse at 50% 0%, #4d0000 0%, #1a0000 50%, #000 100%)',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    css: 'radial-gradient(ellipse at 50% 0%, #003d1a 0%, #001a0d 50%, #000 100%)',
  },
  {
    id: 'ocean',
    name: 'Ocean Depths',
    css: 'radial-gradient(ellipse at 50% 0%, #003d5c 0%, #001a2e 50%, #000 100%)',
  },
  {
    id: 'void',
    name: 'Void',
    css: '#000',
  },
]

export function getSelectedBgId(): BackgroundId {
  if (typeof window === 'undefined') return 'arena'
  return (localStorage.getItem('selectedBg') as BackgroundId) ?? 'arena'
}

export function getSelectedBg(): Background {
  const id = getSelectedBgId()
  return BACKGROUNDS.find(b => b.id === id) ?? BACKGROUNDS[0]
}

export function saveSelectedBgId(id: BackgroundId) {
  localStorage.setItem('selectedBg', id)
}
