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
  methodDelete,
  methodPatch,
} from "../jsondb.js";
import { readJson } from "../deps.js";
import * as U from "../utils.js";
import { HttpStatus } from "../http_server.js";

const jsonDbTestPath = "tests/jsondb.test.json";
const jsonDbTestCopyPath = "tests/jsondb_copy.test.json";
const jsonDbTest = await Deno.readTextFile(jsonDbTestPath);

const beforeAll = async () => {
  try {
    await Deno.copyFile(jsonDbTestPath, jsonDbTestCopyPath);
  } catch (e) {
    console.warn(
      `There was an error copying the file ${jsonDbTestCopyPath}: ${e}`,
    );
  }
};

const afterAll = async () => {
  try {
    await Deno.remove(jsonDbTestCopyPath);
  } catch (e) {
    console.warn(
      `There was an error deleting the file ${jsonDbTestCopyPath}: ${e}`,
    );
  }
};

Deno.test("beforeAll jsondb", beforeAll);

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
  let lensPath = ["genres", "0", "byindex"];
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
  assertEquals(result.data, {
    ...json,
    laptops: [...json.laptops, body],
  });

  body = ["horror", "sci-fi"];
  lensPath = ["genres"];
  result = methodPost({ body, json, method, lensPath });
  assertEquals(result.data, {
    ...json,
    genres: json.genres.concat(body),
  });
});

Deno.test("methodDelete", () => {
  let json = JSON.parse(jsonDbTest);
  let jsonCopy = JSON.parse(JSON.stringify(json));
  let method = "DELETE";
  let lensPath = ["laptops", "123"];
  let result = methodDelete({ json: jsonCopy, method, lensPath });
  assertEquals(result.data, {
    ...json,
    laptops: json.laptops.slice(1),
  });

  jsonCopy = JSON.parse(JSON.stringify(json));
  lensPath = ["laptops", "1", "byindex"];
  result = methodDelete({ json: jsonCopy, method, lensPath });
  jsonCopy.laptops.splice(lensPath.slice(1), 1);
  assertEquals(result.data, { ...json, laptops: jsonCopy.laptops });

  jsonCopy = JSON.parse(JSON.stringify(json));
  lensPath = ["laptops"];
  let query = { brand: "dell" };
  result = methodDelete({ json: jsonCopy, method, lensPath, query });
  assertEquals(result.data, {
    ...json,
    laptops: json.laptops.filter((laptop) => laptop.brand !== "dell"),
  });

  jsonCopy = JSON.parse(JSON.stringify(json));
  lensPath = ["color", "dark"];
  result = methodDelete({ json: jsonCopy, method, lensPath });
  const { dark: _, ...colorResult } = json.color;
  assertEquals(result.data, {
    ...json,
    color: colorResult,
  });
});

Deno.test("methodPatch", () => {
  let body = { price: 98000 };
  let json = JSON.parse(jsonDbTest);
  let target = json.laptops[0];
  let method = "PATCH";
  let lensPath = ["laptops", target.id.toString()];
  let result = methodPatch({ body, json, method, lensPath });
  assertEquals(result.data, {
    ...json,
    laptops: json.laptops.map((obj) =>
      obj.id == target.id ? { ...obj, ...body } : obj
    ),
  });

  body = { sunny: "yellow" };
  lensPath = ["color"];
  result = methodPatch({ body, json, method, lensPath });
  assertEquals(result.data, {
    ...json,
    color: { ...json.color, ...body },
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
  let lensPath = ["genres", "0", "byindex"];
  let json = JSON.parse(jsonDbTest);
  let result = handleJson({ method, lensPath, json });
  assertEquals(
    JSON.stringify(json.genres[0]),
    JSON.stringify(result.response),
  );

  lensPath = ["laptops", "123"];
  result = handleJson({ method, lensPath, json });
  assertEquals(
    JSON.stringify(json.laptops[0]),
    JSON.stringify(result.response),
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
    JSON.stringify(result.resp?.response),
  );

  const body = { id: 657, brand: "apple" };
  props = {
    ctx: {
      req: {
        url: "/api/laptops",
        method: "POST",
      },
      body,
      pathPattern,
      query: {},
    },
    json: JSON.parse(jsonDbTest),
  };
  result = buildResponseBody(props);
  assertEquals(
    JSON.stringify(parsedJson.laptops.concat(body)),
    JSON.stringify(result.resp?.response?.laptops),
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
    true,
    processJsonOrContent,
    () => checkJsonDb(jsonDbTestPath),
  )(ctx);
  assertEquals(
    JSON.stringify(parsedJson.laptops),
    JSON.stringify(result.resp?.response),
  );

  let body = { id: 259, brand: "hp" };
  ctx = {
    req: {
      url: "/api/laptops",
      method: "POST",
    },
    body,
    pathPattern,
    query: {},
  };
  result = await jsondb(
    false,
    processJsonOrContent,
    () => checkJsonDb(jsonDbTestPath),
    jsonDbTestCopyPath,
  )(ctx);
  const newContent = await U.tryCatch(
    async () => await readJson(jsonDbTestCopyPath),
    () => ({}),
  );

  assertEquals(
    JSON.stringify(body),
    JSON.stringify(result.resp?.response),
  );

  assertEquals(
    JSON.stringify(newContent),
    JSON.stringify({ ...parsedJson, laptops: [...parsedJson.laptops, body] }),
  );
});

Deno.test("Should return empty object for a object target without dry run", async () => {
  const body = { dark: "red" };
  const pathPattern = "/api";
  const ctx = {
    req: {
      url: "/api/color",
      method: "PUT",
    },
    pathPattern,
    body,
    query: {},
  };
  const result = await jsondb(
    false,
    processJsonOrContent,
    () => checkJsonDb(jsonDbTestPath),
    jsonDbTestCopyPath,
  )(ctx);

  assertEquals(
    {},
    result.resp?.response,
  );
  assertEquals(
    HttpStatus.OK,
    result.status,
  );
});

Deno.test("Should return an empty array for an array target without dry run", async () => {
  const body = { id: 289, brand: "acer" };
  const pathPattern = "/api";
  const ctx = {
    req: {
      url: "/api/laptops",
      method: "PATCH",
    },
    pathPattern,
    body,
    query: {},
  };
  const result = await jsondb(
    false,
    processJsonOrContent,
    () => checkJsonDb(jsonDbTestPath),
    jsonDbTestCopyPath,
  )(ctx);

  assertEquals(
    [],
    result.resp?.response,
  );
  assertEquals(
    HttpStatus.BAD_REQUEST,
    result.status,
  );
});

Deno.test("Should return null for a string target without dry run", async () => {
  const body = "horror";
  const pathPattern = "/api";
  const ctx = {
    req: {
      url: "/api/color/dark",
      method: "POST",
    },
    pathPattern,
    body,
    query: {},
  };
  const result = await jsondb(
    false,
    processJsonOrContent,
    () => checkJsonDb(jsonDbTestPath),
    jsonDbTestCopyPath,
  )(ctx);

  assertEquals(
    null,
    result.resp?.response,
  );
  assertEquals(
    HttpStatus.UNPROCESSABLE_ENTITY,
    result.status,
  );
});

Deno.test("afterAll jsondb", afterAll);
