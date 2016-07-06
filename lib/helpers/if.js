import {getRealStream, cloneStream} from '../stream-helpers';

export default function applyHelper(env) {
  const oldIf = env.helpers.if;

  env.registerHelper('if', function ifHelper(conditional, options) {
    if (conditional.then) return Promise.resolve(conditional).then(conditional => ifHelper.call(this, conditional, options));
    if (conditional.getReader) {
      // treat streams that yield nothing as false, similar to how [] is false
      conditional = cloneStream(getRealStream(conditional));
      return conditional.getReader().read().then(result => ifHelper.call(this, !result.done, options));
    }
    return oldIf.call(this, conditional, options);
  });
}