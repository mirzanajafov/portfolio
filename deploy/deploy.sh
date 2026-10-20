#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

compose=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile app)
branch="${DEPLOY_BRANCH:-main}"
force=false
[ "${1:-}" = "--force" ] && force=true

say() { printf '\n== %s\n' "$1"; }

web_reaches_api() {
  docker exec portfolio-web node -e \
    "fetch(process.env.API_URL + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
}

healthy() {
  say "Waiting for the API and the site"
  for _ in $(seq 1 60); do
    api=$(docker inspect -f '{{.State.Health.Status}}' portfolio-api 2>/dev/null || true)
    web=$(docker inspect -f '{{.State.Health.Status}}' portfolio-web 2>/dev/null || true)
    if [ "$api" = healthy ] && [ "$web" = healthy ] && web_reaches_api; then
      return 0
    fi
    sleep 3
  done
  return 1
}

release() {
  "${compose[@]}" up -d --build --remove-orphans
}

previous=$(git rev-parse HEAD)
git fetch --quiet origin "$branch"
target=$(git rev-parse "origin/$branch")

if [ "$previous" = "$target" ] && [ "$force" = false ]; then
  echo "Already at $(git log --oneline -1). Use --force to rebuild anyway."
  exit 0
fi

say "Waiting for the database"
"${compose[@]}" up -d --wait --wait-timeout 120 postgres

say "Deploying $(git log --oneline -1 "$target")"
git merge --ff-only --quiet "$target"
if release && healthy; then
  docker image prune -f --filter "label=com.docker.compose.project=portfolio" > /dev/null
  say "Live: $(git log --oneline -1)"
  exit 0
fi

say "The release failed, rolling back to $(git log --oneline -1 "$previous")"
git reset --hard --quiet "$previous"
if release && healthy; then
  echo "Rolled back. Migrations from the failed release stay applied."
else
  echo "The rollback failed too. Check: ${compose[*]} logs migrate api web" >&2
fi
exit 1
