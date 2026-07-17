import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseAdmin';

const ROLES = ['admin', 'manager', 'cashier', 'kitchen', 'bar'];

async function requireAdmin() {
  const supabaseServer = await createClient();
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  return profile?.role === 'admin' ? user : null;
}

export async function GET() {
  try {
    if (!(await requireAdmin())) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const { data: profiles } = await supabase.from('profiles').select('*').order('created_at');

    // Emails require the service role
    const admin = createAdminClient();
    let emailMap: Record<string, string> = {};
    if (admin) {
      const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
      (data?.users || []).forEach(u => { emailMap[u.id] = u.email || ''; });
    }

    return NextResponse.json((profiles || []).map((p: any) => ({ ...p, email: emailMap[p.id] || null })));
  } catch {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

/** POST { email, password, displayName, role } → create a user (admin only). */
export async function POST(request: Request) {
  try {
    if (!(await requireAdmin())) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing in .env — required to create users.' }, { status: 500 });
    }

    const { email, password, displayName, role } = await request.json();
    if (!email || !password || !ROLES.includes(role)) {
      return NextResponse.json({ error: 'email, password and valid role required' }, { status: 400 });
    }

    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (error || !data.user) return NextResponse.json({ error: error?.message || 'Failed to create user' }, { status: 400 });

    const { error: profErr } = await admin.from('profiles').upsert({
      id: data.user.id, role, display_name: displayName || email.split('@')[0],
    });
    if (profErr) throw profErr;

    return NextResponse.json({ success: true, id: data.user.id });
  } catch {
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}

/** PUT { id, role?, displayName?, password? } → update a user (admin only). */
export async function PUT(request: Request) {
  try {
    const me = await requireAdmin();
    if (!me) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const { id, role, displayName, password } = await request.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    if (role && !ROLES.includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    if (id === me.id && role && role !== 'admin') {
      return NextResponse.json({ error: 'You cannot remove your own admin role.' }, { status: 400 });
    }

    const patch: any = {};
    if (role) patch.role = role;
    if (displayName !== undefined) patch.display_name = displayName;
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from('profiles').update(patch).eq('id', id);
      if (error) throw error;
    }

    if (password) {
      const admin = createAdminClient();
      if (!admin) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing — cannot reset passwords.' }, { status: 500 });
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
