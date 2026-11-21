#!/usr/bin/env bash
# Run a CI install command (e.g. `pnpm exec playwright install --with-deps chromium`)
# so a transient apt mirror / network blip does not fail the job:
#   1. on GitHub Actions, make apt retry each download (Acquire::Retries);
#   2. run the command up to 3 times with a short backoff.
# A real failure still fails: after the last attempt the command's exit code is returned.
#
# Usage: bash scripts/ci-apt-retry.sh <command> [args...]
# Env: CI_RETRY_DELAY_SEC — first backoff in seconds (default 10; doubles per attempt).
set -uo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: $0 <command> [args...]" >&2
  exit 2
fi

readonly max_attempts=3
delay="${CI_RETRY_DELAY_SEC:-10}"

if [ "${GITHUB_ACTIONS:-}" = "true" ] && [ -d /etc/apt/apt.conf.d ]; then
  echo 'Acquire::Retries "5";' | sudo tee /etc/apt/apt.conf.d/80-retries >/dev/null
fi

attempt=1
while true; do
  "$@"
  status=$?
  if [ "$status" -eq 0 ]; then
    exit 0
  fi
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "ci-apt-retry: '$*' failed (exit $status) after $attempt attempts" >&2
    exit "$status"
  fi
  echo "ci-apt-retry: '$*' failed (exit $status), attempt $attempt/$max_attempts; retrying in ${delay}s" >&2
  sleep "$delay"
  attempt=$((attempt + 1))
  delay=$((delay * 2))
done
