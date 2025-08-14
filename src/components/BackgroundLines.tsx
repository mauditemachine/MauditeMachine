import React, { useEffect, useRef } from 'react'

type Point3D = { x: number; y: number; z: number }
type Line3D = { a: Point3D; b: Point3D; speed: number; dir: 1 | -1; hue: number }

function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

export default function BackgroundLines(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d', { alpha: true })!

    const DPR = Math.min(window.devicePixelRatio || 1, 2)
    let width = 0
    let height = 0
    let cx = 0
    let cy = 0

    const perspective = 900
    const near = 60
    const far = 1400
    const lineCount = 120
    const lines: Line3D[] = []

    function resize() {
      width = window.innerWidth
      height = window.innerHeight
      cx = width / 2
      cy = height / 2
      canvas.width = Math.floor(width * DPR)
      canvas.height = Math.floor(height * DPR)
      canvas.style.width = width + 'px'
      canvas.style.height = height + 'px'
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
    }

    function createLine(): Line3D {
      const depth = randomInRange(near, far)
      const a: Point3D = {
        x: randomInRange(-cx * 1.2, cx * 1.2),
        y: randomInRange(-cy * 1.2, cy * 1.2),
        z: depth
      }
      const b: Point3D = {
        x: a.x + randomInRange(-200, 200),
        y: a.y + randomInRange(-200, 200),
        z: depth + randomInRange(-120, 120)
      }
      const speed = randomInRange(0.6, 1.6)
      const dir: 1 | -1 = Math.random() > 0.5 ? 1 : -1
      const hue = randomInRange(10, 330) // variété discrète sur le dégradé
      return { a, b, speed, dir, hue }
    }

    function resetLine(line: Line3D, direction: 1 | -1) {
      const depth = direction === 1 ? near + 1 : far - 1
      line.a.x = randomInRange(-cx * 1.2, cx * 1.2)
      line.a.y = randomInRange(-cy * 1.2, cy * 1.2)
      line.a.z = depth
      line.b.x = line.a.x + randomInRange(-200, 200)
      line.b.y = line.a.y + randomInRange(-200, 200)
      line.b.z = depth + randomInRange(-120, 120)
      line.speed = randomInRange(0.6, 1.6)
      line.dir = direction
      line.hue = randomInRange(10, 330)
    }

    function project(p: Point3D) {
      const scale = perspective / (perspective + p.z)
      return { x: p.x * scale + cx, y: p.y * scale + cy, s: scale }
    }

    function init() {
      lines.length = 0
      for (let i = 0; i < lineCount; i++) {
        lines.push(createLine())
      }
    }

    function draw() {
      ctx.clearRect(0, 0, width, height)

      // Opacité faible pour ne pas gêner le texte
      ctx.globalCompositeOperation = 'lighter'

      for (const line of lines) {
        // Mise à jour profondeur
        line.a.z += line.speed * line.dir
        line.b.z += line.speed * line.dir
        if (line.dir === -1 && (line.a.z < near || line.b.z < near)) {
          resetLine(line, 1)
        } else if (line.dir === 1 && (line.a.z > far || line.b.z > far)) {
          resetLine(line, -1)
        }

        // Projection
        const A = project(line.a)
        const B = project(line.b)

        // Épaisseur liée à la profondeur (subtil)
        const thickness = Math.max(0.6, 1.8 * ((A.s + B.s) / 2))
        const alpha = 0.05 + 0.08 * ((A.s + B.s) / 2)
        ctx.lineWidth = thickness
        ctx.strokeStyle = `hsla(${line.hue}, 70%, 70%, ${alpha})`

        ctx.beginPath()
        ctx.moveTo(A.x, A.y)
        ctx.lineTo(B.x, B.y)
        ctx.stroke()
      }

      animationRef.current = requestAnimationFrame(draw)
    }

    resize()
    init()
    draw()
    window.addEventListener('resize', resize)
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="bg-lines" aria-hidden="true" />
}


