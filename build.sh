#!/bin/sh
# Copies src/ to dist/ and fills in the values from site.config.
# Environment variables override the config file.
set -eu

cd "$(dirname "$0")"

# Remember environment overrides, then load the config file if present.
env_site_url=${SITE_URL-}
env_contact_email=${CONTACT_EMAIL-}
env_team_url=${TEAM_MASON_URL-}
SITE_URL=
CONTACT_EMAIL=support@example.com
TEAM_MASON_URL=
if [ -f site.config ]; then
  # shellcheck disable=SC1091
  . ./site.config
fi
[ -z "$env_site_url" ] || SITE_URL=$env_site_url
[ -z "$env_contact_email" ] || CONTACT_EMAIL=$env_contact_email
[ -z "$env_team_url" ] || TEAM_MASON_URL=$env_team_url

# A value goes into sed and HTML, so keep it to plain URL / address characters.
case "$SITE_URL$CONTACT_EMAIL$TEAM_MASON_URL" in
  *[!A-Za-z0-9.@:/_+-]*) echo "build: SITE_URL, CONTACT_EMAIL and TEAM_MASON_URL may only contain A-Z a-z 0-9 . @ : / _ + -" >&2; exit 1 ;;
esac

rm -rf dist
mkdir dist
cp src/* dist/

SITE_URL=${SITE_URL%/}
if [ -z "$SITE_URL" ]; then
  sed -i.bak '/@@SITE_URL@@/d' dist/index.html
else
  sed -i.bak "s|@@SITE_URL@@|$SITE_URL|g" dist/index.html
fi
sed -i.bak "s|@@CONTACT_EMAIL@@|$CONTACT_EMAIL|g" dist/index.html
if [ -z "$TEAM_MASON_URL" ]; then
  mason_name="Mason Rhodes"
else
  mason_name="<a href=\"$TEAM_MASON_URL\">Mason Rhodes</a>"
fi
sed -i.bak "s|@@MASON_NAME@@|$mason_name|g" dist/index.html
rm dist/*.bak

# GitHub Pages reads the custom domain from this file.
if [ -n "$SITE_URL" ]; then
  host=${SITE_URL#*://}
  printf '%s\n' "${host%%/*}" > dist/CNAME
fi

echo "built dist/"
