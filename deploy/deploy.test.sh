#!/usr/bin/env bash
set -euo pipefail

script="$(cd "$(dirname "$0")" && pwd)/deploy.sh"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
failed=0

mkdir "$work/bin"
cat > "$work/bin/docker" <<'EOF'
#!/usr/bin/env bash
on_old() { [ "$(git rev-parse HEAD)" = "$OLD" ]; }
case "$*" in
  *"up -d --wait postgres") [ -z "${POSTGRES_DOWN:-}" ] ;;
  compose*) [ -z "${RELEASE_FAILS:-}" ] || on_old ;;
  inspect*) if [ -n "${NEVER_HEALTHY:-}" ] && ! on_old; then echo starting; else echo healthy; fi ;;
  exec*) [ -z "${NEVER_HEALTHY:-}" ] || on_old ;;
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
  local dir
  dir=$(mktemp -d -p "$work")
  git -c init.defaultBranch=main init -q --bare "$dir/origin.git"
  git -c init.defaultBranch=main init -q "$dir/app"
  cd "$dir/app"
  git config core.autocrlf false
  mkdir deploy
  cp "$script" deploy/deploy.sh
  git remote add origin "$dir/origin.git"
  commit old
  old=$(git rev-parse HEAD)
  commit new
  new=$(git rev-parse HEAD)
  git push -q origin HEAD:main
  git reset -q --hard "$old"
  status=0
  env "$@" OLD="$old" PATH="$work/bin:$PATH" bash deploy/deploy.sh > /dev/null 2>&1 || status=$?
  head=$(git rev-parse HEAD)
  cd - > /dev/null
}

expect() {
  if [ "$status $head" = "$1 $2" ]; then
    echo "ok    $3"
  else
    echo "FAIL  $3: exit $status at $head"
    failed=1
  fi
}

deploy
expect 0 "$new" "deploys a healthy release"
deploy RELEASE_FAILS=1
expect 1 "$old" "goes back to the previous commit when the release fails to build or start"
deploy NEVER_HEALTHY=1
expect 1 "$old" "goes back to the previous commit when the release never gets healthy"
deploy POSTGRES_DOWN=1
expect 1 "$old" "leaves the checkout alone when Postgres is down"

exit "$failed"
