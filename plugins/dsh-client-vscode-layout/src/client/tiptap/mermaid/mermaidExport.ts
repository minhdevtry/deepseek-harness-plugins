/**
 * Export rendered SVG element to high-resolution PNG image (2x HD)
 */
export async function exportSvgToPng(svgElement: SVGSVGElement, scale: number = 2): Promise<Blob> {
  const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement

  if (!clonedSvg.getAttribute('xmlns')) {
    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  }

  const bbox = svgElement.getBoundingClientRect()
  const width = bbox.width > 0 ? bbox.width : 800
  const height = bbox.height > 0 ? bbox.height : 600

  clonedSvg.setAttribute('width', `${width}`)
  clonedSvg.setAttribute('height', `${height}`)

  const svgData = new XMLSerializer().serializeToString(clonedSvg)
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Failed to load SVG into Image for canvas conversion'))
    img.src = url
  })

  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    URL.revokeObjectURL(url)
    throw new Error('Could not get 2D canvas context')
  }

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  URL.revokeObjectURL(url)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('Failed to generate PNG blob from canvas'))
      }
    }, 'image/png')
  })
}

/**
 * Copy PNG image directly to system clipboard
 */
export async function copyPngToClipboard(svgElement: SVGSVGElement): Promise<void> {
  const blob = await exportSvgToPng(svgElement, 2)
  if (navigator.clipboard && window.ClipboardItem) {
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob }),
    ])
  } else {
    throw new Error('ClipboardItem API is not supported in this environment')
  }
}

/**
 * Download SVG file
 */
export function downloadSvg(svgElement: SVGSVGElement, filename: string = 'diagram.svg'): void {
  const svgData = new XMLSerializer().serializeToString(svgElement)
  const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    if (a.parentNode) {
      document.body.removeChild(a)
    }
    URL.revokeObjectURL(url)
  }, 100)
}
