import { readJson, readFileStr, fileExists } from "./deps.js";
import * as U from "./utils.js";
import { getStatus } from "./json_server.js";
import { HttpStatus } from "./http_server.js";

export const readJsonDb = async (dbPathname = "./db.json") => {
  const content = await readFileStr(dbPathname);
  if (U.isEmpty(content)) {
    console.warn("warn: ", "Content is empty");
    return { json: {} };
  }
  try {
    const json = await readJson(dbPathname);
    return { json };
  } catch (e) {
    console.warn("warn: ", e.message);
    return { fileContent: content };
  }
};

export const checkJsonDb = async (dbPathname = "./db.json") => {
  try {
    await fileExists(dbPathname);
    const { json, fileContent } = await readJsonDb();
    return { json, fileContent };
  } catch (e) {
    console.warn("warn: ", e.message);
    return {};
  }
};

const tryDirectLens = ({ lensPath, json, ...props }) => {
  const data = props.method === "GET" ? U.path(lensPath, json) : null;
  return { lensPath, data, json, ...props };
};

export const tryRestful = ({
  lensPath,
  data,
  json,
  next = false,
  ...props
}) => {
  if ((!U.isNil(data) && !next) || props.method !== "GET") {
    return { data, json, lensPath, ...props };
  }
  const [singlePathItem, ...restPathItems] = lensPath;
  const dataPayload = data || json;
  let maybeNextItem;
  if (U.isArray(data)) {
    maybeNextItem = dataPayload.find((item) => item.id == singlePathItem);
  } else if (U.isNil(data) || U.isObject(data)) {
    maybeNextItem = U.path([singlePathItem], dataPayload);
  }
  if (restPathItems.length > 0) {
    return tryRestful({
      lensPath: restPathItems,
      data: maybeNextItem,
      json,
      next: true,
      ...props,
    });
  } else {
    return { data: maybeNextItem || {}, json, lensPath, ...props };
  }
};

const tryProps = ({ data, ...props }) => {
  const { method, lensPath, json } = props;
  if (method !== "GET") {
    return { data, ...props };
  }
  if (U.isArray(data) && !U.isEmpty(props.query)) {
    const res = data.filter(
      (item) => U.isObject(item) && U.containsAll(props.query, item)
    );
    return { data: res, method, lensPath, json };
  }
  return { data, method, lensPath, json };
};

export const tryPost = ({ ...props }) => {
  if (props.method !== "POST") {
    return props;
  }
  const { lensPath, json, body } = props;
  const parentPath = [...lensPath];
  const parentView = U.view(U.lensPath(parentPath))(json);
  const isRootPath = parentPath.length === 0;
  if (isRootPath) {
    return U.isObject(body)
      ? {
          data: U.setLens({
            path: parentPath,
            content: { ...parentView, ...body },
            obj: json,
          }),
        }
      : getStatus(HttpStatus.BAD_REQUEST);
  }
  if (U.isObject(parentView) && U.isObject(body)) {
    return {
      data: U.setLens({
        path: parentPath,
        content: { ...parentView, ...body },
        obj: json,
      }),
    };
  } else if (U.isArray(parentView)) {
    return {
      data: U.setLens({
        path: parentPath,
        content: parentView.concat(U.isArray(body) ? [...body] : body),
        obj: json,
      }),
    };
  }
  return getStatus(HttpStatus.BAD_REQUEST);
};

export const tryPut = ({ ...props }) => {
  if (props.method !== "PUT") {
    return props;
  }
  const { lensPath, json, body } = props;
  const path = restfulLensPath(lensPath, json);
  const parentPath = restfulLensPath(lensPath.slice(0, -1), json);
  const lastIndex = path.slice(-1);

  if (U.isNil(parentPath)) {
    return getStatus(HttpStatus.NOT_FOUND);
  }

  const view = U.view(U.lensPath(path))(json);
  const parentView = U.view(U.lensPath(parentPath))(json);
  const isArrayContainingObjects =
    U.isArray(parentView) && U.isObject(parentView[0]);

  if (isArrayContainingObjects && U.isObject(body)) {
    return U.isNil(view)
      ? {
        data: U.setLens({
          path: parentPath,
          content: parentView.concat({
            ...(body.id == null && { id: Number(lastIndex) }),
            ...body,
          }),
          obj: json,
        })
      }
      : {
        data: U.setLens({
          path,
          content: view,
          obj: json,
        })
      }
  } else if (U.isObject(view)) {
    return U.isObject(body)
      ? { data: U.setLens({ path, content: { ...view, ...body }, obj: json }) }
      : getStatus(HttpStatus.BAD_REQUEST)
  }
  return getStatus(HttpStatus.BAD_REQUEST);
};

const tryDelete = ({ ...props }) => {
  if (props.method !== "DELETE") {
    return props;
  }
  const { lensPath, json } = props;
  const parentPath = [...lensPath];
  const lastIdx = parentPath.pop();
  const parentView = U.view(U.lensPath(parentPath))(json);
  if (U.isArray(parentView)) {
    if (lastIdx !== "" && !isNaN(lastIdx)) {
      parentView.splice(lastIdx, 1);
      return {
        data: U.setLens({ path: parentPath, content: parentView, obj: json }),
      };
    }
  } else {
    const view = U.view(U.lensPath(lensPath))(json);
    if (U.isArray(view) && !U.isEmpty(props.query)) {
      const withQueryApplied = view.filter(
        (item) => U.isObject(item) && !U.containsAll(props.query, item)
      );
      return {
        data: U.setLens({
          path: lensPath,
          content: withQueryApplied,
          obj: json,
        }),
      };
    }
    return {
      data: U.setLens({
        path: lensPath,
        content: withQueryApplied,
        obj: json,
      }),
    };
  }
};

export const tryAllMethods = U.compose(tryPut, tryPost, tryDelete);

const applyMethods = ({ data, ...props }) => {
  const { method, lensPath, json, query, ctx } = props;
  return tryAllMethods({ data, method, lensPath, json, query, body: ctx?.reqBody });
};

const buildResponse = ({ data }) => {
  if (U.isArray(data)) {
    return { response: [...data] };
  } else if (U.isObject(data)) {
    return { response: { ...data } };
  }
  return { response: data };
};

const handleJson = U.compose(
  buildResponse,
  applyMethods,
  tryProps,
  tryDirectLens,
  tryRestful,
);

const methodShouldProcessRootPath = (method) =>
  ["POST", "PUT"].includes(method);

const restfulLensPath = (lensPath, json) => {
  let finalPath = [];

  for (
      let pathItem = null,
          pathCopy = [...lensPath],
          current = {...json};
      pathItem = pathCopy.shift();
  ) {
      if (Number.isNaN(Number(pathItem))) {
          current = current[pathItem];
          finalPath.push(pathItem);
      } else {
          const itemIndex = current.findIndex((item) => item.id == pathItem);
  
          if (itemIndex === -1) {
              return null;
          }
  
          current = current[itemIndex];
          finalPath.push(`${itemIndex}`);
      }
  }
  
  return finalPath;  
}

const buildResponseBody = (props) => {
  const { url, method } = props.ctx.req;
  const { pathPattern, query } = props.ctx;
  if (U.isObject(props.json)) {
    const path = url.split("?")[0].replace(pathPattern, "");
    if (U.isEmpty(path) && !methodShouldProcessRootPath(method)) {
      return {
        resp: buildResponse({ data: props.json }),
      };
    } else {
      const lensPath = path.split("/").filter((x) => x);
      const payload = handleJson({ lensPath, json: props.json, query, method, ...props });
      return { resp: payload };
    }
  }
  return {
    resp: props.fileContent,
  };
};

const processJsonOrContent = (file) => U.asyncCompose(buildResponseBody)(file);

const jsondb = (
  process = processJsonOrContent,
  checkFile = checkJsonDb
) => async (ctx) => {
  const file = await checkFile();
  if (file.json || file.fileContent) {
    const res = await process({
      json: file.json,
      fileContent: file.fileContent,
      ctx,
    });
    if (file.json && U.isEmpty(U.path(["resp", "response"], res))) {
      return U.setTo(res, getStatus(HttpStatus.NOT_FOUND));
    }
    return { ...res };
  }
  return getStatus(HttpStatus.NOT_FOUND);
};

export default jsondb;
