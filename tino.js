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

const setState = (path, { method, ...props }) => {
  if (!method && props.status) {
    state.set(props.status, { ...U.dissoc("status", props) });
  } else {
    const currentDefinition = state.get(path);
    const pathDefinition = { [method]: { ...props } };

    if (!U.isNil(currentDefinition)) {
      state.set(path, { ...currentDefinition, ...pathDefinition });
    } else {
      state.set(path, pathDefinition);
    }
  }
  return state;
};

const dispatchHandler = (path, { method, ...props }) => {
  setState(path, { method, ...props });
};

const resolveConfig = (configurator) => {
  const configs = configurator();
  return { ...configs };
};

const resolveComposed = (maybeComposed) => {
  if (typeof maybeComposed === "function") {
    return () => maybeComposed();
  }
  return () => maybeComposed;
}

const useDispatch = ({ dispatch = dispatchHandler, ...configs }) => ({
  dispatch,
  ...configs,
});

const updateState = (method) =>
  ({ path, dispatch, ...props }) => {
    dispatch(path, { method, ...props });
  };

const updateNotFoundState = () =>
  ({ path, dispatch, ...props }) => {
    dispatch(path, { status: 404, ...props });
  };

const methodHandler = (method) =>
  U.compose(updateState(method), useDispatch, resolveConfig, resolveComposed);

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
  return handlers();
};

const tino = {
  create,
  listen,
};

export const getStatus = (status = 400, description = null) => ({
  status,
  ...(description && { description }),
});

if (import.meta.main) {
  const app = tino.create();
  const port = U.tryCatch(
    () => Number(optionValue(CliArgument.PORT)),
    () => 8000,
  );
  tino.listen({ app, port });
  console.log(`Server running at :${port}`);
}

export default tino;
