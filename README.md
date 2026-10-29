# Rootshed site

Static home page for the Rootshed studio. Plain HTML and CSS: no scripts, no
trackers, nothing fetched at runtime, so `dist/` can be served from anywhere.

## Build

Needs a POSIX shell and `sed`.

```sh
cp site.config.example site.config   # optional; edit the values
./build.sh
```

Output is written to `dist/`. `SITE_URL` and `CONTACT_EMAIL` can also be passed
as environment variables, which win over `site.config`.

## Preview

Serve `dist/` with any static file server, for example:

```sh
python3 -m http.server --directory dist 8000
```

## Design

See [docs/design/README.md](docs/design/README.md).
