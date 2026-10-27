const { chromium } = require('playwright-core');
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});const p=await ctx.newPage();
p.on('console',m=>console.log('console',m.type(),m.text()));p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('file:///workspace/blast-maze/site/index.html');await p.waitForTimeout(500);await p.screenshot({path:'/tmp/h.jpg',type:'jpeg'});
await p.tap('[data-act=story]');await p.waitForTimeout(2500);await p.tap('#bombBtn');await p.waitForTimeout(2800);await p.screenshot({path:'/tmp/g.jpg',type:'jpeg'});
console.log(JSON.stringify(await p.evaluate(()=>BM.UI.state())));await b.close();})();
