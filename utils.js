const _curry = (func) => {
  return function curried(...args) {
    if (args.length >= func.length) {
      return func.apply(this, args);
    } else {
      return function (...args2) {
        return curried.apply(this, args.concat(args2));
      };
    }
  };
};

export const asyncCompose = (...functions) => (input) =>
  functions.reduceRight(
    (chain, func) => chain.then(func),
    Promise.resolve(input)
  );

export const compose = (...fns) => (data) =>
  fns.reduceRight((value, fn) => fn(value), data);

export const isObject = (obj) =>
  Object.prototype.toString.call(obj) === "[object Object]";

export const isArray = (obj) =>
  Object.prototype.toString.call(obj) === "[object Array]";

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
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      return false;
    }
  }
  return true;
};

export const isNil = (obj) => {
  if (typeof obj === "undefined" || obj === null) {
    return true;
  }
  return false;
};

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
