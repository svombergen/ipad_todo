#!/bin/sh
# Usage: sh build.sh [app-dir] [Name]   (default: . KidsTodo; diary app: diary Diary)
# Builds web app + iOS app and packages an unsigned-but-fakesigned IPA for TrollStore.
# Needs macOS with Xcode, plus: brew install xcodegen ldid
set -eu
cd "$(dirname "$0")/${1:-.}"
NAME=${2:-KidsTodo}

# Build number: bumps on every CI run. Local builds are 0 (never look newer than a CI build).
BUILD=${BUILD:-${GITHUB_RUN_NUMBER:-0}}
export BUILD

(cd web && npm ci && npm test && npm run build)

cd ios
xcodegen generate
xcodebuild -project "$NAME.xcodeproj" -scheme "$NAME" -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' -derivedDataPath build \
  CODE_SIGNING_ALLOWED=NO build

APP="build/Build/Products/Release-iphoneos/$NAME.app"
# xcodegen writes literal 1.0 / 1 into Info.plist, so stamp the version here (before ldid re-signs). TrollStore shows ShortVersion.
PB=/usr/libexec/PlistBuddy
$PB -c "Set :CFBundleShortVersionString 1.0.$BUILD" -c "Set :CFBundleVersion $BUILD" "$APP/Info.plist"
ldid -S "$APP/$NAME" # fake signature; TrollStore applies the real CoreTrust bypass on install

rm -rf Payload "../$NAME.ipa"
mkdir Payload
cp -R "$APP" Payload/
zip -qry "../$NAME.ipa" Payload
rm -rf Payload
printf '{"build":%s}' "$BUILD" > ../version.json # served next to the IPA so the app can spot updates
echo "Built $(cd .. && pwd)/$NAME.ipa"
