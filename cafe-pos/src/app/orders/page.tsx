'use client';

import { useState, useEffect, useRef } from 'react';
import { playOrderReadySound } from '@/lib/sound';
import { Volume2, VolumeX } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from '@/lib/utils';
import { toast } from "sonner";
import { Printer, XCircle, Eye, Pencil, Plus, Minus, Trash2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { buildReceiptCopies } from '@/lib/printUtils';



type OrderItem = { id: number; itemId?: string | null; name: string; quantity: number; price: number; notes: string; category: string; subcategory?: string | null; selectedOptions?: any };
type Order = {
  id: number;
  orderNumber: string;
  subtotal: number;
  discount: number;
  discountPercentage: number;
  tax?: number;
  taxRate?: number;
  finalTotal: number;
  status: string;
  source: string;
  paymentMethod: string;
  createdAt: string;
  items: OrderItem[];
};

function EditOrderDialog({ order, onClose, onSaved }: { order: Order; onClose: () => void; onSaved: () => void }) {
  const [lines, setLines] = useState<any[]>(order.items.map(i => ({ ...i, id: i.itemId ?? null })));
  const [menu, setMenu] = useState<any[]>([]);
  const [addId, setAddId] = useState('');
  const [discountPct, setDiscountPct] = useState<number>(Number(order.discountPercentage || 0));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/items').then(r => r.json()).then(d => setMenu(Array.isArray(d) ? d.filter((m: any) => m.isAvailable) : []));
  }, []);

  const setQty = (idx: number, qty: number) => {
    if (qty <= 0) return;
    setLines(ls => ls.map((l, i) => i === idx ? { ...l, quantity: qty } : l));
  };

  const addItem = () => {
    const m = menu.find(x => String(x.id) === addId);
    if (!m) return;
    setLines(ls => {
      const existing = ls.findIndex(l => String(l.id) === String(m.id) && !l.notes);
      if (existing >= 0) return ls.map((l, i) => i === existing ? { ...l, quantity: l.quantity + 1 } : l);
      return [...ls, { id: m.id, name: m.name, category: m.category, subcategory: m.subcategory, price: Number(m.price), quantity: 1, notes: '' }];
    });
    setAddId('');
  };

  const save = async () => {
    if (lines.length === 0) { toast.error('Order must keep at least one item — use Cancel instead.'); return; }
    setSaving(true);
    const res = await fetch(`/api/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: lines, discountPercentage: discountPct }),
    });
    setSaving(false);
    if (res.ok) { toast.success('Order updated'); onClose(); onSaved(); }
    else { const j = await res.json().catch(() => ({})); toast.error(j.error || 'Failed to update order'); }
  };

  const total = lines.reduce((s, l) => s + Number(l.price) * Number(l.quantity), 0);

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit Order {order.orderNumber}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2 max-h-[60vh] overflow-y-auto">
          {lines.map((l, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded">
              <div className="flex-1">
                <div className="text-sm font-medium">{l.name}</div>
                <div className="text-xs text-slate-500">{formatCurrency(Number(l.price))} each{l.notes ? ` • ${l.notes}` : ''}</div>
              </div>
              <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setQty(idx, l.quantity - 1)}><Minus className="h-3 w-3" /></Button>
              <span className="w-6 text-center text-sm font-bold">{l.quantity}</span>
              <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setQty(idx, l.quantity + 1)}><Plus className="h-3 w-3" /></Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => setLines(ls => ls.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-2">
          <select className="flex-1 border border-slate-300 rounded p-2 text-sm" value={addId} onChange={e => setAddId(e.target.value)}>
            <option value="">Add item...</option>
            {menu.map(m => <option key={m.id} value={String(m.id)}>{m.name}{m.size ? ` (${m.size})` : ''} — {formatCurrency(Number(m.price))}</option>)}
          </select>
          <Button variant="outline" onClick={addItem} disabled={!addId}><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm font-medium">Discount</span>
          <select className="border border-slate-300 rounded p-1.5 text-sm font-bold" value={discountPct} onChange={e => setDiscountPct(Number(e.target.value))}>
            <option value={0}>No discount</option>
            {[5, 10, 15, 20, 25, 30].map(p => <option key={p} value={p}>{p}%</option>)}
          </select>
        </div>
        <div className="flex justify-between font-bold pt-3 border-t mt-2">
          <span>New Subtotal</span><span>{formatCurrency(total)}</span>
        </div>
        <p className="text-xs text-slate-500">Tax & discount are recalculated automatically. Inventory is re-synced.</p>
        <Button onClick={save} disabled={saving} className="w-full">{saving ? 'Saving...' : 'Save Changes'}</Button>
      </DialogContent>
    </Dialog>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [payMethods, setPayMethods] = useState<{ code: string; name: string }[]>([]);

  useEffect(() => {
    fetch('/api/accounts').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setPayMethods(d.filter((a: any) => a.isActive && a.isPaymentMethod).map((a: any) => ({ code: a.code, name: a.name })));
    }).catch(() => {});
  }, []);

  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [filterStatus, setFilterStatus] = useState('All');
  const [filterPayment, setFilterPayment] = useState('All');

  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [completeOrderId, setCompleteOrderId] = useState<number | null>(null);
  const [completePaymentMethod, setCompletePaymentMethod] = useState<string>('cash');
  const [completeLoading, setCompleteLoading] = useState(false);

  // Sound when an order becomes fully READY (kitchen + bar both done)
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const readySeen = useRef<Set<number | string> | null>(null);

  useEffect(() => {
    try { setMuted(localStorage.getItem('orders-muted') === '1'); } catch { /* ignore */ }
  }, []);
  const toggleMute = () => setMuted(m => {
    try { localStorage.setItem('orders-muted', m ? '0' : '1'); } catch { /* ignore */ }
    return !m;
  });

  const fetchOrders = () => {
    fetch('/api/orders')
      .then(res => res.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        const readyNow = data.filter((o: any) => o.status === 'ready').map((o: any) => o.id);
        if (readySeen.current !== null) {
          const fresh = data.filter((o: any) => o.status === 'ready' && !readySeen.current!.has(o.id));
          if (fresh.length > 0) {
            if (!mutedRef.current) playOrderReadySound();
            fresh.forEach((o: any) => toast.success(`Order ${o.orderNumber} is READY for pickup/serving!`, { duration: 8000 }));
          }
        }
        readySeen.current = new Set(readyNow);
        setOrders(data);
        setLoading(false);
      })
      .catch(() => {});
  };

  useEffect(() => {
    async function loadRole() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
         const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
         if (data) setRole(data.role);
      }
    }
    loadRole();
    fetchOrders();
    const t = setInterval(fetchOrders, 10000); // live refresh + ready notifications
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reprint = async (id: number) => {
    toast.info("Preparing exact receipt copies...");
    const order = orders.find(o => o.id === id);
    if (!order || !order.items || order.items.length === 0) {
       toast.error("No items found for this order. Receipt cannot be printed.");
       return;
    }
    
    const supabase = createClient();
    const { data: settingsData } = await supabase.from('settings').select('*').limit(1).maybeSingle();

    try {
      const copies = buildReceiptCopies(order, settingsData, true); // reprint = customer copy only
      if (copies.length === 0) {
         toast.error("Receipt constraints invalid. Cannot print empty block.");
         return;
      }
      
      const bridgeRes = await fetch('http://localhost:7878/print', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ copies })
      });
      const bridgeData = await bridgeRes.json();
      
      if (bridgeRes.ok && bridgeData.success) {
         toast.success("Reprinted to local bridge securely!");
      } else {
         throw new Error("Bridge unavailable");
      }
    } catch(e) {
      toast.warning("Direct print bridge unavailable. Cannot execute raw hardware print.");
    }
  };

  const updateStatus = async (id: number, new_status: string) => {
    const res = await fetch(`/api/orders/${id}/status`, {
       method: 'PUT',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ new_status })
    });
    if (res.ok) {
       toast.success(`Order marked as ${new_status.replace('_', ' ')}`);
       fetchOrders();
    } else {
       const err = await res.json();
       toast.error(err.error || "Failed to update status");
    }
  };

  const performSoftDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    
    const res = await fetch(`/api/orders/${deleteId}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminEmail, adminPassword, deleteReason: deleteReason || 'Cancelled by rules' }),
    });
    
    setDeleteLoading(false);
    
    if (res.ok) {
      toast.success("Order soft-deleted");
      setDeleteId(null);
      setDeleteReason('');
      setAdminEmail('');
      setAdminPassword('');
      fetchOrders();
    } else {
      const errorData = await res.json();
      toast.error(errorData.error || "Failed to cancel order");
    }
  };

  const performComplete = async () => {
    if (!completeOrderId) return;
    setCompleteLoading(true);
    
    const res = await fetch(`/api/orders/${completeOrderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_status: 'completed', paymentMethod: completePaymentMethod }),
    });
    
    setCompleteLoading(false);
    
    if (res.ok) {
      toast.success("Order marked as completed");
      setCompleteOrderId(null);
      setCompletePaymentMethod('cash');
      fetchOrders();
    } else {
      const err = await res.json();
      toast.error(err.error || "Failed to update status");
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    if (status === 'deleted' || status === 'cancelled') return <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">Cancelled</span>;
    if (status === 'completed') return <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">Completed</span>;
    if (status === 'ready') return <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider animate-pulse">● Ready</span>;
    if (status === 'getting_ready') return <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">Getting Ready</span>;
    return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">Placed</span>;
  };

  const isOpen = (s: string) => ['placed', 'posted', 'getting_ready', 'ready'].includes(s);

  const filteredOrders = orders.filter(o => 
    (filterStatus === 'All' || o.status === filterStatus) &&
    (filterPayment === 'All' || o.paymentMethod === filterPayment)
  );

  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col h-screen overflow-hidden">
      <div className="mb-6 shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Order History</h1>
          <p className="text-slate-500 mt-1">Live view — chimes when kitchen & bar finish an order</p>
        </div>
        <button onClick={toggleMute} title={muted ? 'Unmute ready notification' : 'Mute ready notification'}
          className={`p-2 rounded-lg border transition-colors ${muted ? 'border-red-200 bg-red-50 text-red-500' : 'border-slate-200 bg-white text-green-600 hover:bg-slate-50'}`}>
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </div>

      <div className="flex gap-4 mb-4 shrink-0">
        <select className="border border-slate-300 bg-white text-sm p-2 rounded-md font-medium text-slate-700 outline-none focus:ring-2 focus:ring-slate-900" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="All">All Statuses</option>
          <option value="placed">Placed</option>
          <option value="getting_ready">Getting Ready</option>
          <option value="ready">Ready</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="deleted">Deleted</option>
        </select>
        <select className="border border-slate-300 bg-white text-sm p-2 rounded-md font-medium text-slate-700 outline-none focus:ring-2 focus:ring-slate-900" value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)}>
          <option value="All">All Payments</option>
          <option value="cash">Cash</option>
          <option value="credit_card">Credit Card</option>
          <option value="transfer">Transfer</option>
          <option value="jazzcash">JazzCash</option>
          <option value="foodpanda">Foodpanda</option>
        </select>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col shadow-sm">
        <CardContent className="p-0 flex-1 overflow-y-auto">
          <Table>
            <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">Loading history...</TableCell></TableRow>
              ) : filteredOrders.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500">No orders found.</TableCell></TableRow>
              ) : (
                filteredOrders.map(order => (
                  <TableRow key={order.id} className={order.status === 'deleted' || order.status === 'Cancelled' ? 'opacity-50' : ''}>
                    <TableCell className="font-semibold">{order.orderNumber}</TableCell>
                    <TableCell>
                      {new Date(order.createdAt).toLocaleDateString()} at {new Date(order.createdAt).toLocaleTimeString()}
                    </TableCell>
                    <TableCell className="font-bold text-amber-600">{formatCurrency(order.finalTotal)}</TableCell>
                    <TableCell>
                      <span className="font-medium text-slate-700">{order.paymentMethod}</span>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-sm text-[10px] font-semibold uppercase ${order.source === 'website' ? 'bg-purple-100 text-purple-700 tracking-widest' : 'bg-slate-100 text-slate-600'}`}>{order.source}</span>
                    </TableCell>
                    <TableCell><StatusBadge status={order.status} /></TableCell>
                    <TableCell className="text-right space-x-2">
                       {(order.status === 'placed' || order.status === 'posted') && (
                         <Button size="sm" variant="outline" className="h-8 text-xs font-bold border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => updateStatus(order.id, 'getting_ready')}>Start</Button>
                       )}
                       {isOpen(order.status) && (
                         <Button size="sm" variant="outline" className="h-8 w-8 p-0" title="Edit order" onClick={() => setEditOrder(order)}>
                           <Pencil className="h-4 w-4" />
                         </Button>
                       )}
                       {isOpen(order.status) && (
                        <Dialog open={completeOrderId === order.id} onOpenChange={(open) => { if (!open) setCompleteOrderId(null); else setCompleteOrderId(order.id); }}>
                          <DialogTrigger>
                            <span className="inline-flex h-8 px-3 text-xs font-bold items-center justify-center bg-green-600 hover:bg-green-700 text-white rounded-md cursor-pointer transition-colors shadow-sm">Complete</span>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Complete Order #{order.orderNumber}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-4">
                              <div className="space-y-2">
                                <Label>Payment Method</Label>
                                <select className="w-full border border-slate-300 rounded p-2 text-sm" value={completePaymentMethod} onChange={(e) => setCompletePaymentMethod(e.target.value)}>
                                  {(payMethods.length > 0 ? payMethods : [
                                    { code: 'cash', name: 'Cash' }, { code: 'credit_card', name: 'Credit Card' },
                                    { code: 'jazzcash', name: 'JazzCash' }, { code: 'foodpanda', name: 'Foodpanda' },
                                    { code: 'transfer', name: 'Transfer' },
                                  ]).map(m => <option key={m.code} value={m.code}>{m.name}</option>)}
                                </select>
                                <p className="text-xs text-slate-500">Tax is recalculated for the selected payment method.</p>
                              </div>
                              <Button 
                                onClick={performComplete} 
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-10 shadow-sm mt-4"
                                disabled={completeLoading}
                              >
                                {completeLoading ? 'Processing...' : 'Confirm & Complete'}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                       )}
                      <Dialog>
                        <DialogTrigger>
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white shadow-sm transition-colors hover:bg-slate-100 hover:text-slate-900" title="View details">
                             <Eye className="h-4 w-4" />
                          </span>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">Order {order.orderNumber}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 pt-4">
                            <ul className="space-y-2 border-b pb-4">
                              {order.items.map((i, idx) => (
                                <li key={idx} className="flex flex-col text-[13px] bg-slate-50 p-2 rounded">
                                  <div className="flex justify-between font-medium">
                                    <span>{i.quantity}x {i.name}</span>
                                    <span>{formatCurrency(i.price * i.quantity)}</span>
                                  </div>
                                  {i.notes && <span className="text-slate-500 text-xs mt-0.5">Note: {i.notes}</span>}
                                </li>
                              ))}
                            </ul>
                            <div className="space-y-1 text-sm pt-2 px-1">
                              <div className="flex justify-between text-slate-600">
                                <span>Subtotal</span>
                                <span>{formatCurrency(order.subtotal)}</span>
                              </div>
                              {order.discount > 0 && (
                                <div className="flex justify-between text-red-600 font-medium">
                                  <span>Discount ({order.discountPercentage || 0}%)</span>
                                  <span>-{formatCurrency(order.discount)}</span>
                                </div>
                              )}
                              <div className="flex justify-between font-bold text-lg pt-3 mt-2 border-t text-slate-900">
                                <span>Total Paid ({order.paymentMethod})</span>
                                <span>{formatCurrency(order.finalTotal)}</span>
                              </div>
                            </div>
                             <div className="flex gap-3 pt-6 mt-2 justify-end">
                                <Button onClick={() => reprint(order.id)} className="w-full bg-slate-900 text-white font-bold h-10 shadow-sm"><Printer className="h-4 w-4 mr-2" /> Reprint Receipt</Button>
                             </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      {isOpen(order.status) && (
                         <Button size="sm" variant="ghost" className="h-8 text-xs font-bold text-red-500 hover:bg-red-50 hover:text-red-700" onClick={() => updateStatus(order.id, 'cancelled')}>Cancel</Button>
                      )}
                      
                      <Dialog>
                        <DialogTrigger>
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-slate-400 hover:bg-slate-100 hover:text-slate-600 hover:border-slate-200 transition-colors cursor-pointer shadow-sm ml-2 disabled:opacity-50" onClick={() => setDeleteId(order.id)} title="Hard delete (Admin)">
                            <XCircle className="h-4 w-4" />
                          </span>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Delete Order #{order.orderNumber}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 pt-4">
                            {role !== 'admin' && (
                              <div className="bg-amber-50 border border-amber-200 p-3 rounded text-amber-800 text-sm mb-4">
                                Admin credentials are required to authorize deleting an order.
                              </div>
                            )}

                            {role !== 'admin' && (
                              <>
                                <div className="space-y-2">
                                  <Label>Admin Email</Label>
                                  <Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                  <Label>Admin Password</Label>
                                  <Input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
                                </div>
                              </>
                            )}

                            <div className="space-y-2">
                              <Label>Reason for Deletion</Label>
                              <Input value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} placeholder="e.g. Customer changed mind, wrong order entered" />
                            </div>

                            <Button 
                              onClick={performSoftDelete} 
                              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-10 shadow-sm mt-4"
                              disabled={deleteLoading || (role !== 'admin' && (!adminEmail || !adminPassword))}
                            >
                              {deleteLoading ? 'Authenticating...' : 'Authorize Deletion'}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editOrder && (
        <EditOrderDialog order={editOrder} onClose={() => setEditOrder(null)} onSaved={fetchOrders} />
      )}
    </div>
  );
}
