#!/bin/sh
set -eu

bun_pid=""
caddy_pid=""

stop_children() {
  for pid in "$bun_pid" "$caddy_pid"; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
}

trap 'stop_children' INT TERM

bun /app/dist/server/server.js &
bun_pid=$!

caddy run --config /etc/caddy/Caddyfile --adapter caddyfile &
caddy_pid=$!

exit_code=0

while :; do
  if ! kill -0 "$bun_pid" 2>/dev/null; then
    wait "$bun_pid" || exit_code=$?
    break
  fi

  if ! kill -0 "$caddy_pid" 2>/dev/null; then
    wait "$caddy_pid" || exit_code=$?
    break
  fi

  sleep 1
done

stop_children
wait "$bun_pid" 2>/dev/null || true
wait "$caddy_pid" 2>/dev/null || true

exit "$exit_code"
