import { test, expect } from '@playwright/test';
import { jsPDF } from 'jspdf';
test('PDF worker detects searchable chapters and preserves blank scanned pages for manual mapping', async ({
  page
}) => {
  await page.route('http://127.0.0.1:54321/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.goto('/');
  const pdf = new jsPDF();
  pdf.text('CHAPTER I', 20, 20);
  pdf.text('Introduction and research body.', 20, 40);
  pdf.addPage();
  pdf.text('CHAPTER II', 20, 20);
  pdf.text('Related literature.', 20, 40);
  const result = await page.evaluate(
    async (bytes) => {
      const { extractDocument } = await import('/src/infrastructure/documents/extractDocument.js');
      return extractDocument(
        new File([new Uint8Array(bytes)], 'research.pdf', { type: 'application/pdf' })
      );
    },
    [...new Uint8Array(pdf.output('arraybuffer'))]
  );
  expect(result.blocks).toHaveLength(2);
  expect(result.chapters.map((c) => c.position)).toEqual([1, 2]);
  expect(result.unit).toBe('page');
  const blank = new jsPDF();
  const scanned = await page.evaluate(
    async (bytes) => {
      const { extractDocument } = await import('/src/infrastructure/documents/extractDocument.js');
      return extractDocument(
        new File([new Uint8Array(bytes)], 'scan.pdf', { type: 'application/pdf' })
      );
    },
    [...new Uint8Array(blank.output('arraybuffer'))]
  );
  expect(scanned.scanned).toBe(true);
  expect(scanned.blocks).toHaveLength(1);
  expect(scanned.chapters).toEqual([]);
});
