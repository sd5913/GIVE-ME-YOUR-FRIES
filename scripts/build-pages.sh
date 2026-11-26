#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
out=${1:-_site}
if [[ -e "$out" || -L "$out" ]]; then
  echo "Choose an output directory that does not already exist: $out" >&2
  exit 1
fi
mkdir -p -- "$out/demos/gull-flight/assets"
cp -- pages/index.html "$out/index.html"
cp -- GIVE_ME_YOUR_FRIES_DUO_GESTURE.html "$out/"
cp -- demos/gull-flight/{index.html,flight.css,language.js,scene.js,levels.js,obstacles.js,guide.js,flight.js} "$out/demos/gull-flight/"
cp -- demos/gull-flight/assets/no-seagulls.svg "$out/demos/gull-flight/assets/"
