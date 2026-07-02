#!/bin/zsh
###############################################################################
# Common Library Checksum Generator
#
# Purpose: Calculate a checksum based on all files in the common folder.
# This allows verifying that the common folder in each plugin matches the
# source common folder.
#
# Usage:
#   ./checksum.sh                    # Calculate checksum (or auto-compare if not in source)
#   ./checksum.sh --verbose          # Show which files are included
#   ./checksum.sh --compare <hash>   # Compare with expected hash
#   ./checksum.sh --no-auto          # Disable auto-compare, just show checksum
#
# Auto-compare behavior:
#   - If running from ~/plugins/common: shows checksum
#   - If running from a plugin's common folder: automatically compares with ~/plugins/common
#
# Example:
#   # From source common folder:
#   cd ~/plugins/common
#   ./checksum.sh
#   # Output: d6ef6265da78b791e33a2c6aa9c3ceb4b57a3ce8945567c187fb6388d6e9d839
#
#   # From a plugin's common folder:
#   cd ~/plugins/ai-engine/common
#   ./checksum.sh
#   # Output: ✅ Checksum matches! Files are in sync.
###############################################################################

SCRIPT_DIR="${0:A:h}"
cd "$SCRIPT_DIR" || exit 1

VERBOSE=false
COMPARE_HASH=""
AUTO_COMPARE=true
SOURCE_COMMON="$HOME/plugins/common"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --verbose|-v)
      VERBOSE=true
      shift
      ;;
    --compare|-c)
      COMPARE_HASH="$2"
      shift 2
      ;;
    --no-auto)
      AUTO_COMPARE=false
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      echo "Usage: $0 [--verbose] [--compare <hash>] [--no-auto]" >&2
      exit 1
      ;;
  esac
done

# Directories and files to exclude from checksum
EXCLUDE_DIRS=(
  ".git"
  ".claude"
  ".*"
)

EXCLUDE_FILES=(
  "CLAUDE.md"
  "checksum.sh"
  ".gitignore"
  ".DS_Store"
  ".*"
  "*.swp"
  "*.bak"
  "*~"
)

# Build find exclusion arguments
FIND_EXCLUDE_ARGS=()

# Exclude directories
for dir in "${EXCLUDE_DIRS[@]}"; do
  FIND_EXCLUDE_ARGS+=(-path "*/$dir" -prune -o)
done

# Exclude file patterns
for pattern in "${EXCLUDE_FILES[@]}"; do
  FIND_EXCLUDE_ARGS+=(-not -name "$pattern")
done

# Find all files (not directories), sorted for consistency
FILES=($(find . "${FIND_EXCLUDE_ARGS[@]}" -type f -print | sort))

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "Error: No files found to checksum!" >&2
  exit 1
fi

if $VERBOSE; then
  echo "Files included in checksum:"
  printf '%s\n' "${FILES[@]}"
  echo ""
fi

# Calculate checksum of all file contents
# Normalize PREFIX variations before checksumming to handle customized common folders
# Using shasum (SHA-256) for reliability across systems
CHECKSUM=$(cat "${FILES[@]}" | \
  sed -E \
    -e 's/MeowKit_[A-Z][A-Z0-9_]*_/MeowKit_[PREFIX]_/g' \
    -e 's/MeowKitPro_[A-Z][A-Z0-9_]*_/MeowKitPro_[PREFIX]_/g' \
    -e 's/window\.[A-Z][A-Z0-9_]*/window.[PREFIX]/g' \
  | shasum -a 256 | cut -d' ' -f1)

# Determine if we should auto-compare
CURRENT_DIR="${SCRIPT_DIR:A}"
SOURCE_DIR="${SOURCE_COMMON:A}"
IS_SOURCE_DIR=false
[[ "$CURRENT_DIR" == "$SOURCE_DIR" ]] && IS_SOURCE_DIR=true

# Auto-compare logic: if we're not in the source dir and no explicit compare hash given
if [[ $AUTO_COMPARE == true && $IS_SOURCE_DIR == false && -z "$COMPARE_HASH" ]]; then
  if [[ -f "$SOURCE_COMMON/checksum.sh" ]]; then
    # Get the source checksum
    SOURCE_HASH=$("$SOURCE_COMMON/checksum.sh" --no-auto)
    COMPARE_HASH="$SOURCE_HASH"
  else
    echo "⚠️  Warning: Source common folder not found at $SOURCE_COMMON" >&2
    echo "Showing checksum only." >&2
    echo ""
  fi
fi

if [[ -n "$COMPARE_HASH" ]]; then
  # Compare mode
  if [[ "$CHECKSUM" == "$COMPARE_HASH" ]]; then
    echo "✅ Checksum matches! Files are in sync with source."
    $VERBOSE && echo "   ($CHECKSUM)"
    exit 0
  else
    echo "❌ Checksum mismatch! Files are NOT in sync with source."
    echo ""
    echo "Expected (source): $COMPARE_HASH"
    echo "Actual (plugin):   $CHECKSUM"

    # Show diff if we're comparing with source
    if [[ $AUTO_COMPARE == true && $IS_SOURCE_DIR == false && -d "$SOURCE_COMMON" ]]; then
      echo ""
      echo "Differences:"

      # Get file lists from both directories
      PLUGIN_FILES=($(find . "${FIND_EXCLUDE_ARGS[@]}" -type f -print | sort))
      SOURCE_FILES=($(cd "$SOURCE_COMMON" && find . "${FIND_EXCLUDE_ARGS[@]}" -type f -print | sort))

      # Convert arrays to associative arrays for easier lookup
      typeset -A plugin_files_map
      typeset -A source_files_map

      for file in "${PLUGIN_FILES[@]}"; do
        plugin_files_map[$file]=1
      done

      for file in "${SOURCE_FILES[@]}"; do
        source_files_map[$file]=1
      done

      # Track if any differences were found
      FOUND_DIFF=false

      # Check for missing files (in source but not in plugin)
      for file in "${SOURCE_FILES[@]}"; do
        if [[ -z "${plugin_files_map[$file]}" ]]; then
          echo "  - Missing:  $file"
          FOUND_DIFF=true
        fi
      done

      # Check for extra files (in plugin but not in source)
      for file in "${PLUGIN_FILES[@]}"; do
        if [[ -z "${source_files_map[$file]}" ]]; then
          echo "  + Extra:    $file"
          FOUND_DIFF=true
        fi
      done

      # Check for modified files (different content)
      for file in "${PLUGIN_FILES[@]}"; do
        if [[ -n "${source_files_map[$file]}" ]]; then
          # Both files exist, compare content
          if ! cmp -s "$file" "$SOURCE_COMMON/$file"; then
            echo "  ~ Modified: $file"
            FOUND_DIFF=true
          fi
        fi
      done

      if [[ $FOUND_DIFF == false ]]; then
        echo "  (No file-level differences detected - files may have different line endings or permissions)"
      fi
    fi

    exit 1
  fi
else
  # Normal mode - just output the checksum
  if $IS_SOURCE_DIR; then
    $VERBOSE && echo "Source common folder checksum:"
  fi

  echo "$CHECKSUM"

  if $VERBOSE; then
    echo ""
    echo "Total files: ${#FILES[@]}"
  fi
fi
