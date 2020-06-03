import { R, pathToRegexp } from "./deps.js";
import { serve } from "https://deno.land/std@0.50.0/http/server.ts";
import { asyncCompose } from "./utils.js";

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

export const handleBody = ({ req, state }) => {
  const url = req.url;
  let _def = {};
  const responseDefinition = _def;
  for (const [pathPattern, pathArgs] of state) {
    const matchedPath = parsePath({
      matcher: pathToRegexp.match,
      path: pathPattern,
      url,
    });
    responseDefinition.params = { ...matchedPath.params };
    const _method = req.method.toLowerCase();
    const _hasMethod = pathArgs[_method] || pathArgs["any"];
    if (R.has("path")(matchedPath) && _hasMethod) {
      const endpointArgs = pathArgs[_method] || pathArgs["any"];
      Object.assign(_def, endpointArgs);
      break;
    }
  }
  return { ctx: { req, state }, ...responseDefinition };
};

const _pickUse = R.compose(
  R.prop("use"),
  R.pickBy((_v, key) => key === "use"),
  R.head,
  R.values
);

const execMaybeHandler = async ({ maybeFunction, ctx }) => {
  let res;
  // console.log('props', props)
  if (R.type(maybeFunction) === "AsyncFunction") {
    res = await maybeFunction({ ...ctx });
  } else {
    res =
      R.type(maybeFunction) === "Function"
        ? maybeFunction({ ...ctx })
        : maybeFunction;
  }
  return res;
};

const handleUse = async ({ ctx, ...responseDefinition }) => {
  const url = ctx.req.url;
  for (const [pathPattern, pathArgs] of ctx.state) {
    if (url.startsWith(pathPattern)) {
      const _useHandler = _pickUse(pathArgs);
      if (_useHandler) {
        const handlerCallResult = await execMaybeHandler({
          maybeFunction: _useHandler,
          ctx: { ...ctx, pathPattern },
        });
        // console.log("handlerCallResult", handlerCallResult);
        Object.assign(responseDefinition, handlerCallResult);
        break;
      }
    }
  }
  return { ctx, ...responseDefinition };
};

const handleNotFound = ({ ctx, ...responseDefinition }) => {
  if (ctx.state.has(404) && !R.has("body", responseDefinition)) {
    return {
      ...responseDefinition,
      status: 404,
      body: ctx.state.get(404).body,
    };
  }
  return { ctx, ...responseDefinition };
};

export const resolveBody = async ({
  body: bodyOrHandler,
  params,
  status,
  ctx,
  ...props
}) => {
  const bodyHandlerType = R.type(bodyOrHandler);
  let body;
  if (bodyHandlerType === "AsyncFunction") {
    body = await bodyOrHandler({ params, ctx, ...props });
  } else {
    body =
      bodyHandlerType === "Function"
        ? bodyOrHandler({ params, ctx, ...props })
        : bodyOrHandler;
  }
  if (status) {
    return { body, status };
  }
  if (!body) {
    return { body, status: 404 };
  }
  return { body };
};

export const createResponder = async ({ body, status, ...props }) => {
  const responderObject = { body };
  if (R.type(body) === "AsyncFunction") {
    const _body = await body();
    responderObject.body = _body;
  } else if (R.type(body) === "Object" || R.type(body) === "Array") {
    responderObject.body = { ...body };
  } else if (R.type(body) === "Function") {
    const _body = body();
    responderObject.body = _body;
  }
  if (R.type(responderObject.body) === "Object") {
    responderObject.body = JSON.stringify(responderObject.body);
    responderObject.headers = new Headers({
      "content-type": "application/json",
    });
  }
  if (status) {
    responderObject.status = status;
  }
  return responderObject;
};

export const processRequest = asyncCompose(
  createResponder,
  resolveBody,
  handleNotFound,
  handleUse,
  handleBody
);

export const listen = async ({ app, port = 8000 }) => {
  const { server, state } = destructDeps({ serve, app, port });
  for await (const req of server) {
    const responderObject = await processRequest({ req, state });
    req.respond(responderObject);
  }
};
