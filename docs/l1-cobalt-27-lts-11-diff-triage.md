# Cobalt 27.lts.10 → 27.lts.11 official diff triage

Official comparison: https://github.com/youtube/cobalt/compare/27.lts.10...27.lts.11

GitHub compare reports **166 commits**. The connector returned 300 changed files, which may be capped by the API. Do not treat this as the complete file count.

## Relevant paths present in the official diff
- `cobalt/android/apk/app/src/main/java/dev/cobalt/media/MediaCodecUtil.java`
- `cobalt/android/apk/app/src/main/java/dev/cobalt/media/MediaCodecBridge.java`
- `cobalt/android/apk/app/src/main/java/dev/cobalt/media/MediaCodecBridgeBuilder.java`
- `cobalt/android/apk/app/src/main/java/dev/cobalt/media/AudioOutputManager.java`
- `cobalt/android/apk/app/src/main/java/dev/cobalt/media/ExoPlayerBridge.java`
- `cobalt/android/apk/app/src/main/java/dev/cobalt/media/ExoPlayerManager.java`
- `cobalt/android/apk/app/src/main/java/dev/cobalt/media/ExoPlayerMediaPeriod.java`
- `cobalt/android/apk/app/src/main/java/dev/cobalt/media/ExoPlayerMediaSource.java`
- `cobalt/android/apk/app/src/main/java/dev/cobalt/media/ExoPlayerSampleStream.java`

## Important compatibility finding
The official 27.lts.11 diff introduces or modifies **ExoPlayer-related Android bridge files** that are not present at the corresponding paths in our fork's current branch. Therefore, our previous characterization of Cobalt as exclusively using MediaCodec/AudioTrack is incomplete for this prospective upgrade. Investigate the official bridge's integration and feature flags before choosing the actual playback path.

## Migration procedure
1. Run the read-only workflow `l1-cobalt-27-lts-11-audit.yml` from the upgrade PR after making it runnable.
2. Inspect exact file changes, dependencies and feature flags.
3. Port the required engine changes together (not just the version macro).
4. Build and test the Android app before declaring the upgrade complete.
5. Keep a rollback branch and do not merge until video and audio regression tests pass.

Status after 2026-11-09: **source snapshot integrated** at commit `4f973b2c226a8f8f2556bb3ee49099cfe43cf690` from official tag `27.lts.11` (commit `4aa03b3d7678dbce63da14b5e5459defd5ea6abf`). The three reviewed conflicts were resolved while preserving fork customizations. This is a **single-parent source-tree integration**, not an import of 166 individual upstream commits. Fork `.github/workflows` was deliberately retained because GitHub Actions' token could not update workflow files. The native/Java APK **has not been compiled** and the migration remains unvalidated at runtime.
