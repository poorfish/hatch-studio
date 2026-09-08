# Design QA — reference terrain linework

## Comparison target

- Source visual: `/var/folders/zt/2rz95gc559bdyt8nn7dm39p80000gp/T/codex-clipboard-f9c4b57b-fa4b-4ed5-a2f6-46c8b43a93b7.png` (1000 × 742 px), the supplied Maungawhau reference.
- Implementation: `http://127.0.0.1:4173/`, browser tab 4, captured at 1280 × 720 CSS px, default direct 3D View state.
- Density normalization: source and browser capture were compared as displayed; no device-pixel scaling was applied.

## Findings

- [Resolved P1] The main stage now stays in a direct, orbitable 3D View. SVG export remains available as an output action rather than a second preview mode.
- [Resolved P1] The camera was perspective-only. The preview now uses an orthographic camera with an axonometric framing and an explicit Orthographic selected state.
- [Resolved P1] Perspective and Orthographic now switch the active Three.js camera (including controls and outline rendering), and the helper copy updates to reflect the active mode.
- [Resolved P2] The main workspace now uses the full available width; the control panel overlays the stage without shrinking the 3D View.
- [Resolved P1] Desktop layout now uses a two-column grid: the title and 3D View form the left column, while HatchKit occupies its own right column instead of floating above the canvas.
- [Resolved P2] The title block spans the full left column and has a deliberate vertical gap before the preview.
- [Resolved P2] The reset-view action is anchored to the preview's lower-right corner with a consistent inset.
- [Resolved P2] Added an `Auto rotate model` switch wired to OrbitControls, with a visible on/off state and a restrained rotation speed.
- [Resolved P1] The former SVG export emitted per-triangle polygons and tiny edge marks. Imported meshes and the procedural presets now go through a depth-tested raster-to-scanline vector pass before export.
- [Resolved P1] The model perimeter is rendered in the 3D View with dedicated outline geometry, so the terrain ridge and slab edges remain visible as the camera moves. The exported SVG keeps its own closed outline path.
- [Resolved P1] The sample terrain and its slab are now one conforming mesh: the side wall follows the terrain footprint instead of intersecting a separate flat box, removing duplicated base contours.
- [Resolved P1] The terrain-to-side top crease, lower slab perimeter, and corner joins now have explicit line geometry; they no longer disappear when the surface and side wall share smoothed normals.
- [Resolved P2] Added an `Outline thickness` control (0–4 px) that scales the live silhouette shell, pixel-width crease lines, and exported SVG outline weight; at 0 all outline layers are hidden.
- [Resolved P2] The sample's slab outline no longer uses the full slab for the expanded shell, preventing terminal blocks at the two end corners. Top/bottom loops and vertical joins are rendered separately with pixel-width lines and a low-amplitude deterministic wobble for a restrained hand-drawn feel; the silhouette shell uses the terrain top only and receives a subtle normal-space perturbation.
- [Resolved P2] Contrast was exposed in the UI but did not drive the sample SVG thresholds. It now controls primary/secondary hatch thresholds, tone response, surface opacity, and the 3D shader response.
- [Resolved P1] Hatch angle now rotates both hatch families in the live shader and in exported scanline SVG paths.
- [Resolved P2] Added Straight/Wavy hatch line types. Wavy mode exposes a `Wave curvature` control and applies the deformation to both the live shader and exported SVG paths.
- [Resolved P2] Added a `Dotted line ends` switch. SVG runs taper into round endpoint dots; the live shader uses screen-space edge detection to introduce the same dotted treatment near visible line termini.
- [Resolved P2] The live dotted-end mask now treats a hatch run's endpoint as a crossing of its light/dark threshold, with a secondary silhouette check; interior runs stay solid while threshold termini receive the dotted treatment.
- [Resolved P2] Endpoint dots now fade in opacity toward the terminal point, matching the reference's soft disappearance; exported SVG endpoint circles use the same opacity ramp.
- [Resolved P2] Hatch stroke width now responds to tone: darker regions use a wider stroke and lighter regions use a finer stroke, while `Stroke weight` remains the global baseline. The same tone-scaled widths are emitted on SVG scanline paths.
- [Resolved P2] Added four selectable procedural presets—Greek bust, KNOT, Ceramic vase, and Snow mountain—with compact visual thumbnails in the Model panel. Selecting a preset replaces the live model and updates the active thumbnail; local file upload clears the preset selection.
- [Resolved P2] Greek bust now loads the supplied `bust.glb` asset (including its Draco-compressed mesh) from the bundled app resources instead of the procedural placeholder.
- [Resolved P2] KNOT and Ceramic vase now load the supplied `torus.glb` and `vase.glb` assets; all bundled meshes use the same Draco-capable loader path.
- [Resolved P2] Preset swaps now reapply the current hatch, outline, paper, and ink settings to the newly loaded materials instead of resetting shader uniforms to defaults.
- [Resolved P2] A model-aware camera frame recalculates the view target and padding after model swaps, camera changes, and viewport resizes so each model stays centered without clipping.
- [Resolved P2] Removed the viewport radial vignette so the 3D canvas keeps the same uniform paper background as the reference/export surface.
- [Resolved P2] `Wave curvature` now spans 8–24 px, with an 8 px initial value when Wavy mode is selected.
- [Resolved P2] The top-right settings icon is now a show/hide toggle for the parameter panel; hiding it expands the 3D View into the full content width.
- [Resolved P2] Model, Camera, Hatching, and Paper & ink are now independently collapsible; each heading is a keyboard-accessible button whose arrow and expanded state remain in sync.
- [Resolved P2] Increased the vertical rhythm inside Hatching: controls have a 14 px gap, and each range label now has extra separation from its slider track.
- [Resolved P2] Replaced per-vertex crease jitter with a low-frequency, continuously interpolated stroke perturbation. Terrain samples no longer receive a competing post-process outline pass, eliminating the broken/dashed appearance visible at side-on slab edges.
- [Resolved P2] Added `Dotted fade` (0–100%) below `Dotted line ends`. It controls both the percentage of each hatch run that becomes dots and the terminal opacity falloff in the live view and SVG export.
- [Resolved P2] SVG dotted fades now use discrete short hatch segments with hard blank gaps instead of soft pulse transitions. Their opacity follows a power curve, while the live hatch shader uses the same non-linear terminal fade response.
- [Resolved P1] The live hatch shader now switches into a near-binary short-segment mask in terminal regions. At 100% `Dotted fade`, the gaps between segments are fully paper-coloured rather than partially transparent connecting strokes.
- [Resolved P2] Terminal dash lengths now receive stable per-cell variation in both the live shader and SVG export, avoiding repetitive equal-size dash/gap grids while keeping gaps fully blank.
- [Resolved P1] Dotted terminal fading is now limited to the primary/relative-bright hatch direction. The perpendicular dark cross-hatch remains continuous in both the live shader and SVG export.
- [Resolved P1] The live primary hatch now uses an independent brightness-band mask: dotted fading is driven only by the model shade between its own solid and bright thresholds, with no dependency on the perpendicular dark-hatch boundary.
- [Resolved P1] Hatch stroke width now tapers toward brightness-threshold boundaries and expands with shade, producing pointed ends, fuller middles, and visibly heavier marks in darker areas.
- [Resolved P1] Raised `Stroke weight` max from 2.5 px to 4 px and aligned the shader clamp. Dotted rendering now follows brightness bands: dark hatch remains solid, the intermediate band becomes discrete dashes, and the brightest band clears to paper; `Dotted fade` controls the onset within that band.
- [Resolved P1] Normalized stroke darkness across the bright-to-dark transition so horizontal strokes are thinnest toward the bright terminal and grow monotonically toward the dark cross-hatch boundary, avoiding the perceived reversed gradient.
- [Resolved P1] Added a configurable `Stroke taper` control (0.5–5×, default 2.2×). Live hatch width now applies a power curve to the darkness ramp, keeping strokes fuller in shadow and making them narrow more sharply toward bright terminals when the taper is increased.
- [Resolved P2] The orbit hint now uses the current Paper colour as a translucent blurred backdrop, and Dotted controls are grouped at the end of Hatching after the lighting controls.
- [Resolved P2] Cross-hatch families now share a terminal mask derived from both shade thresholds, so the interleaved horizontal and vertical lines enter segmented fade together at their shared transition instead of ending at visibly different positions.
- [Resolved P2] Restored the original bottom-centred `drag to orbit · scroll to zoom` canvas affordance and removed the redundant reset-view button.
- [P3] Exact topographic fidelity for Maungawhau still depends on loading a matching heightfield/mesh; the built-in sample is an intentionally lightweight terrain approximation.

## Required fidelity surfaces

- Typography: compact mono controls and sans-serif title/caption remain consistent with the product shell; the reference caption is now present in the render.
- Layout: no lower-left duplicate preview; the main stage is the single visual output and the export controls remain available.
- Color: warm paper and dark ink match the source direction; the rendered slab uses the same ink instead of a shaded WebGL fill.
- Image/vector quality: the main view is live WebGL with outline geometry; exported SVG is generated as scanline paths rather than a raster thumbnail or triangle wireframe.
- Copy/content: the preview identifies `Maungawhau, Auckland NZ`; the control panel labels the active axonometric camera.

## Interactions and verification

- The main stage is always the orbitable 3D View; reset view is the only stage action.
- Desktop control panel is a sibling right column; mobile falls back to a single stacked flow.
- Reset view was checked in-browser and now sits at the lower-right of the canvas with visible edge spacing.
- Orthographic camera is active and the 3D view remains orbitable.
- Perspective/Orthographic were both clicked in-browser; the active state and camera helper text updated and the framing changed.
- Auto rotate was enabled in-browser; the switch reported `Value: 1` and the control entered its on state.
- Line spacing, stroke weight, contrast, light direction, paper, ink, and SVG export remain functional.
- Straight/Wavy and Dotted line ends were toggled in-browser; Wavy revealed the curvature control, and the curvature slider updated live without console errors.
- Wavy mode SVG export completed successfully and showed the in-app `SVG saved` confirmation.
- Tone-dependent stroke widths were checked in the live Wavy preview and SVG export still completed with `SVG saved`.
- All four preset thumbnails were exercised in-browser; Greek bust, KNOT, Ceramic vase, and Snow mountain replace the live model without console errors.
- The settings toggle was clicked both ways in-browser; the panel disappeared/reappeared and the canvas expanded when hidden.
- Each settings heading was clicked in-browser; Model and Hatching hid their content and restored it correctly, including the accessible expanded/collapsed state.
- `Dotted fade` was checked in-browser at 100% and restored to its 58% default; the control disappears when `Dotted line ends` is off and returns with its retained value when re-enabled.
- The updated live dotted shader and SVG-export generator were rebuilt successfully; both use the same non-linear terminal fade response.
- A fresh browser load confirms the orbit hint is visible at the canvas bottom centre and no reset-view control remains.
- A fresh browser preview at 100% `Dotted fade` and 18 px line spacing confirmed visible discrete terminal segments and blank inter-segment gaps.
- Contrast was manually moved from 20% to 90% in the browser; the active control and hatch density/opacity updated without errors.
- `pnpm run build` passes.
- `pnpm run test:sites` passes all four tests.
- Browser console showed no runtime errors in the verified default state.

final result: passed
