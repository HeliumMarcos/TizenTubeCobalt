/* Real video format catalogue and bitrate policy. No signed URLs in catalogue rows. */
(function (root, build) {
  var policy = typeof module === 'object' && module.exports ? require('./l1/src/bitrate-policy.js') : root.TTL1BitratePolicy;
  var api = build(policy);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TTQualityFormats = api;
})(typeof window === 'object' ? window : globalThis, function (policy) {
  'use strict';
  var stringify = JSON.stringify.bind(JSON);
  function positive(value) { var n = Number(value); return Number.isFinite(n) && n > 0 ? n : 0; }
  function normalizeMime(mime, transfer) {
    var code = /HLG|ARIB_STD_B67/i.test(transfer || '') ? '18' : '16';
    return String(mime || '').replace(/\bvp9\.2\b/gi, 'vp09.02.51.10.01.09.' + code + '.09.00');
  }
  function sortRows(a, b) {
    return b.height-a.height || Number(b.hdr)-Number(a.hdr) || b.fps-a.fps ||
      ['AV1','VP9','HEVC','AVC','Desconhecido'].indexOf(a.codec)-['AV1','VP9','HEVC','AVC','Desconhecido'].indexOf(b.codec) || a.bitrate-b.bitrate || a.itag-b.itag;
  }
  function qualityForHeight(h) {
    if (h >= 2160) return 'hd2160';
    if (h >= 1440) return 'hd1440';
    if (h >= 1080) return 'hd1080';
    if (h >= 720) return 'hd720';
    if (h >= 480) return 'large';
    if (h >= 360) return 'medium';
    if (h >= 240) return 'small';
    if (h > 0) return 'tiny';
    return 'auto';
  }
  function codec(format) {
    var mime = format.mimeType || '';
    if (/av01|av1/i.test(mime)) return 'AV1';
    if (/vp0?9/i.test(mime)) return 'VP9';
    if (/avc1|avc3/i.test(mime)) return 'AVC';
    if (/hev1|hvc1/i.test(mime)) return 'HEVC';
    return 'Desconhecido';
  }
  function identity(response, format) {
    return stringify([response.videoDetails && response.videoDetails.videoId || '', String(format.itag),
      String(format.lastModified || format.lmt || ''), String(format.xtags || '')]);
  }
  function formats(response) { return response && response.streamingData && response.streamingData.adaptiveFormats || []; }
  function isLiveResponse(response) {
    var d = response && response.videoDetails;
    if (d && (d.isLiveContent || d.isLive)) return true;
    var mf = response && response.microformat && response.microformat.playerMicroformatRenderer;
    return !!(mf && mf.liveBroadcastDetails && mf.liveBroadcastDetails.isLiveNow);
  }
  function catalogue(response, config, supports) {
    config = config || {}; var seen = new Set(), rows = [], live = isLiveResponse(response);
    formats(response).forEach(function (f) {
      if (!/^video\//i.test(f.mimeType || '') || !positive(f.itag) || !positive(f.height)) return;
      var id = identity(response, f); if (seen.has(id)) return; seen.add(id);
      var c = codec(f), representative = policy.representativeBitrate(f);
      if (!representative && live && positive(f.bitrate)) representative = {bps: positive(f.bitrate), source: 'liveBitrate'};
      var rate = representative ? representative.bps : 0, fps = positive(f.fps);
      var transfer = f.colorInfo && f.colorInfo.transferCharacteristics || '';
      var hdr = policy.isHdrFormat(f);
      var limits = policy.resolveConfig(config), max = (c === 'AV1' ? limits.av1Mbps : limits.otherMbps) * 1e6, reason = null;
      if (f.height > 2160 || positive(f.width) > 3840 || fps > 60) reason = 'hardware-dimensions';
      else if (c === 'Desconhecido') reason = 'codec-unknown';
      else {
        try { if (supports && !supports(normalizeMime(f.mimeType, transfer))) reason = 'hardware-codec'; }
        catch (_) { reason = 'hardware-codec'; }
      }
      if (!reason && !rate) reason = 'bitrate-unknown';
      if (!reason && rate > max) reason = c === 'AV1' ? 'av1-bitrate-limit' : 'other-bitrate-limit';
      var parts = [f.height + 'p']; if (hdr) parts.push('HDR');
      parts.push(fps ? fps + ' FPS' : 'FPS não informado');
      parts.push(rate ? Number((rate / 1000000).toFixed(2)) + ' Mbps' : 'Bitrate não informado'); parts.push(c);
      rows.push({id:id, itag:Number(f.itag), height:Number(f.height), fps:fps, hdr:hdr, codec:c, mimeType:f.mimeType,
        bitrate:rate, bitrateMbps:rate / 1000000, averageBitrate:positive(f.averageBitrate)||0,
        effectiveBitrate:policy.effectiveBitrate(f, live),
        bitrateKind:representative ? representative.source : 'unknown',advertisedPeakBps:positive(f.bitrate)||null,
        blocked:!!reason, reason:reason, limitMbps:max / 1000000, label:parts.join(' / ')});
    });
    return rows.sort(sortRows);
  }
  function allowedFormats(response, config, supports, selectedId) {
    var rows = catalogue(response, config, supports), allowed = rows.filter(function (r) { return !r.blocked; });
    if (selectedId != null) {
      var selected = rows.find(function (r) { return r.id === selectedId; });
      if (!selected) throw new Error('Selected format unavailable');
      if (selected.blocked) throw new Error('Selected format blocked');
      allowed = [selected];
    } else {
      var live = isLiveResponse(response);
      var preference = {av01:'AV1',av1:'AV1',vp9:'VP9',avc1:'AVC',hvc1:'HEVC',hev1:'HEVC'}[(config || {}).preferredVideoCodec];
      if (preference) {
        var rank = {AV1:0, VP9:1, HEVC:2, AVC:3};
        rank[preference] = -1;
        var best = new Map();
        function group(r) { return [r.height,r.fps,r.hdr].join('/'); }
        allowed.forEach(function (r) {
          var key = group(r), cur = best.get(key);
          if (!cur || rank[r.codec] < rank[cur.codec] || (rank[r.codec] === rank[cur.codec] && r.effectiveBitrate > cur.effectiveBitrate)) {
            best.set(key, r);
          }
        });
        allowed = Array.from(best.values());
      } else {
        var hdrSupported = true;
        if (supports) {
          try {
            hdrSupported = !!(supports('video/webm; codecs="vp09.02.51.10.01.09.16.09.00"') ||
              supports('video/mp4; codecs="av01.0.12M.10.0.110.09.16.09.0"'));
          } catch (_) { hdrSupported = true; }
        }
        var opts = {isLive: live, hdrSupported: hdrSupported, preferHdr: (config || {}).preferHdr !== false};
        var sorted = allowed.slice().sort(function (a, b) { return policy.compareVisualQuality(a, b, opts); });
        var winners = new Map();
        sorted.forEach(function (r) {
          var tier = r.height + '/' + r.fps;
          if (!winners.has(tier)) winners.set(tier, r);
        });
        allowed = Array.from(winners.values());
      }
    }
    var ids = new Set(allowed.map(function (r) { return r.id; }));
    return formats(response).filter(function (f) { return /^audio\//i.test(f.mimeType || '') || ids.has(identity(response,f)); }).map(function (f) {
      if (!/^video\//i.test(f.mimeType || '')) return f;
      var normalized = normalizeMime(f.mimeType, f.colorInfo && f.colorInfo.transferCharacteristics);
      return normalized === f.mimeType ? f : Object.assign({}, f, {mimeType: normalized});
    });
  }
  function present(row) {
    function number(value) { return Number(Number(value).toFixed(2)).toString().replace('.',','); }
    var title=[row.height+'p']; if (row.hdr) title.push('HDR'); if (row.fps) title.push(number(row.fps)+' fps');
    var status='';
    if (row.reason==='av1-bitrate-limit' || row.reason==='other-bitrate-limit') status='Limite '+number(row.limitMbps)+' Mbps';
    else if (row.blocked) status='Indisponível';
    return {title:title.join('\u2002'),subtitle:row.codec+'\u2002'+(row.bitrate ? number(row.bitrateMbps) : '—')+' Mbps',status:status};
  }
  function create(root) {
    var parse = JSON.parse.bind(JSON), entries = new Map(), tvEntries = new Map(), manual = null, intent = null, wrappers = [], disposed = false, timer = null;
    var menuDiagnostics={intercepted:0,enriched:0,failed:0,lastError:null};
    var generation = 0, session = Date.now().toString(36) + Math.random().toString(36).slice(2);
    function copy(value) { return parse(stringify(value)); }
    function player() { return root.document.getElementById('movie_player') || root.document.querySelector('.html5-video-player'); }
    function currentId() { try { return player().getVideoData().video_id; } catch (_) { return null; } }
    function sync() { var id=currentId(); if(manual && id && manual.videoId!==id)manual=null; if(intent && id && intent.videoId!==id)intent=null; }
    function config() { try { return parse(root.localStorage.getItem('ytaf-configuration') || '{}'); } catch (_) { return {}; } }
    function supports(mime) { return !root.MediaSource || root.MediaSource.isTypeSupported(normalizeMime(mime)); }
    function supplemental(videoId) {
      try { return root.__ttVp9Fallback && typeof root.__ttVp9Fallback.getSupplementalResponse === 'function' ? root.__ttVp9Fallback.getSupplementalResponse(videoId) : null; }
      catch (_) { return null; }
    }
    function rowsFor(videoId) {
      var e=tvEntries.get(videoId) || entries.get(videoId); if (!e) return [];
      var cfg=config(), baseNeedsWeb=!!e.__ttVp9FallbackApplied;
      var rows=catalogue(e,cfg,supports).map(function (r) { return Object.assign({},r,{needsWeb:baseNeedsWeb}); });
      var seenItags=new Set(rows.map(function (r) { return r.itag; }));
      var sup=supplemental(videoId);
      if (sup) {
        catalogue(sup,cfg,supports).forEach(function (r) {
          if (!seenItags.has(r.itag)) { seenItags.add(r.itag); rows.push(Object.assign({},r,{needsWeb:true})); }
        });
      }
      var active=entries.get(videoId);
      if (active && active!==e) {
        var activeNeedsWeb=!!active.__ttVp9FallbackApplied;
        catalogue(active,cfg,supports).forEach(function (r) {
          if (!seenItags.has(r.itag)) { seenItags.add(r.itag); rows.push(Object.assign({},r,{needsWeb:activeNeedsWeb})); }
        });
      }
      return rows.sort(sortRows);
    }
    function getRows() { sync(); return rowsFor(currentId()); }
    function applySelectedQuality() {
      sync(); if (disposed || !manual || manual.videoId!==currentId() || !manual.height) return false;
      var p=player(), q=qualityForHeight(manual.height);
      if (!p || q==='auto') return false;
      try { if (typeof p.setPlaybackQualityRange==='function') p.setPlaybackQualityRange(q,q); } catch (_) {}
      try { if (typeof p.setPlaybackQuality==='function') p.setPlaybackQuality(q); } catch (_) {}
      return true;
    }
    function resolveSelectedId(raw, sel) {
      if (!sel) return null;
      var rows=catalogue(raw,config(),supports);
      var exact=rows.find(function (r) { return r.id===sel.id; });
      if (exact) return exact.id;
      if (sel.itag!=null) {
        var byItag=rows.find(function (r) { return r.itag===sel.itag; });
        if (byItag) return byItag.id;
      }
      return sel.id;
    }
    function apply(response) {
      sync(); var id=response && response.videoDetails && response.videoDetails.videoId;
      if (!id || !response.streamingData || !Array.isArray(response.streamingData.adaptiveFormats)) return;
      var old=entries.get(id), tag=response.__ttQualityCatalogueKey;
      var reparsed=old && tag && tag===old.__ttQualityCatalogueKey && old.streamingData.serverAbrStreamingUrl===response.streamingData.serverAbrStreamingUrl;
      if (!reparsed) {
        var captured=copy(response); captured.__ttQualityCatalogueKey=session+':'+(++generation); entries.set(id,captured);
        if (!response.__ttVp9FallbackApplied) tvEntries.set(id,copy(captured));
      }
      response.__ttQualityCatalogueKey=entries.get(id).__ttQualityCatalogueKey;
      while (entries.size > 8) { var key=Array.from(entries.keys()).find(function (k) { return k!==currentId(); }); if (!key) break; entries.delete(key); tvEntries.delete(key); }
      var raw=entries.get(id), sel=manual && manual.videoId===id ? manual : null, selected=resolveSelectedId(raw,sel);
      try { response.streamingData.adaptiveFormats=allowedFormats(raw,config(),supports,selected); }
      catch (_) { if (selected) manual=null; response.streamingData.adaptiveFormats=allowedFormats(raw,config(),supports); }
    }
    function select(videoId,id) {
      sync(); if (disposed || currentId()!==videoId) return false;
      var rows=rowsFor(videoId); if (!rows.length) return false;
      var row=null;
      if (id!=null) {
        row=rows.find(function (r) { return r.id===id; });
        if (!row || row.blocked) return false;
      }
      var p=player(), v=root.document.querySelector('video'), previous=getPlaybackIntent(videoId);
      var paused=previous ? previous.paused : !!(v && v.paused);
      var method=paused ? p.cueVideoById : p.loadVideoById;
      if (typeof method!=='function') return false;
      var time=previous ? previous.time : typeof p.getCurrentTime==='function' ? Number(p.getCurrentTime()) : v && v.currentTime || 0;
      if (!Number.isFinite(time) || time<0) time=v && v.currentTime || 0;
      manual=id==null ? null : {videoId:videoId,id:row.id,itag:row.itag,height:row.height,codec:row.codec,hdr:row.hdr,needsWeb:!!row.needsWeb};
      intent={videoId:videoId,time:time,paused:paused,expires:Date.now()+60000};
      var loadArgs={videoId:videoId,startSeconds:time};
      if (row) loadArgs.suggestedQuality=qualityForHeight(row.height);
      method.call(p,loadArgs);
      if (row) applySelectedQuality();
      return true;
    }
    function getPlaybackIntent(videoId) {
      sync(); if(disposed || !intent || intent.videoId!==videoId)return null;
      if(Date.now()>=intent.expires) {intent=null;return null;}
      var p=player(),v=root.document.querySelector('video');
      var state=p && typeof p.getPlayerState==='function' ? p.getPlayerState() : null;
      var time=p && typeof p.getCurrentTime==='function' ? Number(p.getCurrentTime()) : v && v.currentTime || 0;
      if((state===1 || state===2 || state===5) && time>=intent.time-1) {intent=null;return null;}
      return {time:intent.time,paused:intent.paused};
    }
    function getSelection() { sync(); return manual ? Object.assign({},manual) : null; }
    function menu(command) {
      var rows=getRows(); if (!rows.length) return command;
      // Final title/subtitle data reaches the native renderer in this only dispatch.
      // Do not decorate its DOM after opening: recycled lists can flash unstyled.
      var result=copy(command), panel=result.openPopupAction.popup.overlaySectionRenderer.overlay.overlayTwoPanelRenderer.actionPanel.overlayPanelRenderer;
      var list=panel.content.overlayPanelItemListRenderer, id=currentId(), playing=null;
      try { var match=(player().getStatsForNerds().codecs || '').match(/\((\d+)\)/); playing=match && Number(match[1]); } catch (_) {}
      var isManual=!!(manual && manual.videoId===id);
      function item(label,selection,subtitle,blocked,checked) {
        var r={title:{simpleText:label},isDisabled:!!blocked,isSelected:!!checked,serviceEndpoint:{customAction:{action:'TT_QUALITY_SELECT',parameters:{videoId:id,id:selection}}}};
        if (subtitle) r.subtitle={simpleText:subtitle}; if (checked) r.secondaryIcon={iconType:'CHECK'};
        return {compactLinkRenderer:r};
      }
      list.items=[item('Automática',null,'',false,!isManual)];
      var playingIndex=-1;
      rows.forEach(function (r, idx) {
        var display=present(r);
        var isPlaying=isManual ? (r.id===manual.id || r.itag===manual.itag) : (playing!=null && playing===r.itag);
        if (isPlaying && playingIndex<0) playingIndex=idx+1;
        list.items.push(item(display.title,r.id,display.subtitle+(display.status ? '\u2002'+display.status : ''),r.blocked,isPlaying));
      });
      var manualIndex=isManual ? rows.findIndex(function (r) { return r.id===manual.id || r.itag===manual.itag; })+1 : 0;
      list.selectedIndex=Math.max(0,manualIndex>0 ? manualIndex : (playingIndex>0 ? playingIndex : 0));
      menuDiagnostics.enriched++;return result;
    }
    function installMenu() {
      if (disposed) return;
      var installed=false;
      for (var key in root._yttv || {}) {
        var instance=root._yttv[key] && root._yttv[key].instance;
        if (!instance || typeof instance.resolveCommand!=='function') continue;
        if (wrappers.some(function (w) { return w.instance===instance; })) { installed=true; continue; }
        (function (owner) {
          var original=owner.resolveCommand;
          function patched(command) {
            if (command && command.customAction && command.customAction.action==='TT_QUALITY_SELECT') {
              var args=command.customAction.parameters || {};
              var ok=select(args.videoId,args.id);
              if (ok) { try { original.call(this,{signalAction:{signal:'POPUP_BACK'}}); } catch (_) {} }
              return ok;
            }
            var callArgs=Array.from(arguments);
            if (command && command.openPopupAction && command.openPopupAction.uniqueId==='quality-selector') {
              menuDiagnostics.intercepted++;try { callArgs[0]=menu(command); } catch (error) {menuDiagnostics.failed++;menuDiagnostics.lastError=error&&error.name||'Error';}
            }
            return original.apply(this,callArgs);
          }
          owner.resolveCommand=patched; wrappers.push({instance:owner,original:original,patched:patched}); installed=true;
        })(instance);
      }
      if (!installed && root.setTimeout) timer=root.setTimeout(installMenu,500);
    }
    return {getMenuDiagnostics:function(){return Object.assign({},menuDiagnostics);},apply:apply,applySelectedQuality:applySelectedQuality,getRows:getRows,select:select,getSelection:getSelection,getPlaybackIntent:getPlaybackIntent,installMenu:installMenu,dispose:function () {
      disposed=true; if (timer!=null) root.clearTimeout(timer); entries.clear(); tvEntries.clear(); manual=null; intent=null;
      wrappers.forEach(function (w) { if (w.instance.resolveCommand===w.patched) w.instance.resolveCommand=w.original; }); wrappers=[];
    }};
  }
  return {catalogue:catalogue, allowedFormats:allowedFormats, present:present, normalizeMime:normalizeMime, create:create};
});
