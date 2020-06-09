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
  const data = U.path(lensPath, json);
  return { lensPath, data, json, ...props };
};

export const tryRestful = ({
  lensPath,
  data,
  json,
  next = false,
  ...props
}) => {
  if (!U.isNil(data) && !next) {
    return { data, ...props };
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
    return { data: maybeNextItem || {}, ...props };
  }
};

const tryProps = ({ data, ...props }) => {
  if (U.isArray(data) && U.has("query", props)) {
    const res = data.filter(
      (item) => U.isObject(item) && U.containsAll(props.query, item)
    );
    return { data: res };
  }
  return { data };
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
  tryProps,
  tryRestful,
  tryDirectLens
);

const buildBody = (props) => {
  const { url, method } = props.ctx.req;
  const { pathPattern, query } = props.ctx;
  if (U.isObject(props.json)) {
    const path = url.split("?")[0].replace(pathPattern, "");
    if (U.isEmpty(path)) {
      return {
        body: buildResponse({ data: props.json }),
      };
    } else {
      const lensPath = path.split("/").filter((x) => x);
      const payload = handleJson({ lensPath, json: props.json, query });
      return { body: payload };
    }
  }
  return {
    body: props.fileContent,
  };
};

const processJsonOrContent = (file) => U.asyncCompose(buildBody)(file);

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
    if (file.json && U.isEmpty(U.path(["body", "response"], res))) {
      return U.setTo(res, { status: 404 });
    }
    return { ...res };
  }
  return { status: 404 };
};

export default jsondb;
