import Handlebars from 'handlebars';
import StreamingJavaScriptCompiler from './StreamingJavaScriptCompiler';
import applyHelpers from './helpers';

// TODO: find a better place for this?
// It really shouldn't be on the global.
// This is called by compiled templates.
window.createStreamFromChunks = function(chunks) {
  return new ReadableStream({
    pull: function processChunk(controller) {
      if (chunks.length === 0) {
        controller.close();
        return;
      }

      const chunk = chunks[0];

      if (chunk.then) {
        return Promise.resolve(chunk).then(val => {
          // replace with resolved value
          chunks[0] = val;
          // reprocess
          return processChunk(controller);
        });
      }

      if (chunk.getReader) {
        // Replace the stream chunk with a reader.
        // This feels kinda funky. Piping would
        // remove the need for this.
        chunks[0] = chunk.getReader();
        return processChunk(controller);
      }

      if (chunk.read) {
        // read chunk
        return chunk.read().then(result => {
          if (result.done) {
            // nothing left. Remove & reprocess
            chunks.shift();
            return processChunk(controller);
          }
          // 'pipe' value
          controller.enqueue(result.value);
        });
      }

      // pass the string along
      controller.enqueue('' + chunk);
      chunks.shift();
      return;
    }
  })
};

// patching escapeExpression
{
  const oldEscape = Handlebars.Utils.escapeExpression;

  Handlebars.Utils.escapeExpression = function escapeExpression(val) {
    if (typeof val == 'undefined') return oldEscape(val);
    if (val.then) return Promise.resolve(val).then(escapeExpression);
    if (val.getReader) {
      const reader = val.getReader();
      return new ReadableStream({
        pull(controller) {
          return reader.read().then(result => {
            if (result.done) {
              controller.close();
              return;
            }
            controller.enqueue(escapeExpression(result.value));
          });
        }
      });
    }
    return oldEscape(val);
  };
}

const env = Handlebars.create();
env.JavaScriptCompiler = StreamingJavaScriptCompiler;
applyHelpers(env);

// Patching compiler
{
  const oldCompile = Handlebars.compile;

  Handlebars.compile = (input, options = {}) => {
    if (options.stream) {
      return env.compile(input, options);
    }
    return oldCompile.call(this, input, options);
  };
}

// Patching precompiler
{
  const oldPrecompile = Handlebars.precompile;

  Handlebars.precompile = (input, options = {}) => {
    if (options.stream) {
      return env.precompile(input, options);
    }
    return oldPrecompile.call(this, input, options);
  };
}

// Global
window.Handlebars = Handlebars;
