'use strict'
var vertex='attribute vec2 a; varying vec2 uv; void main(){uv=a;gl_Position=vec4(a,0.,1.);}'
var fragment='precision mediump float; varying vec2 uv; uniform sampler2D pano; uniform vec4 camera; uniform float aspect; void main(){float h=tan(camera.z*.00872664626);vec3 r=normalize(vec3(uv.x*aspect*h,uv.y*h,-1.));float p=camera.y*.01745329252;float y=camera.x*.01745329252;r=vec3(r.x,cos(p)*r.y-sin(p)*r.z,sin(p)*r.y+cos(p)*r.z);r=vec3(cos(y)*r.x-sin(y)*r.z,r.y,sin(y)*r.x+cos(y)*r.z);vec2 t=vec2(atan(r.x,-r.z)/6.28318530718+.5,.5-asin(clamp(r.y,-1.,1.))/3.14159265359);gl_FragColor=texture2D(pano,t);}'
function failure(code){var e=new Error(code);e.code=code;return e}
function validateScene(scene){return !!scene&&scene.projection==='equirectangular'&&scene.width===scene.height*2&&scene.width===2048&&/^\/assets\/[a-z0-9-]+\.png$/.test(scene.path)&&scene.provenance==='ORIGINAL_PROCEDURAL_SYNTHETIC'&&scene.institutionId===null}
function create(canvas,width,height,dpr,resolveAsset,onFatal){
  if(!canvas||typeof canvas.getContext!=='function')throw failure('UNSUPPORTED')
  var gl=canvas.getContext('webgl',{alpha:false,antialias:true,preserveDrawingBuffer:true})
  if(!gl||gl.getParameter(gl.MAX_TEXTURE_SIZE)<2048)throw failure('UNSUPPORTED')
  canvas.width=Math.round(width*Math.min(dpr||1,2));canvas.height=Math.round(height*Math.min(dpr||1,2))
  var shaders=[],buffer=null,program=null,texture=null,image=null,timeout=null,cancel=null,monitor=null,dead=false,ready=false,lost=false
  function shader(type,code){var s=gl.createShader(type);if(!s)throw failure('RENDER_FAILED');shaders.push(s);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw failure('RENDER_FAILED');return s}
  function destroy(){if(dead)return;dead=true;ready=false;if(timeout)clearTimeout(timeout);if(monitor)clearInterval(monitor);if(image){image.onload=null;image.onerror=null}if(cancel)cancel(failure('CANCELLED'));if(texture)gl.deleteTexture(texture);if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);shaders.forEach(function(s){gl.deleteShader(s)});if(canvas.removeEventListener)canvas.removeEventListener('webglcontextlost',onLost)}
  function onLost(event){if(event&&event.preventDefault)event.preventDefault();if(dead||lost)return;lost=true;ready=false;if(monitor)clearInterval(monitor);if(onFatal)onFatal(failure('UNSUPPORTED'))}
  try{
    program=gl.createProgram();if(!program)throw failure('RENDER_FAILED');gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw failure('RENDER_FAILED');gl.useProgram(program)
    buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);var a=gl.getAttribLocation(program,'a');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0)
    if(canvas.addEventListener)canvas.addEventListener('webglcontextlost',onLost)
    else monitor=setInterval(function(){if(!dead&&gl.isContextLost())onLost()},750)
  }catch(error){destroy();throw error}
  function load(scene){
    if(!scene)return Promise.reject(failure('MISSING_RESOURCE'))
    if(!validateScene(scene))return Promise.reject(failure('INVALID_RESOURCE'))
    if(dead)return Promise.reject(failure('CANCELLED'))
    return new Promise(function(resolve,reject){
      cancel=reject;image=typeof canvas.createImage==='function'?canvas.createImage():null
      if(!image){cancel=null;reject(failure('UNSUPPORTED'));return}
      function finish(error){if(timeout)clearTimeout(timeout);timeout=null;cancel=null;if(error)reject(error);else resolve({projection:'360x180',source:scene.provenance})}
      image.onload=function(){if(dead)return;try{if(image.width!==scene.width||image.height!==scene.height)throw failure('INVALID_RESOURCE');texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);if(gl.getError()!==gl.NO_ERROR)throw failure('RENDER_FAILED');ready=true;finish()}catch(error){finish(error)}}
      image.onerror=function(){finish(failure('LOAD_FAILED'))};timeout=setTimeout(function(){image.onload=null;image.onerror=null;finish(failure('LOAD_FAILED'))},8000)
      image.src=resolveAsset?resolveAsset(scene.path):scene.path
    })
  }
  function draw(view){if(lost||gl.isContextLost())throw failure('UNSUPPORTED');if(!ready||dead)return false;gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(program);gl.uniform4f(gl.getUniformLocation(program,'camera'),view.yaw,view.pitch,view.fov,0);gl.uniform1f(gl.getUniformLocation(program,'aspect'),width/height);gl.uniform1i(gl.getUniformLocation(program,'pano'),0);gl.drawArrays(gl.TRIANGLES,0,6);return true}
  return {load:load,draw:draw,destroy:destroy}
}
module.exports={create:create,validateScene:validateScene,vertex:vertex,fragment:fragment}
