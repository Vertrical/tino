import { pathToRegexp } from "./deps.js";
import { serve } from "https://deno.land/std@0.50.0/http/server.ts";
import * as U from "./utils.js";

const tryParsePath = ({ matcher, path, url }) => {
  return U.tryCatch(
    () => matcher(path, { decode: decodeURIComponent })(url),
    () => false,
  );
};

const destructDeps = ({ serve, app, port = 8000 }) => {
  const server = serve({ port });
  const state = app.getState();
  return { server, state };
};

const prepareContext = ({ req, state, bodyReader }) => {
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
  return { ctx: { req, state, bodyReader }, ...responseDefinition };
};

const _pickUse = U.compose(
  U.path(["use"]),
  ([head, ..._tail]) => head,
  Object.values,
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
  if (ctx.state.has(404) && !responseDefinition.resp) {
    return {
      ...responseDefinition,
      status: 404,
      resp: ctx.state.get(404).resp,
    };
  }
  return { ctx, ...responseDefinition };
};

export const resolveResponse = async ({
  resp: responseOrHandler,
  params,
  status,
  ctx,
  ...props
}) => {
  let resp;
  if (U.isAsyncFunction(responseOrHandler)) {
    resp = await responseOrHandler({ params, ctx, ...props });
  } else {
    resp = U.isFunction(responseOrHandler)
      ? responseOrHandler({ params, ctx, ...props })
      : responseOrHandler;
  }
  if (status) {
    return { resp, status };
  }
  if (!resp) {
    return { resp, status: 404 };
  }
  return { resp };
};

export const createResponder = async ({ resp, status, ...props }) => {
  const responderObject = { body: resp };
  if (U.isAsyncFunction(resp)) {
    const _resp = await resp();
    responderObject.body = _resp;
  } else if (U.isObject(resp)) {
    responderObject.body = { ...resp };
  } else if (U.isArray(resp)) {
    responderObject.body = [...resp];
  } else if (U.isFunction(resp)) {
    const _resp = resp();
    responderObject.body = _resp;
  }
  if (U.isObject(responderObject.body) || U.isArray(responderObject.body)) {
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

export const resolveRequestBody = async ({ ...props }) => {
  const { ctx } = props;
  const { bodyReader } = ctx;
  const parsedBody = await bodyReader(ctx.req.body);
  const body = U.tryCatch(
    () => JSON.parse(parsedBody),
    () => parsedBody,
  );
  return { body, ...props };
};

export const processRequest = U.asyncCompose(
  createResponder,
  resolveResponse,
  handleNotFound,
  handleUse,
  resolveRequestBody,
  prepareContext,
);

const _bodyReader = async (body) =>
  new TextDecoder("utf-8").decode(
    await Deno.readAll(body),
  );

export const listen = async ({ app, port = 8000 }) => {
  const { server, state } = destructDeps({ serve, app, port });
  for await (const req of server) {
    const responderObject = await processRequest(
      { req, state, bodyReader: _bodyReader },
    );
    req.respond(responderObject);
  }
};
