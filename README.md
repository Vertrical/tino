# Tino

HTTP server for Deno with local JSON REST API for rapid prototyping.

## Install and Use

1. Install Deno: https://deno.land/#installation
2. Try it out: `$ deno run --allow-net --allow-read --allow-write https://raw.githubusercontent.com/Vertrical/json_server/develop/json_server.js`
3. Open http://localhost:8000/api

Internally Tino uses `jsondb responder` which opens `/api` path for playing around. It uses `db.json` file by default as a database.

## Run tests

Run: `$ deno test`

All tests are included in `./tests` directory.

## Minimal configuration

```js
// app.js
import tino from "https://raw.githubusercontent.com/Vertrical/json_server/develop/json_server.js";
const app = tino.create();
app.get(() => ({ path: "/ping", resp: "pong" }));
// Or
app.get(() => ({ path: "/ping", resp: () => "pong" }));
// Or
app.get(() => ({ path: "/ping", resp: async () => "pong" }));
tino.listen({ app, port: 8000 });
```

1. Now run the server: `$ deno run --allow-net app.js`
2. Send a request: `$ http :8000/ping` (HTTPie, curl, Postman, etc.)
3. Receive `"pong"` as `text/plain` content type

Tino application `app` supports following HTTP methods: GET, POST, PUT, PATCH, DELETE. Method names are lowercased.

`resp` can be anything, but it's a controller if it's a function. If it's a function, it will be called no matter if it's async or not. If it's an object (or returned as an object), content type will be `application/json`.

## `resp` definition

If defined as a function, `resp` receives following parameters:

1. `body` - body payload for POST, PUT or PATCH methods
2. `params` - parameters from path definition, e.g. `/path/:id`
3. `query` - query string like `?p=1&q=2`
4. `custom params` - anything else provided to method definition, except `path`, `resp` or `use`

Basically you can test this with following definition:
```js
// $ http POST :8000/post/123?q=1 foo=bar
app.post(() => ({
  path: "/post/:id?",
  resp: ({ body, params, query, something }) => ({ body, params, query, something }),
  something: "else",
}));
```

Response received should be:
```json
{
  "body": {
    "foo": "bar"
  },
  "params": {
    "id": "123"
  },
  "query": {
    "q": "1"
  },
  "something": "else"
}
```

## Using `jsondb` responder

This responder is just a small package which handles CRUD operations on `db.json` file.

Each response is wrapped with `response` parent, like:
```js
// GET /api/laptops/1234
{
  "response": {
    "id": "1234",
    "brand": "apple"
  }
}
```

### How is `jsondb` responder defined?

`jsondb` responder is already integrated with Tino so you don't need to do anything. But, if you want to define it nevertheless, you can do it like below:

```js
import tino, { jsondb } from "tino.js";
const app = tino.create();
app.any(() => ({ path: "/api", use: jsondb() })); // notice the ()
json_server.listen({ app });
```
(Please note that `jsondb` must be called. This is because it is a higher order function.)

`any` is needed because we want ANY HTTP METHOD to be used with this.

## Examples

```js
// Custom endpoints:

// Define parameters:
// :8000/muesli/choco
app.get(() => ({ path: "/muesli/:type", resp: ({ params }) => params.type }));
// $ "choco"
// text/plain

// Access query params:
// :8000/muesli/fruit?quantity=3
app.get(() => ({ path: "/muesli/:type", resp: ({ params, query }) => ({ params, query }) }));
// $ { "params": { "type": "fruit" }, "query": { "quantity": "3" }}
// application/json


// POST :8000/ingredients name=quinoa
app.post(() => ({ path: "/ingredients", resp: ({ body }) => body }))
// $ "quinoa"
// text/plain
```
### JSON REST API
Test JSON file is included in [tests/jsondb.test.json](https://github.com/Vertrical/json_server/blob/develop/tests/jsondb.test.json). You need to create your `./db.json` file to operate agains it.

Having the content same as in jsondb.test.json file, we would have following requests returning respective responses:
```sh
# Get list of items:
$ http :8000/api/laptops

# Get item by id: (jsondb treats any "id" found in an entity as ID)
$ http :8000/api/laptops/123

# Create new item:
$ http POST :8000/api/laptops id=789 brand=apple

# Replace an item:
$ http PUT :8000/api/laptops/789 brand=asus

# Update an item:
$ http PATCH :8000/api/laptops/789 brand=asus

# DELETE an item:
$ http DELETE :8000/api/laptops/789
```

### Customize API

If you want to change endpoint from `/api` to something else, just replace it:
```js
app.any(() => ({ path: "/myapi", use: jsondb() }));

// you can optionally "close" /api
app.any(() => ({ path: "/api", status: 404 }));
```
Remember that you need to create file `db.json` yourself. If not, the response will be empty object `{}` and status 404 by default.

### When to use `resp` and `use`?

Difference between `resp` and `use` is that `use` must return `{ resp, status? }` (status is optional). Response again can be anything - if it's a function, it will be executed no matter if it's async or not. 

This way you can write your own responders easily using `use`.

## CLI and options for Tino and jsondb

### Dry run for jsondb

If you want only to check how a request would modify db.json database without touching it, you can do a dry run.
```sh
# --allow-write is not necessary
deno run --allow-net --allow-read tino.js --dry=true
```

In your code you can achieve same by passing `true` to `jsondb` responder:
```js
app.get(() => ({ path: "/ping", use: jsondb(true) }));
```

### Custom port

You can run Tino on custom port:
```sh
deno run --allow-net --allow-read --allow-write tino.js --port=7000
```

Similarly, in your code you can pass it to `listen` method:
```js
// if you omit port, it will be 8000
json_server.listen({ app, port: 7777 });
```
