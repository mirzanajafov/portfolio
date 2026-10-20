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
  compose*) [ -z "${RELEASE_FAILS:-}" ] || on_old ;;
  inspect*) if [ -n "${NEVER_HEALTHY:-}" ] && ! on_old; then echo starting; else echo healthy; fi ;;
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
  status=0
  env -i PATH="$work/bin:$PATH" GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 OLD="$old" "$@" \
    bash deploy/deploy.sh > /dev/null 2>&1 || status=$?
  head=$(git rev-parse HEAD)
  moves=$(($(git reflog | wc -l) - moves_before))
  cd - > /dev/null
}

expect() {
  if [ "$status $head $moves" = "$1 $2 $3" ]; then
    echo "ok    $4"
  else
    echo "FAIL  $4: exit $status at $head after $moves moves"
    failed=1
  fi
}

deploy
expect 0 "$new" 1 "deploys a healthy release"
deploy RELEASE_FAILS=1
expect 1 "$old" 2 "goes back to the previous commit when the release fails to build or start"
deploy NEVER_HEALTHY=1
expect 1 "$old" 2 "goes back to the previous commit when the release never gets healthy"
deploy API_UNREACHABLE=1
expect 1 "$old" 2 "goes back to the previous commit when the site can't reach the API"
deploy POSTGRES_DOWN=1
expect 1 "$old" 0 "never touches the checkout when Postgres is down"

exit "$failed"
