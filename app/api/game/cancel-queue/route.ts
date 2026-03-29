import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const authClient = await createAuthClient()
  const admin = createAdminClient()

  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await admin.from('matchmaking_queue').delete().eq('user_id', user.id)
  return NextResponse.json({ ok: true })
}
