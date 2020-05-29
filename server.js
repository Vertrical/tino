import { R, pathToRegexp } from "./deps.js";
import { serve } from "https://deno.land/std@0.50.0/http/server.ts";

const parsePath = ({ matcher, path, url }) => {
  return R.tryCatch(
    () => matcher(path, { decode: decodeURIComponent })(url),
    () => false
  )();
};

const destructDeps = ({ serve, app, port = 8000 }) => {
  const server = serve({ port });
  const state = app.getState();
  return { server, state };
};

export const getResponseDefinition = ({ req, state }) => {
  const url = req.url;
  const responseDefinition = {};
  for (const [pathPattern, pathArgs] of state) {
    const matchedPath = parsePath({
      matcher: pathToRegexp.match,
      path: pathPattern,
      url,
    });
    responseDefinition.params = { ...matchedPath.params };
    if (R.has("path")(matchedPath) && pathArgs[req.method.toLowerCase()]) {
      responseDefinition.bodyHandler = pathArgs[req.method.toLowerCase()].body;
    }
  }
  if (state.has(404) && !R.has("bodyHandler", responseDefinition)) {
    return { ...responseDefinition, status: 404, bodyHandler: state.get(404).body };
  }
  return { ...responseDefinition };
};

export const resolveBody = async ({ bodyHandler: handler, params, status }) => {
  const bodyHandlerType = R.type(handler);
  let body;
  if (bodyHandlerType === "AsyncFunction") {
    body = await handler({ ...params });
  } else {
    body = bodyHandlerType === "Function" ? handler({ ...params }) : handler;
  }
  if (status) {
    return { body, status };
  }
  return { body };
};

export const createResponder = ({ body, status }) => {
  const responderObject = { body: R.toString(body) };
  if (R.type(body) === "Object") {
    responderObject.body = JSON.stringify({ ...body });
    responderObject.headers = new Headers({
      "content-type": "application/json",
    });
  }
  if (status) {
    responderObject.status = status;
  }
  return responderObject;
};

const asyncCompose = (...functions) => (input) =>
  functions.reduceRight(
    (chain, func) => chain.then(func),
    Promise.resolve(input)
  );

export const listen = async ({ app, port = 8000 }) => {
  const { server, state } = destructDeps({ serve, app, port });
  for await (const req of server) {
    const responderObject = await asyncCompose(
      createResponder,
      resolveBody,
      getResponseDefinition
    )({ req, state });
    req.respond(responderObject);
  }
};
