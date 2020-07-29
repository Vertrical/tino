import { listen } from "./http_server.js";
import jsondb from "./jsondb.js";
import * as U from "./utils.js";
import { optionValue, CliArgument } from "./cli.js";

export { jsondb };

const state = new Map();

const getState = () => {
  state.set("/api", {
    any: {
      use: jsondb(
        U.tryCatch(
          () => optionValue(CliArgument.DRY_RUN) === "true",
          () => false,
        ),
      ),
    },
  });
  return () => state;
};

const setState = (path, { method, resp, ...props }) => {
  if (!method && props.status) {
    state.set(props.status, { resp, ...U.dissoc("status", props) });
  } else {
    const currentDefinition = state.get(path);
    const pathDefinition = { [method]: { resp, ...props } };

    if (!U.isNil(currentDefinition)) {
      state.set(path, { ...currentDefinition, ...pathDefinition });
    } else {
      state.set(path, pathDefinition);
    }
  }
  return state;
};

const dispatchHandler = (path, { method, resp, ...props }) => {
  setState(path, { method, resp, ...props });
};

const resolveConfig = (configurator) => {
  const configs = configurator();
  return { ...configs };
};

const useDispatch = ({ dispatch = dispatchHandler, ...configs }) => ({
  dispatch,
  ...configs,
});

const updateState = (method) =>
  ({ path, resp, dispatch, ...props }) => {
    dispatch(path, { method, resp, ...props });
  };

const updateNotFoundState = () =>
  ({ path, resp, dispatch }) => {
    dispatch(path, { status: 404, resp });
  };

const methodHandler = (method) =>
  U.compose(updateState(method), useDispatch, resolveConfig);

const notFoundHandler = () =>
  U.compose(updateNotFoundState(), useDispatch, resolveConfig);

const jsonserverHandlers = () => ({
  get: methodHandler("get"),
  post: methodHandler("post"),
  put: methodHandler("put"),
  patch: methodHandler("patch"),
  delete: methodHandler("delete"),
  any: methodHandler("any"),
  not_found: notFoundHandler(),
  getState: getState(),
});

const create = (handlers = jsonserverHandlers) => {
  // const create = () => {
  return handlers();
  // return () => {}
};

const json_server = {
  create,
  listen,
};

export const getStatus = (status = 400, description = null) => ({
  status,
  ...(description && { description }),
});

export const compose = () => {};

export const tap = () => {};

export const localdb = () => {};

if (import.meta.main) {
  const app = json_server.create();
  const port = U.tryCatch(
    () => Number(optionValue(CliArgument.PORT)),
    () => 8000,
  );
  json_server.listen({ app, port });
  console.log(`Server running at :${port}`);
}

export default json_server;
