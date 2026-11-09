# L1 playback architecture audit

Verified source version: `cobalt/version.h` declares `COBALT_VERSION "27.lts.10"` (Cobalt 27 LTS).

## Playback stack
YouTube TV web application -> Cobalt HTML5 media pipeline -> Android MediaCodec (video decoder) / AudioTrack (audio output) -> TCL C7K display and LG S95TR via eARC.

Relevant sources:
- `cobalt/android/apk/app/src/main/java/dev/cobalt/media/MediaCodecUtil.java`: Android decoder enumeration and profile/capability checks.
- `cobalt/android/apk/app/src/main/java/dev/cobalt/media/MediaCodecBridge.java`: codec initialization and decoding bridge.
- `cobalt/android/apk/app/src/main/java/dev/cobalt/media/AudioTrackBridge.java`: audio output bridge.

## Working hypotheses (not yet validated)
- 4K/AV1/VP9 may be excluded by Android codec capability reporting or Cobalt's video support checks.
- Surround audio may be unavailable from the selected YouTube TV stream, omitted from capability reporting, or blocked by the audio output route.
- Passthrough is not guaranteed by the presence of AC-3/E-AC-3 decoder support.

## Investigation order
1. Trace Cobalt's codec capability report back to Android MediaCodecUtil.
2. Add opt-in diagnostics for actual codec names, profiles, sizes, frame rates, HDR and audio output encodings.
3. Compare SmartTube-L1's device compatibility decisions; adapt behavior, not ExoPlayer code.
4. Introduce audio preferences only once track discovery and device output capabilities are understood.
5. Validate playback on TCL C7K + LG S95TR before shipping an APK.

No playback fixes are claimed by this audit.
