import { PDFParse } from 'pdf-parse';

console.log('Starting full PDF parse test...');

try {
    // A more valid-looking minimal PDF
    const buffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 12 Tf 72 712 Td (Hello World) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000062 00000 n\n0000000117 00000 n\n0000000207 00000 n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n300\n%%EOF');
    
    const parser = new PDFParse({ data: buffer });
    console.log('Instance created');
    
    const result = await parser.getText();
    console.log('Text extraction succeeded');
    console.log('Text:', result.text);
} catch (e: any) {
    console.log('Full test failed:', e.message);
    if (e.stack) console.log(e.stack);
}
