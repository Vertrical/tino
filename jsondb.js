import { readJson, readFileStr, fileExists } from "./deps.js";
import * as U from "./utils.js";

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
      : { status: 400 };
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
  return { status: 400 };
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

export const tryAllMethods = U.compose(tryPost, tryDelete);

const applyMethods = ({ data, ...props }) => {
  const { method, lensPath, json, query, ctx } = props;
  return tryAllMethods({
    data,
    method,
    lensPath,
    json,
    query,
    body: ctx?.reqBody,
  });
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
  tryRestful,
  tryDirectLens
);

const buildResponseBody = (props) => {
  const { url, method } = props.ctx.req;
  const { pathPattern, query } = props.ctx;
  if (U.isObject(props.json)) {
    const path = url.split("?")[0].replace(pathPattern, "");
    if (U.isEmpty(path) && method !== "POST") {
      return {
        resp: buildResponse({ data: props.json }),
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
      return { resp: payload };
    }
  }
  return {
    resp: props.fileContent,
  };
};

const processJsonOrContent = (file) => U.asyncCompose(buildResponseBody)(file);

const isMutatingRequestMethod = (method) => !["GET", "HEAD"].includes(method);

const jsondb = (
  dryRun = false,
  process = processJsonOrContent,
  checkFile = checkJsonDb
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
        "./db.json",
        JSON.stringify(result, null, 2)
      );
    }
    return { ...res };
  }
  return { status: 404 };
};

export default jsondb;
