// Small-phone layout screenshot (default 320x568). Usage: node tools/smallshot.js out.jpg [w] [h]
const { chromium } = require('playwright-core'), fs = require('fs');
(async () => {
  const exe = ['/usr/bin/google-chrome', '/usr/bin/chromium'].find(f => fs.existsSync(f)); const b = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : {});
  const w = +(process.argv[3] || 320), h = +(process.argv[4] || 568), ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }), p = await ctx.newPage();
  await p.goto('file://' + __dirname + '/../site/index.html'); await p.waitForTimeout(300); await p.tap('[data-act=story]'); await p.waitForTimeout(2500);
  await p.screenshot({ path: process.argv[2] || 'shots/8-small-phone-320.jpg', type: 'jpeg', quality: 88 }); await b.close(); console.log('small shot');
})();
