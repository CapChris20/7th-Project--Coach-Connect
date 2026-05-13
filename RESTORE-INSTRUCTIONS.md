# EMERGENCY RESTORE INSTRUCTIONS

If anything breaks after dead code deletion, pick ANY of these:

## FASTEST: Restore from git branch (10 seconds)
git checkout backup/full-codebase-[latest-date]
npm install
npm start

## FAST: Restore from git tag
git checkout backup/[latest-date]
npm install
npm start

## MEDIUM: Restore tar.gz archive
cd /path/to/coachconnect
rm -rf src/
tar -xzf ~/coachconnect-backup-[latest-date].tar.gz
npm install
npm start

## LAST RESORT: Revert last commit
git revert HEAD
npm install
npm start
