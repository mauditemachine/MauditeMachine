const { chromium } = require('playwright');
const path = require('path');
const dir = __dirname;
const which = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  for (const [v, w, h, dsf] of [['A', 1600, 975, 2], ['B', 1600, 1069, 2], ['detail', 1600, 1360, 2], ['size', 3080, 1090, 1]]) {
    if (which.length && !which.includes(v)) continue;
    const pg = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dsf });
    await pg.goto('file://' + path.join(dir, 'mock.html') + '#v=' + v);
    await pg.waitForTimeout(800);
    await pg.screenshot({ path: path.join(dir, 'm-' + v + '.png') });
    await pg.close();
  }
  await b.close();
})();
