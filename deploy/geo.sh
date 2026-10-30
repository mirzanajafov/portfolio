#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

month=$(date -u +%Y-%m)
dir=geo

case "${1:-}" in
  current)
    [ "$(cat "$dir/month" 2> /dev/null || true)" = "$month" ] \
      && [ -s "$dir/dbip-city-lite.mmdb" ] && [ -s "$dir/dbip-asn-lite.mmdb" ]
    exit ;;
  "") ;;
  *)
    echo "usage: deploy/geo.sh [current]" >&2
    exit 2 ;;
esac

mkdir -p "$dir"
trap 'rm -f "$dir"/*.new' EXIT
for kind in city asn; do
  file="$dir/dbip-$kind-lite.mmdb"
  curl -fsS --connect-timeout 10 --max-time 300 --retry 2 -o "$file.gz.new" \
    "https://download.db-ip.com/free/dbip-$kind-lite-$month.mmdb.gz"
  gunzip -c "$file.gz.new" > "$file.new"
  rm "$file.gz.new"
  if ! tail -c 131072 "$file.new" | LC_ALL=C grep -qaF $'\xab\xcd\xefMaxMind.com'; then
    echo "$file.new from DB-IP is not an MMDB file" >&2
    exit 1
  fi
done
for kind in city asn; do
  mv "$dir/dbip-$kind-lite.mmdb.new" "$dir/dbip-$kind-lite.mmdb"
done
echo "$month" > "$dir/month"
echo "IP databases updated to $month"
