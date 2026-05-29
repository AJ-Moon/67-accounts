import { printer as ThermalPrinter, types as PrinterTypes } from 'node-thermal-printer';
import { Order, OrderItem, Settings } from '@prisma/client';
import { formatCurrency } from './utils';
import fs from 'fs';
import { exec } from 'child_process';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function normalizeCategory(category: string) {
  if (!category) return 'Food';
  const normalized = category.toLowerCase();
  if (normalized === 'drink' || normalized === 'drinks') return 'Drinks';
  if (normalized === 'food') return 'Food';
  return category;
}

function formatReceiptLine(left: string, right: string, width = 48) {
  left = String(left || "");
  right = String(right || "");

  const spaceCount = width - left.length - right.length;
  if (spaceCount > 1) {
    return left + " ".repeat(spaceCount) + right;
  }
  const maxLeftLength = width - right.length - 1;
  const trimmedLeft = left.slice(0, Math.max(0, maxLeftLength));
  return trimmedLeft + " " + right;
}

async function executePrintJob(printer: any, isNetwork: boolean, settings: Settings) {
  if (isNetwork) {
    return printer.execute();
  }

  const buffer = printer.getBuffer();
  const id = Date.now();
  const tempFile = `/tmp/receipt-${id}.bin`;
  fs.writeFileSync(tempFile, buffer);

  return new Promise<void>((resolve, reject) => {
    exec(`lpr -P ${settings.printerAddress} -o raw ${tempFile}`, (error) => {
      try { fs.unlinkSync(tempFile); } catch (e) {}
      if (error) return reject(error);
      resolve();
    });
  });
}

export async function printReceipts(
  order: Order & { items: OrderItem[] },
  settings: Settings
) {
  if (!settings.printerAddress && settings.printerType !== 'USB') {
    console.warn('No printer address defined, skipping print.');
    return false;
  }

  const isNetwork = settings.printerType === 'Network';
  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: isNetwork ? `tcp://${settings.printerAddress}` : 'tcp://dummy',
    width: 48,
    characterSet: 'PC852_LATIN2' as any,
    removeSpecialCharacters: false,
    lineCharacter: '-',
  });

  if (isNetwork) {
    const isConnected = await printer.isPrinterConnected();
    if (!isConnected) {
      console.error('Network Printer not connected.');
      return false;
    }
  }

  const items = order.items;
  const drinksList = items.filter(i => normalizeCategory(i.category) === 'Drinks');
  const foodList = items.filter(i => normalizeCategory(i.category) === 'Food');

  const dObj = new Date(order.createdAt);
  const dateStr = `${dObj.toLocaleDateString()} ${dObj.toLocaleTimeString()}`;
  const discountAmount = (order as any).discountAmount ?? (order as any).discount ?? 0;

  const generateHeader = (copyName: string) => {
    printer.alignCenter();
    printer.bold(true);

    if (copyName === 'CUSTOMER COPY') {
      const shopName = settings.shopName || "67";
      printer.setTextSize(1, 1);
      printer.println(shopName);
      printer.setTextNormal();
      if (settings.address) printer.println(settings.address);
      if (settings.phone) printer.println(settings.phone);
      printer.drawLine();
    } else {
      printer.setTextNormal();
    }

    printer.bold(true);
    printer.println(`*** ${copyName} ***`);
    printer.setTextNormal();
    printer.println(`Order: ${order.orderNumber}`);
    printer.println(`Date: ${dateStr}`);
    printer.drawLine();
    printer.alignLeft();
  };

  const generateItemsWithPrices = (list: OrderItem[]) => {
    list.forEach(item => {
      const quantityStr = `${item.quantity}x `;
      const rightText = formatCurrency(item.price * item.quantity);
      const availableLeftSpace = 48 - rightText.length - 1;
      
      let remainingName = item.name || "Item";
      let isFirstLine = true;
      
      while (true) {
        const prefix = isFirstLine ? quantityStr : "   ";
        const maxNameLen = availableLeftSpace - prefix.length;
        
        if (remainingName.length <= maxNameLen) {
           const lineLeft = prefix + remainingName;
           const spaceCount = 48 - lineLeft.length - rightText.length;
           printer.println(lineLeft + " ".repeat(Math.max(1, spaceCount)) + rightText);
           break;
        }
        
        let sliceIdx = remainingName.lastIndexOf(" ", maxNameLen);
        if (sliceIdx <= 0) sliceIdx = maxNameLen;
        
        const chunk = remainingName.substring(0, sliceIdx);
        remainingName = remainingName.substring(sliceIdx).trim();
        
        printer.println(prefix + chunk);
        isFirstLine = false;
      }
      
      if (item.notes) {
        printer.println(`   Note: ${item.notes}`);
      }
    });
  };

  const generatePrepList = (list: OrderItem[]) => {
    list.forEach(item => {
      printer.bold(true);
      printer.println(`${item.quantity}x ${item.name}`);
      printer.setTextNormal();
      if (item.notes) {
        printer.println(`   Note: ${item.notes}`);
      }
      printer.println('');
    });
  };

  const generateFooter = () => {
    printer.drawLine();
    printer.println(formatReceiptLine('Subtotal:', formatCurrency(order.subtotal), 48));

    if (discountAmount > 0) {
      printer.println(formatReceiptLine(`Discount ${((order as any).discountPercentage ?? 0)}%:`, `-${formatCurrency(discountAmount)}`, 48));
    }

    printer.bold(true);
    printer.println(formatReceiptLine('TOTAL:', formatCurrency(order.finalTotal), 48));
    printer.setTextNormal();
    printer.println(`Paid via: ${order.paymentMethod}`);
    printer.drawLine();
    printer.alignCenter();
    const footerMsg = settings.footerMessage || "Thank you for visiting 67";
    printer.println(footerMsg);
    printer.cut();
  };

  const printCopy = async (
    title: string,
    list: OrderItem[],
    showPrices: boolean,
    showFooter = true
  ) => {
    if (list.length === 0) return;
    printer.clear();
    generateHeader(title);

    if (showPrices) {
      generateItemsWithPrices(list);
    } else {
      generatePrepList(list);
    }

    if (showFooter) {
      generateFooter();
    } else {
      printer.cut();
    }

    await executePrintJob(printer, isNetwork, settings);
    await delay(500);
  };

  try {
    await printCopy('CUSTOMER COPY', items, true, true);
    await printCopy('SHOP COPY', items, true, true);

    if (drinksList.length > 0) {
      await printCopy('DRINKS BAR', drinksList, false, false);
    }

    if (foodList.length > 0) {
      await printCopy('KITCHEN', foodList, false, false);
    }

    return true;
  } catch (error) {
    console.error('Printer Error:', error);
    return false;
  }
}
