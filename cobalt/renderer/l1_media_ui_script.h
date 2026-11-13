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
// (SmartTube style: "2160p, 30fps, 82.49Mbps, av1"), and adds individual audio
// stream selection (Dolby Digital Plus ec-3, AC-3, Opus iamf 5.1) directly in the
// native YouTube TV "Áudio" menu without any floating overlays or test artifacts.
inline constexpr char kL1MediaUiScript[] = R"L1SCRIPT(
(function () {
  if (window.__ttL1Init) return;
  window.__ttL1Init = true;

  const CFG_KEY = 'ytaf-configuration';
  const SESSION_PIN_PREFIX = 'ttL1Pin_';
  const SESSION_RESUME_PREFIX = 'ttL1Resume_';
  const DEF = {
    preferredVideoCodec: 'any',
    l1VideoCodec: 'any',
    l1HdrMode: 'any',
    l1MaxFps: 0,
    preferredAudioCodec: 'any',
    preferredAudioChannels: 'auto',
    unlockAllMediaStreams: true,
    l1Force4kViewport: true
  };

  function readCfg() {
    try {
      return Object.assign({}, DEF, JSON.parse(localStorage.getItem(CFG_KEY) || '{}') || {});
    } catch (e) {
      return Object.assign({}, DEF);
    }
  }

  function cfg(k) {
    const o = readCfg();
    return o[k] !== undefined ? o[k] : DEF[k];
  }

  function setCfg(k, v) {
    try {
      const o = JSON.parse(localStorage.getItem(CFG_KEY) || '{}') || {};
      o[k] = v;
      localStorage.setItem(CFG_KEY, JSON.stringify(o));
      return true;
    } catch (e) {
      return false;
    }
  }

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

  // 3. MediaSource.isTypeSupported & mediaCapabilities.decodingInfo.
  try {
    if (window.MediaSource && window.MediaSource.isTypeSupported) {
      const origIsType = window.MediaSource.isTypeSupported.bind(window.MediaSource);
      window.MediaSource.isTypeSupported = function (typeStr) {
        if (!typeStr) return false;
        const lower = String(typeStr).toLowerCase();
        if (lower.includes('audio/')) {
          if (lower.includes('ec-3') || lower.includes('ac-3') || lower.includes('opus') || lower.includes('mp4a')) {
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

  try {
    if (navigator.mediaCapabilities && navigator.mediaCapabilities.decodingInfo) {
      const origDecInfo = navigator.mediaCapabilities.decodingInfo.bind(navigator.mediaCapabilities);
      navigator.mediaCapabilities.decodingInfo = async function (config) {
        const res = await origDecInfo(config);
        try {
          if (!config) return res;
          if (config.video && config.video.contentType) {
            const vl = String(config.video.contentType).toLowerCase();
            if (vl.includes('vp09') || vl.includes('vp9') || vl.includes('av01') || vl.includes('avc1')) {
              return { supported: true, smooth: true, powerEfficient: true, keySystemAccess: res ? res.keySystemAccess : undefined };
            }
          }
          if (config.audio && config.audio.contentType) {
            const al = String(config.audio.contentType).toLowerCase();
            if (al.includes('ec-3') || al.includes('ac-3') || al.includes('opus') || al.includes('mp4a')) {
              return { supported: true, smooth: true, powerEfficient: true, keySystemAccess: res ? res.keySystemAccess : undefined };
            }
          }
        } catch (e) {}
        return res;
      };
    }
  } catch (e) {}

  // 4. Raw stream catalog & pinning state.
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
        // SmartTube naming convention: "2160p, 30fps, 82.49Mbps, av1"
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

    // Prioritize pinned video format
    if (pin.videoItag) {
      const match = rawVids.filter(f => Number(f.itag) === Number(pin.videoItag));
      if (match.length) {
        vids = match.concat(rawVids.filter(f => Number(f.itag) !== Number(pin.videoItag)));
      }
    }

    // Prioritize 5.1 / pinned audio format
    if (pin.audioItag) {
      const match = rawAuds.filter(a => Number(a.itag) === Number(pin.audioItag));
      if (match.length) {
        auds = match.concat(rawAuds.filter(a => Number(a.itag) !== Number(pin.audioItag)));
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

  // 5. Hook native YouTube TV Player quality methods so the native menu lists all formats!
  function hookPlayerApi() {
    const p = document.getElementById('ytlr-player__player-container-player');
    if (!p || p.__ttL1PlayerHooked) return;
    p.__ttL1PlayerHooked = true;

    const origQDataMsg = p.getAvailableQualityDataAndMessaging;
    p.getAvailableQualityDataAndMessaging = function () {
      const vid = getCurrentVideoId();
      const cat = (vid && catalog[vid]) || null;
      if (cat && cat.videos && cat.videos.length) {
        const pin = getPin(vid);
        const qualityData = cat.videos.map(f => {
          return {
            qualityLabel: f.qualityLabel,
            quality: 'hd' + (f.height || 1080),
            isPlayable: true,
            formatItag: f.itag,
            isCurrent: pin.videoItag ? (Number(pin.videoItag) === Number(f.itag)) : undefined
          };
        });
        return { qualityData };
      }
      return origQDataMsg ? origQDataMsg.apply(this, arguments) : { qualityData: [] };
    };

    const origQData = p.getAvailableQualityData;
    p.getAvailableQualityData = function () {
      const res = p.getAvailableQualityDataAndMessaging();
      return (res && res.qualityData) || (origQData ? origQData.apply(this, arguments) : []);
    };

    const origQLabels = p.getAvailableQualityLabels;
    p.getAvailableQualityLabels = function () {
      const qd = p.getAvailableQualityData();
      if (qd && qd.length) return qd.map(q => q.qualityLabel);
      return origQLabels ? origQLabels.apply(this, arguments) : [];
    };

    // When the user selects a quality from the native Leanback quality menu:
    const origSetQuality = p.setPlaybackQualityRange;
    p.setPlaybackQualityRange = function (minQ, maxQ) {
      const vid = getCurrentVideoId();
      const cat = (vid && catalog[vid]) || null;
      if (cat && cat.videos && cat.videos.length) {
        // Find matching format if quality matches
        const qStr = String(maxQ || minQ || '');
        const match = cat.videos.find(v => v.qualityLabel === qStr || ('hd' + v.height) === qStr);
        if (match) {
          setPin(vid, { videoItag: match.itag });
        }
      }
      return origSetQuality ? origSetQuality.apply(this, arguments) : undefined;
    };
  }

  setInterval(hookPlayerApi, 1000);

  // 6. Seamless Native "Áudio" Dialog Integration:
  // Dynamically adds selectable audio streams (Dolby Digital Plus 5.1, AC-3 5.1, Opus 5.1, Stereo)
  // directly inside the native YouTube TV "Áudio" settings panel!
  function integrateAudioMenu() {
    const vid = getCurrentVideoId();
    const cat = (vid && catalog[vid]) || null;
    if (!cat || !cat.audios || !cat.audios.length) return;

    // Detect if the native Audio panel or list is currently visible
    const allHeaders = document.querySelectorAll('*');
    let audioPanelContainer = null;

    for (const el of allHeaders) {
      if (el.children.length === 0 && el.innerText && el.innerText.trim() === '\u00c1udio') {
        const parent = el.closest('[role="dialog"], .ytlr-dialog, .ytlr-panel, .ytlr-menu-renderer, .app-quality-root') || el.parentElement;
        if (parent) {
          audioPanelContainer = parent;
          break;
        }
      }
    }

    if (!audioPanelContainer) return;
    if (audioPanelContainer.querySelector('.tt-l1-audio-selector-section')) return;

    const pin = getPin(vid);
    const activeItag = pin.audioItag ? Number(pin.audioItag) : Number(cat.audios[0].itag);

    const section = document.createElement('div');
    section.className = 'tt-l1-audio-selector-section';
    section.style.cssText = 'display:flex; flex-direction:column; gap:8px; margin-top:16px; padding:0 8px; border-top:1px solid rgba(255,255,255,0.15); padding-top:16px;';

    const header = document.createElement('div');
    header.style.cssText = 'font-size:16px; font-weight:600; color:rgba(255,255,255,0.7); text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;';
    header.textContent = 'Faixas de \u00c1udio Dispon\u00edveis';
    section.appendChild(header);

    for (const a of cat.audios) {
      const isSelected = (Number(a.itag) === activeItag);
      const row = document.createElement('div');
      row.tabIndex = 0;
      row.className = 'tt-l1-audio-row';
      row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:12px 18px; border-radius:12px; background:' +
        (isSelected ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)') + '; color:#fff; font-size:18px; cursor:pointer; outline:none; transition:background 0.15s ease;';

      const label = document.createElement('span');
      label.textContent = a.displayName;
      row.appendChild(label);

      const check = document.createElement('span');
      check.textContent = isSelected ? '\u2713' : '';
      check.style.cssText = 'font-size:20px; font-weight:bold; color:#3ea6ff; margin-left:12px;';
      row.appendChild(check);

      row.addEventListener('focus', () => {
        row.style.background = 'rgba(255,255,255,0.35)';
      });
      row.addEventListener('blur', () => {
        row.style.background = isSelected ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)';
      });

      const selectTrack = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        setPin(vid, { audioItag: a.itag });
        reloadPlayerAtCurrentTime(vid);
      };

      row.addEventListener('click', selectTrack);
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.keyCode === 13) selectTrack(e);
      });

      section.appendChild(row);
    }

    // Append to list container in the dialog
    const listTarget = audioPanelContainer.querySelector('[role="menu"], [role="listbox"], .ytlr-list-view') || audioPanelContainer;
    listTarget.appendChild(section);
  }

  // MutationObserver to watch for menu dialogs opening
  const observer = new MutationObserver(() => {
    try {
      integrateAudioMenu();
    } catch (e) {}
  });

  if (document.documentElement) {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.documentElement, { childList: true, subtree: true });
    });
  }
})();
)L1SCRIPT";

}  // namespace cobalt

#endif  // COBALT_RENDERER_L1_MEDIA_UI_SCRIPT_H_
