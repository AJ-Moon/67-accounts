'use client';

import { useEffect, useState, use } from 'react';
import { formatCurrency } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

// Helper component serving individual receipt instances separating thermal splits
function ReceiptCopy({ order, copyType, settings }: { order: any, copyType: 'customer' | 'shop' | 'bar' | 'kitchen', settings: any }) {
  if (!order) return null;

  const dObj = new Date(order.createdAt);
  const dateStr = `${dObj.toLocaleDateString()} ${dObj.toLocaleTimeString()}`;
  
  let itemsToPrint = order.items || [];
  if (copyType === 'bar') {
    itemsToPrint = itemsToPrint.filter((i: any) => i.item_category === 'Drinks');
    if (itemsToPrint.length === 0) return null; // Drop empty copies seamlessly
  }
  if (copyType === 'kitchen') {
    itemsToPrint = itemsToPrint.filter((i: any) => i.item_category === 'Food');
    if (itemsToPrint.length === 0) return null; // Drop empty copies seamlessly
  }

  const isKitchenOrBar = copyType === 'kitchen' || copyType === 'bar';
  const showFullBranding = copyType === 'customer';
  const discountAmount = order.discountAmount ?? order.discount ?? 0;

  let title = "*** CUSTOMER COPY ***";
  if (copyType === 'shop') title = "*** SHOP COPY ***";
  if (copyType === 'bar') title = "*** BAR COPY / DRINKS ***";
  if (copyType === 'kitchen') title = "*** KITCHEN COPY / FOOD ***";

  return (
    <div className="receipt-copy">
      {/* Dynamic Branding Only Appears on Customer Print */}
      {showFullBranding && (
        <div className="text-center mb-4">
          <h1 className="font-bold text-lg leading-tight uppercase">{settings?.shopName || '67 CAFE'}</h1>
          <div className="uppercase">Welcome to {settings?.shopName || '67 CAFE'}</div>
          {settings?.address && <div className="uppercase">{settings.address}</div>}
          {settings?.phone && <div className="uppercase">{settings.phone}</div>}
        </div>
      )}

      {/* Global Meta Variables */}
      <div className="mb-4 text-center">
        <div className="font-bold mb-1">{title}</div>
        <div>Order: {order.orderNumber}</div>
        <div>Date: {dateStr}</div>
        <div className="uppercase">Source: {order.source}</div>
        {order.createdBy && <div className="uppercase">User: {order.createdBy}</div>}
        {!isKitchenOrBar && <div className="uppercase mt-1 font-semibold">Payment: {order.paymentMethod}</div>}
      </div>

      <div className="border-t border-dashed border-black my-2"></div>
      
      {/* Item Blocks */}
      <div className="w-full">
        <table className="w-full text-left table-fixed">
          <tbody>
            {itemsToPrint.map((item: any, idx: number) => {
               const hasUpsize = item.selectedOptions?.upsize;
               const hasOption = item.selectedOptions?.option;
               const notes = item.notes;

               return (
                 <tr key={idx} className="align-top">
                   <td className="w-10 font-bold">{item.quantity}x</td>
                   <td className="pr-2">
                     <div className="font-bold uppercase break-words">{item.name}</div>
                     {hasUpsize && <div className="text-[10px] uppercase pl-1">+ Upsize</div>}
                     {hasOption && <div className="text-[10px] uppercase pl-1">+ {hasOption}</div>}
                     {notes && <div className="text-[10px] italic pl-1 text-slate-800 break-words">Note: {notes}</div>}
                   </td>
                   {!isKitchenOrBar && (
                     <td className="w-16 text-right font-medium">
                       {formatCurrency(item.price * item.quantity)}
                     </td>
                   )}
                 </tr>
               );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-dashed border-black my-2"></div>

      {/* Pricing Module - Dropped for Kitchen/Bar completely */}
      {!isKitchenOrBar && (
        <div className="space-y-1 mb-4">
          {discountAmount > 0 ? (
             <>
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(order.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Discount</span>
                  <span>-{formatCurrency(discountAmount)}</span>
                </div>
             </>
          ) : null}
          <div className="flex justify-between font-bold text-base mt-2 pt-2 border-t border-dashed border-black">
            <span>TOTAL</span>
            <span>{formatCurrency(order.finalTotal)}</span>
          </div>
        </div>
      )}

      {/* Footer Details */}
      {showFullBranding && settings?.footerMessage && (
        <div className="text-center mt-6 uppercase pb-2">
          {settings.footerMessage}
        </div>
      )}
    </div>
  );
}

import { useSearchParams } from 'next/navigation';

export default function PrintReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const { id } = unwrappedParams;
  const searchParams = useSearchParams();
  const copyParam = searchParams.get('copy');

  const [order, setOrder] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('*, items:order_items(*)')
          .eq('id', id)
          .single();

        if (orderError || !orderData) throw new Error('Order not found');
        setOrder(orderData);

        const { data: settingsData } = await supabase.from('settings').select('*').limit(1).maybeSingle();
        if (settingsData) {
          setSettings(settingsData);
        } else {
          setSettings({ shopName: '67 Cafe', address: '', phone: '', footerMessage: 'Thank you for visiting!' });
        }
        
      } catch (err: any) {
        setError(err.message || 'Failed to load receipt');
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [id]);

  useEffect(() => {
    if (!loading && order && !error) {
       setTimeout(() => {
         window.print();
       }, 500);
    }
  }, [loading, order, error]);

  if (loading) return <div className="p-8 text-center text-slate-500 font-mono text-xs">Generating 80mm Print Queue...</div>;
  if (error || !order) return <div className="p-8 text-center text-red-500 font-bold font-mono">[{error || 'Order not found'}]</div>;

  return (
    <div className="receipt-print-area text-black text-xs font-mono">
       <style dangerouslySetInnerHTML={{__html: `
         /* Global Browser Defaults overrides for clean thermal boundaries */
         @media print {
            @page {
              size: 80mm auto;
              margin: 0;
            }
            html, body {
              width: 80mm;
              margin: 0;
              padding: 0;
              background: white;
            }
            body * {
              visibility: hidden;
            }
            .receipt-print-area, .receipt-print-area * {
              visibility: visible;
            }
            .receipt-print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 80mm;
              margin: 0;
              padding: 0;
            }
            .no-print {
              display: none !important;
            }
         }
         
         .receipt-copy {
            width: 80mm;
            padding: 4mm;
            padding-bottom: 2mm; 
         }
       `}} />
       
       {(!copyParam || copyParam === 'customer') && <ReceiptCopy order={order} copyType="customer" settings={settings} />}
       {(!copyParam || copyParam === 'shop') && <ReceiptCopy order={order} copyType="shop" settings={settings} />}
       {(!copyParam || copyParam === 'bar') && <ReceiptCopy order={order} copyType="bar" settings={settings} />}
       {(!copyParam || copyParam === 'kitchen') && <ReceiptCopy order={order} copyType="kitchen" settings={settings} />}

    </div>
  );
}
