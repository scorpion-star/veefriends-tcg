import { NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

const COOLDOWN_HOURS = 24

export async function GET() {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('user_profiles')
    .select('coins, daily_coins_claimed_at')
    .eq('user_id', user.id)
    .maybeSingle()

  const coins = profile?.coins ?? 0

  if (!profile?.daily_coins_claimed_at) {
    return NextResponse.json({ coins, canClaim: true, hoursLeft: 0 })
  }

  const hoursSince = (Date.now() - new Date(profile.daily_coins_claimed_at).getTime()) / (1000 * 60 * 60)
  const hoursLeft = Math.max(0, COOLDOWN_HOURS - hoursSince)

  return NextResponse.json({ coins, canClaim: hoursLeft === 0, hoursLeft: Math.ceil(hoursLeft) })
}
