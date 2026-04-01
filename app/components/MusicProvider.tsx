'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { isSfxMuted } from '@/lib/sfx'
import CoinIcon from './CoinIcon'
import BugReportModal from './BugReportModal'
import SettingsModal from './SettingsModal'
import { useSettings } from './SettingsContext'

function isGameRoute(p: string) { return /^\/game\//.test(p) }

export default function MusicProvider() {
  const pathname = usePathname()
  const supabase = createClient()
  const { musicMuted, setMusicMuted, settingsOpen, openSettings, closeSettings } = useSettings()

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [loggedIn, setLoggedIn] = useState(false)
  const [musicPlaying, setMusicPlaying] = useState(false)
  const [coins, setCoins] = useState<number | null>(null)
  const [showBugReport, setShowBugReport] = useState(false)

  // Global button click sound — respects sfxMuted
  useEffect(() => {
    const clickAudio = new Audio('/sounds/click.mp3')
    clickAudio.volume = 0.5

    const handleClick = (e: MouseEvent) => {
      if (isSfxMuted()) return
      const target = e.target as HTMLElement
      if (target.closest('button')) {
        const sfx = clickAudio.cloneNode() as HTMLAudioElement
        sfx.volume = 0.5
        sfx.play().catch(() => {})
      }
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  // Track auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setLoggedIn(!!session?.user)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setLoggedIn(!!session?.user)
    })
    return () => listener.subscription.unsubscribe()
  }, [supabase])

  // Load coin balance
  useEffect(() => {
    if (!loggedIn) { setCoins(null); return }
    fetch('/api/coins/status').then(r => r.ok ? r.json() : null).then(d => {
      if (d) setCoins(d.coins)
    })
  }, [loggedIn, pathname])

  // Start / stop music based on login + route
  useEffect(() => {
    const shouldPlay = loggedIn && !isGameRoute(pathname)

    if (shouldPlay) {
      if (!audioRef.current) {
        const audio = new Audio('/music/menu.mp3')
        audio.loop = true
        audio.volume = 0.35
        audio.muted = musicMuted
        audioRef.current = audio

        const tryPlay = () => {
          audio.play()
            .then(() => setMusicPlaying(true))
            .catch(() => {})
        }

        tryPlay()

        const onInteraction = () => {
          if (!audioRef.current) return
          audioRef.current.play()
            .then(() => setMusicPlaying(true))
            .catch(() => {})
          document.removeEventListener('click', onInteraction)
          document.removeEventListener('keydown', onInteraction)
        }

        document.addEventListener('click', onInteraction)
        document.addEventListener('keydown', onInteraction)

        return () => {
          document.removeEventListener('click', onInteraction)
          document.removeEventListener('keydown', onInteraction)
        }
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current = null
        setMusicPlaying(false)
      }
    }
  }, [loggedIn, pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync audio muted state when musicMuted changes from settings
  useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.muted = musicMuted
    if (!musicMuted && !musicPlaying) {
      audioRef.current.play()
        .then(() => setMusicPlaying(true))
        .catch(() => {})
    }
  }, [musicMuted]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!loggedIn) return null

  return (
    <>
      {showBugReport && <BugReportModal onClose={() => setShowBugReport(false)} />}
      {settingsOpen && <SettingsModal />}
      <div className="fixed top-0 left-0 right-0 z-50 h-12 flex items-center justify-end gap-2 px-4 bg-gray-950/90 backdrop-blur-sm border-b border-gray-800/60">
        <button
          onClick={() => setShowBugReport(true)}
          className="mr-auto flex items-center gap-1.5 bg-gray-800/80 border border-gray-700 hover:border-red-700/60 text-gray-400 hover:text-red-400 px-3 py-1.5 rounded-xl text-xs font-medium transition select-none"
        >
          🐛 Report Bug
        </button>
        {coins !== null && (
          <div className="flex items-center gap-1.5 bg-amber-900/50 border border-amber-700/60 px-3 py-1.5 rounded-xl select-none">
            <CoinIcon size={18} />
            <span className="text-amber-300 font-bold text-sm">{coins}</span>
          </div>
        )}
        <button
          onClick={openSettings}
          className="flex items-center gap-1.5 bg-gray-800/80 border border-gray-700 hover:border-cyan-600/60 hover:text-cyan-400 px-3 py-1.5 rounded-xl text-sm font-medium text-gray-300 transition-all select-none"
          title="Settings"
        >
          ⚙
        </button>
      </div>
    </>
  )
}
