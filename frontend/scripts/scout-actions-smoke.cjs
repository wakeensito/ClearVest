const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const base = process.env.CLEARVEST_PREVIEW_URL || 'http://127.0.0.1:5176';
const output = path.resolve(__dirname,'../node_modules/.cache/clearvest-review');
const contract = yaml.load(fs.readFileSync(path.resolve(__dirname,'../../docs/api/openapi.yaml'),'utf8'));
(async()=>{
 const browser = await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL || 'chrome'});
 try {
  const context = await browser.newContext({viewport:{width:1440,height:1050}});
  let missing = false;
  const requests=[], errors=[];
  await context.route('http://127.0.0.1:4010/**',async route=>{
   const url = new URL(route.request().url());
   let body = structuredClone(contract.paths[url.pathname]?.[route.request().method().toLowerCase()]?.responses?.['200']?.content?.['application/json']?.example || {});
   let status=200;
   const symbol=url.searchParams.get('symbol') || 'NVDA';
   if(url.pathname === '/portfolio/holdings') {
    if(missing){status=400;body={error:{code:'NOT_LINKED',message:'No linked account'}}}
    else body={asOf:'2026-09-26T10:00:00Z',totalValue:10000,holdings:[{symbol:'NVDA',name:'Nvidia',type:'equity',value:6000,weight:.6,quantity:60,price:100},{symbol:'CASH',name:'Cash',type:'cash',value:4000,weight:.4,quantity:4000,price:1}]};
   }
   if(url.pathname === '/market/history') {
    const requested=(url.searchParams.get('symbols')||'NVDA').split(',');
    body={series:requested.map(symbol=>({symbol,points:[{date:'2025-09-26',close:50},{date:'2026-09-26',close:100}],returnPct:1,volatility:.2})),stale:false};
   }
   if(url.pathname === '/market/company-research') body={symbol,profile:{name:symbol+' example company',description:'Example data for browser verification. This company develops computing products.',sector:'Technology',industry:'Computing',currency:'USD',isFund:false},income:[{date:'2025-12-31',year:'2025',currency:'USD',revenue:100000000,netIncome:10000000}],valuation:{pe:20,eps:5,ps:2},history:[],unavailable:[],sources:[{section:'profile',provider:'FMP',fetchedAt:'2026-09-26T10:00:00Z',stale:false},{section:'income',provider:'FMP',fetchedAt:'2026-09-26T10:00:00Z',stale:false}]};
   if(url.pathname === '/market/news') body={articles:[{symbol:'NVDA',title:'Example headline: company reports annual results',publisher:'Example publisher',url:'https://example.com/article',image:null,publishedAt:'2026-09-24'}],symbols:['NVDA'],source:'FMP',fetchedAt:'2026-09-26T10:00:00Z',stale:false};
   if(url.pathname === '/advisor/chat') {
    const q=route.request().postDataJSON();requests.push(q);
    const kind=q.context?.scenario ? 'scenario' : q.message.includes('headline') ? 'news' : 'company';
    body={reply:kind==='scenario'?'The scenario reduces portfolio value by 18%, because NVDA has a 60% weight. [1]':'The available source describes the company and its reported figures. [1]',userMessage:q.message,disclaimer:'Educational information, not financial advice.',safety:{status:'passed',grounding:q.grounded?'checked':'not_requested'},sources:[{label:kind==='scenario'?'Calculated portfolio scenario':'Example source',kind,asOf:'2026-09-26',text:kind==='scenario'?'Scenario: 6000 position × 30% = 1800 loss; 8200 portfolio after. Other holdings unchanged.':'Example company facts from a cached source.',...(kind==='news'?{url:'https://example.com/article',retrievedAt:'2026-09-26'}:{})}]};
   }
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  fs.mkdirSync(output,{recursive:true});
  await page.goto(base+'/');
  const companion=page.getByRole('complementary',{name:'Scout companion'});
  let launcher=companion.getByRole('button',{name:'Ask Scout',exact:true});
  await launcher.locator('svg[data-loaded="true"]').waitFor();
  const poseOffset=()=>companion.locator('button>span>svg').evaluate(el=>parseFloat(getComputedStyle(el).top)||0);
  assert.equal(await poseOffset(),0,'Peeking pose retains the existing wrapper offset');
  await launcher.click();
  const panel=page.getByRole('dialog',{name:'Ask Scout'});
  await panel.getByText('Where would you like to start?',{exact:true}).waitFor();
  assert.equal(await poseOffset(),-6,'Active pose is raised another six CSS pixels');
  assert.equal(await panel.getByRole('button',{name:/Start with the basics|Make sense of risk|Explain my portfolio/}).count(),3);
  assert.equal(await panel.getByText(/workspace|Selection only|follow the evidence/).count(),0,'Jargon and redundant descriptions removed');
  assert.equal(await page.getByRole('link',{name:/notebook/i}).count(),0,'No notebook navigation');
  const sharing=panel.getByRole('switch',{name:'Use page details'});
  await sharing.click();assert.equal(await sharing.getAttribute('aria-checked'),'false');
  await panel.getByRole('button',{name:'Start with the basics',exact:true}).click();
  assert.equal(requests.length,0,'Starter opens an editable question');
  await panel.getByRole('button',{name:'Send to Scout'}).click();
  await panel.getByText('Reply ready.',{exact:true}).waitFor();
  assert.equal(requests.at(-1).context,undefined,'Sharing switch omits page data');
  assert.equal(await poseOffset(),-6,'Answering pose uses the same additional lift');
  await page.goto(base+'/markets?symbol=NVDA&range=5y');
  await page.getByRole('button',{name:'Previous observation'}).click();
  await page.getByRole('button',{name:/^Explain this price:/}).click();
  await panel.waitFor();
  assert((await panel.getByRole('textbox').inputValue()).includes('2025-09-26'));
  await panel.getByRole('button',{name:'Send to Scout'}).click();
  await panel.getByText('Reply ready.',{exact:true}).waitFor();
  assert.deepEqual(requests.at(-1).context,{page:'markets',symbol:'NVDA',range:'5y',metric:'price',priceDate:'2025-09-26'});
  assert.equal(requests.at(-1).grounded,true);
  await panel.getByRole('link',{name:'Show me the NVDA chart'}).last().click();
  await page.waitForURL(/focus=price/);
  await page.locator('[data-scout-highlight=true]').first().waitFor();
  assert((await page.getByRole('button',{name:/^Explain this price:/}).getAttribute('aria-label')).includes('2025-09-26'));
  await page.goto(base+'/portfolio');
  await page.getByRole('button',{name:/^Explain holding: Explain my saved NVDA/}).first().click();
  await panel.getByRole('button',{name:'Send to Scout'}).click();
  await panel.getByText('Reply ready.',{exact:true}).waitFor();
  assert.equal(requests.at(-1).context.metric,'holding');
  await panel.getByRole('link',{name:'Show me my NVDA holding'}).click();
  await page.waitForURL(/focus=holding/);
  await page.locator('tr[data-scout-highlight=true]').waitFor();
  await page.goto(base+'/advisor?tool=scenario&symbol=NVDA&drop=32&focus=scenario');
  assert.equal(await page.getByRole('slider',{name:'Hypothetical price drop'}).inputValue(),'32');
  await page.getByRole('button',{name:'Explain this with Scout'}).click();
  await page.getByRole('link',{name:'Show me this scenario'}).last().click();
  await page.getByRole('slider',{name:'Hypothetical price drop'}).waitFor();
  assert.equal(await page.getByRole('slider',{name:'Hypothetical price drop'}).inputValue(),'32');
  assert.equal(await page.getByRole('button',{name:/Save to notebook/}).count(),0);
  // A new browser session keeps the welcome screenshot free of conversation history.
  const fresh=await browser.newContext({viewport:{width:1440,height:1000}});
  await fresh.route('http://127.0.0.1:4010/**',route=>route.fulfill({status:200,contentType:'application/json',body:'{}'}));
  const clean=await fresh.newPage();clean.on('pageerror',e=>errors.push(e.message));
  await clean.goto(base+'/learn');
  await clean.getByRole('button',{name:'Ask Scout',exact:true}).click();
  const cleanPanel=clean.getByRole('dialog',{name:'Ask Scout'});
  await cleanPanel.getByText('Where would you like to start?').waitFor();
  await clean.locator('svg[data-loaded="true"]').waitFor();
  await cleanPanel.evaluate(el => Promise.allSettled(el.getAnimations().map(animation => animation.finished)));
  await clean.screenshot({path:path.join(output,'scout-simple-desktop.jpg'),type:'jpeg',quality:75});
  for(const width of [390,320]){
    await clean.setViewportSize({width,height:900});
    assert(await clean.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
    const greeting=await cleanPanel.getByText('Where would you like to start?').boundingBox();
    const composer=await cleanPanel.getByRole('textbox').boundingBox();
    assert(greeting.y>0 && composer.y+composer.height<900-64,'Welcome and composer stay visible');
    await clean.screenshot({path:path.join(output,`scout-simple-${width}.jpg`),type:'jpeg',quality:78});
  }
  await clean.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await cleanPanel.getByRole('switch',{name:'Use page details'}).getAttribute('aria-checked'),'true');
  await clean.keyboard.press('Escape');
  await clean.getByRole('button',{name:'Ask Scout',exact:true}).waitFor();
  await fresh.close();
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS: simplified panel, page-sharing switch, 6px active/ready lift, editable starters, exact price/holding context, Show me links, same-route scenario, no notebook, 390/320px, Escape and reduced motion. Fixture APIs.');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
