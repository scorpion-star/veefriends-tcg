import { NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

export async function POST() {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('user_profiles')
    .select('coins')
    .eq('user_id', user.id)
    .maybeSingle()

  const newCoins = (profile?.coins ?? 0) + 1
  const { error } = await admin
    .from('user_profiles')
    .upsert({ user_id: user.id, coins: newCoins }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ coins: newCoins, earned: 1 })
}
