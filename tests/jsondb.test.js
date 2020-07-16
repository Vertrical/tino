import {
  assertEquals,
  assertThrowsAsync,
} from "https://deno.land/std/testing/asserts.ts";
import jsondb, {
  tryRestful,
  methodPost,
  readJsonDb,
  tryDirectLens,
  checkJsonDb,
  tryProps,
  buildResponse,
  handleJson,
  buildResponseBody,
  processJsonOrContent,
} from "../jsondb.js";
import { readFileStr } from "../deps.js";

const jsonDbTestPath = "tests/jsondb.test.json";
const jsonDbTest = await readFileStr(jsonDbTestPath);

Deno.test("readJsonDb", async () => {
  const content = await readJsonDb(jsonDbTestPath);
  assertEquals(content, { json: JSON.parse(jsonDbTest) });

  await assertThrowsAsync(async () => readJsonDb("./none.js"), undefined);
});

Deno.test("checkJsonDb", async () => {
  const { json, fileContent } = await checkJsonDb(jsonDbTestPath);
  assertEquals(JSON.parse(jsonDbTest), json);
  assertEquals(undefined, fileContent);

  const result = await checkJsonDb("./none.js");
  assertEquals("{}", JSON.stringify(result));
});

Deno.test("tryDirectLens", () => {
  let method = "GET";
  let lensPath = ["genres", "0"];
  let json = JSON.parse(jsonDbTest);
  let result = tryDirectLens({ lensPath, json, method });
  assertEquals("comedy", result.data);
});

Deno.test("tryRestful", () => {
  let lensPath = ["laptops", "123"];
  let json = jsonDbTest;
  let parsedJson = JSON.parse(json);
  let method = "GET";
  let result = tryRestful({ lensPath, json: parsedJson, method });
  assertEquals(
    JSON.stringify(parsedJson.laptops[0]),
    JSON.stringify(result.data),
  );
});

Deno.test("tryProps", () => {
  let lensPath = ["laptops"];
  let json = jsonDbTest;
  let parsedJson = JSON.parse(json);
  let result = tryProps({
    lensPath,
    json,
    method: "GET",
    query: { id: 123 },
    data: parsedJson.laptops,
  });
  assertEquals(
    JSON.stringify(result.data[0]),
    JSON.stringify(parsedJson.laptops[0]),
  );
});

Deno.test("methodPost", () => {
  let body = { id: 124, brand: "apple" };
  let json = JSON.parse(jsonDbTest);
  let method = "POST";
  let lensPath = ["laptops"];
  let result = methodPost({ body, json, method, lensPath });
  assertEquals(result, {
    data: { ...json, laptops: [...json.laptops, body] },
  });

  body = ["horror", "sci-fi"];
  lensPath = ["genres"];
  result = methodPost({ body, json, method, lensPath });
  assertEquals(result, {
    data: { ...json, genres: json.genres.concat(body) },
  });
});

Deno.test("buildResponse", () => {
  let response = buildResponse({ data: [1, 2, 3] });
  assertEquals(
    JSON.stringify({ response: [1, 2, 3] }),
    JSON.stringify(response),
  );

  response = buildResponse({ data: { a: 1, b: 2 } });
  assertEquals(
    JSON.stringify({ response: { a: 1, b: 2 } }),
    JSON.stringify(response),
  );

  response = buildResponse({ data: null });
  assertEquals(JSON.stringify({ response: null }), JSON.stringify(response));
});

Deno.test("handleJson", () => {
  let method = "GET";
  let lensPath = ["genres", "0"];
  let json = JSON.parse(jsonDbTest);
  let result = handleJson({ method, lensPath, json });
  assertEquals(
    JSON.stringify({ response: json.genres[0] }),
    JSON.stringify(result),
  );

  lensPath = ["laptops", "123"];
  result = handleJson({ method, lensPath, json });
  assertEquals(
    JSON.stringify({ response: json.laptops[0] }),
    JSON.stringify(result),
  );
});

Deno.test("buildResponseBody", () => {
  const parsedJson = JSON.parse(jsonDbTest);
  const pathPattern = "/api";
  let props = {
    ctx: {
      req: {
        url: "/api/laptops",
        method: "GET",
      },
      pathPattern,
      query: {},
    },
    json: JSON.parse(jsonDbTest),
  };

  let result = buildResponseBody(props);
  assertEquals(
    JSON.stringify(parsedJson.laptops),
    JSON.stringify(result?.resp?.response),
  );

  const body = { id: 657, brand: "apple" };
  props = {
    ctx: {
      req: {
        url: "/api/laptops",
        method: "POST",
      },
      reqBody: body,
      pathPattern,
      query: {},
    },
    json: JSON.parse(jsonDbTest),
  };
  result = buildResponseBody(props);
  assertEquals(
    JSON.stringify(parsedJson.laptops.concat(body)),
    JSON.stringify(result?.resp?.response?.laptops),
  );
});

Deno.test("jsondb", async () => {
  const parsedJson = JSON.parse(jsonDbTest);
  const pathPattern = "/api";
  let ctx = {
    req: {
      url: "/api/laptops",
      method: "GET",
    },
    pathPattern,
    query: {},
  };

  let result = await jsondb(
    false,
    processJsonOrContent,
    () => checkJsonDb(jsonDbTestPath),
  )(ctx);
  assertEquals(
    JSON.stringify(parsedJson.laptops),
    JSON.stringify(result?.resp?.response),
  );

  const body = { id: 259, brand: "hp" };
  ctx = {
    req: {
      url: "/api/laptops",
      method: "POST",
    },
    reqBody: body,
    pathPattern,
    query: {},
  };
  result = await jsondb(
    false,
    processJsonOrContent,
    () => checkJsonDb(jsonDbTestPath),
  )(ctx);
  assertEquals(
    JSON.stringify(parsedJson.laptops.concat(body)),
    JSON.stringify(result?.resp?.response?.laptops),
  );
});
