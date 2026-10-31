#!/bin/sh
set -eu
cd "$(dirname "$0")"

name=portfolio-backup-test-$$
cleanup() {
  docker rm --force "$name-postgres" "$name-scheduler" > /dev/null 2>&1 || true
  docker network rm "$name" > /dev/null 2>&1 || true
  docker volume rm "$name" > /dev/null 2>&1 || true
  docker image rm "$name" > /dev/null 2>&1 || true
}
trap cleanup EXIT
trap 'exit 1' INT TERM

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

docker build --quiet --tag "$name" . > /dev/null
docker network create "$name" > /dev/null
docker volume create "$name" > /dev/null
docker run --rm --volume "$name:/backups" --entrypoint chown "$name" 1000:1000 /backups
docker run --detach --name "$name-postgres" --network "$name" --env POSTGRES_PASSWORD=test \
  --env POSTGRES_DB=portfolio postgres:17-alpine -c max_prepared_transactions=1 > /dev/null
timeout 60 sh -c "until docker exec $name-postgres pg_isready --host localhost --quiet; do sleep 1; done" ||
  fail "postgres did not start within 60 seconds"

backup() {
  docker run --rm --user 1000:1000 --network "$name" --volume "$name:/backups" --env PGHOST="$name-postgres" \
    --env PGUSER=postgres --env PGPASSWORD=test --env PGDATABASE=portfolio "$@" "$name" once
}

backup_fails() {
  if output=$(backup "$@" 2>&1); then
    fail "backup with $* exited successfully"
  fi
  case $output in
    *'"message":"FAILED"'*) ;;
    *) fail "backup with $* did not run to its own failure: $output" ;;
  esac
}

in_volume() {
  docker run --rm --user 1000:1000 --volume "$name:/backups" --entrypoint sh "$name" -c "$1"
}

expect() {
  in_volume "$2" || fail "$1"
}

psql() {
  docker exec --interactive "$name-postgres" psql --username postgres --quiet --set ON_ERROR_STOP=1 "$@"
}

counts() {
  psql --dbname "$1" --tuples-only --no-align --field-separator ' ' <<'SQL'
SELECT format('SELECT %L, count(*) FROM %I', table_name, table_name)
FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name
\gexec
SQL
}

for migration in ../../apps/api/prisma/migrations/*/migration.sql; do
  psql --dbname portfolio < "$migration"
done

psql --dbname portfolio <<'SQL'
INSERT INTO "RateLimit" ("key", "windowStart") VALUES ('ask:10m:test', now());
INSERT INTO "AskLog" ("id", "visitor", "question", "engine", "sentences", "refused", "durationMs")
VALUES ('019a3b6e-0000-7000-8000-000000000001', 'test', 'How does Tuner pick its questions?', 'keyword', '[]', false, 12);
INSERT INTO "Visit" ("visitor", "startedAt", "device", "browser") VALUES ('test', now(), 'desktop', 'Chrome');
INSERT INTO "PageView" ("id", "visitor", "path") VALUES ('019a3b6e-0000-7000-8000-000000000002', 'test', '/');
INSERT INTO "LinkClick" ("id", "viewId", "href")
VALUES ('019a3b6e-0000-7000-8000-000000000003', '019a3b6e-0000-7000-8000-000000000002', 'https://github.com');
INSERT INTO "ClientError" ("id", "viewId", "message", "source")
VALUES ('019a3b6e-0000-7000-8000-000000000004', '019a3b6e-0000-7000-8000-000000000002', 'boom', '/app.js');
INSERT INTO "VisitorSalt" ("day", "salt") VALUES (current_date, decode('00', 'hex'));
INSERT INTO "DroppedEvents" ("day", "reason") VALUES (current_date, 'bot');
INSERT INTO "Application" ("id", "code", "company", "role", "appliedOn")
VALUES ('019a3b6e-0000-7000-8000-000000000005', 'test1', 'Acme', 'Backend engineer', current_date - 40);
INSERT INTO "DailyApplication" ("day", "applicationId", "visits", "views")
VALUES (current_date - 31, '019a3b6e-0000-7000-8000-000000000005', 1, 1);
INSERT INTO "DailyVisits" ("day", "visits", "pageViews", "phoneVisits", "quickExits")
VALUES (current_date - 31, 1, 1, 0, 1);
INSERT INTO "DailyPage" ("day", "path", "device", "views", "visits", "exits", "notFoundViews", "blockSeconds")
VALUES (current_date - 31, '/', 'desktop', 1, 1, 1, 0, '{}');
INSERT INTO "DailySource" ("day", "source", "host", "visits") VALUES (current_date - 31, 'direct', '', 1);
INSERT INTO "DailyCountry" ("day", "country", "visits") VALUES (current_date - 31, 'AZ', 1);
INSERT INTO "DailyClick" ("day", "path", "href", "clicks") VALUES (current_date - 31, '/', 'https://github.com', 1);
INSERT INTO "AdminLoginToken" ("hash", "expiresAt") VALUES (decode('01', 'hex'), now());
INSERT INTO "AdminSession" ("hash", "expiresAt") VALUES (decode('02', 'hex'), now());
SQL

source_counts=$(counts portfolio)
empty=$(echo "$source_counts" | awk '$2 == 0 { print $1 }')
[ -z "$empty" ] || fail "the seed leaves $empty empty, so the test can't tell whether a backup keeps it"

nothing_kept='[ -z "$(find /backups/db -name "portfolio-*")" ] && [ ! -e /backups/last-success ]'

backup_fails --env PGHOST=missing.invalid
expect "a failed dump leaves no dump, no partial file and no success mark" "$nothing_kept"
expect "the health check fails before any backup has succeeded" '! backup check'

psql --dbname postgres --command 'CREATE TABLE held (id int)' --command 'BEGIN' --command 'LOCK TABLE held' \
  --command "PREPARE TRANSACTION 'held'"
status=0
backup --env PGDATABASE=postgres --env DUMP_TIMEOUT=3s > /dev/null 2>&1 || status=$?
psql --dbname postgres --command "ROLLBACK PREPARED 'held'"
[ "$status" -eq 124 ] || fail "a dump stuck behind a lock ended with $status, not the timeout's 124"
expect "a dump stuck behind a lock is given up and leaves nothing behind" "$nothing_kept"

backup > /dev/null
expect "a good backup is marked successful and its dump is readable" \
  '[ -s /backups/last-success ] && pg_restore --list /backups/db/portfolio-*.dump > /dev/null'
expect "the health check passes after a good backup" 'backup check'

dump=$(in_volume 'ls /backups/db')
psql --dbname postgres --command 'CREATE DATABASE restored'
docker run --rm --network "$name" --volume "$name:/backups" --env PGHOST="$name-postgres" --env PGUSER=postgres \
  --env PGPASSWORD=test --entrypoint pg_restore "$name" --no-owner --dbname restored "/backups/db/$dump"
expected=$(echo "$source_counts" | awk '
  $1 == "VisitorSalt" || $1 == "RateLimit" || $1 == "AdminLoginToken" || $1 == "AdminSession" { $2 = 0 }
  { print }')
restored=$(counts restored)
[ "$restored" = "$expected" ] ||
  fail "a restore should bring back every table's rows except the four left out. Expected:
$expected
Restored:
$restored"

expect "the health check fails once the last good backup is over 26 hours old" \
  'touch -d "27 hours ago" /backups/last-success && ! backup check'

in_volume 'touch -d "8 days ago" /backups/db/portfolio-old.dump && touch -d "6 days ago" /backups/db/portfolio-recent.dump'
backup_fails --env PGHOST=missing.invalid
expect "a run deletes dumps over 7 days old even when its own dump fails, and keeps newer ones" \
  '[ ! -e /backups/db/portfolio-old.dump ] && [ -e /backups/db/portfolio-recent.dump ]'

docker run --detach --name "$name-scheduler" --user 1000:1000 --volume "$name:/backups" "$name" > /dev/null
timeout 30 sh -c "until docker logs $name-scheduler 2>&1 | grep -q scheduled; do sleep 1; done" ||
  fail "the scheduler did not start within 30 seconds"
docker stop "$name-scheduler" > /dev/null
[ "$(docker inspect --format '{{.State.ExitCode}}' "$name-scheduler")" = 0 ] ||
  fail "the scheduler was killed instead of stopping on SIGTERM"

echo "backup tests passed"
