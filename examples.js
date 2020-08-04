import tino from "./tino.js";
const app = tino.create();

// Basic and preferred
const use = () => ({ resp: "pong" });
app.get(() => ({ path: "/ping", use }));

// Define this by yourself, aka middleware
const composed = (func) => {
  return func({ isAdmin: false });
};

// Very basic (status 200 is default)
app.get(() => ({ path: "/ping-simple", resp: "pong-simple" }));
app.get(() => ({ path: "/ping-simple-func", resp: () => "pong-simple-func" }));
app.get(
  composed((props) => ({
    path: "/ping-simple-func-composed",
    resp: () => ({ resp: "pong-simple-func-composed", ...props }),
  })),
);

// Set it all directly (not very useful)
app.get(() => ({
  path: "/resp",
  resp: "resp",
  status: 202,
  type: "text/html",
}));

// Or functional (these are all different ways to do the same thing)
// Depending on your function's logic, return statuses and types accordingly
app.get(() => ({
  path: "/use",
  use: () => ({ resp: "use", status: 200, type: "text/plain" }),
}));
app.get(
  composed((props) => ({
    path: "/use-composed",
    use: () => ({
      resp: { resp: "use-composed", isAdmin: props.isAdmin },
      status: 200,
    }),
  })),
);
app.get(() => ({
  path: "/use-async",
  use: async () => ({ resp: "use-async", status: 200, type: "text/plain" }),
}));
app.get(() => ({
  path: "/use-func",
  use: () => ({ resp: () => "use-func", status: 200, type: "text/plain" }),
}));
app.get(() => ({
  path: "/use-func-async",
  use: () => ({
    resp: async () => "use-func-async",
    status: 200,
    type: "text/plain",
  }),
}));
app.get(() => ({
  path: "/use-async-func-async",
  use: async () => ({
    resp: async () => "use-async-func-async",
    status: 200,
    type: "text/plain",
  }),
}));
// Define type outside of use, so it can be defined for multiple paths
app.get(() => ({
  path: "/use-type",
  use: () => ({ resp: "use-type", status: 200 }),
  type: "text/html",
}));
// But you can overwrite it if it's returned from your controller
app.get(() => ({
  path: "/use-type-type",
  use: () => ({ resp: "use-type-type", status: 200, type: "text/plain" }),
  type: "text/html",
}));

app.post(() => ({
  path: "/post/:id",
  use: ({ body, params, query, something }) => ({
    resp: () => ({ body, params, query, something }),
    status: 201,
  }),
  // resp: ({ body, params, query, something }) => ({ body, params, query, something, status: 202 }),
  something: "else",
}));

// Set 404 using these (latter overwrites former)
app.not_found(() => ({ resp: "<p>Nothing here...</p>", type: "text/html" }));
app.not_found(() => ({
  resp: () => "<p>Nothing here...</p>",
  type: "text/html",
}));
app.not_found(() => ({
  resp: async () => "<p>Nothing here...</p>",
  type: "text/html",
}));

tino.listen({ app, port: 8000 });

console.log(`Server running at 8000`);
