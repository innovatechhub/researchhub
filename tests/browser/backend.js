import { createDatabase } from '../database-fixture.mjs';
const uid = '00000000-0000-4000-8000-000000000002';
const tid = '00000000-0000-4000-8000-000000000003';
export async function backend(page) {
  const db = await createDatabase();
  const files = new Map();
  await db.exec(
    `insert into profiles(id,role,full_name) values('${uid}','student','Test Student'),('${tid}','teacher','Test Teacher');insert into teacher_student_assignments(teacher_id,student_id,academic_period) values('${tid}','${uid}','2026');`
  );
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
  await db.exec('set role authenticated');
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: uid, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.local-signature`;
  let user = {
    id: uid,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'student@example.test',
    app_metadata: { provider: 'email' },
    user_metadata: {},
    created_at: new Date().toISOString()
  };
  await page.addInitScript(
    ({ token, user }) => {
      if (!sessionStorage.getItem('initialized')) {
        localStorage.setItem(
          'sb-127-auth-token',
          JSON.stringify({
            access_token: token,
            refresh_token: 'test-refresh',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            expires_in: 3600,
            token_type: 'bearer',
            user
          })
        );
        sessionStorage.setItem('initialized', 'true');
      }
    },
    { token, user }
  );
  await page.route('http://127.0.0.1:54321/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    try {
      let result;
      if (url.pathname === '/auth/v1/user') result = user;
      else if (url.pathname.startsWith('/rest/v1/rpc/')) {
        const name = url.pathname.split('/').pop();
        if (!/^workflow_\w+$/.test(name)) throw Error('Unsupported test RPC');
        const body = req.postDataJSON() || {};
        const keys = Object.keys(body);
        const values = Object.values(body).map((v) =>
          typeof v === 'object' && v !== null ? JSON.stringify(v) : v
        );
        result = (
          await db.query(
            `select public.${name}(${keys.map((k, i) => `${k}=>$${i + 1}`).join(',')}) value`,
            values
          )
        ).rows[0].value;
      } else if (url.pathname.startsWith('/rest/v1/')) {
        const table = url.pathname.split('/').pop();
        if (!/^\w+$/.test(table)) throw Error('Invalid table');
        const filters = [],
          args = [];
        for (const [key, value] of url.searchParams) {
          if (!/^\w+$/.test(key) || ['select', 'order', 'limit', 'offset'].includes(key)) continue;
          if (value.startsWith('eq.')) {
            args.push(value.slice(3));
            filters.push(`${key}=$${args.length}`);
          }
          if (value.startsWith('in.(')) {
            const vals = value
              .slice(4, -1)
              .split(',')
              .map((v) => v.replaceAll('"', ''));
            filters.push(
              `${key} in (${vals
                .map((v) => {
                  args.push(v);
                  return `$${args.length}`;
                })
                .join(',')})`
            );
          }
        }
        result = (
          await db.query(
            `select * from public.${table}${filters.length ? ' where ' + filters.join(' and ') : ''}`,
            args
          )
        ).rows;
        if (table === 'research_chapters') result.sort((a, b) => a.position - b.position);
        if (req.headers().accept?.includes('vnd.pgrst.object')) result = result[0] || null;
      } else if (url.pathname.startsWith('/storage/v1/object/')) {
        const path = decodeURIComponent(
          url.pathname.replace('/storage/v1/object/research-files/', '')
        );
        if (req.method() === 'POST') {
          files.set(path, req.postDataBuffer());
          await db.query(
            "insert into storage.objects(bucket_id,name) values('research-files',$1)",
            [path]
          );
          result = { Key: path };
        } else {
          await route.fulfill({ status: 200, body: files.get(path) || Buffer.alloc(0) });
          return;
        }
      } else result = [];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(result),
        headers: {
          'content-range': `0-${Array.isArray(result) ? Math.max(0, result.length - 1) : 0}/${Array.isArray(result) ? result.length : 1}`
        }
      });
    } catch (e) {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: e.message })
      });
    }
  });
  db.loginAsTeacher = async () => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [tid]);
    await db.exec('set role authenticated');
    user = { ...user, id: tid, email: 'teacher@example.test' };
    await page.evaluate((user) => {
      const session = JSON.parse(localStorage.getItem('sb-127-auth-token'));
      session.user = user;
      localStorage.setItem('sb-127-auth-token', JSON.stringify(session));
    }, user);
  };
  return db;
}
