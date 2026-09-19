#!/bin/bash
# تشغيل البوت على لينكس/ويندوز/ماك (بديل عن Termux)
cd "$(dirname "$0")"
[ -d node_modules ] || npm install --no-audit --no-fund
node src/index.js
