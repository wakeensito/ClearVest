const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const base = process.env.CLEARVEST_PREVIEW_URL || 'http://127.0.0.1:5173';
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
  await page.goto(base+'/markets?symbol=NVDA');
  await page.getByRole('group',{name:'History range'}).getByRole('button',{name:'5Y',exact:true}).click();
  await page.getByRole('button',{name:'Ask Scout',exact:true}).click();
  const panel=page.getByRole('dialog',{name:'Ask Scout'});
  await panel.getByText('NVDA · Markets · 5Y',{exact:true}).waitFor();
  const question=page.getByRole('textbox',{name:'Your question for Scout'});
  await question.fill('What does this company do?');await question.press('Enter');
  await panel.getByText('The available source describes',{exact:false}).waitFor();
  assert.deepEqual(requests.at(-1).context,{page:'markets',symbol:'NVDA',range:'5y'});
  await panel.getByRole('switch',{name:'Use page details'}).click();
  await question.fill('Explain investing');await question.press('Enter');
  await page.waitForFunction(()=>document.querySelectorAll('article').length>=4);
  assert.equal(requests.at(-1).context,undefined,'Page identifiers are omitted when sharing is off');
  await page.goto(base+'/learn/what-is-investing');
  await page.getByRole('button',{name:'Ask Scout',exact:true}).click();
  await page.getByText('What investing actually is · Learn',{exact:true}).waitFor();
  await page.goto(base+'/advisor');
  assert.equal(await page.getByText('Learn a little. Explore at your pace.',{exact:true}).count(),0);
  await page.getByRole('button',{name:'Risk check',exact:true}).click();
  await page.getByRole('heading',{name:'What if one holding falls?'}).waitFor();
  await page.getByText('−12.00',{exact:false}).waitFor();
  await page.getByRole('slider',{name:'Hypothetical price drop'}).fill('30');
  await page.getByText('−18.00',{exact:false}).waitFor();
  await page.getByRole('button',{name:'Explain this with Scout'}).click();
  await page.getByText('The scenario reduces portfolio value',{exact:false}).waitFor();
  assert.deepEqual(requests.at(-1).context,{page:'advisor',scenario:{symbol:'NVDA',dropPct:30}});
  assert.equal(requests.at(-1).grounded,true);
  await page.getByText('Checked against source · [1] View source',{exact:true}).click();
  await page.getByText('Scenario: 6000 position',{exact:false}).waitFor();
  fs.mkdirSync(output,{recursive:true});
  await page.screenshot({path:path.join(output,'scout-workspace-desktop.png'),fullPage:true});
  await page.screenshot({path:path.join(output,'scout-workspace-desktop.jpg'),type:'jpeg',quality:58});
  await page.getByRole('button',{name:'Research',exact:true}).click();
  await page.getByRole('textbox',{name:'Company ticker',exact:true}).fill('NVDA');
  await page.getByRole('button',{name:'Explore',exact:true}).click();
  await page.getByRole('heading',{name:'NVDA example company'}).waitFor();
  await page.getByText('FY 2025 · period ended 2025-12-31').waitFor();
  await page.getByText('Related reporting',{exact:true}).click();
  const article=page.getByRole('link',{name:'Example headline: company reports annual results'});
  assert.equal(await article.getAttribute('href'),'https://example.com/article');
  await page.getByRole('button',{name:'Read with Scout',exact:true}).click();
  await page.getByText('Checked against source · [1] View source',{exact:true}).last().click();
  await page.getByRole('link',{name:'Read the publisher’s article'}).waitFor();
  assert.equal(requests.at(-1).context.symbol,'NVDA');
  assert.equal(requests.at(-1).grounded,true);
  await page.screenshot({path:path.join(output,'scout-company-desktop.png'),fullPage:true});
  await page.setViewportSize({width:320,height:900});
  const overflow = await page.evaluate(()=>({width:document.documentElement.scrollWidth,items:[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1 && getComputedStyle(el).position!=='fixed').slice(0,18).map(el=>({tag:el.tagName,cls:el.className,width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right}))}));
  if(overflow.width>320) console.log(JSON.stringify(overflow));
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:path.join(output,'scout-company-mobile.png'),fullPage:true});
  await page.screenshot({path:path.join(output,'scout-company-mobile-debug.jpg'),type:'jpeg',quality:60});
  assert(overflow.width<=320,'Company brief fits 320px');
  await page.getByRole('button',{name:'Risk check',exact:true}).click();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Scenario fits 320px');
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:path.join(output,'scout-workspace-mobile.png'),fullPage:true});
  await page.screenshot({path:path.join(output,'scout-workspace-mobile.jpg'),type:'jpeg',quality:65});
  missing=true;await page.reload();
  await page.getByRole('button',{name:'Risk check',exact:true}).click();
  await page.getByRole('heading',{name:'A scenario starts with what you own.'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Explain this with Scout'}).count(),0);
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS: ticker/range/lesson context; context opt-out; deterministic scenario handoff; source dates and article links; 320px layout; missing portfolio; no page errors. API fixtures, not live AI.');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
