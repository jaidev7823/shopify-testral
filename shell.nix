
{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  # ... packages, including prisma-engines and nodejs ...
  shellHook = ''
    export PRISMA_SCHEMA_ENGINE_BINARY="${pkgs.prisma-engines}/bin/schema-engine"
  '';
}
