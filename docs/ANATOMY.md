# Anatomical provenance

## Selected source

The application uses the **FreeSurfer fsaverage5** pial cortical surfaces and
the paired **Desikan–Killiany `aparc`** annotation files. The selected files are
distributed by the Computational Brain Imaging Group (CBIG), pinned to commit
`634f676630929a71297852d01dd92a287103e861`:

`stable_projects/brain_parcellation/Schaefer2018_LocalGlobal/Parcellations/FreeSurfer5.3/fsaverage5/`

- `surf/lh.pial`, `surf/rh.pial`
- `label/lh.aparc.annot`, `label/rh.aparc.annot`

These are atlas anatomical annotations packaged beside the Schaefer atlas, not
Schaefer functional-network labels. Matching geometry and annotation vertex
ordering is maintained by using the paired fsaverage5 subject files.

[Pinned upstream source](https://github.com/ThomasYeoLab/CBIG/tree/634f676630929a71297852d01dd92a287103e861/stable_projects/brain_parcellation/Schaefer2018_LocalGlobal/Parcellations/FreeSurfer5.3/fsaverage5)

Nilearn's fsaverage dataset was also evaluated. Its documentation identifies
fsaverage as FreeSurfer's standard surface and fsaverage5 as 10,242 vertices per
hemisphere. CBIG was selected because it provides paired anatomical annotation
files as well as pial geometry from a single pinned source. No procedural surface,
text-to-3D output or generated artwork is used as primary anatomy.

Reference: [Nilearn fsaverage](https://nilearn.github.io/stable/modules/description/fsaverage.html).
The original fsaverage surface work is Fischl et al. (1999); anatomical parcels
are described by Desikan et al. (2006), _An automated labeling system for
subdividing the human cerebral cortex on MRI scans into gyral based regions of
interest_, NeuroImage 31(3), 968–980, DOI `10.1016/j.neuroimage.2006.01.021`.

## Geometry and transformation

- 10,242 vertices and 20,480 triangles per hemisphere.
- 20,484 vertices and 40,960 triangles combined.
- Source surface RAS coordinates, in millimetres.
- A common bounding-box centre is subtracted; coordinates transform as
  `(x, z, -y) / 60` into the renderer's right/up/back coordinate convention.
- Original vertex order and triangle topology are preserved. No extra smoothing,
  procedural folds, artificial fissures or hemisphere separation is applied.
- The sampling layer uses original surface vertices; it is noninteractive.
- Actual memories use distinct instanced glyphs at persisted surface anchors.
  Additional occupied layers are modestly offset; these are software placements.

The converter and verifier are [scripts/anatomy.py](../scripts/anatomy.py).
Original files, SHA-256 fingerprints, parcel mappings, the rigid transform and
derived output hash are retained in [manifest.json](../public/anatomy/manifest.json).
`python3 scripts/anatomy.py --verify` recomputes the derived binary and checks
every original input checksum. `--fetch` redownloads pinned inputs through
verified HTTPS and requires the existing expected checksums to match.

## Four-lobe grouping

Frontal, parietal, temporal and occipital colours are assigned from named
Desikan–Killiany parcels, not broad coordinate cuts. The full mapping is in the
manifest and conversion script. The insula, cingulate parcels, unknown areas
and medial wall remain neutral. The coarse paracentral parcel spans a lobar
boundary and is assigned to parietal; this simplification is disclosed in the UI.

Knowledge categorisation remains independent of anatomy. A planning note placed
in the blue frontal region is a product metaphor, not a claim that human memories
are localised by these software categories.

## Licence

All or portions of this licensed product (such portions are the "Software") have
been obtained under license from The General Hospital Corporation "MGH" and are
subject to the terms and conditions in
[FREESURFER.txt](../public/licenses/FREESURFER.txt).

The FreeSurfer Software License Agreement v1.0 permits use, modification and
redistribution subject to preservation of its terms, attribution and notices.
It restricts endorsement and identifies the software/data as research material.
The complete agreement is bundled, including Part B. CBIG's MIT notice is also
bundled in [CBIG.txt](../public/licenses/CBIG.txt). The derived binary is explicitly
identified as a format/coordinate conversion, not an original FreeSurfer file.

## Validation limits

The front, left lateral and three-quarter renders were inspected. They retain
the longitudinal fissure, anatomical proportions, major cortical folds and
atlas-labelled lobe boundaries. Transparent rendering necessarily overlays
far-side colours. This was a source/provenance and visual engineering review,
not a clinical or expert neuroanatomical certification.

This group-average, reduced-resolution cortex does not represent an individual's
MRI. The cerebellum, brainstem and subcortical structures are not included.
No medical-grade accuracy or biological memory-function simulation is claimed.
