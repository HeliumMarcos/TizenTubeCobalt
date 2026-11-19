const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {webcrypto} = require('node:crypto');
const file = path.join(__dirname, '..', 'vp9_fallback.js');
const api = fs.existsSync(file) ? require(file) : {};
const bytes = (...values) => new Uint8Array(values);
const id = 'MNsbPClRgyg';
const format = (codec, height, bitrate = 18000000) => ({mimeType: `video/webm; codecs="${codec}"`, height, width: height * 16 / 9, fps: 60, averageBitrate: bitrate});
const response = () => ({videoDetails: {videoId: id, isLiveContent: false}, streamingData: {adaptiveFormats: [format('av01', 2160, 28000000), format('avc1', 1080)]}});
const alternate = () => ({playabilityStatus: {status: 'OK'}, videoDetails: {videoId: id}, streamingData: {serverAbrStreamingUrl: 'https://rr1.googlevideo.com/videoplayback?sabr=1&id=stream1', adaptiveFormats: [format('vp9', 2160), format('vp9', 1080)]}, playerConfig: {mediaCommonConfig: {mediaUstreamerRequestConfig: {videoPlaybackUstreamerConfig: 'paired-config'}}}});

function browser(reply = alternate()) {
  const calls = [], loads = [];
  let videoId = id;
  const cfg = {maxAv1BitrateMbps: '20', maxOtherBitrateMbps: '150'};
  const player = {getVideoData: () => ({video_id: videoId}), loadVideoById: value => loads.push(value), getPlayerState: () => 1};
  const video = {currentTime: 42, paused: false};
  const root = {
    location: {origin: 'https://www.youtube.com'}, URL, Uint8Array, ArrayBuffer, TextEncoder, crypto: webcrypto,
    AbortController, setTimeout, clearTimeout, atob, btoa,
    localStorage: {getItem: () => JSON.stringify(cfg)},
    document: {cookie: 'SAPISID=fixture-only', scripts: [{src: 'https://www.youtube.com/s/player/test/tv-player-es6.js'}],
      getElementById: () => player, querySelector: selector => selector === 'video' ? video : player},
    MediaSource: {isTypeSupported: mime => !/av01/.test(mime)},
    ytcfg: {get: key => ({INNERTUBE_CONTEXT: {client: {hl: 'pt', gl: 'BR', visitorData: 'fixture-visitor'}}, INNERTUBE_API_KEY: 'fixture-key', SESSION_INDEX: 0})[key]},
    navigator: {userAgent: 'fixture-browser'},
    TTWebPo: {createMinter: async () => ({mint: async () => 'AQID', ttlMs: 600000, dispose: async () => {}})},
    fetch: async (url, init) => {calls.push({url: String(url), init});
      if (String(url).includes('tv-player-es6.js')) return {ok: true, text: async () => 'signatureTimestamp:20770'};
      return {ok: true, status: 200, json: async () => typeof reply === 'function' ? reply() : reply};}
  };
  return {root, calls, loads, cfg, changeVideo: value => {videoId = value;}};
}
async function settle(instance) {
  const until = Date.now() + 1500;
  while (instance.getDiagnostics().pending && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(instance.getDiagnostics().pending, 0, 'fallback must settle');
}

test('replaces only the content PO token, preserving client and unknown fields', () => {
  assert.equal(typeof api.injectPoToken, 'function', 'SABR token transport is missing');
  const original = bytes(8, 7, 154, 1, 8, 10, 2, 8, 7, 18, 2, 9, 9, 176, 1, 3);
  const expected = bytes(8, 7, 154, 1, 9, 10, 2, 8, 7, 18, 3, 1, 2, 3, 176, 1, 3);
  assert.deepEqual(api.injectPoToken(original, bytes(1, 2, 3)), expected);
  assert.deepEqual(original, bytes(8, 7, 154, 1, 8, 10, 2, 8, 7, 18, 2, 9, 9, 176, 1, 3));
});
test('adds a streamer context when absent and fails open for malformed protobuf', () => {
  assert.equal(typeof api.injectPoToken, 'function');
  assert.deepEqual(api.injectPoToken(bytes(8, 7), bytes(1, 2)), bytes(8, 7, 154, 1, 4, 18, 2, 1, 2));
  const malformed = bytes(154, 1, 20, 10);
  assert.equal(api.injectPoToken(malformed, bytes(1)), malformed);
});
test('skips lives, unrestricted AV1, and existing top VP9 without requests', async () => {
  assert.equal(typeof api.create, 'function', 'VP9 fallback runtime is missing');
  const b = browser(), instance = api.create(b.root);
  const live = response(); live.videoDetails.isLiveContent = true;
  instance.apply(live);
  b.cfg.maxAv1BitrateMbps = 'unlimited'; instance.apply(response());
  b.cfg.maxAv1BitrateMbps = '20'; const vp9 = response(); vp9.streamingData.adaptiveFormats.push(format('vp9', 2160)); instance.apply(vp9);
  await settle(instance); assert.equal(b.calls.length, 0); instance.dispose();
});
test('fetches asynchronously, reloads once at current time, and splices paired data', async () => {
  assert.equal(typeof api.create, 'function');
  const b = browser(), instance = api.create(b.root), initial = response(), original = initial.streamingData;
  instance.apply(initial); instance.apply(initial);
  assert.equal(initial.streamingData, original, 'initial parse must remain synchronous');
  await settle(instance);
  assert.equal(b.loads.length, 1); assert.equal(b.loads[0].startSeconds, 42);
  assert.equal(b.calls.filter(c => c.url.includes('/youtubei/v1/player')).length, 1);
  const next = response(); instance.apply(next);
  assert.equal(next.streamingData.adaptiveFormats[0].height, 2160);
  assert.match(next.streamingData.adaptiveFormats[0].mimeType, /vp9/);
  assert.equal(next.playerConfig.mediaCommonConfig.mediaUstreamerRequestConfig.videoPlaybackUstreamerConfig, 'paired-config');
  const body = bytes(8, 7);
  assert.notDeepEqual(instance.rewrite('https://rr1.googlevideo.com/videoplayback?sabr=1&id=stream1', body), body);
  assert.equal(instance.rewrite('https://rr1.googlevideo.com/videoplayback?sabr=1&id=another', body), body);
  instance.dispose();
});
test('login failure is cached and leaves current formats untouched', async () => {
  assert.equal(typeof api.create, 'function');
  const b = browser({playabilityStatus: {status: 'LOGIN_REQUIRED'}}), instance = api.create(b.root), r = response(), before = r.streamingData;
  instance.apply(r); await settle(instance); const count = b.calls.length;
  instance.apply(r); await settle(instance);
  assert.equal(r.streamingData, before); assert.equal(b.loads.length, 0); assert.equal(b.calls.length, count);
  assert.equal(instance.getDiagnostics().lastStatus, 'failed'); instance.dispose();
});
test('rejects wrong video responses and VP9 above the configured cap', async () => {
  assert.equal(typeof api.create, 'function');
  for (const change of [r => {r.videoDetails.videoId = 'wrong_video';}, r => {r.streamingData.adaptiveFormats.forEach(f => f.averageBitrate = 200000000);}]) {
    const alt = alternate(); change(alt); const b = browser(alt), instance = api.create(b.root);
    instance.apply(response()); await settle(instance); assert.equal(b.loads.length, 0); assert.equal(instance.getDiagnostics().lastStatus, 'failed'); instance.dispose();
  }
});
test('a completed old-video fetch cannot interrupt the newly selected video', async () => {
  assert.equal(typeof api.create, 'function');
  const b = browser(), instance = api.create(b.root); instance.apply(response()); b.changeVideo('hCixBMdgGxI');
  await settle(instance); assert.equal(b.loads.length, 0); instance.dispose();
});
test('clears token transport when a live response replaces the VOD', async () => {
  assert.equal(typeof api.create, 'function');
  const b = browser(), instance = api.create(b.root); instance.apply(response()); await settle(instance); instance.apply(response());
  const live = response(); live.videoDetails.isLiveContent = true; instance.apply(live);
  const body = bytes(8, 7); assert.equal(instance.rewrite('https://rr1.googlevideo.com/videoplayback?sabr=1&id=stream1', body), body); instance.dispose();
});
test('does not initialize attestation or send requests without a WEB login', async () => {
  const b = browser(); let initializations = 0;
  b.root.document.cookie = '';
  b.root.TTWebPo.createMinter = async () => {initializations++; throw new Error('should-not-run');};
  const instance = api.create(b.root); instance.apply(response()); await settle(instance);
  assert.equal(initializations, 0); assert.equal(b.calls.length, 0); assert.equal(b.loads.length, 0);
  instance.dispose();
});
test('keeps a paused video paused when the prepared alternative becomes ready', async () => {
  const b = browser(), p = b.root.document.getElementById(); let cue;
  b.root.document.querySelector = selector => selector === 'video' ? {currentTime: 12, paused: true} : p;
  p.cueVideoById = value => {cue = value;};
  const instance = api.create(b.root); instance.apply(response()); await settle(instance);
  assert.equal(b.loads.length, 0); assert.equal(cue.startSeconds, 12); instance.dispose();
});
test('re-parsing the already restored VOD retains its token transport', async () => {
  const b = browser(), instance = api.create(b.root); instance.apply(response()); await settle(instance);
  const restored = response(); instance.apply(restored); instance.apply(restored);
  const original = bytes(8, 7);
  assert.notDeepEqual(instance.rewrite('https://rr1.googlevideo.com/videoplayback?sabr=1&id=stream1', original), original);
  instance.dispose();
});
test('fetch rewriting preserves headers and leaves unrelated streams alone', async () => {
  const b = browser(), instance = api.create(b.root); instance.apply(response()); await settle(instance); instance.apply(response());
  const body = bytes(8, 7), headers = {'X-Fixture': 'preserved'};
  await b.root.fetch('https://rr1.googlevideo.com/videoplayback?sabr=1&id=stream1', {method: 'POST', body, headers});
  assert.equal(b.calls.at(-1).init.headers, headers); assert.notDeepEqual(b.calls.at(-1).init.body, body);
  await b.root.fetch('https://rr1.googlevideo.com/videoplayback?sabr=1&id=other', {method: 'POST', body, headers});
  assert.equal(b.calls.at(-1).init.body, body);
  assert.doesNotMatch(JSON.stringify(instance.getDiagnostics()), /fixture-only|fixture-key|AQID/);
  instance.dispose();
});
test('a forbidden media request disables the alternative and recovers only once', async () => {
  const b = browser(); const normalFetch = b.root.fetch;
  b.root.fetch = async (url, init) => String(url).includes('googlevideo.com') ? {status: 403} : normalFetch(url, init);
  const instance = api.create(b.root); instance.apply(response()); await settle(instance); instance.apply(response());
  const url = 'https://rr1.googlevideo.com/videoplayback?sabr=1&id=stream1';
  await b.root.fetch(url, {body: bytes(8, 7)}); await b.root.fetch(url, {body: bytes(8, 7)});
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(b.loads.length, 2, 'one initial upgrade and one recovery');
  const original = response(), before = original.streamingData; instance.apply(original);
  assert.equal(original.streamingData, before); assert.equal(instance.getDiagnostics().lastReason, 'sabr-http-failure'); instance.dispose();
});
test('rejects an explicitly logged-out WEB response even when a stale cookie exists', async () => {
  const r = alternate(); r.responseContext = {mainAppWebResponseContext: {loggedOut: true}};
  const b = browser(r), instance = api.create(b.root); instance.apply(response()); await settle(instance);
  assert.equal(b.loads.length, 0); assert.equal(instance.getDiagnostics().lastReason, 'web-login-required'); instance.dispose();
});
test('retires the expired BotGuard VM before creating its replacement', async () => {
  const b = browser(); let created = 0, retired = 0, now = Date.now(); const originalNow = Date.now;
  b.root.TTWebPo.createMinter = async () => {created++; return {mint: async () => 'AQID', ttlMs: 600000, dispose: async () => {retired++;}};};
  const instance = api.create(b.root);
  try {
    Date.now = () => now;
    instance.apply(response()); await settle(instance);
    now += 700000; instance.apply(response()); await settle(instance);
    assert.equal(created, 2); assert.equal(retired, 1);
  } finally {Date.now = originalNow; instance.dispose();}
  await new Promise(resolve => setImmediate(resolve)); assert.equal(retired, 2);
});
test('navigation immediately stops token injection into the previous video', async () => {
  const b = browser(), instance = api.create(b.root); instance.apply(response()); await settle(instance); instance.apply(response());
  b.changeVideo('CrW2wrMcCzQ'); const next = response(); next.videoDetails.videoId = 'CrW2wrMcCzQ'; instance.apply(next);
  const body = bytes(8, 7);
  assert.equal(instance.rewrite('https://rr1.googlevideo.com/videoplayback?sabr=1&id=stream1', body), body);
  await settle(instance); instance.dispose();
});
test('preloaded metadata cannot steal the currently playing video transport', async () => {
  let outputId = id;
  const b = browser(() => {const r = alternate(); r.videoDetails.videoId = outputId;
    if (outputId !== id) r.streamingData.serverAbrStreamingUrl = 'https://rr1.googlevideo.com/videoplayback?sabr=1&id=stream2'; return r;});
  const instance = api.create(b.root); instance.apply(response()); await settle(instance); instance.apply(response());
  outputId = 'CrW2wrMcCzQ'; const preload = response(); preload.videoDetails.videoId = outputId;
  instance.apply(preload); await settle(instance); instance.apply(preload);
  const body = bytes(8, 7), a = 'https://rr1.googlevideo.com/videoplayback?sabr=1&id=stream1', other = 'https://rr1.googlevideo.com/videoplayback?sabr=1&id=stream2';
  assert.notDeepEqual(instance.rewrite(a, body), body); assert.equal(instance.rewrite(other, body), body);
  b.changeVideo(outputId); assert.notDeepEqual(instance.rewrite(other, body), body); assert.equal(instance.rewrite(a, body), body);
  instance.dispose();
});
test('refreshing an expired metadata cache retains the playing stream token', async () => {
  const b = browser(), instance = api.create(b.root), realNow = Date.now; let now = realNow();
  try {
    Date.now = () => now;
    instance.apply(response()); await settle(instance); instance.apply(response());
    const body = bytes(8, 7), url = 'https://rr1.googlevideo.com/videoplayback?sabr=1&id=stream1';
    assert.notDeepEqual(instance.rewrite(url, body), body);
    now += 121000; const refreshing=response(); instance.apply(refreshing);
    assert.equal(refreshing.streamingData.serverAbrStreamingUrl,url,'refresh must retain paired metadata as well as the token');
    assert.equal(refreshing.playerConfig.mediaCommonConfig.mediaUstreamerRequestConfig.videoPlaybackUstreamerConfig,'paired-config');
    assert.notDeepEqual(instance.rewrite(url, body), body, 'refresh must not interrupt the old transport');
    await settle(instance);
  } finally {Date.now = realNow; instance.dispose();}
});
test('many prefetched videos cannot evict the playing transport', async () => {
  let outputId = id;
  const b = browser(() => {const r = alternate(); r.videoDetails.videoId = outputId;
    if (outputId !== id) r.streamingData.serverAbrStreamingUrl += outputId; return r;});
  const instance = api.create(b.root); instance.apply(response()); await settle(instance); instance.apply(response());
  for (let i = 0; i < 9; i++) {outputId = 'preload000' + i; const r = response(); r.videoDetails.videoId = outputId; instance.apply(r); await settle(instance); instance.apply(r);}
  const body = bytes(8, 7);
  assert.notDeepEqual(instance.rewrite('https://rr1.googlevideo.com/videoplayback?sabr=1&id=stream1', body), body);
  instance.dispose();
});

test('metadata completion during a manual quality load resumes the requested position instead of transient zero',async()=>{
 const b=browser(),instance=api.create(b.root),v=b.root.document.querySelector('video');v.currentTime=0;v.paused=true;
 b.root.__ttQualityController={getPlaybackIntent:videoId=>videoId===id?{time:142,paused:false}:null};
 instance.apply(response());await settle(instance);assert.equal(b.loads.length,1);assert.equal(b.loads[0].startSeconds,142);instance.dispose();
});

test('when quality menu is active and AV1 is within cap, prepares supplemental VP9 without interrupting TVHTML5 playback and splices only when a supplemental track is selected',async()=>{
 const b=browser();b.cfg.maxAv1BitrateMbps='100';
 let sel=null;
 b.root.__ttQualityController={getRows:()=>[],getSelection:()=>sel};
 const instance=api.create(b.root),initial=response(),originalSd=initial.streamingData;
 instance.apply(initial);
 await settle(instance);
 assert.equal(b.loads.length,0,'must not reload or interrupt unconstrained TVHTML5 playback');
 assert.equal(initial.streamingData,originalSd);
 const sup=instance.getSupplementalResponse(id);
 assert.ok(sup);
 assert.equal(sup.streamingData.adaptiveFormats.length,2);
 sel={videoId:id,needsWeb:true,itag:313};
 const selected=response();
 instance.apply(selected);
 assert.equal(selected.__ttVp9FallbackApplied,true);
 assert.match(selected.streamingData.adaptiveFormats[0].mimeType,/vp9/);
 sel={videoId:id,needsWeb:false,itag:701};
 const backToTv=response(),tvSd=backToTv.streamingData;
 instance.apply(backToTv);
 assert.equal(backToTv.streamingData,tvSd);
 instance.dispose();
});
