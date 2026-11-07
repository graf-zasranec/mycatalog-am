#!/bin/bash
# The nightly crawl on the owner's Mac: prices and stock in one run, no row limit, more shops at once.
# OFF until tools/mac-crawler-install.sh is run. It refuses to start away from an Armenian IP, because
# shops refuse foreign traffic there is no point crawling through.
# Runs in its own clone: Codex and Claude edit the main checkout, and a crawl there would collide.
set -u
JOBS="$HOME/Movies/Claude code/better-jobs"
DIR="$JOBS/crawler"; REPO="$DIR/repo"; LOG="$DIR/refresh.log"; LOCK="$DIR/lock"
SLUG=graf-zasranec/mycatalog-am
export PATH="$JOBS/py312/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
mkdir -p "$DIR"; exec >>"$LOG" 2>&1
echo "=== $(date) ==="
[ "$(curl -s -m 10 https://ipinfo.io/country)" = AM ] || { echo "Not on an Armenian IP; GitHub crawls instead."; exit 0; }
mkdir "$LOCK" 2>/dev/null || { echo "Another Mac crawl is running."; exit 0; }
trap 'rmdir "$LOCK"' EXIT
[ -z "$(gh run list --repo "$SLUG" --workflow deploy.yml --status in_progress --json databaseId -q '.[0].databaseId')" ] \
  || { echo "GitHub is crawling; leaving this slot to it."; exit 0; }
gh variable set MAC_CRAWLER_AT --repo "$SLUG" --body "$(date +%s)"
git config --global --get-regexp '^credential\.https://github\.com' >/dev/null || gh auth setup-git
[ -d "$REPO/.git" ] || git clone --depth 50 --branch main "https://github.com/$SLUG.git" "$REPO" || exit 1
cd "$REPO" || exit 1
git fetch --depth 50 origin main && git reset -q --hard origin/main || exit 1
[ -d node_modules ] && [ node_modules -nt package-lock.json ] || npm ci --ignore-scripts || exit 1
export SCRAPE_LANES=8 BETTER_PYTHON="$JOBS/py312/bin/python" PYTHONUTF8=1
caffeinate -i -s node tools/refresh.mjs || { echo "Refresh failed; nothing published."; exit 1; }
# Publish with the very steps GitHub uses, so the two can never drift apart.
node -e "
const s=require('fs').readFileSync('.github/workflows/deploy.yml','utf8');
const m=s.match(/- name: Commit refreshed prices and history\n\s+run: \|\n([\s\S]*?)\n\n\s+- name:/);
if(!m)process.exit(1);process.stdout.write(m[1].replace(/^ {10}/gm,'').replace('prices: \$(date','mac refresh: \$(date'));
" > "$DIR/publish.sh" || { echo "Could not read the publish step."; exit 1; }
bash -e "$DIR/publish.sh" && echo "Published." || echo "Publish failed."
