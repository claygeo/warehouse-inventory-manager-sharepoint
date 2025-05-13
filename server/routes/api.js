const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const JsBarcode = require('jsbarcode');
const { createCanvas } = require('canvas');
const PDFDocument = require('pdfkit');

// Multer setup for file uploads
const upload = multer({ dest: 'uploads/' });

// Helper to generate barcode
const generateBarcode = (id) => {
  const canvas = createCanvas();
  JsBarcode(canvas, id, { format: 'CODE128', displayValue: false });
  return canvas.toBuffer('image/png');
};

// Helper to create PDF labels
const createLabelsPDF = async (components, includeId = true, labelSize = { width: 4, height: 1.5 }) => {
  const outputPath = `labels_${Date.now()}.pdf`;
  const doc = new PDFDocument({ size: 'LETTER' });
  const stream = doc.pipe(fs.createWriteStream(outputPath));

  const pageWidth = 612;
  const pageHeight = 792;
  const labelWidth = labelSize.width * 72;
  const labelHeight = labelSize.height * 72;
  const labelsPerRow = Math.floor((pageWidth - 0.5 * 72) / labelWidth);
  const rowsPerPage = Math.floor((pageHeight - 2 * 72) / labelHeight);
  const xOffset = 0.25 * 72;
  const yOffset = 1 * 72;

  components.forEach((component, index) => {
    const pageNum = Math.floor(index / (labelsPerRow * rowsPerPage));
    const labelNum = index % (labelsPerRow * rowsPerPage);
    const rowNum = Math.floor(labelNum / labelsPerRow);
    const colNum = labelNum % labelsPerRow;

    if (labelNum === 0 && index !== 0) {
      doc.addPage();
    }

    const x = xOffset + colNum * labelWidth;
    const y = pageHeight - yOffset - (rowNum + 1) * labelHeight;

    const barcodeBuffer = generateBarcode(component.id);
    if (includeId) {
      doc.fontSize(10).text(component.id, x + 5, y + 10);
    }
    doc.image(barcodeBuffer, x + 5, y + 20, { width: labelWidth - 10, height: Math.min(60, labelHeight - 30) });
  });

  doc.end();
  await new Promise((resolve) => stream.on('finish', resolve));
  return outputPath;
};

// Get all components
router.get('/components', async (req, res) => {
  try {
    const { data, error } = await req.supabase.from('components').select('id, barcode, description, quantity');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Import components
router.post('/components/import', async (req, res) => {
  const components = req.body;
  try {
    const barcodes = new Set();
    const duplicates = [];
    const toInsert = [];

    components.forEach((comp) => {
      const barcode = comp.ID;
      if (barcodes.has(barcode)) {
        duplicates.push(barcode);
      } else {
        barcodes.add(barcode);
        toInsert.push({
          id: comp.ID,
          barcode: comp.ID,
          description: comp.Description,
          quantity: 0,
          location: 'Warehouse',
        });
      }
    });

    if (toInsert.length > 0) {
      const { error } = await req.supabase.from('components').upsert(toInsert);
      if (error) throw error;
    }

    res.json({ success: true, duplicates });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update quantity
router.post('/components/update-quantity', async (req, res) => {
  const { barcode, quantity } = req.body;
  try {
    const { error } = await req.supabase
      .from('components')
      .update({ quantity })
      .eq('barcode', barcode);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate labels
router.post('/generate-labels', async (req, res) => {
  const { components, includeId, labelSize } = req.body;
  try {
    const outputPath = await createLabelsPDF(components, includeId, labelSize);
    res.download(outputPath, 'labels.pdf', async (err) => {
      if (err) {
        res.status(500).json({ error: 'Failed to download PDF' });
      }
      await fs.unlink(outputPath).catch((err) => console.error(`Failed to delete ${outputPath}:`, err));
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;