#!/usr/bin/env python3
"""Assemble the static runtime for GitHub Pages without private files."""
from __future__ import annotations
from pathlib import Path
import shutil, argparse

ROOT=Path(__file__).resolve().parents[1]
RUNTIME_DIRS=('assets','v05','arena-art','figma-assets','references','examples','test-art')
EXTRA_FILES=('DECKS_STARTER_FROM_LIBRARY.json','EDITOR_BASES_MANIFEST_v2.1F.json',
             'HERO_ART_MANIFEST_v2.1K.json','WARLOCK_ART_MANIFEST_v2.1I.json',
             'KNZ-002_initial_project.mwcard.json')

def build(dest: Path):
    if dest.resolve()==ROOT.resolve():
        raise ValueError('Site directory must not equal repository root')
    if not dest.resolve().is_relative_to(ROOT.resolve()):
        raise ValueError('Build target must be inside the repository')
    if dest.exists(): shutil.rmtree(dest)
    dest.mkdir(parents=True)
    for ext in ('.html','.js','.css'):
        for src in ROOT.glob('*'+ext):
            if src.name in ('probe.html','v05-studio.html'): continue  # Studio is a development-only QA view
            shutil.copy2(src,dest/src.name)
    for name in EXTRA_FILES:
        shutil.copy2(ROOT/name,dest/name)
    for name in RUNTIME_DIRS:
        shutil.copytree(ROOT/name,dest/name)
    (dest/'.nojekyll').write_text('',encoding='utf-8')
    print('Pages:',dest,'files',sum(1 for _ in dest.rglob('*') if _.is_file()))

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--output',type=Path,default=ROOT/'_site')
    args=p.parse_args()
    build(args.output)
