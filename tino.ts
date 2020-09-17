import { listen } from "./http_server.ts";
import jsondb from "./jsondb.ts";
import * as U from "./utils.ts";
import { optionValue, CliArgument } from "./cli.ts";

export { jsondb };

type TinoHTTPMethod = "get" | "post" | "put" | "patch" | "delete" | "any";

interface IUseProps {
  body: Record<string, unknown>;
  params: Record<string, unknown>;
  query: Record<string, unknown>;
  matchedPath: IMatchedPath;
  pathPattern: string;
  req: { method: string; url: string };
  [k: string]: unknown;
}

interface IMethodProps {
  method: TinoHTTPMethod;
  path: string;
  use?: (props: IUseProps) => { resp: unknown; status?: number; type?: string };
  resp?: unknown;
  status?: number;
  root?: boolean;
  [k: string]: unknown;
}

interface IDispatchProps {
  method: TinoHTTPMethod;
  use?: (props: IUseProps) => { resp: unknown; status?: number; type?: string };
  resp?: unknown;
  status?: number;
  root?: boolean;
  [k: string]: unknown;
}

type DispatchHandler = (path: string, props: IDispatchProps) => void;

interface IMatchedPath {
  index: number;
  params: Record<string, string>;
  path: string;
}

type StateProp = Omit<IMethodProps, "path">;

type StateMethodProp = Partial<Record<TinoHTTPMethod, StateProp>>;

export type TinoState = Map<string | number, StateMethodProp>;

const state: TinoState = new Map();

const getState = (): (() => TinoState) => {
  const initialState: StateMethodProp = {
    any: {
      use: jsondb(
        U.tryCatch(
          () => optionValue(CliArgument.DRY_RUN) === "true",
          () => false,
        ),
      ),
      root: true,
    },
  };
  state.set("/jsondb", initialState);
  return () => state;
};

const setState = (
  path: string,
  props: IDispatchProps,
) => {
  if (!props.method && props.status) {
    state.set(props.status, { ...U.dissoc("status", props) });
  } else {
    const currentDefinition = state.get(path);
    const pathDefinition = { [props.method]: { ...props } };

    if (!U.isNil(currentDefinition)) {
      state.set(path, { ...currentDefinition, ...pathDefinition });
    } else {
      state.set(path, pathDefinition);
    }
  }
  return state;
};

const dispatchHandler: DispatchHandler = (
  path: string,
  { method, ...props }: { method: TinoHTTPMethod; [k: string]: unknown },
) => {
  setState(path, { method, ...props });
};

const useDispatch = ({ dispatch = dispatchHandler, ...configs }) => ({
  dispatch,
  ...configs,
});

const updateState = (method: TinoHTTPMethod) =>
  (
    { path, dispatch, ...props }: {
      path: string;
      dispatch: DispatchHandler;
      [k: string]: unknown;
    },
  ) => {
    dispatch(path, { method, ...props });
  };

const updateNotFoundState = () =>
  (
    { path, dispatch, method, ...props }: {
      path: string;
      dispatch: DispatchHandler;
      method: TinoHTTPMethod;
      [k: string]: unknown;
    },
  ) => {
    dispatch(path, { status: 404, method, ...props });
  };

interface IControllerDefinition {
  path: string;
  resp: unknown;
  status?: number;
}

const resolveConfig = (configurator: () => IControllerDefinition) => {
  const configs = configurator();
  return { ...configs };
};

const methodHandler = (method: TinoHTTPMethod) =>
  U.compose(updateState(method), useDispatch, resolveConfig);

const notFoundHandler = () =>
  U.compose(updateNotFoundState(), useDispatch, resolveConfig);

type TinoMethods =
  | "get"
  | "post"
  | "put"
  | "patch"
  | "delete"
  | "any"
  | "not_found"
  | "getState";

export type TinoApp = Record<TinoMethods, (data?: unknown) => unknown>;

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

const create = (handlers = jsonserverHandlers): TinoApp => {
  return handlers();
};

const tino = {
  create,
  listen,
};

export const getStatus = (status = 400, description = "") => ({
  status,
  ...(description && { description }),
});

export const withMiddlewares = (...fns: ((props: unknown) => unknown)[]) => {
  const composedResult = U.asyncPipe(...fns);
  return (responder: (props: unknown) => unknown) => ({
    middlewaresResult: composedResult,
    responder,
  });
};

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
