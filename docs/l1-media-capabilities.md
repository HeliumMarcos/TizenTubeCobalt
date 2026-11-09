# L1 media capabilities — implementation plan

Target: TCL C7K (Google TV) + LG S95TR (HDMI eARC).

## Defaults
- Audio codec: automatic
- Audio channels: maximum supported
- Fallback: enabled
- Passthrough: preferred when supported

## Baseline audit
- `cobalt/android/apk/app/src/main/java/dev/cobalt/media/MediaCodecBridge.java`: Android MediaCodec video decoding bridge.
- `cobalt/android/apk/app/src/main/java/dev/cobalt/media/AudioTrackBridge.java`: Android AudioTrack output bridge.
- Compare behavior with `HeliumMarcos/SmartTube-L1`, without assuming its player code is compatible with Cobalt.

## Implementation checkpoints
1. Trace format enumeration from the YouTube manifest through Cobalt capabilities and the Android decoder bridge.
2. Log video codec, profile, width, height, frame rate, HDR and rejection reasons; never claim unsupported formats are playable.
3. Inspect actual available audio tracks and output-device capabilities (including HDMI eARC).
4. Add persistent audio codec/channel preferences to the appropriate settings layer; choose best supported track with fallback.
5. Implement passthrough only when both the encoded stream and Android output path support it.
6. Add automated tests for preference ordering, fallback, capability filtering, and 4K visibility.
7. Verify on TCL C7K + LG S95TR; publish APK only after build and playback checks.

## Upstream maintenance
Keep changes in focused feature branches and PRs. Periodically compare `reisxd/TizenTubeCobalt:main` against this fork and merge tested upstream changes. Resolve conflicts manually instead of overwriting local changes.
