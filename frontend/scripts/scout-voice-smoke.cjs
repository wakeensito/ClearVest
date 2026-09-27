// Synthetic microphone + mocked API/audio player: no real recordings or provider calls.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const base = process.env.CLEARVEST_PREVIEW_URL || 'http://127.0.0.1:5173';
const contract = yaml.load(fs.readFileSync(path.resolve(__dirname,'../../docs/api/openapi.yaml'),'utf8'));
const output = path.resolve(__dirname,'../node_modules/.cache/clearvest-review');
(async()=>{
 const browser = await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL || 'chrome',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 try {
  const context = await browser.newContext({viewport:{width:1440,height:1050},permissions:['microphone']});
  await context.addInitScript(()=>{
   const nativeMic = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
   window.voiceTest={streams:[],audios:[],denyMic:false,holdMic:false,failPlay:false};
   navigator.mediaDevices.getUserMedia=async options=>{
    if(window.voiceTest.denyMic) throw new DOMException('Denied','NotAllowedError');
    if(window.voiceTest.holdMic) await new Promise(resolve=>window.voiceTest.releaseMic=resolve);
    const stream=await nativeMic(options);window.voiceTest.streams.push(stream);return stream;
   };
   window.Audio=class {
    constructor(url){this.url=url;this.paused=true;window.voiceTest.audios.push(this)}
    play(){if(window.voiceTest.failPlay)return Promise.reject(new DOMException('Autoplay blocked','NotAllowedError'));this.paused=false;return Promise.resolve()}
    pause(){this.paused=true}
   };
  });
  const requests=[],errors=[];
  let heldTurn, holdTurn=false, empty=false, ttsFail=false, holdSpeak=false, heldSpeak;
  await context.route('https://voice-fixture.example/upload',route=>route.fulfill({status:200,body:''}));
  await context.route('http://127.0.0.1:4010/**',async route=>{
   const request=route.request(), url=new URL(request.url());
   let body=structuredClone(contract.paths[url.pathname]?.[request.method().toLowerCase()]?.responses?.['200']?.content?.['application/json']?.example || {}),status=200;
   if(request.method()==='POST')requests.push({path:url.pathname,body:request.postDataJSON()});
   if(url.pathname==='/voice/upload-url')body={uploadUrl:'https://voice-fixture.example/upload',key:'audio/in/fixture/recording',expiresIn:900};
   if(url.pathname==='/voice/turn'){
    if(holdTurn)await new Promise(resolve=>heldTurn=resolve);
    if(empty){status=400;body={error:{code:'VALIDATION',message:"I didn't catch that. Try recording again."}}}
    else body={transcript:'Explain the company I am viewing.',reply:'Scout voice answer: the selected company is research context, not necessarily a holding.',disclaimer:'Educational information, not financial advice.',safety:{status:'passed',grounding:'not_requested'},sources:[{kind:'company',label:'Example company source',asOf:'2026-09-26',text:'Browser test source.'}]};
   }
   if(url.pathname==='/voice/speak'){
    if(holdSpeak)await new Promise(resolve=>heldSpeak=resolve);
    if(ttsFail){status=502;body={error:{code:'UPSTREAM_UNAVAILABLE',message:'Voice provider unavailable'}}}
    else body={audioUrl:'https://voice-fixture.example/reply.mp3',expiresIn:900};
   }
   if(url.pathname==='/advisor/chat')body={reply:'A typed answer can be spoken too. [1]',userMessage:request.postDataJSON().message,disclaimer:'Educational information, not financial advice.',safety:{status:'passed',grounding:'not_requested'}};
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const count=path=>requests.filter(r=>r.path===path).length;
  const record=async scope=>{
   await scope.getByRole('button',{name:'Ask by voice',exact:true}).click();
   await scope.getByRole('button',{name:'Stop recording',exact:true}).waitFor();
   await page.waitForTimeout(200); // Produce a nonempty synthetic MediaRecorder blob.
  };
  await page.goto(base+'/markets?symbol=NVDA&range=5y');
  await page.getByRole('complementary',{name:'Scout companion'}).getByRole('button',{name:'Ask Scout',exact:true}).click();
  let panel=page.getByRole('dialog',{name:'Ask Scout'});
  await panel.getByRole('textbox').fill('Keep my typed draft');
  holdTurn=true;
  await record(panel);
  assert(await panel.getByRole('button',{name:'Send to Scout'}).isDisabled(),'Recording owns the shared turn');
  await panel.getByRole('button',{name:'Stop recording',exact:true}).click();
  await panel.getByRole('button',{name:'Scout is thinking',exact:true}).waitFor();
  assert.deepEqual(requests.find(r=>r.path==='/voice/turn').body.context,{page:'markets',symbol:'NVDA',range:'5y'});
  await panel.getByRole('link',{name:'Open full Advisor'}).click();
  await page.getByRole('button',{name:'Scout is thinking',exact:true}).waitFor();
  assert(await page.getByRole('button',{name:'Send',exact:true}).isDisabled(),'Navigation cannot start a competing text request');
  heldTurn();holdTurn=false;
  await page.getByText('Scout voice answer:',{exact:false}).waitFor();
  await page.getByRole('button',{name:'Pause playback',exact:true}).waitFor();
  assert.equal(await page.getByRole('textbox',{name:'Your question',exact:true}).inputValue(),'Keep my typed draft');
  assert(await page.evaluate(()=>window.voiceTest.streams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))));
  await page.getByRole('button',{name:'Pause playback',exact:true}).click();
  await page.getByRole('button',{name:'Resume playback',exact:true}).click();
  const before=count('/voice/speak');
  await page.getByRole('navigation',{name:'Primary'}).first().getByRole('link',{name:'Markets',exact:true}).click();
  await page.getByRole('complementary',{name:'Scout companion'}).getByRole('button',{name:'Ask Scout',exact:true}).click();
  await panel.getByRole('button',{name:'Pause playback',exact:true}).waitFor();
  assert.equal(count('/voice/speak'),before,'Moving between surfaces does not synthesize twice');
  await panel.getByRole('button',{name:'Stop audio',exact:true}).click();
  await panel.getByRole('button',{name:'Listen to reply',exact:true}).click();
  await panel.getByRole('button',{name:'Pause playback',exact:true}).waitFor();
  assert.equal(count('/voice/speak'),before,'Replay reuses the unexpired audio in memory');
  await panel.getByRole('button',{name:'Stop audio',exact:true}).click();

  // Cancellation must discard audio, release the mic and unlock text.
  const uploads=count('/voice/upload-url');
  await record(panel);
  fs.mkdirSync(output,{recursive:true});
  await page.screenshot({path:path.join(output,'scout-voice-desktop.jpg'),type:'jpeg',quality:65});
  await panel.getByRole('button',{name:'Close Scout',exact:true}).click();
  assert.equal(count('/voice/upload-url'),uploads);
  assert(await page.evaluate(()=>window.voiceTest.streams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))));
  await page.getByRole('complementary',{name:'Scout companion'}).getByRole('button',{name:'Ask Scout',exact:true}).click();
  assert.equal(await panel.getByRole('textbox').inputValue(),'Keep my typed draft');
  await panel.getByRole('textbox').fill('Explain risk');await panel.getByRole('textbox').press('Enter');
  await panel.getByText('A typed answer can be spoken too.',{exact:false}).waitFor();
  await panel.getByRole('button',{name:'Listen to reply',exact:true}).last().click();
  await panel.getByRole('button',{name:'Pause playback',exact:true}).waitFor();
  assert.equal(requests.filter(r=>r.path==='/voice/speak').at(-1).body.text,'A typed answer can be spoken too. [1]');
  await panel.getByRole('button',{name:'Stop audio',exact:true}).click();

  // Page-sharing opt-out applies to spoken questions; empty speech is recoverable.
  await panel.getByRole('switch',{name:'Use page details'}).click();
  empty=true;await record(panel);await panel.getByRole('button',{name:'Stop recording',exact:true}).click();
  await panel.getByText("Didn't catch that.",{exact:false}).waitFor();
  assert.equal(requests.filter(r=>r.path==='/voice/turn').at(-1).body.context,undefined);
  empty=false;

  // Denied permission and permission resolved after closing cannot leave a live mic.
  await page.evaluate(()=>window.voiceTest.denyMic=true);
  await panel.getByRole('button',{name:'Ask by voice',exact:true}).click();
  await panel.getByText('Microphone access is off.',{exact:false}).waitFor();
  assert.equal(await page.evaluate(()=>document.activeElement.id),'scout-question');
  await page.evaluate(()=>{window.voiceTest.denyMic=false;window.voiceTest.holdMic=true});
  await panel.getByRole('button',{name:'Ask by voice',exact:true}).click();
  await panel.getByRole('button',{name:'Waiting for microphone access'}).waitFor();
  await panel.getByRole('button',{name:'Close Scout',exact:true}).click();
  const streamCount=await page.evaluate(()=>window.voiceTest.streams.length);
  await page.evaluate(()=>window.voiceTest.releaseMic());
  await page.waitForFunction(count=>window.voiceTest.streams.length>count && window.voiceTest.streams.every(s=>s.getTracks().every(t=>t.readyState==='ended')),streamCount);
  await page.evaluate(()=>window.voiceTest.holdMic=false);

  // A failed TTS request leaves the successful text answer in the thread.
  await page.getByRole('complementary',{name:'Scout companion'}).getByRole('button',{name:'Ask Scout',exact:true}).click();
  ttsFail=true;await record(panel);await panel.getByRole('button',{name:'Stop recording',exact:true}).click();
  await panel.getByText("Couldn't play the reply.",{exact:false}).waitFor();
  assert(await panel.getByText('Scout voice answer:',{exact:false}).count()>=2);
  ttsFail=false;
  await panel.getByRole('button',{name:'Listen to reply',exact:true}).last().click();
  await panel.getByRole('button',{name:'Pause playback',exact:true}).waitFor();
  await panel.getByRole('button',{name:'Stop audio',exact:true}).click();
  await page.evaluate(()=>window.voiceTest.failPlay=true);
  await panel.getByRole('button',{name:'Listen to reply',exact:true}).last().click();
  await panel.getByText("Couldn't play the reply.",{exact:false}).waitFor();
  await page.evaluate(()=>window.voiceTest.failPlay=false);

  // Stop during delayed synthesis must suppress audio once the request eventually returns.
  holdSpeak=true;
  await panel.getByRole('button',{name:'Listen to reply',exact:true}).first().click();
  // The earlier voice answer is cached; use the distinct typed answer for this delayed request.
  if(await panel.getByRole('button',{name:'Pause playback',exact:true}).count())await panel.getByRole('button',{name:'Stop audio',exact:true}).click();
  await panel.getByRole('button',{name:'Listen to reply',exact:true}).nth(1).click();
  await panel.getByRole('button',{name:'Preparing Scout’s voice',exact:true}).waitFor();
  const players=await page.evaluate(()=>window.voiceTest.audios.length);
  await panel.getByRole('button',{name:'Stop audio',exact:true}).click();heldSpeak();holdSpeak=false;
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>window.voiceTest.audios.length),players);

  await page.setViewportSize({width:320,height:850});
  await record(panel);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const box=await panel.getByRole('button',{name:'Stop recording',exact:true}).boundingBox();
  assert(box.x>=0 && box.x+box.width<=320 && box.y+box.height<850);
  await page.screenshot({path:path.join(output,'scout-voice-mobile.jpg'),type:'jpeg',quality:65});
  await panel.getByRole('button',{name:'Cancel recording',exact:true}).click();
  await panel.getByRole('link',{name:'Open full Advisor'}).click();
  await page.getByRole('button',{name:'Research',exact:true}).click();
  await page.getByRole('textbox',{name:'Company ticker',exact:true}).fill('MSFT');
  await page.getByRole('button',{name:'Explore',exact:true}).click();
  await record(page);
  await page.getByRole('button',{name:'Stop recording',exact:true}).click();
  await page.getByRole('button',{name:'Pause playback',exact:true}).waitFor();
  assert.deepEqual(requests.filter(r=>r.path==='/voice/turn').at(-1).body.context,{page:'advisor',symbol:'MSFT'});
  await page.getByRole('button',{name:'Stop audio',exact:true}).click();
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS: shared Scout/Advisor recording, context, turn exclusion, navigation, playback/replay, typed-answer speech, cancellation, opt-out, denied/late permission, empty speech, TTS/autoplay failure and 320px controls. Synthetic audio and API fixtures only.');
 } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
