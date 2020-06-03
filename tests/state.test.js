import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import json_server from "../json_server.js";

Deno.test("json_server state", () => {
  let app = json_server.create();
  let fake = new Map();

  app.get(() => ({ path: "/ping", body: "pong" }));
  fake.set("/ping", { get: { body: "pong" } });
  assertEquals(fake, app.getState());

  app.any(() => ({ path: "/any", body: "any" }));
  fake.set("/any", { any: { body: "any" } });
  assertEquals(fake, app.getState());
});
