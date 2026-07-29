#!/usr/bin/env bash
set -Eeuo pipefail

screen_width="${SCREEN_WIDTH:-1440}"
screen_height="${SCREEN_HEIGHT:-900}"
screen_depth="${SCREEN_DEPTH:-24}"

mkdir -p /data/chromium /tmp/.X11-unix
chown -R browser:browser /data/chromium
chown root:root /tmp/.X11-unix
chmod 1777 /tmp/.X11-unix
rm -f /tmp/.X99-lock /tmp/.X11-unix/X99
# These locks contain the previous container hostname and are not profile data.
rm -f /data/chromium/SingletonCookie \
  /data/chromium/SingletonLock \
  /data/chromium/SingletonSocket

export DISPLAY=:99

child_pids=()
cleanup() {
  if ((${#child_pids[@]})); then
    kill "${child_pids[@]}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

gosu browser Xvfb :99 \
  -screen 0 "${screen_width}x${screen_height}x${screen_depth}" \
  -ac +extension GLX +render -noreset &
child_pids+=("$!")

for _ in $(seq 1 50); do
  [[ -S /tmp/.X11-unix/X99 ]] && break
  sleep 0.1
done

gosu browser openbox-session &
child_pids+=("$!")

gosu browser x11vnc \
  -display :99 \
  -forever \
  -shared \
  -rfbport 5900 \
  -nopw \
  -noxdamage \
  -repeat &
child_pids+=("$!")

gosu browser websockify \
  --web=/usr/share/novnc \
  6080 localhost:5900 &
child_pids+=("$!")

# Debian Chromium binds DevTools to loopback. This bridge is only exposed on
# the Compose network and lets the separate MCP container reach it.
socat TCP-LISTEN:9223,fork,reuseaddr,bind=0.0.0.0 TCP:127.0.0.1:9222 &
child_pids+=("$!")

gosu browser chromium \
  --user-data-dir=/data/chromium \
  --remote-debugging-address=0.0.0.0 \
  --remote-debugging-port=9222 \
  --remote-allow-origins='*' \
  --no-first-run \
  --no-default-browser-check \
  --disable-dev-shm-usage \
  --disable-gpu \
  --window-size="${screen_width},${screen_height}" \
  about:blank &
chromium_pid="$!"
child_pids+=("${chromium_pid}")

wait "${chromium_pid}"
