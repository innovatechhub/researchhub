import { test, expect } from '@playwright/test';
import { backend } from './backend.js';

const uid = '00000000-0000-4000-8000-000000000002';
const tid = '00000000-0000-4000-8000-000000000003';
const shots = process.env.DASHBOARD_SHOTS; // optional folder for review screenshots

const CHAPTER_ONE = [
  'Background of the Study',
  'This study aims to explore the effects of study habits on academic performance among Senior High School students.',
  'Statement of the Problem',
  'What is the effect of study habits on grades?',
  'Objectives of the Study',
  'To measure study habits.'
].join('\n');

async function seed(db) {
  await db.exec('reset role');
  await db.exec(`
    update profiles set full_name='Dinaque, Lorainne' where id='${uid}';
    update profiles set full_name='Mrs. Santos' where id='${tid}';
    insert into profiles(id,role,full_name) values
      ('00000000-0000-4000-8000-000000000011','student','Reyes, Andrea Mae'),
      ('00000000-0000-4000-8000-000000000012','student','Santos, Maria Clarisse');
    insert into teacher_student_assignments(teacher_id,student_id,academic_period) values
      ('${tid}','00000000-0000-4000-8000-000000000011','2026'),
      ('${tid}','00000000-0000-4000-8000-000000000012','2026');
  `);
  const insert = async (student, title, status) =>
    (
      await db.query(
        `insert into researches(student_id,teacher_id,title,abstract,authors,strand,category,year,status,workflow_enabled)
         values($1,'${tid}',$2,'Abstract',array['Author'],'STEM','Applied Research',2026,$3,true) returning id`,
        [student, title, status]
      )
    ).rows[0].id;
  const main = await insert(uid, 'Effects of Study Habits on Academic Performance', 'draft');
  await insert(
    '00000000-0000-4000-8000-000000000011',
    'The Impact of Social Media on Mental Health',
    'draft'
  );
  await insert(
    '00000000-0000-4000-8000-000000000012',
    'Environmental Awareness in Our Community',
    'approved'
  );
  const doc = (
    await db.query(
      `insert into research_documents(research_id,file_path,format,checksum,uploaded_by)
       values($1,'seed/main.pdf','pdf','x','${uid}') returning id`,
      [main]
    )
  ).rows[0].id;
  const titles = [
    'Introduction',
    'Review of Related Literature',
    'Methodology',
    'Results and Discussion',
    'Summary, Conclusions, and Recommendations'
  ];
  for (const [i, title] of titles.entries())
    await db.query('insert into research_chapters(research_id,position,title) values($1,$2,$3)', [
      main,
      i + 1,
      title
    ]);
  const chapters = (
    await db.query('select * from research_chapters where research_id=$1 order by position', [main])
  ).rows;
  const version = async (chapter, n, status, content, day) =>
    (
      await db.query(
        `insert into chapter_versions(chapter_id,document_id,version_number,start_block,end_block,content,status,submitted_at,created_at)
         values($1,$2,$3,0,1,$4,$5,$6,$6) returning id`,
        [chapter.id, doc, n, content, status, `2026-11-${day}T02:24:00Z`]
      )
    ).rows[0].id;
  // Chapter 1: v1 was sent back with corrections; v2 is the resubmission awaiting review.
  const v1 = await version(chapters[0], 1, 'needs_revision', CHAPTER_ONE, 12);
  const v2 = await version(chapters[0], 2, 'submitted', CHAPTER_ONE, 15);
  const v3 = await version(chapters[1], 1, 'needs_revision', 'Related literature body.', 12);
  const v4 = await version(chapters[2], 1, 'approved', 'Methodology body.', 12);
  for (const [chapter, current] of [
    [chapters[0], v2],
    [chapters[1], v3],
    [chapters[2], v4]
  ])
    await db.query('update research_chapters set current_version_id=$2 where id=$1', [
      chapter.id,
      current
    ]);
  const review = (versionId, decision, comment, section, severity, day) =>
    db.query(
      `insert into chapter_reviews(version_id,reviewer_id,decision,comment,section,severity,created_at)
       values($1,'${tid}',$2,$3,$4,$5,$6)`,
      [versionId, decision, comment, section, severity, `2026-11-${day}T03:00:00Z`]
    );
  await review(
    v1,
    'needs_revision',
    'Please provide additional supporting literature to strengthen your background and clearly state the research gap.',
    'Background of the Study',
    'major',
    13
  );
  await review(
    v1,
    'feedback',
    'Good start! Just make the background more specific to your study.',
    'Background of the Study',
    null,
    13
  );
  await review(v3, 'needs_revision', 'Add at least five related studies.', null, 'minor', 13);
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
  return { main, v2 };
}

async function snap(page, name) {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
}

test('student dashboard shows chapters, sections and every earlier correction', async ({
  page
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const db = await backend(page);
  try {
    await seed(db);
    await page.goto('/student/dashboard');
    await expect(page.getByRole('heading', { name: 'Hello, Lorainne!' })).toBeVisible();
    await expect(page.getByText('Research Title:')).toBeVisible();
    // The sidebar matches the mockup: Dashboard, My Research, Notifications, Profile, Help.
    const nav = page.getByRole('navigation', { name: 'Student Portal' });
    for (const label of ['Dashboard', 'My Research', 'Notifications', 'Profile', 'Help & Support'])
      await expect(nav.getByRole('link', { name: new RegExp(label) })).toBeVisible();
    // Chapter 1 is on version 2, yet the version 1 corrections are still listed.
    await expect(page.getByText('clearly state the research gap')).toBeVisible();
    await expect(page.getByText('Version 1').first()).toBeVisible();
    await expect(page.getByText('Major Revision')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Submission History' })).toBeVisible();
    await snap(page, 'student-dashboard');
    await page.getByRole('button', { name: /Chapter 2/ }).click();
    await expect(page.getByText('Add at least five related studies.')).toBeVisible();
  } finally {
    await page.unrouteAll({ behavior: 'wait' });
    await db.close();
  }
});

test('student starting a new research gets the saved details pre-filled', async ({ page }) => {
  const db = await backend(page);
  try {
    await seed(db);
    await page.goto('/student/submit');
    await expect(
      page.getByText('We filled in your details from your previous research')
    ).toBeVisible();
    await expect(page.getByLabel('Strand', { exact: true })).toHaveValue('STEM');
    await expect(page.getByLabel('Category', { exact: true })).toHaveValue('Applied Research');
    await expect(page.getByLabel('Research title', { exact: true })).toHaveValue('');
  } finally {
    await page.unrouteAll({ behavior: 'wait' });
    await db.close();
  }
});

test('teacher searches the review queue and saves a correction with a section', async ({
  page
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const db = await backend(page);
  try {
    const { main } = await seed(db);
    await page.goto('/student/dashboard');
    await db.loginAsTeacher();
    await page.goto('/teacher/dashboard');
    await expect(page.getByText('Total Submissions')).toBeVisible();
    const queue = page.getByRole('region', { name: 'My Review Queue' });
    await expect(queue.getByRole('button')).toHaveCount(3 + 4); // 3 research rows + 4 filter chips
    await expect(page.getByRole('button', { name: /Chapter 1/ })).toBeVisible();
    await snap(page, 'teacher-dashboard');
    await queue.getByPlaceholder(/Search by student name/).fill('social media');
    await expect(queue.getByText('Reyes, Andrea Mae')).toBeVisible();
    await expect(queue.getByText('Dinaque, Lorainne')).toHaveCount(0);
    await queue.getByPlaceholder(/Search by student name/).fill('dinaque');
    await expect(queue.getByText('Dinaque, Lorainne')).toBeVisible();
    // The previous corrections are visible to the teacher too.
    await expect(page.getByText('clearly state the research gap')).toBeVisible();
    await expect(
      page.locator('.corrections-panel').getByRole('combobox', { name: 'Section', exact: true })
    ).toBeVisible();
    await snap(page, 'teacher-detail');
    await page
      .getByRole('combobox', { name: 'Section', exact: true })
      .selectOption('Statement of the Problem');
    await expect(
      page.getByRole('button', { name: '2. Statement of the Problem', exact: true })
    ).toHaveAttribute('aria-expanded', 'true');
    await page.getByLabel('Correction', { exact: true }).fill('State the problem as a question.');
    await page.getByRole('button', { name: 'Save Corrections' }).click();
    await expect(page.getByText('Corrections saved.')).toBeVisible();
    const saved = (
      await db.query(
        "select section,severity,decision from chapter_reviews where comment='State the problem as a question.'"
      )
    ).rows;
    expect(saved).toEqual([
      { section: 'Statement of the Problem', severity: 'major', decision: 'needs_revision' }
    ]);
    expect(main).toBeTruthy();
    await page.goto('/teacher/approval');
    // Review Queue opens filtered to research awaiting review.
    await expect(page.getByRole('button', { name: 'Pending', pressed: true })).toBeVisible();
  } finally {
    await page.unrouteAll({ behavior: 'wait' });
    await db.close();
  }
});

test('student chapter content stays readable on phones, tablets and desktop', async ({ page }) => {
  const db = await backend(page);
  try {
    await seed(db);
    await page.goto('/student/dashboard');
    await expect(page.getByRole('heading', { name: 'Hello, Lorainne!' })).toBeVisible();
    for (const width of [375, 390, 768, 1100, 1495]) {
      await page.setViewportSize({ width, height: 997 });
      const layout = await page.evaluate(() => {
        const detail = document.querySelector('.chapter-review-panel').getBoundingClientRect();
        return {
          viewport: innerWidth,
          document: document.documentElement.scrollWidth,
          detailWidth: detail.width,
          detailRight: detail.right
        };
      });
      expect(layout.document, `page overflow at ${width}px`).toBeLessThanOrEqual(width);
      expect(layout.detailWidth, `content squeezed at ${width}px`).toBeGreaterThan(250);
      expect(layout.detailRight).toBeLessThanOrEqual(width);
      if (width === 390) await snap(page, 'student-mobile');
    }
    await page.getByRole('button', { name: /Chapter 2/ }).click();
    await expect(page.getByText('Add at least five related studies.')).toBeVisible();
    await expect(page.getByText('Related literature body.', { exact: true }).first()).toBeVisible();
  } finally {
    await page.unrouteAll({ behavior: 'wait' });
    await db.close();
  }
});
