# Autoflow Development Setup

Welcome to Autoflow! This guide will help you set up your development environment.

## Quick Start (Recommended)

For new developers starting from scratch:

```bash
git clone <repository-url>
cd autoflow
make setup
```

That's it! The setup script will guide you through the installation process.

## What Gets Installed?

The setup process installs everything you need:

1. **Nix Package Manager** - Ensures everyone has the exact same development tools
2. **direnv** - Automatically loads the development environment when you enter the project
3. **Development Tools** (via Nix):
   - bun (JavaScript runtime & package manager)
   - make (build automation)
   - PostgreSQL 16 client (database CLI)
   - Redis CLI (cache CLI)
   - Docker client
   - Git
4. **Git Hooks** - Pre-push hooks for code quality
5. **JavaScript Dependencies** - All npm packages via bun

## Detailed Setup Steps

### 1. Install Nix (One-time, System-wide)

Nix is a package manager that ensures everyone has the same development environment.

```bash
./scripts/setup/install-nix.sh
```

Or run it automatically via:

```bash
make setup
```

The script will ask you to choose an installation method:

**Method 1: Determinate Nix Installer (Recommended)**
- User-friendly experience with better support
- Automatically enables flakes (required for this project)
- Easy uninstall: `/nix/nix-installer uninstall`
- Command: `curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install`

**Method 2: Official Nix Installer**
- Standard multi-user installation from nixos.org
- On Linux: `curl -L https://nixos.org/nix/install | sh -s -- --daemon`
- On macOS: `curl -L https://nixos.org/nix/install | sh`

**What does Nix do?**
- Installs to `/nix` directory (separate from your system packages)
- No conflicts with Homebrew or other package managers
- Reproducible - everyone gets the exact same versions
- Documentation: https://nixos.org/download.html

### 2. Bootstrap the Project

After Nix is installed, set up the project:

```bash
./scripts/setup/bootstrap.sh
```

Or:

```bash
make setup
```

This will:
- ✅ Verify Nix is installed
- ✅ Install and configure direnv (automatic environment loading)
- ✅ Install git hooks (pre-push linting and type-checking)
- ✅ Install JavaScript dependencies (bun install)
- ✅ Optionally start local infrastructure (PostgreSQL, Redis)

### 3. Start Developing!

```bash
make dev          # Start API server
make dev-worker   # Start background worker
make dev-web      # Start web server
make test         # Run tests
```

## How It Works

### With direnv (Recommended)

direnv automatically loads the Nix environment when you enter the project directory:

```bash
cd autoflow
# direnv automatically loads bun, make, psql, redis-cli, etc.
make dev
```

### Without direnv

If you chose not to install direnv, manually enter the Nix shell:

```bash
cd autoflow
make shell    # Enter Nix environment
# Now you have bun, make, psql, redis-cli, etc.
make dev
```

## Running Setup Multiple Times

**It's safe to run `make setup` multiple times!**

The scripts are idempotent and will:
- ✅ Skip steps that are already complete
- ✅ Not create duplicate configurations
- ✅ Update outdated configurations
- ✅ Show what's already set up

If you're having issues, just run `make setup` again.

## Manual Setup (If Scripts Fail)

If the automated scripts fail, you can set up manually:

### 1. Install Nix Manually

**Option A: Determinate Nix Installer (Recommended)**

Visit: https://determinate.systems/posts/determinate-nix-installer

```bash
curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install
```

**Option B: Official Nix Installer**

Visit: https://nixos.org/download.html

On macOS:
```bash
curl -L https://nixos.org/nix/install | sh
```

On Linux:
```bash
curl -L https://nixos.org/nix/install | sh -s -- --daemon
```

If using the official installer, you'll need to enable flakes manually:

```bash
mkdir -p ~/.config/nix
echo "experimental-features = nix-command flakes" >> ~/.config/nix/nix.conf
```

### 2. Install direnv (Optional)

```bash
nix profile install nixpkgs#direnv
```

Add to your shell config (`~/.zshrc` or `~/.bashrc`):

```bash
eval "$(direnv hook zsh)"  # or: direnv hook bash
```

### 3. Allow direnv for this project

```bash
cd autoflow
direnv allow
```

### 4. Install dependencies

```bash
make deps
```

### 5. Start infrastructure (optional)

```bash
make infra-start
```

## Troubleshooting

### "command not found: nix"

Restart your terminal after installing Nix:

```bash
exec $SHELL
```

Or source the Nix profile:

```bash
source /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh
```

### "direnv: error .envrc is blocked"

Allow direnv for this project:

```bash
direnv allow
```

### "Docker is not running"

Start Docker Desktop or Colima:

```bash
# macOS (if using Colima instead of Docker Desktop)
colima start

# Or start Docker Desktop manually
```

### "bun: command not found" (with direnv installed)

Reload the environment:

```bash
direnv reload
```

Or restart your terminal:

```bash
exec $SHELL
cd autoflow
```

### "bun: command not found" (without direnv)

Enter the Nix shell:

```bash
make shell
```

## Uninstalling

### Remove Nix

If you need to uninstall Nix:

```bash
/nix/nix-installer uninstall
```

### Remove direnv

```bash
nix profile remove direnv
```

Remove the hook from your shell config (`~/.zshrc` or `~/.bashrc`):

```bash
# Remove this line:
eval "$(direnv hook zsh)"
```

## Platform Support

The setup scripts support:
- ✅ macOS (Intel)
- ✅ macOS (Apple Silicon)
- ✅ Linux (x86_64)
- ✅ Linux (ARM64)

## Need Help?

- **Setup issues**: Ask your team lead
- **Development questions**: Check `./docs/` directory
- **Contributing**: Read `./AGENTS.md`

## Available Commands

See all available commands:

```bash
make help
```

Common commands:

```bash
make setup              # Complete development setup
make dev                # Start API server
make dev-worker         # Start background worker  
make dev-web            # Start web server
make test               # Run tests
make lint               # Lint code
make format             # Format code
make infra-start        # Start PostgreSQL & Redis
make infra-stop         # Stop infrastructure
make shell              # Enter Nix environment (without direnv)
```

---

**Welcome to the team! 🚀**
