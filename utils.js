const _curry = (fn) =>
  (...args) =>
    args.length >= fn.length
      ? fn(...args)
      : _curry(fn.bind(undefined, ...args));

export const asyncCompose = (...functions) =>
  (input) =>
    functions.reduceRight(
      (chain, func) => chain.then(func),
      Promise.resolve(input),
    );

export const asyncPipe = (...functions) =>
  (input) =>
    functions.reduce(
      (chain, func) => chain.then(func),
      Promise.resolve(input),
    );

export const compose = (...fns) =>
  (data) => fns.reduceRight((value, fn) => fn(value), data);

export const isString = (obj) =>
  Object.prototype.toString.call(obj) === "[object String]";

export const isObject = (obj) =>
  Object.prototype.toString.call(obj) === "[object Object]";

export const isArray = (obj) => Array.isArray(obj);

export const isFunction = (obj) =>
  Object.prototype.toString.call(obj) === "[object Function]";

export const isAsyncFunction = (obj) =>
  Object.prototype.toString.call(obj) === "[object AsyncFunction]";

export const path = _curry((p, o) =>
  p.reduce((xs, x) => (xs && xs[x] ? xs[x] : null), o)
);

export const has = (prop, obj) =>
  Object.prototype.hasOwnProperty.call(obj, prop);

export const isEmpty = (obj) => {
  if (isNil(obj)) {
    return false;
  } else if (isArray(obj)) {
    return obj.length === 0;
  } else if (isString(obj)) {
    return obj === "";
  } else if (isObject(obj)) {
    return Object.keys(obj).length === 0 && obj.constructor === Object;
  }

  return false;
};

export const isNil = (obj) => typeof obj === "undefined" || obj === null;

export const ifElse = _curry((condition, onTrue, onFalse) =>
  (...args) =>
    condition.apply(this, ...args)
      ? onTrue.apply(this, ...args)
      : onFalse.apply(this, ...args)
);

export const setTo = (obj, chunk) => Object.assign({}, obj, chunk);

export const tryCatch = (fn1, fn2) => {
  try {
    return fn1();
  } catch (_e) {
    return fn2();
  }
};

export const pickBy = (o, prop) => Object.keys(o).find;

export const tap = _curry((logger, any) => {
  logger(any);
  return any;
});

export const dissoc = (prop, o) => {
  var result = {};
  for (var p in o) {
    result[p] = o[p];
  }
  delete result[prop];
  return result;
};

export const containsAll = (inputObj, obj) => {
  var idx = 0;
  const names = Object.keys(inputObj);
  var len = names.length;
  while (idx < len) {
    var name = names[idx];
    if (!obj[name] || obj[name] !== inputObj[name]) {
      return false;
    }
    idx += 1;
  }
  return true;
};

export const cond = (conditions) =>
  (method) => {
    const _cond = conditions.find(
      (cond) => has("when", cond) && cond.when(method),
    );
    if (!_cond) {
      return (props) => props;
    }
    return path(["use"], _cond);
  };

export const eq = (val) => (comp) => val === comp;

export const when = (condFunc, applyFunc) =>
  (props) => {
    if (condFunc(props)) {
      return applyFunc(props);
    }
    return props;
  };

// lenses
const prop = _curry((k, obj) => (obj ? obj[k] : undefined));

const assoc = _curry((k, v, obj) => {
  if (!Number.isNaN(Number(k))) {
    obj[k] = v;
    return [...obj];
  }
  return { ...obj, [k]: v };
});

const lens = _curry((getter, setter) =>
  (F) => (target) => F(getter(target)).map((focus) => setter(focus, target))
);

const lensProp = (k) => lens(prop(k), assoc(k));

export const lensPath = (path) => compose(...path.map(lensProp));

const always = (a) => () => a;

const setFunctor = (x) =>
  Object.freeze({
    value: x,
    map: (f) => setFunctor(f(x)),
  });

const getFunctor = (x) =>
  Object.freeze({
    value: x,
    map: (f) => getFunctor(x),
  });

const over = _curry((lens, f, obj) => lens((y) => setFunctor(f(y)))(obj).value);

export const view = _curry((lens, obj) => lens(getFunctor)(obj).value);
export const set = _curry((lens, val, obj) => over(lens, always(val), obj));

export const setLens = ({ path, content, obj }) =>
  set(lensPath(path))(content)(obj);
