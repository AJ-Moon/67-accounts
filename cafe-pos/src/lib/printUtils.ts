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

/**
 * Options may live in the selectedOptions column OR embedded as JSON at the
 * end of notes ("free text | {"upsize":true}"). Normalize both.
 */
function getOptions(item: any): { upsize?: boolean; option?: string; [k: string]: any } {
  if (item.selectedOptions && typeof item.selectedOptions === 'object') return item.selectedOptions;
  const m = (item.notes || '').match(/\{.*\}\s*$/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* not json */ } }
  return {};
}

/** Human note only — strips any embedded options JSON. */
function getPlainNote(item: any): string {
  return (item.notes || '').replace(/\s*\|?\s*\{.*\}\s*$/, '').trim();
}

/** Item extras block: upsize ONLY when true, option, then clean note. */
function itemExtras(item: any): string {
  const opts = getOptions(item);
  const note = getPlainNote(item);
  let out = '';
  if (opts.upsize === true) out += `   + UPSIZE\n`;
  if (opts.option) out += `   + ${opts.option}\n`;
  if (note) out += `   Note: ${note}\n`;
  return out;
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
  const kitchen = order.items.filter((i: any) => getCategory(i) !== 'drinks');

  const divider = '-'.repeat(WIDTH) + '\n';

  const totalsBlock = () => {
    let out = '';
    const hasBreakdown = Number(order.discountAmount || 0) > 0 || Number(order.tax || 0) > 0;
    if (hasBreakdown) {
      out += padText('Subtotal', formatCurrencyString(Number(order.subtotal || 0)), WIDTH) + '\n';
      if (Number(order.discountAmount || 0) > 0) {
        out += padText(`Discount${order.discountPercentage ? ` (${order.discountPercentage}%)` : ''}`, `-${formatCurrencyString(Number(order.discountAmount))}`, WIDTH) + '\n';
      }
      if (Number(order.tax || 0) > 0) {
        out += padText(`Tax${order.taxRate ? ` (${order.taxRate}%)` : ''}`, formatCurrencyString(Number(order.tax)), WIDTH) + '\n';
      }
    }
    out += padText('TOTAL', formatCurrencyString(Number(order.finalTotal || 0)), WIDTH) + '\n';
    return out;
  };

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
    customer += itemExtras(item);
  });

  customer += divider;
  customer += totalsBlock();
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
    shop += itemExtras(item);
  });
  shop += divider;
  shop += totalsBlock();
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
      bar += itemExtras(item);
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
      kitch += itemExtras(item);
    });
    kitch += '\n\n';
    copies.push({ type: 'kitchen', content: kitch });
  }

  return copies;
}
