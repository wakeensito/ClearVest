const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const base=process.env.CLEARVEST_PRODUCTION_URL||'http://127.0.0.1:5177';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
 try{
  const context=await browser.newContext();
  await context.route('http://127.0.0.1:4010/**',route=>route.fulfill({status:200,contentType:'application/json',body:'{}'}));
  const page=await context.newPage();
  const files=new Map(),pending=[];
  page.on('response',response=>{
   const url=new URL(response.url());
   if(url.origin===new URL(base).origin&&url.pathname.endsWith('.js')) pending.push(response.body().then(body=>files.set(url.pathname,{bytes:body.length,gzip:zlib.gzipSync(body).length})));
  });
  await page.goto(base);
  await page.getByRole('heading',{name:'Investing starts with understanding.'}).waitFor();
  await page.waitForLoadState('networkidle');
  await Promise.all(pending);
  assert([...files.keys()].every(file=>file.startsWith('/assets/')),'Measure a production build, not Vite development modules');
  for(const name of ['PortfolioPage','MarketsPage','AdvisorPage','LearnPage','LessonPage','SecurityResearch','LearningPractice']) assert(![...files.keys()].some(file=>file.includes(name)),`${name} is not downloaded on the home route`);
  const totals=[...files.values()].reduce((total,file)=>({bytes:total.bytes+file.bytes,gzip:total.gzip+file.gzip}),{bytes:0,gzip:0});
  // Previous single eager entry: 583,820 bytes / ~184,100 gzip. Budget includes
  // every JS response actually requested for the cold home route, shared chunks too.
  assert(totals.bytes<480000,`Initial JavaScript exceeds 480 kB: ${totals.bytes}`);
  assert(totals.gzip<155000,`Estimated compressed JavaScript exceeds 155 kB: ${totals.gzip}`);
  const output=path.resolve(__dirname,'../node_modules/.cache/clearvest-review');fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,'bundle-report.json'),JSON.stringify({route:'/',totals,files:Object.fromEntries(files),baseline:{bytes:583820,gzip:184100},note:'Sum of cold home-route JS responses; gzip calculated locally, not a measured network transfer or loading-time claim.'},null,2));
  // Also exercise slow navigation and a missing page chunk against the production build.
  let release;
  await page.route('**/assets/LearnPage-*.js',async route=>{await new Promise(resolve=>{release=resolve});await route.continue()});
  await page.getByRole('navigation',{name:'Primary'}).first().getByRole('link',{name:'Learn',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Opening page…'}).waitFor();
  for(let tries=0;!release&&tries<100;tries++)await new Promise(resolve=>setTimeout(resolve,20));
  assert(release,'Learn chunk is requested only after navigation');release();
  await page.getByRole('heading',{name:'Investing, in your own words.'}).waitFor();
  await page.route('**/assets/MarketsPage-*.js',route=>route.abort());
  await page.getByRole('navigation',{name:'Primary'}).first().getByRole('link',{name:'Markets',exact:true}).click();
  await page.getByRole('heading',{name:'This page couldn’t open.'}).waitFor();
  await page.getByRole('button',{name:'Reload page'}).waitFor();
  console.log(`PASS: cold home JS ${totals.bytes} bytes, estimated gzip ${totals.gzip} bytes; pages/charts/practice deferred; slow-navigation status and failed-chunk recovery. See bundle-report.json.`);
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
