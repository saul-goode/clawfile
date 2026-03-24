# clawfile

[![npm version](https://img.shields.io/npm/v/clawfile.svg)](https://www.npmjs.com/package/clawfile)
[![CI](https://github.com/saul-goode/clawfile/actions/workflows/ci.yml/badge.svg)](https://github.com/saul-goode/clawfile/actions/workflows/ci.yml)

Brewfile-style skill management for OpenClaw + ClawHub.

## Install

```bash
npm i -g clawfile
```

## Getting started in 60 seconds

1. Create a `Clawfile`:

```txt
registry https://clawhub.ai
workdir ~/.openclaw/workspace

weather
apple-reminders
github
https://clawhub.ai/ivangdavila/self-improving
```

2. Preview actions:

```bash
clawfile install Clawfile --dry-run
```

3. Apply:

```bash
clawfile install Clawfile
```

That’s it. `Clawfile.lock` is written automatically after non-dry runs.

## Prerequisite (`clawhub`)

`clawfile` shells out to the ClawHub CLI.

If `clawhub` is missing, `clawfile` prompts to install:

```txt
`clawhub` is missing. Install now with `npm i -g clawhub`? [Y/n]
```

Manual install:

```bash
npm i -g clawhub
```

Under the hood:

```bash
clawhub install <skill-slug>
clawhub install <skill-slug> --version <version>
```

## Clawfile format

```txt
registry https://clawhub.ai
workdir ~/.openclaw/workspace

weather
telegram@1.0.0
ivangdavila/self-improving
https://clawhub.ai/ivangdavila/self-improving
```

- `skill` => latest
- `skill@x.y.z` => pinned version
- `owner/skill` and full ClawHub URLs are supported

## Commands

```bash
clawfile sync Clawfile
clawfile install Clawfile
clawfile update Clawfile
```

`update` mode is smart:
- local installed version from `clawhub list`
- remote latest version from `clawhub inspect <slug>`
- skills already on latest are skipped automatically

## Flags

- `--lock <path>`: lockfile path (default: `Clawfile.lock`)
- `--dry-run`: print actions only
- `--strict`: stop on first failure
- `--continue-on-error`: continue and report failures at end
- `--refresh-lock`: ignore existing lock pins during install
- `--force`: pass through force reinstall/update to clawhub (`--force`)

## Notes

- `workdir` supports `~` only at the start (e.g. `~/.openclaw/workspace`)
- unresolved `~` segments fail fast to prevent accidental nested installs
- lockfile is written after non-dry runs
