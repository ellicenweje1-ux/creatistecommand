// Phone notifications (Web Push) client helper. Talks to /push/* and the service worker.
// Everything degrades quietly when push isn't supported or isn't configured server-side.
import { api } from './api'

export const pushSupported = () =>
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  typeof window !== 'undefined' &&
  'PushManager' in window &&
  'Notification' in window

export const permissionState = () =>
  (typeof Notification !== 'undefined' && Notification.permission) || 'default'

// Detect a non-installed iOS browser, where web push only works once "Add to Home Screen".
export const iosNeedsInstall = () => {
  if (typeof navigator === 'undefined') return false
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const standalone = window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
  return ios && !standalone
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export const getPushConfig = () => api.get('/push/config')

export async function currentSubscription() {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

// Ask permission, subscribe this device, and register it server-side.
export async function enablePush(publicKey) {
  if (!pushSupported()) throw new Error('This device or browser can’t do notifications.')
  if (!publicKey) throw new Error('Notifications aren’t configured on the server yet.')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Notifications are blocked — allow them in your browser or phone settings.')
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
  }
  const json = sub.toJSON()
  await api.post('/push/subscribe', { endpoint: json.endpoint, keys: json.keys, user_agent: navigator.userAgent })
  return sub
}

// Unsubscribe this device and drop it server-side.
export async function disablePush() {
  const sub = await currentSubscription()
  if (sub) {
    await api.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {})
    await sub.unsubscribe().catch(() => {})
  } else {
    await api.post('/push/unsubscribe', {}).catch(() => {})
  }
}

export const sendTestPush = () => api.post('/push/test')
