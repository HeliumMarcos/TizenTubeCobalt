# Media3 ExoPlayer findings in official Cobalt 27.lts.11

Official files (tag 27.lts.11):
- https://github.com/youtube/cobalt/blob/27.lts.11/cobalt/android/apk/app/src/main/java/dev/cobalt/media/ExoPlayerBridge.java
- https://github.com/youtube/cobalt/blob/27.lts.11/cobalt/android/apk/app/src/main/java/dev/cobalt/media/ExoPlayerManager.java

Verified in source:
- `ExoPlayerBridge` integrates AndroidX Media3 ExoPlayer with native Starboard through JNI, and manages audio/video track selection and playback.
- `ExoPlayerManager` constructs Media3 formats and configures decoder selection.
- The manager recognizes `MimeTypes.AUDIO_AC3`, `AUDIO_E_AC3`, and `AUDIO_E_AC3_JOC` for passthrough.
- Its codec selector returns an empty decoder list for those Dolby audio MIME types, explicitly favoring passthrough; video decoders are filtered to hardware-accelerated ones, with a software fallback if no hardware decoder is found.
- These Java files were absent in the fork's original 27.lts.10 tree, but were imported with the official 27.lts.11 source snapshot (commit `4f973b2`). Their AndroidX Media3 build dependencies, C++ bridge and JNI source are present; actual build/runtime integration is not yet verified.

## Risks / requirements
1. Verify the native Starboard bridge selects the ExoPlayer path, and identify its build/runtime feature flags.
2. Check Android AudioManager/AudioDeviceInfo output encoding support on the active HDMI/eARC route before requesting passthrough. The presence of an AC-3 or E-AC-3 MIME type alone does not guarantee playback.
3. Define a safe fallback path (PCM or supported stereo format) when encoded passthrough is unavailable.
4. Verify manifest audio tracks actually offered by the YouTube TV client; hardware capabilities do not create streams.
5. Check Media3 dependency versions and Gradle build configuration before porting the Java files.
6. Build and test 2160p, HDR, 5.1 and audio-track switching on TCL C7K + LG S95TR.

Status (2026-11-09): official 27.lts.11 **source integrated**; `COBALT_VERSION` now declares `27.lts.11`. **No Java/native build, APK, codec negotiation or passthrough runtime test completed** on the new source.
