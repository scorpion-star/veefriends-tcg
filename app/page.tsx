'use client'

import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import { createClient } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import CoinIcon from './components/CoinIcon'
import AvatarUpload from './components/AvatarUpload'
import UsernameSetup from './components/UsernameSetup'
import NeonButton from './components/NeonButton'
import { useSettings } from './components/SettingsContext'

const BG = "min-h-screen relative"

export default function Home() {
  const { background } = useSettings()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const router = useRouter()

  const supabase = useMemo(() => createClient(), [])

  // ── Auth ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        setProfileLoading(true)
        try {
          const res = await fetch('/api/profile')
          if (res.ok) {
            const data = await res.json()
            setAvatarUrl(data.avatarUrl ?? null)
            setUsername(data.username ?? null)
          }
        } finally {
          setProfileLoading(false)
        }
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [supabase])

  const signUp = async () => {
    setLoading(true)
    setAuthError(null)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setAuthError(error.message)
    else setAuthError('Sign up successful! Check your email for the confirmation link.')
    setLoading(false)
  }

  const signIn = async () => {
    setLoading(true)
    setAuthError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setAuthError(error.message)
    setLoading(false)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  // ── Logged-in home screen ──────────────────────────────────────────────────
  if (user) {
    return (
      <div className={`${BG} text-white`}>
        <div className="fixed inset-0 -z-10" style={{ background: background.css }}>
          {background.kenBurns && (
            <img src="/bg.jpg" alt="" className="absolute inset-0 w-full h-full object-cover bg-ken-burns" />
          )}
        </div>
        <div className="fixed inset-0 bg-black/55 -z-10" />

        {/* Username setup gate — shown until user picks a name */}
        {!profileLoading && !username && (
          <UsernameSetup onComplete={setUsername} />
        )}

        <div className="flex justify-center px-6 pt-0 pb-10 -mt-14 md:-mt-16">
        <div className="relative z-10 text-center w-full flex flex-col items-center">
          <div
            className="relative mx-auto z-10 shrink-0"
            style={{ width: 'min(44rem, calc(100vw - 3rem))', height: '20rem' }}
          >
            <Image src="/vf-logo.png" alt="VeeFriends logo" fill style={{ objectFit: 'contain' }} priority />
          </div>
          <div className="flex flex-col items-center gap-2 -mt-[4.75rem] sm:-mt-20 relative z-20 mb-3 w-full max-w-md">
            <AvatarUpload
              userId={user.id}
              avatarUrl={avatarUrl}
              email={user.email}
              size="lg"
              onUpload={setAvatarUrl}
            />
            <p className="text-xl font-bold text-white drop-shadow-lg">
              {username ?? '…'}
            </p>
          </div>
          <div className="space-y-4 w-full max-w-md -mt-3">
            <NeonButton variant="metal" size="xl" fullWidth onClick={() => router.push('/play')}>
              <img src="/swords.webp" alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
              Play Now
            </NeonButton>
            <NeonButton variant="metal" size="lg" fullWidth onClick={() => router.push('/deck-builder')}>
              <span className="relative inline-flex items-center justify-center" style={{ width: 28, height: 28 }}>
                {[-20, -10, 0, 10, 20].map((deg, i) => (
                  <img
                    key={i}
                    src="/card-back.png"
                    alt=""
                    style={{
                      position: 'absolute',
                      width: 18,
                      height: 26,
                      borderRadius: 2,
                      transform: `rotate(${deg}deg)`,
                      transformOrigin: 'bottom center',
                      zIndex: i,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
                    }}
                  />
                ))}
              </span>
              Deck Builder
            </NeonButton>
            <NeonButton variant="metal" size="lg" fullWidth onClick={() => router.push('/collection')}>
              <img src="/vf-tcg-box.webp" alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
              My Collection
            </NeonButton>
            <NeonButton variant="metal" size="lg" fullWidth onClick={() => router.push('/store')}>
              <CoinIcon size={18} /> Store
            </NeonButton>
            <NeonButton variant="metal" size="lg" fullWidth onClick={() => router.push('/profile')}>
              👤 My Profile
            </NeonButton>
          </div>
        </div>
        </div>

      </div>
    )
  }

  // ── Login screen ───────────────────────────────────────────────────────────
  return (
    <div className={`${BG} text-white min-h-screen overflow-y-auto`}>
      <div className="fixed inset-0 -z-10" style={{ background: background.css }}>
        {background.kenBurns && (
          <div className="w-full h-full bg-[url('/bg.jpg')] bg-cover bg-center bg-no-repeat bg-ken-burns" />
        )}
      </div>
      <div className="fixed inset-0 bg-black/55 -z-10" />
      <div className="flex flex-col items-center px-6 pt-2 pb-10">
        {/* 2.5× base logo; short viewports cap height so form + footer stay on screen / scroll */}
        <div
          className="relative mx-auto shrink-0 mb-3 -mt-16 sm:-mt-20 w-[min(68.75rem,calc(100vw-3rem))] h-[min(31.25rem,min(28vh,20rem))] sm:h-[min(31.25rem,36vh)] md:max-h-[31.25rem]"
        >
          <Image src="/vf-logo.png" alt="VeeFriends logo" fill style={{ objectFit: 'contain' }} priority />
        </div>
        <p className="text-center text-white text-base sm:text-lg mb-5 drop-shadow-md">Compete & Collect Online</p>

        <div className="relative z-10 bg-transparent backdrop-blur p-6 sm:p-10 md:p-12 rounded-3xl w-full max-w-[38rem] shadow-2xl border border-gray-800">
        <div className="space-y-5 sm:space-y-7">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-800/80 border border-gray-700 rounded-2xl px-8 py-5 text-xl focus:outline-none focus:border-blue-500 focus:shadow-md focus:shadow-blue-500/20"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-800/80 border border-gray-700 rounded-2xl px-8 py-5 text-xl focus:outline-none focus:border-blue-500 focus:shadow-md focus:shadow-blue-500/20"
          />

          <div className="flex gap-4 sm:gap-5 pt-3">
            <NeonButton variant="primary" size="xl" className="flex-1" onClick={signIn} disabled={loading}>
              Sign In
            </NeonButton>
            <NeonButton variant="success" size="xl" className="flex-1" onClick={signUp} disabled={loading}>
              Sign Up
            </NeonButton>
          </div>
        </div>

        {authError && (
          <p className={`text-center text-base mt-8 ${authError.includes('successful') ? 'text-green-400' : 'text-red-400'}`}>
            {authError}
          </p>
        )}
        </div>

        <p className="text-center text-base text-gray-300 mt-5 mb-4 max-w-[38rem] px-2 drop-shadow-md">
          First time? Click Sign Up and check your email.
        </p>
      </div>
    </div>
  )
}
