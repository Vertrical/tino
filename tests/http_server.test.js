import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { processRequest, tryComposedMiddlewares } from "../http_server.js";
import { withMiddlewares } from "../tino.js";

Deno.test("http_server GET", async () => {
  let req = {
    url: "/items",
    method: "GET",
  };
  let state = new Map();
  state.set("/items", { get: { resp: [1, 2, 3] } });
  const bodyReader = async () => null;
  const res = await processRequest({ req, state, bodyReader });
  assertEquals(JSON.stringify([1, 2, 3]), res.body);
});

Deno.test("http_server POST", async () => {
  let req = {
    url: "/items",
    method: "POST",
  };
  let state = new Map();
  state.set("/items", { post: { resp: (stuff) => ({ ...stuff.body }) } });
  const bodyReader = async () => ({ to: "Santa" });
  const res = await processRequest({ req, state, bodyReader });
  assertEquals(JSON.stringify({ to: "Santa" }), res.body);
});

Deno.test("tryComposedMiddlewares", async () => {
  const ctx = { req: {} };
  const query = {};
  const params = {};
  const status = 203;
  const middlewaresResult = () => ({ isUser: true, isAdmin: false, status });
  const responder = () => {};
  const use = { middlewaresResult, responder };
  const withMiddlewaresResult = await tryComposedMiddlewares(
    { ctx, query, params, use },
  );
  console.log('withMiddlewaresResult', withMiddlewaresResult);
  assertEquals(
    withMiddlewaresResult,
    {
      ctx: { req: {} },
      query: {},
      params: {},
      use: responder,
      isUser: true,
      isAdmin: false,
      status,
    }
  );
});
