import { NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

const DAILY_COINS = 10
const COOLDOWN_HOURS = 24

export async function POST() {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('user_profiles')
    .select('coins, daily_coins_claimed_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profile?.daily_coins_claimed_at) {
    const hoursSince = (Date.now() - new Date(profile.daily_coins_claimed_at).getTime()) / (1000 * 60 * 60)
    if (hoursSince < COOLDOWN_HOURS) {
      const hoursLeft = Math.ceil(COOLDOWN_HOURS - hoursSince)
      return NextResponse.json({ error: 'Already claimed', hoursLeft }, { status: 429 })
    }
  }

  const newCoins = (profile?.coins ?? 0) + DAILY_COINS
  const now = new Date().toISOString()

  const { error } = await admin
    .from('user_profiles')
    .upsert({ user_id: user.id, coins: newCoins, daily_coins_claimed_at: now }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ coins: newCoins, claimed: DAILY_COINS })
}
