'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { BackgroundId, BACKGROUNDS, Background, getSelectedBgId, saveSelectedBgId } from '@/app/lib/settings'
import { isSfxMuted, setSfxMuted as writeSfxMuted } from '@/lib/sfx'

type SettingsContextType = {
  background: Background
  setBackground: (id: BackgroundId) => void
  musicMuted: boolean
  setMusicMuted: (v: boolean) => void
  sfxMuted: boolean
  setSfxMuted: (v: boolean) => void
  settingsOpen: boolean
  openSettings: () => void
  closeSettings: () => void
}

const SettingsContext = createContext<SettingsContextType | null>(null)

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be inside SettingsProvider')
  return ctx
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [bgId, setBgId] = useState<BackgroundId>(() => getSelectedBgId())
  const [musicMuted, setMusicMutedState] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('menuMusicMuted') === 'true'
  })
  const [sfxMuted, setSfxMutedState] = useState(() => isSfxMuted())
  const [settingsOpen, setSettingsOpen] = useState(false)

  const background = BACKGROUNDS.find(b => b.id === bgId) ?? BACKGROUNDS[0]

  const setBackground = useCallback((id: BackgroundId) => {
    setBgId(id)
    saveSelectedBgId(id)
  }, [])

  const setMusicMuted = useCallback((v: boolean) => {
    setMusicMutedState(v)
    localStorage.setItem('menuMusicMuted', String(v))
  }, [])

  const setSfxMuted = useCallback((v: boolean) => {
    writeSfxMuted(v)
    setSfxMutedState(v)
  }, [])

  return (
    <SettingsContext.Provider value={{
      background,
      setBackground,
      musicMuted,
      setMusicMuted,
      sfxMuted,
      setSfxMuted,
      settingsOpen,
      openSettings: () => setSettingsOpen(true),
      closeSettings: () => setSettingsOpen(false),
    }}>
      {children}
    </SettingsContext.Provider>
  )
}
