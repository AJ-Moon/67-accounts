import { printer as ThermalPrinter, types as PrinterTypes } from 'node-thermal-printer';
import fs from 'fs';
import { exec } from 'child_process';

async function test() {
  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: 'tcp://dummy',
    characterSet: 'PC852_LATIN2' as any,
  });

  printer.alignCenter();
  printer.println("XPOS Test Print Success!");
  printer.newLine();
  printer.drawLine();
  printer.println("Compatibility: Verified");
  printer.println("Connection: Raw LPR Buffer");
  printer.cut();
  
  const buffer = printer.getBuffer();
  fs.writeFileSync('receipt.bin', buffer);

  exec('lpr -P Printer_POS_80 -o raw receipt.bin', (error, stdout, stderr) => {
    if (error) {
       console.error('LPR Print Failed:', error);
    } else {
       console.log('Spool sent successfully to Printer_POS_80!');
       // cleanup
       setTimeout(() => fs.unlinkSync('receipt.bin'), 1000);
    }
  });
}

test();
