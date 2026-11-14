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
// (SmartTube style: "2160p, 60fps, 82.49Mbps, av1 HDR", "2160p, 60fps, 44.16Mbps, vp9"),
// preserves full video/audio catalogs across codec/resolution preferences (AV1, VP9, AVC),
// and lists all available audio streams (Dolby Digital Plus ec-3 5.1, Dolby Digital ac-3 5.1,
// multi-language tracks, DRC variants, Stereo) in the native "Faixa de áudio" menu.
inline constexpr char kL1MediaUiScript[] = R"L1SCRIPT(
(function () {
  if (window.__ttL1Init) return;
  window.__ttL1Init = true;

  const SESSION_PIN_PREFIX = 'ttL1Pin_';
  const SESSION_RESUME_PREFIX = 'ttL1Resume_';
  const YTAF_CONFIG_KEY = 'ytaf-configuration';
  const TUBERUSH_RELEASES_API = 'https://api.github.com/repos/HeliumMarcos/TubeRush/releases/latest';
  const nativeJsonParse = window.JSON.parse.bind(window.JSON);

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

  let origIsTypeSupported = null;
  try {
    if (window.MediaSource && typeof window.MediaSource.isTypeSupported === 'function') {
      origIsTypeSupported = window.MediaSource.isTypeSupported.bind(window.MediaSource);
    }
  } catch (e) {}

  let cachedIamfSupport = null;
  function checkNativeIamfSupport() {
    if (cachedIamfSupport !== null) return cachedIamfSupport;
    try {
      if (origIsTypeSupported) {
        cachedIamfSupport = !!origIsTypeSupported('audio/mp4; codecs="iamf.001.001.opus"');
        return cachedIamfSupport;
      }
    } catch (e) {}
    cachedIamfSupport = false;
    return false;
  }

  // 2. Unlock HDR media query reporting when HDR codecs are supported.
  try {
    if (window.matchMedia) {
      const origMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = function (query) {
        const res = origMatchMedia(query);
        if (query && /dynamic-range\s*:\s*high/i.test(query) && !res.matches) {
          if (window.__ttL1HdrSupported !== false) {
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
        }
        return res;
      };
    }
  } catch (e) {}

  // 3. MediaSource.isTypeSupported (reflect real device capabilities; never fake IAMF)
  try {
    if (window.MediaSource && origIsTypeSupported) {
      window.MediaSource.isTypeSupported = function (typeStr) {
        if (!typeStr) return false;
        if (isNegativeProbe(typeStr)) return false;
        const lower = String(typeStr).toLowerCase();
        if (lower.includes('audio/')) {
          if (lower.includes('iamf')) {
            return checkNativeIamfSupport();
          }
          if (lower.includes('ec-3') || lower.includes('ac-3') || lower.includes('opus') || lower.includes('mp4a')) {
            return true;
          }
        }
        if (lower.includes('video/')) {
          if (lower.includes('vp09') || lower.includes('vp9') || lower.includes('av01') || lower.includes('avc1')) {
            return true;
          }
        }
        return origIsTypeSupported(typeStr);
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
          if (lower.includes('iamf')) {
            return checkNativeIamfSupport() ? 'probably' : '';
          }
          if (lower.includes('ec-3') || lower.includes('ac-3') || lower.includes('opus') || lower.includes('mp4a')) {
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
            if (config.audio.contentType && isNegativeProbe(config.audio.contentType)) {
              return { supported: false, smooth: false, powerEfficient: false };
            }
          }
          if (config && config.video) {
            const w = Number(config.video.width || 0);
            const h = Number(config.video.height || 0);
            const br = Number(config.video.bitrate || 0);
            const fps = Number(config.video.framerate || 0);
            if (w > 8192 || h > 4320 || br >= 1000000000 || fps >= 1000) {
              return { supported: false, smooth: false, powerEfficient: false };
            }
            if (config.video.contentType && isNegativeProbe(config.video.contentType)) {
              return { supported: false, smooth: false, powerEfficient: false };
            }
            if (config.video.contentType) {
              const vl = String(config.video.contentType).toLowerCase();
              if (vl.includes('vp09') || vl.includes('vp9') || vl.includes('av01') || vl.includes('avc1')) {
                return { supported: true, smooth: true, powerEfficient: true };
              }
            }
          }
          if (config && config.audio && config.audio.contentType) {
            const al = String(config.audio.contentType).toLowerCase();
            if (al.includes('iamf')) {
              const iamfOk = checkNativeIamfSupport();
              return { supported: iamfOk, smooth: iamfOk, powerEfficient: iamfOk };
            }
            if (al.includes('ec-3') || al.includes('ac-3') || al.includes('opus') || al.includes('mp4a')) {
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

  // 7. Inject 5.1 Surround Sound & HBR format-id experiment flags into YouTube TV config
  let expFlagsTicks = 0;
  let expFlagsTimer = null;
  function applyExperimentFlags() {
    expFlagsTicks++;
    try {
      if (window.ytcfg && window.ytcfg.get) {
        const exp = window.ytcfg.get('EXPERIMENT_FLAGS') || {};
        Object.assign(exp, {
          html5_enable_5_1_audio: true,
          html5_prefer_5_1_audio: true,
          html5_honor_user_51_preference: true,
          html5_enable_eac3: true,
          html5_enable_ac3: true,
          html5_enable_iamf_audio: checkNativeIamfSupport(),
          html5_ugc_vod_audio_51: true,
          html5_onesie_51_audio: true,
          html5_kabuki_drm_live_51_default_off: false,
          html5_ytv_surround_toggle_default_off: false,
          web_player_enable_premium_hbr_in_h5_api: true
        });
        if (typeof window.ytcfg.set === 'function') {
          window.ytcfg.set({ EXPERIMENT_FLAGS: exp });
        }
        // Also patch WEB_PLAYER_CONTEXT_CONFIGS.serializedExperimentFlags so player.js bXa
        // has web_player_enable_premium_hbr_in_h5_api=true from initialization!
        const ctxs = window.ytcfg.get('WEB_PLAYER_CONTEXT_CONFIGS');
        if (ctxs && typeof ctxs === 'object') {
          const extraFlags =
            '&web_player_enable_premium_hbr_in_h5_api=true' +
            '&html5_enable_5_1_audio=true' +
            '&html5_prefer_5_1_audio=true' +
            '&html5_honor_user_51_preference=true' +
            '&html5_enable_eac3=true' +
            '&html5_enable_ac3=true';
          for (const k of Object.keys(ctxs)) {
            const c = ctxs[k];
            if (c && typeof c.serializedExperimentFlags === 'string' &&
                !c.serializedExperimentFlags.includes('web_player_enable_premium_hbr_in_h5_api=true')) {
              c.serializedExperimentFlags += extraFlags;
            }
          }
          if (expFlagsTicks >= 4 && expFlagsTimer) {
            clearInterval(expFlagsTimer);
            expFlagsTimer = null;
          }
        }
      }
    } catch (e) {}
    if (expFlagsTicks >= 15 && expFlagsTimer) {
      clearInterval(expFlagsTimer);
      expFlagsTimer = null;
    }
  }
  applyExperimentFlags();
  expFlagsTimer = setInterval(applyExperimentFlags, 1000);

  // 8. User Preferences helper (reads TizenTube / TubeRush localStorage settings)
  function getUserPreferences() {
    let preferredVideoQuality = 'auto';
    let preferredVideoCodec = 'any';
    try {
      const raw = window.localStorage && window.localStorage.getItem(YTAF_CONFIG_KEY);
      if (raw) {
        const parsed = nativeJsonParse(raw);
        if (parsed && typeof parsed === 'object') {
          if (parsed.preferredVideoQuality) {
            preferredVideoQuality = String(parsed.preferredVideoQuality).toLowerCase();
          }
          const codecPref = parsed.preferredVideoCodec || parsed.videoPreferredCodec;
          if (codecPref) {
            preferredVideoCodec = String(codecPref).toLowerCase();
          }
        }
      }
    } catch (e) {}
    return { preferredVideoQuality, preferredVideoCodec };
  }

  // 9. Stream catalog, HLS parser & format pinning
  const catalog = (window.__ttL1Catalog = window.__ttL1Catalog || {});
  const pinnedMap = (window.__ttL1Pinned = window.__ttL1Pinned || {});

  function getPin(vid) {
    if (!vid) return { videoItag: null, manualVideo: false, audioItag: null, audioKey: null };
    if (pinnedMap[vid]) return pinnedMap[vid];
    try {
      const raw = sessionStorage.getItem(SESSION_PIN_PREFIX + vid);
      if (raw) {
        pinnedMap[vid] = nativeJsonParse(raw);
        return pinnedMap[vid];
      }
    } catch (e) {}
    return { videoItag: null, manualVideo: false, audioItag: null, audioKey: null };
  }

  function setPin(vid, patch) {
    if (!vid) return;
    const cur = Object.assign(
      { videoItag: null, manualVideo: false, audioItag: null, audioKey: null },
      getPin(vid),
      patch
    );
    pinnedMap[vid] = cur;
    try {
      sessionStorage.setItem(SESSION_PIN_PREFIX + vid, JSON.stringify(cur));
    } catch (e) {}
  }

  function heightToQualityKey(height) {
    const h = Number(height || 0);
    if (h >= 4320) return 'highres';
    if (h >= 2880) return 'hd2880';
    if (h >= 2160) return 'hd2160';
    if (h >= 1440) return 'hd1440';
    if (h >= 1080) return 'hd1080';
    if (h >= 720) return 'hd720';
    if (h >= 480) return 'large';
    if (h >= 360) return 'medium';
    if (h >= 240) return 'small';
    return 'tiny';
  }

  function qualityKeyToHeight(qKey) {
    const map = {
      highres: 4320,
      hd2880: 2880,
      hd2160: 2160,
      hd1440: 1440,
      hd1080: 1080,
      hd720: 720,
      large: 480,
      medium: 360,
      small: 240,
      tiny: 144,
      light: 144
    };
    const k = String(qKey || '').toLowerCase();
    if (map[k]) return map[k];
    const m = k.match(/(\d{3,4})/);
    return m ? Number(m[1]) : 0;
  }

  function isHdrFormat(f) {
    if (!f) return false;
    if (typeof f.__isHdr === 'boolean') return f.__isHdr;
    const tc = (f.colorInfo && f.colorInfo.transferCharacteristics) || '';
    const m = (f.mimeType || '').toLowerCase();
    const ql = (f.__origQualityLabel || f.qualityLabel || '').toUpperCase();
    if (tc.includes('SMPTEST2084') || tc.includes('ARIB_STD_B67')) return true;
    if (/\.(16|18)\.\d{2}\.\d/.test(m) || ql.includes('HDR') || ql.includes('HLG')) return true;
    return false;
  }

  function detectVideoCodecFamily(mime) {
    const m = (mime || '').toLowerCase();
    if (m.includes('av01') || m.includes('av1')) return 'av01';
    if (m.includes('vp9') || m.includes('vp09')) return 'vp9';
    if (m.includes('avc1') || m.includes('h264')) return 'avc1';
    return 'other';
  }

  function detectVideoCodecLabel(mime, isHdr) {
    const m = (mime || '').toLowerCase();
    if (m.includes('av01') || m.includes('av1')) return isHdr ? 'av1 HDR' : 'av1';
    if (m.includes('vp9.2') || ((m.includes('vp9') || m.includes('vp09')) && isHdr)) return 'vp9 HDR';
    if (m.includes('vp9') || m.includes('vp09')) return 'vp9';
    if (m.includes('avc1') || m.includes('h264')) return 'avc';
    return 'video';
  }

  function codecMatchesPreference(mime, prefCodec) {
    const pref = String(prefCodec || 'any').toLowerCase();
    if (!pref || pref === 'any') return true;
    const fam = detectVideoCodecFamily(mime);
    if (pref === 'av1' || pref === 'av01') return fam === 'av01';
    if (pref === 'vp9' || pref === 'vp09') return fam === 'vp9';
    if (pref === 'avc' || pref === 'avc1' || pref === 'h264') return fam === 'avc1';
    return true;
  }

  // Codec priority: AV1 (3, best) -> VP9 (2, intermediate) -> AVC (1, compatibility)
  function defaultCodecRank(mime) {
    const fam = detectVideoCodecFamily(mime);
    if (fam === 'av01') return 3;
    if (fam === 'vp9') return 2;
    if (fam === 'avc1') return 1;
    return 0;
  }

  function getVideoKey(f) {
    const hdr = isHdrFormat(f) ? 'hdr' : 'sdr';
    const proto = f.protocol || 'dash';
    return `${f.itag}:${proto}:${f.width || 0}x${f.height || 0}:${f.fps || 30}:${hdr}`;
  }

  function extractAudioMetadata(f) {
    if (!f.__metaExtracted) {
      f.__metaExtracted = true;
      const at = f.audioTrack || null;
      f.__origTrackId = (at && at.id) ? String(at.id) : '';
      f.__origTrackName = (at && at.displayName) ? String(at.displayName) : '';
      f.__origIsDefault = !!(at && at.audioIsDefault);
      f.__isDrc = !!(f.isDrc || /drc/i.test(f.__origTrackId) || /drc/i.test(f.__origTrackName));
      f.__isVb = !!(f.isVb || /(?:^|[:;])vb=1/i.test(String(f.xtags || '')) || /vb/i.test(f.__origTrackId));
    }
    return {
      trackId: f.__origTrackId,
      trackName: f.__origTrackName,
      isDefault: f.__origIsDefault,
      isDrc: f.__isDrc,
      isVb: f.__isVb
    };
  }

  function getAudioKey(f) {
    const meta = extractAudioMetadata(f);
    const m = (f.mimeType || '').toLowerCase();
    const ch = f.audioChannels || ((m.includes('ec-3') || m.includes('ac-3') || m.includes('iamf')) ? 6 : 2);
    const variant = meta.isVb ? 'vb' : (meta.isDrc ? 'drc' : 'std');
    return `${f.itag}:${meta.trackId || 'default'}:${variant}:${ch}`;
  }

  function detectAudioName(f) {
    const meta = extractAudioMetadata(f);
    const m = (f.mimeType || '').toLowerCase();
    const kbps = Math.round(Number(f.bitrate || f.averageBitrate || 0) / 1000);
    const ch = f.audioChannels || ((m.includes('ec-3') || m.includes('ac-3') || m.includes('iamf')) ? 6 : 2);
    let baseLabel = `\u00c1udio ${ch >= 6 ? '5.1' : '2.0'} (${kbps} kbps)`;
    if (m.includes('ec-3')) baseLabel = `Dolby Digital Plus (ec-3 ${ch >= 6 ? '5.1' : '2.0'} a ${kbps} kbps)`;
    else if (m.includes('ac-3')) baseLabel = `Dolby Digital (ac-3 ${ch >= 6 ? '5.1' : '2.0'} a ${kbps} kbps)`;
    else if (m.includes('iamf')) baseLabel = `Opus Immersive (iamf 5.1 a ${kbps} kbps)`;
    else if (m.includes('opus')) baseLabel = `Opus ${ch >= 6 ? '5.1' : 'Est\u00e9reo'} (opus a ${kbps} kbps)`;
    else if (m.includes('mp4a')) baseLabel = `AAC ${ch >= 6 ? '5.1' : 'Est\u00e9reo'} (mp4a a ${kbps} kbps)`;

    const suffix = (meta.isDrc ? ' [DRC]' : '') + (meta.isVb ? ' [Voice Boost]' : '');
    if (meta.trackName && !meta.trackName.includes('kbps)')) {
      return `${meta.trackName} \u2014 ${baseLabel}${suffix}`;
    }
    return `${baseLabel}${suffix}`;
  }

  function mergeCatalogStreams(existingList, incomingList, keyFn) {
    const map = new Map();
    if (Array.isArray(existingList)) {
      for (const item of existingList) {
        if (item) map.set(keyFn(item), item);
      }
    }
    if (Array.isArray(incomingList)) {
      for (const item of incomingList) {
        if (item) map.set(keyFn(item), item);
      }
    }
    return Array.from(map.values());
  }

  // Sort catalog videos: highest height first, then AV1 -> VP9 -> AVC, then HDR, then FPS, then bitrate
  function sortCatalogVideos(list) {
    return list.slice().sort((a, b) => {
      const hDiff = Number(b.height || 0) - Number(a.height || 0);
      if (hDiff !== 0) return hDiff;
      const rankDiff = defaultCodecRank(b.mimeType) - defaultCodecRank(a.mimeType);
      if (rankDiff !== 0) return rankDiff;
      const hdrDiff = (isHdrFormat(b) ? 1 : 0) - (isHdrFormat(a) ? 1 : 0);
      if (hdrDiff !== 0) return hdrDiff;
      const fpsDiff = Number(b.fps || 30) - Number(a.fps || 30);
      if (fpsDiff !== 0) return fpsDiff;
      const brA = Number(a.bitrate || a.averageBitrate || 0);
      const brB = Number(b.bitrate || b.averageBitrate || 0);
      return brB - brA;
    });
  }

  function audioCodecPriority(a) {
    const m = (a.mimeType || '').toLowerCase();
    const ch = Number(a.audioChannels || 2);
    if (m.includes('ec-3') && ch >= 6) return 50;
    if (m.includes('ac-3') && ch >= 6) return 40;
    if (m.includes('iamf') && ch >= 6 && checkNativeIamfSupport()) return 35;
    if (ch >= 6) return 30;
    if (m.includes('opus')) return 20;
    if (m.includes('mp4a')) return 15;
    return 10;
  }

  function sortCatalogAudios(list) {
    const hasExplicitDefault = list.some(a => extractAudioMetadata(a).isDefault);
    return list.slice().sort((a, b) => {
      const metaA = extractAudioMetadata(a);
      const metaB = extractAudioMetadata(b);
      const chA = Number(a.audioChannels || 2) >= 6 ? 1 : 0;
      const chB = Number(b.audioChannels || 2) >= 6 ? 1 : 0;
      if (chA !== chB) return chB - chA;
      if (hasExplicitDefault && metaA.isDefault !== metaB.isDefault) {
        return (metaB.isDefault ? 1 : 0) - (metaA.isDefault ? 1 : 0);
      }
      const pDiff = audioCodecPriority(b) - audioCodecPriority(a);
      if (pDiff !== 0) return pDiff;
      if (metaA.isDrc !== metaB.isDrc) {
        return (metaA.isDrc ? 1 : 0) - (metaB.isDrc ? 1 : 0);
      }
      if (metaA.isVb !== metaB.isVb) {
        return (metaA.isVb ? 1 : 0) - (metaB.isVb ? 1 : 0);
      }
      const brA = Number(a.bitrate || a.averageBitrate || 0);
      const brB = Number(b.bitrate || b.averageBitrate || 0);
      if (brB !== brA) return brB - brA;
      return String(a.displayName || '').localeCompare(String(b.displayName || ''));
    });
  }

  function resolveTargetHeight(videos, preferredQualityStr) {
    if (!videos || !videos.length) return 0;
    const heights = Array.from(new Set(videos.map(v => Number(v.height || 0)).filter(h => h > 0))).sort((a, b) => b - a);
    if (!heights.length) return 0;
    const pref = String(preferredQualityStr || 'auto').toLowerCase();
    if (!pref || pref === 'auto') return heights[0];
    const desired = qualityKeyToHeight(pref) || parseInt(pref, 10) || 0;
    if (!desired) return heights[0];
    if (heights.includes(desired)) return desired;
    const lowerOrEqual = heights.find(h => h <= desired);
    return lowerOrEqual !== undefined ? lowerOrEqual : heights[heights.length - 1];
  }

  function selectBestVideoFormat(videos, preferredQualityStr, preferredCodecStr) {
    if (!videos || !videos.length) return null;
    const targetHeight = resolveTargetHeight(videos, preferredQualityStr);
    const atHeight = videos.filter(v => Number(v.height || 0) === targetHeight);
    const pool = atHeight.length ? atHeight : videos.slice();

    const sorted = pool.slice().sort((a, b) => {
      const matchA = codecMatchesPreference(a.mimeType, preferredCodecStr) ? 1 : 0;
      const matchB = codecMatchesPreference(b.mimeType, preferredCodecStr) ? 1 : 0;
      if (matchA !== matchB) return matchB - matchA;
      const rankDiff = defaultCodecRank(b.mimeType) - defaultCodecRank(a.mimeType);
      if (rankDiff !== 0) return rankDiff;
      const hdrDiff = (isHdrFormat(b) ? 1 : 0) - (isHdrFormat(a) ? 1 : 0);
      if (hdrDiff !== 0) return hdrDiff;
      const fpsDiff = Number(b.fps || 30) - Number(a.fps || 30);
      if (fpsDiff !== 0) return fpsDiff;
      return Number(b.bitrate || b.averageBitrate || 0) - Number(a.bitrate || a.averageBitrate || 0);
    });
    return sorted[0] || null;
  }

  function sortVideosForPlayback(videos, pin, prefs) {
    if (!videos || !videos.length) return [];
    let primaryItag = null;
    if (pin && pin.manualVideo && pin.videoItag) {
      primaryItag = Number(pin.videoItag);
    } else {
      const best = selectBestVideoFormat(videos, prefs.preferredVideoQuality, prefs.preferredVideoCodec);
      if (best) primaryItag = Number(best.itag);
    }
    const targetHeight = resolveTargetHeight(videos, prefs.preferredVideoQuality);
    return videos.slice().sort((a, b) => {
      if (primaryItag) {
        const isPrimaryA = Number(a.itag) === primaryItag ? 1 : 0;
        const isPrimaryB = Number(b.itag) === primaryItag ? 1 : 0;
        if (isPrimaryA !== isPrimaryB) return isPrimaryB - isPrimaryA;
      }
      const matchCodecA = codecMatchesPreference(a.mimeType, prefs.preferredVideoCodec) ? 1 : 0;
      const matchCodecB = codecMatchesPreference(b.mimeType, prefs.preferredVideoCodec) ? 1 : 0;
      const matchHeightA = Number(a.height || 0) === targetHeight ? 1 : 0;
      const matchHeightB = Number(b.height || 0) === targetHeight ? 1 : 0;
      if (matchHeightA !== matchHeightB) return matchHeightB - matchHeightA;
      if (matchCodecA !== matchCodecB) return matchCodecB - matchCodecA;
      const hDiff = Number(b.height || 0) - Number(a.height || 0);
      if (hDiff !== 0) return hDiff;
      const rankDiff = defaultCodecRank(b.mimeType) - defaultCodecRank(a.mimeType);
      if (rankDiff !== 0) return rankDiff;
      const hdrDiff = (isHdrFormat(b) ? 1 : 0) - (isHdrFormat(a) ? 1 : 0);
      if (hdrDiff !== 0) return hdrDiff;
      const fpsDiff = Number(b.fps || 30) - Number(a.fps || 30);
      if (fpsDiff !== 0) return fpsDiff;
      return Number(b.bitrate || b.averageBitrate || 0) - Number(a.bitrate || a.averageBitrate || 0);
    });
  }

  function parseHlsMasterPlaylist(m3u8Text, vid) {
    if (!m3u8Text || typeof m3u8Text !== 'string') return [];
    const lines = m3u8Text.split(/\r?\n/);
    const variants = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line.startsWith('#EXT-X-STREAM-INF:')) continue;
      const attrs = line.slice('#EXT-X-STREAM-INF:'.length);
      const uri = (lines[i + 1] || '').trim();
      const bwMatch = attrs.match(/(?:^|,)BANDWIDTH=(\d+)/i);
      const avgBwMatch = attrs.match(/AVERAGE-BANDWIDTH=(\d+)/i);
      const resMatch = attrs.match(/RESOLUTION=(\d+)x(\d+)/i);
      const fpsMatch = attrs.match(/FRAME-RATE=([\d.]+)/i);
      const codecsMatch = attrs.match(/CODECS="([^"]+)"/i);
      const rangeMatch = attrs.match(/VIDEO-RANGE=([A-Z0-9_-]+)/i);
      const itagMatch = uri.match(/[?&/]itag[=/](\d+)/i);

      const bitrate = Number((avgBwMatch && avgBwMatch[1]) || (bwMatch && bwMatch[1]) || 0);
      const width = resMatch ? Number(resMatch[1]) : 0;
      const height = resMatch ? Number(resMatch[2]) : 0;
      const fps = fpsMatch ? Math.round(Number(fpsMatch[1])) : 30;
      const codecs = codecsMatch ? codecsMatch[1] : '';
      const isHdr = (rangeMatch && rangeMatch[1] !== 'SDR') || /\.(16|18)\.\d{2}\.\d/.test(codecs);
      const itag = itagMatch ? `${itagMatch[1]}-hls` : `hls-${height}p-${ Math.round(bitrate / 1000) }k`;
      const mbps = (bitrate / 1000000).toFixed(2);
      const codecLabel = detectVideoCodecLabel(codecs, isHdr);

      variants.push({
        itag: itag,
        protocol: 'm3u8_native',
        width: width,
        height: height,
        fps: fps,
        bitrate: bitrate,
        mimeType: `video/mp4; codecs="${codecs}"`,
        __isHdr: isHdr,
        quality: heightToQualityKey(height),
        qualityLabel: `${height}p, ${fps}fps, ${mbps}Mbps, ${codecLabel} [HLS]`,
        url: uri,
        playableInCobaltAndroid: false,
        unplayableReason: 'COBALT_ANDROID_NO_HLS_DEMUXER'
      });
    }
    if (vid && catalog[vid]) {
      catalog[vid].hlsVariants = variants;
    }
    return variants;
  }

  window.__ttL1ParseHlsMasterPlaylist = parseHlsMasterPlaylist;

  function processPlayerPayload(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const sd = obj.streamingData;
    if (!sd || !Array.isArray(sd.adaptiveFormats) || !sd.adaptiveFormats.length) return obj;

    const vid = (obj.videoDetails && obj.videoDetails.videoId) || getCurrentVideoId() || '';
    const rawVids = [];
    const rawAuds = [];

    for (const f of sd.adaptiveFormats) {
      if (!f || !f.mimeType) continue;
      if (f.mimeType.startsWith('video/')) {
        if (!f.__origQualityLabel && f.qualityLabel) {
          f.__origQualityLabel = f.qualityLabel;
        }
        const hdr = isHdrFormat(f);
        f.__isHdr = hdr;
        const codec = detectVideoCodecLabel(f.mimeType, hdr);
        const fps = Number(f.fps || 30);
        const mbps = (Number(f.bitrate || f.averageBitrate || 0) / 1000000).toFixed(2);
        f.quality = heightToQualityKey(f.height);
        // SmartTube naming convention: "2160p, 60fps, 82.49Mbps, av1 HDR"
        f.qualityLabel = `${f.height}p, ${fps}fps, ${mbps}Mbps, ${codec}`;
        f.videoKey = getVideoKey(f);
        rawVids.push(f);
      } else if (f.mimeType.startsWith('audio/')) {
        const m = f.mimeType.toLowerCase();
        if (m.includes('iamf') && !checkNativeIamfSupport()) {
          continue;
        }
        if (!f.audioChannels && (m.includes('ec-3') || m.includes('ac-3') || m.includes('iamf'))) {
          f.audioChannels = 6;
        }
        extractAudioMetadata(f);
        f.audioKey = getAudioKey(f);
        f.displayName = detectAudioName(f);
        if (!f.audioTrack) {
          f.audioTrack = {
            displayName: f.displayName,
            id: f.audioKey,
            audioIsDefault: f.__origIsDefault
          };
        } else {
          f.audioTrack = Object.assign({}, f.audioTrack, {
            displayName: f.displayName,
            id: f.audioKey
          });
        }
        rawAuds.push(f);
      }
    }

    if (vid) {
      const existing = catalog[vid];
      const mergedVids = sortCatalogVideos(
        mergeCatalogStreams(existing && existing.videos, rawVids, getVideoKey)
      );
      const mergedAuds = sortCatalogAudios(
        mergeCatalogStreams(existing && existing.audios, rawAuds, getAudioKey)
      );
      catalog[vid] = {
        videoId: vid,
        title: (obj.videoDetails && obj.videoDetails.title) || (existing && existing.title) || '',
        videos: mergedVids,
        audios: mergedAuds,
        hlsManifestUrl: sd.hlsManifestUrl || (existing && existing.hlsManifestUrl) || null,
        hlsVariants: (existing && existing.hlsVariants) || [],
        updatedAt: Date.now()
      };
    }

    const pin = getPin(vid);
    const prefs = getUserPreferences();

    // Keep all video formats in adaptiveFormats (ordered by manual pin or user preference)
    // so YouTube's native formatId selector (loader.Om) and ABR fallback work without
    // ever destroying options or freezing when a resolution/codec is missing.
    const fullVids = (vid && catalog[vid] && catalog[vid].videos.length >= rawVids.length)
      ? catalog[vid].videos
      : rawVids;
    const vids = sortVideosForPlayback(fullVids, pin, prefs);

    // Pre-seed player.js's yt-player-quality in localStorage BEFORE MediaSource creation
    // so player.js (FU()) starts directly at the target resolution on frame 0 without
    // starting at 1080p and flushing the decoder 500ms into playback!
    try {
      if (vids.length && window.localStorage) {
        const initialFmt = vids[0];
        const targetH = Number(initialFmt && initialFmt.height) || 2160;
        const now = Date.now();
        window.localStorage.setItem('yt-player-quality', JSON.stringify({
          data: JSON.stringify({ quality: targetH, previousQuality: targetH }),
          expiration: now + 31104000000,
          creation: now
        }));
        window.localStorage.removeItem('yt-player-performance-cap');
        window.localStorage.removeItem('yt-player-performance-cap-active-set');
      }
    } catch (e) {}

    let auds = (vid && catalog[vid] && catalog[vid].audios.length >= rawAuds.length)
      ? catalog[vid].audios.slice()
      : sortCatalogAudios(rawAuds);

    // Audio Track Selection: When user explicitly selects an audio track (by composite audioKey or itag),
    // feed that exact audio stream so YouTube player plays the selected language/DRC/5.1 track.
    if (pin.audioKey || pin.audioItag) {
      let match = [];
      if (pin.audioKey) {
        match = auds.filter(a => a.audioKey === pin.audioKey);
      }
      if (!match.length && pin.audioItag) {
        match = auds.filter(a => Number(a.itag) === Number(pin.audioItag));
      }
      if (match.length) {
        auds = match;
      }
    }

    sd.adaptiveFormats = vids.concat(auds);
    return obj;
  }

  // 10. TubeRush UI Rebranding & Portuguese (pt-BR) Localization
  // (preserves original author credits: Reis Can / reisxd)
  const PT_BR_DICT = {
    'TubeRush Settings': 'Configurações do TubeRush',
    'Open TubeRush Settings': 'Abrir Configurações do TubeRush',
    'Made by Reis Can (reisxd) with ❤️': 'Feito por Reis Can (reisxd) com ❤️',
    'Social Media Links': 'Redes Sociais',
    'Ad Block': 'Bloqueador de Anúncios',
    'SponsorBlock Settings': 'Configurações do SponsorBlock',
    'Enable SponsorBlock': 'Ativar SponsorBlock',
    'Manual SponsorBlock Segment Skip': 'Pular Segmentos do SponsorBlock Manualmente',
    'Segments': 'Segmentos',
    'Skip Sponsor Segments': 'Pular Segmentos Patrocinados',
    'Skip Intro Segments': 'Pular Segmentos de Introdução',
    'Skip Outro Segments': 'Pular Segmentos de Encerramento',
    'Skip Interaction Reminder Segments': 'Pular Segmentos de Lembrete de Interação',
    'Skip Self-Promotion Segments': 'Pular Segmentos de Autopromoção',
    'Skip Preview/Recap Segments': 'Pular Segmentos de Pré-visualização/Resumo',
    'Skip Tangents/Jokes': 'Pular Assuntos Paralelos/Piadas',
    'Skip Non-Music Segments': 'Pular Segmentos Não Musicais',
    'Enable Highlights': 'Ativar Destaques',
    'Show SponsorBlock Toasts': 'Mostrar Avisos do SponsorBlock',
    'DeArrow Settings': 'Configurações do DeArrow',
    'Enable DeArrow': 'Ativar DeArrow',
    'Enable DeArrow Thumbnails': 'Ativar Miniaturas do DeArrow',
    'Miscellaneous Settings': 'Configurações Diversas',
    'Hide End Screen Cards': 'Ocultar Cards no Final do Vídeo',
    "Enable 'Are You Still There?' Renderer": "Ativar Aviso de 'Você ainda está assistindo?'",
    "Enable 'Includes Paid Promotion' Overlay": "Ativar Sobreposição de 'Contém promoção paga'",
    "Who's Watching Menu": "Menu 'Quem está assistindo?'",
    "Enable Who's Watching Menu": "Ativar Menu 'Quem está assistindo?'",
    "Permanently Enable Who's Watching Menu": "Ativar Menu 'Quem está assistindo?' Permanentemente",
    "Enable Who's Watching Menu on App Exit": "Ativar Menu 'Quem está assistindo?' ao Sair do App",
    'Fix UI': 'Corrigir Interface',
    'Enable High Quality Thumbnails': 'Ativar Miniaturas de Alta Qualidade',
    'Enable Long Press Actions': 'Ativar Ações de Toque Longo',
    'Enable Shorts': 'Ativar Shorts',
    'Enable Video Previews': 'Ativar Pré-visualizações de Vídeo',
    'Show TT Welcome Message': 'Mostrar Mensagem de Boas-vindas do TubeRush',
    'Show Guest Sign-In Reminder': 'Mostrar Lembrete de Login para Convidados',
    'Reload Home on Startup': 'Recarregar a Página Inicial na Inicialização',
    'Subtitle Settings': 'Configurações das Legendas',
    'Show Local Subtitles': 'Mostrar Legendas Locais',
    'Show Hidden Subtitles': 'Mostrar Legendas Ocultas',
    'Remember Caption Style': 'Lembrar Estilo da Legenda',
    'Video Player Settings': 'Configurações do Reprodutor de Vídeo',
    'Customize video player features': 'Personalizar recursos do reprodutor de vídeo',
    'Patch Video Player UI': 'Corrigir Interface do Reprodutor de Vídeo',
    'Enable Video Player UI Patching': 'Ativar Correção da Interface do Reprodutor de Vídeo',
    'Enable Previous/Next Buttons': 'Ativar Botões de Avançar/Retroceder',
    'Show Super Thanks Button': 'Mostrar Botão de Valeu Demais',
    'Show Speed Control Button': 'Mostrar Botão de Controle de Velocidade',
    'Show Ask Button': 'Mostrar Botão Perguntar (IA)',
    'Show Mini Player Button': 'Mostrar Botão de Miniatura',
    'Swap Mini Player Button with PiP Button': 'Trocar Botão de Miniatura pelo PiP',
    'Preferred Video Quality': 'Qualidade de Vídeo Preferida',
    'Choose your preferred or closest available video quality to start playback with': 'Escolha a qualidade de vídeo preferida ou a mais próxima disponível ao iniciar a reprodução',
    'Speed Setting Intervals': 'Intervalos do Ajuste de Velocidade',
    'Set the speed increments for adjusting video playback speed': 'Defina os incrementos de velocidade para ajustar a velocidade de reprodução do vídeo',
    'Preferred Video Codec': 'Codificação de Vídeo Preferida',
    'Choose your preferred video codec for playback': 'Escolha a codificação de vídeo preferida para reprodução',
    'Auto Frame Rate': 'Taxa de Quadros Automática (AFR)',
    'Auto Frame Rate Pause Duration': 'Duração da Pausa da Taxa de Quadros Automática',
    'Set the duration (in seconds) to pause video playback when adjusting frame rate': 'Defina a duração (em segundos) da pausa na reprodução do vídeo ao ajustar a taxa de quadros',
    'Any': 'Qualquer',
    'Auto': 'Automática',
    'Hide Related Videos': 'Ocultar Vídeos Relacionados',
    'User Interface Settings': 'Configurações da Interface de Usuário',
    'Customize the interface to your liking': 'Personalize a interface ao seu gosto',
    'Hide Watched Videos': 'Ocultar Vídeos Assistidos',
    'Enable Hide Watched Videos': 'Ativar Ocultação de Vídeos Assistidos',
    'Watched Videos Threshold': 'Percentual Mínimo Assistido',
    'Set the threshold percentage to determine when a video is considered watched.': 'Defina o percentual mínimo assistido para ocultar vídeos já vistos.',
    'Set Pages to Hide Watched Videos': 'Definir Páginas para Ocultar Vídeos Assistidos',
    'Screen Dimming': 'Escurecimento da Tela',
    'Enable Screen Dimming': 'Ativar Escurecimento da Tela',
    'Dimming Timeout': 'Tempo de Espera do Escurecimento',
    'Set the inactivity timeout (in seconds) before the screen dims': 'Defina o tempo de espera por inatividade (em segundos) antes que a tela escureça',
    'Dimming Opacity': 'Opacidade do Escurecimento',
    'Set the opacity level for screen dimming': 'Defina o nível de opacidade para o escurecimento da tela',
    'Disable Sidebar Contents': 'Desativar Conteúdos da Barra Lateral',
    'Select sidebar contents to hide': 'Selecione os conteúdos da barra lateral para ocultar',
    'Launch to on Startup': 'Página Inicial ao Abrir',
    'Choose the default page TubeRush launches into on startup': 'Escolha a página padrão que o TubeRush abrirá na inicialização',
    'Sort Subscriptions Alphabetically': 'Ordenar Inscrições em Ordem Alfabética',
    'Disable Channels on Sidebar': 'Desativar Canais na Barra Lateral',
    'Clock': 'Relógio',
    'Display a clock on the screen': 'Exibir um relógio na tela',
    'Enable Clock': 'Ativar Relógio',
    'Use 12-Hour Format for Clock': 'Usar Formato de 12 Horas no Relógio',
    'Show Seconds on Clock': 'Mostrar Segundos no Relógio',
    'Hide Clock While Video is Playing': 'Ocultar Relógio Durante a Reprodução',
    'Disable Enlarged Thumbnails': 'Desativar Miniaturas Ampliadas',
    'Enable Shrinked Thumbnails': 'Ativar Miniaturas Reduzidas',
    'Sort Sidebar Contents': 'Ordenar Conteúdos da Barra Lateral',
    'Reorder sidebar contents to your preference': 'Reordene os itens da barra lateral conforme sua preferência',
    'TubeRush Updater': 'Atualizador do TubeRush',
    'Manage TubeRush updates': 'Gerenciar atualizações do TubeRush',
    'Check for updates': 'Verificar atualizações',
    'Check for updates on startup': 'Verificar atualizações ao iniciar',
    'Update Available': 'Atualização Disponível',
    'Update Now': 'Atualizar Agora',
    'Click to download the latest version.': 'Clique para baixar a versão mais recente.',
    'Remind Me Later': 'Lembrar Mais Tarde',
    'Check for updates later.': 'Verificar atualizações mais tarde.',
    'TubeRush is up to date': 'O TubeRush está atualizado',
    'TubeRush update check failed': 'Falha ao verificar atualizações do TubeRush',
    'Could not check for updates.': 'Não foi possível verificar se há atualizações.',
    'TubeRush Update': 'Atualização do TubeRush',
    'Downloading update, please wait...': 'Baixando atualização, aguarde...',
    'Support TubeRush': 'Apoie o TizenTube / TubeRush',
    '❤️ Show support for TubeRush and its development': '❤️ Mostre apoio ao desenvolvimento do projeto',
    'Welcome to TubeRush': 'Bem-vindo ao TubeRush',
    'Go to settings and click on TubeRush Settings for settings.': 'Vá em Configurações e clique em Configurações do TubeRush.'
  };

  function rebrandString(str) {
    if (typeof str !== 'string' || !str) return str;
    if (str.includes('Reis Can') || str.includes('reisxd')) {
      return PT_BR_DICT[str] || str;
    }
    if (str.includes('github.com/')) return str;
    let s = str;
    if (s.includes('TizenTube')) {
      s = s.replace(/TizenTube\s+Cobalt/g, 'TubeRush').replace(/TizenTube/g, 'TubeRush');
    }
    if (PT_BR_DICT[s]) return PT_BR_DICT[s];
    if (/^Current version:\s*(.+)$/i.test(s)) {
      return s.replace(/^Current version:\s*/i, 'Versão atual: ');
    }
    if (/^Versão Atual:\s*(.+)$/i.test(s)) {
      return s;
    }
    if (/^You are using the latest version \((.+)\) of TubeRush\.$/i.test(s)) {
      return s.replace(/^You are using the latest version \((.+)\) of TubeRush\.$/i, 'Você já está usando a versão mais recente ($1) do TubeRush.');
    }
    if (/^A new version of TubeRush is available:\s*(.+),\s*current:\s*(.+)$/i.test(s)) {
      return s.replace(/^A new version of TubeRush is available:\s*(.+),\s*current:\s*(.+)$/i, 'Uma nova versão do TubeRush está disponível: $1 (atual: $2)');
    }
    if (/^Release Date:\s*(.+)$/i.test(s)) {
      return s.replace(/^Release Date:\s*/i, 'Data de lançamento: ');
    }
    return s;
  }

  function rebrandObjectInPlace(node, depth) {
    if (!node || typeof node !== 'object' || (depth || 0) > 10) return node;
    const d = (depth || 0) + 1;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        if (typeof node[i] === 'string') node[i] = rebrandString(node[i]);
        else if (node[i] && typeof node[i] === 'object') rebrandObjectInPlace(node[i], d);
      }
      return node;
    }
    for (const k of Object.keys(node)) {
      if (k === 'customAction' || k === 'categoryId' || k === 'itemId' || k === 'trackingParams') continue;
      const val = node[k];
      if (typeof val === 'string') {
        node[k] = rebrandString(val);
      } else if (val && typeof val === 'object') {
        rebrandObjectInPlace(val, d);
      }
    }
    return node;
  }

  // 11. Clean, chain-safe JSON.parse hook:
  // Keeps window.JSON.parse as a standard writable function so tizentube.js's two-stage
  // wrapper chain (vo -> fn1 -> Gr -> fn2) executes 100% natively (injecting the TubeRush/TizenTube
  // Settings category above "Assinar o YouTube Premium", AdBlock, SponsorBlock, DeArrow, etc.),
  // while protecting res.streamingData.adaptiveFormats with an instance setter so tizentube.js's
  // `.filter(...)` cannot strip out AV1, VP9, or AVC codecs!
  window.JSON.parse = function () {
    const res = nativeJsonParse.apply(this, arguments);
    try {
      if (res && typeof res === 'object') {
        if (res.streamingData && Array.isArray(res.streamingData.adaptiveFormats)) {
          processPlayerPayload(res);
          let protectedFormats = res.streamingData.adaptiveFormats;
          try {
            Object.defineProperty(res.streamingData, 'adaptiveFormats', {
              configurable: true,
              enumerable: true,
              get: function () {
                return protectedFormats;
              },
              set: function (newVal) {
                // Ignore destructive codec filtering from tizentube.js fn1 that shrinks the format list!
                if (Array.isArray(newVal) && newVal.length >= protectedFormats.length) {
                  protectedFormats = newVal;
                }
              }
            });
          } catch (e) {}
        }
        // When Settings response is parsed, tizentube.js fn1 calls `res.items.unshift(o)`
        // to inject the Settings button above "Assinar o YouTube Premium". Rebrand `o` on unshift!
        if (res.title && res.title.runs && Array.isArray(res.items) && !res.items.__ttUnshiftHooked) {
          const origUnshift = res.items.unshift;
          Object.defineProperty(res.items, '__ttUnshiftHooked', { value: true, enumerable: false });
          Object.defineProperty(res.items, 'unshift', {
            configurable: true,
            enumerable: false,
            writable: true,
            value: function () {
              for (let i = 0; i < arguments.length; i++) {
                try {
                  rebrandObjectInPlace(arguments[i], 0);
                } catch (e) {}
              }
              return origUnshift.apply(this, arguments);
            }
          });
        }
      }
    } catch (e) {}
    return res;
  };

  // 12. Normalize GitHub Releases payload for TubeRush Self-Updater (U01)
  function parseSemverTuple(verStr) {
    const m = String(verStr || '').replace(/^v/i, '').match(/(\d+)\.(\d+)\.(\d+)/);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
  }

  function isRemoteVersionNewer(remoteTag, currentVer) {
    const r = parseSemverTuple(remoteTag);
    const c = parseSemverTuple(currentVer);
    for (let i = 0; i < 3; i++) {
      if (r[i] > c[i]) return true;
      if (r[i] < c[i]) return false;
    }
    return false;
  }

  function getInstalledAppVersion() {
    try {
      if (window.h5vcc && window.h5vcc.system && typeof window.h5vcc.system.getVersion === 'function') {
        const v = window.h5vcc.system.getVersion();
        if (v) return String(v).replace(/^v/i, '');
      }
      if (window.h5vcc && window.h5vcc.tizentube && typeof window.h5vcc.tizentube.GetVersion === 'function') {
        const v = window.h5vcc.tizentube.GetVersion();
        if (v) return String(v).replace(/^v/i, '');
      }
    } catch (e) {}
    return '1.1.1';
  }

  function normalizeReleasePayload(data) {
    if (!data || typeof data !== 'object' || !Array.isArray(data.assets)) return data;
    try {
      const installedVer = getInstalledAppVersion();
      if (data.tag_name && installedVer && !isRemoteVersionNewer(data.tag_name, installedVer)) {
        data.tag_name = 'v' + installedVer;
      }
    } catch (e) {}
    const apkAssets = data.assets.filter(a => a && typeof a.name === 'string' && a.name.toLowerCase().endsWith('.apk'));
    if (apkAssets.length) {
      const armv7Asset = apkAssets.find(a => /armv7|armeabi-v7a|arm\.apk/i.test(a.name)) || apkAssets[0];
      const arm64Asset = apkAssets.find(a => /arm64|aarch64/i.test(a.name)) || armv7Asset;
      if (armv7Asset && !data.assets.some(a => a && a.name && a.name.includes('arm.apk'))) {
        data.assets.push(Object.assign({}, armv7Asset, { name: 'TubeRush-arm.apk' }));
      }
      if (arm64Asset && !data.assets.some(a => a && a.name && a.name.includes('arm64.apk'))) {
        data.assets.push(Object.assign({}, arm64Asset, { name: 'TubeRush-arm64.apk' }));
      }
    }
    return data;
  }

  // Intercept window.fetch for TubeRush Updater redirect
  try {
    if (typeof window.fetch === 'function') {
      const origFetch = window.fetch.bind(window);
      window.fetch = function (input, init) {
        try {
          const urlStr = typeof input === 'string' ? input : (input && input.url) || '';
          if (urlStr.includes('api.github.com/repos/reisxd/TizenTubeCobalt/releases')) {
            return origFetch(TUBERUSH_RELEASES_API, init).then(resp => {
              const origJson = resp.json.bind(resp);
              resp.json = function () {
                return origJson().then(data => normalizeReleasePayload(data));
              };
              return resp;
            });
          }
        } catch (e) {}
        return origFetch(input, init);
      };
    }
  } catch (e) {}

  // Intercept Response.prototype.json
  try {
    if (window.Response && Response.prototype && Response.prototype.json) {
      const origRespJson = Response.prototype.json;
      Response.prototype.json = function () {
        const respUrl = this && this.url ? String(this.url) : '';
        return origRespJson.apply(this, arguments).then(data => {
          try {
            if (respUrl.includes('api.github.com/repos/HeliumMarcos/TubeRush/releases') ||
                respUrl.includes('api.github.com/repos/reisxd/TizenTubeCobalt/releases')) {
              return normalizeReleasePayload(data);
            }
            if (data && data.streamingData && Array.isArray(data.streamingData.adaptiveFormats)) {
              return processPlayerPayload(data);
            }
          } catch (e) {}
          return data;
        });
      };
    }
  } catch (e) {}

  function getCurrentVideoId() {
    try {
      const p = document.getElementById('ytlr-player__player-container-player');
      if (p && p.getVideoData) {
        const d = p.getVideoData();
        if (d && d.video_id) return d.video_id;
      }
    } catch (e) {}
    try {
      const m = location.href.match(/[?&#/]v=([a-zA-Z0-9_-]{6,})/) || location.href.match(/\/watch\/([a-zA-Z0-9_-]{6,})/);
      return m ? m[1] : '';
    } catch (e) {}
    return '';
  }

  let hasPendingResume = false;
  function reloadPlayerAtCurrentTime(vid) {
    const v = document.querySelector('video');
    const t = v ? (v.currentTime || 0) : 0;
    try {
      if (t > 1) {
        sessionStorage.setItem(SESSION_RESUME_PREFIX + vid, String(t));
        hasPendingResume = true;
      }
    } catch (e) {}
    const p = document.getElementById('ytlr-player__player-container-player');
    try {
      if (p && typeof p.loadVideoById === 'function') {
        p.loadVideoById({ videoId: vid, startSeconds: t });
        setTimeout(() => {
          try {
            if (p && typeof p.playVideo === 'function') p.playVideo();
            checkResume();
          } catch (e) {}
        }, 150);
        return;
      }
    } catch (e) {}
    try {
      if (p && typeof p.loadVideoByPlayerVars === 'function') {
        p.loadVideoByPlayerVars({ videoId: vid, startSeconds: t });
        setTimeout(() => {
          try {
            if (p && typeof p.playVideo === 'function') p.playVideo();
            checkResume();
          } catch (e) {}
        }, 150);
        return;
      }
    } catch (e) {}
    location.reload();
  }

  // Resume playback position smoothly after audio stream switch (only runs when a resume is pending)
  function checkResume() {
    if (!hasPendingResume) return;
    const vid = getCurrentVideoId();
    if (!vid) return;
    try {
      const saved = sessionStorage.getItem(SESSION_RESUME_PREFIX + vid);
      if (saved) {
        sessionStorage.removeItem(SESSION_RESUME_PREFIX + vid);
        hasPendingResume = false;
        const t = parseFloat(saved);
        const v = document.querySelector('video');
        if (v && !isNaN(t) && t > 1) {
          const seek = () => {
            try {
              v.currentTime = t;
              v.play();
            } catch (e) {}
          };
          if (v.readyState >= 1) seek();
          else v.addEventListener('loadedmetadata', seek, { once: true });
        }
      }
    } catch (e) {}
  }

  function getActiveItagsFromStats(p) {
    let videoItag = null;
    let audioItag = null;
    try {
      const player = p || document.getElementById('ytlr-player__player-container-player');
      if (player && typeof player.getStatsForNerds === 'function') {
        const s = player.getStatsForNerds();
        if (s && typeof s.codecs === 'string') {
          const vm = s.codecs.match(/^\s*[a-zA-Z0-9.-]+\s*\((\d+)\)/);
          if (vm) videoItag = Number(vm[1]);
          const am = s.codecs.match(/\/\s*[a-zA-Z0-9.-]+\s*\((\d+)\)/);
          if (am) audioItag = Number(am[1]);
        }
      }
    } catch (e) {}
    return { videoItag, audioItag };
  }

  function getCurrentlyPlayingVideoFormat(vid, p) {
    const cat = (vid && catalog[vid]) || null;
    if (!cat || !cat.videos || !cat.videos.length) return null;
    const stats = getActiveItagsFromStats(p);
    if (stats.videoItag) {
      const byStats = cat.videos.find(v => Number(v.itag) === stats.videoItag);
      if (byStats) return byStats;
    }
    const pin = getPin(vid);
    if (pin && pin.videoItag) {
      const byPin = cat.videos.find(v => Number(v.itag) === Number(pin.videoItag));
      if (byPin) return byPin;
    }
    const prefs = getUserPreferences();
    return selectBestVideoFormat(cat.videos, prefs.preferredVideoQuality, prefs.preferredVideoCodec) || cat.videos[0];
  }

  // Helper to determine currently active audio track for accurate checkmark reporting
  function getCurrentlyPlayingAudioTrack(vid, p) {
    const cat = (vid && catalog[vid]) || null;
    if (!cat || !cat.audios || !cat.audios.length) return null;
    const pin = getPin(vid);
    if (pin && pin.audioKey) {
      const byKey = cat.audios.find(a => a.audioKey === pin.audioKey);
      if (byKey) return byKey;
    }
    if (pin && pin.audioItag) {
      const byPin = cat.audios.find(a => Number(a.itag) === Number(pin.audioItag));
      if (byPin) return byPin;
    }
    const stats = getActiveItagsFromStats(p);
    if (stats.audioItag) {
      const byStats = cat.audios.find(a => Number(a.itag) === stats.audioItag);
      if (byStats) return byStats;
    }
    return cat.audios[0];
  }

  // Create robust AudioTrack object fully conforming to YouTube TV player & Kabuki UI interfaces
  function createAudioTrackObj(a, activeAudio) {
    const key = a.audioKey || getAudioKey(a);
    const name = a.displayName || detectAudioName(a);
    const isDef = activeAudio ? (key === (activeAudio.audioKey || getAudioKey(activeAudio))) : false;
    const langInfo = {
      id: key,
      name: name,
      isDefault: isDef,
      isAutoDubbed: false,
      getName: function () { return name; },
      getId: function () { return key; },
      getIsDefault: function () { return isDef; },
      getIsAutoDubbed: function () { return false; },
      toString: function () { return name; }
    };
    return {
      id: key,
      itag: Number(a.itag),
      audioKey: key,
      xb: langInfo,
      getLanguageInfo: function () { return langInfo; },
      getName: function () { return name; },
      getId: function () { return key; },
      getIsDefault: function () { return isDef; },
      isAutoDubbed: function () { return false; },
      captionTracks: [],
      captionsInitialState: 'CAPTIONS_INITIAL_STATE_UNKNOWN',
      toString: function () { return name; }
    };
  }

  function hookYttvResolveCommand() {
    try {
      if (!window._yttv || typeof window._yttv !== 'object') return;
      for (const k of Object.keys(window._yttv)) {
        const entry = window._yttv[k];
        if (!entry || typeof entry !== 'object') continue;
        // Keep _yttv JSON.parse synchronized with window.JSON.parse chain
        if (entry.JSON && entry.JSON.parse && entry.JSON.parse !== window.JSON.parse) {
          entry.JSON.parse = window.JSON.parse;
        }
        const inst = entry.instance;
        if (inst && typeof inst.resolveCommand === 'function' && !inst.resolveCommand.__ttL1ResolveHooked) {
          const origResolve = inst.resolveCommand.bind(inst);
          const wrappedResolve = function (cmd, arg2) {
            try {
              if (cmd && typeof cmd === 'object' && (cmd.openPopupAction || cmd.showEngagementPanelEndpoint)) {
                rebrandObjectInPlace(cmd, 0);
              }
            } catch (e) {}
            return origResolve(cmd, arg2);
          };
          wrappedResolve.__ttL1ResolveHooked = true;
          inst.resolveCommand = wrappedResolve;
        }
      }
    } catch (e) {}
  }

  // 13. Hook native YouTube TV Player API methods AFTER player.js GJ() attaches them onto p
  function hookPlayerApi() {
    hookYttvResolveCommand();
    if (hasPendingResume) checkResume();
    const p = document.getElementById('ytlr-player__player-container-player');
    if (!p) return;
    // Wait until player.js GJ() has populated the native player API methods on the DOM element!
    if (typeof p.setPlaybackQualityRange !== 'function' ||
        typeof p.getAvailableQualityDataAndMessaging !== 'function') {
      return;
    }
    // If our hook is already the active method on p, do nothing!
    // (If player.js GJ() runs later and overwrites p's methods, __ttL1OurHook will be absent and we re-hook!)
    if (p.getAvailableQualityDataAndMessaging.__ttL1OurHook) {
      return;
    }

    const origQDataMsg = p.getAvailableQualityDataAndMessaging.bind(p);
    const origSetQuality = p.setPlaybackQualityRange.bind(p);
    const origGetQualityLabel = typeof p.getPlaybackQualityLabel === 'function'
      ? p.getPlaybackQualityLabel.bind(p)
      : null;
    const origGetUserQualityPref = typeof p.getUserPlaybackQualityPreference === 'function'
      ? p.getUserPlaybackQualityPreference.bind(p)
      : null;

    // A. Native "Qualidade do vídeo atual" Menu:
    // Return all video formats (AV1, VP9, AVC) ordered at each resolution by:
    // 1. User preferredVideoCodec (if set)
    // 2. Codec quality rank: AV1 (best) -> VP9 (intermediate) -> AVC (compatibility)
    // 3. HDR -> FPS -> Bitrate
    const hookedGetQDataMsg = function () {
      const vid = getCurrentVideoId();
      const cat = (vid && catalog[vid]) || null;
      if (cat && cat.videos && cat.videos.length) {
        const activeVid = getCurrentlyPlayingVideoFormat(vid, p);
        const prefs = getUserPreferences();
        const ordered = cat.videos.slice().sort((a, b) => {
          const hDiff = Number(b.height || 0) - Number(a.height || 0);
          if (hDiff !== 0) return hDiff;
          const matchA = codecMatchesPreference(a.mimeType, prefs.preferredVideoCodec) ? 1 : 0;
          const matchB = codecMatchesPreference(b.mimeType, prefs.preferredVideoCodec) ? 1 : 0;
          if (matchA !== matchB) return matchB - matchA;
          const rankDiff = defaultCodecRank(b.mimeType) - defaultCodecRank(a.mimeType);
          if (rankDiff !== 0) return rankDiff;
          const hdrDiff = (isHdrFormat(b) ? 1 : 0) - (isHdrFormat(a) ? 1 : 0);
          if (hdrDiff !== 0) return hdrDiff;
          const fpsDiff = Number(b.fps || 30) - Number(a.fps || 30);
          if (fpsDiff !== 0) return fpsDiff;
          return Number(b.bitrate || b.averageBitrate || 0) - Number(a.bitrate || a.averageBitrate || 0);
        });
        const qualityData = ordered.map(f => {
          const qKey = heightToQualityKey(f.height);
          return {
            formatId: String(f.itag),
            qualityLabel: f.qualityLabel,
            quality: qKey,
            isPlayable: true,
            formatItag: f.itag,
            isCurrent: activeVid ? (Number(activeVid.itag) === Number(f.itag)) : false
          };
        });
        return { qualityData, qualityMessagingFormattedString: undefined };
      }
      return origQDataMsg ? origQDataMsg() : { qualityData: [] };
    };
    hookedGetQDataMsg.__ttL1OurHook = true;
    p.getAvailableQualityDataAndMessaging = hookedGetQDataMsg;

    p.getAvailableQualityData = function () {
      const res = p.getAvailableQualityDataAndMessaging();
      return (res && res.qualityData) || [];
    };

    p.getAvailableQualityLabels = function () {
      const qd = p.getAvailableQualityData();
      if (qd && qd.length) return qd.map(q => q.qualityLabel);
      return [];
    };

    // Report active video format's qualityLabel so Kabuki checkmark matches real playback (V05)
    p.getPlaybackQualityLabel = function () {
      const vid = getCurrentVideoId();
      const active = getCurrentlyPlayingVideoFormat(vid, p);
      if (active && active.qualityLabel) return active.qualityLabel;
      return origGetQualityLabel ? origGetQualityLabel() : '';
    };

    p.getUserPlaybackQualityPreference = function () {
      const vid = getCurrentVideoId();
      const active = getCurrentlyPlayingVideoFormat(vid, p);
      if (active && active.height) {
        return heightToQualityKey(active.height);
      }
      const pin = getPin(vid);
      if (pin && pin.manualVideo && pin.videoItag) {
        const cat = (vid && catalog[vid]) || null;
        const m = cat && cat.videos && cat.videos.find(v => Number(v.itag) === Number(pin.videoItag));
        return m ? heightToQualityKey(m.height) : 'hd2160';
      }
      const prefs = getUserPreferences();
      if (prefs.preferredVideoQuality && prefs.preferredVideoQuality !== 'auto') {
        const cat = (vid && catalog[vid]) || null;
        if (cat && cat.videos && cat.videos.length) {
          const h = resolveTargetHeight(cat.videos, prefs.preferredVideoQuality);
          return heightToQualityKey(h);
        }
        return heightToQualityKey(qualityKeyToHeight(prefs.preferredVideoQuality));
      }
      if (origGetUserQualityPref) {
        const res = origGetUserQualityPref();
        if (res) return res;
      }
      return 'auto';
    };

    // Non-destructive, zero-stutter video quality selection:
    // Avoids calling origSetQuality when the target format is ALREADY playing so player.js
    // never detaches/reattaches MediaSource (reattachOnConstraint) unnecessarily on startup!
    p.setPlaybackQualityRange = function (minQ, maxQ, formatId) {
      const vid = getCurrentVideoId();
      const cat = (vid && catalog[vid]) || null;
      const qStr = String(maxQ || minQ || '').trim();
      const prefs = getUserPreferences();

      // Case 1: User selected "Automática" in the native menu
      if (qStr === 'auto') {
        setPin(vid, { videoItag: null, manualVideo: false });
        let ret;
        if (origSetQuality) {
          if (prefs.preferredVideoQuality && prefs.preferredVideoQuality !== 'auto' && cat && cat.videos && cat.videos.length) {
            const best = selectBestVideoFormat(cat.videos, prefs.preferredVideoQuality, prefs.preferredVideoCodec);
            if (best) {
              const stats = getActiveItagsFromStats(p);
              if (!stats.videoItag || Number(stats.videoItag) !== Number(best.itag)) {
                const qKey = heightToQualityKey(best.height);
                ret = origSetQuality(qKey, qKey, String(best.itag));
              }
            } else {
              ret = origSetQuality('auto', 'auto', '');
            }
          } else {
            ret = origSetQuality('auto', 'auto', '');
          }
        }
        try {
          p.dispatchEvent(new CustomEvent('onPlaybackQualityChange'));
        } catch (e) {}
        return ret;
      }

      if (cat && cat.videos && cat.videos.length) {
        // Case 2: Explicit formatId passed by Kabuki when user clicks a specific format in "Qualidade do vídeo atual"
        let explicitItag = formatId ? Number(formatId) : null;
        if (!explicitItag) {
          const fmtRx = qStr.match(/^fmt_(\d+)$/);
          if (fmtRx) explicitItag = Number(fmtRx[1]);
        }
        if (!explicitItag) {
          const byLabel = cat.videos.find(v => v.qualityLabel === qStr);
          if (byLabel) explicitItag = Number(byLabel.itag);
        }

        if (explicitItag) {
          const targetFmt = cat.videos.find(v => Number(v.itag) === explicitItag);
          if (targetFmt) {
            setPin(vid, { videoItag: Number(targetFmt.itag), manualVideo: true });
            const stats = getActiveItagsFromStats(p);
            let ret;
            if (!stats.videoItag || Number(stats.videoItag) !== Number(targetFmt.itag)) {
              const qKey = heightToQualityKey(targetFmt.height);
              ret = origSetQuality ? origSetQuality(qKey, qKey, String(targetFmt.itag)) : undefined;
            }
            try {
              p.dispatchEvent(new CustomEvent('onPlaybackQualityChange'));
            } catch (e) {}
            return ret;
          }
        }

        // Case 3: Automatic preference call from TizenTube (e.g. setPlaybackQualityRange("hd2160", "hd2160")
        // or setPlaybackQualityRange("highres", "highres") when preferred resolution is absent on video!)
        const pin = getPin(vid);
        if (pin && pin.manualVideo && pin.videoItag) {
          const pinnedFmt = cat.videos.find(v => Number(v.itag) === Number(pin.videoItag));
          if (pinnedFmt) {
            const stats = getActiveItagsFromStats(p);
            if (stats.videoItag && Number(stats.videoItag) === Number(pinnedFmt.itag)) {
              return undefined;
            }
            const qKey = heightToQualityKey(pinnedFmt.height);
            return origSetQuality ? origSetQuality(qKey, qKey, String(pinnedFmt.itag)) : undefined;
          }
        }

        // Resolve desired resolution safely (never pass "highres" 4320p on a 1080p/2160p video!)
        const requestedPref = (qStr === 'highres' && prefs.preferredVideoQuality && prefs.preferredVideoQuality !== 'auto')
          ? prefs.preferredVideoQuality
          : qStr;
        const bestFmt = selectBestVideoFormat(cat.videos, requestedPref, prefs.preferredVideoCodec);
        if (bestFmt) {
          setPin(vid, { videoItag: Number(bestFmt.itag), manualVideo: false });
          const stats = getActiveItagsFromStats(p);
          let ret;
          // Only call origSetQuality if the player isn't already decoding bestFmt.itag!
          if (!stats.videoItag || Number(stats.videoItag) !== Number(bestFmt.itag)) {
            const qKey = heightToQualityKey(bestFmt.height);
            ret = origSetQuality ? origSetQuality(qKey, qKey, String(bestFmt.itag)) : undefined;
          }
          try {
            p.dispatchEvent(new CustomEvent('onPlaybackQualityChange'));
          } catch (e) {}
          return ret;
        }
      }

      return origSetQuality ? origSetQuality(minQ, maxQ, formatId) : undefined;
    };

    p.setPlaybackQuality = function (q, formatId) {
      return p.setPlaybackQualityRange(q, q, formatId);
    };

    // B. Native "Faixa de áudio" Menu: List all surround (5.1 ec-3, ac-3), multi-language & DRC tracks!
    p.getAvailableAudioTracks = function () {
      const vid = getCurrentVideoId();
      const cat = (vid && catalog[vid]) || null;
      if (cat && cat.audios && cat.audios.length) {
        const activeAudio = getCurrentlyPlayingAudioTrack(vid, p);
        const seen = new Set();
        const uniqueAuds = [];
        for (const a of cat.audios) {
          const key = a.audioKey || getAudioKey(a);
          if (!seen.has(key)) {
            seen.add(key);
            uniqueAuds.push(a);
          }
        }
        return uniqueAuds.map(a => createAudioTrackObj(a, activeAudio));
      }
      return [];
    };

    p.getAudioTrack = function () {
      const vid = getCurrentVideoId();
      const cat = (vid && catalog[vid]) || null;
      if (cat && cat.audios && cat.audios.length) {
        const activeAudio = getCurrentlyPlayingAudioTrack(vid, p) || cat.audios[0];
        return createAudioTrackObj(activeAudio, activeAudio);
      }
      const defLang = { id: 'und', name: 'Default', isDefault: true, getName: () => 'Default', getId: () => 'und' };
      return { id: 'und', xb: defLang, getLanguageInfo: () => defLang, captionTracks: [] };
    };

    // When the user clicks an audio track in the native "Faixa de áudio" menu:
    p.setAudioTrack = function (track) {
      if (!track) return;
      const vid = getCurrentVideoId();
      const cat = (vid && catalog[vid]) || null;
      if (!vid || !cat || !cat.audios || !cat.audios.length) return;

      const rawId = String(
        track.audioKey ||
        track.id ||
        (track.xb && (track.xb.id || (typeof track.xb.getId === 'function' && track.xb.getId()))) ||
        ''
      );
      const trackName = (typeof track.getName === 'function' ? track.getName() : '') ||
                        (typeof track.getLanguageInfo === 'function' && track.getLanguageInfo() && track.getLanguageInfo().getName()) ||
                        (track.xb && typeof track.xb.getName === 'function' ? track.xb.getName() : '') ||
                        (track.xb && track.xb.name) || '';

      let chosen = cat.audios.find(a => (a.audioKey || getAudioKey(a)) === rawId);
      if (!chosen && trackName) {
        chosen = cat.audios.find(a => a.displayName === trackName);
      }
      if (!chosen) {
        const numItag = parseInt(rawId, 10);
        if (!isNaN(numItag)) {
          chosen = cat.audios.find(a => Number(a.itag) === numItag);
        }
      }

      if (chosen) {
        setPin(vid, {
          audioKey: chosen.audioKey || getAudioKey(chosen),
          audioItag: Number(chosen.itag)
        });
        reloadPlayerAtCurrentTime(vid);
        try {
          p.dispatchEvent(new CustomEvent('onPlaybackAudioChange'));
        } catch (e) {}
      }
    };

    // C. Accurate 5.1 Surround & IAMF capability reporting on player (C01)
    p.hasSupportedAudio51Tracks = function () {
      const vid = getCurrentVideoId();
      const cat = (vid && catalog[vid]) || null;
      if (cat && cat.audios) {
        return cat.audios.some(a => (a.audioChannels || 2) >= 6);
      }
      return false;
    };
    p.getUserAudio51Preference = function () {
      return 1;
    };
    p.isAudioIamf = function () {
      return checkNativeIamfSupport();
    };
  }

  // 14. Main-Thread Fluidity Optimization:
  // Cache Function.prototype.toString in a WeakMap and cap tizentube.js's `_r()` 250ms polling
  // over window._yttv so it never allocates 4 MB/sec of C++ function strings during video playback!
  try {
    if (typeof WeakMap === 'function' && Function.prototype && Function.prototype.toString) {
      const origFnToString = Function.prototype.toString;
      const fnStringCache = new WeakMap();
      Function.prototype.toString = function () {
        if (typeof this === 'function') {
          let cached = fnStringCache.get(this);
          if (cached !== undefined) return cached;
          cached = origFnToString.call(this);
          fnStringCache.set(this, cached);
          return cached;
        }
        return origFnToString.call(this);
      };
    }
    if (typeof window.setTimeout === 'function') {
      const origSetTimeout = window.setTimeout.bind(window);
      let rPollCountWithVideo = 0;
      window.setTimeout = function (fn, delay) {
        if (delay === 250 && typeof fn === 'function' && fn.name === '_r') {
          if (document.querySelector('video')) {
            rPollCountWithVideo++;
            if (rPollCountWithVideo > 6) {
              return 0;
            }
            return origSetTimeout(fn, 1000);
          }
        }
        return origSetTimeout.apply(this, arguments);
      };
    }
  } catch (e) {}

  window.__ttL1HookPlayerApi = hookPlayerApi;
  setInterval(hookPlayerApi, 500);
})();
)L1SCRIPT";

}  // namespace cobalt

#endif  // COBALT_RENDERER_L1_MEDIA_UI_SCRIPT_H_
