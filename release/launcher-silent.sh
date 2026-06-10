#!/bin/bash
# Dự phòng — gọi chung takico-serve.sh (giữ Terminal mở nếu chạy từ .command)
DIR="$(cd "$(dirname "$0")" && pwd)"
export TAKICO_ROOT="$DIR"
exec bash "$DIR/takico-serve.sh"
