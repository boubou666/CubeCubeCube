# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2026-10-05

### Added

- Étagères: visible goods moved into empty shelf slots, triple-product clearing, hidden rows and deeper reserves.
- Duos: matching illustrated pairs connected through free cells with at most two turns, including outside-border paths and fixed stones.
- Terriers: hand-carved soil, fixed rocks, shovel budgets, gravity-driven colored balls and matching cups; live physics shares the exact simulation used by solution audits.
- 48 distinct deterministic levels per game, 144 new audited puzzles, four chapters per collection and original home illustrations. The collection now has 24 games and the twenty-one additions contain 1,008 puzzles.
- Independent replay saves, exact undo, verified hints, optional sound, reduced-motion support, mouse/native touch play and sidebar or coordinate alternatives for all three games.
- All 25 HTML entry points in production and portable builds; conservation, route geometry, physical trial recovery, save corruption and real responsive-browser checks.


## [0.3.0] - 2026-10-05

### Added

- Eighteen independent original puzzle games, each with 48 distinct deterministic levels and complete audited solutions: 864 new puzzles and 21 games on the illustrated home page.
- Atelier (3D screws and color boxes), Bobines (thread collection and waiting slots), and Escapade (creatures guided by either end to matching exits).
- Passages (sliding blocks and matching doors), Voyage (passengers, buses and five waiting seats), Carrousel (pixel cleanup and returning shooters), and Broderie (layered spools and triple-color embroidery).
- Alvéoles (hexagonal stack gathering and six-tile cascades), Potions (capacity-limited color pours), and Liaisons (non-crossing paths filling the grid).
- Nœuds (rope attachments, crossings and fixed anchors) and Gouttes (drawn ramps, gravity-driven water, obstacles and glass filling).
- Écluses (pin openings, ball coloring and bombs), Dunes (granular gravity and color bands spanning a tray), and Fringale (a growing hole, food sizes and narrow passages).
- Récolte (same-color chains and vertical gravity), Dizaines (equal or ten-sum number pairs with free sightlines), and Mosaïque (finite shape trios and simultaneous row/column clearing).
- Four chapter collections, independent validated replay saves, exact undo, restart, verified hints, optional sound, reduced-motion support and native mouse/touch plus alternative controls for every new game.
- Original scenes and home illustrations, reuse of collection art as pixel/cross-stitch pictures, animated boarding and conveyor laps, and water/sand simulations shared by live play and solution audits.
- All 22 HTML entry points included in production and portable builds; resource conservation, collision/failure recovery, malformed-action/save and responsive real-browser gameplay coverage.
- 18 original Colony pictures, bringing its collection to 24 motifs and a 96-puzzle opening journey.
- Five Colony difficulty chapters, larger boards, nested color layers, cooperating teams, paged collections, difficulty badges and seeded reserve variation beyond the opening journey.

### Changed

- Pull requests run the full puzzle/browser/build checks without deploying. Branch-specific workflow concurrency keeps reviews from cancelling a live Pages deployment.
- Colony sends one worker for every available matching cube, up to the remaining quota, with no four-worker cap.
- Ants use shared instanced meshes so large swarms keep a small number of draw calls. Colony hint search has a time budget to keep difficult positions responsive.

### Fixed

- Colony save migration preserves legacy boards, ongoing trips, undo and completion records when moving to the expanded journey.

## [0.2.0] - 2026-10-04

### Changed

- 2D picture puzzles now use arrows of at least five cells, with longer target paths and leftover fragments absorbed into existing bodies where possible. Unusable fragments stay empty instead of becoming tiny arrows.
- Saved 2D boards containing short arrows regenerate with the longer paths, keeping their source image, crop, and settings.

### Added

- Home game selector with illustrated cards for the cube, picture puzzles, and Colony; the cube now lives at `cube.html` with its existing saves intact.
- Separate Three.js Colony puzzle inspired by Colony Flow: pixel pictures, five active slots, queued color boxes, and animated ants that carry outside-accessible cubes back to the nest.
- Six original Colony motifs with progressive queue variants, solvable generated reserves, undo, state-aware hints, pause, double speed, a collection, and independent validated local saves.
- Colony rule, save, complete-game browser, navigation, and desktop/mobile regression checks.
- Separate 2D picture puzzles: upload, paste, drop, or import a CORS-enabled direct image URL, then crop and generate a playable image.
- Pixel-sampled colours along each arrow, colour-aware path placement, and guaranteed solutions by forward peeling.
- Three difficulty and detail settings, alternate seeded arrangements, original-image comparison, zoom/pan, keyboard hints, undo, restart, and completion.
- Local image processing in a Web Worker and separate IndexedDB image/progress saves; the cube journey stays independent.
- 38 distinct circle-parking layouts with dependent groups, opposite-head choices, and coordinated forks; later tiers require up to seven parking moves.
- Stateful hints for generated parking groups and a dedicated circle challenge throughout the endless journey.
- Pressure buttons that pause arrowheads and hold matching gates open until the head leaves.
- Fixed quarter-turn deflectors and alternating deflectors that reverse after a successful head passage; only arrows operate them.
- Arrow-triggered rotating upper sections that transport arrows, tiles, and colored ridge connections.
- Five new mechanic lessons, puzzle families in the collection, and progressive combinations in the endless journey.
- Transactional movement, mechanism-aware hints, and complete undo and save replay for gates, deflectors, and rotation.
- Save migration that keeps earned completions and shifts existing endless progress past the new opening lessons.

### Fixed

- Clicking a 2D arrow no longer scrolls the canvas when it receives focus, keeping the click aligned with the chosen arrow.
- Movement locks left behind by missing arrow meshes or failed animation frames. All arrow types finish or restore their committed state before unlocking a mechanism level.
- Pressure-button feedback for forks parked by their second head, and misleading wait messages on deadlocked boards.
- Active saved puzzles retain their original generator while newly started puzzles use the richer parking layouts.
- Arrows ignoring obstacles on the same face beyond a tunnel opening. Physical exit trajectories now check arrow bodies across gaps, at their actual 3D depth.
- Generation accepting paths with blocked flights across gaps.

## [0.1.0] - 2026-10-04

### Added

- Three.js arrow-clearing puzzle with 23 introductory levels and an endless seeded journey.
- Progressive difficulty through larger boards, denser arrows, deeper dependencies, longer paths, and combined mechanics.
- Colored ridges that carry arrows across connected faces.
- Opposite-ended arrows with a direction selected by tapping a head.
- Forked arrows that move both heads simultaneously and require both routes to be clear.
- Pause circles that allow arrows to park temporarily and unlock other routes.
- Rectangular boards, tunnels with playable inner walls, and integrated stepped sections.
- Unrestricted rotation, zoom, camera reset, hints, undo, and restart.
- Local progress saves, replayable puzzle numbers, collection paging, and compact completion records.
- Responsive layouts, three color palettes, optional sound, and reduced-motion support.
- Automated puzzle tests, browser gameplay tests, and GitHub Pages deployment.
- Tag-triggered GitHub releases with changelog notes and a downloadable static web build.

### Fixed

- Camera rotation through poles and upside-down views.
- Forked arrows incorrectly leaving when only one head had a clear path.
- Arrows being generated with exits that ran into tunnel walls or other solid geometry.
- Asset paths and the home link when hosted under a GitHub Pages repository path.

[Unreleased]: https://github.com/boubou666/CubeCubeCube/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/boubou666/CubeCubeCube/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/boubou666/CubeCubeCube/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/boubou666/CubeCubeCube/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/boubou666/CubeCubeCube/releases/tag/v0.1.0
