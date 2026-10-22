import { panoramaSample } from '../../runtime/panorama-sample'
export interface View { yaw: number; pitch: number; fov: number }
export interface TouchPoint { x: number; y: number }
export const initialView = (): View => ({ yaw: 0, pitch: 0, fov: 75 })
export const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value))
export function moveView(view: View, before: TouchPoint[], after: TouchPoint[]): View {
  if (!before.length || !after.length) return view
  if (before.length === 2 && after.length === 2) {
    const distance = (points: TouchPoint[]) => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
    const oldDistance = distance(before), newDistance = distance(after)
    return { ...view, fov: newDistance > 1 && oldDistance > 1 ? clamp(view.fov * oldDistance / newDistance, 35, 100) : view.fov }
  }
  if (before.length !== after.length) return view
  return { ...view, yaw: ((view.yaw - (after[0].x - before[0].x) * 0.25) % 360 + 360) % 360,
    pitch: clamp(view.pitch + (after[0].y - before[0].y) * 0.25, -85, 85) }
}
export function sphereGeometry(columns = 64, rows = 32): { vertices: Float32Array; indices: Uint16Array } {
  const vertices: number[] = [], indices: number[] = []
  for (let row = 0; row <= rows; row++) {
    const v = row / rows, latitude = (0.5 - v) * Math.PI
    for (let column = 0; column <= columns; column++) {
      const u = column / columns, longitude = (u - 0.5) * 2 * Math.PI
      vertices.push(Math.sin(longitude) * Math.cos(latitude), Math.sin(latitude), -Math.cos(longitude) * Math.cos(latitude), u, v)
    }
  }
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const a = row * (columns + 1) + column, b = a + columns + 1
    indices.push(a, b, a + 1, a + 1, b, b + 1)
  }
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) }
}
// Current project typings intentionally expose RenderingContext as empty. Keep the
// dynamic native WebGL boundary here; the page consumes only the typed renderer API.
type NativeGL = any
export interface CanvasNode extends WechatMiniprogram.Canvas {
  getContext(type: string, options?: object): NativeGL
  addEventListener?: (name: string, listener: (event: any) => void) => void
  removeEventListener?: (name: string, listener: (event: any) => void) => void
}
export interface SphereRenderer {
  loadLocal(path: string, width: number, height: number, done: (error: boolean) => void): void
  loadBundledSample(done: (error: boolean) => void): void
  loadCalibration(): void
  requestDraw(view: View): void
  dispose(): void
}
const vertexSource = `attribute vec3 position; attribute vec2 uv; varying vec2 tex;
uniform vec3 view; uniform float aspect;
void main(){float y=radians(view.x),p=radians(view.y),t=tan(radians(view.z)*.5);
vec3 r=vec3(cos(y)*position.x+sin(y)*position.z,position.y,-sin(y)*position.x+cos(y)*position.z);
r=vec3(r.x,cos(p)*r.y+sin(p)*r.z,-sin(p)*r.y+cos(p)*r.z);
gl_Position=vec4(r.x/(aspect*t),r.y/t,-1.002002*r.z-.02002002,-r.z);tex=uv;}`
const fragmentSource = 'precision mediump float; varying vec2 tex; uniform sampler2D panorama; void main(){gl_FragColor=texture2D(panorama,tex);}'

export function createSphereRenderer(canvas: CanvasNode, width: number, height: number, dpr: number, fatal: () => void): SphereRenderer {
  if (!canvas || width <= 0 || height <= 0) throw new Error('CANVAS_UNAVAILABLE')
  const gl: NativeGL = canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: false })
  if (!gl) throw new Error('WEBGL_UNSUPPORTED')
  canvas.width = Math.max(1, Math.round(width * Math.min(dpr || 1, 2)))
  canvas.height = Math.max(1, Math.round(height * Math.min(dpr || 1, 2)))
  const shaders: any[] = [], buffers: any[] = []
  let program: any = null, texture: any = null, image: WechatMiniprogram.Image | null = null
  let dead = false, ready = false, frame: number | null = null, timer: ReturnType<typeof setTimeout> | null = null
  let latest = initialView()
  function releaseImage(): void {
    if (timer !== null) clearTimeout(timer)
    timer = null
    if (image) { image.onload = () => {}; image.onerror = () => {}; image = null }
  }
  function lost(event?: any): void {
    if (event && event.preventDefault) event.preventDefault()
    if (dead) return
    dispose(); fatal()
  }
  function dispose(): void {
    if (dead) return
    dead = true; ready = false
    if (frame !== null) canvas.cancelAnimationFrame(frame)
    frame = null; releaseImage()
    if (canvas.removeEventListener) canvas.removeEventListener('webglcontextlost', lost)
    gl.bindTexture(gl.TEXTURE_2D, null)
    if (texture) gl.deleteTexture(texture)
    buffers.forEach(buffer => gl.deleteBuffer(buffer))
    if (program) gl.deleteProgram(program)
    shaders.forEach(shader => gl.deleteShader(shader))
    texture = null; program = null
    // Release the native context on hide/unload, not just the JS wrapper.
    const extension = gl.getExtension('WEBGL_lose_context')
    if (extension) extension.loseContext()
  }
  function shader(type: number, source: string): any {
    const result = gl.createShader(type)
    if (!result) throw new Error('SHADER_UNAVAILABLE')
    shaders.push(result); gl.shaderSource(result, source); gl.compileShader(result)
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error('SHADER_FAILED')
    return result
  }
  let count = 0
  try {
    program = gl.createProgram()
    if (!program) throw new Error('PROGRAM_UNAVAILABLE')
    gl.attachShader(program, shader(gl.VERTEX_SHADER, vertexSource)); gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragmentSource))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('PROGRAM_FAILED')
    gl.useProgram(program)
    const geometry = sphereGeometry(); count = geometry.indices.length
    const vertices = gl.createBuffer(), indices = gl.createBuffer()
    if (vertices) buffers.push(vertices)
    if (indices) buffers.push(indices)
    if (!vertices || !indices) throw new Error('BUFFER_UNAVAILABLE')
    gl.bindBuffer(gl.ARRAY_BUFFER, vertices); gl.bufferData(gl.ARRAY_BUFFER, geometry.vertices, gl.STATIC_DRAW)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'position'), uv = gl.getAttribLocation(program, 'uv')
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 20, 0)
    gl.enableVertexAttribArray(uv); gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 20, 12)
    gl.disable(gl.CULL_FACE); gl.disable(gl.DEPTH_TEST)
    if (canvas.addEventListener) canvas.addEventListener('webglcontextlost', lost)
  } catch (error) { dispose(); throw error }
  function allocate(): void {
    ready = false
    if (texture) gl.deleteTexture(texture)
    texture = gl.createTexture()
    if (!texture) throw new Error('TEXTURE_UNAVAILABLE')
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture)
    // CLAMP + LINEAR also supports NPOT photographs on WebGL 1.0; no mipmaps.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  }
  function requestDraw(view: View): void {
    latest = { ...view }
    if (dead || !ready || frame !== null) return
    frame = canvas.requestAnimationFrame(() => {
      frame = null
      if (dead || !ready) return
      try {
        if (gl.isContextLost()) { lost(); return }
        gl.viewport(0, 0, canvas.width, canvas.height); gl.useProgram(program)
        gl.clearColor(0.06, 0.08, 0.1, 1); gl.clear(gl.COLOR_BUFFER_BIT)
        gl.uniform3f(gl.getUniformLocation(program, 'view'), latest.yaw, latest.pitch, latest.fov)
        gl.uniform1f(gl.getUniformLocation(program, 'aspect'), width / height)
        gl.uniform1i(gl.getUniformLocation(program, 'panorama'), 0)
        gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0)
        if (gl.getError() !== gl.NO_ERROR) lost()
      } catch (_) { lost() }
    })
  }
  function loadCalibration(): void {
    if (dead) return
    releaseImage(); allocate()
    const w = 512, h = 256, pixels = new Uint8Array(w * h * 4)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, line = x % 32 < 2 || y % 32 < 2
      pixels[i] = line ? 240 : Math.floor(x / w * 200 + 30)
      pixels[i + 1] = line ? 230 : Math.floor(y / h * 180 + 30)
      pixels[i + 2] = line ? 210 : (x < w / 2 ? 70 : 160); pixels[i + 3] = 255
    }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    if (gl.getError() !== gl.NO_ERROR) throw new Error('TEXTURE_FAILED')
    ready = true; requestDraw(latest)
  }
  function loadLocal(path: string, w: number, h: number, done: (error: boolean) => void): void {
    if (dead) return
    if (!/^(wxfile:\/\/tmp(?:\/|_)|http:\/\/tmp\/|\/tmp\/)/.test(path) || w !== h * 2 || w > Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE))) {
      done(true); return
    }
    loadImage(path, w, h, done)
  }
  function loadBundledSample(done: (error: boolean) => void): void {
    if (!panoramaSample || panoramaSample.path !== '/assets/vr-synthetic-test.jpg'
      || panoramaSample.width !== panoramaSample.height * 2
      || panoramaSample.width > Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE))) { done(true); return }
    loadImage(panoramaSample.path, panoramaSample.width, panoramaSample.height, done)
  }
  function loadImage(path: string, w: number, h: number, done: (error: boolean) => void): void {
    if (dead) return
    releaseImage(); allocate()
    const current = canvas.createImage(); image = current
    const finish = (error: boolean): void => { releaseImage(); if (!dead) done(error) }
    current.onload = () => {
      if (dead || image !== current) return
      try {
        if (current.width !== w || current.height !== h) { finish(true); return }
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, current)
        if (gl.getError() !== gl.NO_ERROR) { finish(true); return }
        ready = true; requestDraw(latest); finish(false)
      } catch (_) { finish(true) }
    }
    current.onerror = () => finish(true)
    timer = setTimeout(() => finish(true), 10000)
    current.src = path
  }
  return { loadCalibration, loadLocal, loadBundledSample, requestDraw, dispose }
}
