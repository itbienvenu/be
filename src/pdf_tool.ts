import { PDFParse } from 'pdf-parse';
import fs from 'node:fs/promises';

const dataBuffer = await fs.readFile('src/cv.pdf');
const pdf = new PDFParse({ data: dataBuffer });
const data = await pdf.getText();
console.log(data.text);