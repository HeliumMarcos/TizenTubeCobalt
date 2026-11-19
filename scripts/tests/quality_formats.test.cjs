const test = require('node:test');
const assert = require('node:assert/strict');
const {catalogue, allowedFormats} = require('../quality_formats.js');
const cfg = {maxAv1BitrateMbps: '20', maxOtherBitrateMbps: '150'};
const av1 = (itag, height, rate, extra={}) => ({itag,height,width:height*16/9,fps:60,mimeType:'video/mp4; codecs="av01.0.08M.08"',averageBitrate:rate,...extra});
const vp9 = (itag,height,rate,extra={}) => ({itag,height,width:height*16/9,fps:60,mimeType:'video/webm; codecs="vp09.00.51.08"',averageBitrate:rate,...extra});
const response = (...adaptiveFormats) => ({videoDetails:{videoId:'MNsbPClRgyg'},streamingData:{adaptiveFormats}});
test('shows real resolution, HDR, FPS, average Mbps and codec',()=>{
 const r=catalogue(response(av1(701,2160,40000000,{qualityLabel:'2160p60 HDR'})),cfg,()=>true)[0];
 assert.equal(r.label,'2160p / HDR / 60 FPS / 40 Mbps / AV1');
 assert.equal(r.blocked,true);assert.equal(r.reason,'av1-bitrate-limit');
});
test('keeps AV1 1080p eligible alongside higher VP9 and blocks only over-cap AV1',()=>{
 const input=response(av1(701,2160,40000000),av1(399,1080,6000000),vp9(315,2160,60000000));
 const rows=catalogue(input,cfg,()=>true);
 assert.equal(rows.find(r=>r.itag===399).blocked,false);
 assert.equal(rows.find(r=>r.itag===315).blocked,false);
 assert.equal(rows.find(r=>r.itag===701).blocked,true);
 assert.deepEqual(allowedFormats(input,cfg,()=>true).filter(f=>f.mimeType.startsWith('video')).map(f=>f.itag).sort(),[315,399]);
});
test('automatic compares effectiveBitrate only within same resolution, fps and HDR tier',()=>{
 const input=response(av1(399,1080,8000000),vp9(303,1080,9000000),vp9(315,2160,60000000));
 assert.deepEqual(allowedFormats(input,cfg,()=>true).map(f=>f.itag).sort(),[315,399]);
 assert.equal(catalogue(input,cfg,()=>true).find(r=>r.itag===303).blocked,false);
});
test('manual choice selects the exact allowed identity and retains all audio',()=>{
 const audio={itag:251,mimeType:'audio/webm; codecs="opus"'};
 const input=response(av1(399,1080,6000000),vp9(303,1080,9000000),audio);
 const row=catalogue(input,cfg,()=>true).find(r=>r.itag===303);
 assert.deepEqual(allowedFormats(input,cfg,()=>true,row.id).map(f=>f.itag),[303,251]);
});
test('blocked or stale manual selection fails without silently choosing another track',()=>{
 const input=response(av1(701,2160,40000000),vp9(315,2160,60000000));
 const blocked=catalogue(input,cfg,()=>true).find(r=>r.itag===701);
 assert.throws(()=>allowedFormats(input,cfg,()=>true,blocked.id),/blocked/);
 assert.throws(()=>allowedFormats(input,cfg,()=>true,'missing'),/unavailable/);
});
test('peak-only metadata stays visible with unknown representative bitrate and cannot bypass a cap',()=>{
 const rows=catalogue(response(av1(1,1080,0,{bitrate:20000000}),av1(2,720,0)),cfg,()=>true);
 assert.equal(rows.find(r=>r.itag===1).bitrateKind,'unknown');assert.equal(rows.find(r=>r.itag===1).blocked,true);
 assert.equal(rows.find(r=>r.itag===1).reason,'bitrate-unknown');assert.equal(rows.find(r=>r.itag===1).bitrate,0);
 assert.equal(rows.find(r=>r.itag===2).reason,'bitrate-unknown');
});
test('detects HDR via transferCharacteristics and falls back to vp09.02 and av01 10-bit profiles',()=>{
 const rows=catalogue(response(
  vp9(1,2160,20000000,{colorInfo:{transferCharacteristics:'COLOR_TRANSFER_CHARACTERISTICS_SMPTEST2084'}}),
  vp9(2,2160,20000000,{mimeType:'video/webm; codecs="vp09.02.51.10"'}),
  av1(3,2160,20000000,{mimeType:'video/mp4; codecs="av01.0.12M.10"'}),
  av1(4,1080,6000000,{mimeType:'video/mp4; codecs="av01.0.08M.08"'})
 ),cfg,()=>true);
 assert.equal(rows.find(r=>r.itag===1).hdr,true);
 assert.equal(rows.find(r=>r.itag===2).hdr,true);
 assert.equal(rows.find(r=>r.itag===3).hdr,true);
 assert.equal(rows.find(r=>r.itag===4).hdr,false);
});
test('unsupported MIME and resolution remain visible but cannot be selected',()=>{
 const rows=catalogue(response(vp9(1,2160,20000000),vp9(2,4320,80000000)),cfg,()=>false);
 assert.equal(rows.length,2);assert.ok(rows.every(r=>r.blocked));
});
test('catalogue is sorted, excludes audio, deduplicates identities and leaves input intact',()=>{
 const f=vp9(315,2160,20000000);const input=response(av1(399,1080,6000000),f,{...f},{itag:251,mimeType:'audio/webm'});
 const before=JSON.stringify(input);const rows=catalogue(input,cfg,()=>true);
 assert.deepEqual(rows.map(r=>r.itag),[315,399]);assert.equal(JSON.stringify(input),before);
 assert.equal(JSON.stringify(rows).includes('serverAbrStreamingUrl'),false);
});

function environment(initial=response(av1(399,1080,6000000),vp9(315,2160,60000000))) {
 let id=initial.videoDetails.videoId, paused=false;const calls=[], dispatched=[];
 const video={currentTime:42,paused:false};
 const player={getVideoData:()=>({video_id:id}),getStatsForNerds:()=>({codecs:'av01 (399) / opus (251)'}),loadVideoById:x=>calls.push(['load',x]),cueVideoById:x=>calls.push(['cue',x])};
 const service={resolveCommand:e=>{dispatched.push(e);return 'dispatched'}};
 const root={document:{getElementById:()=>player,querySelector:s=>s==='video'?video:player},localStorage:{getItem:()=>JSON.stringify(cfg)},MediaSource:{isTypeSupported:()=>true},_yttv:{test:{instance:service}},setTimeout:()=>1,clearTimeout:()=>{}};
 return {root,video,player,calls,dispatched,service,navigate:next=>{id=next}};
}
test('controller retains the raw catalogue before limiting playback formats',()=>{
 const env=environment();const ctl=require('../quality_formats.js').create(env.root);
 const input=response(av1(701,2160,40000000),av1(399,1080,6000000),vp9(315,2160,60000000));
 ctl.apply(input);assert.equal(ctl.getRows().length,3);assert.equal(ctl.getRows().find(r=>r.itag===701).blocked,true);
 assert.deepEqual(input.streamingData.adaptiveFormats.map(f=>f.itag).sort(),[315,399]);
});
test('controller rejects blocked/stale selection without changing playback',()=>{
 const env=environment();const ctl=require('../quality_formats.js').create(env.root);ctl.apply(response(av1(701,2160,40000000)));
 assert.equal(ctl.select('MNsbPClRgyg',ctl.getRows()[0].id),false);assert.equal(env.calls.length,0);
 env.navigate('hCixBMdgGxI');assert.equal(ctl.select('MNsbPClRgyg',ctl.getRows()[0]?.id),false);assert.equal(env.calls.length,0);
});
test('manual track selection preserves time and pause, and clears on navigation',()=>{
 const env=environment(),ctl=require('../quality_formats.js').create(env.root);const initial=response(av1(399,1080,6000000),vp9(303,1080,9000000));ctl.apply(initial);
 const selected=ctl.getRows().find(r=>r.itag===303);env.video.paused=true;
 assert.equal(ctl.select('MNsbPClRgyg',selected.id),true);assert.equal(env.calls[0][0],'cue');assert.equal(env.calls[0][1].startSeconds,42);
 const fresh=response(av1(399,1080,6000000),vp9(303,1080,9000000));ctl.apply(fresh);assert.deepEqual(fresh.streamingData.adaptiveFormats.map(f=>f.itag),[303]);
 env.navigate('hCixBMdgGxI');const next=response(av1(399,1080,6000000));next.videoDetails.videoId='hCixBMdgGxI';ctl.apply(next);
 assert.equal(ctl.getSelection(),null);
});
test('native quality popup receives final two-line metadata in one dispatch without a DOM styling stage',()=>{
 const env=environment(),ctl=require('../quality_formats.js').create(env.root);ctl.apply(response(av1(701,2160,40000000),av1(399,1080,6000000)));ctl.installMenu();
 const popup={"openPopupAction": {"uniqueId": "quality-selector", "popupType": "MODAL", "popup": {"overlaySectionRenderer": {"overlay": {"overlayTwoPanelRenderer": {"actionPanel": {"overlayPanelRenderer": {"header": {"title": "Quality"}, "content": {"overlayPanelItemListRenderer": {"items": [], "selectedIndex": 0}}}}, "backButton": {"keep": true}}}}}}};
 assert.equal(env.service.resolveCommand(popup),'dispatched');
 const panel=env.dispatched[0].openPopupAction.popup.overlaySectionRenderer.overlay.overlayTwoPanelRenderer.actionPanel.overlayPanelRenderer;
 const items=panel.content.overlayPanelItemListRenderer.items;assert.equal(items.length,3);assert.equal(items[1].compactLinkRenderer.title.simpleText,'2160p\u200260 fps');assert.equal(items[1].compactLinkRenderer.subtitle.simpleText,'AV1\u200240 Mbps\u2002Limite 20 Mbps');assert.equal(env.dispatched.length,1);assert.deepEqual(popup.openPopupAction.popup.overlaySectionRenderer.overlay.overlayTwoPanelRenderer.actionPanel.overlayPanelRenderer.content.overlayPanelItemListRenderer.items,[]);
});

test('generated capability hook does not hide all AV1 when its bitrate cap is 20 Mbps',async()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tt-quality-'));
 try {
  const output=path.join(temp,'u.js');
  require('node:child_process').execFileSync('python',[path.join(__dirname,'../build_u_js.py'),'--variant','main','--output',output]);
  const check=require('node:child_process').spawnSync(process.execPath,['--check',output],{encoding:'utf8'}); assert.equal(check.status,0,(check.stderr||'').slice(-300));
  const js=fs.readFileSync(output,'utf8'),header=js.slice(0,js.indexOf('})();')+5);
  const root={localStorage:{getItem:()=>JSON.stringify(cfg)},MediaSource:{isTypeSupported:()=>true},navigator:{mediaCapabilities:{decodingInfo:async()=>({supported:true,smooth:true,powerEfficient:true})}}};root.window=root;
  vm.runInNewContext(header,root);
  assert.equal(root.MediaSource.isTypeSupported('video/mp4; codecs="av01.0.08M.08"'),true);
  assert.equal((await root.navigator.mediaCapabilities.decodingInfo({video:{contentType:'video/mp4; codecs="av01.0.08M.08"',height:1080,bitrate:6000000}})).supported,true);
 } finally { for (const entry of fs.readdirSync(temp)) fs.unlinkSync(path.join(temp,entry)); fs.rmdirSync(temp); }
});

test('fresh non-SABR metadata cannot inherit old signed formats when its list shrinks',()=>{
 const env=environment(),ctl=require('../quality_formats.js').create(env.root);
 ctl.apply(response(vp9(1,2160,18000000,{url:'https://example.test/old1'}),vp9(2,1080,6000000,{url:'https://example.test/old2'})));
 const fresh=response(vp9(3,1080,5000000,{url:'https://example.test/new'}));ctl.apply(fresh);
 assert.deepEqual(fresh.streamingData.adaptiveFormats.map(f=>f.itag),[3]);assert.equal(fresh.streamingData.adaptiveFormats[0].url,'https://example.test/new');
});
test('re-parsing a filtered response keeps blocked rows in its own original catalogue',()=>{
 const env=environment(),ctl=require('../quality_formats.js').create(env.root),input=response(av1(701,2160,40000000),av1(399,1080,6000000));
 ctl.apply(input);const parsedAgain=JSON.parse(JSON.stringify(input));ctl.apply(parsedAgain);
 assert.equal(ctl.getRows().length,2);assert.equal(ctl.getRows().find(r=>r.itag===701).blocked,true);
});
test('explicit codec preference is respected while default automatic uses effectiveBitrate',()=>{
 const input=response(av1(399,1080,6000000),vp9(303,1080,9000000));
 assert.deepEqual(allowedFormats(input,{...cfg,preferredVideoCodec:'vp9'},()=>true).map(f=>f.itag),[303]);
 // VP9 9*1.35=12.15 > AV1 6*1.70=10.20 -> VP9 wins on effectiveBitrate!
 assert.deepEqual(allowedFormats(input,cfg,()=>true).map(f=>f.itag),[303]);
 // AV1 15*1.70=25.50 > VP9 18*1.35=24.30 -> AV1 wins on effectiveBitrate!
 const vod4k=response(av1(701,2160,15000000,{mimeType:'video/mp4; codecs="av01.0.13M.10"'}),vp9(337,2160,18000000,{mimeType:'video/webm; codecs="vp09.02.51.10"'}));
 assert.deepEqual(allowedFormats(vod4k,{maxAv1BitrateMbps:'100',maxOtherBitrateMbps:'150'},()=>true).map(f=>f.itag),[701]);
 // VOD 1080p Premium vs standard (same codec, higher bitrate wins)
 const vod1080=response(vp9(356,1080,4500000,{fps:30}),vp9(248,1080,1800000,{fps:30}));
 assert.deepEqual(allowedFormats(vod1080,cfg,()=>true).map(f=>f.itag),[356]);
});

test('clean presentation uses two concise lines with localized bitrate and a short limit status',()=>{
 const api=require('../quality_formats.js');const row=catalogue(response(av1(701,2160,27970000,{qualityLabel:'2160p60 HDR'})),cfg,()=>true)[0];
 const display=api.present(row);assert.equal(display.title,'2160p\u2002HDR\u200260 fps');
 assert.equal(display.subtitle,'AV1\u200227,97 Mbps');assert.equal(display.status,'Limite 20 Mbps');
 assert.equal(display.title.includes('/'),false);assert.equal(display.subtitle.includes('/'),false);
});
test('available and unsupported clean rows contain no explanatory paragraphs',()=>{
 const api=require('../quality_formats.js');const input=response(vp9(315,2160,18640000));
 const allowed=api.present(catalogue(input,cfg,()=>true)[0]);assert.equal(allowed.status,'');assert.equal(allowed.title,'2160p\u200260 fps');assert.equal(allowed.subtitle,'VP9\u200218,64 Mbps');
 const blocked=api.present(catalogue(input,cfg,()=>false)[0]);assert.equal(blocked.status,'Indisponível');
});

test('a codec change retains requested time and pause intent while the new video element reports zero',()=>{
 const env=environment(),api=require('../quality_formats.js'),ctl=api.create(env.root);let state=1;
 env.player.getCurrentTime=()=>env.video.currentTime;env.player.getPlayerState=()=>state;
 ctl.apply(response(av1(399,1080,6000000),vp9(315,2160,18000000)));const row=ctl.getRows().find(r=>r.itag===315);
 assert.equal(ctl.select('MNsbPClRgyg',row.id),true);env.video.currentTime=0;env.video.paused=true;state=3;
 assert.deepEqual(ctl.getPlaybackIntent('MNsbPClRgyg'),{time:42,paused:false});
 env.video.currentTime=44;env.video.paused=false;state=1;assert.equal(ctl.getPlaybackIntent('MNsbPClRgyg'),null);
});

test('generated capability calls clamp synthetic peak bitrate probes and normalize vp9.2 while preserving result fields',async()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tt-capability-'));
 try{
 const out=path.join(tmp,'u.js');require('node:child_process').execFileSync('python',[path.join(__dirname,'../build_u_js.py'),'--variant','main','--output',out]);const js=fs.readFileSync(out,'utf8');
 const calls=[],result={supported:true,smooth:false,powerEfficient:false,extra:'preserved'};
 const root={MediaSource:{isTypeSupported:m=>{calls.push(m);return true}},navigator:{mediaCapabilities:{decodingInfo:async c=>{calls.push(c);return result}}}};root.window=root;
 vm.runInNewContext(js.slice(0,js.indexOf('})();')+5),root);
 const mime='video/webm; codecs="vp9.2"; bitrate=120000000';root.MediaSource.isTypeSupported(mime);
 assert.equal(calls[0],'video/webm; codecs="vp09.02.51.10.01.09.16.09.00"; bitrate=35000000');
 const probe='video/mp4; codecs="av01.0.12M.10"; bitrate=2000000000';root.MediaSource.isTypeSupported(probe);
 assert.equal(calls[1],probe);
 const query={video:{contentType:'video/mp4; codecs="av01"',bitrate:90000000}};
 assert.equal(await root.navigator.mediaCapabilities.decodingInfo(query),result);
 assert.equal(calls[2].video.bitrate,35000000);
 assert.match(js,/maxAv1BitrateMbps:"40",maxOtherBitrateMbps:"100"/);assert.doesNotMatch(js,/smooth: true/);
 }finally{for(const f of fs.readdirSync(tmp))fs.unlinkSync(path.join(tmp,f));fs.rmdirSync(tmp)}
});

test('controller merges supplemental VP9 formats into getRows and normalizes vp9.2 in allowedFormats',()=>{
 const env=environment(),api=require('../quality_formats.js');
 env.root.MediaSource.isTypeSupported=m=>!/\bvp9\.2\b/i.test(m);
 env.root.__ttVp9Fallback={getSupplementalResponse:vid=>vid==='MNsbPClRgyg'?response(
  vp9(337,2160,24880000,{mimeType:'video/webm; codecs="vp9.2"',colorInfo:{transferCharacteristics:'COLOR_TRANSFER_CHARACTERISTICS_SMPTEST2084'}}),
  vp9(313,2160,18000000,{fps:30}),
  vp9(271,1440,8930000,{fps:30})
 ):null};
 const ctl=api.create(env.root);
 const tvInput=response(av1(701,2160,18000000,{fps:30}),av1(700,1440,9000000,{fps:30}));
 ctl.apply(tvInput);
 const rows=ctl.getRows();
 assert.deepEqual(rows.map(r=>[r.height,r.codec,r.hdr,r.itag,r.blocked,r.needsWeb]),[
  [2160,'VP9',true,337,false,true],
  [2160,'AV1',false,701,false,false],
  [2160,'VP9',false,313,false,true],
  [1440,'AV1',false,700,false,false],
  [1440,'VP9',false,271,false,true]
 ]);
 const vp9HdrRow=rows.find(r=>r.itag===337);
 assert.equal(ctl.select('MNsbPClRgyg',vp9HdrRow.id),true);
 assert.equal(ctl.getSelection().needsWeb,true);
 assert.equal(ctl.getSelection().itag,337);
 const webInput=env.root.__ttVp9Fallback.getSupplementalResponse('MNsbPClRgyg');
 webInput.__ttVp9FallbackApplied=true;
 ctl.apply(webInput);
 assert.equal(webInput.streamingData.adaptiveFormats.length,1);
 assert.equal(webInput.streamingData.adaptiveFormats[0].itag,337);
 assert.match(webInput.streamingData.adaptiveFormats[0].mimeType,/vp09\.02\.51\.10\.01\.09\.16\.09\.00/);
});

test('live streams with only peak bitrate select highest effectiveBitrate (AVC 6.5 > VP9 3.48)',()=>{
 const liveInput={videoDetails:{videoId:'9B48Zrg5s18',isLive:true,isLiveContent:true},streamingData:{adaptiveFormats:[
  {itag:303,height:1080,width:1920,fps:60,mimeType:'video/webm; codecs="vp9"',bitrate:3480000},
  {itag:299,height:1080,width:1920,fps:60,mimeType:'video/mp4; codecs="avc1.64002a"',bitrate:6500000},
  {itag:140,mimeType:'audio/mp4; codecs="mp4a.40.2"',bitrate:128000}
 ]}};
 const rows=catalogue(liveInput,cfg,()=>true);
 assert.equal(rows.length,2);
 assert.equal(rows[0].blocked,false);
 assert.equal(rows[0].bitrateKind,'liveBitrate');
 const allowed=allowedFormats(liveInput,cfg,()=>true);
 // Live 1080p60: AVC 6.50 * 1.00 = 6.50 > VP9 3.48 * 1.25 = 4.35
 assert.deepEqual(allowed.map(f=>f.itag).sort((a,b)=>a-b),[140,299]);
});

test('quality menu marks the currently playing track with CHECK and updates immediately when switched during playback',()=>{
 const env=environment(),ctl=require('../quality_formats.js').create(env.root);
 ctl.apply(response(av1(701,2160,18000000),av1(399,1080,6000000),vp9(303,1080,9000000)));
 ctl.installMenu();
 const makePopup=()=>({"openPopupAction":{"uniqueId":"quality-selector","popupType":"MODAL","popup":{"overlaySectionRenderer":{"overlay":{"overlayTwoPanelRenderer":{"actionPanel":{"overlayPanelRenderer":{"header":{"title":"Quality"},"content":{"overlayPanelItemListRenderer":{"items":[],"selectedIndex":0}}}},"backButton":{"keep":true}}}}}}});
 env.service.resolveCommand(makePopup());
 let list=env.dispatched[0].openPopupAction.popup.overlaySectionRenderer.overlay.overlayTwoPanelRenderer.actionPanel.overlayPanelRenderer.content.overlayPanelItemListRenderer;
 assert.equal(list.items[0].compactLinkRenderer.secondaryIcon.iconType,'CHECK');
 assert.equal(list.items[2].compactLinkRenderer.secondaryIcon.iconType,'CHECK');
 assert.equal(list.selectedIndex,2);
 // Switch manually to itag 303 while getStatsForNerds still temporarily reports 399
 const row303=ctl.getRows().find(r=>r.itag===303);
 assert.equal(ctl.select('MNsbPClRgyg',row303.id),true);
 env.service.resolveCommand(makePopup());
 list=env.dispatched[1].openPopupAction.popup.overlaySectionRenderer.overlay.overlayTwoPanelRenderer.actionPanel.overlayPanelRenderer.content.overlayPanelItemListRenderer;
 assert.equal(list.items[0].compactLinkRenderer.secondaryIcon,undefined);
 assert.equal(list.items[2].compactLinkRenderer.secondaryIcon,undefined);
 assert.equal(list.items[3].compactLinkRenderer.secondaryIcon.iconType,'CHECK');
 assert.equal(list.selectedIndex,3);
});
