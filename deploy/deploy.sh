#!/usr/bin/env bash
#
# Pioneer Wiki — download a published release and run it with Docker.
#
#   bash deploy.sh                  installs into the current directory
#   bash deploy.sh v0.1.0           a specific tag
#   bash deploy.sh --dir /srv/wiki  another install directory
#   bash deploy.sh --no-start       download and load only
#
# Needs docker plus curl or wget. Downloads the image archive, the compose file
# and the `default.env.example` template from the GitHub release into the install
# directory — the one the script is run from unless --dir or PIONEER_DIR says
# otherwise — loads the image into the local daemon and starts the service. The
# existing `.env` is never overwritten, and the archive is left in place, so the
# files the manual steps in DEPLOY.txt use are the files this script fetched.

set -euo pipefail

REPO="${PIONEER_REPO:-NEUP-Net-Depart/pioneer-wiki}"
DIR="${PIONEER_DIR:-$PWD}"
TAG=""
START=1

usage() {
  cat <<'EOF'
usage: deploy.sh [TAG] [--dir PATH] [--no-start]

  TAG             release tag to install (default: the newest release)
  --dir PATH      install directory (default: the current directory)
  --no-start      download and load the image, but do not start the service

Environment overrides:
  PIONEER_REPO    owner/name to fetch the release from
                  (default: NEUP-Net-Depart/pioneer-wiki)
  PIONEER_DIR     same as --dir
EOF
}

die() { printf 'error: %s\n' "$*" >&2; exit 1; }
say() { printf '%s\n' "$*"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --dir) [ $# -ge 2 ] || die "--dir needs a path"; DIR="$2"; shift 2 ;;
    --no-start) START=0; shift ;;
    -h|--help) usage; exit 0 ;;
    -*) die "unknown option: $1" ;;
    *) [ -z "$TAG" ] || die "only one tag can be given"; TAG="$1"; shift ;;
  esac
done

command -v docker >/dev/null 2>&1 || die "docker is not installed"
docker info >/dev/null 2>&1 || die "cannot reach the Docker daemon — run with sudo, or add this user to the docker group"

case "$(uname -m)" in
  x86_64 | amd64) ;;
  *) die "these releases are built for x86_64; this host reports $(uname -m)" ;;
esac

if command -v curl >/dev/null 2>&1; then
  FETCHER=curl
elif command -v wget >/dev/null 2>&1; then
  FETCHER=wget
else
  die "need curl or wget to download the release"
fi

fetch() { # fetch URL DEST
  if [ "$FETCHER" = curl ]; then
    curl -fL --retry 3 --connect-timeout 15 -o "$2" "$1"
  else
    wget -q -O "$2" "$1"
  fi
}

if [ -n "$TAG" ]; then
  BASE="https://github.com/$REPO/releases/download/$TAG"
else
  BASE="https://github.com/$REPO/releases/latest/download"
  # Read the tag out of the redirect so the install can record what it installed.
  if [ "$FETCHER" = curl ]; then
    RESOLVED="$(curl -fsIL -o /dev/null -w '%{url_effective}' "https://github.com/$REPO/releases/latest" 2>/dev/null | sed 's|.*/||' || true)"
    if [ -n "$RESOLVED" ]; then TAG="$RESOLVED"; fi
  fi
fi

mkdir -p "$DIR"
ARCHIVE="$DIR/pioneer-wiki-linux-amd64.tar.gz"

say "→ installing into $DIR"
say "→ downloading ${TAG:-the newest release} from $REPO"

# The one file a human must fill in is handled first, so a fresh install stops
# here instead of pulling a few hundred megabytes before saying so. The template
# is saved locally as .env.example, kept beside .env as a reference; a release
# published before the template was attached to it leaves TEMPLATE empty.
TEMPLATE=""
ENV_FILE="$DIR/.env"
# GitHub normalizes leading-dot asset names; prefer the explicit published name
# and accept the old name for releases uploaded by other tooling.
if fetch "$BASE/default.env.example" "$DIR/.env.example.part" ||
   fetch "$BASE/.env.example" "$DIR/.env.example.part"; then
  mv "$DIR/.env.example.part" "$DIR/.env.example"
  TEMPLATE="$DIR/.env.example"
fi

# .env holds the only values a human must provide, so it is never overwritten.
if [ ! -f "$ENV_FILE" ]; then
  if [ -n "$TEMPLATE" ]; then
    cp "$TEMPLATE" "$ENV_FILE"
  else
    cat > "$ENV_FILE" <<'EOF'
# From the Supabase project settings. The anon key is public by design; the
# service-role key belongs in no file here.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
EOF
  fi
  chmod 600 "$ENV_FILE"
  say ""
  say "Stopped before starting: wrote $ENV_FILE for you to fill in."
  say "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then run"
  say "this script again. The rest of the file is optional."
  say "If the project has no schema yet, apply supabase/migrations (in the"
  say "release's source archive) in the Supabase SQL editor first, with the site"
  say "URL and https://<domain>/auth/callback allowed as redirect targets."
  exit 1
fi

# Reads a value the way docker compose reads .env: the last assignment wins, and
# a UTF-8 BOM, CRLF line endings, indentation or spaces around the `=` are all
# tolerated — a file written on Windows and copied over is otherwise valid. Only
# uncommented lines count.
env_value() { # env_value VAR
  tr -d '\357\273\277\r' < "$ENV_FILE" |
    sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*//p" |
    tail -n 1 |
    sed 's/[[:space:]]*$//'
}
env_keys() { # env_keys — the names this file assigns to
  tr -d '\357\273\277\r' < "$ENV_FILE" |
    sed -n 's/^[[:space:]]*\([A-Za-z_][A-Za-z0-9_]*\)[[:space:]]*=.*/\1/p' |
    paste -sd ' ' -
}

# A PowerShell redirect writes UTF-16, so the file reads as one long line of NUL
# separated characters and every name in it looks absent. Docker cannot read such
# a file either, so say what is wrong instead of blaming the values.
if [ "$(LC_ALL=C tr -d -c '\000' < "$ENV_FILE" | wc -c)" -gt 0 ]; then
  die "$ENV_FILE contains NUL bytes, so it is probably UTF-16 — save it as UTF-8 and run this again"
fi

require_real() { # require_real VAR
  local value keys
  value="$(env_value "$1")"
  if [ -z "$value" ]; then
    keys="$(env_keys)"
    case " $keys " in
      *" $1 "*) die "$ENV_FILE sets $1 to an empty value — put the project's value after the =" ;;
    esac
    # A full-width `＝` from an IME reads as a perfectly good line to the eye and
    # as neither a name nor an assignment to everything else, docker compose
    # included.
    if grep -qE "^[[:space:]]*$1" "$ENV_FILE"; then
      die "$ENV_FILE has a line starting with $1 that is not NAME=value — check the separator for a full-width = or a stray character"
    fi
    if [ -z "$keys" ]; then
      die "$ENV_FILE gives no $1, and no uncommented NAME=value line at all"
    fi
    die "$ENV_FILE gives no $1 — this file sets: $keys"
  fi
  # Every placeholder in .env.example is written with a `your-` host, so a value
  # that still contains one was copied across without being filled in. Starting
  # with it fails worse than stopping: the container comes up healthy and the
  # site fails against a project that does not exist.
  case "$value" in
    *your-*) die "$ENV_FILE still holds the $1 placeholder from .env.example" ;;
  esac
}
require_real NEXT_PUBLIC_SUPABASE_URL
require_real NEXT_PUBLIC_SUPABASE_ANON_KEY

say "→ downloading the image"
# Each file lands under its release name, staged as .part first so an interrupted
# download is never mistaken for a complete file.
fetch "$BASE/pioneer-wiki-linux-amd64.tar.gz" "$ARCHIVE.part" ||
  die "could not download the image from $REPO — check the tag and that the release finished building, or set PIONEER_REPO to the repository that publishes the releases"
mv "$ARCHIVE.part" "$ARCHIVE"

fetch "$BASE/docker-compose.yml" "$DIR/docker-compose.yml.part" ||
  die "could not download docker-compose.yml"
# Replace the compose file, keeping the previous copy if it changed.
if [ -f "$DIR/docker-compose.yml" ] && ! cmp -s "$DIR/docker-compose.yml.part" "$DIR/docker-compose.yml"; then
  cp "$DIR/docker-compose.yml" "$DIR/docker-compose.yml.prev"
  say "→ docker-compose.yml changed; the previous file is kept as docker-compose.yml.prev"
fi
mv "$DIR/docker-compose.yml.part" "$DIR/docker-compose.yml"

if fetch "$BASE/DEPLOY.txt" "$DIR/DEPLOY.txt.part"; then
  mv "$DIR/DEPLOY.txt.part" "$DIR/DEPLOY.txt"
fi

say "→ loading the image"
LOADED="$(gzip -dc "$ARCHIVE" | docker load 2>&1)" || die "docker load failed"
printf '%s\n' "$LOADED" | sed 's/^/  /'

printf '%s installed %s\n' "${TAG:-unknown}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$DIR/.pioneer-version"

if [ "$START" = 1 ]; then
  say "→ starting the service"
  (cd "$DIR" && docker compose up -d)
  (cd "$DIR" && docker compose ps)
else
  say "→ --no-start given; start it later with: cd $DIR && docker compose up -d"
fi

say ""
say "Caddy still needs this once (then reload it):"
say "    ${PIONEER_DOMAIN:-wiki.example.com} {"
say "        encode zstd gzip"
say "        reverse_proxy 127.0.0.1:3000"
say "    }"
say ""
say "Updating: run this script again. Rolling back: every release stays on disk as"
say "pioneer-wiki:<tag> — put PIONEER_IMAGE=pioneer-wiki:<tag> in $DIR/.env and run"
say "docker compose up -d there."
