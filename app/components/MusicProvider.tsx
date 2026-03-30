'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { isSfxMuted, setSfxMuted } from '@/lib/sfx'
import CoinIcon from './CoinIcon'

function isGameRoute(p: string) { return /^\/game\//.test(p) }

// Music plays on home, collection, deck-builder, play (lobby)
// Stops when inside an actual game match: /game/[gameId] or /game/practice

export default function MusicProvider() {
  const pathname = usePathname()
  const supabase = createClient()

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [loggedIn, setLoggedIn] = useState(false)
  const [musicPlaying, setMusicPlaying] = useState(false)
  const [muted, setMuted] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('menuMusicMuted') === 'true'
    }
    return false
  })
  const [sfxMuted, setSfxMutedState] = useState(() => isSfxMuted())
  const [coins, setCoins] = useState<number | null>(null)

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
        audio.muted = muted
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

  const toggleMusic = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (!musicPlaying) {
      audio.muted = false
      audio.play().then(() => {
        setMusicPlaying(true)
        setMuted(false)
        localStorage.setItem('menuMusicMuted', 'false')
      }).catch(() => {})
      return
    }

    const next = !muted
    audio.muted = next
    setMuted(next)
    localStorage.setItem('menuMusicMuted', String(next))
  }, [musicPlaying, muted])

  const toggleSfx = useCallback(() => {
    const next = !sfxMuted
    setSfxMuted(next)
    setSfxMutedState(next)
  }, [sfxMuted])

  if (!loggedIn) return null

  const musicIcon = !musicPlaying ? '▶' : muted ? '🔇' : '🔊'
  const sfxIcon = sfxMuted ? '🔕' : '🔔'

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
      {coins !== null && (
        <div className="flex items-center gap-1.5 bg-amber-900/50 border border-amber-700/60 px-3 py-2 rounded-2xl select-none">
          <CoinIcon size={20} />
          <span className="text-amber-300 font-bold text-sm">{coins}</span>
        </div>
      )}
      <button
        onClick={toggleSfx}
        className="flex items-center gap-2 bg-gray-900/80 backdrop-blur border border-gray-700 hover:border-amber-600/60 px-3 py-2 rounded-2xl text-sm font-medium text-gray-300 hover:text-white transition-all hover:shadow-md hover:shadow-amber-900/20 select-none"
      >
        <span className="text-base leading-none">{sfxIcon}</span>
        <span>SFX</span>
      </button>
      {!isGameRoute(pathname) && (
        <button
          onClick={toggleMusic}
          className="flex items-center gap-2 bg-gray-900/80 backdrop-blur border border-gray-700 hover:border-amber-600/60 px-3 py-2 rounded-2xl text-sm font-medium text-gray-300 hover:text-white transition-all hover:shadow-md hover:shadow-amber-900/20 select-none"
        >
          <span className="text-base leading-none">{musicIcon}</span>
          <span>Music</span>
        </button>
      )}
    </div>
  )
}
