'use client'

import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import { createClient } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import SparkleTitle from './components/SparkleTitle'
import CoinIcon from './components/CoinIcon'
import AvatarUpload from './components/AvatarUpload'
import UsernameSetup from './components/UsernameSetup'
import NeonButton from './components/NeonButton'
import { useSettings } from './components/SettingsContext'

const BG = "min-h-screen relative"
const OVERLAY = "absolute inset-0 bg-black/30"

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

        <div className="flex justify-center px-6 py-12">
        <div className="relative z-10 text-center max-w-md w-full">
          <div className="relative mx-auto mb-6" style={{ width: '22rem', height: '10rem' }}>
            <Image src="/vf-logo.png" alt="VeeFriends logo" fill style={{ objectFit: 'contain' }} />
          </div>
          <div className="flex flex-col items-center gap-2 mt-2 mb-4">
            <AvatarUpload
              userId={user.id}
              avatarUrl={avatarUrl}
              email={user.email}
              size="lg"
              onUpload={setAvatarUrl}
            />
            <p className="text-xl font-bold text-white">
              {username ?? '…'}
            </p>
          </div>
          <div className="space-y-4">
            <NeonButton variant="primary" size="xl" fullWidth onClick={() => router.push('/play')}>
              ⚔ Play Now
            </NeonButton>
            <NeonButton variant="secondary" size="lg" fullWidth onClick={() => router.push('/deck-builder')}>
              🃏 Deck Builder
            </NeonButton>
            <NeonButton variant="secondary" size="lg" fullWidth onClick={() => router.push('/collection')}>
              📦 My Collection
            </NeonButton>
            <NeonButton variant="secondary" size="lg" fullWidth onClick={() => router.push('/store')}>
              <CoinIcon size={18} /> Store
            </NeonButton>
            <NeonButton variant="secondary" size="lg" fullWidth onClick={() => router.push('/profile')}>
              👤 My Profile
            </NeonButton>
            <NeonButton variant="ghost" size="md" fullWidth onClick={signOut}>
              Sign Out
            </NeonButton>
          </div>
        </div>
        </div>
      </div>
    )
  }

  // ── Login screen ───────────────────────────────────────────────────────────
  return (
    <div className={`${BG} text-white`}>
      <div className="fixed inset-0 -z-10" style={{ background: background.css }}>
        {background.kenBurns && (
          <div className="w-full h-full bg-[url('/bg.jpg')] bg-cover bg-center bg-no-repeat bg-ken-burns" />
        )}
      </div>
      <div className="fixed inset-0 bg-black/55 -z-10" />
      <div className="flex justify-center px-6 py-12">
      <div className="relative z-10 bg-transparent backdrop-blur p-14 rounded-3xl w-full max-w-[38rem] shadow-2xl border border-gray-800">
        <div className="text-center mb-14">
          <div className="mx-auto mb-4 h-[12.5rem] w-auto relative" style={{ width: '27.5rem', height: '12.5rem' }}>
            <Image src="/vf-logo.png" alt="VeeFriends logo" fill style={{ objectFit: 'contain' }} />
          </div>
          <p className="text-white mt-5 text-lg">Compete & Collect Online</p>
        </div>

        <div className="space-y-8">
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

          <div className="flex gap-5 pt-5">
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

        <p className="text-center text-base text-gray-500 mt-5">
          First time? Click Sign Up and check your email.
        </p>
      </div>
      </div>
    </div>
  )
}
