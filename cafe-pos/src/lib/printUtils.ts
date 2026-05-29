// Formatting utilities creating 32-column standard 80mm ESC/POS Text Payloads natively.

export function formatCurrencyString(amount: number) {
  return `Rs ${amount.toFixed(2)}`;
}

export function padText(left: string, right: string, width = 32) {
  const spaceLength = Math.max(1, width - left.length - right.length);
  return left + ' '.repeat(spaceLength) + right;
}

export function centerText(text: string, width = 32) {
  if (text.length >= width) return text.substring(0, width);
  const pad = Math.floor((width - text.length) / 2);
  return ' '.repeat(pad) + text + ' '.repeat(width - text.length - pad);
}

export function buildReceiptCopies(order: any, settings: any) {
  const WIDTH = 32;
  const copies: any[] = [];
  
  if (!order || !order.items || order.items.length === 0) return copies;

  const dObj = new Date(order.createdAt);
  const dateStr = `${dObj.toLocaleDateString()} ${dObj.toLocaleTimeString()}`;

  const drinks = order.items.filter((i: any) => i.item_category === 'Drinks');
  const food = order.items.filter((i: any) => i.item_category === 'Food');

  const divider = '-'.repeat(WIDTH) + '\\n';
  const dbDivider = '='.repeat(WIDTH) + '\\n';

  // CUSTOMER COPY
  let customer = '';
  customer += centerText(settings?.shopName || '67 CAFE') + '\\n';
  customer += centerText(`Welcome to ${settings?.shopName || '67 CAFE'}`) + '\\n';
  if (settings?.address) customer += centerText(settings.address) + '\\n';
  if (settings?.phone) customer += centerText(settings.phone) + '\\n';
  customer += '\\n';
  customer += centerText('*** CUSTOMER COPY ***') + '\\n';
  customer += `Order: ${order.orderNumber}\\n`;
  customer += `Date: ${dateStr}\\n`;
  if (order.source && order.source.toLowerCase() !== 'pos') {
    customer += `Source: ${order.source}\\n`;
  }
  customer += `Payment: ${order.paymentMethod}\\n`;
  customer += divider;
  
  order.items.forEach((item: any) => {
    customer += padText(`${item.quantity}x ${item.name}`.substring(0, 20), formatCurrencyString(item.price * item.quantity)) + '\\n';
    if (item.selectedOptions?.upsize) customer += `   + Upsize\\n`;
    if (item.selectedOptions?.option) customer += `   + ${item.selectedOptions.option}\\n`;
  });
  
  customer += divider;
  if (order.discountAmount > 0) {
    customer += padText('Subtotal', formatCurrencyString(order.subtotal)) + '\\n';
    customer += padText('Discount', `-${formatCurrencyString(order.discountAmount)}`) + '\\n';
  }
  customer += padText('TOTAL', formatCurrencyString(order.finalTotal)) + '\\n';
  customer += divider;
  if (settings?.footerMessage) customer += '\\n' + centerText(settings.footerMessage) + '\\n';
  customer += '\\n\\n';
  
  copies.push({ type: 'customer', content: customer });

  // SHOP COPY
  let shop = '';
  shop += centerText('*** SHOP COPY ***') + '\\n';
  shop += `Order: ${order.orderNumber}\\n`;
  shop += `Date: ${dateStr}\\n`;
  if (order.source && order.source.toLowerCase() !== 'pos') shop += `Source: ${order.source}\\n`;
  shop += `Payment: ${order.paymentMethod}\\n`;
  shop += divider;
  
  order.items.forEach((item: any) => {
    shop += padText(`${item.quantity}x ${item.name}`.substring(0, 20), formatCurrencyString(item.price * item.quantity)) + '\\n';
    if (item.selectedOptions?.upsize) shop += `   + Upsize\\n`;
    if (item.selectedOptions?.option) shop += `   + ${item.selectedOptions.option}\\n`;
  });
  shop += divider;
  shop += padText('TOTAL', formatCurrencyString(order.finalTotal)) + '\\n';
  shop += '\\n\\n';
  
  copies.push({ type: 'shop', content: shop });

  // BAR COPY
  if (drinks.length > 0) {
    let bar = '';
    bar += centerText('*** BAR COPY / DRINKS ***') + '\\n';
    bar += `Order: ${order.orderNumber}\\n`;
    bar += `Date: ${dateStr}\\n`;
    if (order.source && order.source.toLowerCase() !== 'pos') bar += `Source: ${order.source}\\n`;
    bar += divider;
    
    drinks.forEach((item: any) => {
      bar += `${item.quantity}x ${item.name}\\n`;
      if (item.selectedOptions?.upsize) bar += `   + Upsize\\n`;
      if (item.selectedOptions?.option) bar += `   + ${item.selectedOptions.option}\\n`;
      if (item.notes) bar += `   Note: ${item.notes}\\n`;
    });
    bar += '\\n\\n';
    copies.push({ type: 'bar', content: bar });
  }

  // KITCHEN COPY
  if (food.length > 0) {
    let kitchen = '';
    kitchen += centerText('*** KITCHEN COPY / FOOD ***') + '\\n';
    kitchen += `Order: ${order.orderNumber}\\n`;
    kitchen += `Date: ${dateStr}\\n`;
    if (order.source && order.source.toLowerCase() !== 'pos') kitchen += `Source: ${order.source}\\n`;
    kitchen += divider;
    
    food.forEach((item: any) => {
      kitchen += `${item.quantity}x ${item.name}\\n`;
      if (item.selectedOptions?.upsize) kitchen += `   + Upsize\\n`;
      if (item.selectedOptions?.option) kitchen += `   + ${item.selectedOptions.option}\\n`;
      if (item.notes) kitchen += `   Note: ${item.notes}\\n`;
    });
    kitchen += '\\n\\n';
    copies.push({ type: 'kitchen', content: kitchen });
  }

  return copies;
}
