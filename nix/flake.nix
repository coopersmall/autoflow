{
  description = "Autoflow development environment";

  inputs = {
    # Pin to nixos-unstable for latest packages
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          # Allow unfree packages if needed (e.g., some fonts, tools)
          config.allowUnfree = true;
        };
      in
      {
        devShells.default = pkgs.mkShell {
          name = "autoflow";

          packages = [
            # JavaScript Runtime & Package Manager
            pkgs.bun

            # Build Tools
            pkgs.gnumake

            # Database Tools (PostgreSQL 16 client)
            pkgs.postgresql_16

            # Cache Tools
            pkgs.redis  # Provides redis-cli

            # Version Control
            pkgs.git

            # Container Tools
            pkgs.docker-client  # Docker CLI
            pkgs.colima         # Lightweight Docker runtime for macOS/Linux
          ];

          shellHook = ''
            echo ""
            echo "Autoflow Development Environment"
            echo "================================="
            echo ""
            echo "Tools available:"
            echo "  bun:        $(bun --version)"
            echo "  make:       $(make --version | head -1)"
            echo "  psql:       $(psql --version)"
            echo "  redis-cli:  $(redis-cli --version)"
            echo "  git:        $(git --version)"
            echo "  docker:     $(docker --version 2>/dev/null || echo 'CLI ready - start Colima or Docker Desktop for daemon')"
            echo ""
            echo "Quick start:"
            echo "  make deps      # Install JS dependencies"
            echo "  make dev       # Start development server"
            echo ""
            echo "If you need Docker without Docker Desktop:"
            echo "  colima start   # Start lightweight Docker runtime"
            echo ""
          '';
        };
      }
    );
}
