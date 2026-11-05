#!/usr/bin/env bash
# Rotates BACKUP_PASSPHRASE for .github/workflows/db-backup.yml.
# Open a new password-manager entry first, then run (type it, do not paste
# it, so the clipboard is free):  bash scripts/backup-rotate-passphrase.sh
# Sets a new BACKUP_PASSPHRASE, copies it to the clipboard (never printed),
# takes a backup with it, and proves the backup opens with that exact value.
set -euo pipefail
export MSYS_NO_PATHCONV=1   # Git Bash must not rewrite the value
REPO=Amrwar/MAW3ED
P=$(openssl rand -hex 32)   # 64 characters, 0-9 and a-f only
[ ${#P} -eq 64 ] || { echo "generation failed"; exit 1; }
gh secret set BACKUP_PASSPHRASE --repo $REPO --body "$P"
printf '%s' "$P" | clip.exe
echo "1. New passphrase set on GitHub and copied to your clipboard."
echo "   Paste it into your password manager now (letters a-f and digits only)."

echo "2. Taking a backup with it (about a minute)..."
sleep 3
gh workflow run db-backup.yml --repo $REPO --ref main >/dev/null
sleep 8
ID=$(gh run list --repo $REPO --workflow db-backup.yml --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch "$ID" --repo $REPO --exit-status >/dev/null 2>&1 || { echo "   backup run $ID FAILED"; exit 1; }
NAME=$(gh api repos/$REPO/actions/runs/$ID/artifacts -q ".artifacts[0].name")
echo "   backup run $ID succeeded: $NAME"

echo "3. Checking GitHub's copy matches the one on your clipboard..."
D=$(cygpath -m "$(mktemp -d)"); trap 'rm -rf "$D"' EXIT
gh run download "$ID" --repo $REPO -n "$NAME" -D "$D" >/dev/null
if gpg --batch --quiet --pinentry-mode loopback --passphrase "$P" -o "$D/check.dump" -d "$D"/*.gpg 2>/dev/null; then rm -f "$D/check.dump"
  echo "   MATCH: the backup opens with the passphrase you were given."
else
  echo "   MISMATCH: the backup does not open with the value just set; do not rely on it."; exit 1
fi
unset P

echo "Done. Save the passphrase, then copy it back FROM the password manager and"
echo "run scripts/backup-restore-drill.sh to prove the saved copy works."
