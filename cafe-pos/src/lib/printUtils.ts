// Formatting utilities

export function formatCurrencyString(amount: number) {
  return `Rs ${amount.toFixed(2)}`;
}

// Executes isolated print jobs safely inside the browser leveraging Chrome Kiosk Mode natively
export function executeIframePrintRoutine(orderId: number, orderItems: any[]) {
   const hasDrinks = orderItems.some((i: any) => i.item_category === 'Drinks');
   const hasFood = orderItems.some((i: any) => i.item_category === 'Food');

   const copies = ['customer', 'shop'];
   if (hasDrinks) copies.push('bar');
   if (hasFood) copies.push('kitchen');

   let delay = 0;
   copies.forEach((copyName) => {
     setTimeout(() => {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = `/print/${orderId}?copy=${copyName}`;
        document.body.appendChild(iframe);
        
        // Automatically isolate DOM components securely preventing memory leaks logically
        setTimeout(() => {
           if (document.body.contains(iframe)) document.body.removeChild(iframe);
        }, 15000); // Allow sufficient time for massive printer queues buffering sequentially

     }, delay);
     delay += 1200; // Offset sequentially allowing Windows Printer Spools processing separate documents natively enforcing explicit cuts!
   });
}
