import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { supabase } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';

async function requireAdmin() {
  const supabaseServer = await createClient();
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  return profile?.role === 'admin';
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  const { data } = await supabase.from('api_keys').select('*').order('createdAt', { ascending: false });
  return NextResponse.json(data || []);
}

/** POST { name } → generates and returns a new key. */
export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  const { name } = await request.json();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const key = `pk_${randomBytes(24).toString('hex')}`;
  const { data, error } = await supabase.from('api_keys').insert({ name, key }).select().single();
  if (error) return NextResponse.json({ error: 'Failed to create key' }, { status: 500 });
  return NextResponse.json(data);
}

/** DELETE { id } → revoke a key. */
export async function DELETE(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  const { id } = await request.json();
  const { error } = await supabase.from('api_keys').update({ isActive: false }).eq('id', id);
  if (error) return NextResponse.json({ error: 'Failed to revoke key' }, { status: 500 });
  return NextResponse.json({ success: true });
}
