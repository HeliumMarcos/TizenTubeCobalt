#!/usr/bin/env python3
"""Resolve the three reviewed Cobalt 27.lts.11 merge collisions.

Fails closed if conflict structure or semantics change. The calling workflow
must independently verify the exact set of conflicted paths from merge-tree.
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

BASE = "cobalt/android/apk/app/src/main/java/dev/cobalt/coat/BaseStarboardBridge.java"
MEDIA = "cobalt/android/apk/app/src/main/java/dev/cobalt/media/MediaCodecUtil.java"
NATIVE = "starboard/android/shared/base_starboard_bridge.cc"
EXPECTED = (BASE, MEDIA, NATIVE)


def is_import_block(part: str) -> bool:
    return all(
        not line.strip()
        or (line.strip().startswith("import ") and line.strip().endswith(";"))
        for line in part.splitlines()
    )


def union_imports(ours: str, upstream: str) -> str:
    lines = []
    seen = set()
    for line in (ours + upstream).splitlines():
        line = line.strip()
        if line and line not in seen:
            lines.append(line)
            seen.add(line)
    return "".join(line + "\n" for line in lines)


def resolve_piece(path: str, ours: str, upstream: str) -> str:
    if path in (BASE, MEDIA) and is_import_block(ours) and is_import_block(upstream):
        return union_imports(ours, upstream)
    if path == MEDIA and "getHdrStaticInfo(" in ours and "getHdrStaticInfo(" in upstream:
        normalize = lambda s: re.sub(r"\s+", "", s)
        if normalize(ours) != normalize(upstream):
            raise ValueError("The HDR serializers differ; review manually.")
        return ours
    if path == NATIVE:
        if ours.rstrip().endswith("}") or upstream.rstrip().endswith("}"):
            raise ValueError("Native conflict shape changed; review manually.")
        if "InstallAppFromURL(" in ours and "OnPrimaryMainFrameNavigationStarted(" in upstream:
            return ours.rstrip("\n") + "\n}\n\n" + upstream.lstrip("\n")
        if "OnPrimaryMainFrameNavigationStarted(" in ours and "InstallAppFromURL(" in upstream:
            return upstream.rstrip("\n") + "\n}\n\n" + ours.lstrip("\n")
    raise ValueError(f"Unreviewed merge conflict in {path}")


def resolve_text(path: str, text: str) -> tuple[str, int]:
    lines = text.splitlines(keepends=True)
    output = []
    i = 0
    count = 0
    while i < len(lines):
        if not lines[i].startswith("<<<<<<< "):
            output.append(lines[i])
            i += 1
            continue
        i += 1
        ours = []
        while i < len(lines) and not lines[i].startswith(("=======", "||||||| ")):
            ours.append(lines[i])
            i += 1
        if i < len(lines) and lines[i].startswith("||||||| "):
            while i < len(lines) and not lines[i].startswith("======="):
                i += 1
        if i >= len(lines) or lines[i].strip() != "=======":
            raise ValueError(f"Missing merge separator in {path}")
        i += 1
        upstream = []
        while i < len(lines) and not lines[i].startswith(">>>>>>> "):
            upstream.append(lines[i])
            i += 1
        if i >= len(lines):
            raise ValueError(f"Missing end-of-conflict marker in {path}")
        i += 1
        output.append(resolve_piece(path, "".join(ours), "".join(upstream)))
        count += 1

    if not count:
        raise ValueError(f"Expected conflict markers in {path}, found none.")
    result = "".join(output)
    if re.search(r"^(<<<<<<< |=======\s*$|>>>>>>> )", result, re.M):
        raise ValueError(f"Unresolved conflict marker in {path}")
    return result, count


def dedupe_imports(text: str) -> str:
    seen = set()
    result = []
    for line in text.splitlines(keepends=True):
        trimmed = line.strip()
        if trimmed.startswith("import ") and trimmed.endswith(";"):
            if trimmed in seen:
                continue
            seen.add(trimmed)
        result.append(line)
    return "".join(result)


def validate(result: dict[str, str]) -> None:
    base, media, native = (result[path] for path in EXPECTED)
    for name in (
        "import android.app.AlertDialog;",
        "import android.os.Handler;",
        "import android.os.Looper;",
        "import dev.cobalt.media.ExoPlayerManager;",
    ):
        if name not in base:
            raise ValueError(f"Missing import: {name}")
    if "L1 video support:" not in media or "L1 audio decode support:" not in media:
        raise ValueError("Fork L1 media diagnostics were lost.")
    if media.count("public static ByteBuffer getHdrStaticInfo(") != 1:
        raise ValueError("HDR static-info serializer missing or duplicated.")
    for name in ("InstallAppFromURL(", "OnPrimaryMainFrameNavigationStarted("):
        if native.count("StarboardBridge::" + name) != 1:
            raise ValueError(f"Missing or duplicated C++ bridge method: {name}")


def self_test() -> None:
    java = (
        "before\n<<<<<<< HEAD\nimport one.A;\n=======\nimport two.B;\n"
        ">>>>>>> upstream\nafter\n"
    )
    resolved, count = resolve_text(BASE, java)
    assert count == 1 and "import one.A;" in resolved and "import two.B;" in resolved
    native = (
        "<<<<<<< HEAD\nbool StarboardBridge::InstallAppFromURL() {\n"
        "=======\nvoid StarboardBridge::OnPrimaryMainFrameNavigationStarted() {\n"
        ">>>>>>> upstream\n}\n"
    )
    resolved, count = resolve_text(NATIVE, native)
    assert count == 1
    assert "InstallAppFromURL" in resolved and "OnPrimaryMainFrameNavigationStarted" in resolved
    assert dedupe_imports("import foo;\nimport foo;\n") == "import foo;\n"
    print("Cobalt conflict resolver self-test passed.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    result = {}
    for path in EXPECTED:
        source = args.root / path
        clean, num = resolve_text(path, source.read_text(encoding="utf-8"))
        result[path] = dedupe_imports(clean)
        print(f"Resolved {num} conflict blocks in {path}")
    validate(result)
    for path, text in result.items():
        (args.root / path).write_text(text, encoding="utf-8", newline="")
    print("Reviewed Cobalt merge resolutions saved.")


if __name__ == "__main__":
    main()
