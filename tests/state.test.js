import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import json_server from "../json_server.js";

Deno.test("json_server state", () => {
  let app = json_server.create();
  let fake = new Map();

  app.get(() => ({ path: "/ping", resp: "pong" }));
  fake.set("/ping", { get: { resp: "pong" } });
  assertEquals(JSON.stringify(fake), JSON.stringify(app.getState()));

  app.any(() => ({ path: "/any", resp: "any" }));
  fake.set("/any", { any: { resp: "any" } });
  assertEquals(JSON.stringify(fake), JSON.stringify(app.getState()));
});
