'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'

// Music plays on home, collection, deck-builder, play (lobby)
// Stops when inside an actual game match: /game/[gameId] or /game/practice
function isGameRoute(pathname: string) {
  return /^\/game\//.test(pathname)
}

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

  // Global button click sound
  useEffect(() => {
    const clickAudio = new Audio('/sounds/click.mp3')
    clickAudio.volume = 0.5

    const handleClick = (e: MouseEvent) => {
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

  // Start / stop audio based on login + route
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

        // If autoplay was blocked, start on first user interaction
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

  // Don't render button on game routes or when not logged in
  if (!loggedIn || isGameRoute(pathname)) return null

  const musicIcon = !musicPlaying ? '▶' : muted ? '🔇' : '🔊'

  return (
    <button
      onClick={toggleMusic}
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-gray-900/80 backdrop-blur border border-gray-700 hover:border-amber-600/60 px-4 py-2.5 rounded-2xl text-sm font-medium text-gray-300 hover:text-white transition-all hover:shadow-md hover:shadow-amber-900/20 select-none"
    >
      <span className="text-base leading-none">{musicIcon}</span>
      <span>Music</span>
    </button>
  )
}
