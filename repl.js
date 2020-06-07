import json_server, { compose, tap, localdb, jsondb } from "./json_server.js";

const app = json_server.create();

// minimal configuration:
// app.any(() => ({ path: "/ping/:id", use: ({ params }) => ({ body: params }) }));
// app.any(() => ({ path: "/api", status: 404 }));
app.any(() => ({
  path: "/hello/:from",
  body: ({ params, query }) => `From ${params.from} to ${query.who}!`,
}));
app.any(() => ({ path: "/myapi", use: jsondb() }));
app.get(() => ({ path: "/func", body: () => "return" }));
app.get(() => ({ path: "/async", body: async () => ({ dev: "async" }) }));
app.get(() => ({ path: "/obj", body: () => ({ dev: 1 }) }));
app.get(() => ({ path: "/obj2", body: { dev: 1 } }));
app.get(() => ({ path: "/other", body: false }));
app.post(() => ({
  path: "/post/:id?",
  body: (props) => props,
  status: 500,
  something: "else",
}));
app.not_found(() => ({ body: () => "Oops" }));

console.log(app.getState());

json_server.listen({ app, port: 8000 });

// fetch('http://localhost:8000/myapi/genres').then(json => json.json()).then(console.log)
