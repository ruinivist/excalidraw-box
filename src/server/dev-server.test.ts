import { describe, expect, test } from "bun:test";
import { createDevServer } from "./dev-server";

describe("createDevServer", () => {
  test("serves the spa for private and public drawing routes", () => {
    const server = createDevServer();

    expect(Object.hasOwn(server.routes, "/d/:id")).toBe(true);
    expect(Object.hasOwn(server.routes, "/p/:slug")).toBe(true);
  });
});
