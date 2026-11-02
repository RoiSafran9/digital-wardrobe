#!/bin/bash
# KIPS first-five beta: read-only preflight of the Mac that hosts the API, worker and Cloudflare Tunnel
# (docs/beta/first-five-mac/06-MAC-OPERATIONS-RUNBOOK.md). It only looks: it never restarts, loads,
# edits or kills anything, never reads .env.server, and prints no environment, token or tunnel argument.
# Run it from the repo root on the Mac, before each pilot session:
#
#   scripts/mac_preflight.sh
#   KIPS_API_LABEL=com.kipscloset.api KIPS_PUBLIC_HEALTH=https://api.kipscloset.com/healthz scripts/mac_preflight.sh
#
# Exit code: 0 all ok, 1 a warning, 2 something critical. A check from the Mac itself cannot see the Mac
# asleep or offline: also open the public URL from a phone on cellular.
set -u
cd "$(dirname "$0")/.." || exit 2

API_LABEL="${KIPS_API_LABEL:-com.kipscloset.api}"
LOCAL_HEALTH="${KIPS_LOCAL_HEALTH:-http://127.0.0.1:8000/healthz}"
PUBLIC_HEALTH="${KIPS_PUBLIC_HEALTH:-https://api.kipscloset.com/healthz}"
LOG_DIR="${KIPS_LOG_DIR:-logs}"
MIN_FREE_GB="${KIPS_MIN_FREE_GB:-10}"
PYTHON="${KIPS_PYTHON:-.venv/bin/python}"
[ -x "$PYTHON" ] || PYTHON=python3

worst=0
note() {  # level message
  case "$1" in
    ok) printf '  ok       %s\n' "$2" ;;
    warn) printf '  WARN     %s\n' "$2"; [ "$worst" -lt 1 ] && worst=1 ;;
    critical) printf '  CRITICAL %s\n' "$2"; worst=2 ;;
    *) printf '  info     %s\n' "$2" ;;
  esac
}
section() { printf '\n== %s\n' "$1"; }

section "Time"
note info "$(date -u '+%Y-%m-%d %H:%M:%S UTC') · up $(uptime | sed -E 's/.*up ([^,]*(, *[0-9]+:[0-9]+)?).*/\1/')"

section "API launch agent ($API_LABEL)"
if agent="$(launchctl print "gui/$(id -u)/$API_LABEL" 2>/dev/null)"; then
  # Only these lines: launchctl print also lists the agent's environment, which must not be shown.
  state="$(printf '%s\n' "$agent" | awk -F' = ' '/^\tstate = /{print $2; exit}')"
  pid="$(printf '%s\n' "$agent" | awk -F' = ' '/^\tpid = /{print $2; exit}')"
  last="$(printf '%s\n' "$agent" | awk -F' = ' '/^\tlast exit code = /{print $2; exit}')"
  runs="$(printf '%s\n' "$agent" | awk -F' = ' '/^\truns = /{print $2; exit}')"
  if [ "$state" = "running" ]; then note ok "running (pid ${pid:-?}, started ${runs:-?} times, last exit ${last:-none})"
  else note critical "state ${state:-unknown} (last exit ${last:-none})"; fi
else
  note critical "no launchd agent named $API_LABEL in gui/$(id -u) — check the label in ~/Library/LaunchAgents"
fi
listeners="$(lsof -nP -iTCP:8000 -sTCP:LISTEN 2>/dev/null | awk 'NR>1{print $2}' | sort -u | wc -l | tr -d ' ')"
if [ "$listeners" = "1" ]; then note ok "one process listens on port 8000"
elif [ "$listeners" = "0" ]; then note critical "nothing listens on port 8000"
else note warn "$listeners processes listen on port 8000 (a second server?)"; fi

section "Cloudflare Tunnel"
# The label is not documented: list what launchd knows, never assume one.
tunnel_agents="$(launchctl list 2>/dev/null | awk 'tolower($3) ~ /cloudflare/ {print $3 " (pid " $1 ", last exit " $2 ")"}')"
if [ -n "$tunnel_agents" ]; then
  while IFS= read -r line; do note info "launchd: $line"; done <<<"$tunnel_agents"
else
  note warn "no launchd job with 'cloudflare' in its label (it may run as a system daemon: sudo launchctl list | grep -i cloudflare)"
fi
count="$(pgrep -x cloudflared 2>/dev/null | wc -l | tr -d ' ')"  # a count only: its arguments can hold the token
if [ "$count" -ge 1 ]; then note ok "$count cloudflared process(es) running"; else note critical "no cloudflared process"; fi

section "Health (local and public)"
"$PYTHON" -m scripts.health_check --url "$LOCAL_HEALTH" --url "$PUBLIC_HEALTH" | sed 's/^/  /'
code="${PIPESTATUS[0]}"
[ "$code" -gt "$worst" ] && worst="$code"

section "Power and sleep"
if pmset -g batt 2>/dev/null | head -1 | grep -q "AC Power"; then note ok "on AC power"
else note warn "not on AC power — plug the Mac in"; fi
sleep_min="$(pmset -g 2>/dev/null | awk '$1=="sleep"{print $2; exit}')"
if [ "${sleep_min:-}" = "0" ]; then note ok "system sleep is off (pmset sleep 0)"
elif pmset -g assertions 2>/dev/null | grep -Eq 'PreventUserIdleSystemSleep +1'; then
  note ok "idle sleep is held off by an assertion (e.g. caffeinate); pmset sleep is ${sleep_min:-?} min"
else note warn "the Mac may sleep after ${sleep_min:-?} min idle — see the runbook (no setting is changed here)"; fi
autorestart="$(pmset -g 2>/dev/null | awk '$1=="autorestart"{print $2; exit}')"
note info "restart after power failure: ${autorestart:-unknown} (1 = on)"

section "Network"
iface="$(route -n get default 2>/dev/null | awk '/interface:/{print $2}')"
if [ -n "$iface" ]; then note ok "default route via $iface"; else note critical "no default route (offline?)"; fi

section "Disk and logs"
free_gb="$(df -g . | awk 'NR==2{print $4}')"
if [ "${free_gb:-0}" -ge "$MIN_FREE_GB" ]; then note ok "${free_gb} GB free"
else note warn "only ${free_gb:-?} GB free (want ≥ ${MIN_FREE_GB})"; fi
if [ -d "$LOG_DIR" ]; then
  files="$(find "$LOG_DIR" -maxdepth 1 -name 'server.jsonl*' | wc -l | tr -d ' ')"
  note info "$LOG_DIR: $(du -sh "$LOG_DIR" | awk '{print $1}') in $files server log file(s) (14 days kept)"
  case "$(cd "$LOG_DIR" && pwd -P)" in
    *Dropbox*|*iCloud*|*Mobile\ Documents*|*Google\ Drive*) note warn "logs are in a synced folder — keep them local" ;;
  esac
  mode="$(stat -f '%Lp' "$LOG_DIR/server.jsonl" 2>/dev/null)"
  if [ -n "$mode" ] && [ $(( 8#$mode & 8#004 )) -ne 0 ]; then
    note info "server.jsonl is readable by other Mac users (mode $mode); chmod 600 if others use this Mac"
  fi
  if [ -f "$LOG_DIR/server.jsonl" ]; then
    errors="$(grep -c '"level": "ERROR"' "$LOG_DIR/server.jsonl" 2>/dev/null || true)"
    failed="$(grep -c '"msg": "job finished".*"outcome": "failed"' "$LOG_DIR/server.jsonl" 2>/dev/null || true)"
    s5xx="$(grep -Ec '"msg": "request".*"status": 5[0-9][0-9]' "$LOG_DIR/server.jsonl" 2>/dev/null || true)"
    note info "today's log: ${errors:-0} ERROR lines · ${failed:-0} failed jobs · ${s5xx:-0} 5xx answers"
  fi
else
  note warn "no $LOG_DIR/ here — is this the folder the API agent runs from?"
fi

printf '\nResult: %s\n' "$( [ "$worst" = 0 ] && echo ok || { [ "$worst" = 1 ] && echo WARNING || echo CRITICAL; } )"
exit "$worst"
