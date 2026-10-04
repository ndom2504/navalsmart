#!/bin/bash
set -euo pipefail

if [[ -z "${CAPACITOR_SERVER_URL:-}" ]]; then
  echo "Définir CAPACITOR_SERVER_URL vers l'adresse HTTPS de NavalSmart."
  exit 1
fi

if [[ -z "${APPLE_TEAM_ID:-}" ]]; then
  echo "Définir APPLE_TEAM_ID, l'identifiant d'équipe Apple Developer."
  exit 1
fi

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

npx cap sync ios

archive="$root/ios/App/build/NavalSmart.xcarchive"
rm -rf "$archive"

xcodebuild \
  -project "$root/ios/App/App.xcodeproj" \
  -scheme App \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$archive" \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" \
  archive

export_dir="$root/ios/App/build/export"
rm -rf "$export_dir"
mkdir -p "$export_dir"

cat > "$export_dir/ExportOptions.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store-connect</string>
  <key>destination</key>
  <string>upload</string>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>teamID</key>
  <string>${APPLE_TEAM_ID}</string>
  <key>uploadSymbols</key>
  <true/>
</dict>
</plist>
EOF

xcodebuild -exportArchive \
  -archivePath "$archive" \
  -exportPath "$export_dir" \
  -exportOptionsPlist "$export_dir/ExportOptions.plist"
