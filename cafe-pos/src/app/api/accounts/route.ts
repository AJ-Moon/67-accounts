import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/** GET → all accounts with live balances. */
export async function GET() {
  try {
    const [{ data: accounts, error }, { data: balances }] = await Promise.all([
      supabase.from('accounts').select('*').order('createdAt'),
      supabase.from('v_account_balances').select('*'),
    ]);
    if (error) throw error;
    const balMap: Record<string, number> = {};
    (balances || []).forEach((b: any) => { balMap[b.code] = Number(b.balance); });
    return NextResponse.json((accounts || []).map((a: any) => ({ ...a, balance: balMap[a.code] ?? 0 })));
  } catch {
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

/** POST { code, name, type, isPaymentMethod, openingBalance } → create account. */
export async function POST(request: Request) {
  try {
    const json = await request.json();
    if (!json.code || !json.name) return NextResponse.json({ error: 'code and name required' }, { status: 400 });
    const code = String(json.code).toLowerCase().replace(/[^a-z0-9_]/g, '_');

    const { data, error } = await supabase.from('accounts').insert({
      code,
      name: json.name,
      type: json.type || 'other',
      isPaymentMethod: json.isPaymentMethod !== false,
      openingBalance: Number(json.openingBalance || 0),
    }).select().single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    const msg = e?.code === '23505' ? 'Account code already exists' : 'Failed to create account';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** PUT { code, isActive?, name?, isPaymentMethod? } → update account. */
export async function PUT(request: Request) {
  try {
    const json = await request.json();
    if (!json.code) return NextResponse.json({ error: 'code required' }, { status: 400 });
    const patch: any = {};
    for (const k of ['name', 'type', 'isPaymentMethod', 'isActive'] as const) {
      if (json[k] !== undefined) patch[k] = json[k];
    }
    const { data, error } = await supabase.from('accounts').update(patch).eq('code', json.code).select().single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
  }
}
