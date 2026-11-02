import { detectEdges } from './edges.js';

self.onmessage = (e) => {
  const { w, h, buf } = e.data;
  const out = detectEdges(new Uint8ClampedArray(buf), w, h);
  self.postMessage({ buf: out.buffer }, [out.buffer]);
};
