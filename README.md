## JSON Server for Deno

1. Install Deno: https://deno.land/#installation
2. Try out repl: `deno --allow-net repl.js`
3. Run tests: `deno test tests/server.test.js`

### Minimal configuration: (for example in repl.js file)

```js
import json_server from "./json_server.js";
const app = json_server.create();
app.get(() => ({ path: "/ping", body: "pong" }));
json_server.listen({ app, port: 8000 });
```

1. Now run the server: `deno --allow-net repl.js`
2. Send a request: `http :8000/ping` (using [HTTPie](https://httpie.org/) or curl, etc.)

(`body` can be anything. If it's a function, it will be called no matter if it's async or not.)

### Purpose

1. It is intended for developers for rapid prototyping and development.
2. Besides having ability to have DB mockup and RESTful operations on it, it is also capable to respond to custom endpoints defined by a human.
3. This early version is a protoype written in JavaScript with plan to make it fully in TypeScript.

### Using `jsondb` responder

This responder is small package which handles CRUD operations on `db.json` file.
You only need to set it up as an endpoint, for example:
```js
import json_server, { jsondb } from "./json_server.js";
const app = json_server.create();
app.any(() => ({ path: "/api", use: jsondb() })); // notice the ()
json_server.listen({ app });
```
(Please note that `jsondb` must be called. This is because it is a higher order function, for testing purposes processor of JSON file can be replaced.)
`any` is needed because we want ANY HTTP METHOD to be used with this. For example `POST` will create a new record.
This means you can shoot any HTTP method straight to json_server on `/api` endpoint.
For example if you have such db.json file:
```json
{
  "color": "green"
}
```
And target following endpoint: (GET method) `http :8000/api/color` you would get response "green" with status 200.

If you want to change endpoint from `/api` to something else, just replace it:
```js
app.any(() => ({ path: "/myapi", use: jsondb() }));

// you can optionally "close" /api
app.any(() => ({ path: "/api", status: 404 }));
```
Remember that you need to create file `db.json` yourself. If not, the response will be empty object `{}` and status 404 by default.

### When to use `body` and `use`?

Difference between `body` and `use` is that `use` must return `{ body, status? }` (status is optional). Body again can be anything - if it's a function, it will be executed no matter if it's async or not. 

This way you can write your own responders easily using `use`. `jsondb` is just a responder which reads and maintains json.db file.