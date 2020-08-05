import { pathToRegexp, serve } from "./deps.js";

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
  const ctx = { req, state, bodyReader };
  for (const [pathPattern, pathArgs] of state) {
    const matchedPath = tryParsePath({
      matcher: pathToRegexp.match,
      path: pathPattern,
      url: baseUrl,
    });
    if (U.isObject(matchedPath)) {
      ctx.matchedPath = matchedPath;
      ctx.pathPattern = pathPattern;
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
  return { ctx, ...responseDefinition };
};

const controllerUseHandler = async ({ maybeFunction, ctx }) => {
  let res;
  const shakeCtx = U.dissoc('req', U.dissoc('state', ctx));
  if (U.isAsyncFunction(maybeFunction)) {
    res = await maybeFunction({ ...shakeCtx });
  } else {
    res = U.isFunction(maybeFunction)
      ? maybeFunction({ ...shakeCtx })
      : maybeFunction;
  }
  return res;
};

const handleUse = async ({ ctx, ...responseDefinition }) => {
  const handlerCallResult = await controllerUseHandler({
    maybeFunction: responseDefinition.use,
    ctx: { ...ctx, ...responseDefinition },
  });
  Object.assign(responseDefinition, handlerCallResult);
  return { ctx, ...responseDefinition };
};

const handleNotFound = ({ ctx, ...responseDefinition }) => {
  if (ctx.state.has(404) && !responseDefinition.resp) {
    const { resp, type } = ctx.state.get(404);
    const res = {
      ...responseDefinition,
      status: 404,
      resp: ctx.state.get(404).resp,
    };
    return type ? Object.assign(res, { type }) : res;
  }
  return { ctx, ...responseDefinition };
};

export const resolveResponse = async ({
  resp: responseOrHandler,
  params,
  status,
  type,
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
    return { resp, status, type };
  }
  if (!resp) {
    return { resp, status: 404 };
  }
  return { resp, type };
};

export const createResponder = async ({ resp, status, type }) => {
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
  if (status) {
    responderObject.status = status;
  }
  responderObject.headers = U.cond([
    {
      when: () => !U.isNil(type),
      use: new Headers({ "Content-Type": type }),
    },
    {
      when: U.isObject || U.isArray,
      use: new Headers({ "Content-Type": ContentType.JSON }),
    },
    {
      when: () => true,
      use: new Headers({ "Content-Type": ContentType.PLAIN_TEXT }),
    },
  ])(responderObject.body);
  if (U.isObject(responderObject.body) || U.isArray(responderObject.body)) {
    responderObject.body = JSON.stringify(responderObject.body);
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

export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  UNPROCESSABLE_ENTITY: 422,
};

export const ContentType = {
  PLAIN_TEXT: "text/plain",
  JSON: "application/json",
  HTML: "text/html",
};

export const tryComposedMiddlewares = async (
  { ctx, ...responseDefinition },
) => {
  const middlewaresResult = U.path(
    ["use", "middlewaresResult"],
    responseDefinition,
  );
  if (!U.isFunction(middlewaresResult)) {
    return { ctx, ...responseDefinition };
  }
  try {
    const newProps = await responseDefinition.use.middlewaresResult(
      { ctx, ...responseDefinition },
    );
    Object.assign(responseDefinition, { ...U.dissoc("ctx", newProps) });
    responseDefinition.use = responseDefinition.use.responder;
  } catch (e) {
    if (!U.isObject(e) || !e.resp && !e.status) {
      responseDefinition.use = () => ({ status: 500 });
    }
    const caughtResponder = { status: e.status, resp: e.resp };
    if (U.isString(e.type)) {
      caughtResponder.type = e.type;
    }
    responseDefinition.use = () => ({ ...caughtResponder });
  }
  return { ctx, ...responseDefinition };
};

export const processRequest = U.asyncCompose(
  createResponder,
  resolveResponse,
  handleNotFound,
  handleUse,
  resolveRequestBody,
  tryComposedMiddlewares,
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
