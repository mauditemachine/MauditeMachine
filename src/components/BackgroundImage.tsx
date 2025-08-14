import React, { useEffect, useRef } from 'react'

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error('Shader compile error: ' + info)
  }
  return shader
}

function createProgram(gl: WebGLRenderingContext, vsSource: string, fsSource: string): WebGLProgram {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource)
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource)
  const program = gl.createProgram()!
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program)
    throw new Error('Program link error: ' + info)
  }
  return program
}

export default function BackgroundImage(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true })
    if (!gl) return () => {}

    const DPR = Math.min(window.devicePixelRatio || 1, 2)
    let width = 0
    let height = 0

    const vertexSource = `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `

    const fragmentSource = `
      precision mediump float;
      uniform sampler2D u_image;
      uniform vec2 u_resolution;
      uniform vec2 u_imageSize;
      uniform float u_time;
      uniform float u_intensity;
      varying vec2 v_uv;

      // Calcule des UV en mode cover sans déformer l'image
      vec2 coverUv(vec2 uv, vec2 canvasSize, vec2 imageSize) {
        float rs = canvasSize.x / canvasSize.y;
        float ri = imageSize.x / imageSize.y;
        vec2 newSize = rs > ri ? vec2(canvasSize.x, canvasSize.x / ri) : vec2(canvasSize.y * ri, canvasSize.y);
        vec2 offset = (newSize - canvasSize) * 0.5;
        vec2 scale = newSize;
        vec2 xy = uv * canvasSize + offset;
        return xy / scale;
      }

      // Luminance approximative
      float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

      void main() {
        vec2 uv = coverUv(v_uv, u_resolution, u_imageSize);
        vec2 px = 1.0 / u_resolution;
        vec3 col = texture2D(u_image, uv).rgb;

        // Sobel pour détecter les contours
        float tl = luma(texture2D(u_image, uv + vec2(-px.x, -px.y)).rgb);
        float  l = luma(texture2D(u_image, uv + vec2(-px.x,  0.0)).rgb);
        float bl = luma(texture2D(u_image, uv + vec2(-px.x,  px.y)).rgb);
        float  t = luma(texture2D(u_image, uv + vec2( 0.0 , -px.y)).rgb);
        float  c = luma(texture2D(u_image, uv).rgb);
        float  b = luma(texture2D(u_image, uv + vec2( 0.0 ,  px.y)).rgb);
        float tr = luma(texture2D(u_image, uv + vec2( px.x, -px.y)).rgb);
        float  r = luma(texture2D(u_image, uv + vec2( px.x,  0.0)).rgb);
        float br = luma(texture2D(u_image, uv + vec2( px.x,  px.y)).rgb);

        float gx = tl + 2.0*l + bl - tr - 2.0*r - br;
        float gy = tl + 2.0*t + tr - bl - 2.0*b - br;
        vec2 grad = vec2(gx, gy);
        float edge = clamp(length(grad) * 1.5, 0.0, 1.0);

        // Normal pseudo-3D à partir du gradient
        vec3 normal = normalize(vec3(grad * 1.2, 1.0));

        // Lumière directionnelle animée
        vec3 lightDir = normalize(vec3(cos(u_time*0.2), sin(u_time*0.15), 0.9));
        float diffuse = max(dot(normal, lightDir), 0.0);

        // Spéculaire doux
        float spec = pow(max(dot(reflect(-lightDir, normal), vec3(0.0,0.0,1.0)), 0.0), 16.0);

        // Mix subtil: on conserve l'image, on ajoute un rehaut sur les bords
        float amt = u_intensity;
        vec3 light = (diffuse * 0.6 + spec * 0.4) * edge * amt;
        vec3 result = col + light;

        // Légère désaturation pour éviter d'écraser le texte
        float g = luma(result);
        result = mix(result, vec3(g), 0.05 * amt);

        gl_FragColor = vec4(result, 1.0);
      }
    `

    const program = createProgram(gl, vertexSource, fragmentSource)
    gl.useProgram(program)

    const positionLoc = gl.getAttribLocation(program, 'a_position')
    const resolutionLoc = gl.getUniformLocation(program, 'u_resolution')
    const imageSizeLoc = gl.getUniformLocation(program, 'u_imageSize')
    const timeLoc = gl.getUniformLocation(program, 'u_time')
    const intensityLoc = gl.getUniformLocation(program, 'u_intensity')

    // Quad plein écran
    const buffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1,  1, -1, -1,  1,
         1, -1,  1,  1, -1,  1
      ]),
      gl.STATIC_DRAW
    )
    gl.enableVertexAttribArray(positionLoc)
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0)

    // Texture image
    const texture = gl.createTexture()!
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    const imageUrl = encodeURI('/images/Maudite Machine - Simetra Cover.jpg')
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.src = imageUrl
    // We still draw lighting on top of a separate <img> element. Canvas stays transparent.
    let imageReady = false
    image.onload = () => {
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
      gl.uniform2f(imageSizeLoc, image.naturalWidth, image.naturalHeight)
      imageReady = true
    }

    function resize() {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.floor(width * DPR)
      canvas.height = Math.floor(height * DPR)
      canvas.style.width = width + 'px'
      canvas.style.height = height + 'px'
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(resolutionLoc, width, height)
    }

    resize()
    window.addEventListener('resize', resize)

    const start = performance.now()
    function frame(now: number) {
      const t = (now - start) / 1000
      const textureLoc = gl.getUniformLocation(program, 'u_image')
      gl.uniform1i(textureLoc, 0) // sampler sur texture unit 0
      gl.uniform1f(timeLoc, t)
      gl.uniform1f(intensityLoc, 0.6) // intensité subtile
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      if (imageReady) {
        gl.drawArrays(gl.TRIANGLES, 0, 6)
      }
      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas className="bg-image" ref={canvasRef} aria-hidden="true" />
}


