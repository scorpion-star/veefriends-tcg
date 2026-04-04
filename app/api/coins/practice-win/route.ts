import { NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const difficulty = Math.min(10, Math.max(1, Number(body.difficulty) || 1))
  const earned = difficulty   // 1 coin per difficulty level

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('user_profiles')
    .select('coins')
    .eq('user_id', user.id)
    .maybeSingle()

  const newCoins = (profile?.coins ?? 0) + earned
  const { error } = await admin
    .from('user_profiles')
    .upsert({ user_id: user.id, coins: newCoins }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ coins: newCoins, earned })
}
