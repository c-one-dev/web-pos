#!/bin/sh
# Claude Code status line: directory | git branch | model | context usage

input=$(cat)

# Current working directory
cwd=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // empty')
if [ -n "$cwd" ]; then
  dir=$(basename "$cwd")
else
  dir=""
fi

# Git branch (skip optional locks to avoid interfering with running git operations)
branch=$(git -C "$cwd" --no-optional-locks branch --show-current 2>/dev/null)

# Model display name
model=$(echo "$input" | jq -r '.model.display_name // empty')

# Context window remaining percentage (pre-calculated)
remaining=$(echo "$input" | jq -r '.context_window.remaining_percentage // empty')

# Build output
parts=""

if [ -n "$dir" ]; then
  parts="${dir}"
fi

if [ -n "$branch" ]; then
  parts="${parts} | ${branch}"
fi

if [ -n "$model" ]; then
  parts="${parts} | ${model}"
fi

if [ -n "$remaining" ]; then
  remaining_int=$(printf '%.0f' "$remaining")
  parts="${parts} | ctx: ${remaining_int}% left"
fi

printf '%s' "$parts"
