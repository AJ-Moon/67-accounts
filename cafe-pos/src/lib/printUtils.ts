// Formatting utilities creating 48-column standard 80mm ESC/POS Text Payloads natively.

export function formatCurrencyString(amount: number) {
  return `Rs ${amount.toFixed(2)}`;
}

export function padText(left: string, right: string, width = 48) {
  const spaceLength = Math.max(1, width - left.length - right.length);
  return left + ' '.repeat(spaceLength) + right;
}

export function centerText(text: string, width = 48) {
  if (text.length >= width) return text.substring(0, width);
  const pad = Math.floor((width - text.length) / 2);
  return ' '.repeat(pad) + text + ' '.repeat(width - text.length - pad);
}

export function buildReceiptCopies(order: any, settings: any, isReprint = false) {
  const WIDTH = 48;
  const copies: any[] = [];

  if (!order || !order.items || order.items.length === 0) return copies;

  const dObj = new Date(order.createdAt);
  const dateStr = `${dObj.toLocaleDateString()} ${dObj.toLocaleTimeString()}`;

  // Normalize category field — API returns either `category` or `item_category`
  const getCategory = (i: any) => (i.category || i.item_category || '').toLowerCase();

  const drinks  = order.items.filter((i: any) => getCategory(i) === 'drinks');
  const kitchen = order.items.filter((i: any) => {
    const cat = getCategory(i);
    return cat === 'food' || cat === 'desserts';
  });

  const divider   = '-'.repeat(WIDTH) + '\n';

  // ── CUSTOMER COPY ────────────────────────────────────
  let customer = '';
  customer += centerText(settings?.shopName || '67 CAFE') + '\n';
  customer += centerText(`Welcome to ${settings?.shopName || '67 CAFE'}`) + '\n';
  if (settings?.address) customer += centerText(settings.address) + '\n';
  if (settings?.phone)   customer += centerText(settings.phone) + '\n';
  customer += '\n';
  customer += centerText('*** CUSTOMER COPY ***') + '\n';
  customer += `Order:   ${order.orderNumber}\n`;
  customer += `Date:    ${dateStr}\n`;
  customer += `Payment: ${order.paymentMethod}\n`;
  customer += divider;

  order.items.forEach((item: any) => {
    customer += padText(`${item.quantity}x ${item.name}`, formatCurrencyString(item.price * item.quantity), WIDTH) + '\n';
    if (item.selectedOptions?.upsize)  customer += `   + Upsize\n`;
    if (item.selectedOptions?.option)  customer += `   + ${item.selectedOptions.option}\n`;
  });

  customer += divider;
  if (order.discountAmount > 0) {
    customer += padText('Subtotal', formatCurrencyString(order.subtotal), WIDTH) + '\n';
    customer += padText('Discount', `-${formatCurrencyString(order.discountAmount)}`, WIDTH) + '\n';
  }
  customer += padText('TOTAL', formatCurrencyString(order.finalTotal), WIDTH) + '\n';
  customer += divider;
  if (settings?.footerMessage) customer += '\n' + centerText(settings.footerMessage) + '\n';
  customer += '\n\n';

  copies.push({ type: 'customer', content: customer });

  // If reprint → ONLY customer copy
  if (isReprint) return copies;

  // ── SHOP COPY ────────────────────────────────────────
  let shop = '';
  shop += centerText('*** SHOP COPY ***') + '\n';
  shop += `Order:   ${order.orderNumber}\n`;
  shop += `Date:    ${dateStr}\n`;
  shop += `Payment: ${order.paymentMethod}\n`;
  shop += divider;

  order.items.forEach((item: any) => {
    shop += padText(`${item.quantity}x ${item.name}`, formatCurrencyString(item.price * item.quantity), WIDTH) + '\n';
    if (item.selectedOptions?.upsize) shop += `   + Upsize\n`;
    if (item.selectedOptions?.option) shop += `   + ${item.selectedOptions.option}\n`;
  });
  shop += divider;
  if (order.discountAmount > 0) {
    shop += padText('Subtotal', formatCurrencyString(order.subtotal), WIDTH) + '\n';
    shop += padText('Discount', `-${formatCurrencyString(order.discountAmount)}`, WIDTH) + '\n';
  }
  shop += padText('TOTAL', formatCurrencyString(order.finalTotal), WIDTH) + '\n';
  shop += '\n\n';

  copies.push({ type: 'shop', content: shop });

  // ── BAR COPY (drinks only — skip if none) ────────────
  if (drinks.length > 0) {
    let bar = '';
    bar += centerText('*** BAR COPY / DRINKS ***') + '\n';
    bar += `Order:   ${order.orderNumber}\n`;
    bar += `Date:    ${dateStr}\n`;
    bar += divider;

    drinks.forEach((item: any) => {
      bar += `${item.quantity}x ${item.name}\n`;
      if (item.selectedOptions?.upsize) bar += `   + Upsize\n`;
      if (item.selectedOptions?.option) bar += `   + ${item.selectedOptions.option}\n`;
      if (item.notes) bar += `   Note: ${item.notes}\n`;
    });
    bar += '\n\n';
    copies.push({ type: 'bar', content: bar });
  }

  // ── KITCHEN COPY (food + desserts — skip if none) ────
  if (kitchen.length > 0) {
    let kitch = '';
    kitch += centerText('*** KITCHEN COPY / FOOD ***') + '\n';
    kitch += `Order:   ${order.orderNumber}\n`;
    kitch += `Date:    ${dateStr}\n`;
    kitch += divider;

    kitchen.forEach((item: any) => {
      kitch += `${item.quantity}x ${item.name}\n`;
      if (item.selectedOptions?.upsize) kitch += `   + Upsize\n`;
      if (item.selectedOptions?.option) kitch += `   + ${item.selectedOptions.option}\n`;
      if (item.notes) kitch += `   Note: ${item.notes}\n`;
    });
    kitch += '\n\n';
    copies.push({ type: 'kitchen', content: kitch });
  }

  return copies;
}
