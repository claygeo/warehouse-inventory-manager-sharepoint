const PDFDocument = require('pdfkit');
     const bwipjs = require('bwip-js');

     exports.handler = async (event) => {
       if (event.httpMethod !== 'POST') {
         return { statusCode: 405, body: 'Method Not Allowed' };
       }

       try {
         const { components, includeId, labelSize } = JSON.parse(event.body);

         if (!components || !Array.isArray(components) || components.length === 0) {
           return { statusCode: 400, body: 'Invalid or empty components array' };
         }
         if (!labelSize || !labelSize.width || !labelSize.height) {
           return { statusCode: 400, body: 'Invalid label size' };
         }

         const doc = new PDFDocument({ size: 'LETTER', margin: 0 });
         let buffers = [];
         doc.on('data', buffers.push.bind(buffers));
         doc.on('end', () => {});

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

             const barcodeBuffer = await bwipjs.toBuffer({
               bcid: 'code128',
               text: comp.id,
               scale: 2,
               height: 40,
               includetext: false,
             });

             doc.fontSize(10);
             if (includeId) {
               doc.text(comp.id, x + 5, y + 5);
             }

             const barcodeHeight = 60;
             const barcodeWidth = labelWidth - 20;
             const barcodeX = x + 10;
             const barcodeY = y + 30;
             doc.image(barcodeBuffer, barcodeX, barcodeY, { width: barcodeWidth, height: barcodeHeight });

             labelIndex++;
           }
         }

         doc.end();

         return new Promise((resolve) => {
           doc.on('end', () => {
             const pdfBuffer = Buffer.concat(buffers);
             resolve({
               statusCode: 200,
               headers: {
                 'Content-Type': 'application/pdf',
                 'Content-Disposition': 'attachment; filename=labels.pdf',
               },
               body: pdfBuffer.toString('base64'),
               isBase64Encoded: true,
             });
           });
         });
       } catch (error) {
         console.error('Error generating labels:', error);
         return {
           statusCode: 500,
           body: JSON.stringify({ error: error.message }),
         };
       }
     };