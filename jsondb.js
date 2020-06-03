import { R, readJson, readFileStr, fileExists, pathToRegexp } from "./deps.js";
import { asyncCompose } from "./utils.js";

export const readJsonDb = async (dbPathname = "./db.json") => {
  const content = await readFileStr(dbPathname);
  if (R.isEmpty(content)) {
    return {};
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

const tryDirectLens = ({ lensPath, json }) => {
  const data = R.view(R.lensPath(lensPath), json);
  return { lensPath, data, json };
};

const tryRestful = ({ lensPath, data, json, next = false }) => {
  if (!R.isNil(data) && !next) {
    return { data };
  }
  const singlePathItem = R.head(lensPath);
  const restPathItems = R.tail(lensPath);
  const dataPayload = data || json;
  let maybeNextItem;
  if (R.type(data) === "Array") {
    maybeNextItem = R.find((item) => item.id == singlePathItem)(dataPayload);
  } else if (R.type(data) === "Object" || R.isNil(data)) {
    maybeNextItem = R.view(R.lensPath([singlePathItem]), dataPayload);
  }
  if (restPathItems.length > 0) {
    return tryRestful({
      lensPath: restPathItems,
      data: maybeNextItem,
      json,
      next: true,
    });
  } else {
    return { data: maybeNextItem };
  }
};

const tryProps = ({ data }) => {
  return { data };
};

const handleJson = R.compose(tryProps, tryRestful, tryDirectLens);

const handler = (props) => {
  const { url } = props.ctx.req;
  const { pathPattern } = props.ctx;
  if (R.is(Object)(props.json)) {
    const path = R.replace(pathPattern, "", url);
    if (R.isEmpty(path)) {
      return {
        body: props.json,
      };
    } else {
      const lensPath = path.split("/").filter((x) => x);
      const payload = handleJson({ lensPath, json: props.json });
      console.log("payload", payload);
      return { body: { ...payload } };
    }
  }
  return {
    body: props.fileContent,
  };
};

const processJsonOrContent = (file) => asyncCompose(handler)(file);

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
    if (file.json && R.isNil(R.path(["body", "data"])(res))) {
      return R.set(R.lensPath(["status"]), 404)(res);
    }
    console.log("---res", res);
    return { ...res };
  }
  return { status: 404 };
};

export default jsondb;
