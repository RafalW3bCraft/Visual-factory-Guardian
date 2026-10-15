import { chromium } from '@playwright/test';
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
const base=process.env.PERF_BASE_URL||'http://127.0.0.1:4173';
const loads=[];
for(let i=0;i<3;i++){
 const p=await browser.newPage({viewport:{width:1440,height:900}});await p.goto(base);await p.getByRole('button',{name:'Focus Vision station'}).waitFor();
 loads.push(await p.evaluate(()=>({readyMs:performance.now(),domContentLoadedMs:performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd,firstContentfulPaintMs:performance.getEntriesByName('first-contentful-paint')[0]?.startTime,transferredBytes:performance.getEntriesByType('resource').reduce((a,r)=>a+r.transferSize,0)})));await p.close();
}
const page=await browser.newPage({viewport:{width:1440,height:900}});await page.goto(base);await page.getByRole('button',{name:'Focus Vision station'}).waitFor();
const browserInfo=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2');const ext=gl.getExtension('WEBGL_debug_renderer_info');return {userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,devicePixelRatio,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};});
const frames=await page.evaluate(()=>new Promise(resolve=>{const durations=[];let start=0,previous=0;function frame(now){if(!start){start=previous=now;}else{durations.push(now-previous);previous=now;}if(now-start<5000){requestAnimationFrame(frame);return;}const sorted=[...durations].sort((a,b)=>a-b);resolve({sampleMs:now-start,frames:durations.length,averageRafFps:durations.length*1000/(now-start),medianFrameMs:sorted[Math.floor(sorted.length*.5)],p95FrameMs:sorted[Math.floor(sorted.length*.95)],over50ms:durations.filter(x=>x>50).length});}requestAnimationFrame(frame);}));
await page.getByRole('button',{name:'Pause scenario'}).click();const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
const memory=async()=>{await cdp.send('HeapProfiler.collectGarbage');const r=await cdp.send('Performance.getMetrics');return Object.fromEntries(r.metrics.filter(m=>['JSHeapUsedSize','Nodes','Documents','JSEventListeners'].includes(m.name)).map(m=>[m.name,m.value]));};
const replay=async()=>{await page.getByRole('button',{name:'Restart demo'}).click();for(const n of [2,3,5,7])await page.getByRole('navigation',{name:'Story scenes'}).getByRole('button').nth(n).click();await page.getByRole('button',{name:'Restart demo'}).click();};
await replay();await replay();const before=await memory();for(let i=0;i<20;i++)await replay();const after=await memory();
console.log(JSON.stringify({browserVersion:browser.version(),browserInfo,loads,frames,replayMemory:{cycles:20,before,after},note:'Local headless browser; no network throttling. RAF cadence while animated scene is active, not AMD inference or a cross-device guarantee. Heap measured after explicit garbage collection; short-run check only.'},null,2));await browser.close();
