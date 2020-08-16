Please don't use any classes and/or decorators. This maybe makes code readable but hard to test and reason about and isn't quite declarative. Naming things is(should be) much easier.

Take a look for example at composition in [http_server.js](https://github.com/Vertrical/tino/blob/develop/http_server.js#L220):
```js
export const processRequest = U.asyncCompose(
  createResponder,
  resolveResponse,
  handleNotFound,
  handleUse,
  tryComposedMiddlewares,
  resolveRequestBody,
  prepareContext,
);
```

If you want to branch (like [`applyGetMethod`](https://github.com/Vertrical/tino/blob/develop/jsondb.js#L284) or [`applyMethod`](https://github.com/Vertrical/tino/blob/develop/jsondb.js#L253) in [jsondb.js](https://github.com/Vertrical/tino/blob/develop/jsondb.js)), please use [cond](https://github.com/Vertrical/tino/blob/develop/utils.js#L108), [when](https://github.com/Vertrical/tino/blob/develop/utils.js#L121) and/or [ifElse](https://github.com/Vertrical/tino/blob/develop/utils.js#L61). If a function throws an exception please start the name with `throws`.

If you want to get/set deeply from/to objects please use [lenses](https://github.com/Vertrical/tino/blob/develop/utils.js#L165).

Ramda or similar library is also fine, it might be integrated in future, but it wasn't exporting properly for Deno at the time of starting to write Tino.

