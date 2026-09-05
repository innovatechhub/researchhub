import { detectChapters } from '../../domain/chapters.mjs';
export async function extractDocument(file, titles) {
  const buffer = await file.arrayBuffer();
  let blocks;
  if (file.name.toLowerCase().endsWith('.docx')) {
    blocks = await new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./extraction.worker.js', import.meta.url), {
        type: 'module'
      });
      const timer = setTimeout(() => {
        worker.terminate();
        reject(new Error('Document processing timed out. Try a smaller document.'));
      }, 60000);
      const finish = () => {
        clearTimeout(timer);
        worker.terminate();
      };
      worker.onmessage = ({ data }) => {
        finish();
        data.error ? reject(new Error(data.error)) : resolve(data.blocks);
      };
      worker.onerror = () => {
        finish();
        reject(new Error('Unable to read this DOCX. Try exporting it again.'));
      };
      worker.postMessage({ buffer }, [buffer]);
    });
  } else {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
    const task = pdfjs.getDocument({ data: buffer, isEvalSupported: false });
    try {
      const pdf = await task.promise;
      if (pdf.numPages > 500) throw new Error('Use a manuscript with no more than 500 pages.');
      blocks = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        let text = '';
        content.items.forEach((item) => {
          if ('str' in item) text += item.str + (item.hasEOL ? '\n' : ' ');
        });
        // Keep one block per physical PDF page, including scanned pages, for manual ranges.
        blocks.push({ text: text.trim(), page: pageNumber });
      }
    } finally {
      await task.destroy();
    }
  }
  if (!blocks.length)
    throw new Error('No readable content found. Export as PDF or DOCX and try again.');
  if (blocks.length > 20000 || JSON.stringify(blocks).length > 9000000)
    throw new Error(
      'Document text exceeds the processing limit. Split the manuscript into smaller uploads.'
    );
  const isPdf = file.name.toLowerCase().endsWith('.pdf');
  const headingBlocks = isPdf
    ? blocks.map((b) => ({
        ...b,
        sourceText: b.text,
        text:
          b.text.split('\n').find((line) => /^chapter\s+/i.test(line.trim())) ||
          b.text.split('\n')[0] ||
          ''
      }))
    : blocks;
  const chapters = detectChapters(headingBlocks, titles);
  return {
    blocks,
    chapters,
    unit: isPdf ? 'page' : 'paragraph',
    scanned: isPdf && blocks.every((b) => !b.text.trim())
  };
}
