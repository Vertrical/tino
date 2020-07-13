import { listen } from "./http_server.js";
import jsondb from "./jsondb.js";
import * as U from "./utils.js";
import { optionValue, CliArgument } from "./cli.js";

export { jsondb };

const state = new Map();

state.set("/api", {
  any: {
    use: jsondb(
      U.tryCatch(
        () => optionValue(CliArgument.DRY_RUN) === "true",
        () => false
      )
    ),
  },
});

const getState = () => state;

const setState = (path, { method, resp, ...props }) => {
  if (!method && props.status) {
    state.set(props.status, { resp, ...U.dissoc("status", props) });
  } else {
    const pathDefinition = { [method]: { resp, ...props } };
    state.set(path, pathDefinition);
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

const updateState = (method) => ({ path, resp, dispatch, ...props }) => {
  dispatch(path, { method, resp, ...props });
};

const updateNotFoundState = () => ({ path, resp, dispatch }) => {
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
  getState,
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

export const compose = () => {};

export const tap = () => {};

export const localdb = () => {};

export default json_server;
