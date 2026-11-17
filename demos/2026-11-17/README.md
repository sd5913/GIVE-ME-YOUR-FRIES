# 17 November 2026 — First-person full-body flight iteration

This folder archives an experimental **single-player, first-person full-body demo** from the same GIVE ME YOUR FRIES project. It adds evidence of a new interaction direction; it does not replace the existing shared-map Solo/Duo game or claim that multiplayer was added to this demo.

## Start here

- **Latest playable file:** [index.html](index.html) — download and open in Chrome.
- For camera testing, serve this folder with `python3 -m http.server 8000 --bind 127.0.0.1`, then open `http://127.0.0.1:8000/` in Chrome. Allow the camera, choose the Mac built-in camera or DJI Webcam, calibrate, and start Body Gesture mode. The original MediaPipe model downloads require internet access.
- Keyboard: W/Space flap twice; A/D steer; S dive when aligned and ready; E open claw; F grab one fry; W spread/escape; Shift+A/D dodge during an attack. Carry at most three fries.

## Iteration trail — original snapshots, not reconstructed history

All four HTML files were preserved during the 17 November development session. They are separate complete builds; their original limitations are intentionally retained for comparison. Upload commits are dated when uploaded; this archive does not backdate commits.

| Snapshot | Change / reason | Evidence and limits |
| --- | --- | --- |
| [00 — supplied original](00-original.html) | Baseline first-person demo supplied for this session. | Preserved byte-for-byte; no new test pass claim for this baseline. |
| [01 — initial P0](01-p0-core-fixes.html) | Replace automatic CHASE immunity with attack-window/world-position checks; same-hand one-grab-one-fry and recognition resets. | 39 automated checks passed at that stage. Subsequent user testing reported difficult flapping/grabbing and unintended escape. |
| [02 — gesture recovery](02-gesture-recovery.html) | Measure both elbows' actual travel; tolerate brief missing hand evidence; process grabs before escape; require spread wrists and block empty escape. | 52 automated checks passed. User confirmed grabbing became possible but still felt slow, with attacks arriving too soon to finish. |
| [03 — latest: grab response and escape timing](index.html) | Faster hand sampling; a confident fist after a confirmed same-hand open scores immediately; allow opening during cooldown; faster deliberate escape. Attack warning/charge increased from 1.4s to 3.2s. | **57/57 automated Chrome checks passed**, including simulated 1/2/3-fry body-input runs with real game clocks through attack, flight, and successful deposit. Real camera playability still requires testing. |

## What was retained

Canvas coast/pier, first-person wings and claws, original state names and route, keyboard and body modes, camera selection and calibration, original sound and model/CDN sources. The visitor still hits a bird inside the attack range at impact; extra time does not grant immunity.

## Evidence and reproducibility

- [Current machine-readable results](tests/P0_RESULTS.json)
- [Initial P0 results: 39 checks](tests/P0_RESULTS_BEFORE_URGENT.json)
- [Gesture recovery results: 52 checks](tests/P0_RESULTS_BEFORE_TIMING.json)
- [Browser regression source](tests/P0_REGRESSION.js) and [runner](tests/run_p0.py). From this folder, run `python3 tests/run_p0.py` (Mac Chrome default; supply a Chrome executable as the first argument on another machine).
- [Setup screenshot](tests/P0_SETUP.png): captured for the initial P0; included as historical visual evidence, not a new real-camera test.
- [Detailed chronological changelog](CHANGELOG_P0.md) and [test report/manual checklist](TEST_REPORT_P0.md) retain the original Chinese development notes. Their newest sections supersede older timing parameters.
- [SHA-256 snapshot manifest](SNAPSHOTS_SHA256.json) records the exact archived HTML bytes.

## Remaining tutor/playtest questions

- Does each tester launch with two natural arm cycles, without extra repeated attempts?
- Can each tester grab 1, 2, and 3 fries without sustained fist holding or accidental escape, on both built-in and DJI cameras?
- Does the 3.2-second visitor warning provide a fair opportunity to grab and leave while a stationary bird still gets hit?
- Real person, camera/model loading, device switching, and classroom teammate testing remain unverified. Automated fixtures are not a substitute for those checks.

Diagnostics: open Chrome DevTools and set `gullDebug.enabled = true`; inspect `gullDebug.snapshot()` for accepted/rejected gesture reasons. No video is recorded or uploaded by this debugging facility.
