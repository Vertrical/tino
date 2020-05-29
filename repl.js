import json_server, { compose, tap, localdb } from "./json_server.js";

const app = json_server.create();

// minimal configuration:
app.get(() => ({ path: "/ping", body: "pong" }));
app.get(() => ({ path: "/func", body: () => "return" }));
app.get(() => ({ path: "/async", body: async () => ({ dev: "async" }) }));
app.get(() => ({ path: "/obj", body: () => ({ dev: 1 }) }));
app.get(() => ({ path: "/obj2", body: { dev: 1 } }));
app.get(() => ({ path: "/other", body: false }));
app.post(() => ({ path: "/post", body: "post" }));
app.not_found(() => ({ body: () => "Oops" }));

json_server.listen({ app, port: 8000 });
