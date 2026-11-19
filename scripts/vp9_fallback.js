/* Authenticated VOD VP9 fallback. Tokens and signed URLs stay in page memory. */
(function (root, build) {
  var policy = typeof module === 'object' && module.exports ? require('./l1/src/bitrate-policy.js') : root.TTL1BitratePolicy;
  var api = build(policy);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else if (!root.__ttVp9Fallback) root.__ttVp9Fallback = api.create(root);
})(typeof window === 'object' ? window : globalThis, function (policy) {
  'use strict';

  function varint(value) {
    var result = [];
    do { var part = value % 128; value = Math.floor(value / 128); result.push(part + (value ? 128 : 0)); } while (value);
    return new Uint8Array(result);
  }
  function join(parts) {
    var result = new Uint8Array(parts.reduce(function (n, p) { return n + p.length; }, 0)), offset = 0;
    parts.forEach(function (p) { result.set(p, offset); offset += p.length; });
    return result;
  }
  function fields(data) {
    var offset = 0, result = [];
    function read() {
      var value = 0, scale = 1;
      for (var i = 0; i < 10 && offset < data.length; i++) {
        var b = data[offset++]; value += (b & 127) * scale;
        if (!(b & 128)) return value;
        scale *= 128;
      }
      throw new Error('Invalid protobuf varint');
    }
    while (offset < data.length) {
      var start = offset, tag = read(), wire = tag % 8, number = Math.floor(tag / 8), from;
      if (!number) throw new Error('Invalid protobuf field');
      if (wire === 0) read();
      else if (wire === 1) offset += 8;
      else if (wire === 5) offset += 4;
      else if (wire === 2) { var length = read(); from = offset; offset += length; }
      else throw new Error('Unsupported protobuf wire type');
      if (!Number.isSafeInteger(offset) || offset > data.length) throw new Error('Truncated protobuf');
      result.push({number: number, wire: wire, start: start, from: from, end: offset});
    }
    return result;
  }
  function replaceBytes(data, number, payload) {
    var replacement = join([varint(number * 8 + 2), varint(payload.length), payload]), found = false, parts = [];
    fields(data).forEach(function (f) {
      if (f.number === number) {
        if (f.wire !== 2) throw new Error('Unexpected protobuf field type');
        if (!found) parts.push(replacement);
        found = true;
      } else parts.push(data.subarray(f.start, f.end));
    });
    if (!found) parts.push(replacement);
    return join(parts);
  }
  function injectPoToken(body, token) {
    try {
      var data = body instanceof ArrayBuffer ? new Uint8Array(body) :
        ArrayBuffer.isView(body) ? new Uint8Array(body.buffer, body.byteOffset, body.byteLength) : null;
      if (!data || data.length > 1048576 || !token || !token.length) return body;
      var contexts = fields(data).filter(function (f) { return f.number === 19; });
      if (contexts.length > 1 || contexts.some(function (f) { return f.wire !== 2; })) return body;
      var context = contexts.length ? data.subarray(contexts[0].from, contexts[0].end) : new Uint8Array();
      return replaceBytes(data, 19, replaceBytes(context, 2, token));
    } catch (_) { return body; }
  }

  function create(root) {
    var parse = JSON.parse.bind(JSON), stringify = JSON.stringify.bind(JSON);
    var originalFetch = root.fetch && root.fetch.bind(root), cache = new Map(), transports = new Map(), active = null, disposed = false;
    var controllers = new Set(), minterPromise = null, minterExpiry = 0, signaturePromise = null;
    var diagnostics = {pending: 0, lastStatus: 'idle', lastReason: null, requests: 0, reloads: 0};
    function config() {
      try { return parse(root.localStorage.getItem('ytaf-configuration') || '{}'); } catch (_) { return {}; }
    }
    function normalizeMime(mime, transfer) {
      var code = /HLG|ARIB_STD_B67/i.test(transfer || '') ? '18' : '16';
      return String(mime || '').replace(/\bvp9\.2\b/gi, 'vp09.02.51.10.01.09.' + code + '.09.00');
    }
    function isVp9(f) { return /vp0?9/i.test(f.mimeType || ''); }
    function hasQualityMenu() {
      return !!(root.__ttQualityController && typeof root.__ttQualityController.getRows === 'function');
    }
    function manualSelection(videoId) {
      try {
        var q = root.__ttQualityController, sel = q && typeof q.getSelection === 'function' ? q.getSelection() : null;
        return sel && sel.videoId === videoId ? sel : null;
      } catch (_) { return null; }
    }
    function manualNeedsWeb(videoId) {
      var sel = manualSelection(videoId);
      return !!(sel && sel.needsWeb);
    }
    function manualPrefersTv(videoId) {
      var sel = manualSelection(videoId);
      return !!(sel && !sel.needsWeb);
    }
    function eligible(response) {
      var d = response && response.videoDetails, af = response && response.streamingData && response.streamingData.adaptiveFormats;
      if (!d || !/^[\w-]{11}$/.test(d.videoId || '') || d.isLiveContent || d.isLive || d.isPrivate || !Array.isArray(af)) return null;
      if (response.microformat && response.microformat.playerMicroformatRenderer && response.microformat.playerMicroformatRenderer.liveBroadcastDetails) return null;
      var cfg = config(), av1Cap = policy.resolveConfig(cfg).av1Mbps * 1e6, top = 0, constrained = cfg.preferredVideoCodec === 'vp9';
      af.forEach(function (f) { if (/av01|av1/i.test(f.mimeType || '') && f.height >= 1440) {
        top = Math.max(top, Math.min(2160, f.height));
        var rate = policy.representativeBitrate(f);
        if (!rate || rate.bps > av1Cap) constrained = true;
      }});
      if (!top || af.some(function (f) { return isVp9(f) && f.height >= top; })) return null;
      if (!constrained && !hasQualityMenu()) return null;
      return {id: d.videoId, height: top, constrained: constrained};
    }
    function validVp9(f, height) {
      try {
        var transfer = f && f.colorInfo && f.colorInfo.transferCharacteristics;
        return isVp9(f) && f.height >= height && f.height <= 2160 && (!f.width || f.width <= 3840) &&
          (!f.fps || f.fps <= 60) && policy.assess(f, config(), true).state === 'DISCOVERED' &&
          (!root.MediaSource || root.MediaSource.isTypeSupported(normalizeMime(f.mimeType, transfer)));
      } catch (_) { return false; }
    }
    function player() { return root.document.getElementById('movie_player') || root.document.querySelector('.html5-video-player'); }
    function currentId() {
      try { var p = player(); return p && p.getVideoData && p.getVideoData().video_id; } catch (_) { return null; }
    }
    function trim(map) {
      var playing = currentId();
      while (map.size > 8) {
        var key = Array.from(map.keys()).find(function (id) { return id !== playing; });
        if (!key) break;
        map.delete(key);
      }
    }
    function reload(id) {
      if (disposed) return;
      var p = player(), v = root.document.querySelector('video');
      if (!p || !p.getVideoData || p.getVideoData().video_id !== id) return;
      var quality = root.__ttQualityController, intent = quality && quality.getPlaybackIntent && quality.getPlaybackIntent(id);
      var method = (intent ? intent.paused : v && v.paused) ? p.cueVideoById : p.loadVideoById;
      if (typeof method !== 'function') return;
      diagnostics.reloads++;
      var time = intent ? intent.time : typeof p.getCurrentTime === 'function' ? Number(p.getCurrentTime()) : v && v.currentTime || 0;
      method.call(p, {videoId: id, startSeconds: Number.isFinite(time) && time >= 0 ? time : 0, suggestedQuality: 'hd2160'});
    }
    async function timedFetch(url, options) {
      var controller = new root.AbortController(), timer = root.setTimeout(function () { controller.abort(); }, 12000);
      controllers.add(controller);
      function finish() { root.clearTimeout(timer); controllers.delete(controller); }
      try {
        var response = await originalFetch(url, Object.assign({}, options, {signal: controller.signal}));
        if (!response.ok) { finish(); throw new Error('http-failure'); }
        return {ok: response.ok, status: response.status,
          json: async function () { try { return await response.json(); } finally { finish(); } },
          text: async function () { try { return await response.text(); } finally { finish(); } }};
      } catch (error) { finish(); throw error; }
    }
    function timestamp() {
      if (!signaturePromise) signaturePromise = (async function () {
        var script = Array.from(root.document.scripts).find(function (s) { return /\/s\/player\/[^/]+\/.*tv-player.*\.js/.test(s.src); });
        if (!script) throw new Error('player-version-unavailable');
        var response = await timedFetch(script.src), text = await response.text(), match = text.match(/signatureTimestamp\s*:\s*(\d+)/);
        if (!match) throw new Error('player-timestamp-unavailable');
        return Number(match[1]);
      })().catch(function (error) { signaturePromise = null; throw error; });
      return signaturePromise;
    }
    function minter() {
      if (!minterPromise || (minterExpiry && Date.now() >= minterExpiry)) {
        if (!root.TTWebPo || !root.TTWebPo.createMinter) return Promise.reject(new Error('minter-unavailable'));
        var retired = minterPromise;
        minterExpiry = 0;
        minterPromise = (retired ? retired.then(function (m) { return m.dispose(); }).catch(function () {}) : Promise.resolve()).then(function () {
          return root.TTWebPo.createMinter(timedFetch);
        }).then(function (value) {
          minterExpiry = Date.now() + Math.max(30000, value.ttlMs - 60000); return value;
        }).catch(function (error) { minterPromise = null; throw error; });
      }
      return minterPromise;
    }
    async function metadata(id) {
      var cfg = root.ytcfg, old = cfg && cfg.get('INNERTUBE_CONTEXT'), key = cfg && cfg.get('INNERTUBE_API_KEY');
      if (!old || !old.client || !key) throw new Error('context-unavailable');
      var sts = await timestamp();
      var cookies = {};
      (root.document.cookie || '').split(';').forEach(function (item) { var i = item.indexOf('='); if (i > 0) cookies[item.slice(0, i).trim()] = item.slice(i + 1); });
      var secret = cookies.SAPISID || cookies['__Secure-3PAPISID'];
      if (secret) {
        var seconds = Math.floor(Date.now() / 1000), bytes = new root.TextEncoder().encode(seconds + ' ' + secret + ' ' + root.location.origin);
        var digest = await root.crypto.subtle.digest('SHA-1', bytes), hash = Array.from(new Uint8Array(digest), function (v) { return v.toString(16).padStart(2, '0'); }).join('');
        var version = '2.20261113.00.00', client = {clientName: 'WEB', clientVersion: version, platform: 'DESKTOP',
          hl: old.client.hl, gl: old.client.gl, visitorData: old.client.visitorData, userAgent: root.navigator.userAgent};
        diagnostics.requests++;
        var r = await timedFetch('/youtubei/v1/player?key=' + encodeURIComponent(key) + '&prettyPrint=false', {
          method: 'POST', credentials: 'include', headers: {'Content-Type': 'application/json',
            Authorization: 'SAPISIDHASH ' + seconds + '_' + hash, 'X-Youtube-Client-Name': '1', 'X-Youtube-Client-Version': version,
            'X-Goog-AuthUser': String(cfg.get('SESSION_INDEX') || 0), 'X-Youtube-Bootstrap-Logged-In': 'true', 'X-Goog-Visitor-Id': client.visitorData},
          body: stringify({context: {client: client}, videoId: id, contentCheckOk: true,
            playbackContext: {contentPlaybackContext: {html5Preference: 'HTML5_PREF_WANTS', signatureTimestamp: sts}}})});
        return r.json();
      }
      if (!hasQualityMenu()) throw new Error('web-login-required');
      var tvSimply = {clientName: 'TVHTML5_SIMPLY', clientVersion: '1.0', platform: 'TV',
        hl: old.client.hl, gl: old.client.gl, visitorData: old.client.visitorData};
      diagnostics.requests++;
      var r2 = await timedFetch('/youtubei/v1/player?key=' + encodeURIComponent(key) + '&prettyPrint=false', {
        method: 'POST', credentials: 'omit', headers: {'Content-Type': 'application/json', 'X-Goog-Visitor-Id': tvSimply.visitorData},
        body: stringify({context: {client: tvSimply}, videoId: id, contentCheckOk: true, racyCheckOk: true,
          playbackContext: {contentPlaybackContext: {html5Preference: 'HTML5_PREF_WANTS', signatureTimestamp: sts}}})});
      return r2.json();
    }
    function prepare(target) {
      var entry = {status: 'pending', expires: Date.now() + 60000}; cache.set(target.id, entry);
      trim(cache);
      var hasWebCookie = /(?:^|;)\s*(?:SAPISID|__Secure-3PAPISID)=/.test(root.document.cookie || '');
      if (!hasWebCookie && !hasQualityMenu()) {
        entry.status = 'failed'; diagnostics.lastStatus = 'failed'; diagnostics.lastReason = 'web-login-required'; return;
      }
      diagnostics.pending++; diagnostics.lastStatus = 'pending'; diagnostics.lastReason = null;
      Promise.all([metadata(target.id), minter().then(function (m) { return m.mint(target.id); })]).then(function (values) {
        if (disposed || cache.get(target.id) !== entry) return;
        var r = values[0], token = values[1], sd = r && r.streamingData,
          us = r && r.playerConfig && r.playerConfig.mediaCommonConfig && r.playerConfig.mediaCommonConfig.mediaUstreamerRequestConfig;
        if (!r || !r.playabilityStatus || r.playabilityStatus.status !== 'OK') throw new Error('web-response-unplayable');
        if (r.responseContext && r.responseContext.mainAppWebResponseContext && r.responseContext.mainAppWebResponseContext.loggedOut === true) throw new Error('web-login-required');
        if (!r.videoDetails || r.videoDetails.videoId !== target.id || r.videoDetails.isLiveContent || !sd || !us || !sd.serverAbrStreamingUrl ||
          !Array.isArray(sd.adaptiveFormats) || !sd.adaptiveFormats.some(function (f) { return validVp9(f, target.height); })) throw new Error('web-formats-invalid');
        var url = new root.URL(sd.serverAbrStreamingUrl), streamId = url.searchParams.get('id');
        if (!/\.googlevideo\.com$/.test(url.hostname) || !streamId || !token) throw new Error('web-transport-invalid');
        var raw = root.atob(token.replace(/-/g, '+').replace(/_/g, '/').replace(/\./g, '='));
        entry.token = Uint8Array.from(raw, function (c) { return c.charCodeAt(0); }); entry.sd = sd; entry.us = us; entry.streamId = streamId;
        var signedExpiry = Number(url.searchParams.get('expire')) * 1000;
        entry.transportExpires = Math.min(Date.now() + (Number(sd.expiresInSeconds) || 3600) * 1000, signedExpiry > 0 ? signedExpiry : Infinity) - 60000;
        entry.status = 'ready'; entry.expires = Date.now() + Math.min(120000, Math.max(10000, (Number(sd.expiresInSeconds) || 3600) * 1000 - 60000));
        diagnostics.lastStatus = 'ready';
        if ((target.constrained && !manualPrefersTv(target.id)) || manualNeedsWeb(target.id)) reload(target.id);
      }).catch(function (error) {
        entry.status = 'failed'; entry.expires = Date.now() + 60000;
        diagnostics.lastStatus = 'failed';
        // Only constant local error identifiers are exposed; never remote payloads.
        diagnostics.lastReason = /^[a-z-]+$/.test(error.message || '') ? error.message : 'preparation-failed';
      }).finally(function () { diagnostics.pending--; });
    }
    function getSupplementalResponse(videoId) {
      if (disposed || !videoId) return null;
      var entry = cache.get(videoId) || transports.get(videoId);
      if (!entry || entry.status !== 'ready' || !entry.sd || !Array.isArray(entry.sd.adaptiveFormats)) return null;
      return {videoDetails: {videoId: videoId}, streamingData: {adaptiveFormats: parse(stringify(entry.sd.adaptiveFormats))}};
    }
    function apply(response) {
      try {
        var target = eligible(response);
        if (!target) {
          if (response && response.videoDetails) {
            var details = response.videoDetails, sd = response.streamingData, previous = transports.get(details.videoId);
            var sameStream = previous && sd && sd.serverAbrStreamingUrl === previous.sd?.serverAbrStreamingUrl;
            if (previous && (details.isLiveContent || details.isLive || !sameStream)) transports.delete(details.videoId);
          }
          return;
        }
        var entry = cache.get(target.id);
        if (!entry || entry.expires <= Date.now()) { prepare(target); entry = cache.get(target.id); }
        var shouldSplice = (target.constrained && !manualPrefersTv(target.id)) || manualNeedsWeb(target.id);
        if (!shouldSplice) {
          if (response && response.videoDetails) {
            var prev = transports.get(target.id), curSd = response.streamingData;
            var same = prev && curSd && curSd.serverAbrStreamingUrl === prev.sd?.serverAbrStreamingUrl;
            if (prev && !same) transports.delete(target.id);
          }
          return;
        }
        if ((!entry || entry.status !== 'ready') && target.id === currentId()) {
          var playing = transports.get(target.id);
          if (playing && playing.status === 'ready' && playing.transportExpires > Date.now()) entry = playing;
        }
        if (!entry || entry.status !== 'ready' || !entry.sd.adaptiveFormats.some(function (f) { return validVp9(f, target.height); })) return;
        response.streamingData = parse(stringify(entry.sd));
        response.playerConfig = response.playerConfig || {};
        response.playerConfig.mediaCommonConfig = response.playerConfig.mediaCommonConfig || {};
        response.playerConfig.mediaCommonConfig.mediaUstreamerRequestConfig = parse(stringify(entry.us));
        response.__ttVp9FallbackApplied = true;
        entry.applied = true;
        transports.set(target.id, entry); trim(transports);
      } catch (_) { diagnostics.lastStatus = 'failed'; diagnostics.lastReason = 'apply-failed'; }
    }
    function matches(url) {
      if (disposed) return false;
      try {
        var id = currentId(), entry = transports.get(id);
        if (!entry || !entry.applied || entry.status !== 'ready') return false;
        var u = new root.URL(url, root.location.origin);
        if (!/\.googlevideo\.com$/.test(u.hostname) || u.pathname !== '/videoplayback' ||
          u.searchParams.get('sabr') !== '1' || u.searchParams.get('id') !== entry.streamId) return false;
        active = {id: id, entry: entry};
        return true;
      } catch (_) { return false; }
    }
    function rewrite(url, body) { return matches(url) ? injectPoToken(body, active.entry.token) : body; }
    function failed(url) {
      if (!matches(url)) return;
      var id = active.id, entry = active.entry; active = null; entry.status = 'failed'; entry.expires = Date.now() + 60000;
      transports.delete(id); cache.set(id, entry);
      diagnostics.lastStatus = 'failed'; diagnostics.lastReason = 'sabr-http-failure';
      root.setTimeout(function () { reload(id); }, 0);
    }
    var patchedFetch;
    if (originalFetch) root.fetch = patchedFetch = async function (input, init) {
      var url = typeof input === 'string' ? input : input && input.url || String(input), options = init;
      if (matches(url)) {
        if (init && init.body) options = Object.assign({}, init, {body: rewrite(url, init.body)});
        else if (input && input.clone && root.Request) {
          var body = await input.clone().arrayBuffer(); input = new root.Request(input, {body: rewrite(url, body)});
        }
      }
      var r = await originalFetch(input, options);
      if (r.status === 401 || r.status === 403) failed(url);
      return r;
    };
    var proto = root.XMLHttpRequest && root.XMLHttpRequest.prototype, open, send, patchedOpen, patchedSend;
    if (proto) {
      open = proto.open; send = proto.send;
      proto.open = patchedOpen = function (method, url) { this.__ttVp9Url = String(url); return open.apply(this, arguments); };
      proto.send = patchedSend = function (body) {
        var xhr = this, url = xhr.__ttVp9Url;
        if (matches(url)) xhr.addEventListener('load', function () { if (xhr.status === 401 || xhr.status === 403) failed(url); }, {once: true});
        return send.call(xhr, rewrite(url, body));
      };
    }
    return {apply: apply, rewrite: rewrite, getSupplementalResponse: getSupplementalResponse, getDiagnostics: function () { return Object.assign({}, diagnostics); }, dispose: function () {
      if (disposed) return;
      disposed = true; active = null; cache.clear(); transports.clear(); controllers.forEach(function (c) { c.abort(); });
      if (root.fetch === patchedFetch) root.fetch = originalFetch;
      if (proto && proto.open === patchedOpen) proto.open = open;
      if (proto && proto.send === patchedSend) proto.send = send;
      if (minterPromise) minterPromise.then(function (m) { return m.dispose(); }).catch(function () {});
    }};
  }
  return {injectPoToken: injectPoToken, create: create};
});
