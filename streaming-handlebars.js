class StreamingJavaScriptCompiler extends Handlebars.JavaScriptCompiler {
  mergeSource(varDeclarations) {
    let isSimple = this.environment.isSimple,
        appendOnly = !this.forceBuffer,
        appendFirst,

        sourceSeen,
        bufferStart,
        bufferEnd;
    this.source.each((line) => {
      if (line.appendToBuffer) {
        if (bufferStart) {
          line.prepend(',');
        } else {
          line.prepend('[');
          bufferStart = line;
        }
        bufferEnd = line;
      } else { // TODO: I don't know when this block happens
        if (bufferStart) {
          if (!sourceSeen) {
            appendFirst = true;
          } else {
            bufferStart.prepend('buffer += ');
          }
          bufferEnd.add(';');
          bufferStart = bufferEnd = undefined;
        }

        sourceSeen = true;
        if (!isSimple) {
          appendOnly = false;
        }
      }
    });


    if (appendOnly) {
      if (bufferStart) {
        bufferStart.prepend('return createStreamFromChunks(');
        bufferEnd.add(']);');
      } else if (!sourceSeen) { // TODO: I don't know when this block happens
        this.source.push('return "";');
      }
    } else { // TODO: I don't know when this block happens
      varDeclarations += ', buffer = ' + (appendFirst ? '' : this.initializeBuffer());

      if (bufferStart) {
        bufferStart.prepend('return buffer + ');
        bufferEnd.add(';');
      } else {
        this.source.push('return buffer;');
      }
    }

    if (varDeclarations) {
      this.source.prepend('var ' + varDeclarations.substring(2) + (appendFirst ? '' : ';\n'));
    }

    return this.source.merge();
  }
}

// prevent falling back to the old compiler in recursive calls
// TODO: no idea why they have instance.compiler as a reference to JavaScriptCompiler
StreamingJavaScriptCompiler.prototype.compiler = StreamingJavaScriptCompiler;


const env = Handlebars.create();
env.JavaScriptCompiler = StreamingJavaScriptCompiler;

// TODO: find a better place for this - it shouldn't be sitting on the global
function createStreamFromChunks(chunks) {
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
}

const oldEscape = Handlebars.Utils.escapeExpression;

// make HTML escaping promise & stream aware
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
    })
  }
  return oldEscape(val);
};

{
  const oldIf = env.helpers.if;

  env.registerHelper('if', function ifHelper(conditional, options) {
    if (conditional.then) return Promise.resolve(conditional).then(conditional => ifHelper.call(this, conditional, options));
    return oldIf.call(this, conditional, options);
    // TODO: treat empty streams as false - this is a hard to do without consuming the stream
  });
}

{
  const oldEach = env.helpers.each;

  env.registerHelper('each', function eachHelper(context, options) {
    if (context.then) return Promise.resolve(context).then(context => eachHelper.call(this, context, options));
    if (!context.getReader) return oldEach.call(this, context, options);

    // async ittr…
  });
}

// All of this is just testing…
{
  function wait(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function charAtATime(str) {
    const ittr = str[Symbol.iterator]();

    return new ReadableStream({
      pull(controller) {
        const result = ittr.next();
        if (result.done) {
          controller.close();
          return;
        }
        controller.enqueue(result.value);
      }
    });
  }


  const context = {
    emptyStr: "",
    str: 'yo',
    prom: wait(2000).then(() => "This came from a promise"),
    promEmptyStr: wait(500).then(() => ""),
    strm: charAtATime('From a stream'),
    promStr: wait(5000).then(() => charAtATime('From a promise, from a stream')),
    eacher: [1,2,3,4],
    promFunc: () => wait(500).then(() => "This came from a promise")
  }

  const templateStr = `
    {{#each eacher}}
      {{str}}
    {{/each}}
  `;

  console.log(env.precompile(templateStr));

  const template = env.compile(templateStr);
  const stream = template(context);

  const reader = stream.getReader();


  reader.read().then(function process(result) {
    if (result.done) return;
    console.log(result.value);
    return reader.read().then(process);
  }).then(() => {
    console.log('Stream complete')
  });
}