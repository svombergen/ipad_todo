#!/bin/sh
# Builds web app + iOS app and packages an unsigned-but-fakesigned IPA for TrollStore.
# Needs macOS with Xcode, plus: brew install xcodegen ldid
set -eu
cd "$(dirname "$0")"

(cd web && npm ci && npm test && npm run build)

cd ios
xcodegen generate
xcodebuild -project KidsTodo.xcodeproj -scheme KidsTodo -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' -derivedDataPath build \
  CODE_SIGNING_ALLOWED=NO build

APP=build/Build/Products/Release-iphoneos/KidsTodo.app
ldid -S "$APP/KidsTodo" # fake signature; TrollStore applies the real CoreTrust bypass on install

rm -rf Payload ../KidsTodo.ipa
mkdir Payload
cp -R "$APP" Payload/
zip -qry ../KidsTodo.ipa Payload
rm -rf Payload
echo "Built $(cd .. && pwd)/KidsTodo.ipa"
