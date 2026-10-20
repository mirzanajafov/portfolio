#!/usr/bin/env bash
set -euo pipefail
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1

script="$(realpath "$(dirname "$0")")/deploy.sh"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
failed=0

mkdir "$work/bin"
cat > "$work/bin/docker" <<'EOF'
#!/usr/bin/env bash
on_old() { [ "$(git rev-parse HEAD)" = "$OLD" ]; }
case "$*" in
  *"--wait"*) [ -z "${POSTGRES_DOWN:-}" ] ;;
  *"--build"*)
    git rev-parse HEAD >> "$RELEASES"
    case "${RELEASE_FAILS:-}" in all) false ;; new) on_old ;; esac ;;
  inspect*) if [ "${*: -1}" = "${UNHEALTHY:-}" ] && ! on_old; then echo starting; else echo healthy; fi ;;
  exec*) [ -z "${API_UNREACHABLE:-}" ] || on_old ;;
  "image prune"*) ;;
  *) echo "unexpected: docker $*" >&2; exit 2 ;;
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
  last_release=$(tail -n 1 "$dir/releases")
  cd - > /dev/null
}

expect() {
  if [ "$status $head $moves ${last_release:-none}" = "$1 $2 $3 $4" ] && grep -qF "$5" "$out"; then
    echo "ok    $6"
  else
    echo "FAIL  $6: exit $status at $head after $moves moves, last release ${last_release:-none}"
    sed 's/^/      /' "$out"
    failed=1
  fi
}

deploy
expect 0 "$new" 1 "$new" "Live:" "deploys a healthy release"
deploy RELEASE_FAILS=new
expect 1 "$old" 2 "$old" "Rolled back." "brings the previous release back when the new one fails to build or start"
deploy UNHEALTHY=portfolio-api
expect 1 "$old" 2 "$old" "Rolled back." "brings the previous release back when the API never gets healthy"
deploy UNHEALTHY=portfolio-web
expect 1 "$old" 2 "$old" "Rolled back." "brings the previous release back when the site never gets healthy"
deploy API_UNREACHABLE=1
expect 1 "$old" 2 "$old" "Rolled back." "brings the previous release back when the site can't reach the API"
deploy RELEASE_FAILS=all
expect 1 "$old" 2 "$old" "The rollback failed too" "says so when the previous release can't come back either"
deploy POSTGRES_DOWN=1
expect 1 "$old" 0 none "Waiting for the database" "stops before the merge when Postgres is down"

exit "$failed"
