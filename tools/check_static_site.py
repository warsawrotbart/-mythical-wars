#!/usr/bin/env python3
"""Static GitHub Pages release verification (no server/API calls)."""
from __future__ import annotations
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit
import argparse, re, json, hashlib, sys

ROOT=Path(__file__).resolve().parents[1]
EXPECTED_MANIFEST_SHA='190371ce21046ba4530b9cb93b374292645218f4fcbe0a0f7e5ff0e529f5529f'

class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs=[]
    def handle_starttag(self,tag,attrs):
        p=dict(attrs)
        if tag=='script': attr='src'
        elif tag in ('link','a','img'): attr='href' if tag in ('link','a') else 'src'
        else:return
        if attr in p: self.refs.append(p[attr])

def check(root):
    errors=[]; checked=0
    for name in ('index.html','v05-dynamic.html')+(() if root.name=='_site' else ('v05-studio.html',)):
        f=root/name
        if not f.is_file():errors.append('Missing entrypoint: '+name);continue
        p=Assets();p.feed(f.read_text(encoding='utf8'))
        for raw in p.refs:
            raw=raw.strip()
            if not raw or raw.startswith(('#','//','mailto:','javascript:','data:')):continue
            u=urlsplit(raw)
            if u.scheme or u.netloc:continue
            path=unquote(u.path)
            if not path:continue
            if path.startswith('/'):
                errors.append(f'Root-absolute URL breaks project Pages: {name}: {raw}');continue
            dst=(f.parent/path).resolve()
            if not dst.is_relative_to(root.resolve()) or not dst.is_file():
                errors.append(f'Broken HTML dependency: {name}: {raw}')
            checked+=1
    for css in root.glob('*.css'):
        for raw in re.findall(r'url\(\s*[\"\']?([^\"\')]+)',css.read_text(encoding='utf8',errors='replace')):
            if raw.startswith(('data:','http:','https:','#')): continue
            u=urlsplit(raw); path=unquote(u.path)
            if not path:continue
            if path.startswith('/'):
                errors.append(f'Root-absolute CSS URL {css.name}: {raw}');continue
            if not (css.parent/path).resolve().is_file():
                errors.append(f'Broken CSS dependency {css.name}: {raw}')
            checked+=1
    manifest_path=root/'v05'/'production'/'editor_manifest.json'
    if not manifest_path.is_file():
        errors.append('Missing original v05 manifest')
    else:
        h=hashlib.sha256(manifest_path.read_bytes()).hexdigest()
        if h!=EXPECTED_MANIFEST_SHA:
            errors.append('Original v05 manifest modified: '+h)
        else:
            doc=json.loads(manifest_path.read_text(encoding='utf8'))
            for key,record in doc.get('assets',{}).items():
                path=(root/'v05'/record['path']).resolve()
                if not path.is_relative_to((root/'v05').resolve()) or not path.is_file():
                    errors.append(f'Missing manifest asset: {key}')
                elif hashlib.sha256(path.read_bytes()).hexdigest()!=record['sha256']:
                    errors.append(f'Incorrect manifest asset: {key}')
                checked+=1
            for kind, template in doc.get('templates',{}).items():
                m=template.get('art_mask')
                if not m:
                    continue
                mask=(root/'v05'/'runtime'/(m+'_alpha.png')).resolve()
                if not mask.is_relative_to((root/'v05'/'runtime').resolve()) or not mask.is_file():
                    errors.append(f'Missing runtime art mask: {kind}: {m}')
                checked+=1
    # v05.7: independent default test-art library, never silently fabricate missing art.
    index=(root/'index.html').read_text(encoding='utf8') if (root/'index.html').exists() else ''
    if 'href="v05-dynamic.html"' not in index or 'data-app-mode="editor"' in index:
        errors.append('Single v05 editor navigation not enforced')
    catalog_path=root/'test-art'/'test_art_inventory.json'
    if not catalog_path.is_file():
        errors.append('Missing test art inventory')
    else:
        inv=json.loads(catalog_path.read_text(encoding='utf8'))
        items=inv.get('items',{});missing=inv.get('missing',[]);counts=inv.get('counts',{})
        if len(items)!=99 or len(missing)!=70 or counts.get('allLibrary')!=169:
            errors.append('Incorrect test art coverage; expected 99 of 169 and 70 missing')
        if set(items).intersection(missing) or len(set(missing))!=70:
            errors.append('Test-art ID collision or duplicate missing ID')
        for id,record in items.items():
            name=f'test-art/{id}.webp'
            p=(root/name)
            if not re.fullmatch('[A-Z]{3}-[0-9]{3}',id): errors.append('Invalid test-art ID: '+id)
            if record.get('file')!=name or record.get('status')!='test':
                errors.append('Incorrect test-art metadata: '+id)
            if not p.is_file():
                errors.append('Missing test art: '+id)
            elif hashlib.sha256(p.read_bytes()).hexdigest()!=record.get('sha256'):
                errors.append('Test art SHA-256 mismatch: '+id)
            for alt in record.get('alternates',[]):
                alt_name=alt.get('file','')
                alt_path=(root/alt_name).resolve()
                if not alt_path.is_relative_to((root/'test-art').resolve()) or not alt_path.is_file():
                    errors.append(f'Missing prior art variant: {id}: {alt_name}')
                elif hashlib.sha256(alt_path.read_bytes()).hexdigest()!=alt.get('sha256'):
                    errors.append(f'Prior art variant hash mismatch: {id}: {alt_name}')
                checked+=1
            checked+=1
        for id in ('KNZ-019','KNZ-006','KNZ-014'):
            if items.get(id,{}).get('default')!=f'v05/{id}/{id}_art_source.png':
                errors.append('Control-card v05 original source not kept: '+id)
    if root.name=='_site' and (root/'v05-studio.html').exists():
        errors.append('Development-only template studio exposed in deployment')
    for path in root.rglob('*'):
        if not path.is_file() or '_site' in path.parts:continue
        # Ignore checkout metadata in the source tree; deploy artifacts still reject it.
        if root.name!='_site' and path.relative_to(root).parts[0]=='.git':continue
        if any(part in ('server','reference_docs','node_modules','.git') for part in path.relative_to(root).parts):
            errors.append(f'Non-static/private directory: {path.relative_to(root)}')
        if re.search(r'(service.?account|credentials|secret|private.?key)',path.name,re.I) and path.suffix=='.json':
            errors.append(f'Potential secret: {path.relative_to(root)}')
        if path.stat().st_size>25*1024*1024:
            errors.append(f'Exceeds GitHub web-upload 25 MiB: {path.relative_to(root)}')
    if errors:
        print('FAIL: '+str(len(errors))+' problem(s)')
        print('\n'.join('  '+x for x in errors[:60]))
        return 1
    print(f'PASS: {checked} HTML/CSS/manifest dependency checks; manifest preserved; no server/credentials; GitHub upload sizes OK')
    return 0

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--root',type=Path,default=ROOT)
    sys.exit(check(p.parse_args().root.resolve()))
