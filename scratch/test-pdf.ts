import pdf from 'pdf-parse';
import { PDFParse } from 'pdf-parse';

console.log('Default export type:', typeof pdf);
console.log('PDFParse export type:', typeof PDFParse);

try {
    const buffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000062 00000 n\n0000000117 00000 n\ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF');
    if (typeof pdf === 'function') {
        console.log('Trying as function...');
        await pdf(buffer);
        console.log('Function call succeeded');
    }
} catch (e: any) {
    console.log('Function call failed:', e.message);
}

try {
    if (typeof PDFParse === 'function') {
        console.log('Trying as class...');
        const p = new PDFParse({ data: Buffer.from('%PDF-1.4...') });
        console.log('Class instantiation succeeded');
    }
} catch (e: any) {
    console.log('Class usage failed:', e.message);
}
