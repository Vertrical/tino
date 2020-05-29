import { R } from "./deps.js";
import { listen } from "./server.js";

const state = new Map();

const getState = () => state;

const getStatePath = (path) => state.get(path) || {};

const setState = (path, { method, body, status }) => {
  const statePath = getStatePath(path);
  if (!method) {
    state.set(status, { body });
  } else {
    state.set(path, R.set(R.lensPath([method]), { body }, statePath));
  }
  return state;
};

const dispatchHandler = (path, { method, body, status }) => {
  setState(path, { method, body, status });
};

const resolveConfig = (configurator) => {
  const configs = configurator();
  return { ...configs };
};

const useDispatch = ({ dispatch = dispatchHandler, ...configs }) => ({
  dispatch,
  ...configs,
});

const updateState = (method) => ({ path, body, dispatch }) => {
  dispatch(path, { method, body });
};

const updateNotFoundState = () => ({ path, body, dispatch }) => {
  dispatch(path, { status: 404, body });
};

const methodHandler = (method) =>
  R.compose(updateState(method), useDispatch, resolveConfig);

const notFoundHandler = () =>
  R.compose(updateNotFoundState(), useDispatch, resolveConfig);

const jsonserverHandlers = () => ({
  get: methodHandler("get"),
  post: methodHandler("post"),
  not_found: notFoundHandler(),
  use: () => {},
  setRoute: () => {},
  getState: () => getState(),
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
