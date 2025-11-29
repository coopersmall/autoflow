#!/bin/bash
set -euo pipefail

# Get the directory where this script lives
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source utility functions
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

main() {
    print_banner "Autoflow Development Setup        "
    
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # STEP 1: Check Nix installation
    check_nix
    
    # STEP 2: Install and configure direnv
    setup_direnv
    
    # STEP 3: Allow direnv for this project
    allow_direnv
    
    # STEP 4: Install git hooks
    install_git_hooks
    
    # STEP 5: Install JavaScript dependencies
    install_dependencies
    
    # STEP 6: Docker infrastructure (optional)
    setup_infrastructure
    
    # STEP 7: Success!
    show_success
}

check_nix() {
    step "STEP 1: Checking Nix installation..."
    
    if ! is_nix_installed; then
        warn "Nix is not installed"
        echo ""
        info "Nix is required for this project. Installing now..."
        echo ""
        
        # Run the install-nix.sh script
        if ! "$SCRIPT_DIR/install-nix.sh"; then
            error "Failed to install Nix"
            echo ""
            info "Please install Nix manually:"
            info "  Determinate: curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install"
            info "  Official:    curl -L https://nixos.org/nix/install | sh"
            echo ""
            exit 1
        fi
        
        # Source Nix after installation
        if [[ -f /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh ]]; then
            # shellcheck source=/dev/null
            source /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh
        fi
        
        echo ""
        success "Nix installed successfully!"
        info "Continuing with project setup..."
        echo ""
    fi
    
    local nix_version
    nix_version=$(nix --version 2>/dev/null | head -1 || echo "unknown")
    success "Nix installed: $nix_version"
    
    if ! is_nix_flakes_enabled; then
        warn "Nix flakes are not enabled"
        info "Enabling flakes..."
        enable_nix_flakes
    fi
    
    success "Nix flakes enabled"
}

enable_nix_flakes() {
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

setup_direnv() {
    step "STEP 2: Setting up direnv..."
    
    if is_direnv_installed; then
        local direnv_version
        direnv_version=$(direnv version 2>/dev/null || echo "unknown")
        success "direnv already installed: $direnv_version"
        
        # Check if shell hook exists
        if is_direnv_hooked; then
            success "direnv shell hook already configured"
        else
            add_direnv_hook
        fi
        
        return 0
    fi
    
    # Explain benefits of direnv
    info "direnv automatically loads the Nix environment when you enter this directory"
    info "Without it, you'll need to run 'make shell' manually each time"
    echo ""
    
    # Install direnv (default yes, we don't trust interns!)
    info "Installing direnv via Nix..."
    
    if ! nix profile install nixpkgs#direnv 2>/dev/null; then
        warn "Failed to install direnv via nix profile"
        info "Trying alternative method..."
        
        # Fallback: Try using nix-env
        if ! nix-env -iA nixpkgs.direnv 2>/dev/null; then
            warn "Could not install direnv automatically"
            info "You can install it manually later with: nix profile install nixpkgs#direnv"
            return 0
        fi
    fi
    
    success "direnv installed"
    
    # Add shell hook
    add_direnv_hook
}

add_direnv_hook() {
    local shell_config
    shell_config=$(get_shell_config)
    local shell_name
    shell_name=$(get_shell_name)
    
    if [[ -z "$shell_config" ]]; then
        warn "Could not detect shell config file"
        info "Please add this to your shell config manually:"
        info "  eval \"\$(direnv hook $shell_name)\""
        return 0
    fi
    
    info "Adding direnv hook to $shell_config"
    
    # Check if hook already exists
    if [[ -f "$shell_config" ]] && grep -q "direnv hook" "$shell_config"; then
        success "direnv hook already exists in $shell_config"
        return 0
    fi
    
    # Add hook
    cat >> "$shell_config" << EOF

# Autoflow: Enable direnv for automatic environment loading
eval "\$(direnv hook $shell_name)"
EOF
    
    success "direnv hook added to $shell_config"
    info "You'll need to reload your shell: exec \$SHELL"
}

allow_direnv() {
    step "STEP 3: Configuring direnv for this project..."
    
    if ! is_direnv_installed; then
        info "direnv not installed, skipping"
        warn "You'll need to run 'make shell' to enter the Nix environment"
        return 0
    fi
    
    # Check if .envrc exists
    if [[ ! -f "$PROJECT_ROOT/.envrc" ]]; then
        warn ".envrc file not found"
        return 0
    fi
    
    # Check if already allowed
    if direnv status 2>/dev/null | grep -q "Found RC allowed 1"; then
        success ".envrc already allowed"
        return 0
    fi
    
    info "Allowing .envrc for automatic environment loading..."
    
    if direnv allow . >/dev/null 2>&1; then
        success ".envrc allowed"
        info "Environment will auto-load when you enter this directory"
    else
        warn "Could not allow .envrc automatically"
        info "Run this manually: direnv allow"
    fi
}

install_git_hooks() {
    step "STEP 4: Installing git hooks..."
    
    local hook_target="$PROJECT_ROOT/.git/hooks/pre-push"
    local hook_source="$PROJECT_ROOT/scripts/git/pre-push.sh"
    
    # Check if hook already exists and is correct
    if [[ -L "$hook_target" ]]; then
        local current_target
        current_target=$(readlink "$hook_target")
        
        if [[ "$current_target" == "../../scripts/git/pre-push.sh" ]]; then
            success "Git hooks already installed"
            return 0
        else
            info "Updating git hook symlink..."
            rm "$hook_target"
        fi
    elif [[ -f "$hook_target" ]]; then
        warn "Existing pre-push hook found (not a symlink)"
        if confirm "Replace with Autoflow pre-push hook?" "y"; then
            rm "$hook_target"
        else
            warn "Keeping existing hook, skipping"
            return 0
        fi
    fi
    
    # Install hook using make
    info "Running: make install-pre-push"
    
    if make install-pre-push >/dev/null 2>&1; then
        success "Git hooks installed"
    else
        warn "Could not install git hooks automatically"
        info "Run manually: make install-pre-push"
    fi
}

install_dependencies() {
    step "STEP 5: Installing JavaScript dependencies..."
    
    # Check if we need to install dependencies
    local needs_install=false
    
    if [[ ! -d "$PROJECT_ROOT/node_modules" ]]; then
        needs_install=true
        info "node_modules not found, installing..."
    elif [[ "$PROJECT_ROOT/bun.lock" -nt "$PROJECT_ROOT/node_modules" ]]; then
        needs_install=true
        info "bun.lock is newer than node_modules, updating..."
    else
        success "Dependencies already up to date"
        return 0
    fi
    
    if [[ "$needs_install" == "true" ]]; then
        info "Running: bun install"
        echo ""
        
        if bun install; then
            echo ""
            success "Dependencies installed"
        else
            warn "Failed to install dependencies"
            info "You may need to run 'bun install' manually"
        fi
    fi
}

setup_infrastructure() {
    step "STEP 6: Setting up local infrastructure..."
    
    # Check if Docker is running
    if ! is_docker_running; then
        warn "Docker is not running"
        info "Local infrastructure (PostgreSQL, Redis) requires Docker"
        info "You can start it later with: make infra-start"
        return 0
    fi
    
    success "Docker is running"
    
    # Check if infrastructure is already running
    if docker compose -f "$PROJECT_ROOT/packages/backend/docker-compose.yml" ps 2>/dev/null | grep -q "Up"; then
        success "Infrastructure already running"
        return 0
    fi
    
    # Ask if user wants to start infrastructure
    echo ""
    info "Local infrastructure includes:"
    info "  • PostgreSQL (database)"
    info "  • Redis (cache & queue)"
    echo ""
    
    if confirm "Start local infrastructure?" "n"; then
        info "Running: make infra-start"
        echo ""
        
        if make infra-start; then
            echo ""
            success "Infrastructure started"
            info "PostgreSQL: localhost:5432"
            info "Redis: localhost:6379"
        else
            warn "Failed to start infrastructure"
            info "You can start it later with: make infra-start"
        fi
    else
        info "Skipping infrastructure setup"
        info "You can start it later with: make infra-start"
    fi
}

show_success() {
    echo ""
    print_banner "Setup Complete! 🎉                "
    
    success "Nix installed and configured"
    if is_direnv_installed; then
        success "direnv installed and configured"
    fi
    success "Git hooks installed"
    success "Dependencies installed"
    
    if is_docker_running && docker compose -f "$PROJECT_ROOT/packages/backend/docker-compose.yml" ps 2>/dev/null | grep -q "Up"; then
        success "Infrastructure running"
    fi
    
    echo ""
    step "📚 Next steps:"
    echo ""
    
    if is_direnv_installed && ! is_direnv_hooked; then
        info "1. Reload your shell:"
        info "   exec \$SHELL"
        echo ""
        info "2. Return to this directory (direnv will auto-load):"
        info "   cd $PROJECT_ROOT"
        echo ""
    elif ! is_direnv_installed; then
        info "1. Enter the Nix environment:"
        info "   make shell"
        echo ""
    fi
    
    info "Start development:"
    info "  make dev          # Start API server"
    info "  make dev-worker   # Start background worker"
    info "  make dev-web      # Start web server"
    echo ""
    
    info "Run tests:"
    info "  make test"
    echo ""
    
    info "See all commands:"
    info "  make help"
    echo ""
    
    step "📖 Documentation:"
    info "  ./docs/           # Architecture docs"
    info "  ./AGENTS.md       # Contributing guide"
    echo ""
    
    step "Need help?"
    info "  Ask your team lead!"
    echo ""
}

# Run main function
main "$@"
