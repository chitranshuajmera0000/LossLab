/**
 * Normalizes how LossLab looks across Windows display scale presets.
 * Designed at 100% OS scale; many laptops default to 125%/150%, which enlarges the whole UI.
 * We counter-zoom so those users see roughly the same proportions as on 100%.
 *
 * Opt out (e.g. accessibility): localStorage.setItem('losslab_disable_display_scale_compensation', '1')
 *
 * Intentionally Windows-only: macOS Retina uses high DPR without meaning "125% text size" like Win10/11.
 */

const STORAGE_DISABLE = 'losslab_disable_display_scale_compensation'

function matchTier(dpr, lo, hi) {
  return dpr >= lo && dpr <= hi
}

export function applyDisplayScaleCompensation() {
  if (typeof document === 'undefined') return

  const root = document.documentElement

  if (localStorage.getItem(STORAGE_DISABLE) === '1') {
    root.style.zoom = ''
    root.removeAttribute('data-losslab-display-scale')
    return
  }

  const ua = navigator.userAgent || ''
  const isWindows = /Windows/i.test(ua)
  if (!isWindows) {
    root.style.zoom = ''
    root.removeAttribute('data-losslab-display-scale')
    return
  }

  const dpr = window.devicePixelRatio || 1

  // [low, high] DPR bands → zoom = 100 / scalePercent (Chromium/Edge on Windows track OS scale here).
  let zoom = ''
  if (matchTier(dpr, 1.17, 1.33)) zoom = `${100 / 125}`
  else if (matchTier(dpr, 1.42, 1.58)) zoom = `${100 / 150}`
  else if (matchTier(dpr, 1.9, 2.1)) zoom = `${100 / 200}`

  if (zoom) {
    root.style.zoom = zoom
    root.dataset.losslabDisplayScale = zoom
  } else {
    root.style.zoom = ''
    root.removeAttribute('data-losslab-display-scale')
  }
}

export function initDisplayScaleCompensation() {
  applyDisplayScaleCompensation()

  let timeoutId
  const schedule = () => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(applyDisplayScaleCompensation, 120)
  }

  window.addEventListener('resize', schedule)
  window.addEventListener('orientationchange', schedule)
}
