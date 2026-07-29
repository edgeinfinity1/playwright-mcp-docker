#!/usr/bin/env bash
set -Eeuo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${project_root}"

wait_for_url() {
  local url="$1"
  local attempts="${2:-60}"
  for _ in $(seq 1 "${attempts}"); do
    if curl --fail --silent --show-error "${url}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for ${url}" >&2
  return 1
}

wait_for_port() {
  local host="$1"
  local port="$2"
  local attempts="${3:-60}"
  for _ in $(seq 1 "${attempts}"); do
    if (exec 3<>"/dev/tcp/${host}/${port}") 2>/dev/null; then
      exec 3>&-
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for ${host}:${port}" >&2
  return 1
}

wait_for_service_health() {
  local service="$1"
  local attempts="${2:-60}"
  local status
  for _ in $(seq 1 "${attempts}"); do
    status="$(docker compose ps --format '{{.Status}}' "${service}" 2>/dev/null || true)"
    if [[ "${status}" == *"(healthy)"* ]]; then
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for healthy service: ${service}" >&2
  return 1
}

wait_for_url "http://127.0.0.1:6080/"
wait_for_port 127.0.0.1 8931
wait_for_service_health mcp

no_vnc_html="$(curl --fail --silent http://127.0.0.1:6080/)"
if [[ "${no_vnc_html}" != *"noVNC"* ]]; then
  echo "Port 6080 did not serve the noVNC client" >&2
  exit 1
fi
node tests/novnc-smoke.mjs

node tests/mcp-smoke.mjs set
if [[ ! -s output/smoke-screenshot.png ]]; then
  echo "MCP screenshot was not written to output/smoke-screenshot.png" >&2
  exit 1
fi
echo "MCP output is visible on the host: output/smoke-screenshot.png"
node tests/mcp-smoke.mjs check

docker compose restart mcp
wait_for_service_health mcp
node tests/mcp-smoke.mjs check

docker compose ps
echo "All smoke tests passed. noVNC, Streamable HTTP MCP, session sharing, and MCP-restart persistence are working."
