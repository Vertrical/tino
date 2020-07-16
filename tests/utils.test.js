import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import * as U from "../utils.js";

Deno.test("isEmpty util", () => {
  assertEquals(U.isEmpty(null), false);
  assertEquals(U.isEmpty(undefined), false);

  assertEquals(U.isEmpty([]), true);
  assertEquals(U.isEmpty([1, 2, 3]), false);
  assertEquals(U.isEmpty([null]), false);

  assertEquals(U.isEmpty(""), true);
  assertEquals(U.isEmpty("something"), false);
  assertEquals(U.isEmpty("\n"), false);

  assertEquals(U.isEmpty({}), true);
  assertEquals(U.isEmpty({ a: 1 }), false);
  assertEquals(U.isEmpty({ length: 0 }), false);

  assertEquals(U.isEmpty(3), false);
  assertEquals(U.isEmpty(NaN), false);
  assertEquals(U.isEmpty(new Object()), true);
  assertEquals(U.isEmpty(new Date()), false);
});

Deno.test("cond util", () => {
  const conditional = U.cond([
    { when: U.eq("POST"), use: "methodPost" },
    { when: U.eq("PUT"), use: "methodPut" },
    { when: U.eq("DELETE"), use: "methodDelete" },
  ]);
  assertEquals(conditional("POST"), "methodPost");
  assertEquals(conditional("PUT"), "methodPut");
  assertEquals(conditional("DELETE"), "methodDelete");
  assertEquals(conditional("bla")(2), 2);
});
