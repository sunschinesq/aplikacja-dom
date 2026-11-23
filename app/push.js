// Powiadomienia push: zapis telefonu w bazie, próbne powiadomienie, wyłączanie.
import { getClient, getHouse } from './sync.js';
import { getMe } from './store.js';

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const isStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const needsHomeScreen = () => isIOS() && !isStandalone();

const b64 = (s) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };
export const callFn = (body) => fn(body);
const fn = async (body) => {
  const { data, error } = await getClient().functions.invoke('notify', { body });
  if (error) {
    const st = error.context?.status; let m = error.message;
    try { const j = await error.context.json(); m = j.error || j.message || m; } catch {}
    if (st === 404) m = 'Funkcja „notify” nie jest jeszcze wdrożona w Supabase (Edge Functions).';
    if (st === 401) m = 'W funkcji „notify” wyłącz „Verify JWT” i zapisz.';
    throw new Error(m);
  }
  return data;
};

export async function pushState() {
  if (!pushSupported()) return 'brak';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

export async function enablePush() {
  // zgoda musi być pierwszym krokiem po stuknięciu (wymóg iPhone'a)
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Nie zezwolono na powiadomienia. Zmienisz to w Ustawieniach iPhone’a → Powiadomienia → Nasz dom.');
  if (!getClient() || !getHouse()) throw new Error('Najpierw połącz synchronizację.');
  const reg = await navigator.serviceWorker.ready;
  const { key } = await fn({ action: 'key' }) || {};
  if (!key) throw new Error('Funkcja „notify” w Supabase ma jeszcze przykładowy kod („Hello”). Wklej kod z repozytorium i kliknij Deploy.');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
  const j = sub.toJSON();
  const { data: { user } } = await getClient().auth.getUser();
  const { error } = await getClient().from('push_subs').upsert({ endpoint: j.endpoint, uid: user.id, house: getHouse(), person: getMe(), sub: { endpoint: j.endpoint, keys: j.keys } });
  if (error) throw error;
}

export async function testPush() {
  const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
  if (!sub) throw new Error('Powiadomienia nie są włączone na tym telefonie.');
  return fn({ action: 'test', endpoint: sub.endpoint });
}

export async function disablePush() {
  const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
  if (sub) { await getClient()?.from('push_subs').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe(); }
}
