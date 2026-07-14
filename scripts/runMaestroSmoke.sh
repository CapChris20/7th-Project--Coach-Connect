#!/usr/bin/env bash
# Run Coach Connect Maestro smoke tests on the booted iOS simulator.
# Usage: ./scripts/runMaestroSmoke.sh [food-only]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env.maestro" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT/.env.maestro"
  echo "Loaded credentials from .env.maestro"
fi

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export PATH="$JAVA_HOME/bin:$HOME/.maestro/bin:$PATH"
if command -v maestro >/dev/null 2>&1; then
  MAESTRO=maestro
elif [[ -x "$HOME/.maestro/bin/maestro" ]]; then
  MAESTRO="$HOME/.maestro/bin/maestro"
else
  echo "Maestro not found. Install:"
  echo "  curl -Ls https://get.maestro.mobile.dev | bash"
  exit 1
fi

export APP_ID="${APP_ID:-com.coachconnect}"
API_PORT="${API_PORT:-4000}"

maestro_args=()
[[ -n "${MAESTRO_CLIENT_EMAIL:-}" ]] && maestro_args+=(-e "MAESTRO_CLIENT_EMAIL=${MAESTRO_CLIENT_EMAIL}")
[[ -n "${MAESTRO_CLIENT_PASSWORD:-}" ]] && maestro_args+=(-e "MAESTRO_CLIENT_PASSWORD=${MAESTRO_CLIENT_PASSWORD}")
[[ -n "${MAESTRO_TRAINER_EMAIL:-}" ]] && maestro_args+=(-e "MAESTRO_TRAINER_EMAIL=${MAESTRO_TRAINER_EMAIL}")
[[ -n "${MAESTRO_TRAINER_PASSWORD:-}" ]] && maestro_args+=(-e "MAESTRO_TRAINER_PASSWORD=${MAESTRO_TRAINER_PASSWORD}")

run_flow() {
  local label="$1"
  local flow="$2"
  echo ""
  echo "=== ${label} ==="
  if "${MAESTRO}" test "${maestro_args[@]}" "$flow"; then
    echo "${label}: PASS"
    return 0
  fi
  echo "${label}: FAIL"
  return 1
}

has_client_creds() {
  [[ -n "${MAESTRO_CLIENT_EMAIL:-}" && -n "${MAESTRO_CLIENT_PASSWORD:-}" ]]
}

has_trainer_creds() {
  [[ -n "${MAESTRO_TRAINER_EMAIL:-}" && -n "${MAESTRO_TRAINER_PASSWORD:-}" ]]
}

BOOTED="$(
  xcrun simctl list devices booted 2>/dev/null | grep -i booted | head -1 || true
)"
if [[ -z "$BOOTED" ]]; then
  echo "No booted iOS simulator. Start one first:"
  echo "  open -a Simulator"
  echo "  npm run ios"
  exit 1
fi

echo "Using APP_ID=$APP_ID"
echo "Booted simulator: $BOOTED"
echo ""
echo "Maestro test plan:"
echo "  • App launch (always)"
echo "  • Session check (always)"
if has_client_creds; then
  echo "  • Client full suite (login → 6 food searches → dashboard → AI → trainers → logout)"
  if [[ "${MAESTRO_RUN_SLOW:-}" == "1" ]]; then
    echo "  • Client workout plan (slow)"
  fi
else
  echo "  ✗ Client suite SKIPPED — add real accounts to .env.maestro"
fi
if has_trainer_creds; then
  echo "  • Trainer full suite (login → messages)"
else
  echo "  ✗ Trainer suite SKIPPED — add trainer account to .env.maestro"
fi
echo ""

if curl -sf "http://localhost:${API_PORT}/health" >/dev/null 2>&1 || \
   curl -sf "http://localhost:${API_PORT}/" >/dev/null 2>&1; then
  echo "API server: reachable on port ${API_PORT}"
else
  echo "⚠️  API server not on port ${API_PORT} — food search will fail. Run: npm run server"
fi

if has_client_creds && [[ "${MAESTRO_CLIENT_EMAIL}" == *example.com* ]]; then
  echo "⚠️  MAESTRO_CLIENT_EMAIL still looks like a placeholder — use a real test account"
fi

echo ""
echo "Note: reload the app in the simulator once so login accessibility labels are active."
echo ""

FAILURES=0
MODE="${1:-}"

if [[ "$MODE" == "food-only" ]]; then
  if ! has_client_creds; then
    echo "food-only requires MAESTRO_CLIENT_EMAIL and MAESTRO_CLIENT_PASSWORD in .env.maestro"
    exit 1
  fi
  run_flow "Client food — restaurants & brands" ".maestro/04-client-food-multi-brand-suite.yaml" || exit 1
  echo "Food search suite passed."
  exit 0
fi

run_flow "App launch" ".maestro/00-app-launch.yaml" || FAILURES=$((FAILURES + 1))
run_flow "Session check" ".maestro/00-session-smoke.yaml" || FAILURES=$((FAILURES + 1))

if has_client_creds; then
  run_flow "Client full suite" ".maestro/10-client-full-suite.yaml" || FAILURES=$((FAILURES + 1))
  if [[ "${MAESTRO_RUN_SLOW:-}" == "1" ]]; then
    run_flow "Client workout plan (slow)" ".maestro/07-client-workout-plan.yaml" || FAILURES=$((FAILURES + 1))
  fi
else
  echo ""
  echo "Create .env.maestro:  cp .maestro/env.example .env.maestro"
fi

if has_trainer_creds; then
  run_flow "Trainer full suite" ".maestro/11-trainer-full-suite.yaml" || FAILURES=$((FAILURES + 1))
fi

echo ""
if [[ "$FAILURES" -gt 0 ]]; then
  echo "Maestro run finished with ${FAILURES} failure(s)."
  exit 1
fi
echo "Maestro run finished — all executed flows passed."
