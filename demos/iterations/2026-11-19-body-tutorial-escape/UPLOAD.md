# 2026-11-19 body tutorial and escape snapshot

This snapshot copies the latest local `step2-body` demo, including its post-grab escape fix. Original repository games and earlier archives are unchanged.

Open `index.html` with its three adjacent assets present. Chrome camera/model loading requires permission and network access. Body mode includes a five-step practice flow; Keyboard mode remains available.

Changes: upper-body tracking without mandatory hip visibility; relative-motion flaps; direct folded-elbow dive; same-hand grabs; interactive body tutorial; responsive bilateral escape after a successful grab, including cancellation of a pending next grab without adding fries.

`qa/check.py` is the executable local Chrome regression suite; `qa/results.json` records 27 passing synthetic checks. Real-person camera recognition and novice completion rates have not been verified. The test runner uses the standard macOS Google Chrome path.

Source baseline: `fdf041f838857b20dcffed7b83ada22aa1c92304`. This archive is an independent iteration and does not replace `demos/gull-flight` or earlier dated snapshots.
