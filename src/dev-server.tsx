import index from "./index.html";
import { createServer } from "./server";

export function createDevServer() {
  const server = createServer();

  return {
    ...server,
    routes: {
      ...server.routes,
      "/d/:id": index,
    },
  } satisfies Parameters<typeof Bun.serve>[0];
}

if (import.meta.main) {
  const server = Bun.serve(createDevServer());
  console.log(`Listening on http://${server.hostname}:${server.port}`);
}
