# clawfile

Brewfile-style skill management for OpenClaw/ClawHub.

## Prerequisite

`clawfile` shells out to the ClawHub CLI, so `clawhub` must be installed.

If missing, `clawfile` will prompt to install it automatically:

```txt
`clawhub` is missing. Install now with `npm i -g clawhub`? [Y/n]
```

Manual install:

```bash
npm i -g clawhub
```

Skill install primitives used under the hood:

```bash
clawhub install <skill-slug>
clawhub install <skill-slug> --version <version>
```

## Install (local dev)

```bash
npm i
npm link
```

Then use:

```bash
clawfile --help
```

## Clawfile format

```txt
registry https://clawhub.com
workdir /Users/you/.openclaw/workspace

weather
apple-reminders
github
telegram@1.0.0
```

- `skill` => latest
- `skill@x.y.z` => pinned version

## Commands

```bash
clawfile sync Clawfile
clawfile install Clawfile
clawfile update Clawfile
```

## Flags

- `--lock <path>`: lockfile path (default: `Clawfile.lock`)
- `--dry-run`: print actions only
- `--strict`: stop on first failure
- `--continue-on-error`: continue and report failures at end
- `--refresh-lock`: ignore existing lock pins during install
- `--force`: pass through force reinstall/update to clawhub (`--force`)

## Notes

- Requires `clawhub` CLI on PATH.
- `workdir` supports `~` only at the start (e.g. `~/.openclaw/workspace`) and will fail fast on unresolved `~` segments to avoid accidental nested install paths.
- Writes lockfile after non-dry runs.
