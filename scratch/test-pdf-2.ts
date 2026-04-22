import { PDFParse } from 'pdf-parse';

console.log('PDFParse export type:', typeof PDFParse);

try {
    const buffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000062 00000 n\n0000000117 00000 n\ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF');
    if (typeof PDFParse === 'function') {
        console.log('Trying to instantiate PDFParse...');
        const p = new PDFParse({ data: buffer });
        console.log('Class instantiation succeeded');
        // Try calling a method
        // const text = await p.getText();
        // console.log('getText succeeded');
    } else {
        console.log('PDFParse is NOT a function/class, it is:', typeof PDFParse);
    }
} catch (e: any) {
    console.log('Operation failed:', e.message);
}
