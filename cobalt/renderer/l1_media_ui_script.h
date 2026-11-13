// Copyright 2026 The Cobalt Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#ifndef COBALT_RENDERER_L1_MEDIA_UI_SCRIPT_H_
#define COBALT_RENDERER_L1_MEDIA_UI_SCRIPT_H_

namespace cobalt {

// Injected via WebLocalFrame::ExecuteScript at document start so YouTube TV CSP
// cannot block it. Unlocks 4K/HDR & 5.1/Stereo audio, formats each video stream
// in the native YouTube TV "Qualidade" menu with resolution, FPS, bitrate and codec
// (SmartTube style: "2160p, 30fps, 24.33Mbps, vp9 HDR", "2160p, 30fps, 82.49Mbps, av1 HDR"),
// and lists all available audio streams (Dolby Digital Plus ec-3 5.1, Dolby Digital ac-3 5.1,
// Opus Immersive iamf 5.1, Stereo) directly in the native YouTube TV "Faixa de áudio" menu!
inline constexpr char kL1MediaUiScript[] = R"L1SCRIPT(
(function () {
  if (window.__ttL1Init) return;
  window.__ttL1Init = true;

  const SESSION_PIN_PREFIX = 'ttL1Pin_';
  const SESSION_RESUME_PREFIX = 'ttL1Resume_';

  // 1. Force 4K viewport so YouTube TV serves 4K 2160p assets and formats.
  try {
    if (window.innerWidth < 3840) {
      const nativeDpr = Number(window.devicePixelRatio) || 1;
      Object.defineProperty(window, 'devicePixelRatio', {
        get: () => Math.max(2, nativeDpr),
        configurable: true
      });
    }
  } catch (e) {}

  // 2. Unlock HDR media query reporting.
  try {
    if (window.matchMedia) {
      const origMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = function (query) {
        const res = origMatchMedia(query);
        if (query && /dynamic-range\s*:\s*high/i.test(query) && !res.matches) {
          return {
            matches: true,
            media: query,
            onchange: null,
            addListener: function () {},
            removeListener: function () {},
            addEventListener: function () {},
            removeEventListener: function () {},
            dispatchEvent: function () { return false; }
          };
        }
        return res;
      };
    }
  } catch (e) {}

  // Negative probe check helper: YouTube verifies browser capabilities by probing
  // intentionally invalid parameters (.nl) such as channels=99, width=99999,
  // bitrate=2e9, catavision, etc. If the browser returns true for these, YouTube
  // assumes capability querying is broken and turns OFF multi-channel 5.1 surround sound!
  function isNegativeProbe(str) {
    if (!str) return false;
    const l = String(str).toLowerCase();
    if (/channels\s*=\s*(99|[7-9]\d|\d{3,})/i.test(l)) return true;
    if (/(width|height)\s*=\s*(99999|\d{5,})/i.test(l)) return true;
    if (/framerate\s*=\s*(9999|\d{4,})/i.test(l)) return true;
    if (/bitrate\s*=\s*(2000000000|2e9|\d{10,})/i.test(l)) return true;
    if (/catavision|nope|invalidformat/i.test(l)) return true;
    return false;
  }

  // 3. MediaSource.isTypeSupported
  try {
    if (window.MediaSource && window.MediaSource.isTypeSupported) {
      const origIsType = window.MediaSource.isTypeSupported.bind(window.MediaSource);
      window.MediaSource.isTypeSupported = function (typeStr) {
        if (!typeStr) return false;
        if (isNegativeProbe(typeStr)) return false;
        const lower = String(typeStr).toLowerCase();
        if (lower.includes('audio/')) {
          if (lower.includes('ec-3') || lower.includes('ac-3') || lower.includes('iamf') || lower.includes('opus') || lower.includes('mp4a')) {
            return true;
          }
        }
        if (lower.includes('video/')) {
          if (lower.includes('vp09') || lower.includes('vp9') || lower.includes('av01') || lower.includes('avc1')) {
            return true;
          }
        }
        return origIsType(typeStr);
      };
    }
  } catch (e) {}

  // 4. HTMLMediaElement.prototype.canPlayType
  try {
    if (window.HTMLMediaElement && HTMLMediaElement.prototype.canPlayType) {
      const origCanPlay = HTMLMediaElement.prototype.canPlayType;
      HTMLMediaElement.prototype.canPlayType = function (typeStr) {
        if (!typeStr) return '';
        if (isNegativeProbe(typeStr)) return '';
        const lower = String(typeStr).toLowerCase();
        if (lower.includes('audio/')) {
          if (lower.includes('ec-3') || lower.includes('ac-3') || lower.includes('iamf') || lower.includes('opus') || lower.includes('mp4a')) {
            return 'probably';
          }
        }
        if (lower.includes('video/')) {
          if (lower.includes('vp09') || lower.includes('vp9') || lower.includes('av01') || lower.includes('avc1')) {
            return 'probably';
          }
        }
        return origCanPlay.call(this, typeStr);
      };
    }
  } catch (e) {}

  // 5. navigator.mediaCapabilities.decodingInfo
  try {
    if (navigator.mediaCapabilities && navigator.mediaCapabilities.decodingInfo) {
      const origDecInfo = navigator.mediaCapabilities.decodingInfo.bind(navigator.mediaCapabilities);
      navigator.mediaCapabilities.decodingInfo = async function (config) {
        try {
          if (config && config.audio) {
            const ch = Number(config.audio.channels);
            if (ch > 6 || ch === 99) {
              return { supported: false, smooth: false, powerEfficient: false };
            }
          }
          if (config && config.video && config.video.contentType) {
            const vl = String(config.video.contentType).toLowerCase();
            if (vl.includes('vp09') || vl.includes('vp9') || vl.includes('av01') || vl.includes('avc1')) {
              return { supported: true, smooth: true, powerEfficient: true };
            }
          }
          if (config && config.audio && config.audio.contentType) {
            const al = String(config.audio.contentType).toLowerCase();
            if (al.includes('ec-3') || al.includes('ac-3') || al.includes('iamf') || al.includes('opus') || al.includes('mp4a')) {
              return { supported: true, smooth: true, powerEfficient: true };
            }
          }
        } catch (e) {}
        return origDecInfo(config);
      };
    }
  } catch (e) {}

  // 6. Web Audio AudioDestinationNode maxChannelCount (5.1 = 6 channels)
  try {
    if (window.AudioDestinationNode && AudioDestinationNode.prototype) {
      Object.defineProperty(AudioDestinationNode.prototype, 'maxChannelCount', {
        get: () => 6,
        configurable: true
      });
    }
  } catch (e) {}

  // 7. Inject 5.1 Surround Sound experiment flags into YouTube TV config
  function applyExperimentFlags() {
    try {
      if (window.ytcfg && window.ytcfg.get) {
        const exp = window.ytcfg.get('EXPERIMENT_FLAGS') || {};
        Object.assign(exp, {
          html5_enable_5_1_audio: true,
          html5_prefer_5_1_audio: true,
          html5_honor_user_51_preference: true,
          html5_enable_eac3: true,
          html5_enable_ac3: true,
          html5_enable_iamf_audio: true,
          html5_ugc_vod_audio_51: true,
          html5_onesie_51_audio: true,
          html5_kabuki_drm_live_51_default_off: false,
          html5_ytv_surround_toggle_default_off: false
        });
        window.ytcfg.set({ EXPERIMENT_FLAGS: exp });
      }
    } catch (e) {}
  }
  applyExperimentFlags();
  setInterval(applyExperimentFlags, 2000);

  // 8. Stream catalog & format pinning
  const catalog = (window.__ttL1Catalog = window.__ttL1Catalog || {});
  const pinnedMap = (window.__ttL1Pinned = window.__ttL1Pinned || {});

  function getPin(vid) {
    if (!vid) return { videoItag: null, audioItag: null };
    if (pinnedMap[vid]) return pinnedMap[vid];
    try {
      const raw = sessionStorage.getItem(SESSION_PIN_PREFIX + vid);
      if (raw) {
        pinnedMap[vid] = JSON.parse(raw);
        return pinnedMap[vid];
      }
    } catch (e) {}
    return { videoItag: null, audioItag: null };
  }

  function setPin(vid, patch) {
    if (!vid) return;
    const cur = Object.assign({ videoItag: null, audioItag: null }, getPin(vid), patch);
    pinnedMap[vid] = cur;
    try {
      sessionStorage.setItem(SESSION_PIN_PREFIX + vid, JSON.stringify(cur));
    } catch (e) {}
  }

  function isHdrFormat(f) {
    const tc = (f.colorInfo && f.colorInfo.transferCharacteristics) || '';
    const m = (f.mimeType || '').toLowerCase();
    const ql = (f.qualityLabel || '').toUpperCase();
    if (tc.includes('SMPTEST2084') || tc.includes('ARIB_STD_B67')) return true;
    if (/\.(16|18)\.\d{2}\.\d/.test(m) || ql.includes('HDR') || ql.includes('HLG')) return true;
    return false;
  }

  function detectVideoCodecLabel(mime, isHdr) {
    const m = (mime || '').toLowerCase();
    if (m.includes('av01') || m.includes('av1')) return isHdr ? 'av1 HDR' : 'av1';
    if (m.includes('vp9.2') || (m.includes('vp9') && isHdr)) return 'vp9 HDR';
    if (m.includes('vp9') || m.includes('vp09')) return 'vp9';
    if (m.includes('avc1') || m.includes('h264')) return 'avc';
    return 'video';
  }

  function detectAudioName(f) {
    const m = (f.mimeType || '').toLowerCase();
    const kbps = Math.round(Number(f.bitrate || f.averageBitrate || 0) / 1000);
    const ch = f.audioChannels || ((m.includes('ec-3') || m.includes('ac-3') || m.includes('iamf')) ? 6 : 2);
    if (m.includes('ec-3')) return `Dolby Digital Plus (ec-3 ${ch >= 6 ? '5.1' : '2.0'} a ${kbps} kbps)`;
    if (m.includes('ac-3')) return `Dolby Digital (ac-3 ${ch >= 6 ? '5.1' : '2.0'} a ${kbps} kbps)`;
    if (m.includes('iamf')) return `Opus Immersive (iamf 5.1 a ${kbps} kbps)`;
    if (m.includes('opus')) return `Opus ${ch >= 6 ? '5.1' : 'Est\u00e9reo'} (opus a ${kbps} kbps)`;
    if (m.includes('mp4a')) return `AAC ${ch >= 6 ? '5.1' : 'Est\u00e9reo'} (mp4a a ${kbps} kbps)`;
    return `\u00c1udio ${ch >= 6 ? '5.1' : '2.0'} (${kbps} kbps)`;
  }

  function processPlayerPayload(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const sd = obj.streamingData;
    if (!sd || !Array.isArray(sd.adaptiveFormats) || !sd.adaptiveFormats.length) return obj;

    const vid = (obj.videoDetails && obj.videoDetails.videoId) || '';
    const rawVids = [];
    const rawAuds = [];

    for (const f of sd.adaptiveFormats) {
      if (!f || !f.mimeType) continue;
      if (f.mimeType.startsWith('video/')) {
        const hdr = isHdrFormat(f);
        const codec = detectVideoCodecLabel(f.mimeType, hdr);
        const fps = Number(f.fps || 30);
        const mbps = (Number(f.bitrate || f.averageBitrate || 0) / 1000000).toFixed(2);
        // SmartTube naming convention: "2160p, 30fps, 24.33Mbps, vp9 HDR"
        f.qualityLabel = `${f.height}p, ${fps}fps, ${mbps}Mbps, ${codec}`;
        rawVids.push(f);
      } else if (f.mimeType.startsWith('audio/')) {
        const m = f.mimeType.toLowerCase();
        if (!f.audioChannels && (m.includes('ec-3') || m.includes('ac-3') || m.includes('iamf'))) {
          f.audioChannels = 6;
        }
        f.displayName = detectAudioName(f);
        if (!f.audioTrack) f.audioTrack = { displayName: f.displayName, id: String(f.itag) };
        else f.audioTrack.displayName = f.displayName;
        rawAuds.push(f);
      }
    }

    if (vid) {
      catalog[vid] = {
        videoId: vid,
        title: (obj.videoDetails && obj.videoDetails.title) || '',
        videos: rawVids.slice().sort((a, b) => (b.height - a.height) || (b.bitrate - a.bitrate)),
        audios: rawAuds.slice().sort((a, b) => (b.audioChannels - a.audioChannels) || (b.bitrate - a.bitrate)),
        updatedAt: Date.now()
      };
    }

    const pin = getPin(vid);
    let vids = rawVids;
    let auds = rawAuds;

    // Strict Video Pinning: When user explicitly selects a quality/format,
    // only feed that video stream so YouTube player CANNOT starve or downgrade!
    if (pin.videoItag) {
      const match = rawVids.filter(f => Number(f.itag) === Number(pin.videoItag));
      if (match.length) {
        vids = match;
      }
    }

    // Strict Audio Pinning: When user explicitly selects an audio track (e.g. Dolby Digital 5.1),
    // only feed that audio stream so YouTube player plays it directly!
    if (pin.audioItag) {
      const match = rawAuds.filter(a => Number(a.itag) === Number(pin.audioItag));
      if (match.length) {
        auds = match;
      }
    } else {
      // By default prioritize 5.1 multi-channel surround streams (ec-3, ac-3, iamf)
      const multi = rawAuds.filter(a => (a.audioChannels || 2) >= 6);
      if (multi.length) {
        auds = multi.concat(rawAuds.filter(a => (a.audioChannels || 2) < 6));
      }
    }

    sd.adaptiveFormats = vids.concat(auds);
    return obj;
  }

  // Intercept JSON.parse
  const origJsonParse = window.JSON.parse;
  window.JSON.parse = function () {
    const res = origJsonParse.apply(this, arguments);
    try {
      if (res && res.streamingData && Array.isArray(res.streamingData.adaptiveFormats)) {
        return processPlayerPayload(res);
      }
    } catch (e) {}
    return res;
  };

  // Intercept Response.prototype.json
  try {
    const origRespJson = Response.prototype.json;
    Response.prototype.json = function () {
      return origRespJson.apply(this, arguments).then(data => {
        try {
          if (data && data.streamingData && Array.isArray(data.streamingData.adaptiveFormats)) {
            return processPlayerPayload(data);
          }
        } catch (e) {}
        return data;
      });
    };
  } catch (e) {}

  function getCurrentVideoId() {
    try {
      const p = document.getElementById('ytlr-player__player-container-player');
      if (p && p.getVideoData) {
        const d = p.getVideoData();
        if (d && d.video_id) return d.video_id;
      }
    } catch (e) {}
    const m = location.href.match(/[?&#/]v=([a-zA-Z0-9_-]{6,})/) || location.href.match(/\/watch\/([a-zA-Z0-9_-]{6,})/);
    return m ? m[1] : '';
  }

  function reloadPlayerAtCurrentTime(vid) {
    const v = document.querySelector('video');
    const t = v ? (v.currentTime || 0) : 0;
    try {
      if (t > 1) sessionStorage.setItem(SESSION_RESUME_PREFIX + vid, String(t));
    } catch (e) {}
    const p = document.getElementById('ytlr-player__player-container-player');
    try {
      if (p && typeof p.loadVideoByPlayerVars === 'function') {
        p.loadVideoByPlayerVars({ videoId: vid, startSeconds: t });
        return;
      }
    } catch (e) {}
    location.reload();
  }

  // Resume playback position smoothly after stream switch
  function checkResume() {
    const vid = getCurrentVideoId();
    if (!vid) return;
    try {
      const saved = sessionStorage.getItem(SESSION_RESUME_PREFIX + vid);
      if (saved) {
        sessionStorage.removeItem(SESSION_RESUME_PREFIX + vid);
        const t = parseFloat(saved);
        const v = document.querySelector('video');
        if (v && !isNaN(t) && t > 1) {
          const seek = () => { try { v.currentTime = t; } catch (e) {} };
          if (v.readyState >= 1) seek();
          else v.addEventListener('loadedmetadata', seek, { once: true });
        }
      }
    } catch (e) {}
  }
  setInterval(checkResume, 1000);

  // 9. Hook native YouTube TV Player API methods for seamless UI integration!
  function hookPlayerApi() {
    const p = document.getElementById('ytlr-player__player-container-player');
    if (!p) return;

    // A. Native "Qualidade" Menu: Return all video formats without deduplicating codecs!
    const origQDataMsg = p.getAvailableQualityDataAndMessaging;
    p.getAvailableQualityDataAndMessaging = function () {
      const vid = getCurrentVideoId();
      const cat = (vid && catalog[vid]) || null;
      if (cat && cat.videos && cat.videos.length) {
        const pin = getPin(vid);
        const qualityData = cat.videos.map(f => {
          return {
            qualityLabel: f.qualityLabel,
            // Assign unique quality key per format so YouTube Leanback doesn't collapse AV1/VP9/AVC!
            quality: 'fmt_' + f.itag,
            isPlayable: true,
            formatItag: f.itag,
            isCurrent: pin.videoItag ? (Number(pin.videoItag) === Number(f.itag)) : undefined
          };
        });
        return { qualityData };
      }
      return origQDataMsg ? origQDataMsg.apply(this, arguments) : { qualityData: [] };
    };

    p.getAvailableQualityData = function () {
      const res = p.getAvailableQualityDataAndMessaging();
      return (res && res.qualityData) || [];
    };

    p.getAvailableQualityLabels = function () {
      const qd = p.getAvailableQualityData();
      if (qd && qd.length) return qd.map(q => q.qualityLabel);
      return [];
    };

    // When the user clicks a quality in the native "Qualidade" menu:
    const origSetQuality = p.setPlaybackQualityRange;
    p.setPlaybackQualityRange = function (minQ, maxQ) {
      const vid = getCurrentVideoId();
      const cat = (vid && catalog[vid]) || null;
      const qStr = String(maxQ || minQ || '');
      if (qStr === 'auto' || qStr === 'highres') {
        setPin(vid, { videoItag: null });
        reloadPlayerAtCurrentTime(vid);
        return origSetQuality ? origSetQuality.apply(this, arguments) : undefined;
      }
      if (cat && cat.videos && cat.videos.length) {
        let itagMatch = null;
        const itagRx = qStr.match(/fmt_(\d+)/);
        if (itagRx) itagMatch = Number(itagRx[1]);
        if (!itagMatch) {
          const match = cat.videos.find(v => v.qualityLabel === qStr || ('fmt_' + v.itag) === qStr || ('hd' + v.height) === qStr);
          if (match) itagMatch = Number(match.itag);
        }
        if (itagMatch) {
          setPin(vid, { videoItag: itagMatch });
          reloadPlayerAtCurrentTime(vid);
          return;
        }
      }
      return origSetQuality ? origSetQuality.apply(this, arguments) : undefined;
    };

    p.setPlaybackQuality = function (q) {
      return p.setPlaybackQualityRange(q, q);
    };

    // B. Native "Faixa de áudio" Menu: List all surround (5.1 ec-3, ac-3, iamf) & stereo tracks!
    p.getAvailableAudioTracks = function () {
      const vid = getCurrentVideoId();
      const cat = (vid && catalog[vid]) || null;
      if (cat && cat.audios && cat.audios.length) {
        const pin = getPin(vid);
        const curItag = pin.audioItag ? Number(pin.audioItag) : Number(cat.audios[0].itag);
        return cat.audios.map(a => ({
          id: String(a.itag),
          xb: {
            id: String(a.itag),
            name: a.displayName,
            isDefault: (Number(a.itag) === curItag),
            isAutoDubbed: false
          },
          captionTracks: [],
          captionsInitialState: 'CAPTIONS_INITIAL_STATE_UNKNOWN'
        }));
      }
      return [];
    };

    p.getAudioTrack = function () {
      const vid = getCurrentVideoId();
      const cat = (vid && catalog[vid]) || null;
      if (cat && cat.audios && cat.audios.length) {
        const pin = getPin(vid);
        const curItag = pin.audioItag ? Number(pin.audioItag) : Number(cat.audios[0].itag);
        const active = cat.audios.find(a => Number(a.itag) === curItag) || cat.audios[0];
        return {
          id: String(active.itag),
          xb: {
            id: String(active.itag),
            name: active.displayName,
            isDefault: true,
            isAutoDubbed: false
          },
          captionTracks: [],
          captionsInitialState: 'CAPTIONS_INITIAL_STATE_UNKNOWN'
        };
      }
      return { id: 'und', xb: { id: 'und', name: 'Default', isDefault: true, isAutoDubbed: false }, captionTracks: [] };
    };

    // When the user clicks an audio track in the native "Faixa de áudio" menu:
    p.setAudioTrack = function (track) {
      if (track) {
        const tid = String(track.id || (track.xb && track.xb.id) || '');
        const numItag = parseInt(tid, 10);
        if (numItag) {
          const vid = getCurrentVideoId();
          setPin(vid, { audioItag: numItag });
          reloadPlayerAtCurrentTime(vid);
        }
      }
    };

    // C. Force 5.1 Surround Sound capability flags on player
    p.hasSupportedAudio51Tracks = function () {
      const vid = getCurrentVideoId();
      const cat = (vid && catalog[vid]) || null;
      if (cat && cat.audios) {
        return cat.audios.some(a => (a.audioChannels || 2) >= 6);
      }
      return true;
    };
    p.getUserAudio51Preference = function () {
      return 1;
    };
    p.isAudioIamf = function () {
      return true;
    };
  }

  setInterval(hookPlayerApi, 1000);
})();
)L1SCRIPT";

}  // namespace cobalt

#endif  // COBALT_RENDERER_L1_MEDIA_UI_SCRIPT_H_
