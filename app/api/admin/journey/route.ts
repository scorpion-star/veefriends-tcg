import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

async function assertAdmin() {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return null
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase())
  if (!adminEmails.includes(user.email?.toLowerCase() ?? '')) return null
  return user
}

// GET /api/admin/journey — list all opponents ordered by stage_order (public)
export async function GET() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('cpu_opponents')
    .select('*')
    .order('stage_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ opponents: data })
}

// POST /api/admin/journey — create a new opponent
export async function POST(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { name, difficulty, is_boss, coins_reward, stage_order } = body

  if (!name || !difficulty) {
    return NextResponse.json({ error: 'name and difficulty are required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('cpu_opponents')
    .insert({ name, difficulty, is_boss: is_boss ?? false, coins_reward: coins_reward ?? 1, stage_order: stage_order ?? 999 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ opponent: data })
}

// PUT /api/admin/journey — update an opponent
export async function PUT(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id, ...fields } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('cpu_opponents')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ opponent: data })
}

// DELETE /api/admin/journey — delete an opponent
export async function DELETE(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('cpu_opponents').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
