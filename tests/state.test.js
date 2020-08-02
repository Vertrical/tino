import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import tino from "../tino.js";

Deno.test("Tino state", () => {
  let app = tino.create();
  let fake = new Map();

  app.get(() => ({ path: "/ping", resp: "pong" }));
  fake.set("/ping", { get: { resp: "pong" } });
  assertEquals(fake.get("/ping"), app.getState().get("/ping"));

  app.any(() => ({ path: "/any", resp: "any" }));
  fake.set("/any", { any: { resp: "any" } });
  assertEquals(fake.get("/any"), app.getState().get("/any"));
});
