# Cobalt 27 LTS upgrade assessment (2026-11-09)

Current fork source: `cobalt/version.h` declares `27.lts.10`.

Official next release: `27.lts.11`, tag `27.lts.11.1041346` (2026-10-23). This is a **non-stable development release**. The official release notes advise moving to stable `27.lts.20` when available, not treating .11 as certified stable.

Official sources:
- https://developers.google.com/youtube/cobalt/docs/releases/27.LTS.10
- https://developers.google.com/youtube/cobalt/docs/releases/27.LTS.11
- https://github.com/youtube/cobalt/releases

Potentially relevant upstream changes:
- Media initialization hang and decode-to-texture GL-context crash fixes.
- Buffering and MP4/WebM parsing improvements.
- AdaptiveAudioDecoder early configuration-change reinitialization.
- AV1 HDR minimum support checks for non-HDR 4K devices.
- AOSP compatibility fixes.

## Safe migration gates
1. Identify exact fork base commit and compare against official 27.lts.11 tag.
2. Cherry-pick targeted fixes on a separate branch, resolving conflicts explicitly; never replace the whole fork blindly.
3. Run Android build and smoke tests before merging.
4. On TCL C7K + LG S95TR validate 2160p30/60 VP9/AV1, HDR, AC-3/E-AC-3 discovery, 5.1 output, and fallback.
5. Keep the current stable baseline until testing proves an improvement.

Note: this document is an assessment, not an engine upgrade or playback fix.
