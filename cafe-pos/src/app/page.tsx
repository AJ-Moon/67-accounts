'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShoppingCart as CartIcon, Search, Plus, Minus, X, Info } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from '@/lib/supabase';
import { buildReceiptCopies } from '@/lib/printUtils';

type Item = {
  id: number;
  name: string;
  category: string;
  subcategory: string | null;
  size: string | null;
  variant: string | null;
  price: number;
  isAvailable: boolean;
  allowUpsize: boolean;
  upsizePrice: number;
  optionsConfig?: {
    requiresSelection: boolean;
    selectionName: string;
    choices: string[];
  };
};

type CartItem = Item & {
  cartId: string;
  quantity: number;
  notes: string;
  basePrice: number;
  selectedOptions: {
    upsize: boolean;
    upsizePrice: number;
    option?: string;
  };
};

export default function POSPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [mainCategory, setMainCategory] = useState<string>('Drinks');
  const [orderSource, setOrderSource] = useState<'pos' | 'website' | 'foodpanda'>('pos');
  const [applyDiscount, setApplyDiscount] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingItems, setLoadingItems] = useState(true);
  
  const [search, setSearch] = useState('');
  const [optionItem, setOptionItem] = useState<Item | null>(null);

  useEffect(() => {
    fetch('/api/items')
      .then(res => res.json())
      .then(data => {
         if (Array.isArray(data)) {
           setItems(data.filter((i: Item) => i.isAvailable));
         } else {
           setItems([]);
           toast.error(data?.error || "Error verifying database connection");
         }
         setLoadingItems(false);
      })
      .catch(err => {
         setItems([]);
         setLoadingItems(false);
         toast.error("Network connection error");
      });
  }, []);

  const addToCart = (item: Item, optionChoice?: string) => {
    if (item.price === 0) {
      toast.warning("This item has no price set. Please update price before billing.");
    }
    setCart([...cart, { 
       ...item, 
       cartId: Math.random().toString(), 
       quantity: 1, 
       notes: '',
       basePrice: item.price,
       selectedOptions: {
          upsize: false,
          upsizePrice: item.upsizePrice || 0,
          option: optionChoice || undefined
       }
    }]);
  };

  const handleItemClick = (item: Item) => {
    if (item.optionsConfig?.requiresSelection) {
      setOptionItem(item);
    } else {
      addToCart(item);
    }
  };

  const handleOptionSelect = (choice: string) => {
    if (!optionItem) return;
    addToCart(optionItem, choice);
    setOptionItem(null);
  };

  const toggleUpsize = (cartId: string) => {
    setCart(cart.map(c => {
      if (c.cartId === cartId) {
        const isUpsized = !c.selectedOptions?.upsize;
        const newPrice = isUpsized ? c.basePrice + c.selectedOptions.upsizePrice : c.basePrice;
        return {
           ...c,
           price: newPrice,
           selectedOptions: {
              ...c.selectedOptions,
              upsize: isUpsized
           }
        };
      }
      return c;
    }));
  };

  const updateQuantity = (cartId: string, delta: number) => {
    setCart(cart.map(c => {
      if (c.cartId === cartId) {
        const newQ = c.quantity + delta;
        return newQ > 0 ? { ...c, quantity: newQ } : c;
      }
      return c;
    }));
  };

  const updateNote = (cartId: string, note: string) => {
    setCart(cart.map(c => c.cartId === cartId ? { ...c, notes: note } : c));
  };

  const removeFromCart = (cartId: string) => {
    setCart(cart.filter(c => c.cartId !== cartId));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountAmount = applyDiscount ? subtotal * 0.20 : 0;
  const total = Math.max(0, subtotal - discountAmount);

  const mainCategories = Array.from(new Set(items.map(i => i.category))).filter(Boolean);
  
  const filteredItems = items.filter(i => {
    const matchMain = i.category === mainCategory;
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase());
    return matchMain && matchSearch;
  });

  const groupedItems = filteredItems.reduce((acc, item) => {
    const subCategory = item.subcategory || "Other";
    if (!acc[subCategory]) {
      acc[subCategory] = [];
    }
    acc[subCategory].push(item);
    return acc;
  }, {} as Record<string, Item[]>);

  const submitOrder = async (print: boolean) => {
    if (cart.length === 0) return toast.error("Cart is empty");
    if (!paymentMethod) return toast.error("Please select a payment method");
    if (cart.some(item => item.price <= 0)) return toast.error("Cannot checkout items with 0 price");
    
    setIsProcessing(true);

    try {
      const payload = {
        items: cart,
        subtotal,
        discountPercentage: applyDiscount ? 20 : 0,
        paymentMethod,
        source: orderSource,
        printReceipts: print
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();

      if (res.ok) {
        toast.success(`Order saved ${print ? 'and preparing receipt...' : ''}`);
        
        if (print && resData.order?.id) {
           const fullOrder = resData.order;
           // Fetch Settings for Full Branding Map
           let { data: settingsData } = await supabase.from('settings').select('*').limit(1).maybeSingle();
           
           try {
              const copies = buildReceiptCopies(fullOrder, settingsData);
              const bridgeRes = await fetch('http://localhost:7878/print', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ copies })
              });
              const bridgeData = await bridgeRes.json();
              
              if (bridgeRes.ok && bridgeData.success) {
                 toast.success("Printed to local bridge automatically!");
              } else {
                 throw new Error("Bridge unavailable");
              }
           } catch(e) {
              toast.warning("Direct print bridge unavailable. Falling back to Browser UI.");
              window.open(`/print/${fullOrder.id}`, '_blank', 'width=400,height=600');
           }
        }

        setCart([]);
        setApplyDiscount(false);
        setPaymentMethod('cash');
      } else {
        toast.error(resData.error || "Failed to save order");
      }
    } catch (e) {
      toast.error("Network error");
    }
    setIsProcessing(false);
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden text-sm">
      <div className="flex-1 flex flex-col h-full min-h-0 bg-slate-50 border-r relative overflow-hidden">
        <div className="bg-white border-b shrink-0 z-20">
          <div className="flex px-4 pt-4 gap-6">
            <h1 className="font-bold text-xl tracking-tight mr-4">Menu</h1>
            {mainCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setMainCategory(cat)}
                className={`pb-3 px-2 font-semibold border-b-2 transition-all ${mainCategory === cat ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              >
                {cat}
              </button>
            ))}
            <div className="ml-auto w-64 pb-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input 
                  className="pl-8 h-8 text-xs bg-slate-50" 
                  placeholder="Search items..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
          {items.length === 0 && !loadingItems ? (
             <div className="col-span-full flex flex-col items-center justify-center text-center text-slate-500 py-24">
               <div className="text-xl font-medium text-slate-700 mb-2">No menu items found.</div>
               <p>Add structured menu items from the Menu configuration screen first.</p>
             </div>
          ) : items.filter(i => i.category === mainCategory).length === 0 ? (
             <div className="col-span-full text-center text-slate-500 py-12">No items found in this category.</div>
          ) : filteredItems.length === 0 && search ? (
             <div className="col-span-full text-center text-slate-500 py-12">No matching items found.</div>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 content-start">
          {Object.entries(groupedItems).map(([sub, subItems]) => (
              <div key={sub} className="space-y-3">
                <h3 className="font-bold text-lg text-slate-800 border-b pb-1">{sub}</h3>
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {subItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className="relative aspect-square flex flex-col justify-center items-center p-3 border border-slate-200 bg-white rounded-xl hover:border-amber-400 hover:bg-amber-50 hover:shadow-md transition-all text-center group"
                    >
                      <div className="font-semibold text-slate-800 leading-tight mb-1 line-clamp-2">{item.name}</div>
                      {(item.size || item.variant || (item.optionsConfig?.requiresSelection && item.optionsConfig.selectionName)) && (
                        <div className="text-[10px] text-slate-500 mb-2 uppercase tracking-wide">
                          {[item.size, item.variant, item.optionsConfig?.requiresSelection ? `+${item.optionsConfig.selectionName}` : ''].filter(Boolean).join(' • ')}
                        </div>
                      )}
                      {item.price === 0 ? (
                        <div className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium mt-auto uppercase flex items-center">No Price</div>
                      ) : (
                        <div className="mt-auto font-black text-amber-600 text-sm">
                          {formatCurrency(item.price)}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

        </div>

      {/* Right cart pane */}
      <div className="w-[420px] bg-slate-50 flex flex-col h-full z-10 box-border text-[13px]">
        <div className="p-4 border-b bg-white flex items-center justify-between shadow-sm z-10 shrink-0">
          <h2 className="font-semibold flex items-center gap-2"><CartIcon className="h-5 w-5" /> Current Order</h2>
          <span className="text-xs bg-slate-100 font-medium px-2.5 py-1 rounded-full text-slate-700">{cart.length} items</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.map(item => (
            <Card key={item.cartId} className="shadow-sm overflow-visible">
              <CardContent className="p-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="pr-2">
                     <div className="font-medium text-[13px] leading-tight text-slate-800">{item.name}</div>
                     {(item.size || item.variant || item.selectedOptions?.option) && <div className="text-[10px] text-slate-500 mt-0.5">{[(item.selectedOptions?.option ? `[${item.selectedOptions.option}]` : ''), item.size, item.variant].filter(Boolean).filter(v => v && !item.name.toLowerCase().includes(v.toLowerCase())).join(' • ')}</div>}
                     <div className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider">{item.category} &gt; {item.subcategory || 'General'}</div>
                  </div>
                  <div className="font-semibold">{formatCurrency(item.price * item.quantity)}</div>
                </div>
                
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-1.5 h-8 p-1 bg-slate-100 rounded-md">
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded bg-white shadow-sm hover:bg-slate-200" onClick={() => updateQuantity(item.cartId, -1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center font-semibold text-[13px]">{item.quantity}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded bg-white shadow-sm hover:bg-slate-200" onClick={() => updateQuantity(item.cartId, 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => removeFromCart(item.cartId)}>
                    <X className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
                {item.allowUpsize && (
                  <div className="flex items-center space-x-2 mt-2 bg-purple-50 p-1.5 rounded border border-purple-100">
                    <Checkbox 
                       id={`upsize-${item.cartId}`} 
                       checked={item.selectedOptions?.upsize || false} 
                       onCheckedChange={() => toggleUpsize(item.cartId)}
                       className="border-purple-300"
                    />
                    <label htmlFor={`upsize-${item.cartId}`} className="text-[11px] font-bold text-purple-900 cursor-pointer select-none">
                      Upsize +{formatCurrency(item.selectedOptions?.upsizePrice || 0)}
                    </label>
                  </div>
                )}
                <Input 
                  className="h-7 text-[12px] mt-2 bg-slate-50 border-slate-200 placeholder:text-slate-400 shadow-inner" 
                  placeholder="Notes for kitchen/bar (e.g. less ice)" 
                  value={item.notes}
                  onChange={(e) => updateNote(item.cartId, e.target.value)}
                />
              </CardContent>
            </Card>
          ))}
          {cart.length === 0 && (
             <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
               <CartIcon className="h-12 w-12 mb-3 opacity-20" />
               <p>Cart is empty</p>
             </div>
          )}
        </div>

        <div className="bg-white border-t space-y-4 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pt-4 pb-6 px-4 relative z-20">
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            
            <div className="flex items-center space-x-2 py-1">
               <Checkbox id="discount" checked={applyDiscount} onCheckedChange={(val: boolean | string) => setApplyDiscount(!!val)} />
               <label htmlFor="discount" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                 Apply 20% Discount
               </label>
            </div>

            {applyDiscount && (
               <div className="flex justify-between items-center text-red-600 font-medium">
                 <span>Discount (20%)</span>
                 <span>-{formatCurrency(discountAmount)}</span>
               </div>
            )}
            
            <div className="pt-3 border-t flex justify-between items-end mt-2">
              <span className="font-bold text-slate-900 text-sm">Total Payable</span>
              <span className="text-2xl font-black text-amber-600">{formatCurrency(total)}</span>
            </div>
          </div>
          
          <div className="space-y-2 pt-1 border-t">
            <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Order Source *</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'POS', value: 'pos' as const },
                { label: 'Website', value: 'website' as const },
                { label: 'Foodpanda', value: 'foodpanda' as const }
              ].map(s => (
                <button
                  key={s.value}
                  onClick={() => setOrderSource(s.value)}
                  className={`py-2 text-[10px] whitespace-nowrap font-bold rounded-lg border transition-all ${orderSource === s.value ? 'border-purple-600 bg-purple-600 text-white shadow-md' : 'border-slate-200 text-slate-600 hover:border-slate-400 bg-slate-50 shadow-sm'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-1 border-t">
            <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Payment Method *</Label>
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: 'Cash', value: 'cash' },
                { label: 'Credit Card', value: 'credit_card' },
                { label: 'Transfer', value: 'transfer' },
                { label: 'JazzCash', value: 'jazzcash' },
                { label: 'Foodpanda', value: 'foodpanda' }
              ].map(m => (
                <button
                  key={m.value}
                  onClick={() => setPaymentMethod(m.value)}
                  className={`py-2 text-[10px] whitespace-nowrap font-bold rounded-lg border transition-all ${paymentMethod === m.value ? 'border-slate-900 bg-slate-900 text-white shadow-md' : 'border-slate-200 text-slate-600 hover:border-slate-400 bg-slate-50 shadow-sm'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2">
             <Button variant="ghost" className="w-full font-bold h-10 text-red-600 hover:text-red-700 hover:bg-red-50" disabled={isProcessing || cart.length === 0} onClick={() => { setCart([]); setApplyDiscount(false); setPaymentMethod('cash'); }}>
              Cancel
             </Button>
             <Button variant="outline" className="w-full font-bold h-10 border-slate-300" disabled={isProcessing || cart.length === 0} onClick={() => submitOrder(false)}>
              Save Only
             </Button>
             <Button className="w-full bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold h-10 shadow-md transition-colors" disabled={isProcessing || cart.length === 0} onClick={() => submitOrder(true)}>
              {isProcessing ? 'Saving...' : 'Save & Print'}
             </Button>
           </div>
        </div>
      </div>

      <Dialog open={!!optionItem} onOpenChange={() => setOptionItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Select {optionItem?.optionsConfig?.selectionName}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            {optionItem?.optionsConfig?.choices.map(choice => (
               <Button key={choice} variant="outline" className="h-12 font-bold justify-start px-4 text-left border-slate-300 hover:border-slate-800 hover:bg-slate-50" onClick={() => handleOptionSelect(choice)}>
                 {choice}
               </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
