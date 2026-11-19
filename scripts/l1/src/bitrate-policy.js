/* Operational policy only. References and signed transport data are not capabilities. */
(function(root,build){var api=build();if(typeof module==='object'&&module.exports)module.exports=api;else root.TTL1BitratePolicy=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  var DEFAULTS=Object.freeze({av1Mbps:40,otherMbps:100});
  var CODEC_MULTIPLIERS=Object.freeze({
    vod:Object.freeze({AV1:1.70,VP9:1.35,HEVC:1.35,AVC:1.00}),
    live:Object.freeze({AV1:1.50,VP9:1.25,HEVC:1.25,AVC:1.00})
  });
  function positive(v){return typeof v==='number'&&Number.isFinite(v)&&v>0;}
  function cap(v,fallback){if(v==='unlimited')return Infinity;var n=Number(v);return Number.isFinite(n)&&n>0?n:fallback;}
  function resolveConfig(cfg){cfg=cfg||{};return {av1Mbps:cap(cfg.maxAv1BitrateMbps,DEFAULTS.av1Mbps),otherMbps:cap(cfg.maxOtherBitrateMbps,DEFAULTS.otherMbps)};}
  function codecFamily(mime){
    var m=String(mime||'');
    if(/av01|av1/i.test(m))return 'AV1';
    if(/vp0?9/i.test(m))return 'VP9';
    if(/hev1|hvc1/i.test(m))return 'HEVC';
    if(/avc1|avc3/i.test(m))return 'AVC';
    return 'Desconhecido';
  }
  function isHdrFormat(format){
    if(!format)return false;
    var tc=format.colorInfo&&format.colorInfo.transferCharacteristics||'';
    if(/SMPTEST2084|ARIB_STD_B67/i.test(tc))return true;
    if(/HDR/i.test(format.qualityLabel||''))return true;
    var mime=String(format.mimeType||'');
    return /vp0?9\.0?2/i.test(mime)||/av01\.\d+\.\d+[mh]\.10/i.test(mime);
  }
  function streamBitrate(meta){
    var rep=representativeBitrate(meta);
    if(rep)return rep.bps;
    return meta&&positive(meta.bitrate)?meta.bitrate:0;
  }
  function effectiveBitrate(meta,isLive){
    var bps=streamBitrate(meta);
    if(!bps)return 0;
    var table=isLive?CODEC_MULTIPLIERS.live:CODEC_MULTIPLIERS.vod;
    var mult=table[codecFamily(meta&&meta.mimeType)]||1.0;
    return bps*mult;
  }
  function compareVisualQuality(a,b,options){
    options=options||{};
    var hDiff=(b.height||0)-(a.height||0);
    if(hDiff)return hDiff;
    var fpsDiff=(b.fps||0)-(a.fps||0);
    if(fpsDiff)return fpsDiff;
    var wantHdr=!!(options.hdrSupported&&options.preferHdr!==false);
    var aHdr=typeof a.hdr==='boolean'?a.hdr:isHdrFormat(a);
    var bHdr=typeof b.hdr==='boolean'?b.hdr:isHdrFormat(b);
    if(aHdr!==bHdr)return wantHdr?(bHdr?1:-1):(aHdr?1:-1);
    return effectiveBitrate(b,options.isLive)-effectiveBitrate(a,options.isLive);
  }
  function representativeBitrate(meta){
    if(!meta)return null;
    if(positive(meta.averageBitrate))return {bps:meta.averageBitrate,source:'averageBitrate'};
    if(positive(meta.hlsAverageBandwidth))return {bps:meta.hlsAverageBandwidth,source:'HLS-AVERAGE-BANDWIDTH'};
    var e=meta.observedBitrateEvidence;
    if(positive(meta.observedAverageBitrate)&&e&&e.method==='segment-bytes'&&positive(e.bytes)&&positive(e.durationSeconds)){
      var computed=e.bytes*8/e.durationSeconds;
      if(Number.isFinite(computed)&&Math.abs(computed-meta.observedAverageBitrate)<=Math.max(1,computed*.001))return {bps:computed,source:'observed-average'};
    }
    return null;
  }
  function assess(meta,cfg,supported){
    var limits=resolveConfig(cfg),isAv1=/av01|av1/i.test(meta&&meta.mimeType||''),limitMbps=isAv1?limits.av1Mbps:limits.otherMbps;
    var rate=representativeBitrate(meta),result={state:'DISCOVERED',reason:null,representative:rate,limitMbps:limitMbps};
    if(supported===false){result.state='BLOCKED_CODEC';result.reason='hardware-codec';}
    else if(!rate){result.state='UNKNOWN';result.reason='bitrate-unknown';}
    else if(rate.bps>limitMbps*1e6){result.state='BLOCKED_CAP';result.reason=isAv1?'av1-bitrate-limit':'other-bitrate-limit';}
    else if(supported!==true){result.state='UNKNOWN';result.reason='capability-unknown';}
    return result;
  }
  function rankReady(rows){
    var rank={AV1:0,av1:0,VP9:1,vp9:1,HEVC:2,hevc:2,AVC:3,avc:3,'H.264':3};
    return rows.filter(function(r){return r.state==='READY';}).slice().sort(function(a,b){return (b.height||0)-(a.height||0)||Number(!!b.hdr)-Number(!!a.hdr)||(rank[a.codec]??9)-(rank[b.codec]??9)||(b.fps||0)-(a.fps||0)||String(a.id||'').localeCompare(String(b.id||''));});
  }
  return {DEFAULTS:DEFAULTS,CODEC_MULTIPLIERS:CODEC_MULTIPLIERS,resolveConfig:resolveConfig,codecFamily:codecFamily,isHdrFormat:isHdrFormat,representativeBitrate:representativeBitrate,streamBitrate:streamBitrate,effectiveBitrate:effectiveBitrate,compareVisualQuality:compareVisualQuality,assess:assess,rankReady:rankReady};
});
