import tino, { withMiddlewares } from "https://deno.land/x/tino@v1.0.4/tino.js";
const app = tino.create();

// Basic and preferred
const use = (props) => ({ resp: ({ props }) });
app.get(() => ({ path: "/ping", use }));
app.get(() => ({ path: "/ping/:id/:param/:type", use }));

// Very basic (status 200 is default)
app.get(() => ({ path: "/ping-simple", resp: "pong-simple" }));
app.get(() => ({ path: "/ping-simple-func", resp: () => "pong-simple-func" }));

// Use middlewares
const withAuth = (props) => {
  return { isUser: true };
};
const throwAuth = () => {
  throw { status: 401, resp: "Boom", type: "text/html" };
};
const isAdmin = (props) => {
  return { isAdmin: false, ...props };
};
const withDB = async (props) => {
  return { coll: {}, ...props };
};
const composed = withMiddlewares(
  withAuth,
  isAdmin,
  withDB,
);
const useComposed = composed(() => {
  return { resp: "ping-simple-func-composed" };
});
app.get(
  () => ({
    path: "/ping-simple-func-composed",
    use: useComposed,
  }),
);

// Or functional (these are all different ways to do the same thing)
// Depending on your function's logic, return statuses and types accordingly
app.get(() => ({
  path: "/use",
  use: () => ({ resp: "use", status: 200, type: "text/plain" }),
}));
app.get(() => ({
  path: "/use-async",
  use: async () => ({ resp: "use-async", status: 200, type: "text/plain" }),
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
// Define type outside of use
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

const composed2 = withMiddlewares(
  (props) => ({ isAdmin: true }),
);
app.post(() => ({
  path: "/post2/:id", // or optional with :id?
  use: composed2((props) => {
    return { resp: { ...props } };
  }),
  something: "else",
}));

app.post(() => ({
  path: "/post/:id",
  use: ({ body, params, query, something }) => ({
    resp: () => ({ body, params, query, something }),
    status: 201,
  }),
  // resp: ({ body, params, query, something }) => ({ body, params, query, something, status: 201 }),
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
