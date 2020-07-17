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
    const { json, fileContent } = await readJsonDb(dbPathname);
    return { json, fileContent };
  } catch (e) {
    console.warn("warn: ", e.message);
    return {};
  }
};

export const tryRestful = ({
  lensPath,
  data,
  json,
  next = false,
  ...props
}) => {
  if (!U.isNil(data) && !next) {
    return { data, json, lensPath, ...props };
  }
  const [singlePathItem, ...restPathItems] = props.restPathItems || lensPath;
  const dataPayload = data || json;
  let maybeNextItem;
  if (U.isArray(data)) {
    maybeNextItem = dataPayload.find((item) => item?.id == singlePathItem);
  } else if (U.isNil(data) || U.isObject(data)) {
    maybeNextItem = U.path([singlePathItem], dataPayload);
  }
  if (restPathItems.length > 0) {
    return tryRestful({
      lensPath,
      data: maybeNextItem,
      json,
      next: true,
      restPathItems,
      ...props,
    });
  } else {
    return { data: maybeNextItem || undefined, json, lensPath, ...props };
  }
};

export const tryDirectLens = ({ lensPath, json, data, ...props }) => {
  return { lensPath, data: data || U.path(lensPath, json), json, ...props };
};

export const tryProps = ({ data, ...props }) => {
  const { method, lensPath, json } = props;
  if (U.isArray(data) && !U.isEmpty(props.query)) {
    const res = data.filter(
      (item) => U.isObject(item) && U.containsAll(props.query, item),
    );
    return { data: res, method, lensPath, json };
  }
  return { data, method, lensPath, json };
};

export const methodPost = ({ ...props }) => {
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
};

export const methodPut = ({ ...props }) => {
  const { lensPath, json, body } = props;
  const path = restfulLensPath(lensPath, json);
  const parentPath = restfulLensPath(lensPath.slice(0, -1), json);
  const parentObj = U.path(parentPath, json);
  const targetObj = U.path(path, json);

  const canUpdateOrCreate = U.isObject(targetObj) ||
    (U.isNil(targetObj) && (U.isArray(parentObj) || U.isObject(parentObj)));
  if (canUpdateOrCreate) {
    return {
      data: U.setLens({
        path,
        content: body,
        obj: json,
      }),
    };
  }
  return { ...props, status: 400 };
};

const methodDelete = ({ ...props }) => {
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
        (item) => U.isObject(item) && !U.containsAll(props.query, item),
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

const applyMethod = ({ data, ...props }) => {
  const { method, lensPath, json, query, ctx } = props;
  const getMethodHandler = U.cond([
    { when: U.eq("POST"), use: methodPost },
    { when: U.eq("PUT"), use: methodPut },
    { when: U.eq("DELETE"), use: methodDelete },
  ]);
  const methodHandler = getMethodHandler(method);
  return methodHandler({
    data,
    method,
    lensPath,
    json,
    query,
    body: ctx?.reqBody,
  });
};

export const buildResponse = ({ data, status }) => {
  if (U.isArray(data)) {
    return { response: [...data], status };
  } else if (U.isObject(data)) {
    return { response: { ...data }, status };
  }
  return { response: data, status };
};

const isMethod = (method) => (props) => props.method === method;

const applyGetMethod = U.when(
  isMethod("GET"),
  U.compose(tryProps, tryDirectLens, tryRestful),
);

export const handleJson = U.compose(
  buildResponse,
  applyMethod,
  applyGetMethod,
);

const restfulLensPath = (lensPath, json) => {
  let finalPath = [];
  for (
    let pathItem = null, pathCopy = [...lensPath], current = { ...json };
    (pathItem = pathCopy.shift());
  ) {
    if (U.isObject(current)) {
      current = current[pathItem];
      finalPath.push(pathItem);
    } else if (U.isArray(current)) {
      const itemIndex = current.findIndex((item) => item.id == pathItem);
      if (itemIndex < 0) {
        return [];
      }
      current = current[itemIndex];
      finalPath.push(`${itemIndex}`);
    } else {
      return [];
    }
  }
  return finalPath;
};

export const buildResponseBody = (props) => {
  const { url, method } = props.ctx.req;
  const { pathPattern, query } = props.ctx;
  if (U.isObject(props.json)) {
    const path = url.split("?")[0].replace(pathPattern, "");
    if (U.isEmpty(path)) {
      return {
        resp: buildResponse({ data: props.json, status: 200 }),
      };
    } else {
      const lensPath = path.split("/").filter((x) => x);
      const payload = handleJson({
        lensPath,
        json: props.json,
        query,
        method,
        ...props,
      });
      return { resp: { response: payload.response }, status: payload.status };
    }
  }
  return {
    resp: props.fileContent,
  };
};

export const processJsonOrContent = (file) =>
  U.asyncCompose(buildResponseBody)(file);

const isMutatingRequestMethod = (method) => !["GET", "HEAD"].includes(method);

export const jsondb = (
  dryRun = false,
  process = processJsonOrContent,
  checkFile = checkJsonDb,
  jsonDbPath = "./db.json",
) => async (ctx) => {
  const { method } = ctx.req;
  const file = await checkFile();
  if (file.json || file.fileContent) {
    const res = await process({
      json: file.json,
      fileContent: file.fileContent,
      ctx,
    });
    if (file.json && U.isEmpty(U.path(["resp", "response"], res))) {
      return U.setTo(res, { status: 404 });
    }
    const result = res.resp.response;
    if (!dryRun && isMutatingRequestMethod(method) && !U.isNil(result)) {
      await Deno.writeTextFile(
        jsonDbPath,
        JSON.stringify(result, null, 2)
      );
    }
    return { ...res };
  }
  return { status: 404 };
};

export default jsondb;
