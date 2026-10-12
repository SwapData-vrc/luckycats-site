# Lucky Cats · 20850C

Website for VEX V5RC team **20850C, Lucky Cats** (AOE Robotics Club, Rockville, MD).
Static HTML, CSS and JS with no build step, deployed to GitHub Pages.

## Run it locally

```sh
python -m http.server 4520
# open http://127.0.0.1:4520
```

Opening `index.html` directly from disk also works, because the data loads as a plain script.

## Where the numbers come from

Results come from the VEX events API (`https://events.vex.com/api/v2`, formerly RobotEvents).
Team id `187139`. Seasons `197` (Push Back 2025–26) and `204` (Override 2026–27).

```
scripts/sync.mjs            fetches /teams/187139/{events,awards,rankings,skills,matches}?season[]=ID
data/snapshot.compact.json  the trimmed API response (build input, committed)
data/extras.json            hand-kept: short event names, notes, match videos
data/team.js / team.json    what the page renders (generated, do not edit)
```

```sh
ROBOTEVENTS_TOKEN=... node scripts/sync.mjs    # fetch fresh results, then build
node scripts/sync.mjs --offline                # rebuild from the snapshot (after editing extras.json)
```

Where the official ranking record and the posted match scores disagree (a DQ or a score
correction), the ranking record is used for the season totals and the event shows a note.

## Deploying

1. Push this folder to a GitHub repo on `main`.
2. **Settings → Pages → Source: GitHub Actions.**
3. Create an API token at events.vex.com/api/v2, then add it as a repository secret named
   **`ROBOTEVENTS_TOKEN`** (Settings → Secrets and variables → Actions).

`.github/workflows/deploy.yml` runs on every push, nightly, and on demand from the Actions tab.
It syncs, commits `data/` if anything changed, and deploys. Without the secret, or if the
API is down, it deploys the committed data and leaves a warning on the run.

GitHub pauses scheduled workflows after 60 days with no repository activity. If results stop
updating in the off-season, re-enable the workflow from the Actions tab.

## Adding a match video

Add an entry to `videos` in `data/extras.json`. `event` is the events.vex.com event id, and
`match` is `round-instance-matchnum`: rounds are 2 qualification, 6 round of 16, 3 quarterfinal,
4 semifinal and 5 final. For example, the State final's first match is `5-1-1`. Then run
`node scripts/sync.mjs --offline`. The video shows up in the Videos section and as a
"Watch" link in that event's match list.
