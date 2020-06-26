import { pathToRegexp } from "./deps.js";
import { serve } from "https://deno.land/std@0.50.0/http/server.ts";
import * as U from "./utils.js";

const tryParsePath = ({ matcher, path, url }) => {
  return U.tryCatch(
    () => matcher(path, { decode: decodeURIComponent })(url),
    () => false
  );
};

const destructDeps = ({ serve, app, port = 8000 }) => {
  const server = serve({ port });
  const state = app.getState();
  return { server, state };
};

const prepareContext = ({ req, state }) => {
  const url = req.url;
  const baseUrl = url.split("?")[0];
  const queryParamsString = url.split("?")[1];
  const responseDefinition = {
    params: {},
    query: {},
  };
  for (const [pathPattern, pathArgs] of state) {
    const matchedPath = tryParsePath({
      matcher: pathToRegexp.match,
      path: pathPattern,
      url: baseUrl,
    });
    if (U.isObject(matchedPath)) {
      responseDefinition.params = { ...matchedPath.params };
      const _method = req.method.toLowerCase();
      const _hasMethod = pathArgs[_method] || pathArgs["any"];
      if (U.has("path", matchedPath) && _hasMethod) {
        const endpointArgs = pathArgs[_method] || pathArgs["any"];
        Object.assign(responseDefinition, endpointArgs);
        break;
      }
    }
  }
  if (queryParamsString) {
    const searchQueryParams = new URLSearchParams(queryParamsString);
    for (const [queryName, queryValue] of searchQueryParams) {
      Object.assign(responseDefinition.query, { [queryName]: queryValue });
    }
  }
  return { ctx: { req, state }, ...responseDefinition };
};

const _pickUse = U.compose(
  U.path(["use"]),
  ([head, ..._tail]) => head,
  Object.values
);

const execMaybeHandler = async ({ maybeFunction, ctx }) => {
  let res;
  if (U.isAsyncFunction(maybeFunction)) {
    res = await maybeFunction({ ...ctx });
  } else {
    res = U.isFunction(maybeFunction)
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
          ctx: { ...ctx, pathPattern, ...responseDefinition },
        });
        Object.assign(responseDefinition, handlerCallResult);
        break;
      }
    }
  }
  return { ctx, ...responseDefinition };
};

const handleNotFound = ({ ctx, ...responseDefinition }) => {
  if (ctx.state.has(404) && !responseDefinition.body) {
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
  let body;
  if (U.isAsyncFunction(bodyOrHandler)) {
    body = await bodyOrHandler({ params, ctx, ...props });
  } else {
    body = U.isFunction(bodyOrHandler)
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

export const resolveRequestBody = async ({ ...props }) => {
  const { ctx } = props;
  const parsedBody = new TextDecoder("utf-8").decode(
    await Deno.readAll(ctx.req.body)
  );
  const body = U.tryCatch(
    () => JSON.parse(parsedBody),
    () => parsedBody
  );

  return { reqBody: body, ...props };
};

export const createResponder = async ({ body, status, ...props }) => {
  const responderObject = { body };
  if (U.isAsyncFunction(body)) {
    const _body = await body();
    responderObject.body = _body;
  } else if (U.isObject(body) || U.isArray(body)) {
    responderObject.body = { ...body };
  } else if (U.isFunction(body)) {
    const _body = body();
    responderObject.body = _body;
  }
  if (U.isObject(responderObject.body)) {
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

export const processRequest = U.asyncCompose(
  createResponder,
  resolveBody,
  handleNotFound,
  handleUse,
  resolveRequestBody,
  prepareContext
);

export const listen = async ({ app, port = 8000 }) => {
  const { server, state } = destructDeps({ serve, app, port });
  for await (const req of server) {
    const responderObject = await processRequest({ req, state });
    req.respond(responderObject);
  }
};
