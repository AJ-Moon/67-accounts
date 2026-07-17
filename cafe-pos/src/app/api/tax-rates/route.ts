import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase.from('tax_rates').select('*').order('paymentMethod');
  if (error) return NextResponse.json({ error: 'Failed to fetch tax rates' }, { status: 500 });
  return NextResponse.json(data || []);
}

/** PUT { rates: [{ paymentMethod, rate }] } → upsert all rates. */
export async function PUT(request: Request) {
  try {
    const { rates } = await request.json();
    if (!Array.isArray(rates)) return NextResponse.json({ error: 'rates[] required' }, { status: 400 });
    for (const r of rates) {
      const rate = Number(r.rate);
      if (!r.paymentMethod || isNaN(rate) || rate < 0 || rate > 100) {
        return NextResponse.json({ error: 'Each rate needs paymentMethod and rate 0-100' }, { status: 400 });
      }
    }
    const { error } = await supabase.from('tax_rates').upsert(
      rates.map((r: any) => ({ paymentMethod: r.paymentMethod, rate: Number(r.rate), updatedAt: new Date().toISOString() }))
    );
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to save tax rates' }, { status: 500 });
  }
}
