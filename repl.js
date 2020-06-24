import json_server, { compose, tap, localdb, jsondb } from "./json_server.js";

const app = json_server.create();

// minimal configuration:
// app.any(() => ({ path: "/ping/:id", use: ({ params }) => ({ body: params }) }));
// app.any(() => ({ path: "/api", status: 404 }));
app.any(() => ({
  path: "/hello/:from",
  resp: ({ params, query }) => `From ${params.from} to ${query.who}!`,
}));
app.any(() => ({ path: "/myapi", use: jsondb() }));
app.get(() => ({ path: "/func", resp: () => "return" }));
app.get(() => ({ path: "/async", resp: async () => ({ dev: "async" }) }));
app.get(() => ({ path: "/obj", resp: () => ({ dev: 1 }) }));
app.get(() => ({ path: "/obj2", resp: { dev: 1 } }));
app.get(() => ({ path: "/other", resp: false }));
app.post(() => ({
  path: "/post/:id?",
  resp: (props) => props,
  status: 500,
  something: "else",
}));
app.not_found(() => ({ resp: () => "Oops" }));

console.log(app.getState());

json_server.listen({ app, port: 8000 });

// fetch('http://localhost:8000/myapi/genres').then(json => json.json()).then(console.log)
