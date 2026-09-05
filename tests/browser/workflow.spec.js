import { test, expect } from '@playwright/test';
import JSZip from 'jszip';
import { backend } from './backend.js';
test('student creates a draft, extracts a DOCX, and submits chapters into the real migration', async ({
  page
}) => {
  const db = await backend(page);
  try {
    await page.goto('/student/submit');
    await expect(
      page.getByRole('heading', { name: 'Start your research submission' })
    ).toBeVisible();
    await page.getByLabel('Research title', { exact: true }).fill('Browser workflow study');
    await page.getByLabel('Abstract', { exact: true }).fill('A test of chapter submission.');
    await page.getByLabel('Authors (separated by commas)').fill('Test Student');
    await page.getByLabel('Strand', { exact: true }).selectOption('STEM');
    await page.getByLabel('Category', { exact: true }).selectOption('Applied Research');
    await page
      .getByLabel('Assigned teacher', { exact: true })
      .selectOption({ label: 'Test Teacher' });
    await page.getByRole('button', { name: 'Save draft & continue' }).click();
    await expect(page.getByRole('heading', { name: 'Browser workflow study' })).toBeVisible();
    const zip = new JSZip();
    zip.file(
      '[Content_Types].xml',
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>'
    );
    zip.file(
      'word/document.xml',
      `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${Array.from({ length: 5 }, (_, i) => `<w:p><w:r><w:t>CHAPTER ${i + 1}</w:t></w:r></w:p><w:p><w:r><w:t>${'Research body content. '.repeat(20)}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`
    );
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    await page
      .locator('input[type=file]')
      .setInputFiles({
        name: 'research.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer
      });
    await expect(page.getByRole('heading', { name: 'Check your chapter boundaries' })).toBeVisible({
      timeout: 30000
    });
    await expect(page.getByRole('checkbox', { name: /Include/ })).toHaveCount(5);
    await page.getByRole('button', { name: 'Confirm and submit chapters' }).click();
    await expect(page.getByText('Chapters sent to your teacher.', { exact: true })).toBeVisible();
    const versions = (await db.query('select status from chapter_versions')).rows;
    expect(versions).toHaveLength(5);
    expect(versions.every((v) => v.status === 'submitted')).toBe(true);
    await page.goto('/student/progress');
    await expect(page.getByRole('link', { name: 'Browser workflow study' })).toBeVisible();
    await expect(page.getByText('0/5 approved · 0%')).toBeVisible();
    const rid = (await db.query('select id from researches')).rows[0].id;
    await db.loginAsTeacher();
    await page.goto(`/teacher/research/${rid}`);
    await expect(page.getByRole('heading', { name: 'Browser workflow study' })).toBeVisible();
    const chapterTabs = page
      .getByRole('navigation', { name: 'Research chapters' })
      .getByRole('button');
    for (let i = 0; i < 5; i++) {
      await chapterTabs.nth(i).click();
      await page.getByRole('button', { name: 'Approve chapter', exact: true }).click();
      await expect(chapterTabs.nth(i)).toContainText('approved');
    }
    await page.locator('select').last().selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Approve final research', exact: true }).click();
    await expect(
      page.getByText('Research approved for the library.', { exact: true })
    ).toBeVisible();
    expect((await db.query('select status from researches')).rows[0].status).toBe('approved');
  } finally {
    await page.unrouteAll({ behavior: 'wait' });
    await db.close();
  }
});
