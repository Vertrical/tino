import { listen } from "./http_server.js";
import jsondb from "./jsondb.js";
import * as U from "./utils.js";

export { jsondb };

const state = new Map();

state.set("/api", { any: { use: jsondb() } });

const getState = () => state;

const setState = (path, { method, body, ...props }) => {
  if (!method && props.status) {
    state.set(props.status, { body, ...U.dissoc("status", props) });
  } else {
    const pathDefinition = { [method]: { body, ...props } };
    state.set(path, pathDefinition);
  }
  return state;
};

const dispatchHandler = (path, { method, body, ...props }) => {
  setState(path, { method, body, ...props });
};

const resolveConfig = (configurator) => {
  const configs = configurator();
  return { ...configs };
};

const useDispatch = ({ dispatch = dispatchHandler, ...configs }) => ({
  dispatch,
  ...configs,
});

const updateState = (method) => ({ path, body, dispatch, ...props }) => {
  dispatch(path, { method, body, ...props });
};

const updateNotFoundState = () => ({ path, body, dispatch }) => {
  dispatch(path, { status: 404, body });
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
