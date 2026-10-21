#!/usr/bin/env sh
# Install Chromium shared libs for Playwright without sudo (WSL/dev machines
# that lack libnspr4/libnss3/libasound). Extracts Ubuntu .debs under
# ~/.local/playwright-libs; scripts/agent-env.sh prepends that path to
# LD_LIBRARY_PATH when present.
#
#   . scripts/agent-env.sh
#   scripts/setup-playwright-libs.sh

set -eu

dest="${PLAYWRIGHT_LIBS_DIR:-$HOME/.local/playwright-libs}"
debs="$dest/debs"
root="$dest/root"
libdir="$root/usr/lib/x86_64-linux-gnu"

mkdir -p "$debs" "$root"
cd "$debs"

# Noble package names; libnssutil3 ships inside libnss3.
apt-get download libnspr4 libnss3 libasound2t64

rm -rf "$root"
mkdir -p "$root"
for deb in ./*.deb; do
  dpkg-deb -x "$deb" "$root"
done

if [ ! -f "$libdir/libnspr4.so" ] || [ ! -f "$libdir/libnss3.so" ] ||
  [ ! -f "$libdir/libasound.so.2" ]; then
  echo "setup-playwright-libs: expected .so files missing under $libdir" >&2
  exit 1
fi

echo "setup-playwright-libs: ready at $libdir"
echo "setup-playwright-libs: source scripts/agent-env.sh (or export LD_LIBRARY_PATH=$libdir)"
