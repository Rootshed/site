# Rootshed site

Static home page for the Rootshed studio. Plain HTML and CSS plus two small first-party scripts for the theme switch; no third-party code, no
trackers, nothing fetched at runtime, so `dist/` can be served from anywhere.

## Build

Needs a POSIX shell and `sed`.

```sh
cp site.config.example site.config   # optional; edit the values
./build.sh
```

Output is written to `dist/`. `SITE_URL` and `CONTACT_EMAIL` can also be passed
as environment variables, which win over `site.config`.

## CI

`.github/workflows/site.yml` builds on every PR and push to `main`, taking
`SITE_URL` and `CONTACT_EMAIL` from repository variables. It deploys to GitHub
Pages only when the repository variable `DEPLOY_PAGES` is `true` and Pages is
enabled for the repo.

## Preview

Serve `dist/` with any static file server, for example:

```sh
python3 -m http.server --directory dist 8000
```

## Design

See [docs/design/README.md](docs/design/README.md).
