#!/usr/bin/env bash
#
# build-ios.sh — archive the iOS app and export a store-ready .ipa.
#
# Prerequisites:
#   * A valid Apple Developer signing identity + provisioning for the app's
#     bundle id (DEVELOPMENT_TEAM is set in the Xcode project; -allowProvisioningUpdates
#     lets Xcode fetch/create the profile automatically).
#   * ios/ExportOptions.plist present (committed alongside this script).
#
# Output: ios/build/HuastexApp.ipa
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/ios"

echo "==> pod install"
pod install

echo "==> archive (Release)"
xcodebuild \
  -workspace HuastexApp.xcworkspace \
  -scheme HuastexApp \
  -configuration Release \
  -archivePath build/HuastexApp.xcarchive \
  -allowProvisioningUpdates \
  clean archive

echo "==> export .ipa"
xcodebuild \
  -exportArchive \
  -archivePath build/HuastexApp.xcarchive \
  -exportOptionsPlist ExportOptions.plist \
  -exportPath build \
  -allowProvisioningUpdates

echo "==> done -> $ROOT/ios/build/HuastexApp.ipa"
