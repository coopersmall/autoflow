import { createBackendServer } from '@autoflow/backend';

const PORT = 3000 as const;

function run(
  port: number,
  actions = {
    createBackendServer,
  },
) {
  const server = actions.createBackendServer();
  server.start({ port });
}

function main() {
  run(PORT);
}

main();
