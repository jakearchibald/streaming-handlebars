export default function applyHelper(env) {
  const oldIf = env.helpers.if;

  env.registerHelper('if', function ifHelper(conditional, options) {
    if (conditional.then) return Promise.resolve(conditional).then(conditional => ifHelper.call(this, conditional, options));
    return oldIf.call(this, conditional, options);
    // TODO: treat empty streams as false - this is a hard to do without consuming the stream
  });
};