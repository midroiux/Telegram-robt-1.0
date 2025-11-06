#!/usr/bin/env bash

set -e

export NODE_OPTIONS="--max-old-space-size=4096"

exec mastra build
