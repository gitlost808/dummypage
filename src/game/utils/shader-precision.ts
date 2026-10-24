// Phaser 4's filter shaders (glow, blur, ...) hard-code `precision mediump float`. Desktop GPUs run
// mediump as 32-bit floats, but many phone GPUs really use 16-bit, which is too coarse for those
// filters: glowing ships lost their details and blurred ones turned translucent or vanished.
// Phaser's own sprite shaders already use highp when the GPU supports it, so do the same for every
// shader, before Phaser compiles any of them.
const mediumDefault = /precision\s+mediump\s+float\s*;/g;
// wrapped in newlines, since preprocessor directives must start a line
const highWhenSupported = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;

export function preferHighpShaders(): void {
  const contexts = [globalThis.WebGLRenderingContext, globalThis.WebGL2RenderingContext];
  for (const context of contexts) {
    if (!context) continue;
    const shaderSource = context.prototype.shaderSource;
    context.prototype.shaderSource = function (shader: WebGLShader, source: string) {
      shaderSource.call(this, shader, source.replace(mediumDefault, highWhenSupported));
    };
  }
}
