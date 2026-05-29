'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Edit2, Trash2, Plus } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

type Item = {
  id: number;
  name: string;
  category: string;
  subcategory?: string | null;
  size?: string | null;
  variant?: string | null;
  price: number;
  isAvailable: boolean;
  allowUpsize: boolean;
  upsizePrice: number;
  optionsConfig?: any;
};

function normalizeCategory(category: any) {
  if (!category) return 'Food';
  const normalized = category.toString().trim().toLowerCase();
  if (normalized === 'drink' || normalized === 'drinks') return 'Drinks';
  if (normalized === 'food') return 'Food';
  return category;
}

export default function MenuItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const fetchItems = () => {
    fetch('/api/items')
      .then(res => res.json())
      .then(data => {
        setItems(data.map((item: any) => ({
          ...item,
          category: normalizeCategory(item.category),
        })));
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const payload = {
      name: formData.get('name'),
      category: formData.get('category'),
      subcategory: formData.get('subcategory'),
      size: formData.get('size'),
      variant: formData.get('variant'),
      price: parseFloat(String(formData.get('price'))),
      isAvailable: formData.get('isAvailable') === 'true',
      allowUpsize: formData.get('allowUpsize') === 'on',
      upsizePrice: parseFloat(String(formData.get('upsizePrice')) || '0'),
      optionsConfig: formData.get('optionsConfig') ? JSON.parse(String(formData.get('optionsConfig'))) : null,
    };

    const method = editingItem ? 'PUT' : 'POST';
    const url = editingItem ? `/api/items/${editingItem.id}` : '/api/items';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      toast.success(editingItem ? 'Item updated' : 'Item added');
      setOpen(false);
      setEditingItem(null);
      fetchItems();
    } else {
      toast.error('Failed to save item');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Item deleted');
      fetchItems();
    } else {
      toast.error('Failed to delete item');
    }
  };

  const toggleAvailability = async (item: Item) => {
    const res = await fetch(`/api/items/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...item,
        category: normalizeCategory(item.category),
        isAvailable: !item.isAvailable,
      }),
    });
    if (res.ok) {
      fetchItems();
    }
  };

  const openEdit = (item: Item) => {
    setEditingItem(item);
    setOpen(true);
  };

  const openNew = () => {
    setEditingItem(null);
    setOpen(true);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Menu Items</h1>
          <p className="text-slate-500 mt-1">Manage Drinks and Food items with subcategory, size, and variant support.</p>
        </div>
        <button onClick={openNew} className="flex h-9 items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-slate-50 shadow transition-colors hover:bg-slate-900/90 whitespace-nowrap">
          <Plus className="mr-2 h-4 w-4" /> Add Item
        </button>
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingItem(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Item Name</Label>
              <Input id="name" name="name" defaultValue={editingItem?.name || ''} required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Main Category</Label>
                <Input id="category" name="category" placeholder="Drinks, Food, etc" defaultValue={editingItem?.category || ''} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subcategory">Subcategory</Label>
                <Input id="subcategory" name="subcategory" defaultValue={editingItem?.subcategory || ''} placeholder="e.g. Hot Coffee" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="size">Size</Label>
                <Input id="size" name="size" defaultValue={editingItem?.size || ''} placeholder="e.g. Tall" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="variant">Variant</Label>
                <Input id="variant" name="variant" defaultValue={editingItem?.variant || ''} placeholder="e.g. Iced" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price</Label>
                <Input id="price" name="price" type="number" step="0.01" defaultValue={editingItem?.price ?? 0} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="isAvailable">Availability</Label>
                <Select name="isAvailable" defaultValue={editingItem ? String(editingItem.isAvailable) : 'true'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Available</SelectItem>
                    <SelectItem value="false">Unavailable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 flex flex-col justify-center bg-slate-50 p-2 rounded border">
                 <div className="flex items-center gap-2">
                   <input type="checkbox" id="allowUpsize" name="allowUpsize" defaultChecked={editingItem?.allowUpsize} className="w-4 h-4 rounded text-slate-900 border-slate-300 focus:ring-slate-900" />
                   <Label htmlFor="allowUpsize" className="font-bold text-slate-700">Allow Option to Upsize?</Label>
                 </div>
              </div>
              <div className="space-y-2">
                 <Label htmlFor="upsizePrice">Upsize Price (+Rs.)</Label>
                 <Input id="upsizePrice" name="upsizePrice" type="number" step="0.01" defaultValue={editingItem?.upsizePrice ?? 0} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="optionsConfig">Advanced Options JSON (Optional)</Label>
              <textarea 
                 name="optionsConfig"
                 id="optionsConfig"
                 className="w-full h-24 text-xs font-mono border border-slate-200 rounded-md p-2 bg-slate-50 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
                 placeholder={`{\n  "requiresSelection": true,\n  "selectionName": "Sauce",\n  "choices": ["Garlic", "Spicy"]\n}`}
                 defaultValue={editingItem?.optionsConfig ? JSON.stringify(editingItem.optionsConfig, null, 2) : ''}
              />
            </div>
            <Button type="submit" className="w-full">Save Item</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Menu Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Main Category</TableHead>
                <TableHead>Subcategory</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">Loading menu...</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-500 flex flex-col items-center"><div className="font-medium text-lg text-slate-700">No menu items yet.</div><div>Add your first item using the button above.</div></TableCell></TableRow>
              ) : (
                items.map(item => (
                  <TableRow key={item.id} className={!item.isAvailable ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">
                      <div>{item.name}</div>
                      {(item.variant || item.size) && (
                        <div className="text-xs text-slate-500 mt-0.5">{[item.size, item.variant].filter(Boolean).join(' • ')}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.category === 'Drinks' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                        {item.category}
                      </span>
                    </TableCell>
                    <TableCell>{item.subcategory || 'General'}</TableCell>
                    <TableCell>
                      <div>{formatCurrency(item.price)}</div>
                      {item.allowUpsize && <div className="text-[10px] text-green-700 font-bold uppercase mt-0.5">Upsize +{formatCurrency(item.upsizePrice)}</div>}
                      {item.price <= 0 && <div className="text-xs text-red-600">Price not set</div>}
                    </TableCell>
                    <TableCell>
                      <button 
                        onClick={() => toggleAvailability(item)}
                        className={`text-xs px-2 py-1 rounded border transition-colors ${item.isAvailable ? 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100' : 'border-red-200 text-red-700 bg-red-50 hover:bg-red-100'}`}
                      >
                        {item.isAvailable ? 'Available' : 'Disabled'}
                      </button>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
