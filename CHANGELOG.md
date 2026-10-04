# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- 38 distinct circle-parking layouts with dependent groups, opposite-head choices, and coordinated forks; later tiers require up to seven parking moves.
- Stateful hints for generated parking groups and a dedicated circle challenge throughout the endless journey.
- Pressure buttons that pause arrowheads and hold matching gates open until the head leaves.
- Fixed quarter-turn deflectors and alternating deflectors that reverse after a successful head passage; only arrows operate them.
- Arrow-triggered rotating upper sections that transport arrows, tiles, and colored ridge connections.
- Five new mechanic lessons, puzzle families in the collection, and progressive combinations in the endless journey.
- Transactional movement, mechanism-aware hints, and complete undo and save replay for gates, deflectors, and rotation.
- Save migration that keeps earned completions and shifts existing endless progress past the new opening lessons.

### Fixed

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

[Unreleased]: https://github.com/boubou666/CubeCubeCube/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/boubou666/CubeCubeCube/releases/tag/v0.1.0
