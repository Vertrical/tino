import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import {
  getResponseDefinition,
  resolveBody,
  createResponder,
} from "../server.js";

Deno.test("getResponseDefinition", async () => {
  const state = new Map();
  const req = { url: "/ping", method: "GET" };
  state.set("/ping", { get: { body: "pong" } });
  let resp = getResponseDefinition({ state, req });
  assertEquals(resp.params, {});
  assertEquals(resp.bodyHandler, "pong");

  state.set("/ping/:id", { get: { body: "pong" } });
  req.url = "/ping/2";
  resp = getResponseDefinition({ state, req });
  assertEquals(resp.params, { id: "2" });
  assertEquals(resp.bodyHandler, "pong");

  state.set("/ping", { get: { body: () => "pong" } });
  req.url = "/ping";
  resp = getResponseDefinition({ state, req });
  assertEquals(resp.bodyHandler(), "pong");

  state.set("/ping/:id", { get: { body: async () => "pong" } });
  resp = getResponseDefinition({ state, req });
  resp = await resp.bodyHandler();
  assertEquals(resp, "pong");

  state.set("/ping/:id", { post: { body: "pong" } });
  req.method = "POST";
  resp = getResponseDefinition({ state, req });
  assertEquals(resp, { params: {} });

  state.set(404, { body: "pong" });
  req.method = "POST";
  resp = getResponseDefinition({ state, req });
  assertEquals(resp, { status: 404, bodyHandler: "pong", params: {} });

  req.method = "GET";
  req.url = "/ping";
  resp = getResponseDefinition({ state, req });
  assertEquals(resp.params, {});
  assertEquals(resp.bodyHandler(), "pong");
});

Deno.test("resolveBody", async () => {
  let bodyHandler = async ({ inc }) => inc + 1;
  let bodyTest = await resolveBody({ bodyHandler, params: { inc: 1 } });
  assertEquals(bodyTest, { body: 2 });

  bodyHandler = "body";
  bodyTest = await resolveBody({ bodyHandler });
  assertEquals(bodyTest, { body: "body" });

  bodyHandler = () => 123;
  bodyTest = await resolveBody({ bodyHandler });
  assertEquals(bodyTest, { body: 123 });

  bodyHandler = undefined;
  bodyTest = await resolveBody({ bodyHandler });
  assertEquals(bodyTest, { body: undefined });

  bodyHandler = "body";
  bodyTest = await resolveBody({ bodyHandler, status: 404 });
  assertEquals(bodyTest, { body: "body", status: 404 });
});
