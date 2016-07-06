// This allows us to peak into a stream without consuming it.
// When we need to peak into a stream, it's teed, and the
// remaining readable part is stored here. If anything handles
// streams, it should look in here for the 'real' stream.
const streamsMap = new WeakMap();

export function cloneStream(stream) {
  const [a, b] = stream.tee();
  streamsMap.set(stream, a);
  return b;
}

export function getRealStream(stream) {
  return streamsMap.get(stream) || stream;
}
