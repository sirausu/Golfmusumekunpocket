#!/bin/sh
# src/ のファイルをつなげて、1つの index.html を作る
cd "$(dirname "$0")"
{ cat src/head.html; grep -v "module.exports" src/engine.js; grep -v "module.exports" src/game.js; grep -v "module.exports" src/events.js; cat src/scenes.js; cat src/ui.js; echo '</script></body></html>'; } > index.html
echo "index.html を作りました"
