#!/usr/bin/env bash
# Restore drill for the off-site backup (.github/workflows/db-backup.yml).
#
# Downloads the newest "Database backup" artifact, checks it against the
# checksum in its run log, decrypts it with BACKUP_PASSPHRASE read from the
# clipboard, restores it into a throwaway database in a local Postgres 17
# container, prints counts, then deletes the plaintext and the database.
#
#   1. Paste this command into the prompt first (do not run it yet).
#   2. Copy BACKUP_PASSPHRASE from the password manager.
#   3. Run:  bash scripts/backup-restore-drill.sh [container]   (default maw3ed-qa)
#
# Windows + Git Bash (uses powershell Get-Clipboard). The passphrase is
# never printed and the clipboard is cleared as soon as it is read.
set -euo pipefail
export MSYS_NO_PATHCONV=1   # keep container paths such as /tmp as written
REPO=Amrwar/MAW3ED
CONTAINER=${1:-maw3ed-qa}
DB=restore_drill
DIR=$(cygpath -m "$(mktemp -d)")
trap 'rm -rf "$DIR"; docker exec "$CONTAINER" rm -f /tmp/drill.dump >/dev/null 2>&1 || true; docker exec "$CONTAINER" dropdb -U qa --if-exists $DB >/dev/null 2>&1 || true' EXIT

echo "1. Download the newest backup"
RUN=$(gh run list --repo $REPO --workflow db-backup.yml --status success --limit 1 --json databaseId -q '.[0].databaseId')
NAME=$(gh api repos/$REPO/actions/runs/$RUN/artifacts -q '.artifacts[0].name')
[ -n "$NAME" ] || { echo "   run $RUN has no artifact (expired?)"; exit 1; }
gh run download "$RUN" --repo $REPO -n "$NAME" -D "$DIR"
GPG=$(ls "$DIR"/*.dump.gpg)
LOGGED=$(gh run view "$RUN" --repo $REPO --log | grep -E '\.dump\.gpg$' | grep -oE '[0-9a-f]{64}' | head -1)
TABLES=$(gh run view "$RUN" --repo $REPO --log | grep 'Verify the dump reads back' | grep -oE 'Z [0-9]+$' | tail -1 | cut -d' ' -f2)
[ "$(sha256sum "$GPG" | cut -d' ' -f1)" = "$LOGGED" ] || { echo "   CHECKSUM MISMATCH"; exit 1; }
echo "   $NAME (run $RUN), checksum matches the run log"

echo "2. Decrypt (passphrase from the clipboard)"
PASS=$(powershell.exe -NoProfile -Command Get-Clipboard | tr -d '\r\n')
powershell.exe -NoProfile -Command "Set-Clipboard -Value ' '"
echo "   clipboard cleared (${#PASS} characters read)"
gpg --batch --quiet --pinentry-mode loopback --passphrase "$PASS" -o "$DIR/maw3ed.dump" -d "$GPG" 2>/dev/null \
  || { unset PASS; echo "   does not decrypt: wrong passphrase, or the clipboard held something else"; exit 1; }
unset PASS
echo "   decrypted"

echo "3. Restore into $DB ($CONTAINER)"
docker exec "$CONTAINER" dropdb -U qa --if-exists $DB
docker exec "$CONTAINER" createdb -U qa $DB
docker cp "$DIR/maw3ed.dump" "$CONTAINER":/tmp/drill.dump
rm -f "$DIR/maw3ed.dump"
set +e
docker exec "$CONTAINER" pg_restore -U qa --no-owner --no-privileges -d $DB /tmp/drill.dump 2> "$DIR/err.txt"
RC=$?
set -e
echo "   pg_restore exit $RC, $(grep -c 'error:' "$DIR/err.txt" || true) errors"
grep 'error:' "$DIR/err.txt" | head -5 || true

echo "4. Check"
q() { docker exec "$CONTAINER" psql -U qa -d $DB -tAc "$1"; }
echo "   tables with data in the dump: $TABLES; tables restored: $(q "SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')")"
for t in User Business Service Booking Payment VenueOrganization Venue; do
  echo "   $t: $(q "SELECT count(*) FROM \"$t\"" 2>/dev/null || echo missing)"
done
echo "   newest booking: $(q 'SELECT max("createdAt") FROM "Booking"')"
[ "$RC" = 0 ] && echo "PASS" || { echo "FAIL"; exit 1; }
