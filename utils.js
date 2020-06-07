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

export const path = (p, o) =>
  p.reduce((xs, x) => (xs && xs[x] ? xs[x] : null), o);

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
