'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Edit2, PackagePlus, Trash2, AlertTriangle } from 'lucide-react';

type Ingredient = {
  id: string;
  name: string;
  unit: string;
  isTrackable: boolean;
  currentStock: number;
  lowStockThreshold: number;
  costPerUnit: number;
  isActive: boolean;
};

type Account = { code: string; name: string };
type MenuItem = { id: string; name: string; category: string; size?: string; variant?: string };
type RecipeLine = { ingredientId: string; quantity: number; upsizeExtra: number };

const TABS = ['Stock', 'Wastage Log', 'Recipes', 'History'] as const;

export default function InventoryPage() {
  const [tab, setTab] = useState<typeof TABS[number]>('Stock');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  // dialogs
  const [ingDialog, setIngDialog] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [purchaseFor, setPurchaseFor] = useState<Ingredient | null>(null);
  const [wastageDialog, setWastageDialog] = useState(false);

  const fetchAll = useCallback(() => {
    fetch('/api/ingredients').then(r => r.json()).then(d => { setIngredients(Array.isArray(d) ? d : []); setLoading(false); });
    fetch('/api/accounts').then(r => r.json()).then(d => setAccounts(Array.isArray(d) ? d.filter((a: any) => a.isActive) : [])).catch(() => {});
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const active = ingredients.filter(i => i.isActive);
  const lowStock = active.filter(i => i.isTrackable && Number(i.currentStock) <= Number(i.lowStockThreshold));

  const saveIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const payload: any = {
      name: fd.get('name'),
      unit: fd.get('unit'),
      isTrackable: fd.get('isTrackable') === 'true',
      lowStockThreshold: parseFloat(String(fd.get('lowStockThreshold')) || '0'),
      costPerUnit: parseFloat(String(fd.get('costPerUnit')) || '0'),
      currentStock: parseFloat(String(fd.get('currentStock')) || '0'),
    };
    const res = await fetch(editing ? `/api/ingredients/${editing.id}` : '/api/ingredients', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) { toast.success(editing ? 'Ingredient updated' : 'Ingredient added'); setIngDialog(false); setEditing(null); fetchAll(); }
    else { const j = await res.json().catch(() => ({})); toast.error(j.error || 'Failed to save'); }
  };

  const deactivate = async (ing: Ingredient) => {
    if (!confirm(`Remove "${ing.name}" from inventory? History is kept.`)) return;
    const res = await fetch(`/api/ingredients/${ing.id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Removed'); fetchAll(); }
  };

  const savePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseFor) return;
    const fd = new FormData(e.target as HTMLFormElement);
    const res = await fetch('/api/inventory/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ingredientId: purchaseFor.id,
        quantity: parseFloat(String(fd.get('quantity'))),
        unitCost: fd.get('unitCost') ? parseFloat(String(fd.get('unitCost'))) : undefined,
        paidFromAccount: fd.get('paidFromAccount') || undefined,
        note: fd.get('note') || undefined,
      }),
    });
    if (res.ok) { toast.success('Purchase recorded'); setPurchaseFor(null); fetchAll(); }
    else { const j = await res.json().catch(() => ({})); toast.error(j.error || 'Failed'); }
  };

  const saveWastage = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const res = await fetch('/api/inventory/wastage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ingredientId: fd.get('ingredientId'),
        quantity: parseFloat(String(fd.get('quantity'))),
        reason: fd.get('reason'),
      }),
    });
    if (res.ok) { toast.success('Wastage recorded'); setWastageDialog(false); fetchAll(); }
    else { const j = await res.json().catch(() => ({})); toast.error(j.error || 'Failed'); }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-slate-500 mt-1">Stock, purchases, wastage and recipes. Sales deduct stock automatically.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setWastageDialog(true)}>
            <Trash2 className="mr-2 h-4 w-4" /> Record Wastage
          </Button>
          <Button onClick={() => { setEditing(null); setIngDialog(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Ingredient
          </Button>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Low stock alert</div>
            <div className="text-sm">{lowStock.map(i => `${i.name} (${i.currentStock} ${i.unit})`).join(', ')}</div>
          </div>
        </div>
      )}

      <div className="flex gap-1 mb-4 border-b">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Stock' && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingredient</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Cost / Unit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : active.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-12 text-slate-500">No ingredients yet. Add your first one above.</TableCell></TableRow>
                ) : active.map(ing => {
                  const low = ing.isTrackable && Number(ing.currentStock) <= Number(ing.lowStockThreshold);
                  return (
                    <TableRow key={ing.id}>
                      <TableCell className="font-medium">{ing.name}</TableCell>
                      <TableCell>
                        {ing.isTrackable
                          ? <span className={low ? 'text-red-600 font-bold' : ''}>{Number(ing.currentStock)} {ing.unit}</span>
                          : <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">Untracked stock</span>}
                      </TableCell>
                      <TableCell>Rs {Number(ing.costPerUnit).toFixed(2)}</TableCell>
                      <TableCell>
                        {ing.isTrackable
                          ? (low ? <span className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200">LOW</span>
                                 : <span className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200">OK</span>)
                          : <span className="text-xs text-slate-400">—</span>}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="outline" size="sm" title="Record purchase" onClick={() => setPurchaseFor(ing)}>
                          <PackagePlus className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { setEditing(ing); setIngDialog(true); }}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => deactivate(ing)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === 'Wastage Log' && <WastageLog />}
      {tab === 'Recipes' && <RecipesTab ingredients={active} />}
      {tab === 'History' && <HistoryTab />}

      {/* Add / Edit ingredient */}
      <Dialog open={ingDialog} onOpenChange={(v) => { setIngDialog(v); if (!v) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Ingredient' : 'Add Ingredient'}</DialogTitle></DialogHeader>
          <form onSubmit={saveIngredient} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={editing?.name || ''} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Select name="unit" defaultValue={editing?.unit || 'pcs'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['pcs', 'g', 'kg', 'ml', 'l', 'shot', 'scoop', 'slice'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="isTrackable">Tracking</Label>
                <Select name="isTrackable" defaultValue={editing ? String(editing.isTrackable) : 'true'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Trackable (counted stock)</SelectItem>
                    <SelectItem value="false">Untrackable (sauces etc.)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currentStock">Current Stock</Label>
                <Input id="currentStock" name="currentStock" type="number" step="0.01" defaultValue={editing?.currentStock ?? 0} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lowStockThreshold">Low Stock Alert</Label>
                <Input id="lowStockThreshold" name="lowStockThreshold" type="number" step="0.01" defaultValue={editing?.lowStockThreshold ?? 0} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="costPerUnit">Cost / Unit (Rs)</Label>
                <Input id="costPerUnit" name="costPerUnit" type="number" step="0.01" defaultValue={editing?.costPerUnit ?? 0} />
              </div>
            </div>
            {editing && <p className="text-xs text-slate-500">Changing stock here records a manual adjustment in history.</p>}
            <Button type="submit" className="w-full">Save</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Purchase */}
      <Dialog open={!!purchaseFor} onOpenChange={(v) => { if (!v) setPurchaseFor(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Purchase — {purchaseFor?.name}</DialogTitle></DialogHeader>
          <form onSubmit={savePurchase} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity ({purchaseFor?.unit})</Label>
                <Input id="quantity" name="quantity" type="number" step="0.01" min="0.01" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unitCost">Cost / Unit (Rs)</Label>
                <Input id="unitCost" name="unitCost" type="number" step="0.01" defaultValue={purchaseFor?.costPerUnit ?? ''} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paidFromAccount">Paid From (creates expense entry)</Label>
              <Select name="paidFromAccount">
                <SelectTrigger><SelectValue placeholder="No payment — stock only" /></SelectTrigger>
                <SelectContent>
                  {accounts.map(a => <SelectItem key={a.code} value={a.code}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Note</Label>
              <Input id="note" name="note" placeholder="Supplier, invoice #..." />
            </div>
            <Button type="submit" className="w-full">Record Purchase</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Wastage */}
      <Dialog open={wastageDialog} onOpenChange={setWastageDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Wastage</DialogTitle></DialogHeader>
          <form onSubmit={saveWastage} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Ingredient</Label>
              <Select name="ingredientId" required>
                <SelectTrigger><SelectValue placeholder="Select ingredient" /></SelectTrigger>
                <SelectContent>
                  {active.map(i => <SelectItem key={i.id} value={i.id}>{i.name} ({i.unit})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wq">Quantity wasted</Label>
              <Input id="wq" name="quantity" type="number" step="0.01" min="0.01" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Input id="reason" name="reason" placeholder="Expired, burnt, spilled..." required />
            </div>
            <Button type="submit" className="w-full">Record Wastage</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WastageLog() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch('/api/inventory/wastage').then(r => r.json()).then(d => { setRows(Array.isArray(d) ? d : []); setLoading(false); }); }, []);
  const totalCost = rows.reduce((s, r) => s + Number(r.estimatedCost || 0), 0);
  return (
    <Card>
      <CardHeader><CardTitle className="flex justify-between"><span>Wastage Log</span><span className="text-red-600">Est. loss: Rs {totalCost.toFixed(2)}</span></CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Ingredient</TableHead><TableHead>Qty</TableHead><TableHead>Reason</TableHead><TableHead className="text-right">Est. Cost</TableHead></TableRow></TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
            : rows.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-12 text-slate-500">No wastage recorded.</TableCell></TableRow>
            : rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="text-sm">{new Date(r.createdAt).toLocaleString()}</TableCell>
                <TableCell className="font-medium">{r.ingredient}</TableCell>
                <TableCell>{Number(r.quantity)} {r.unit}</TableCell>
                <TableCell className="text-slate-500">{r.reason}</TableCell>
                <TableCell className="text-right text-red-600">Rs {Number(r.estimatedCost || 0).toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RecipesTab({ ingredients }: { ingredients: Ingredient[] }) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [lines, setLines] = useState<RecipeLine[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetch('/api/items').then(r => r.json()).then(d => setItems(Array.isArray(d) ? d : [])); }, []);

  useEffect(() => {
    if (!selected) { setLines([]); return; }
    fetch(`/api/recipes?itemId=${selected}`).then(r => r.json()).then(d => {
      setLines((Array.isArray(d) ? d : []).map((l: any) => ({
        ingredientId: l.ingredientId, quantity: Number(l.quantity), upsizeExtra: Number(l.upsizeExtra || 0),
      })));
    });
  }, [selected]);

  const save = async () => {
    setSaving(true);
    const res = await fetch('/api/recipes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: selected, lines: lines.filter(l => l.ingredientId && l.quantity > 0) }),
    });
    setSaving(false);
    if (res.ok) toast.success('Recipe saved'); else toast.error('Failed to save recipe');
  };

  const setLine = (idx: number, patch: Partial<RecipeLine>) =>
    setLines(ls => ls.map((l, i) => i === idx ? { ...l, ...patch } : l));

  return (
    <Card>
      <CardHeader><CardTitle>Recipe Editor</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-md space-y-2">
          <Label>Menu item</Label>
          <Select value={selected} onValueChange={(v) => setSelected(v || '')}>
            <SelectTrigger><SelectValue placeholder="Select a menu item" /></SelectTrigger>
            <SelectContent>
              {items.map(i => (
                <SelectItem key={String(i.id)} value={String(i.id)}>
                  {i.name}{i.size ? ` (${i.size})` : ''}{i.variant ? ` — ${i.variant}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selected && (
          <>
            <p className="text-sm text-slate-500">Quantities are per 1 unit sold. Untrackable ingredients can be listed for reference but won&apos;t deduct stock.</p>
            {lines.map((line, idx) => {
              const ing = ingredients.find(i => i.id === line.ingredientId);
              return (
                <div key={idx} className="flex items-end gap-3 flex-wrap">
                  <div className="space-y-1 w-56">
                    <Label className="text-xs">Ingredient</Label>
                    <Select value={line.ingredientId || undefined} onValueChange={v => setLine(idx, { ingredientId: v || '' })}>
                      <SelectTrigger><SelectValue placeholder="Ingredient" /></SelectTrigger>
                      <SelectContent>
                        {ingredients.map(i => <SelectItem key={i.id} value={i.id}>{i.name} ({i.unit}){!i.isTrackable ? ' • untracked' : ''}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 w-32">
                    <Label className="text-xs">Qty{ing ? ` (${ing.unit})` : ''}</Label>
                    <Input type="number" step="0.01" min="0" value={line.quantity || ''} onChange={e => setLine(idx, { quantity: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-1 w-32">
                    <Label className="text-xs">Upsize extra</Label>
                    <Input type="number" step="0.01" min="0" value={line.upsizeExtra || ''} onChange={e => setLine(idx, { upsizeExtra: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <Button variant="destructive" size="sm" onClick={() => setLines(ls => ls.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              );
            })}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setLines(ls => [...ls, { ingredientId: '', quantity: 0, upsizeExtra: 0 }])}>
                <Plus className="mr-2 h-4 w-4" /> Add Ingredient
              </Button>
              <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Recipe'}</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function HistoryTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch('/api/inventory/transactions').then(r => r.json()).then(d => { setRows(Array.isArray(d) ? d : []); setLoading(false); }); }, []);
  const badge = (t: string) => ({
    purchase: 'bg-green-100 text-green-700', sale: 'bg-blue-100 text-blue-700',
    wastage: 'bg-red-100 text-red-700', adjustment: 'bg-amber-100 text-amber-700',
    order_reversal: 'bg-slate-100 text-slate-600',
  }[t] || 'bg-slate-100 text-slate-600');
  return (
    <Card>
      <CardHeader><CardTitle>Stock Movement History</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Ingredient</TableHead><TableHead>Type</TableHead><TableHead>Qty</TableHead><TableHead>Note</TableHead></TableRow></TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
            : rows.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-12 text-slate-500">No stock movements yet.</TableCell></TableRow>
            : rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="text-sm">{new Date(r.createdAt).toLocaleString()}</TableCell>
                <TableCell className="font-medium">{r.ingredient?.name}</TableCell>
                <TableCell><span className={`px-2 py-1 rounded-full text-xs font-medium ${badge(r.type)}`}>{r.type.replace('_', ' ')}</span></TableCell>
                <TableCell className={Number(r.quantity) < 0 ? 'text-red-600' : 'text-green-700'}>
                  {Number(r.quantity) > 0 ? '+' : ''}{Number(r.quantity)} {r.ingredient?.unit}
                </TableCell>
                <TableCell className="text-slate-500 text-sm">{r.reason || (r.orderId ? 'Order' : '')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
