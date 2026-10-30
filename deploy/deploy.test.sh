#!/usr/bin/env bash
set -euo pipefail
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1

script="$(realpath "$(dirname "$0")")/deploy.sh"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
failed=0
month=2031-05

mkdir "$work/bin"
cat > "$work/bin/date" <<EOF
#!/usr/bin/env bash
if [ "\$*" = "-u +%Y-%m" ]; then echo $month; else exec $(command -v date) "\$@"; fi
EOF
cat > "$work/bin/docker" <<'EOF'
#!/usr/bin/env bash
on_old() { [ "$(git rev-parse HEAD)" = "$OLD" ]; }
case "$*" in
  *"--wait"*) [ -z "${POSTGRES_DOWN:-}" ] ;;
  *"--force-recreate api"*) echo "api recreated" ;;
  *"--build"*)
    echo "released with the IP databases of $(cat geo/month 2> /dev/null || echo nobody)," \
      "city file $(head -c 3 geo/dbip-city-lite.mmdb 2> /dev/null || echo missing)"
    git rev-parse HEAD >> "$RELEASES"
    case "${RELEASE_FAILS:-}" in all) false ;; new) on_old ;; esac ;;
  inspect*) if [ "${*: -1}" = "${UNHEALTHY:-}" ] && ! on_old; then echo starting; else echo healthy; fi ;;
  exec*) [ -z "${API_UNREACHABLE:-}" ] || on_old ;;
  "image prune"*) ;;
  *) echo "unexpected: docker $*" >&2; exit 2 ;;
esac
EOF
cat > "$work/bin/curl" <<'EOF'
#!/usr/bin/env bash
month=$(date -u +%Y-%m)
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o) file=$2; shift 2 ;;
    https://*) url=$1; shift ;;
    *) shift ;;
  esac
done
case "$url" in
  "https://download.db-ip.com/free/dbip-city-lite-$month.mmdb.gz") kind=city ;;
  "https://download.db-ip.com/free/dbip-asn-lite-$month.mmdb.gz") kind=asn ;;
  *) echo "unexpected: curl $url" >&2; exit 2 ;;
esac
echo "downloading the $kind database" >&2
case "${GEO_DOWN:-}" in all | "$kind") exit 22 ;; esac
if [ -n "${GEO_BAD:-}" ]; then
  printf '<html>Not found</html>' | gzip > "$file"
else
  printf 'new\xab\xcd\xefMaxMind.com' | gzip > "$file"
fi
EOF
printf '#!/bin/sh\n' > "$work/bin/sleep"
chmod +x "$work/bin/docker" "$work/bin/curl" "$work/bin/date" "$work/bin/sleep"

commit() {
  echo "$1" > release
  git add -A
  git -c user.name=test -c user.email=test@example.com commit -qm "$1"
}

seed_geo() {
  mkdir geo
  echo "$1" > geo/month
  printf old | tee geo/dbip-city-lite.mmdb > geo/dbip-asn-lite.mmdb
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
  cp "$(dirname "$script")/geo.sh" deploy/geo.sh
  git remote add origin "$dir/origin.git"
  commit old
  old=$(git rev-parse HEAD)
  commit new
  new=$(git rev-parse HEAD)
  git push -q origin HEAD:main
  git reset -q --hard "$old"
  case " $* " in
    *" GEO=current "*) seed_geo "$month" ;;
    *" GEO=old "*) seed_geo 2000-01 ;;
    *" GEO=month-only "*) mkdir geo && echo "$month" > geo/month ;;
  esac
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
  local name=$5 check passed=true
  [ "$status $head $moves ${last_release:-none}" = "$1 $2 $3 $4" ] || passed=false
  for check in "${@:6}"; do
    if [ "${check:0:1}" = "!" ]; then
      ! grep -qF -- "${check:1}" "$out" || passed=false
    else
      grep -qF -- "$check" "$out" || passed=false
    fi
  done
  if [ "$passed" = true ]; then
    echo "ok    $name"
  else
    echo "FAIL  $name: exit $status at $head after $moves moves, last release ${last_release:-none}"
    sed 's/^/      /' "$out"
    failed=1
  fi
}

deploy
expect 0 "$new" 1 "$new" "deploys a healthy release" "Live:"
deploy
expect 0 "$new" 1 "$new" "fetches this month's IP databases before the release and restarts the API" \
  "released with the IP databases of $month, city file new" "api recreated"
deploy GEO=current
expect 0 "$new" 1 "$new" "leaves this month's IP databases and the API alone" \
  "Live:" "!downloading" "!api recreated"
deploy GEO=month-only
expect 0 "$new" 1 "$new" "fetches the IP databases again when this month's files are missing" \
  "released with the IP databases of $month, city file new" "api recreated"
deploy GEO=old GEO_DOWN=asn
expect 0 "$new" 1 "$new" "keeps last month's IP databases whole when one download fails" \
  "could not be updated" "released with the IP databases of 2000-01, city file old" "Live:" \
  "!api recreated"
deploy GEO=old GEO_BAD=1
expect 0 "$new" 1 "$new" "keeps last month's IP databases when a download is not one" \
  "is not an MMDB file" "released with the IP databases of 2000-01, city file old" \
  "!api recreated"
deploy RELEASE_FAILS=new
expect 1 "$old" 2 "$old" "brings the previous release back when the new one fails to build or start" \
  "Rolled back."
deploy RELEASE_FAILS=new
expect 1 "$old" 2 "$old" "restarts the API with the new IP databases on the way back too" \
  "Rolled back." "api recreated"
deploy UNHEALTHY=portfolio-api
expect 1 "$old" 2 "$old" "brings the previous release back when the API never gets healthy" \
  "Rolled back."
deploy UNHEALTHY=portfolio-web
expect 1 "$old" 2 "$old" "brings the previous release back when the site never gets healthy" \
  "Rolled back."
deploy API_UNREACHABLE=1
expect 1 "$old" 2 "$old" "brings the previous release back when the site can't reach the API" \
  "Rolled back."
deploy RELEASE_FAILS=all
expect 1 "$old" 2 "$old" "says so when the previous release can't come back either" \
  "The rollback failed too"
deploy POSTGRES_DOWN=1
expect 1 "$old" 0 none "stops before the merge when Postgres is down" "Waiting for the database"

exit "$failed"
