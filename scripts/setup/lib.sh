#!/bin/bash
# Shared utility functions for Autoflow setup scripts

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
RESET='\033[0m'

# Print functions
info() {
    echo -e "${BLUE}ℹ${RESET}  $*"
}

success() {
    echo -e "${GREEN}✅${RESET} $*"
}

warn() {
    echo -e "${YELLOW}⚠️${RESET}  $*"
}

error() {
    echo -e "${RED}❌${RESET} $*" >&2
}

step() {
    echo ""
    echo -e "${BOLD}$*${RESET}"
}

# Platform detection
is_macos() {
    [[ "$(uname -s)" == "Darwin" ]]
}

is_linux() {
    [[ "$(uname -s)" == "Linux" ]]
}

is_apple_silicon() {
    is_macos && [[ "$(uname -m)" == "arm64" ]]
}

# Command detection
has_command() {
    command -v "$1" >/dev/null 2>&1
}

# Nix detection
is_nix_installed() {
    has_command nix && [[ -d /nix ]]
}

is_nix_flakes_enabled() {
    if ! is_nix_installed; then
        return 1
    fi
    
    nix show-config 2>/dev/null | grep -q "experimental-features.*flakes" || \
    nix config show 2>/dev/null | grep -q "experimental-features.*flakes"
}

# direnv detection
is_direnv_installed() {
    has_command direnv
}

is_direnv_hooked() {
    local shell_config
    
    if [[ -n "${ZSH_VERSION:-}" ]] || [[ "${SHELL:-}" == *"zsh"* ]]; then
        shell_config="$HOME/.zshrc"
    elif [[ -n "${BASH_VERSION:-}" ]] || [[ "${SHELL:-}" == *"bash"* ]]; then
        shell_config="$HOME/.bashrc"
    else
        return 1
    fi
    
    [[ -f "$shell_config" ]] && grep -q "direnv hook" "$shell_config"
}

# Docker detection
is_docker_running() {
    has_command docker && docker info >/dev/null 2>&1
}

# Safety functions
require_command() {
    if ! has_command "$1"; then
        error "Required command not found: $1"
        exit 2
    fi
}

confirm() {
    local prompt="$1"
    local default="${2:-n}"
    local response
    
    if [[ "$default" == "y" ]]; then
        prompt="$prompt [Y/n] "
    else
        prompt="$prompt [y/N] "
    fi
    
    read -r -p "$prompt" response
    response=${response:-$default}
    
    [[ "$response" =~ ^[Yy] ]]
}

# Get shell config file
get_shell_config() {
    if [[ -n "${ZSH_VERSION:-}" ]] || [[ "${SHELL:-}" == *"zsh"* ]]; then
        echo "$HOME/.zshrc"
    elif [[ -n "${BASH_VERSION:-}" ]] || [[ "${SHELL:-}" == *"bash"* ]]; then
        echo "$HOME/.bashrc"
    else
        echo ""
    fi
}

# Get shell name
get_shell_name() {
    if [[ -n "${ZSH_VERSION:-}" ]] || [[ "${SHELL:-}" == *"zsh"* ]]; then
        echo "zsh"
    elif [[ -n "${BASH_VERSION:-}" ]] || [[ "${SHELL:-}" == *"bash"* ]]; then
        echo "bash"
    else
        basename "${SHELL:-bash}"
    fi
}

# Check if in Nix shell
in_nix_shell() {
    [[ -n "${IN_NIX_SHELL:-}" ]] || [[ -n "${NIX_SHELL:-}" ]]
}

# Print banner
print_banner() {
    echo ""
    echo "╔════════════════════════════════════╗"
    echo "║   $1"
    echo "╚════════════════════════════════════╝"
    echo ""
}
