#!/bin/sh
set -eu
umask 077

BACKUPS=/backups
KEEP_DAYS=7
RUN_AT=04:30
DUMP_TIMEOUT="${DUMP_TIMEOUT:-30m}"
partial=

log() {
  printf '{"event":"backup","time":"%s","message":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1"
}

delete_old_dumps() {
  find "$BACKUPS/db" -name 'portfolio-*' -mmin +$((KEEP_DAYS * 24 * 60 - 60)) -delete
}

backup_database() {
  target="$BACKUPS/db/portfolio-$(date -u +%Y-%m-%dT%H-%M-%SZ).dump"
  partial=$(mktemp "$target.XXXXXX")
  timeout --foreground "$DUMP_TIMEOUT" pg_dump --format=custom --no-owner --no-privileges \
    --exclude-table-data='"VisitorSalt"' --exclude-table-data='"RateLimit"' \
    --exclude-table-data='"AdminLoginToken"' --exclude-table-data='"AdminSession"' \
    --file="$partial"
  pg_restore --list "$partial" > /dev/null
  mv "$partial" "$target"
  log "database $(du -h "$target" | cut -f1) $target"
}

run_once() {
  mkdir -p "$BACKUPS/db"
  delete_old_dumps
  backup_database
  date -u +%Y-%m-%dT%H:%M:%SZ > "$BACKUPS/last-success"
}

finish() {
  if [ "$?" -ne 0 ]; then
    rm -f "$partial"
    log "FAILED"
  fi
}

seconds_until_next_run() {
  now=$(date -u +%s)
  today=$(date -u +%Y-%m-%d)
  next=$(date -u -d "$today $RUN_AT" +%s)
  [ "$next" -gt "$now" ] || next=$((next + 86400))
  echo $((next - now))
}

case "${1:-}" in
  once)
    trap finish EXIT
    run_once
    exit
    ;;
  check)
    [ -n "$(find "$BACKUPS/last-success" -mmin -$((26 * 60)) 2> /dev/null)" ]
    exit
    ;;
esac

trap 'exit 0' TERM INT
log "scheduled daily at $RUN_AT UTC, keeping $KEEP_DAYS days"
while true; do
  sleep "$(seconds_until_next_run)" &
  wait $!
  sh "$0" once || true
done
