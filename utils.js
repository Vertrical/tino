export const asyncCompose = (...functions) => (input) =>
  functions.reduceRight(
    (chain, func) => chain.then(func),
    Promise.resolve(input)
  );
