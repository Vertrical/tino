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
