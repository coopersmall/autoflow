#!/bin/bash
# Autoflow Nix Package Manager Installer
# 
# This script installs the Nix package manager using one of two methods:
# 1. Determinate Systems Installer (recommended) - https://install.determinate.systems/nix
# 2. Official Nix Installer - https://nixos.org/download.html
#
# The script is idempotent - safe to run multiple times.
# If Nix is already installed, it will verify the installation and enable flakes if needed.

set -euo pipefail

# Get the directory where this script lives
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source utility functions
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

main() {
    print_banner "Nix Package Manager Setup        "
    
    # Check if Nix is already installed
    if is_nix_installed; then
        local nix_version
        nix_version=$(nix --version 2>/dev/null | head -1 || echo "unknown")
        success "Nix is already installed: $nix_version"
        
        # Check if flakes are enabled
        if is_nix_flakes_enabled; then
            success "Nix flakes are enabled"
        else
            warn "Nix flakes are NOT enabled"
            info "Flakes are required for this project"
            
            if confirm "Enable Nix flakes now?" "y"; then
                enable_flakes
            else
                error "Flakes are required. Please enable them manually."
                exit 1
            fi
        fi
        
        echo ""
        success "Nix is ready to use!"
        return 0
    fi
    
    # Detect platform
    step "Detecting platform..."
    if is_macos; then
        if is_apple_silicon; then
            info "Platform: macOS (Apple Silicon)"
        else
            info "Platform: macOS (Intel)"
        fi
    elif is_linux; then
        info "Platform: Linux"
    else
        error "Unsupported platform: $(uname -s)"
        error "This script only supports macOS and Linux"
        exit 3
    fi
    
    # Explain what will be installed
    echo ""
    step "What is Nix?"
    info "Nix is a package manager that provides:"
    info "  • Reproducible development environments"
    info "  • Exact same tool versions for all developers"
    info "  • No conflicts with system packages"
    info ""
    info "Nix will install to: /nix (requires sudo)"
    info "All development tools will be managed by Nix"
    echo ""
    
    step "Installation Methods:"
    echo ""
    info "Method 1: Determinate Nix Installer (Recommended)"
    info "  • User-friendly experience"
    info "  • Better support for macOS and WSL"
    info "  • Enables flakes by default"
    info "  • Easy uninstall capability"
    echo ""
    info "Method 2: Official Nix Installer"
    info "  • Standard multi-user installation"
    info "  • Official nixos.org installer"
    echo ""
    info "Documentation: https://nixos.org/download.html"
    echo ""
    
    # Ask which method
    echo "Which installation method would you like to use?"
    echo "  1) Determinate Nix Installer (recommended)"
    echo "  2) Official Nix Installer"
    echo "  3) Cancel"
    echo ""
    read -r -p "Enter choice [1-3]: " choice
    
    case "$choice" in
        1)
            info "Using Determinate Nix Installer"
            INSTALL_METHOD="determinate"
            ;;
        2)
            info "Using Official Nix Installer"
            INSTALL_METHOD="official"
            ;;
        3|*)
            warn "Installation cancelled by user"
            exit 1
            ;;
    esac
    
    # Install Nix
    echo ""
    step "Installing Nix..."
    info "This may take a few minutes..."
    echo ""
    
    if ! install_nix "$INSTALL_METHOD"; then
        error "Nix installation failed"
        error "Please check the error messages above"
        echo ""
        info "For manual installation, visit:"
        info "  https://nixos.org/download.html"
        exit 2
    fi
    
    # Verify installation
    step "Verifying installation..."
    
    # Source Nix
    if [[ -f /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh ]]; then
        # shellcheck source=/dev/null
        source /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh
    fi
    
    if ! is_nix_installed; then
        error "Nix installation verification failed"
        error "Nix command not found after installation"
        exit 2
    fi
    
    local nix_version
    nix_version=$(nix --version 2>/dev/null | head -1 || echo "unknown")
    success "Nix installed successfully: $nix_version"
    
    if is_nix_flakes_enabled; then
        success "Nix flakes are enabled"
    else
        warn "Nix flakes not enabled (should be automatic)"
    fi
    
    # Show next steps
    echo ""
    print_banner "Installation Complete! 🎉         "
    success "Nix is ready to use!"
    echo ""
    info "Next steps:"
    info "  1. Restart your terminal (or run: exec \$SHELL)"
    info "  2. Run: ./scripts/setup/bootstrap.sh"
    info "     Or:  make setup"
    echo ""
}

install_nix() {
    local method="${1:-determinate}"
    
    if [[ "$method" == "determinate" ]]; then
        install_nix_determinate
    else
        install_nix_official
    fi
}

install_nix_determinate() {
    local installer_url="https://install.determinate.systems/nix"
    
    info "Downloading from: $installer_url"
    echo ""
    
    # Download and run the Determinate Systems installer
    # This installer:
    # - Enables flakes by default
    # - Provides better macOS and WSL support
    # - Has an easy uninstall command
    if ! curl --proto '=https' --tlsv1.2 -sSf -L "$installer_url" | sh -s -- install; then
        return 1
    fi
    
    return 0
}

install_nix_official() {
    local installer_url="https://nixos.org/nix/install"
    
    info "Downloading from: $installer_url"
    echo ""
    
    # Download and run the official Nix installer
    # Use --daemon for multi-user installation (recommended)
    if is_macos; then
        # On macOS, the installer automatically uses multi-user mode
        if ! curl -L "$installer_url" | sh; then
            return 1
        fi
    elif is_linux; then
        # On Linux, explicitly use --daemon for multi-user mode
        if ! curl -L "$installer_url" | sh -s -- --daemon; then
            return 1
        fi
    fi
    
    # The official installer doesn't enable flakes by default
    # We'll need to enable them manually
    warn "Flakes are not enabled by default with the official installer"
    enable_flakes
    
    return 0
}

enable_flakes() {
    info "Enabling Nix flakes..."
    
    # Create nix config directory if it doesn't exist
    mkdir -p ~/.config/nix
    
    # Check if config already has flakes enabled
    if [[ -f ~/.config/nix/nix.conf ]] && grep -q "experimental-features.*flakes" ~/.config/nix/nix.conf; then
        success "Flakes already enabled in config"
        return 0
    fi
    
    # Add flakes configuration
    cat >> ~/.config/nix/nix.conf << EOF
# Autoflow: Enable flakes and nix-command
experimental-features = nix-command flakes
EOF
    
    success "Flakes enabled in ~/.config/nix/nix.conf"
}

# Run main function
main "$@"
