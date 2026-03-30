'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import SparkleTitle from './components/SparkleTitle'
import CoinIcon from './components/CoinIcon'
import AvatarUpload from './components/AvatarUpload'
import UsernameSetup from './components/UsernameSetup'
import BugReportModal from './components/BugReportModal'

const BG = "min-h-screen relative overflow-hidden"
const OVERLAY = "absolute inset-0 bg-black/55"

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [showBugReport, setShowBugReport] = useState(false)
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
      <div className={`${BG} flex items-center justify-center text-white p-6`}>
        <div className="absolute inset-0 overflow-hidden">
          <img src="/bg.jpg" alt="" className="absolute inset-0 w-full h-full object-cover bg-ken-burns" />
        </div>
        <div className={OVERLAY} />

        {/* Username setup gate — shown until user picks a name */}
        {!profileLoading && !username && (
          <UsernameSetup onComplete={setUsername} />
        )}

        {/* Bug report modal */}
        {showBugReport && <BugReportModal onClose={() => setShowBugReport(false)} />}

        {/* Bug report button — top left */}
        <button
          onClick={() => setShowBugReport(true)}
          className="fixed top-4 left-4 z-40 bg-gray-900/80 hover:bg-gray-800 backdrop-blur border border-gray-700 hover:border-red-700/60 text-gray-400 hover:text-red-400 px-3 py-2 rounded-xl text-xs font-medium transition shadow-lg"
        >
          🐛 Report Bug
        </button>

        <div className="relative z-10 text-center max-w-md w-full">
          <SparkleTitle>VeeFriends TCG</SparkleTitle>
          <p className="text-gray-300 mt-4 mb-8 drop-shadow">Compete & Collect — Series 2</p>
          <div className="flex flex-col items-center gap-2 mb-8">
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
            <button
              onClick={() => router.push('/play')}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 py-5 rounded-2xl text-xl font-bold shadow-lg shadow-blue-900/30 transition hover:shadow-blue-400/30 hover:shadow-xl"
            >
              ⚔ Play Now
            </button>
            <button
              onClick={() => router.push('/deck-builder')}
              className="w-full bg-gray-900/70 hover:bg-gray-800/80 backdrop-blur border border-gray-700 hover:border-amber-700/60 hover:shadow-md hover:shadow-amber-900/20 py-4 rounded-2xl text-lg font-medium transition"
            >
              🃏 Deck Builder
            </button>
            <button
              onClick={() => router.push('/collection')}
              className="w-full bg-gray-900/70 hover:bg-gray-800/80 backdrop-blur border border-gray-700 hover:border-amber-700/60 hover:shadow-md hover:shadow-amber-900/20 py-4 rounded-2xl text-lg font-medium transition"
            >
              📦 My Collection
            </button>
            <button
              onClick={() => router.push('/store')}
              className="w-full bg-gray-900/70 hover:bg-gray-800/80 backdrop-blur border border-gray-700 hover:border-amber-700/60 hover:shadow-md hover:shadow-amber-900/20 py-4 rounded-2xl text-lg font-medium transition"
            >
              <span className="flex items-center justify-center gap-2"><CoinIcon size={20} /> Store</span>
            </button>
            <button
              onClick={() => router.push('/profile')}
              className="w-full bg-gray-900/70 hover:bg-gray-800/80 backdrop-blur border border-gray-700 hover:border-amber-700/60 hover:shadow-md hover:shadow-amber-900/20 py-4 rounded-2xl text-lg font-medium transition"
            >
              👤 My Profile
            </button>
            <button
              onClick={signOut}
              className="w-full bg-transparent hover:bg-gray-900/60 border border-gray-700 hover:border-gray-500 py-3 rounded-2xl text-base text-gray-400 hover:text-gray-200 transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Login screen ───────────────────────────────────────────────────────────
  return (
    <div className={`${BG} flex items-center justify-center text-white p-6`}>
      <div className="absolute inset-0 overflow-hidden">
        <div className="w-full h-full bg-[url('/bg.jpg')] bg-cover bg-center bg-no-repeat bg-ken-burns" />
      </div>
      <div className={OVERLAY} />
      <div className="relative z-10 bg-gray-900/80 backdrop-blur p-10 rounded-3xl w-full max-w-md shadow-2xl border border-gray-800">
        <div className="text-center mb-10">
          <SparkleTitle>VeeFriends TCG</SparkleTitle>
          <p className="text-gray-400 mt-4">Compete & Collect Online</p>
        </div>

        <div className="space-y-6">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-800/80 border border-gray-700 rounded-2xl px-6 py-4 text-lg focus:outline-none focus:border-blue-500 focus:shadow-md focus:shadow-blue-500/20"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-800/80 border border-gray-700 rounded-2xl px-6 py-4 text-lg focus:outline-none focus:border-blue-500 focus:shadow-md focus:shadow-blue-500/20"
          />

          <div className="flex gap-4 pt-4">
            <button
              onClick={signIn}
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 py-4 rounded-2xl text-lg font-medium transition"
            >
              Sign In
            </button>
            <button
              onClick={signUp}
              disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 py-4 rounded-2xl text-lg font-medium transition"
            >
              Sign Up
            </button>
          </div>
        </div>

        {authError && (
          <p className={`text-center text-sm mt-6 ${authError.includes('successful') ? 'text-green-400' : 'text-red-400'}`}>
            {authError}
          </p>
        )}

        <p className="text-center text-sm text-gray-500 mt-4">
          First time? Click Sign Up and check your email.
        </p>
      </div>
    </div>
  )
}
