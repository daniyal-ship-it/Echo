"""Reproducible conversion of paired fsaverage5 pial/Desikan-Killiany assets.

No geometry is generated. Only a rigid axis transform, uniform scale and
translation are applied. Python standard library only. --verify checks both
source and generated hashes; --fetch downloads pinned, checksum-verified inputs.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/anatomy'
COMMIT = '634f676630929a71297852d01dd92a287103e861'
BASE = f'https://raw.githubusercontent.com/ThomasYeoLab/CBIG/{COMMIT}/stable_projects/brain_parcellation/Schaefer2018_LocalGlobal/Parcellations/FreeSurfer5.3/fsaverage5'
HASHES = {
    'lh.pial': 'd3e772b74f39ed7a979d78dab5b98d1fe5916f1354b52d05c23b85a8080b72bd',
    'rh.pial': '64440462e8d1cec650d100c0fb16cb4704937e19e0bc42f58997a6a09e5e536b',
    'lh.annot': '74d1c2fd5e6b7ca193f06fee45a86f5638f347e38cea5ba27fce9fd69c0056be',
    'rh.annot': 'ca86b3b0bd5b74e367519dd94157154ae7c61ad128680fcc7b52e1a799e34e9f',
}
LOBE_NAMES = ['Other cortex', 'Frontal', 'Parietal', 'Temporal', 'Occipital']
LOBE_PARCELS = {
    1: 'caudalmiddlefrontal lateralorbitofrontal medialorbitofrontal parsopercularis parsorbitalis parstriangularis precentral rostralmiddlefrontal superiorfrontal frontalpole'.split(),
    2: 'inferiorparietal paracentral postcentral precuneus superiorparietal supramarginal'.split(),
    3: 'bankssts entorhinal fusiform inferiortemporal middletemporal parahippocampal superiortemporal temporalpole transversetemporal'.split(),
    4: 'cuneus lateraloccipital lingual pericalcarine'.split(),
}

def surface(path):
    with path.open('rb') as f:
        assert f.read(3) == bytes([255, 255, 254]), 'Expected triangle surface'
        f.readline()
        f.readline()
        nv, nf = struct.unpack('>ii', f.read(8))
        coords = list(struct.iter_unpack('>fff', f.read(nv * 12)))
        faces = [x[0] for x in struct.iter_unpack('>i', f.read(nf * 12))]
        assert nv == 10242 and nf == 20480
        assert max(faces) < nv and min(faces) >= 0
        return coords, faces

def annotation(path):
    with path.open('rb') as f:
        def integer(): return struct.unpack('>i', f.read(4))[0]
        def string(): return f.read(integer()).rstrip(b'\0').decode()
        count = integer()
        labels = dict(struct.iter_unpack('>ii', f.read(count * 8)))
        assert integer() == 1 and integer() == -2
        integer()
        string()
        colors = {}
        parcels = {}
        for _ in range(integer()):
            index, name = integer(), string()
            r, g, b, _ = [integer() for _ in range(4)]
            colors[r + (g << 8) + (b << 16)] = (index, name)
            parcels[index] = name
        region, parcel = [], []
        for i in range(count):
            idx, name = colors.get(labels[i], (0, 'unknown'))
            parcel.append(idx)
            region.append(next((lobe for lobe, names in LOBE_PARCELS.items() if name in names), 0))
        return region, parcel, parcels

def digest(data): return hashlib.sha256(data).hexdigest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--verify', action='store_true')
    parser.add_argument('--fetch', action='store_true')
    args = parser.parse_args()
    for name, sha in HASHES.items():
        path = OUT / 'source' / f'echo-{name}'
        if args.fetch:
            folder = 'surf' if name.endswith('pial') else 'label'
            data = urllib.request.urlopen(f'{BASE}/{folder}/{name}', timeout=30).read()
            assert digest(data) == sha, f'Upstream checksum mismatch: {name}'
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        assert digest(path.read_bytes()) == sha, f'Source checksum mismatch: {name}'
    positions, indices, regions, parcels = [], [], [], []
    for side in ['lh', 'rh']:
        coords, faces = surface(OUT / 'source' / f'echo-{side}.pial')
        lobes, labels, label_names = annotation(OUT / 'source' / f'echo-{side}.annot')
        offset = len(positions)
        positions.extend(coords)
        indices.extend(i + offset for i in faces)
        regions.extend(lobes)
        parcels.extend(labels)
    center = [(min(p[d] for p in positions) + max(p[d] for p in positions)) / 2 for d in range(3)]
    transformed = [((x - center[0]) / 60, (z - center[2]) / 60, -(y - center[1]) / 60) for x, y, z in positions]
    flat = [v for p in transformed for v in p]
    assert all(math.isfinite(v) for v in flat)
    data = struct.pack('<IIII', 1, len(positions), len(indices), 10242)
    data += struct.pack(f'<{len(flat)}f', *flat)
    data += struct.pack(f'<{len(indices)}I', *indices)
    data += bytes(regions) + bytes(parcels)
    metadata = {
        'version': 1, 'name': 'FreeSurfer fsaverage5', 'atlas': 'Desikan–Killiany (aparc)',
        'sourceCommit': COMMIT, 'sourceBase': BASE, 'sourceSha256': HASHES,
        'sha256': digest(data), 'vertices': len(positions), 'triangles': len(indices) // 3,
        'hemisphereVertices': 10242, 'lobes': LOBE_NAMES, 'parcels': label_names,
        'lobeParcels': LOBE_PARCELS,
        'regionCounts': {name: regions.count(i) for i, name in enumerate(LOBE_NAMES)},
        'transform': {'source': 'FreeSurfer surface RAS, mm', 'center': center, 'scale': 1 / 60, 'axes': '[x, z, -y]'},
        'limitations': ['Group-average cortical surfaces; not an individual brain or clinical tool.', 'No cerebellum or brainstem.', 'Cingulate, insula and medial-wall regions stay neutral.', 'Paracentral parcel assigned to parietal; coarse anatomical grouping, not a clinical lobar atlas.', 'Knowledge categories are a software metaphor, not a biological memory-localisation claim.'],
        'licenses': ['/licenses/FREESURFER.txt', '/licenses/CBIG.txt'],
        'modified': 'Binary format conversion, rigid coordinate transform and uniform scale only; original vertex order and topology preserved.'
    }
    if args.verify:
        assert (OUT / 'brain.bin').read_bytes() == data, 'Derived geometry differs from sources'
        assert json.loads((OUT / 'manifest.json').read_text())['sha256'] == digest(data)
    else:
        (OUT / 'brain.bin').write_bytes(data)
        (OUT / 'manifest.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print(f'PASS: {len(positions):,} anatomical vertices, {len(indices)//3:,} triangles; both hemispheres and all source checksums verified.')
    print(metadata['regionCounts'])

if __name__ == '__main__': main()
