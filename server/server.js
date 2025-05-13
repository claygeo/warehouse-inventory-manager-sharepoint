const express = require('express');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const JsBarcode = require('jsbarcode');
const { createCanvas } = require('canvas');
const { createClient } = require('@supabase/supabase-js');
const apiRoutes = require('./routes/api');

// Load environment variables
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json());

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Attach Supabase to all requests
app.use((req, res, next) => {
  req.supabase = supabase;
  next();
});

// Mount API routes
app.use('/api', apiRoutes);

// Generate labels endpoint
app.post('/api/generate-labels', async (req, res) => {
  const { components, includeId, labelSize } = req.body;

  if (!components || !Array.isArray(components) || components.length === 0) {
    return res.status(400).send('Invalid or empty components array');
  }
  if (!labelSize || !labelSize.width || !labelSize.height) {
    return res.status(400).send('Invalid label size');
  }

  try {
    const doc = new PDFDocument({ size: 'LETTER', margin: 0 });
    const outputPath = `labels_${Date.now()}.pdf`;
    const stream = doc.pipe(fs.createWriteStream(outputPath));

    const labelWidth = labelSize.width * 72;
    const labelHeight = labelSize.height * 72;
    const pageWidth = 612;
    const pageHeight = 792;
    const xOffset = 0.25 * 72;
    const yOffset = 1 * 72;
    const labelsPerRow = 2;
    const rowsPerPage = 6;

    let labelIndex = 0;
    while (labelIndex < components.length) {
      if (labelIndex > 0 && labelIndex % (labelsPerRow * rowsPerPage) === 0) {
        doc.addPage();
      }

      for (let i = 0; i < labelsPerRow * rowsPerPage && labelIndex < components.length; i++) {
        const comp = components[labelIndex];

        if (!comp.id) {
          labelIndex++;
          continue;
        }

        const rowNum = Math.floor(i / labelsPerRow);
        const colNum = i % labelsPerRow;
        const x = xOffset + colNum * labelWidth;
        const y = pageHeight - yOffset - (rowNum + 1) * labelHeight;

        doc.rect(x, y, labelWidth, labelHeight).stroke();

        const canvas = createCanvas(200, 60);
        try {
          JsBarcode(canvas, comp.id, {
            format: 'CODE128',
            displayValue: false,
            width: 2,
            height: 40,
          });
        } catch (barcodeError) {
          doc.fontSize(10).text(`Error: Invalid barcode ID ${comp.id}`, x + 5, y + 5);
          labelIndex++;
          continue;
        }

        const barcodeFile = `temp_${comp.id}_${Date.now()}.png`;
        const out = fs.createWriteStream(barcodeFile);
        const pngStream = canvas.createPNGStream();
        pngStream.pipe(out);

        await new Promise((resolve) => out.on('finish', resolve));

        doc.fontSize(10);
        if (includeId) {
          doc.text(comp.id, x + 5, y + 5);
        }

        const barcodeHeight = 60;
        const barcodeWidth = labelWidth - 20;
        const barcodeX = x + 10;
        const barcodeY = y + 30;
        doc.image(barcodeFile, barcodeX, barcodeY, { width: barcodeWidth, height: barcodeHeight });

        await fs.unlink(barcodeFile).catch((err) => console.error(`Failed to delete ${barcodeFile}:`, err));

        labelIndex++;
      }
    }

    doc.end();
    await new Promise((resolve) => stream.on('finish', resolve));

    res.download(outputPath, 'labels.pdf', async (err) => {
      if (err) {
        res.status(500).send('Failed to download PDF');
      }
      await fs.unlink(outputPath).catch((err) => console.error(`Failed to delete ${outputPath}:`, err));
    });
  } catch (error) {
    res.status(500).send(`Error generating labels: ${error.message}`);
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});