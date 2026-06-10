#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
export TAKICO_ROOT="$DIR"
exec bash "$DIR/takico-serve.sh"
