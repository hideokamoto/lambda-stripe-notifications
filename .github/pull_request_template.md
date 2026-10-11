## Summary

<!-- What changed, and why. -->

## PR title

This repo merges PRs with **squash merge**, and releases are driven by
[semantic-release](https://github.com/semantic-release/semantic-release)
reading the squashed commit on `main` — which defaults to this PR's title.
Please prefix it with a [Conventional Commits](https://www.conventionalcommits.org/) type:

| Prefix | Effect on release |
| --- | --- |
| `feat: ...` | minor release |
| `fix: ...` / `perf: ...` | patch release |
| `feat!: ...` or a `BREAKING CHANGE:` footer | major release |
| `chore:` / `ci:` / `docs:` / `test:` / `refactor:` | no release |

## Checklist

- [ ] PR title follows Conventional Commits (see table above)
- [ ] `pnpm run lint && pnpm run typecheck && pnpm run build && pnpm test` pass locally
      (`lint` auto-fixes via `biome --write` — review the resulting diff before committing)
