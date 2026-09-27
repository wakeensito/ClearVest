const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const base = process.env.CLEARVEST_PREVIEW_URL || 'http://127.0.0.1:5173';
const output = path.resolve(__dirname,'../node_modules/.cache/clearvest-review');
const contract = yaml.load(fs.readFileSync(path.resolve(__dirname,'../../docs/api/openapi.yaml'),'utf8'));
const saved = '2026-09-27T12:00:00Z';
const holdings = {asOf:saved,totalValue:10000,holdings:[
  {symbol:'VTI',name:'Fund A (fixture)',type:'etf',value:4000,weight:.4,quantity:40,price:100},
  {symbol:'VOO',name:'Fund B (fixture)',type:'etf',value:3000,weight:.3,quantity:30,price:100},
  {symbol:'AAPL',name:'Apple (fixture)',type:'equity',value:1000,weight:.1,quantity:10,price:100},
  {symbol:'CASH',name:'Cash',type:'cash',value:2000,weight:.2,quantity:2000,price:1},
]};
const sourceUrl='https://site.financialmodelingprep.com/developer/docs/stable/holdings';
function exposure(unavailable) {
  const direct={via:null,value:1000,weightPct:10,fundWeightPct:null};
  return {asOf:saved,totalValue:10000,status:'ready',mappedPct:unavailable?30:52.5,unmappedValue:unavailable?7000:4750,cashValue:2000,overlapCount:unavailable?0:2,
    exposures:[{symbol:'AAPL',name:'Apple (fixture)',value:unavailable?1000:1550,weightPct:unavailable?10:15.5,directValue:1000,fundValue:unavailable?0:550,overlap:!unavailable,paths:unavailable?[direct]:[direct,{via:'VTI',value:400,weightPct:4,fundWeightPct:10},{via:'VOO',value:150,weightPct:1.5,fundWeightPct:5}]},
      ...unavailable?[]:[{symbol:'MSFT',name:'Microsoft (fixture)',value:1700,weightPct:17,directValue:0,fundValue:1700,overlap:true,paths:[{via:'VTI',value:800,weightPct:8,fundWeightPct:20},{via:'VOO',value:900,weightPct:9,fundWeightPct:30}]}]],
    funds:['VTI','VOO'].map((symbol,i)=>({symbol,status:unavailable?'unavailable':'partial',positionValue:i?3000:4000,coveragePct:unavailable?0:i?35:30,providerUpdatedAt:unavailable?null:'2026-09-27',fetchedAt:unavailable?null:saved,sourceUrl}))};
}
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
 try {
  const context=await browser.newContext({viewport:{width:1440,height:1050}});
  let mode='ready', holdSources=true;
  const pending=[],requests=[],errors=[];
  await context.route('http://127.0.0.1:4010/**',async route=>{
    const request=route.request(),url=new URL(request.url());requests.push({path:url.pathname,body:request.postDataJSON(),symbol:url.searchParams.get('symbol')});
    let status=200,body=structuredClone(contract.paths[url.pathname]?.[request.method().toLowerCase()]?.responses?.['200']?.content?.['application/json']?.example||{});
    if(url.pathname==='/portfolio/holdings') {
      body=holdings;
      if(mode==='unlinked'){status=409;body={error:{code:'NOT_LINKED',message:'No account'}}}
      if(mode==='outage'){status=502;body={error:{code:'UPSTREAM_UNAVAILABLE',message:'Unavailable'}}}
    }
    if(url.pathname==='/market/fund-holdings') {
      if(holdSources)await new Promise(resolve=>pending.push(resolve));
      const symbol=url.searchParams.get('symbol');
      body={symbol,provider:'FMP',providerUpdatedAt:'2026-09-27',fetchedAt:saved,sourceUrl,coveragePct:symbol==='VTI'?30:35,holdings:[],stale:false};
      if(mode==='missing'){status=502;body={error:{code:'UPSTREAM_UNAVAILABLE',message:'Unavailable'}}}
    }
    if(url.pathname==='/portfolio/exposure')body=exposure(mode==='missing');
    if(url.pathname==='/advisor/chat') {
      const q=request.postDataJSON();
      body={reply:'Your mapped Apple exposure is 15.5%: $1,000 directly, $400 through VTI, and $150 through VOO. The unmapped part is unknown. [1]',userMessage:q.message,disclaimer:'Educational information, not financial advice.',safety:{status:'passed',grounding:'checked'},sources:[{kind:'exposure',label:'Calculated ownership and fund overlap',asOf:saved,text:'Synthetic test source: AAPL 1550 / 10000 = 15.5%; 4750 unmapped. FMP provider update 2026-09-27.'}]};
    }
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/advisor');
  await page.getByRole('region',{name:'Conversation with Scout'}).waitFor();
  await page.getByRole('complementary',{name:'What the advisor sees'}).getByRole('meter').waitFor();
  const conversation=page.getByRole('region',{name:'Conversation with Scout'});
  const rail=page.getByRole('complementary',{name:'What the advisor sees'});
  const conversationBox=await conversation.boundingBox(), railBox=await rail.boundingBox();
  assert(conversationBox.x+conversationBox.width<=railBox.x,'Conversation is left of the context card');
  await page.getByRole('button',{name:'Explain my portfolio',exact:true}).click();
  assert.equal(await page.getByRole('textbox',{name:'Your question',exact:true}).inputValue(),'Explain my portfolio in plain language.');
  assert(!requests.some(r=>r.path==='/advisor/chat'),'Starter questions are editable before sending');
  await page.getByRole('textbox',{name:'Your question',exact:true}).fill('');
  fs.mkdirSync(output,{recursive:true});
  await page.screenshot({path:path.join(output,'advisor-restored-desktop.png'),fullPage:true});
  await page.getByRole('button',{name:'What I own',exact:true}).click();
  await page.getByText('Looking inside your funds…',{exact:true}).waitFor();
  for(let tries=0;pending.length<2 && tries<500;tries++)await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(pending.length,2,'Both owned funds start loading');
  assert(!requests.some(r=>r.path==='/portfolio/exposure'),'Exposure waits for public sources to finish');
  holdSources=false;pending.forEach(resolve=>resolve());
  await page.getByRole('heading',{name:'What do I really own?',exact:true}).waitFor();
  assert.deepEqual(requests.filter(r=>r.path==='/market/fund-holdings').map(r=>r.symbol).sort(),['VOO','VTI']);
  assert.equal(await page.getByRole('region',{name:'Conversation with Scout'}).count(),0,'No empty conversation panel on arrival');
  assert.equal(await page.getByText('Your investing context',{exact:true}).count(),1,'Investing context stays available alongside the tools');
  await page.getByText('52.5% mapped · $4,750.00 unmapped',{exact:true}).waitFor();
  const apple=page.locator('details').filter({has:page.locator('summary[aria-label="AAPL, 15.50% exposure, overlapping holdings"]')});
  await apple.locator('summary').focus();await page.keyboard.press('Enter');
  assert(await apple.evaluate(el=>el.open),'Breakdown is keyboard accessible');
  await apple.getByText('Through VTI',{exact:false}).waitFor();
  await apple.getByText('Through VOO',{exact:false}).waitFor();
  await apple.getByText('$400.00',{exact:false}).waitFor();
  await apple.getByText('$150.00',{exact:false}).waitFor();
  await apple.getByText('10.00% of that fund',{exact:true}).waitFor();
  const coverage=page.locator('details').filter({has:page.locator('summary').filter({hasText:'Sources & limits'})});
  assert(!await coverage.evaluate(el=>el.open),'Sources are collapsed by default');
  await coverage.locator('summary').click();
  await coverage.getByText('VTI · 30.0% mapped',{exact:true}).waitFor();
  await coverage.getByText('VOO · 35.0% mapped',{exact:true}).waitFor();
  assert.equal(await coverage.getByRole('link',{name:'About the fund data'}).getAttribute('href'),sourceUrl);
  await coverage.locator('summary').click();
  await page.getByRole('button',{name:'Overlaps 2',exact:true}).click();
  assert.equal(await page.locator('summary[aria-label$="overlapping holdings"]').count(),2);
  fs.mkdirSync(output,{recursive:true});
  await page.screenshot({path:path.join(output,'scout-ownership-desktop.png'),fullPage:true});
  await page.screenshot({path:path.join(output,'scout-ownership-desktop.jpg'),type:'jpeg',quality:68});
  await apple.getByRole('button',{name:'Ask Scout about AAPL',exact:true}).click();
  await page.getByText('Your mapped Apple exposure is 15.5%',{exact:false}).waitFor();
  const turn=requests.filter(r=>r.path==='/advisor/chat').at(-1).body;
  assert.deepEqual(turn.context,{page:'advisor',metric:'exposure',symbol:'AAPL'});
  assert.equal(turn.grounded,true);
  assert(!('weights' in turn),'Client only sends the selection, not trusted calculations');
  await page.getByText('Checked against source · [1] View source',{exact:true}).click();
  await page.getByText('Synthetic test source:',{exact:false}).waitFor();
  await page.screenshot({path:path.join(output,'scout-ownership-chat-desktop.jpg'),type:'jpeg',quality:68});
  await page.getByRole('button',{name:'Make it simpler',exact:true}).click();
  assert.equal(await page.getByRole('textbox',{name:'Your question',exact:true}).inputValue(),'Can you explain that more simply?');
  assert.equal(requests.filter(r=>r.path==='/advisor/chat').length,1,'Follow-ups do not auto-send');
  await page.setViewportSize({width:320,height:900});
  await page.screenshot({path:path.join(output,'advisor-restored-mobile.png'),fullPage:true});
  assert(!await page.getByRole('heading',{name:'What do I really own?'}).isVisible(),'Phone focuses on the open conversation');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Conversation fits 320px');
  await page.getByRole('button',{name:'Close conversation',exact:true}).click();
  await page.getByRole('heading',{name:'What do I really own?'}).waitFor();
  assert.equal(await page.getByRole('textbox',{name:'Your question',exact:true}).inputValue(),'Can you explain that more simply?','Returning to a tool preserves the draft');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Ownership and expanded breakdown fit 320px');
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:path.join(output,'scout-ownership-mobile.png'),fullPage:true});
  await page.screenshot({path:path.join(output,'scout-ownership-mobile.jpg'),type:'jpeg',quality:72,fullPage:true});
  await page.getByRole('button',{name:'Risk check',exact:true}).click();
  await page.getByRole('heading',{name:'What if one holding falls?',exact:true}).waitFor();
  await page.getByRole('slider',{name:'Hypothetical price drop'}).fill('35');
  await page.getByRole('textbox',{name:'Your question',exact:true}).fill('What does this scenario mean?');
  const scenarioReply=page.waitForResponse(response=>new URL(response.url()).pathname==='/advisor/chat');
  await page.getByRole('button',{name:'Send',exact:true}).click();
  await scenarioReply;
  await page.getByRole('region',{name:'Conversation with Scout'}).waitFor();
  assert.deepEqual(requests.filter(r=>r.path==='/advisor/chat').at(-1).body.context,{page:'advisor',scenario:{symbol:'VTI',dropPct:35}},'Switching tools drops old pinned ownership context');
  await page.getByRole('button',{name:'Research',exact:true}).click();
  await page.getByRole('heading',{name:'Explore a company.',exact:true}).waitFor();
  await page.getByRole('button',{name:'What I own',exact:true}).click();
  mode='missing';await page.reload();
  await page.getByRole('button',{name:'What I own',exact:true}).click();
  await page.getByText('30.0% mapped · $7,000.00 unmapped',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Overlaps 0',exact:true}).click();
  await page.getByText('No overlap in the holdings we could map.',{exact:true}).waitFor();
  await page.getByText('Sources & limits',{exact:false}).click();
  await page.getByText('VTI · Holdings unavailable',{exact:true}).waitFor();
  mode='unlinked';await page.reload();
  await page.getByRole('button',{name:'What I own',exact:true}).click();
  await page.getByRole('heading',{name:'Start with your portfolio.',exact:true}).waitFor();
  mode='outage';await page.reload();
  await page.getByRole('button',{name:'What I own',exact:true}).click();
  await page.getByRole('heading',{name:'We couldn’t load your portfolio.',exact:true}).waitFor();
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS: bounded fund loads before exposure, direct + fund breakdown, incomplete coverage, overlap filter, keyboard access, server context, source receipt, simple Advisor navigation, 320px layouts, missing/unlinked/outage states. Synthetic API fixtures, not live holdings.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
