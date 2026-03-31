import { NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

export async function GET() {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('user_journey_progress')
    .select('completed_opponent_ids')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({ completedOpponentIds: data?.completed_opponent_ids ?? [] })
}
