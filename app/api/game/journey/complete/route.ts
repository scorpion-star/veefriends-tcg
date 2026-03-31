import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { opponentId } = await req.json()
  if (!opponentId) return NextResponse.json({ error: 'opponentId required' }, { status: 400 })

  const admin = createAdminClient()

  // Look up the opponent to get coin reward
  const { data: opponent } = await admin
    .from('cpu_opponents')
    .select('coins_reward')
    .eq('id', opponentId)
    .single()

  if (!opponent) return NextResponse.json({ error: 'Opponent not found' }, { status: 404 })

  // Load current progress
  const { data: progress } = await admin
    .from('user_journey_progress')
    .select('completed_opponent_ids')
    .eq('user_id', user.id)
    .maybeSingle()

  const completed: string[] = progress?.completed_opponent_ids ?? []

  // Idempotent — don't award coins twice for same opponent
  const alreadyCompleted = completed.includes(opponentId)
  const coinsEarned = alreadyCompleted ? 0 : opponent.coins_reward

  const newCompleted = alreadyCompleted ? completed : [...completed, opponentId]

  // Upsert progress
  await admin
    .from('user_journey_progress')
    .upsert(
      { user_id: user.id, completed_opponent_ids: newCompleted, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )

  // Award coins if first time
  if (coinsEarned > 0) {
    const { data: profile } = await admin
      .from('user_profiles')
      .select('coins')
      .eq('user_id', user.id)
      .maybeSingle()

    const newCoins = (profile?.coins ?? 0) + coinsEarned
    await admin
      .from('user_profiles')
      .upsert({ user_id: user.id, coins: newCoins }, { onConflict: 'user_id' })
  }

  return NextResponse.json({ coinsEarned, alreadyCompleted })
}
