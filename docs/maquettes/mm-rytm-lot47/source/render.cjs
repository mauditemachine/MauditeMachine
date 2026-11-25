// Lot 47 (maquettes) : la face d'avant a W x H (DSF 2), avec et sans ses 16 pads, et la rangee v3 (?face=v3). Sans son.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const [, , web, smp, stateFile, out, W, H] = process.argv;
const st = fs.readFileSync(stateFile, 'utf8');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const PS = '/home/user/MauditeMachine/plugin/mm-rytm/samples';
const srv = http.createServer((q, s) => {
  const p = decodeURIComponent(q.url.split('?')[0]);
  let f = p.startsWith('/samples/rytm/') ? path.join(smp, p.slice(14)) : path.join(web, p === '/' ? 'index.html' : p);
  if (p.startsWith('/samples/rytm/') && !fs.existsSync(f)) f = path.join(PS, p.slice(14));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(s);
});
const init = (s) => {
  window.__mmSent = [];
  const L = {};
  window.__JUCE__ = { initialisationData: { mmState: [s] }, backend: {
    addEventListener: (id, fn) => { (L[id] = L[id] || []).push(fn); },
    emitEvent: (id, o) => { window.__mmSent.push({ id, o }); if (window.__mmSent.length > 400) window.__mmSent.splice(0, 200); },
    emitByBackend: (id, j) => (L[id] || []).forEach((f) => f(JSON.parse(j))) } };
};
srv.listen(0, async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
  const url = 'http://127.0.0.1:' + srv.address().port + '/';
  const pg = await b.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: 2 });
  await pg.addInitScript(init, st);
  await pg.goto(url + '?debug=1');
  await pg.waitForTimeout(9000);
  await pg.screenshot({ path: path.join(out, 'face.png') });
  const hid = await pg.evaluate(() => {
    const s = window.__mmStage;
    if (!s) return 'no stage';
    const q = s.seq;
    const n = [];
    for (const k of ['keys', 'lockMarks', 'frames', 'btnLeds']) { if (q[k] && k !== 'btnLeds') { q[k].visible = false; n.push(k); } }
    s.invalidate && s.invalidate();
    return n.join(',');
  });
  await pg.waitForTimeout(1500);
  await pg.screenshot({ path: path.join(out, 'face-nopads.png') });
  console.log('hid', hid);
  const p2 = await b.newPage({ viewport: { width: 1400, height: 896 }, deviceScaleFactor: 2 });
  await p2.addInitScript(init, st);
  await p2.goto(url + '?face=v3');
  await p2.waitForTimeout(8000);
  await p2.screenshot({ path: path.join(out, 'v3.png') });
  await b.close();
  srv.close();
});
