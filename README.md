# Tino

HTTP server for Deno with local JSON REST API for rapid prototyping.

## Install and Use

1. Install Deno: https://deno.land/#installation
2. Try it out: `$ deno run --allow-net --allow-read --allow-write https://raw.githubusercontent.com/Vertrical/tino/develop/tino.js`

Internally Tino uses `jsondb responder` which opens `/api` path for playing around. It uses `db.json` file by default as a database.

1. To see it already, copy it from tests: `$ cp ./tests/jsondb.test.json ./db.json`
2. Open http://localhost:8000/api

## Run tests

Run: `$ deno test`

All tests are included in `./tests` directory.

## Minimal configuration (custom endpoints)

```js
// app.js
import tino from "https://raw.githubusercontent.com/Vertrical/tino/develop/tino.js";
const app = tino.create();
const controller = () => ({ resp: "pong", status: 200 }) // must return { resp, status? }
app.get(() => ({ path: "/ping", use: controller }));
tino.listen({ app, port: 8000 });
console.log(`Server running at 8000`);
```

1. Now run the server: `$ deno run --allow-net app.js`
2. Send a request: `$ http :8000/ping` (HTTPie, curl, Postman, etc.)
3. Receive `"pong"` as `text/plain` content type

### Further configurations
```js
// Shorter: Use `resp` directly with status 200
app.get(() => ({ path: "/ping", resp: "pong" }));

// `resp` can be anything:
app.get(() => ({ path: "/ping", use: () => ({ resp: () => "pong", status: 200 }) }));

// Or
app.get(() => ({ path: "/ping-async", use: () => ({ resp: async () => "pong", status: 201 }) }));
app.not_found(() => ({ resp: "Oops" }));
```

Tino application `app` supports following HTTP methods: GET, POST, PUT, PATCH, DELETE. Method names are lowercased. Also there is `not_found` for status 404, so you can define custom response.

`resp` can be anything, but it's a controller if it's a function. If it's a function, it will be called no matter if it's async or not. If it's an object (or returned as an object), content type will be `application/json`.

The only requirement for `use` is that it must return `{ resp, status? }` object.

## `resp` definition

If defined as a function, `resp` receives following parameters:

1. `body` - body payload for POST, PUT or PATCH methods
2. `params` - parameters from path definition, e.g. `/path/:id`
3. `query` - query string like `?p=1&q=2`
4. `custom params` - anything else provided to method definition, except `path`, `resp` or `use`

Basically you can test this with following have-it-all definition:
```js
// $ http POST :8000/post/123?q=1 foo=bar
app.post(() => ({
  path: "/post/:id", // or optional with :id?
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

This responder is just a small package included by default in Tino which handles CRUD operations on `db.json` file.

Each response is wrapped with `response` parent, like:
```js
// GET /api/users/1234
{
  "response": {
    "id": "1234",
    "name": "Smith"
  }
}
```

### How is `jsondb` responder defined?

`jsondb` responder is already integrated with Tino so you don't need to do anything. But, if you want to define it nevertheless, you can do it like below:

```js
import tino, { jsondb } from "tino.js";
const app = tino.create();
app.any(() => ({ path: "/api", use: jsondb() })); // notice the ()
// If you want some other namespace
app.any(() => ({ path: "/awesome-api", use: jsondb() }));
tino.listen({ app });
```
(Please note that `jsondb` must be called. This is because it is a higher order function.)

`any` is needed because we want ANY HTTP METHOD to be used with this.

### JSON REST API
Test JSON file is included in [tests/jsondb.test.json](https://github.com/Vertrical/tino/blob/develop/tests/jsondb.test.json). You need to create your `./db.json` file to operate agains it.

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
You can see many examples in [tests/requests.http](https://github.com/Vertrical/tino/blob/develop/tests/requests.http) file.

### Customize API

If you want to change endpoint from `/api` to something else, just replace it:
```js
app.any(() => ({ path: "/myapi", use: jsondb() }));

// you can optionally "close" /api
app.any(() => ({ path: "/api", status: 404 }));
```
Remember that you need to create file `db.json` yourself. If not, the response will be empty and status 404.

### When to use `use` and `resp`?

`use` is recommended way to define your controllers. It uses `resp` as return type and can be anything, objects, primitives and functions. `resp` can be used directly but then `status` is always 200. It's just syntactic sugar so you can write shorter definitions if you don't care about statuses. For example these two definitions are the same:
```js
app.get(() => ({ path: "/ping", use: () => ({ resp: "pong", status: 200 }) }));
app.get(() => ({ path: "/ping", resp: "pong" }));
```

Use `use` (a responder) when you want:
1. complete control over HTTP statuses
2. extend Tino's functionality
3. create namespaces

For example you want a namespace `/swapi` to handle Star Wars API, so you can make functionality for this and use it with Tino:
```js
import swapi from "https://some.location.com/swapi.js";
app.any(() => ({ path: "/swapi", use: swapi }));
```
The only requirement is that it returns `{ resp, status? }` at the end, so it's your responsibility to handle HTTP statuses with your internal logic.

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
tino.listen({ app, port: 7777 });
```
