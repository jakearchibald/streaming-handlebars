import Handlebars from 'handlebars';

// This is the only bit of parser patching I've had to do
export default class StreamingJavaScriptCompiler extends Handlebars.JavaScriptCompiler {
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
        // TODO: this also ends up being called in nested templates.
        // That works, but I imagine it's a bit of a performance vampire.
        // Better to just return an array and let the parent createStreamFromChunks handle it 
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
// TODO: no idea why instance.compiler is a reference to JavaScriptCompiler
StreamingJavaScriptCompiler.prototype.compiler = StreamingJavaScriptCompiler;