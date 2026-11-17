import os

header = """// TizenTube Cobalt L1 - 4K (2160p) Bitrate Unblocker for TCL C7K
(function() {
    if (window.__ttL1Patched) return;
    window.__ttL1Patched = true;

    window.__ttShouldHideAv1 = function() {
        try {
            var raw = localStorage.getItem('ytaf-configuration');
            if (!raw) return false;
            var cfg = JSON.parse(raw);
            if (!cfg) return false;
            if (cfg.preferredVideoCodec === 'vp9') return true;
            if (cfg.maxAv1BitrateMbps && cfg.maxAv1BitrateMbps !== 'unlimited') {
                var n = Number(cfg.maxAv1BitrateMbps);
                if (n > 0 && n <= 35) return true;
            }
        } catch (_) {}
        return false;
    };

    if (window.MediaSource && MediaSource.isTypeSupported) {
        const origIsTypeSupported = MediaSource.isTypeSupported.bind(MediaSource);
        MediaSource.isTypeSupported = function(type) {
            if (!type) return false;
            if (/av01|av1/i.test(type) && window.__ttShouldHideAv1()) return false;
            const clamped = type.replace(/;\\s*bitrate=(\\d+)/gi, function(m, val) {
                var n = parseInt(val, 10);
                return (n > 35000000 && n <= 250000000) ? '; bitrate=35000000' : m;
            });
            return origIsTypeSupported(clamped);
        };
    }

    if (navigator.mediaCapabilities && navigator.mediaCapabilities.decodingInfo) {
        const origDecodingInfo = navigator.mediaCapabilities.decodingInfo.bind(navigator.mediaCapabilities);
        navigator.mediaCapabilities.decodingInfo = async function(config) {
            try {
                var cfg = config;
                if (cfg && cfg.video && /av01|av1/i.test(cfg.video.contentType || '') && window.__ttShouldHideAv1()) {
                    return { supported: false, smooth: false, powerEfficient: false };
                }
                if (cfg && cfg.video && cfg.video.bitrate > 35000000 && cfg.video.bitrate <= 250000000) {
                    cfg = Object.assign({}, cfg, {
                        video: Object.assign({}, cfg.video, { bitrate: 35000000 })
                    });
                }
                const res = await origDecodingInfo(cfg);
                if (!res || !res.supported) return res;
                return {
                    supported: true,
                    smooth: true,
                    powerEfficient: true,
                    keySystemAccess: res.keySystemAccess || null
                };
            } catch (e) {
                return origDecodingInfo(config);
            }
        };
    }
})();
"""

user_script_path = r"C:\Users\HeliumMarcos\.gemini\antigravity\scratch\userScript.js"
with open(user_script_path, "r", encoding="utf-8") as f:
    code = f.read()

target_str = 'null!=e&&null!==(i=e.streamingData)&&void 0!==i&&i.adaptiveFormats&&"any"!==Ma("preferredVideoCodec")){var S=Ma("preferredVideoCodec");e.streamingData.adaptiveFormats.find(e=>e.mimeType.includes(S))&&(e.streamingData.adaptiveFormats=e.streamingData.adaptiveFormats.filter(e=>!!e.mimeType.startsWith("audio/")||e.mimeType.includes(S)))}'

replacement_str = '''null!=e&&null!==(i=e.streamingData)&&void 0!==i&&i.adaptiveFormats){try{var prefCodec=Ma("preferredVideoCodec")||Ma("videoPreferredCodec")||"any",af=e.streamingData.adaptiveFormats,audioFmts=[],videoFmts=[];for(var idx=0;idx<af.length;idx++){var f=af[idx];if(f&&f.mimeType&&f.mimeType.startsWith("video/"))videoFmts.push(f);else audioFmts.push(f)}if(videoFmts.length>0){var av1Raw=String(Ma("maxAv1BitrateMbps")||"100"),othRaw=String(Ma("maxOtherBitrateMbps")||"150"),av1Cap="unlimited"===av1Raw?Infinity:((Number(av1Raw)>0?Number(av1Raw):100)*1000000),otherCap="unlimited"===othRaw?Infinity:((Number(othRaw)>0?Number(othRaw):150)*1000000),isAv1Mime=function(m){return m.includes("av01")||m.includes("av1")},isHwCodecOk=function(f){if(f.height&&f.height>2160)return!1;if(f.width&&f.width>3840)return!1;if(f.fps&&f.fps>60)return!1;if(f.mimeType&&f.mimeType.includes("codecs=")&&window.MediaSource&&MediaSource.isTypeSupported){try{if(!MediaSource.isTypeSupported(f.mimeType))return!1}catch(_){}}return!0},isBitrateOk=function(f){var m=(f.mimeType||"").toLowerCase(),avg=f.averageBitrate||0,peak=f.bitrate||0,br=avg>0?avg:peak,cap=isAv1Mime(m)?av1Cap:otherCap,peakCap=isFinite(cap)?Math.max(Math.round(cap*3.5),160000000):Infinity;return br<=cap&&(!peak||peak<=peakCap)},validVideos=videoFmts.filter(function(f){return isHwCodecOk(f)&&isBitrateOk(f)});if("any"!==prefCodec&&validVideos.length>0){var prefMatches=validVideos.filter(function(f){return f.mimeType&&f.mimeType.includes(prefCodec)});if(prefMatches.length>0){var coveredHeights={};for(var ph=0;ph<prefMatches.length;ph++)coveredHeights[prefMatches[ph].height||0]=!0;var extras=validVideos.filter(function(f){return(!f.mimeType||!f.mimeType.includes(prefCodec))&&!coveredHeights[f.height||0]});validVideos=prefMatches.concat(extras)}}if(validVideos.length>0){var maxValidH=0,maxAv1H=0,hasNonAv1AtMax=!1;for(var vh=0;vh<validVideos.length;vh++){var vf=validVideos[vh],h=vf.height||0,vm=(vf.mimeType||"").toLowerCase();if(h>maxValidH)maxValidH=h;if(isAv1Mime(vm)&&h>maxAv1H)maxAv1H=h}for(var vh2=0;vh2<validVideos.length;vh2++){var vf2=validVideos[vh2],vm2=(vf2.mimeType||"").toLowerCase();if((vf2.height||0)===maxValidH&&!isAv1Mime(vm2)){hasNonAv1AtMax=!0;break}}if(maxValidH>0&&maxAv1H<maxValidH&&hasNonAv1AtMax){var nonAv1Ladder=validVideos.filter(function(f){return!isAv1Mime((f.mimeType||"").toLowerCase())});if(nonAv1Ladder.length>0)validVideos=nonAv1Ladder}}if(!validVideos.length){var safeFallback=videoFmts.filter(function(f){var m=(f.mimeType||"").toLowerCase();return(!isAv1Mime(m)||isBitrateOk(f))&&isHwCodecOk(f)});if(safeFallback.length)validVideos=safeFallback;else{var sorted=videoFmts.slice().sort(function(a,b){var ba=(a.averageBitrate||0)>0?a.averageBitrate:(a.bitrate||0),bb=(b.averageBitrate||0)>0?b.averageBitrate:(b.bitrate||0);return ba-bb});validVideos=[sorted[0]]}}e.streamingData.adaptiveFormats=audioFmts.concat(validVideos)}}catch(err){console.warn("[C7K Bitrate] Error:",err)}}'''

code = code.replace(target_str, replacement_str, 1)
code = code.replace('preferredVideoQuality:"auto"', 'preferredVideoQuality:"2160p",maxAv1BitrateMbps:"100",maxOtherBitrateMbps:"150"', 1)

codec_menu_target = 'options:["any","vp9","av01","avc1"].map(e=>({name:"any"===e?ga("settings.options.videoPlayer.options.codecAny"):e.toUpperCase(),key:"preferredVideoCodec",value:e}))}'
codec_menu_replacement = codec_menu_target + ',{name:"Limite máximo de bitrate (AV1)",icon:"VIDEO_QUALITY",value:null,menuId:"tt-max-av1-bitrate",menuHeader:{title:"Limite máximo de bitrate (AV1)",subtitle:"Define o teto para AV1 (padrão: 100 Mbps)"},options:["20","30","40","60","100","unlimited"].map(e=>({name:"unlimited"===e?"Sem limite":`${e} Mbps`+("100"===e?" (Padrão)":""),key:"maxAv1BitrateMbps",value:e}))},{name:"Limite máximo de bitrate (VP9/AVC/HEVC)",icon:"VIDEO_QUALITY",value:null,menuId:"tt-max-other-bitrate",menuHeader:{title:"Limite máximo de bitrate (VP9/AVC/HEVC)",subtitle:"Define o teto para VP9, H.264/AVC, H.265/HEVC e outros (padrão: 150 Mbps)"},options:["45","60","80","100","120","150","unlimited"].map(e=>({name:"unlimited"===e?"Sem limite":`${e} Mbps`+("150"===e?" (Padrão)":""),key:"maxOtherBitrateMbps",value:e}))}'
assert codec_menu_target in code, "codec_menu_target not found in userScript.js"
code = code.replace(codec_menu_target, codec_menu_replacement, 1)

ia_target = 'function Ia(e,t){console.info("Setting key",e,"to",t),za[e]=t,window.localStorage[Ba]=JSON.stringify(za),Ra.dispatchEvent(new CustomEvent("configChange",{detail:{key:e,value:t}}))}'
ia_replacement = 'function Ia(e,t){var prevHide=window.__ttShouldHideAv1&&window.__ttShouldHideAv1();console.info("Setting key",e,"to",t),za[e]=t,window.localStorage[Ba]=JSON.stringify(za),Ra.dispatchEvent(new CustomEvent("configChange",{detail:{key:e,value:t}}));if(("maxAv1BitrateMbps"===e||"preferredVideoCodec"===e)&&window.__ttShouldHideAv1&&window.__ttShouldHideAv1()!==prevHide)setTimeout(function(){location.reload()},300)}'
assert ia_target in code, "ia_target not found in userScript.js"
code = code.replace(ia_target, ia_replacement, 1)

out_path = r"C:\Users\HeliumMarcos\.gemini\antigravity\scratch\TizenTubeCobalt\u.js"
with open(out_path, "w", encoding="utf-8") as f:
    f.write(header + "\n" + code)

print("Built clean u.js:", os.path.getsize(out_path))
