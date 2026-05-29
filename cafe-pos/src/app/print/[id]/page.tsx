'use client';

import { useEffect, useState, use } from 'react';
import { formatCurrency } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

export default function PrintReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const { id } = unwrappedParams;
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

        const { data: settingsData } = await supabase.from('settings').select('*').single();
        if (settingsData) {
          setSettings(settingsData);
        } else {
          setSettings({ shopName: '67 Cafe', address: '', phone: '', footerMessage: 'Thank you!' });
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

  if (loading) return <div className="p-8 text-center">Loading receipt preview...</div>;
  if (error || !order) return <div className="p-8 text-center text-red-500 font-bold">{error || 'Order not found'}</div>;

  const dObj = new Date(order.createdAt);
  const dateStr = `${dObj.toLocaleDateString()} ${dObj.toLocaleTimeString()}`;

  const discountAmount = order.discountAmount ?? order.discount ?? 0;

  return (
    <div className="w-full max-w-[300px] mx-auto bg-white p-4 text-black text-xs font-mono receipt-container">
       <style dangerouslySetInnerHTML={{__html: `
         @media print {
            body * {
               visibility: hidden;
            }
            .receipt-container, .receipt-container * {
               visibility: visible;
            }
            .receipt-container {
               position: absolute;
               left: 0;
               top: 0;
               width: 100%;
               max-width: 80mm; /* standard thermal receipt width */
               margin: 0;
               padding: 0;
               box-shadow: none;
            }
            @page { margin: 0; size: auto; }
         }
       `}} />
       
       <div className="text-center mb-4">
          <h1 className="font-bold text-lg leading-tight uppercase">{settings?.shopName || '67'}</h1>
          {settings?.address && <div className="uppercase">{settings.address}</div>}
          {settings?.phone && <div className="uppercase">{settings.phone}</div>}
       </div>
       
       <div className="mb-4">
          <div className="font-bold text-center mb-1">*** CUSTOMER COPY ***</div>
          <div>Order: {order.orderNumber}</div>
          <div>Date: {dateStr}</div>
          <div className="uppercase">Source: {order.source}</div>
       </div>

       <div className="border-t border-dashed border-black my-2"></div>
       
       <div className="w-full">
         <table className="w-full text-left table-fixed">
           <tbody>
             {order.items.map((item: any) => (
                <tr key={item.id} className="align-top">
                  <td className="w-8 py-1">{item.quantity}x</td>
                  <td className="py-1 pr-2 break-words">
                     {item.name}
                     {item.selectedOptions?.upsize && <div className="font-bold text-[10px] mt-0.5">Upsize +{formatCurrency(item.selectedOptions.upsizePrice)}</div>}
                     {item.selectedOptions?.option && <div className="font-bold text-[10px] text-slate-700 mt-0.5 uppercase tracking-tighter">[{item.selectedOptions.option}]</div>}
                     {item.notes && <div className="italic text-[10px]">Note: {item.notes}</div>}
                  </td>
                  <td className="w-16 py-1 text-right font-medium">{formatCurrency(item.price * item.quantity)}</td>
                </tr>
             ))}
           </tbody>
         </table>
       </div>

       <div className="border-t border-dashed border-black my-2"></div>

       <div className="flex justify-between mt-1">
          <span>Subtotal:</span>
          <span>{formatCurrency(order.subtotal)}</span>
       </div>
       {discountAmount > 0 && (
         <div className="flex justify-between">
            <span>Discount:</span>
            <span>-{formatCurrency(discountAmount)}</span>
         </div>
       )}
       <div className="flex justify-between font-bold text-sm my-1">
          <span>TOTAL:</span>
          <span>{formatCurrency(order.finalTotal)}</span>
       </div>
       <div className="flex justify-between mt-1 mb-2">
          <span>Paid via:</span>
          <span className="font-bold">{order.paymentMethod}</span>
       </div>

       <div className="border-t border-dashed border-black my-2"></div>

       <div className="text-center mt-4">
          <div className="font-bold">{settings?.footerMessage || 'Thank you for visiting!'}</div>
       </div>
       
       {/* Actions intentionally hidden in print view */}
       <div className="mt-8 text-center no-print pb-8">
          <button onClick={() => window.print()} className="bg-black text-white px-4 py-2 rounded -translate-x-1 hover:bg-gray-800 transition-colors mr-2">
             Print
          </button>
          <button onClick={() => window.history.back()} className="border border-black px-4 py-2 rounded hover:bg-gray-100 transition-colors">
             Back
          </button>
       </div>

       <style dangerouslySetInnerHTML={{__html: `
         @media print {
            .no-print { display: none; }
         }
       `}} />
    </div>
  );
}
