# Releasing clawfile

## v0.1.0 checklist

- [ ] Confirm CLI commands work locally (`sync/install/update`)
- [ ] Run tests (`npm test`)
- [ ] Dry-run sample (`clawfile install Clawfile.example --dry-run`)
- [ ] Verify lockfile behavior (`Clawfile.lock` written + skips matching versions)
- [ ] Commit changelog updates
- [ ] Tag/version bump (`npm version 0.1.0`)
- [ ] Push tags (`git push --follow-tags`)
- [ ] Publish to npm (`npm publish --access public`) or via workflow
- [ ] Verify install from npm (`npm i -g clawfile`)

## Notes

- For GitHub Actions publish: set `NPM_TOKEN` repo secret.
- If package name `clawfile` is taken, rename in `package.json` before publish.
