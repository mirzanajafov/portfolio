#!/usr/bin/env bash
set -euo pipefail
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1

script="$(cd "$(dirname "$0")" && pwd)/deploy.sh"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
failed=0

mkdir "$work/bin"
cat > "$work/bin/docker" <<'EOF'
#!/usr/bin/env bash
on_old() { [ "$(git rev-parse HEAD)" = "$OLD" ]; }
case "$*" in
  *"--wait"*) [ -z "${POSTGRES_DOWN:-}" ] ;;
  *"--build"*) git rev-parse HEAD >> "$RELEASES"; [ -z "${RELEASE_FAILS:-}" ] || on_old ;;
  inspect*) if [ "${*: -1}" = "${UNHEALTHY:-}" ] && ! on_old; then echo starting; else echo healthy; fi ;;
  exec*) [ -z "${API_UNREACHABLE:-}" ] || on_old ;;
esac
EOF
printf '#!/bin/sh\n' > "$work/bin/sleep"
chmod +x "$work/bin/docker" "$work/bin/sleep"

commit() {
  echo "$1" > release
  git add -A
  git -c user.name=test -c user.email=test@example.com commit -qm "$1"
}

deploy() {
  local dir moves_before
  dir=$(mktemp -d -p "$work")
  out="$dir/out"
  git -c init.defaultBranch=main init -q --bare "$dir/origin.git"
  git -c init.defaultBranch=main init -q "$dir/app"
  cd "$dir/app"
  mkdir deploy
  cp "$script" deploy/deploy.sh
  git remote add origin "$dir/origin.git"
  commit old
  old=$(git rev-parse HEAD)
  commit new
  new=$(git rev-parse HEAD)
  git push -q origin HEAD:main
  git reset -q --hard "$old"
  moves_before=$(git reflog | wc -l)
  touch "$dir/releases"
  status=0
  env -i PATH="$work/bin:$PATH" GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 \
    OLD="$old" RELEASES="$dir/releases" "$@" bash deploy/deploy.sh > "$out" 2>&1 || status=$?
  head=$(git rev-parse HEAD)
  moves=$(($(git reflog | wc -l) - moves_before))
  running=$(tail -n 1 "$dir/releases")
  cd - > /dev/null
}

expect() {
  if [ "$status $head $moves ${running:-none}" = "$1 $2 $3 ${4:-none}" ]; then
    echo "ok    $5"
  else
    echo "FAIL  $5: exit $status at $head after $moves moves, running ${running:-none}"
    sed 's/^/      /' "$out"
    failed=1
  fi
}

deploy
expect 0 "$new" 1 "$new" "deploys a healthy release"
deploy RELEASE_FAILS=1
expect 1 "$old" 2 "$old" "brings the previous release back when the new one fails to build or start"
deploy UNHEALTHY=portfolio-api
expect 1 "$old" 2 "$old" "brings the previous release back when the API never gets healthy"
deploy UNHEALTHY=portfolio-web
expect 1 "$old" 2 "$old" "brings the previous release back when the site never gets healthy"
deploy API_UNREACHABLE=1
expect 1 "$old" 2 "$old" "brings the previous release back when the site can't reach the API"
deploy POSTGRES_DOWN=1
expect 1 "$old" 0 "" "never touches the checkout or the containers when Postgres is down"

exit "$failed"
