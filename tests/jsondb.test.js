import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { tryRestful } from "../jsondb.js";
import jsondbTest from "./jsondb.test.json";

Deno.test("tryRestful", () => {
  let lensPath = ["laptops", "123"];
  let data = undefined;
  let json = jsondbTest;
  let result = tryRestful({ lensPath, data, json, next: false });
  console.log("result", result);
  // assertEquals(result, { response: ["comedy", "thriller", "drama"] });
});
