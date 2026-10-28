// Запускає разом сервер кімнат (wrangler, порт 8787) і гру (Vite, порт 5173).
// Гра пересилає /api на сервер, тож онлайн можна пробувати локально у двох вкладках.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

mkdirSync('apps/web/dist', { recursive: true }); // wrangler хоче бачити теку зібраної гри
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false' };
const procs = [];
// на Windows зупиняємо все дерево процесів, інакше Vite лишиться висіти й займати порт
const kill = (p) => (process.platform === 'win32' ? spawnSync('taskkill', ['/pid', String(p.pid), '/T', '/F']) : p.kill());
const stopAll = () => { for (const p of procs) if (p.exitCode === null) kill(p); process.exit(); };
for (const [name, ws] of [['сервер', '@zh/server'], ['гра', '@zh/web']]) {
  const p = spawn('npm', ['run', 'dev', '-w', ws], { stdio: 'inherit', shell: true, env });
  p.on('exit', () => {
    if (name === 'гра') { stopAll(); return; }
    // без сервера кімнат гра все одно працює — лише онлайн буде недоступний
    console.log('');
    console.log('[сервер кімнат] не запустився. Гра працює, але онлайн локально недоступний.');
    console.log('На Windows найчастіше допомагає свіжий Microsoft Visual C++ Redistributable:');
    console.log('https://aka.ms/vs/17/release/vc_redist.x64.exe');
    console.log('');
  });
  procs.push(p);
}
process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);
