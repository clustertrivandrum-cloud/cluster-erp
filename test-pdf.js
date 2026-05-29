const fs = require('fs');
const PDFDocument = require('pdfkit');

function test() {
  try {
    const doc = new PDFDocument();
    doc.text('Hello world');
    doc.end();
    console.log('PDF built successfully in standard script');
  } catch (e) {
    console.error('Error:', e);
  }
}
test();
