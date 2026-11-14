const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const candidatePaths = [
  path.join(__dirname, 'l1_media_ui_script.h'),
  path.resolve(__dirname, '../../app/cobalt/renderer/l1_media_ui_script.h'),
  path.resolve(__dirname, '../../cobalt/renderer/l1_media_ui_script.h')
];
const headerPath = candidatePaths.find(p => fs.existsSync(p));
assert(headerPath, 'Could not locate l1_media_ui_script.h in any expected path');
const headerContent = fs.readFileSync(headerPath, 'utf8');
const match = headerContent.match(/R"L1SCRIPT\(([\s\S]*?)\)L1SCRIPT"/);
assert(match && match[1], 'Failed to extract kL1MediaUiScript from l1_media_ui_script.h');
const scriptSource = match[1];

function createHarness(options = {}) {
  const storage = {};
  const session = {};
  const intervals = [];
  let currentHref = options.href || 'https://www.youtube.com/tv#/watch?v=MNsbPClRgyg';
  let playerElem = null;
  let videoElem = { currentTime: 42.5, readyState: 2, play: () => {}, addEventListener: () => {} };
  const fetchCalls = [];

  const windowObj = {
    innerWidth: 1920,
    innerHeight: 1080,
    devicePixelRatio: 1,
    location: {
      get href() { return currentHref; },
      set href(v) { currentHref = v; },
      reload: () => { windowObj.__reloaded = true; }
    },
    localStorage: {
      getItem: (k) => (k in storage ? storage[k] : null),
      setItem: (k, v) => { storage[k] = String(v); }
    },
    sessionStorage: {
      getItem: (k) => (k in session ? session[k] : null),
      setItem: (k, v) => { session[k] = String(v); },
      removeItem: (k) => { delete session[k]; }
    },
    matchMedia: (q) => ({ matches: false, media: q }),
    MediaSource: {
      isTypeSupported: (t) => {
        if (options.nativeIamf && String(t).includes('iamf')) return true;
        return String(t).includes('mp4a') || String(t).includes('vp09');
      }
    },
    HTMLMediaElement: {
      prototype: {
        canPlayType: function (t) {
          return String(t).includes('mp4a') ? 'maybe' : '';
        }
      }
    },
    navigator: {
      mediaCapabilities: {
        decodingInfo: async () => ({ supported: false, smooth: false, powerEfficient: false })
      }
    },
    AudioDestinationNode: { prototype: {} },
    ytcfg: {
      _flags: {},
      get: function (k) { return k === 'EXPERIMENT_FLAGS' ? this._flags : undefined; },
      set: function (obj) { if (obj && obj.EXPERIMENT_FLAGS) this._flags = obj.EXPERIMENT_FLAGS; }
    },
    fetch: async function (input, init) {
      const url = typeof input === 'string' ? input : input.url;
      fetchCalls.push({ url, init });
      return {
        ok: true,
        url,
        json: async () => ({
          tag_name: 'v1.1.0',
          published_at: '2026-11-14T00:00:00Z',
          body: 'TubeRush release notes',
          assets: [
            {
              name: 'TubeRush-armv7.apk',
              browser_download_url: 'https://github.com/HeliumMarcos/TubeRush/releases/download/v1.1.0/TubeRush-armv7.apk'
            }
          ]
        })
      };
    },
    CustomEvent: class CustomEvent {
      constructor(type, detail) {
        this.type = type;
        this.detail = detail;
      }
    },
    document: {
      getElementById: (id) => (id === 'ytlr-player__player-container-player' ? playerElem : null),
      querySelector: (sel) => (sel === 'video' ? videoElem : null)
    },
    setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
    setTimeout: (fn) => { fn(); return 1; },
    JSON: {
      parse: JSON.parse,
      stringify: JSON.stringify
    }
  };

  const context = vm.createContext({
    window: windowObj,
    document: windowObj.document,
    location: windowObj.location,
    navigator: windowObj.navigator,
    sessionStorage: windowObj.sessionStorage,
    localStorage: windowObj.localStorage,
    MediaSource: windowObj.MediaSource,
    HTMLMediaElement: windowObj.HTMLMediaElement,
    AudioDestinationNode: windowObj.AudioDestinationNode,
    CustomEvent: windowObj.CustomEvent,
    setInterval: windowObj.setInterval,
    setTimeout: windowObj.setTimeout,
    JSON: windowObj.JSON,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Math,
    Date,
    RegExp,
    Map,
    Set,
    Promise,
     parseFloat,
    parseInt,
    isNaN
  });

  vm.runInContext(scriptSource, context);

  function setPlayer(p) {
    playerElem = p;
    windowObj.__ttL1HookPlayerApi();
    return playerElem;
  }

  function setYtafConfig(cfg) {
    storage['ytaf-configuration'] = JSON.stringify(cfg);
  }

  return { windowObj, setPlayer, setYtafConfig, fetchCalls, storage, session };
}

function makeMockPlayer(videoId) {
  const calls = [];
  let currentStatsCodecs = '';
  return {
    calls,
    setStatsCodecs: (c) => { currentStatsCodecs = c; },
    getVideoData: () => ({ video_id: videoId }),
    getStatsForNerds: () => ({ codecs: currentStatsCodecs }),
    getAvailableQualityDataAndMessaging: () => ({ qualityData: [] }),
    setPlaybackQualityRange: (minQ, maxQ, formatId) => {
      calls.push({ method: 'setPlaybackQualityRange', minQ, maxQ, formatId });
    },
    getPlaybackQualityLabel: () => '',
    getUserPlaybackQualityPreference: () => 'auto',
    loadVideoById: (arg) => { calls.push({ method: 'loadVideoById', arg }); },
    playVideo: () => { calls.push({ method: 'playVideo' }); },
    dispatchEvent: (ev) => { calls.push({ method: 'dispatchEvent', type: ev.type }); }
  };
}

async function runTests() {
  let passed = 0;

  // TEST 1: Incremental Catalog Union without shrinking
  {
    const { windowObj } = createHarness({ href: 'https://www.youtube.com/tv#/watch?v=VID_UNION' });
    windowObj.JSON.parse(JSON.stringify({
      videoDetails: { videoId: 'VID_UNION', title: 'Union Test' },
      streamingData: {
        adaptiveFormats: [
          { itag: 701, mimeType: 'video/mp4; codecs="av01.0.13M.10.0.110.09.16.09.0"', width: 3840, height: 2160, fps: 60, bitrate: 82490000, qualityLabel: '2160p60 HDR' },
          { itag: 315, mimeType: 'video/webm; codecs="vp9"', width: 3840, height: 2160, fps: 60, bitrate: 44163650, qualityLabel: '2160p60' },
          { itag: 328, mimeType: 'audio/mp4; codecs="ec-3"', bitrate: 384000, audioChannels: 6 }
        ]
      }
    }));
    // Second partial response only has 1080p and stereo audio
    const second = windowObj.JSON.parse(JSON.stringify({
      videoDetails: { videoId: 'VID_UNION' },
      streamingData: {
        adaptiveFormats: [
          { itag: 137, mimeType: 'video/mp4; codecs="avc1.640028"', width: 1920, height: 1080, fps: 30, bitrate: 4500000, qualityLabel: '1080p' },
          { itag: 251, mimeType: 'audio/webm; codecs="opus"', bitrate: 129000, audioChannels: 2 }
        ]
      }
    }));
    const cat = windowObj.__ttL1Catalog['VID_UNION'];
    assert.strictEqual(cat.videos.length, 3, 'Catalog must unite 701, 315, and 137 without shrinking');
    assert.strictEqual(cat.audios.length, 2, 'Catalog must unite 328 and 251 without shrinking');
    assert.strictEqual(second.streamingData.adaptiveFormats.filter(f => f.mimeType.startsWith('video/')).length, 3);
    passed++;
  }

  // TEST 2: Codec preference (Any, AV1, VP9, AVC) + JSON.parse Property Trap against TizenTube destructive filter (V03)
  {
    const { windowObj, setPlayer, setYtafConfig } = createHarness({ href: 'https://www.youtube.com/tv#/watch?v=CrW2wrMcCzQ' });
    // Simulate TizenTube overwriting window.JSON.parse and destructively filtering adaptiveFormats!
    const prevParse = windowObj.JSON.parse;
    windowObj.JSON.parse = function () {
      const e = prevParse.apply(this, arguments);
      const rawCfg = windowObj.localStorage.getItem('ytaf-configuration');
      const prefCodec = rawCfg ? prevParse(rawCfg).preferredVideoCodec : 'any';
      if (e && e.streamingData && e.streamingData.adaptiveFormats && prefCodec && prefCodec !== 'any') {
        if (e.streamingData.adaptiveFormats.find(f => f.mimeType.includes(prefCodec))) {
          e.streamingData.adaptiveFormats = e.streamingData.adaptiveFormats.filter(
            f => f.mimeType.startsWith('audio/') || f.mimeType.includes(prefCodec)
          );
        }
      }
      return e;
    };

    const samplePayload = {
      videoDetails: { videoId: 'CrW2wrMcCzQ', title: '4K HDR Multi-Codec' },
      streamingData: {
        adaptiveFormats: [
          { itag: 701, mimeType: 'video/mp4; codecs="av01.0.13M.10"', width: 3840, height: 2160, fps: 60, bitrate: 39344000, qualityLabel: '2160p60 HDR' },
          { itag: 337, mimeType: 'video/webm; codecs="vp09.02.51.10"', width: 3840, height: 2160, fps: 60, bitrate: 43997000, qualityLabel: '2160p60 HDR' },
          { itag: 299, mimeType: 'video/mp4; codecs="avc1.64002a"', width: 1920, height: 1080, fps: 60, bitrate: 5800000, qualityLabel: '1080p60' },
          { itag: 251, mimeType: 'audio/webm; codecs="opus"', bitrate: 143000, audioChannels: 2 }
        ]
      }
    };

    const p = setPlayer(makeMockPlayer('CrW2wrMcCzQ'));
    for (const codec of ['any', 'av01', 'vp9', 'avc1']) {
      setYtafConfig({ preferredVideoQuality: '2160p', preferredVideoCodec: codec });
      const parsed = windowObj.JSON.parse(JSON.stringify(samplePayload));
      const qData = p.getAvailableQualityData();
      assert.strictEqual(qData.length, 3, `All 3 codecs (AV1, VP9, AVC) must remain in menu when preferredVideoCodec=${codec}`);
      if (codec === 'av01') {
        assert.strictEqual(parsed.streamingData.adaptiveFormats[0].itag, 701, 'AV1 preference must put 701 first');
      } else if (codec === 'vp9') {
        assert.strictEqual(parsed.streamingData.adaptiveFormats[0].itag, 337, 'VP9 preference must put 337 first');
      }
    }
    passed++;
  }

  // TEST 3: Global 2160p preference on 4K video selects 2160p without hiding lower resolutions (V01)
  {
    const { windowObj, setPlayer, setYtafConfig } = createHarness({ href: 'https://www.youtube.com/tv#/watch?v=MNsbPClRgyg' });
    setYtafConfig({ preferredVideoQuality: '2160p', preferredVideoCodec: 'vp9' });
    const p = setPlayer(makeMockPlayer('MNsbPClRgyg'));
    windowObj.JSON.parse(JSON.stringify({
      videoDetails: { videoId: 'MNsbPClRgyg' },
      streamingData: {
        adaptiveFormats: [
          { itag: 315, mimeType: 'video/webm; codecs="vp9"', width: 3840, height: 2160, fps: 60, bitrate: 44163650, qualityLabel: '2160p60' },
          { itag: 308, mimeType: 'video/webm; codecs="vp9"', width: 2560, height: 1440, fps: 60, bitrate: 18595000, qualityLabel: '1440p60' },
          { itag: 303, mimeType: 'video/webm; codecs="vp9"', width: 1920, height: 1080, fps: 60, bitrate: 7119000, qualityLabel: '1080p60' },
          { itag: 299, mimeType: 'video/mp4; codecs="avc1.64002a"', width: 1920, height: 1080, fps: 60, bitrate: 5800000, qualityLabel: '1080p60' }
        ]
      }
    }));
    // Simulate TizenTube Or() calling Mr("2160p") -> setPlaybackQualityRange(t, t)
    const qData = p.getAvailableQualityData();
    assert.strictEqual(qData.length, 4, 'All 4 formats must remain in quality menu');
    const first2160 = qData.find(e => parseInt(e.qualityLabel, 10) === 2160);
    assert.strictEqual(first2160.quality, 'hd2160', 'Quality key must be valid YouTube key hd2160');
    assert.strictEqual(first2160.formatId, '315', 'formatId must be 315');
    p.setPlaybackQualityRange(first2160.quality, first2160.quality);
    const lastCall = p.calls.filter(c => c.method === 'setPlaybackQualityRange').pop();
    assert.deepStrictEqual(lastCall, {
      method: 'setPlaybackQualityRange',
      minQ: 'hd2160',
      maxQ: 'hd2160',
      formatId: '315'
    });
    passed++;
  }

  // TEST 4: Global 2160p preference on max-1080p video (hCixBMdgGxI / R5) falls back to hd1080 instead of freezing on "highres" (V02)
  {
    const { windowObj, setPlayer, setYtafConfig } = createHarness({ href: 'https://www.youtube.com/tv#/watch?v=hCixBMdgGxI' });
    setYtafConfig({ preferredVideoQuality: '2160p', preferredVideoCodec: 'av01' });
    const p = setPlayer(makeMockPlayer('hCixBMdgGxI'));
    windowObj.JSON.parse(JSON.stringify({
      videoDetails: { videoId: 'hCixBMdgGxI' },
      streamingData: {
        adaptiveFormats: [
          { itag: 399, mimeType: 'video/mp4; codecs="av01.0.08M.08"', width: 1920, height: 1080, fps: 30, bitrate: 1581000, qualityLabel: '1080p' },
          { itag: 248, mimeType: 'video/webm; codecs="vp9"', width: 1920, height: 1080, fps: 30, bitrate: 1621000, qualityLabel: '1080p' },
          { itag: 137, mimeType: 'video/mp4; codecs="avc1.640028"', width: 1920, height: 1080, fps: 30, bitrate: 2145000, qualityLabel: '1080p' },
          { itag: 136, mimeType: 'video/mp4; codecs="avc1.4d401f"', width: 1280, height: 720, fps: 30, bitrate: 1100000, qualityLabel: '720p' }
        ]
      }
    }));
    // TizenTube Mr("2160p") finds no 2160p in getAvailableQualityData() and returns "highres"!
    p.setPlaybackQualityRange('highres', 'highres');
    const lastCall = p.calls.filter(c => c.method === 'setPlaybackQualityRange').pop();
    assert.deepStrictEqual(lastCall, {
      method: 'setPlaybackQualityRange',
      minQ: 'hd1080',
      maxQ: 'hd1080',
      formatId: '399'
    }, 'Must clamp highres to hd1080 and pick preferred AV1 formatId 399 without reloading or freezing');
    assert.strictEqual(p.calls.some(c => c.method === 'loadVideoById'), false, 'Must NOT trigger destructive reload');
    passed++;
  }

  // TEST 5: Manual selection (3-arg with formatId) vs "Automática" (V01, V02)
  {
    const { windowObj, setPlayer, setYtafConfig } = createHarness({ href: 'https://www.youtube.com/tv#/watch?v=CrW2wrMcCzQ' });
    setYtafConfig({ preferredVideoQuality: '2160p', preferredVideoCodec: 'av01' });
    const p = setPlayer(makeMockPlayer('CrW2wrMcCzQ'));
    windowObj.JSON.parse(JSON.stringify({
      videoDetails: { videoId: 'CrW2wrMcCzQ' },
      streamingData: {
        adaptiveFormats: [
          { itag: 701, mimeType: 'video/mp4; codecs="av01.0.13M.10"', width: 3840, height: 2160, fps: 60, bitrate: 39344000, qualityLabel: '2160p60 HDR' },
          { itag: 337, mimeType: 'video/webm; codecs="vp09.02.51.10"', width: 3840, height: 2160, fps: 60, bitrate: 43997000, qualityLabel: '2160p60 HDR' },
          { itag: 299, mimeType: 'video/mp4; codecs="avc1.64002a"', width: 1920, height: 1080, fps: 60, bitrate: 5800000, qualityLabel: '1080p60' }
        ]
      }
    }));
    // User manually selects 1080p AVC (itag 299) in "Qualidade do vídeo atual"
    p.setPlaybackQualityRange('hd1080', 'hd1080', '299');
    assert.strictEqual(windowObj.__ttL1Pinned['CrW2wrMcCzQ'].manualVideo, true);
    assert.strictEqual(windowObj.__ttL1Pinned['CrW2wrMcCzQ'].videoItag, 299);
    assert.strictEqual(p.getAvailableQualityData().length, 3, 'Manual selection must NOT hide other formats');

    // User clicks "Automática"
    p.setPlaybackQualityRange('auto', 'auto');
    assert.strictEqual(windowObj.__ttL1Pinned['CrW2wrMcCzQ'].manualVideo, false);
    passed++;
  }

  // TEST 6: Checkmark synchronization with real active decoder from getStatsForNerds().codecs (V05)
  {
    const { windowObj, setPlayer } = createHarness({ href: 'https://www.youtube.com/tv#/watch?v=CrW2wrMcCzQ' });
    const p = setPlayer(makeMockPlayer('CrW2wrMcCzQ'));
    windowObj.JSON.parse(JSON.stringify({
      videoDetails: { videoId: 'CrW2wrMcCzQ' },
      streamingData: {
        adaptiveFormats: [
          { itag: 701, mimeType: 'video/mp4; codecs="av01.0.13M.10"', width: 3840, height: 2160, fps: 60, bitrate: 39344000, qualityLabel: '2160p60 HDR' },
          { itag: 337, mimeType: 'video/webm; codecs="vp09.02.51.10"', width: 3840, height: 2160, fps: 60, bitrate: 43997000, qualityLabel: '2160p60 HDR' }
        ]
      }
    }));
    p.setStatsCodecs('vp09.02.51.10.01.09.16.09.01 (337) / opus (251)');
    assert.strictEqual(p.getPlaybackQualityLabel(), '2160p, 60fps, 44.00Mbps, vp9 HDR');
    const qData = p.getAvailableQualityData();
    const cur = qData.find(q => q.isCurrent);
    assert.strictEqual(cur.formatId, '337');
    passed++;
  }

  // TEST 7: Multi-language (pt-BR, en-US, es-US) and DRC audio tracks with identical itag/bitrate preserved (A02, R5 hCixBMdgGxI)
  {
    const { windowObj, setPlayer } = createHarness({ href: 'https://www.youtube.com/tv#/watch?v=hCixBMdgGxI' });
    const p = setPlayer(makeMockPlayer('hCixBMdgGxI'));
    windowObj.JSON.parse(JSON.stringify({
      videoDetails: { videoId: 'hCixBMdgGxI' },
      streamingData: {
        adaptiveFormats: [
          { itag: 399, mimeType: 'video/mp4; codecs="av01.0.08M.08"', width: 1920, height: 1080, fps: 30, bitrate: 1581000, qualityLabel: '1080p' },
          { itag: 140, mimeType: 'audio/mp4; codecs="mp4a.40.2"', bitrate: 129000, audioChannels: 2, isDrc: false, audioTrack: { id: 'pt-BR.4', displayName: 'Português (Brasil) original', audioIsDefault: true } },
          { itag: 140, mimeType: 'audio/mp4; codecs="mp4a.40.2"', bitrate: 129000, audioChannels: 2, isDrc: true, audioTrack: { id: 'pt-BR.4', displayName: 'Português (Brasil) original', audioIsDefault: true } },
          { itag: 140, mimeType: 'audio/mp4; codecs="mp4a.40.2"', bitrate: 129000, audioChannels: 2, isDrc: false, audioTrack: { id: 'en-US.10', displayName: 'English (US)', audioIsDefault: false } },
          { itag: 140, mimeType: 'audio/mp4; codecs="mp4a.40.2"', bitrate: 129000, audioChannels: 2, isDrc: false, audioTrack: { id: 'es-US.10', displayName: 'Spanish (US)', audioIsDefault: false } },
          { itag: 251, mimeType: 'audio/webm; codecs="opus"', bitrate: 128000, audioChannels: 2, isDrc: false, audioTrack: { id: 'pt-BR.4', displayName: 'Português (Brasil) original', audioIsDefault: true } },
          { itag: 251, mimeType: 'audio/webm; codecs="opus"', bitrate: 128000, audioChannels: 2, isDrc: true, audioTrack: { id: 'pt-BR.4', displayName: 'Português (Brasil) original', audioIsDefault: true } },
          { itag: 251, mimeType: 'audio/webm; codecs="opus"', bitrate: 128000, audioChannels: 2, isDrc: false, isVb: true, xtags: 'ChQKBnR5cGU9MgoICgZ2Yj0x', audioTrack: { id: 'pt-BR.4', displayName: 'Português (Brasil) original', audioIsDefault: true } }
        ]
      }
    }));
    const tracks = p.getAvailableAudioTracks();
    assert.strictEqual(tracks.length, 7, 'All 7 language, DRC, and Voice Boost audio variants must be preserved without collapsing');
    const names = tracks.map(t => t.getName());
    assert(names.some(n => n.includes('Português (Brasil) original') && !n.includes('[DRC]') && !n.includes('[Voice Boost]')));
    assert(names.some(n => n.includes('Português (Brasil) original') && n.includes('[DRC]')));
    assert(names.some(n => n.includes('Português (Brasil) original') && n.includes('[Voice Boost]')));
    assert(names.some(n => n.includes('English (US)')));
    assert(names.some(n => n.includes('Spanish (US)')));

    // Select Spanish (US) track and verify only Spanish (US) is pinned on reload
    const esTrack = tracks.find(t => t.getName().includes('Spanish (US)'));
    p.setAudioTrack(esTrack);
    assert.strictEqual(windowObj.__ttL1Pinned['hCixBMdgGxI'].audioKey, '140:es-US.10:std:2');
    assert.strictEqual(p.getAvailableAudioTracks().length, 7, 'All 7 audio tracks must remain in menu after selecting Spanish');
    passed++;
  }

  // TEST 8: Reversible switching between 328 (E-AC-3 5.1) and 380 (AC-3 5.1) (A01, R2/R3)
  {
    const { windowObj, setPlayer } = createHarness({ href: 'https://www.youtube.com/tv#/watch?v=ujgysGodH1I' });
    const p = setPlayer(makeMockPlayer('ujgysGodH1I'));
    const rawPayload = {
      videoDetails: { videoId: 'ujgysGodH1I' },
      streamingData: {
        adaptiveFormats: [
          { itag: 399, mimeType: 'video/mp4; codecs="av01.0.08M.08"', width: 1920, height: 1080, fps: 24, bitrate: 2500000, qualityLabel: '1080p' },
          { itag: 251, mimeType: 'audio/webm; codecs="opus"', bitrate: 129000, audioChannels: 2 },
          { itag: 380, mimeType: 'audio/mp4; codecs="ac-3"', bitrate: 384000, audioChannels: 6 },
          { itag: 328, mimeType: 'audio/mp4; codecs="ec-3"', bitrate: 384000, audioChannels: 6 }
        ]
      }
    };
    const first = windowObj.JSON.parse(JSON.stringify(rawPayload));
    const firstAuds = first.streamingData.adaptiveFormats.filter(f => f.mimeType.startsWith('audio/'));
    assert.strictEqual(firstAuds[0].itag, 328, 'Default audio stream must prioritize 328 (E-AC-3 5.1)');

    const tracks = p.getAvailableAudioTracks();
    assert.strictEqual(tracks.length, 3, '328, 380, and 251 must all be listed');
    const ac3Track = tracks.find(t => t.getName().includes('Dolby Digital (ac-3 5.1'));
    assert(ac3Track, 'AC-3 5.1 track must be present');

    p.setAudioTrack(ac3Track);
    const afterSwitch = windowObj.JSON.parse(JSON.stringify(rawPayload));
    const switchedAuds = afterSwitch.streamingData.adaptiveFormats.filter(f => f.mimeType.startsWith('audio/'));
    assert.strictEqual(switchedAuds.length, 1);
    assert.strictEqual(switchedAuds[0].itag, 380, 'Pinned audio stream must be 380 (AC-3 5.1)');
    assert.strictEqual(p.getAvailableAudioTracks().length, 3, 'All 3 audio tracks must remain in menu after switching to 380');
    assert.strictEqual(p.getAudioTrack().itag, 380, 'Active checkmark must be on 380');
    passed++;
  }

  // TEST 9: Negative Probe Rejection (.nl)
  {
    const { windowObj } = createHarness();
    assert.strictEqual(windowObj.MediaSource.isTypeSupported('audio/mp4; codecs="ec-3"; channels=99'), false);
    assert.strictEqual(windowObj.MediaSource.isTypeSupported('video/webm; codecs="vp9"; width=99999'), false);
    assert.strictEqual(windowObj.MediaSource.isTypeSupported('video/mp4; codecs="av01"; framerate=9999'), false);
    assert.strictEqual(windowObj.MediaSource.isTypeSupported('video/mp4; codecs="av01"; bitrate=2000000000'), false);
    assert.strictEqual(windowObj.MediaSource.isTypeSupported('video/mp4; codecs="catavision"'), false);
    assert.strictEqual(windowObj.HTMLMediaElement.prototype.canPlayType('audio/mp4; codecs="ec-3"; channels=99'), '');
    const decRes = await windowObj.navigator.mediaCapabilities.decodingInfo({
      type: 'media-source',
      audio: { contentType: 'audio/mp4; codecs="ec-3"', channels: 99 }
    });
    assert.strictEqual(decRes.supported, false);
    passed++;
  }

  // TEST 10: Real Capabilities without false IAMF spoofing & IAMF track filtering (C01)
  {
    const { windowObj, setPlayer } = createHarness({ nativeIamf: false, href: 'https://www.youtube.com/tv#/watch?v=VID_CAP' });
    const p = setPlayer(makeMockPlayer('VID_CAP'));
    assert.strictEqual(windowObj.MediaSource.isTypeSupported('audio/mp4; codecs="iamf.001.001.opus"'), false);
    assert.strictEqual(windowObj.HTMLMediaElement.prototype.canPlayType('audio/mp4; codecs="iamf"'), '');
    assert.strictEqual(p.isAudioIamf(), false);
    assert.strictEqual(windowObj.MediaSource.isTypeSupported('audio/mp4; codecs="ec-3"'), true);
    assert.strictEqual(windowObj.MediaSource.isTypeSupported('audio/mp4; codecs="ac-3"'), true);
    windowObj.JSON.parse(JSON.stringify({
      videoDetails: { videoId: 'VID_CAP' },
      streamingData: {
        adaptiveFormats: [
          { itag: 773, mimeType: 'audio/mp4; codecs="iamf.001.001.opus"', bitrate: 396000, audioChannels: 6 },
          { itag: 328, mimeType: 'audio/mp4; codecs="ec-3"', bitrate: 384000, audioChannels: 6 }
        ]
      }
    }));
    const tracks = p.getAvailableAudioTracks();
    assert.strictEqual(tracks.length, 1, 'IAMF 773 must be filtered out when nativeIamf is false');
    assert.strictEqual(tracks[0].itag, 328);
    passed++;
  }

  // TEST 11: Idempotent hookPlayerApi() across 100 ticks (P01)
  {
    const { windowObj, setPlayer } = createHarness();
    const p = setPlayer(makeMockPlayer('VID_IDEM'));
    const firstFn = p.setPlaybackQualityRange;
    for (let i = 0; i < 100; i++) {
      windowObj.__ttL1HookPlayerApi();
    }
    assert.strictEqual(p.setPlaybackQualityRange, firstFn, 'hookPlayerApi must not stack wrappers on repeated ticks');
    passed++;
  }

  // TEST 12: >100 Mbps bitrate formatting & HLS Master Playlist Parser for 628-hls (V04, R1 MNsbPClRgyg)
  {
    const { windowObj } = createHarness({ href: 'https://www.youtube.com/tv#/watch?v=MNsbPClRgyg' });
    windowObj.JSON.parse(JSON.stringify({
      videoDetails: { videoId: 'MNsbPClRgyg' },
      streamingData: {
        hlsManifestUrl: 'https://manifest.googlevideo.com/api/manifest/hls_variant/id/MNsbPClRgyg/file/index.m3u8',
        adaptiveFormats: [
          { itag: 315, mimeType: 'video/webm; codecs="vp9"', width: 3840, height: 2160, fps: 60, bitrate: 44163650, qualityLabel: '2160p60' }
        ]
      }
    }));
    const m3u8 = [
      '#EXTM3U',
      '#EXT-X-STREAM-INF:BANDWIDTH=115678879,AVERAGE-BANDWIDTH=92500000,CODECS="vp09.00.51.08",RESOLUTION=3840x2160,FRAME-RATE=60.0,VIDEO-RANGE=SDR',
      'https://manifest.googlevideo.com/api/manifest/hls_playlist/itag/628/id/MNsbPClRgyg/file/seg.m3u8'
    ].join('\n');
    const variants = windowObj.__ttL1ParseHlsMasterPlaylist(m3u8, 'MNsbPClRgyg');
    assert.strictEqual(variants.length, 1);
    assert.strictEqual(variants[0].itag, '628-hls');
    assert.strictEqual(variants[0].playableInCobaltAndroid, false);
    assert.strictEqual(variants[0].unplayableReason, 'COBALT_ANDROID_NO_HLS_DEMUXER');
    passed++;
  }

  // TEST 13: TubeRush UI Rebranding while preserving author credits (B01)
  {
    const { windowObj } = createHarness();
    const prevParse = windowObj.JSON.parse;
    windowObj.JSON.parse = function () {
      return prevParse.apply(this, arguments);
    };
    const popupObj = windowObj.JSON.parse(JSON.stringify({
      openPopupAction: {
        popup: {
          title: 'Welcome to TizenTube',
          updaterTitle: 'TizenTube Cobalt Updater',
          settingsTitle: 'TizenTube Settings',
          credits: 'Made by Reis Can (reisxd) with ❤️'
        }
      }
    }));
    assert.strictEqual(popupObj.openPopupAction.popup.title, 'Welcome to TubeRush');
    assert.strictEqual(popupObj.openPopupAction.popup.updaterTitle, 'TubeRush Updater');
    assert.strictEqual(popupObj.openPopupAction.popup.settingsTitle, 'TubeRush Settings');
    assert.strictEqual(popupObj.openPopupAction.popup.credits, 'Made by Reis Can (reisxd) with ❤️');
    passed++;
  }

  // TEST 14: Self-Updater redirect to HeliumMarcos/TubeRush and APK asset normalization (U01)
  {
    const { windowObj, fetchCalls } = createHarness();
    const resp = await windowObj.fetch('https://api.github.com/repos/reisxd/TizenTubeCobalt/releases/latest');
    assert.strictEqual(fetchCalls[0].url, 'https://api.github.com/repos/HeliumMarcos/TubeRush/releases/latest');
    const releaseData = await resp.json();
    const armAsset = releaseData.assets.find(e => e.name.includes('arm.apk'));
    assert(armAsset, 'Normalized release assets must include an arm.apk entry for TizenTube updater compatibility');
    assert.strictEqual(
      armAsset.browser_download_url,
      'https://github.com/HeliumMarcos/TubeRush/releases/download/v1.1.0/TubeRush-armv7.apk'
    );
    passed++;
  }

  console.log(`ALL ${passed}/14 UNIT TESTS PASSED SUCCESSFULLY!`);
}

runTests().catch(err => {
  console.error('UNIT TEST FAILURE:', err);
  process.exit(1);
});
