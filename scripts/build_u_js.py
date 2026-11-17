import os

header = """// TizenTube Cobalt L1 - 4K (2160p) Bitrate Unblocker for TCL C7K
(function() {
    if (window.__ttL1Patched) return;
    window.__ttL1Patched = true;

    if (window.MediaSource && MediaSource.isTypeSupported) {
        const origIsTypeSupported = MediaSource.isTypeSupported.bind(MediaSource);
        MediaSource.isTypeSupported = function(type) {
            if (!type) return false;
            const clamped = type.replace(/;\\s*bitrate=(\\d+)/gi, function(m, val) {
                var n = parseInt(val, 10);
                return (n > 35000000 && n <= 150000000) ? '; bitrate=35000000' : m;
            });
            return origIsTypeSupported(clamped);
        };
    }

    if (navigator.mediaCapabilities && navigator.mediaCapabilities.decodingInfo) {
        const origDecodingInfo = navigator.mediaCapabilities.decodingInfo.bind(navigator.mediaCapabilities);
        navigator.mediaCapabilities.decodingInfo = async function(config) {
            try {
                var cfg = config;
                if (cfg && cfg.video && cfg.video.bitrate > 35000000 && cfg.video.bitrate <= 150000000) {
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

replacement_str = '''null!=e&&null!==(i=e.streamingData)&&void 0!==i&&i.adaptiveFormats){try{var prefCodec=Ma("preferredVideoCodec")||Ma("videoPreferredCodec")||"any",af=e.streamingData.adaptiveFormats;if("any"!==prefCodec&&af.some(function(f){return f.mimeType&&f.mimeType.includes(prefCodec)})){af=af.filter(function(f){return!f.mimeType||f.mimeType.startsWith("audio/")||f.mimeType.includes(prefCodec)})}var audioFmts=[],videoFmts=[];for(var idx=0;idx<af.length;idx++){var f=af[idx];if(f&&f.mimeType&&f.mimeType.startsWith("video/"))videoFmts.push(f);else audioFmts.push(f)}if(videoFmts.length>0){var validVideos=videoFmts.filter(function(f){var m=(f.mimeType||"").toLowerCase(),avg=f.averageBitrate||0,br=avg>0?avg:(f.bitrate||0);if(m.includes("av01")||m.includes("av1"))return br<=40000000;if(m.includes("vp9")||m.includes("vp09"))return br<=100000000;return br<=45000000});if(!validVideos.length)validVideos=videoFmts;e.streamingData.adaptiveFormats=audioFmts.concat(validVideos)}}catch(err){console.warn("[C7K Bitrate] Error:",err)}}'''

code = code.replace(target_str, replacement_str, 1)
code = code.replace('preferredVideoQuality:"auto"', 'preferredVideoQuality:"2160p"', 1)

out_path = r"C:\Users\HeliumMarcos\.gemini\antigravity\scratch\TizenTubeCobalt\u.js"
with open(out_path, "w", encoding="utf-8") as f:
    f.write(header + "\n" + code)

print("Built clean u.js:", os.path.getsize(out_path))
