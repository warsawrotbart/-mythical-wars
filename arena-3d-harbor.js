/* Harbor geometry for the current WebGL 1 view. No battle state is written here. */
(function (root) {
 "use strict";
 const path = "arena-art/harbor-draft.mwmesh";
 const stride = 10;
 let request;

 function load() {
  if (!request) {
   request = fetch(path).then(response => {
    if (!response.ok) throw Error("Harbor asset HTTP " + response.status);
    return response.arrayBuffer();
   }).then(data => {
    const header = new DataView(data);
    if (data.byteLength < 8 || header.getUint32(0, false) !== 0x4d574731) throw Error("Invalid harbor mesh header");
    const count = header.getUint32(4, true);
    if (!count || count % 3 || data.byteLength !== 8 + count * stride) throw Error("Invalid harbor mesh size");
    return { data: new Uint8Array(data, 8), count };
   });
  }
  return request;
 }

 function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
   const message = gl.getShaderInfoLog(shader);
   gl.deleteShader(shader);
   throw Error(message || "Harbor shader could not compile");
  }
  return shader;
 }

 function create(gl, asset) {
  const vertex = compile(gl, gl.VERTEX_SHADER, `
   attribute vec3 aPosition;
   attribute vec3 aColor;
   attribute float aSurface;
   uniform mat4 uVP;
   varying vec3 vWorld;
   varying vec3 vColor;
   varying float vSurface;
   void main() {
    vWorld = aPosition / 256.0;
    vColor = aColor;
    vSurface = aSurface;
    gl_Position = uVP * vec4(vWorld, 1.0);
   }
  `);
  let fragment, program;
  try {
   fragment = compile(gl, gl.FRAGMENT_SHADER, `
    precision mediump float;
    varying vec3 vWorld;
    varying vec3 vColor;
    varying float vSurface;
    uniform float uDay;
    uniform float uWave;
    float grainHash(vec2 p) {
     return fract(sin(dot(p, vec2(12.97, 78.23))) * 251.19);
    }
    float noise2(vec2 p) {
     vec2 a = floor(p), f = fract(p);
     f = f * f * (3.0 - 2.0 * f);
     return mix(mix(grainHash(a), grainHash(a+vec2(1.0,0.0)),f.x),
                mix(grainHash(a+vec2(0.0,1.0)),grainHash(a+vec2(1.0,1.0)),f.x),f.y);
    }
    void main() {
     vec3 rgb = vColor;
     if (vSurface > 0.5 && vSurface < 1.5) {
      float ripple = sin(vWorld.z * 33.0 + noise2(vWorld.xz * vec2(1.4,3.0)) * 10.0 + uWave);
      float broad = noise2(vWorld.xz * vec2(0.21, 5.9) + uWave * 0.17) * 2.0 - 1.0;
      float warmth = smoothstep(7.0, 14.0, vWorld.x)
        * (0.25 + 0.75 * pow(clamp((0.65 * ripple + 0.35 * broad + 1.0) * 0.5, 0.0, 1.0), 4.0));
      rgb = vec3(0.13, 0.29, 0.38) + 0.018 * ripple
        + vec3(0.34, 0.19, 0.03) * warmth;
     } else if (vSurface > 1.5 && vSurface < 2.5) {
      float cloud = noise2(vec2(vWorld.x * 0.47,vWorld.y * 4.9));
      rgb = mix(vec3(0.51, 0.43, 0.52), vec3(0.99, 0.70, 0.51), cloud * 0.53 + 0.26);
     } else if (vSurface > 2.5 && vSurface < 3.5) {
      float stone = .54 * noise2(vWorld.xz * 1.52) + .33 * noise2(vWorld.xz * 3.9)
        + .13 * noise2(vWorld.xz * 17.0);
      rgb *= 0.88 + stone * 0.21;
     } else if (vSurface > 3.5) {
      float grain = noise2(vWorld.xz * vec2(21.0,1.5));
      rgb *= 0.91 + grain * 0.13;
     }
     vec3 tint = mix(vec3(0.60, 0.72, 0.92), vec3(1.0, 0.95, 0.86), uDay);
     gl_FragColor = vec4(rgb * tint, 1.0);
    }
   `);
   program = gl.createProgram();
   gl.attachShader(program, vertex);
   gl.attachShader(program, fragment);
   gl.linkProgram(program);
   if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw Error(gl.getProgramInfoLog(program) || "Harbor renderer could not link");
   }
  } catch (error) {
   if (program) gl.deleteProgram(program);
   throw error;
  } finally {
   gl.deleteShader(vertex);
   if (fragment) gl.deleteShader(fragment);
  }

  const position = gl.getAttribLocation(program, "aPosition");
  const color = gl.getAttribLocation(program, "aColor");
  const surface = gl.getAttribLocation(program, "aSurface");
  const projection = gl.getUniformLocation(program, "uVP");
  const day = gl.getUniformLocation(program, "uDay");
  const wave = gl.getUniformLocation(program, "uWave");
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, asset.data, gl.STATIC_DRAW);
  return {
   draw(vp, light, seconds) {
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(position);
    gl.enableVertexAttribArray(color);
    gl.enableVertexAttribArray(surface);
    gl.vertexAttribPointer(position, 3, gl.SHORT, false, stride, 0);
    gl.vertexAttribPointer(color, 3, gl.UNSIGNED_BYTE, true, stride, 6);
    gl.vertexAttribPointer(surface, 1, gl.UNSIGNED_BYTE, false, stride, 9);
    gl.uniformMatrix4fv(projection, false, vp);
    gl.uniform1f(day, light);
    gl.uniform1f(wave, seconds % (2 * Math.PI * 100));
    gl.drawArrays(gl.TRIANGLES, 0, asset.count);
    gl.disableVertexAttribArray(position);
    gl.disableVertexAttribArray(color);
    gl.disableVertexAttribArray(surface);
   },
   triangles: asset.count / 3
  };
 }

 function camera(math, aspect) {
  const fov = 2 * Math.atan(.5 / Math.min(16 / 9, aspect));
  return math.mul(math.perspective(fov, aspect, .10, 150),
   math.lookAt([0, 12.986, 17.5], [0, -.794, -.13]));
 }

 const anchors = Object.freeze({
  clock: [-8.8527,.7524,-.525], turn: [8.13,.32,.29],
  heroes: [[0,.39,4.36], [0,1.14,-5.36]],
  decks: [[8.12,.20,2.6], [8.12,.20,-2.6]]
 });
 root.MW_3D_HARBOR = Object.freeze({ load, create, camera, anchors });
})(window);
