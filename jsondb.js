import { readJson, fileExists } from "./deps.js";
import * as U from "./utils.js";
import { HttpStatus } from "./http_server.js";

export const readJsonDb = async (dbPathname = "./db.json") => {
  const content = await Deno.readTextFile(dbPathname);
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
  if (!U.isNil(data) && !next || lensPath.includes("byindex")) {
    return { data, responseData: data, json, lensPath, ...props };
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
    const data = maybeNextItem || undefined;
    return { data, responseData: data, json, lensPath, ...props };
  }
};

export const tryDirectLens = ({ lensPath, json, data, ...props }) => {
  data = data || lensPath.includes("byindex")
    ? U.path(retrievePath(lensPath, json), json)
    : U.path(lensPath, json);
  return { lensPath, data, responseData: data, json, ...props };
};

export const tryProps = ({ data, ...props }) => {
  const { method, lensPath, json } = props;
  if (U.isArray(data) && !U.isEmpty(props.query)) {
    const res = data.filter(
      (item) => U.isObject(item) && U.containsAll(props.query, item),
    );
    return { data: res, responseData: res, method, lensPath, json };
  }
  return { data, method, responseData: data, lensPath, json };
};

export const methodPost = ({ ...props }) => {
  const { lensPath, json, body } = props;
  const path = retrievePath(lensPath, json);
  const targetObj = U.path(path, json);

  const canCreate = !U.isNil(body) &&
    !U.isNil(targetObj) &&
    (U.isArray(targetObj) || U.isObject(targetObj)) &&
    !(U.isEmpty(path) && !U.isEmpty(lensPath));
  if (!U.isArray(targetObj) && !U.isEmpty(lensPath)) {
    return {
      ...props,
      responseData: U.isObject(targetObj) ? {} : null,
      status: HttpStatus.UNPROCESSABLE_ENTITY,
    };
  } else if (canCreate) {
    return {
      data: U.setLens({
        path,
        content: U.isArray(targetObj)
          ? targetObj.concat(body)
          : { ...targetObj, ...body },
        obj: json,
      }),
      responseData: body,
      status: HttpStatus.OK,
    };
  }

  const targetObjectResponseData = U.cond([
    { when: () => U.isArray(targetObj), use: () => [] },
    { when: () => U.isObject(targetObj), use: () => {}  },
    { when: () => true, use: () => null },
  ])();

  return {
    ...props,
    responseData: targetObjectResponseData,
    status: HttpStatus.BAD_REQUEST
  };
};

export const methodPut = ({ ...props }) => {
  const { lensPath, json, body } = props;
  const path = retrievePath(lensPath, json);
  const parentPath = retrievePath(lensPath.slice(0, -1), json);
  const parentObj = !U.isEmpty(path) ? U.path(parentPath, json) : null;
  const targetObj = !U.isEmpty(path) ? U.path(path, json) : null;
  const objectId = lensPath[lensPath.length - 1];

  const canUpdate = U.isObject(targetObj);
  const canCreate = !U.isObject(targetObj) &&
      (U.isArray(parentObj) || U.isObject(parentObj)) ||
    U.isEmpty(lensPath);
  const isParentArray = U.isArray(parentObj);
  let data = U.ifElse(
    () => isParentArray,
    () =>
      canCreate || canUpdate
        ? U.setLens(
          {
            path: U.isEmpty(path) ? parentPath : path,
            content: U.isEmpty(path)
              ? parentObj.concat({ id: objectId, ...body })
              : { id: targetObj.id, ...body },
            obj: json,
          },
        )
        : null,
    () =>
      canCreate || canUpdate
        ? U.setLens(
          {
            path: U.isEmpty(path) ? parentPath : path,
            content: U.isEmpty(path) ? { ...parentObj, ...body } : body,
            obj: json,
          },
        )
        : null,
  )();

  const targetObjectResponseData = U.cond([
    { when: () => U.isArray(targetObj), use: () => [] },
    { when: () => U.isObject(targetObj), use: () => {}  },
    { when: () => true, use: () => null },
  ])();

  if (canUpdate) {
    return {
      data,
      responseData: targetObjectResponseData,
      status: HttpStatus.OK,
    };
  } else if (canCreate) {
    return {
      data,
      responseData: body,
      status: HttpStatus.CREATED,
    };
  }
  return {
    ...props,
    responseData: targetObjectResponseData,
    status: HttpStatus.BAD_REQUEST
  };
};

export const methodPatch = ({ ...props }) => {
  const { lensPath, json, body } = props;
  const path = restfulLensPath(lensPath, json);
  const targetObj = U.path(path, json);

  const canUpdate = U.isObject(targetObj) && U.isObject(body) &&
    !(U.isEmpty(path) && !U.isEmpty(lensPath));
  if (canUpdate) {
    return {
      data: U.setLens({
        path,
        content: { ...targetObj, ...body },
        obj: json,
      }),
      status: HttpStatus.OK,
    };
  }

  const targetObjectResponseData = U.cond([
    { when: () => U.isArray(targetObj), use: () => [] },
    { when: () => U.isObject(targetObj), use: () => {}  },
    { when: () => true, use: () => null },
  ])();

  return {
    ...props,
    responseData: targetObjectResponseData,
    status: HttpStatus.BAD_REQUEST
  };
};

export const methodDelete = ({ ...props }) => {
  const { lensPath, json, query } = props;
  const path = retrievePath(lensPath, json, query);
  const parentPath = path.slice(0, -1);
  const view = U.path(path, json);
  const parentView = U.path(parentPath, json);
  const lastIdx = path.slice(-1);
  const hasQuery = !U.isEmpty(query);

  if (hasQuery && U.isArray(view)) {
    return {
      data: U.setLens({
        path: path,
        content: view.filter((item) =>
          U.isObject(item) && !U.containsAll(query, item)
        ),
        obj: json,
      }),
      status: HttpStatus.OK,
    };
  } else if (U.isArray(parentView)) {
    if (lastIdx !== "" && !isNaN(lastIdx)) {
      parentView.splice(lastIdx, 1);
      return {
        data: U.setLens({ path: parentPath, content: parentView, obj: json }),
        status: HttpStatus.OK,
      };
    }
  } else if (U.isObject(parentView)) {
    if (lastIdx !== "" && U.has(lastIdx, parentView)) {
      const { [lastIdx]: _, ...rest } = parentView;
      return {
        data: U.setLens({ path: parentPath, content: rest, obj: json }),
        status: HttpStatus.OK,
      };
    }
  }
  return U.isEmpty(path) && !U.isEmpty(lensPath)
    ? { ...props, status: HttpStatus.NOT_FOUND }
    : { ...props, status: HttpStatus.BAD_REQUEST };
};

const applyMethod = ({ data, responseData, ...props }) => {
  const { method, lensPath, json, query, ctx } = props;
  const getMethodHandler = U.cond([
    { when: U.eq("POST"), use: methodPost },
    { when: U.eq("PUT"), use: methodPut },
    { when: U.eq("DELETE"), use: methodDelete },
    { when: U.eq("PATCH"), use: methodPatch },
  ]);
  const methodHandler = getMethodHandler(method);
  return methodHandler({
    data,
    responseData,
    method,
    lensPath,
    json,
    query,
    body: ctx?.body,
  });
};

export const buildResponse = ({ data, status, responseData }) => {
  if (U.isArray(data)) {
    return { response: [...data], status, responseData };
  } else if (U.isObject(data)) {
    return { response: { ...data }, status, responseData };
  }
  return { response: data, status, responseData };
};

const isMethod = (method) => (props) => props.method === method;

const applyGetMethod = U.when(
  isMethod("GET"),
  U.compose(tryProps, tryDirectLens, tryRestful),
);

export const handleJson = U.compose(buildResponse, applyMethod, applyGetMethod);

const retrievePath = (lensPath, json) => {
  let finalPath = [];

  for (
    let pathItem = null, pathCopy = [...lensPath], current = { ...json };
    (pathItem = pathCopy.shift());
  ) {
    if (U.isObject(current)) {
      current = current[pathItem];
      finalPath.push(pathItem);
    } else if (U.isArray(current)) {
      const isByIndex = pathCopy.slice(0, 1).includes("byindex");

      if (isByIndex) {
        const index = Number(pathItem);
        const maybeItem = current[index];
        pathCopy = pathCopy.slice(1);
        if (isNaN(index) || maybeItem == null) {
          return [];
        }
        current = maybeItem;
        finalPath.push(`${pathItem}`);
      } else {
        const itemIndex = current.findIndex((item) => item.id == pathItem);
        if (itemIndex < 0) {
          return [];
        }
        current = current[itemIndex];
        finalPath.push(`${itemIndex}`);
      }
    } else {
      return [];
    }
  }

  return finalPath;
};

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
    } else if (U.isString(current)) {
      return finalPath;
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
    const lensPath = path.split("/").filter((x) => x);
    const payload = handleJson({
      lensPath,
      json: props.json,
      query,
      method,
      ...props,
    });
    return {
      resp: { response: payload.response },
      responseData: payload.responseData,
      status: payload.status,
    };
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
) =>
  async (ctx) => {
    const { method } = ctx.req;
    const file = await checkFile();
    if (file.json || file.fileContent) {
      const res = await process({
        json: file.json,
        fileContent: file.fileContent,
        ctx,
      });
      const response = U.path(["resp", "response"], res);
      const status = U.path(["status"], res);
      if (
        file.json && (U.isEmpty(response) || U.isNil(response)) &&
        U.isNil(status)
      ) {
        return U.setTo(res, { status: 404 });
      }
      const result = res.resp.response;
      if (!dryRun && isMutatingRequestMethod(method) && !U.isNil(result)) {
        await Deno.writeTextFile(
          jsonDbPath,
          JSON.stringify(result, null, 2),
        );
      }
      return {
        ...res,
        resp: { response: res.responseData },
      };
    }
    return { status: 404 };
  };

export default jsondb;
