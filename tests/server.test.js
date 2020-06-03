import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import {
  getResponseDefinition,
  resolveBody,
  processRequest,
} from "../http_server.js";

Deno.test("processRequest", async () => {
  const state = new Map();
  state.set("/ping", { get: { body: () => "pong" } });
  let req = { url: "/ping", method: "GET" };
  let response = await processRequest({ req, state });
  assertEquals(response, { body: "pong" });

  state.clear();
  state.set("/ping/:id", { get: { body: () => "pong" } });
  req = { url: "/ping", method: "GET" };
  response = await processRequest({ req, state });
  assertEquals(response, { body: undefined, status: 404 });

  state.clear();
  state.set("/ping", { get: { body: "pong" } });
  state.set(404, { body: () => "Oops" });
  req = { url: "/ping", method: "POST" };
  response = await processRequest({ req, state });
  assertEquals(response, { body: "Oops", status: 404 });

  state.clear();
  req = { url: "/ping", method: "GET" };
  state.set(404, { body: () => "Oops" });
  response = await processRequest({ req, state });
  assertEquals(response, { body: "Oops", status: 404 });
  state.set("/ping/:id?", { get: { body: () => "pong" } });
  response = await processRequest({ req, state });
  assertEquals(response, { body: "pong" });
});

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
  assertEquals(resp.params, {});

  req.method = "GET";
  req.url = "/ping";
  resp = getResponseDefinition({ state, req });
  assertEquals(resp.params, {});
  assertEquals(resp.bodyHandler(), "pong");

  state.delete("/ping");
  state.set("/ping/:id?", { get: { body: (props) => props, someprop: 123 } });
  req.method = "GET";
  req.url = "/ping/2";
  resp = getResponseDefinition({ state, req });
  assertEquals(resp.params, { id: "2" });
  assertEquals(resp.someprop, 123);
  req.url = "/ping";
  resp = getResponseDefinition({ state, req });
  assertEquals(resp.params, {});
  assertEquals(resp.someprop, 123);
});

Deno.test("resolveBody", async () => {
  let bodyHandler = async ({ params: { inc } }) => inc + 1;
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
  assertEquals(bodyTest, { body: undefined, status: 404 });

  bodyHandler = "body";
  bodyTest = await resolveBody({ bodyHandler, status: 404 });
  assertEquals(bodyTest, { body: "body", status: 404 });
});
