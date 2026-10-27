# Galactic Skirmish

## A vibe coding game.

I've created this tiny game as an experiment on how far vibe coding has come. And I have to say, it's pretty incredible!

## Versioning and changelog

The game has its own release version in [version.ts](version.ts), independent of
the other apps in this repository. The title and pause screens display it as
`v0.1.0`. Both screens read the same value, which is bundled with the game.

Keep player-facing changes under **Unreleased** in [CHANGELOG.md](CHANGELOG.md)
as you work. Group entries under `Added`, `Changed`, `Fixed`, or `Removed` as
needed. Only bump the version when preparing a release, not for every commit.

Use `MAJOR.MINOR.PATCH`: patch for fixes, minor for new gameplay or content,
and major for breaking changes, such as incompatible saved data. The initial
versioned baseline is `0.1.0`; earlier work remains in Git history.

To prepare a release:

1. Update `GAME_VERSION` in [version.ts](version.ts).
2. Move the Unreleased notes into a matching `## [X.Y.Z] - YYYY-MM-DD` section
   and leave a fresh `## [Unreleased]` section at the top.
3. Run `npm run typecheck` and `npm run build` from the repository root.
4. Commit the version and changelog together. To mark the release in Git,
   optionally tag that commit with `game-vX.Y.Z`, for example `game-v0.1.0`.

Deploy the build from that commit so the displayed version matches its notes.
