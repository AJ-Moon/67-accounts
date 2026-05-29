const express = require('express');
const cors = require('cors');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 7878;

app.post('/print', (req, res) => {
  try {
    const { copies } = req.body;
    if (!copies || !Array.isArray(copies)) {
      return res.status(400).json({ error: 'Invalid payload: expected copies array' });
    }

    console.log(`Received print job with ${copies.length} copies.`);

    // Windows usually uses 'print' or 'copy /b' to PRN. Mac/Linux uses 'lp'.
    const isWin = os.platform() === 'win32';

    copies.forEach((copy, idx) => {
      console.log(`Printing copy: ${copy.type}`);
      const content = copy.content;
      
      // ESC/POS Full Auto-Cut Command (GS V 0)
      const cutCmd = Buffer.from([0x1D, 0x56, 0x00]);
      
      // Feed a few lines before cutting so text isn't sliced
      const feedCmd = Buffer.from('\n\n\n\n\n\n'); 
      const rawContent = Buffer.from(content, 'utf8');

      const payload = Buffer.concat([rawContent, feedCmd, cutCmd]);

      const tempFile = path.join(os.tmpdir(), `receipt_copy_${idx}.bin`);
      fs.writeFileSync(tempFile, payload);

      if (isWin) {
         // Windows raw print fallback - assumes default printer is mapped. Advanced setups might need specific printer names.
         try {
            execSync(`print /D:LPT1 "${tempFile}"`); // LPT1 / Default depends on map. Or copy /b: copy /b "${tempFile}" "\\\\localhost\\PrinterName"
         } catch(e) {
            console.warn("Windows generic print approach might require explicit share name mappings.");
         }
      } else {
         try {
            // Mac/Linux: lp -o raw bypasses drivers securely sending ESC/POS hex explicitly
            execSync(`lp -o raw "${tempFile}"`);
         } catch(e) {
            console.error("Mac/Linux generic print error:", e.message);
         }
      }

      // Cleanup
      try {
        fs.unlinkSync(tempFile);
      } catch(e) {}
    });

    res.json({ success: true, message: 'Print jobs dispatched locally' });

  } catch (error) {
    console.error('Print Bridge Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`CAFE POS LOCAL PRINT BRIDGE ACTIVE `);
  console.log(`Listening on http://localhost:${PORT}`);
  console.log(`Leave this terminal running in the background.`);
  console.log(`=========================================`);
});
