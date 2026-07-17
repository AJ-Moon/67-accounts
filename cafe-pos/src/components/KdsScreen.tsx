'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, RotateCcw, Flame, Coffee, Volume2, VolumeX, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { playNewOrderSound } from '@/lib/sound';

type KdsItem = {
  id: string;
  name: string;
  quantity: number;
  notes?: string | null;
  selectedOptions?: { upsize?: boolean; option?: string } | null;
  stationStatus: string;
};

type KdsOrder = {
  id: string;
  orderNumber: string;
  orderType?: string | null;
  customerName?: string | null;
  status: string;
  createdAt: string;
  items: KdsItem[];
};

function elapsed(from: string) {
  const mins = Math.floor((Date.now() - new Date(from).getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function ageColor(from: string) {
  const mins = (Date.now() - new Date(from).getTime()) / 60000;
  if (mins >= 20) return 'border-red-500 bg-red-950/40';
  if (mins >= 10) return 'border-amber-500 bg-amber-950/30';
  return 'border-slate-600 bg-slate-800/60';
}

/** Parse structured options out of notes JSON when selectedOptions column is empty (legacy rows). */
function optionsOf(item: KdsItem): { upsize?: boolean; option?: string } {
  if (item.selectedOptions) return item.selectedOptions;
  const m = (item.notes || '').match(/\{.*\}$/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* not json */ } }
  return {};
}

function plainNote(item: KdsItem) {
  return (item.notes || '').replace(/\s*\|?\s*\{.*\}$/, '').trim();
}

export default function KdsScreen({ station }: { station: 'kitchen' | 'bar' }) {
  const [orders, setOrders] = useState<KdsOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(false);
  const router = useRouter();

  // Sound on NEW orders: remember which order ids we've already seen
  const seenIds = useRef<Set<string> | null>(null);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  useEffect(() => {
    try { setMuted(localStorage.getItem(`kds-muted-${station}`) === '1'); } catch { /* ignore */ }
  }, [station]);

  const toggleMute = () => {
    setMuted(m => {
      try { localStorage.setItem(`kds-muted-${station}`, m ? '0' : '1'); } catch { /* ignore */ }
      return !m;
    });
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/kds?station=${station}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        const ids = new Set<string>(data.map((o: any) => o.id));
        if (seenIds.current !== null) {
          const fresh = data.filter((o: any) => !seenIds.current!.has(o.id));
          if (fresh.length > 0) {
            if (!mutedRef.current) playNewOrderSound();
            fresh.forEach((o: any) => toast.info(`New order ${o.orderNumber.split('-').pop()} — ${o.items.length} item(s)`));
          }
        }
        seenIds.current = ids;
        setOrders(data);
      }
    } catch { /* keep last state */ }
    setLoading(false);
  }, [station]);

  const handleLogout = async () => {
    await createClient().auth.signOut();
    router.push('/login');
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const toggleItem = async (order: KdsOrder, item: KdsItem) => {
    const undo = item.stationStatus === 'ready';
    await fetch('/api/kds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.id, station, itemId: item.id, undo }),
    });
    load();
  };

  const markAllReady = async (order: KdsOrder) => {
    await fetch('/api/kds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.id, station }),
    });
    toast.success(`${order.orderNumber} — ${station} done`);
    load();
  };

  const Icon = station === 'kitchen' ? Flame : Coffee;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Icon className="h-8 w-8 text-amber-400" />
          <h1 className="text-3xl font-bold tracking-tight uppercase">{station} Display</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-sm">{orders.length} active • refreshes every 5s</span>
          <button onClick={toggleMute} title={muted ? 'Unmute new-order sound' : 'Mute new-order sound'}
            className={`p-2 rounded-lg transition-colors ${muted ? 'bg-red-900/50 text-red-400' : 'bg-slate-800 text-green-400 hover:bg-slate-700'}`}>
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <button onClick={handleLogout} title="Logout" className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-24 text-xl">Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="text-center text-slate-500 py-24">
          <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-600" />
          <div className="text-2xl font-bold text-slate-300">All caught up</div>
          <div>New orders appear here automatically.</div>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {orders.map(order => {
            const allReady = order.items.every(i => i.stationStatus === 'ready');
            return (
              <div key={order.id} className={`rounded-xl border-2 ${allReady ? 'border-green-600 bg-green-950/30' : ageColor(order.createdAt)} p-4 flex flex-col`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-xl font-bold">{order.orderNumber.split('-').pop()}</div>
                    <div className="text-xs text-slate-400">
                      {order.orderType || 'dine in'}{order.customerName ? ` • ${order.customerName}` : ''}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      placed {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <span className="text-sm font-mono bg-slate-900 px-2 py-1 rounded text-amber-400">{elapsed(order.createdAt)}</span>
                </div>

                <div className="space-y-2 flex-1">
                  {order.items.map(item => {
                    const opts = optionsOf(item);
                    const note = plainNote(item);
                    const ready = item.stationStatus === 'ready';
                    return (
                      <button key={item.id} onClick={() => toggleItem(order, item)}
                        className={`w-full text-left rounded-lg p-2 transition-colors ${ready ? 'bg-green-900/40 line-through text-slate-500' : 'bg-slate-900 hover:bg-slate-800'}`}>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold">{item.quantity}× {item.name}</span>
                          {ready ? <RotateCcw className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-slate-500" />}
                        </div>
                        {opts.upsize === true && <div className="text-xs text-amber-400 font-bold">UPSIZE</div>}
                        {opts.option && <div className="text-xs text-sky-400">{opts.option}</div>}
                        {note && <div className="text-xs text-pink-400 font-medium">NOTE: {note}</div>}
                      </button>
                    );
                  })}
                </div>

                <button onClick={() => markAllReady(order)} disabled={allReady}
                  className={`mt-3 w-full rounded-lg py-2 font-bold text-sm transition-colors ${allReady ? 'bg-green-700 text-green-200 cursor-default' : 'bg-amber-500 hover:bg-amber-400 text-slate-950'}`}>
                  {allReady ? 'READY ✓' : 'MARK ALL READY'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
