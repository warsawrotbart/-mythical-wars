#!/usr/bin/env python3
"""Unpack the approved battlefield-v02 source artwork without network dependencies.

The source pack contains raw DEFLATE members copied without alteration from
MW_Battlefield_TZ_Package_v02.zip.  Members and CRC-32 are verified on every
build.  No art is re-rendered or recompressed.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path, PurePosixPath
import zlib

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "battlefield-v02"

def unpack(source: Path = SOURCE, dest: Path | None = None) -> int:
    source = Path(source)
    if dest is None:
        dest = ROOT / "_site" / "battlefield-v02"
    dest = Path(dest)
    manifest = json.loads((source / "asset_manifest.json").read_text(encoding="utf-8"))
    if manifest.get("version") != "v02" or len(manifest.get("entries", [])) != 41:
        raise ValueError("Battlefield-v02 source manifest is missing or inconsistent")
    parts = []
    for entry in manifest["chunks"]:
        path = PurePosixPath(entry["path"])
        if path.is_absolute() or ".." in path.parts:
            raise ValueError("Unsafe chunk path")
        data = (source / Path(*path.parts)).read_bytes()
        if len(data) != entry["size"]:
            raise ValueError(f"Damaged chunk: {path}")
        parts.append(data)
    compressed = b"".join(parts)
    if len(compressed) != manifest["compressed_total"]:
        raise ValueError("Compressed battlefield size mismatch")
    root = dest.resolve()
    total = 0
    for asset in manifest["entries"]:
        rel = PurePosixPath(asset["path"])
        if rel.is_absolute() or ".." in rel.parts or not rel.parts:
            raise ValueError("Unsafe battlefield asset path")
        if asset["method"] != 8:
            raise ValueError("Only original DEFLATE members are supported")
        start = asset["offset"]
        stop = start + asset["compressed"]
        if not (0 <= start < stop <= len(compressed)):
            raise ValueError(f"Invalid compressed offsets for {rel}")
        art = zlib.decompress(compressed[start:stop], -zlib.MAX_WBITS)
        if len(art) != asset["uncompressed"] or zlib.crc32(art) & 0xFFFFFFFF != asset["crc32"]:
            raise ValueError(f"Battlefield source checksum failed: {rel}")
        target = (root / Path(*rel.parts)).resolve()
        if not target.is_relative_to(root):
            raise ValueError("Battlefield extraction escaped target directory")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(art)
        total += 1
    return total

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--source", type=Path, default=SOURCE)
    p.add_argument("--dest", type=Path, default=ROOT / "_site" / "battlefield-v02")
    args = p.parse_args()
    print("Extracted battlefield-v02 assets:", unpack(args.source, args.dest))
