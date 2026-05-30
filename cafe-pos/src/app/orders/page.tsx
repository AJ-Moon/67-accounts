'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from '@/lib/utils';
import { toast } from "sonner";
import { Printer, XCircle, Eye } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { buildReceiptCopies } from '@/lib/printUtils';



type OrderItem = { id: number; name: string; quantity: number; price: number; notes: string; category: string };
type Order = {
  id: number;
  orderNumber: string;
  subtotal: number;
  discount: number;
  discountPercentage: number;
  finalTotal: number;
  status: string;
  source: string;
  paymentMethod: string;
  createdAt: string;
  items: OrderItem[];
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);

  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [filterSource, setFilterSource] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterPayment, setFilterPayment] = useState('All');

  const fetchOrders = () => {
    fetch('/api/orders')
      .then(res => res.json())
      .then(data => {
        setOrders(data);
        setLoading(false);
      });
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
      const copies = buildReceiptCopies(order, settingsData);
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

  const StatusBadge = ({ status }: { status: string }) => {
    if (status === 'deleted' || status === 'cancelled') return <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">Cancelled</span>;
    if (status === 'completed') return <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">Completed</span>;
    if (status === 'getting_ready') return <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">Getting Ready</span>;
    return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">Placed</span>;
  };

  const filteredOrders = orders.filter(o => 
    (filterStatus === 'All' || o.status === filterStatus) &&
    (filterSource === 'All' || o.source === filterSource) &&
    (filterPayment === 'All' || o.paymentMethod === filterPayment)
  );

  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col h-screen overflow-hidden">
      <div className="mb-6 shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Order History</h1>
          <p className="text-slate-500 mt-1">Review, reprint, or cancel past orders</p>
        </div>
      </div>

      <div className="flex gap-4 mb-4 shrink-0">
        <select className="border border-slate-300 bg-white text-sm p-2 rounded-md font-medium text-slate-700 outline-none focus:ring-2 focus:ring-slate-900" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="All">All Statuses</option>
          <option value="placed">Placed</option>
          <option value="getting_ready">Getting Ready</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="deleted">Deleted</option>
        </select>
        <select className="border border-slate-300 bg-white text-sm p-2 rounded-md font-medium text-slate-700 outline-none focus:ring-2 focus:ring-slate-900" value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
          <option value="All">All Sources</option>
          <option value="pos">POS</option>
          <option value="website">Website</option>
          <option value="foodpanda">Foodpanda</option>
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
                       {(order.status === 'placed' || order.status === 'posted' || order.status === 'getting_ready') && (
                         <Button size="sm" className="h-8 text-xs font-bold bg-green-600 hover:bg-green-700 text-white" onClick={() => updateStatus(order.id, 'completed')}>Complete</Button>
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
                                  <span>Discount ({order.discountPercentage || 20}%)</span>
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
                      {(order.status === 'placed' || order.status === 'posted' || order.status === 'getting_ready') && (
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
    </div>
  );
}
