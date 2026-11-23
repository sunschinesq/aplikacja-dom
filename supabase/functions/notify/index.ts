// Nasz dom – funkcja wysyłająca powiadomienia push (Supabase Edge Function „notify”).
// Wywołują ją: baza (nowy liścik, wydatek, produkt na liście), harmonogram (rano i wieczorem)
// oraz aplikacja (pobranie klucza publicznego, powiadomienie próbne).
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

const APP_URL = "https://sunschinesq.github.io/aplikacja-dom/";
const TZ = "Europe/Warsaw";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

// ---------- czysta logika (testowalna bez bazy) ----------
type Row = { coll: string; data: Record<string, any> };
export const todayIn = (d = new Date()) => new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(d);
const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d || 1); };
export const diffDays = (a: string, b: string) => Math.round((parse(b) - parse(a)) / 864e5);
export const addDays = (s: string, n: number) => new Date(parse(s) + n * 864e5).toISOString().slice(0, 10);
const dim = (m: string) => { const [y, mo] = m.split("-").map(Number); return new Date(Date.UTC(y, mo, 0)).getUTCDate(); };
const zl = (n: number) => (Math.round(n * 100) / 100).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " zł";
const FEM: Record<string, boolean> = { julia: true, franek: false };
const verb = (p: string, f: string, m: string) => (FEM[p] ? f : m);
const GEN: Record<string, string> = { Julia: "Julii", Franek: "Franka" };
const PEOPLE = ["julia", "franek"];

export function names(rows: Row[]) {
  const v = rows.find((r) => r.coll === "cfg" && r.data.id === "people")?.data.v || {};
  return (p: string) => v[p]?.name || (p === "julia" ? "Julia" : "Franek");
}
const cfg = (rows: Row[], id: string, def: any) => rows.find((r) => r.coll === "cfg" && r.data.id === id)?.data.v ?? def;
const of = (rows: Row[], c: string) => rows.filter((r) => r.coll === c && !r.data.del).map((r) => r.data);

export function choreDue(c: any, t: string) {
  if (!c.last) return t;
  const last = String(c.last).slice(0, 10);
  return c.snooze && c.snooze > c.last ? c.snooze : addDays(last, c.every || 1);
}

// Poranne podsumowanie: osobna wiadomość dla każdej osoby (albo null, gdy nic)
export function buildDaily(rows: Row[], t: string): Record<string, { title: string; body: string; url: string } | null> {
  const m = t.slice(0, 7), common: string[] = [];
  for (const r of of(rows, "recurring")) {
    if (r.paid?.[m]) continue;
    const due = `${m}-${String(Math.min(r.day, dim(m))).padStart(2, "0")}`, d = diffDays(t, due);
    if (d === 0) common.push(`Dziś termin: ${r.name} ${zl(r.amount)}`);
    else if (d === 3) common.push(`Za 3 dni: ${r.name} ${zl(r.amount)}`);
  }
  for (const w of of(rows, "warranties")) {
    const d = diffDays(t, w.until);
    if (d === 7) common.push(`Za tydzień kończy się gwarancja: ${w.name}`);
    else if (d === 0) common.push(`Dziś kończy się gwarancja: ${w.name}`);
  }
  const exp = of(rows, "pantry").filter((p) => p.expires && diffDays(t, p.expires) >= 0 && diffDays(t, p.expires) <= 1).map((p) => p.name);
  if (exp.length) common.push(`Do zjedzenia: ${exp.join(", ")}`);
  const out: Record<string, any> = {};
  for (const p of PEOPLE) {
    const chores = of(rows, "chores").filter((c) => c.next === p && choreDue(c, t) <= t && String(c.last || "").slice(0, 10) !== t).map((c) => c.name);
    const lines = [...(chores.length ? [`Twoje obowiązki: ${chores.join(", ")}`] : []), ...common];
    out[p] = lines.length ? { title: "Nasz dom · dziś", body: lines.join("\n"), url: "./" } : null;
  }
  return out;
}

export function buildEvening(rows: Row[], t: string) {
  const goal = cfg(rows, "catGoal", 3);
  const meals = of(rows, "catlog").filter((x) => x.day === t && x.type === "jedzenie").length;
  return meals < goal ? { title: "Kita", body: `Dziś ${meals} z ${goal} posiłków. Ktoś ją jeszcze nakarmi?`, url: "./#/kita" } : null;
}

// Zdarzenie z bazy: kto ma dostać jaką wiadomość
export function buildRowEvent(row: any, rows: Row[], now = Date.now()) {
  const d = row.data || {}, name = names(rows), other = (p: string) => (p === "julia" ? "franek" : "julia");
  if (d.del || row.owner || d.private) return [];
  if (!d.ts || now - d.ts > 5 * 60e3) return []; // stare dane (np. pierwsza synchronizacja) – bez powiadomień
  if (row.coll === "notes" && d.to) {
    const n = name(d.from);
    return [{ to: d.to, msg: { title: `Liścik od ${GEN[n] || n}`, body: d.text, url: "./", tag: "note-" + d.id } }];
  }
  if (row.coll === "expenses" && d.by) {
    const out: any[] = [{ to: other(d.by), msg: { title: `${name(d.by)} ${verb(d.by, "dodała", "dodał")} wydatek`, body: `${d.desc || "Wydatek"} · ${zl(d.amount)}${d.account === "wspolne" ? " · konto wspólne" : ""}`, url: "./#/wydatki" } }];
    if (d.account === "wspolne") {
      const m = String(d.date).slice(0, 7), limit = cfg(rows, "budget", {}).limit || 0;
      const spent = of(rows, "expenses").filter((e) => e.account === "wspolne" && String(e.date).slice(0, 7) === m).reduce((s, e) => s + (+e.amount || 0), 0);
      const before = spent - (+d.amount || 0);
      for (const k of [1, 0.8]) if (limit && before < k * limit && spent >= k * limit) {
        const msg = { title: "Konto wspólne", body: k === 1 ? `Przekroczony limit: ${zl(spent)} z ${zl(limit)}` : `Wykorzystano 80% limitu: ${zl(spent)} z ${zl(limit)}`, url: "./#/wydatki", tag: "budget" };
        out.push({ to: "julia", msg }, { to: "franek", msg }); break;
      }
    }
    return out;
  }
  if (row.coll === "shopping" && d.by && !d.done) {
    return [{ to: other(d.by), throttle: `shop:${d.by}`, msg: { title: "Lista zakupów", body: `${name(d.by)} ${verb(d.by, "dopisała", "dopisał")}: ${d.name}`, url: "./#/zakupy", tag: "shop" } }];
  }
  return [];
}

// ---------- kalendarz z pracy (ICS) ----------
const fmtWaw = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
function icsTime(v: string, params: string) {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  if (!m[4] || /VALUE=DATE(?!-)/.test(params)) return { date, allDay: true };
  if (m[7]) { // UTC → czas polski
    const [d, t] = fmtWaw.format(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]))).split(" ");
    return { date: d, time: t.slice(0, 5) };
  }
  return { date, time: `${m[4]}:${m[5]}` }; // czas lokalny (TZID)
}
export function parseIcs(text: string) {
  const lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const out: any[] = [];
  let ev: any = null;
  for (const l of lines) {
    if (l === "BEGIN:VEVENT") { ev = { exdates: [] }; continue; }
    if (l === "END:VEVENT") { if (ev?.start) out.push(ev); ev = null; continue; }
    if (!ev) continue;
    const i = l.indexOf(":"); if (i < 0) continue;
    const [name, ...params] = l.slice(0, i).split(";"); const val = l.slice(i + 1), ps = params.join(";");
    if (name === "DTSTART") ev.start = icsTime(val, ps);
    else if (name === "DTEND") ev.end = icsTime(val, ps);
    else if (name === "SUMMARY") ev.summary = val.replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\n/gi, " ");
    else if (name === "STATUS") ev.status = val.trim();
    else if (name === "UID") ev.uid = val.trim();
    else if (name === "RRULE") ev.rrule = val.trim();
    else if (name === "RECURRENCE-ID") ev.recId = icsTime(val, ps);
    else if (name === "EXDATE") for (const v of val.split(",")) { const t = icsTime(v.trim(), ps); if (t) ev.exdates.push(t.date); }
  }
  return out;
}

// Rozwinięcie wydarzeń powtarzalnych (RRULE: DAILY/WEEKLY/MONTHLY, INTERVAL, BYDAY, UNTIL, COUNT, EXDATE, RECURRENCE-ID)
const WD = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const wday = (d: string) => new Date(parse(d)).getUTCDay();
export function expandIcs(events: any[], from: string, to: string) {
  const out: any[] = [];
  const overridden = new Set(events.filter((e) => e.recId).map((e) => `${e.uid}|${e.recId.date}`));
  for (const e of events) {
    if (e.status === "CANCELLED") continue;
    if (!e.rrule) { if (e.start.date >= from && e.start.date <= to) out.push(e); continue; }
    const r: Record<string, string> = Object.fromEntries(e.rrule.split(";").map((x: string) => x.split("=")));
    const freq = r.FREQ, step = +(r.INTERVAL || 1), count = r.COUNT ? +r.COUNT : Infinity;
    const until = r.UNTIL ? icsTime(r.UNTIL, "")?.date || to : to;
    const end = until < to ? until : to;
    const byday = r.BYDAY ? r.BYDAY.split(",").map((x) => WD.indexOf(x.slice(-2))) : [wday(e.start.date)];
    let n = 0;
    const emit = (d: string) => {
      n++;
      if (d < from || e.exdates.includes(d) || overridden.has(`${e.uid}|${d}`)) return;
      out.push({ ...e, start: { ...e.start, date: d }, end: e.end ? { ...e.end, date: d } : undefined });
    };
    if (freq === "DAILY") for (let d = e.start.date; d <= end && n < count; d = addDays(d, step)) emit(d);
    else if (freq === "WEEKLY") {
      let wk = addDays(e.start.date, -((wday(e.start.date) + 6) % 7)); // poniedziałek tygodnia startu
      for (; wk <= end && n < count; wk = addDays(wk, 7 * step)) {
        for (let i = 0; i < 7 && n < count; i++) { const d = addDays(wk, i); if (d < e.start.date || d > end) continue; if (byday.includes(wday(d))) emit(d); }
      }
    } else if (freq === "MONTHLY") {
      for (let k = 0; n < count; k += step) {
        const [y, m] = e.start.date.split("-").map(Number); const dt = new Date(Date.UTC(y, m - 1 + k, +e.start.date.slice(8)));
        const d = dt.toISOString().slice(0, 10); if (d > end) break; if (+d.slice(8) === +e.start.date.slice(8)) emit(d);
      }
    } else if (e.start.date >= from && e.start.date <= to) out.push(e);
  }
  return out;
}

// Zajęcia ze studiów: bez kolokwiów, testów, egzaminów i sesji nauki
export function buildClasses(events: any[]) {
  const days: Record<string, any[]> = {};
  for (const e of events) {
    if (e.start.allDay || /kolokw|test|egzamin|zaliczeni|^nauka/i.test(e.summary || "")) continue;
    (days[e.start.date] ||= []).push({ start: e.start.time, end: e.end?.time || e.start.time, title: (e.summary || "").replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\u200d\ufe0f]/gu, "").trim() });
  }
  for (const d of Object.keys(days)) days[d].sort((a, b) => a.start.localeCompare(b.start));
  return days;
}

// Zamiana wydarzeń na dni grafiku i scalenie z obecnymi (ręczne wpisy zostają)
export function mergeFeed(days: Record<string, any>, events: any[], place: string, t: string) {
  const from = addDays(t, -31), to = addDays(t, 180), fresh: Record<string, any> = {};
  for (const e of events) {
    const d = e.start.date; if (d < from || d > to) continue;
    if (e.start.allDay) { if (/urlop/i.test(e.summary || "")) fresh[d] = { code: "U", src: "feed" }; continue; }
    const end = e.end?.time || e.start.time;
    const cur = fresh[d];
    if (cur?.start) fresh[d] = { ...cur, start: cur.start < e.start.time ? cur.start : e.start.time, end: cur.end > end ? cur.end : end };
    else fresh[d] = { start: e.start.time, end, place: place || undefined, src: "feed" };
  }
  // dzień „należy” do kalendarza, jeśli przyszedł z niego (albo z pliku startowego z tym samym miejscem) i nie był poprawiany ręcznie
  const owned = (v: any) => v && !v.manual && (v.src === "feed" || (!v.src && place && v.place === place));
  const next: Record<string, any> = {};
  for (const [d, v] of Object.entries(days || {})) if (!(owned(v) && d >= from && d <= to)) next[d] = v;
  for (const [d, v] of Object.entries(fresh)) if (!next[d]) next[d] = v;
  return next;
}

// ---------- serwer ----------
async function handler(req: Request) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: conf, error: ce } = await db.from("push_config").select("*").eq("id", 1).single();
  if (ce || !conf) return json({ error: "Brak konfiguracji push_config: uruchom SQL z instrukcji" }, 500);

  let vapid = conf.vapid;
  if (!vapid) { // pierwsze uruchomienie: wygeneruj klucze i zapisz je w bazie (prywatny klucz nie opuszcza serwera)
    vapid = await webpush.exportVapidKeys(await webpush.generateVapidKeys({ extractable: true }));
    await db.from("push_config").update({ vapid }).eq("id", 1).is("vapid", null);
    vapid = (await db.from("push_config").select("vapid").eq("id", 1).single()).data!.vapid;
  }
  const keys = await webpush.importVapidKeys(vapid, { extractable: false });
  const body = await req.json().catch(() => ({}));

  if (body.action === "key") return json({ key: await webpush.exportApplicationServerKey(keys) });

  const app = await webpush.ApplicationServer.new({ contactInformation: APP_URL, vapidKeys: keys });
  const pushTo = async (subs: any[], msg: any) => {
    let sent = 0;
    for (const s of subs) {
      try { await app.subscribe(s.sub).pushTextMessage(JSON.stringify(msg), { ttl: 86400 }); sent++; }
      catch (e) { const st = (e as any)?.response?.status; if (st === 404 || st === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint); else console.error("push", st, String(e)); }
    }
    return sent;
  };
  const send = async (house: string, person: string, msg: any) => {
    const { data: subs } = await db.from("push_subs").select("endpoint,sub").eq("house", house).eq("person", person);
    return pushTo(subs || [], msg);
  };

  if (body.action === "test") {
    const { data: s } = await db.from("push_subs").select("endpoint,sub").eq("endpoint", body.endpoint ?? "").maybeSingle();
    if (!s) return json({ error: "Ten telefon nie jest zapisany do powiadomień" }, 404);
    return json({ sent: await pushTo([s], { title: "Nasz dom", body: "Powiadomienia działają 🌸", url: "./" }) });
  }

  // ----- kalendarze: praca (grafik) i studia (zajęcia) -----
  const syncFeed = async (f: any) => {
    let info = "";
    try {
      const r = await fetch(f.url.replace(/^webcal:/i, "https:"), { headers: { "User-Agent": "NaszDom/1.0" } });
      if (!r.ok) throw new Error(`kalendarz odpowiedział ${r.status}`);
      const text = await r.text();
      if (!text.includes("BEGIN:VCALENDAR")) throw new Error("to nie jest link do kalendarza (.ics)");
      const t = todayIn(), events = expandIcs(parseIcs(text), addDays(t, -31), addDays(t, 180));
      const coll = f.kind === "studia" ? "classes" : "shifts";
      const { data: row } = await db.from("rows").select("data").eq("house", f.house).eq("coll", coll).eq("id", f.person).maybeSingle();
      const cur = row?.data || { id: f.person, days: {} };
      const days = f.kind === "studia" ? buildClasses(events) : mergeFeed(cur.days || {}, events, f.place, t);
      if (JSON.stringify(days) !== JSON.stringify(cur.days || {})) {
        const data = { ...cur, id: f.person, days, del: false, ts: Date.now() };
        const { error } = await db.from("rows").upsert({ house: f.house, coll, id: f.person, data, ts: data.ts, owner: null });
        if (error) throw error;
      }
      info = `ok · ${f.kind === "studia" ? Object.values(days).flat().length + " zajęć" : events.length + " zmian"}`;
    } catch (e) { info = "błąd: " + ((e as Error).message || e); }
    await db.from("calendar_feeds").update({ last_sync: new Date().toISOString(), last_info: info }).eq("house", f.house).eq("person", f.person).eq("kind", f.kind);
    return info;
  };
  if (String(body.action).startsWith("feed_")) {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
    const { data: u } = await db.auth.getUser(jwt);
    if (!u?.user) return json({ error: "Brak logowania" }, 401);
    const { data: m } = await db.from("members").select("house,person").eq("uid", u.user.id).maybeSingle();
    if (!m) return json({ error: "Telefon nie jest połączony z domem" }, 403);
    const key = { house: m.house, person: m.person };
    if (body.action === "feed_set") {
      const kind = body.kind === "studia" ? "studia" : "praca", url = String(body.url || "").trim();
      if (!url) { await db.from("calendar_feeds").delete().match({ ...key, kind }); }
      else {
        if (!/^(https?|webcal):\/\//i.test(url)) return json({ error: "Link musi zaczynać się od https:// albo webcal://" }, 400);
        await db.from("calendar_feeds").upsert({ ...key, kind, url, place: String(body.place || "").slice(0, 40) });
      }
    }
    const { data: fs } = await db.from("calendar_feeds").select("*").match(key);
    const out: Record<string, any> = {};
    for (const f of fs || []) {
      const run = body.action === "feed_sync" || (body.action === "feed_set" && f.kind === body.kind);
      out[f.kind] = { place: f.place, info: run ? await syncFeed(f) : f.last_info, last_sync: run ? new Date().toISOString() : f.last_sync };
    }
    return json({ feeds: out });
  }

  // akcje z bazy wymagają sekretu
  if (req.headers.get("x-hook") !== conf.hook_secret) return json({ error: "Brak dostępu" }, 401);
  const load = async (house: string) => {
    const all: Row[] = []; let from = 0;
    for (;;) { const { data } = await db.from("rows").select("coll,data").eq("house", house).range(from, from + 999); all.push(...(data || [])); if (!data || data.length < 1000) break; from += 1000; }
    return all;
  };

  if (body.action === "row") {
    const row = body.row; if (!row?.house) return json({ ok: true });
    const rows = await load(row.house);
    let sent = 0;
    for (const ev of buildRowEvent(row, rows)) {
      if (ev.throttle) {
        const key = `${row.house}:${ev.throttle}`;
        const { data: t } = await db.from("push_throttle").select("at").eq("key", key).maybeSingle();
        if (t && Date.now() - new Date(t.at).getTime() < 10 * 60e3) continue;
        await db.from("push_throttle").upsert({ key, at: new Date().toISOString() });
      }
      sent += await send(row.house, ev.to, ev.msg);
    }
    return json({ sent });
  }

  if (body.action === "feeds") {
    const { data: fs } = await db.from("calendar_feeds").select("*");
    const res = []; for (const f of fs || []) res.push(await syncFeed(f));
    return json({ res });
  }

  if (body.action === "daily" || body.action === "evening") {
    const { data: houses } = await db.from("houses").select("id");
    const t = todayIn(); let sent = 0;
    for (const h of houses || []) {
      const rows = await load(h.id);
      if (body.action === "daily") { const m = buildDaily(rows, t); for (const p of PEOPLE) if (m[p]) sent += await send(h.id, p, { ...m[p], tag: "daily" }); }
      else { const m = buildEvening(rows, t); if (m) for (const p of PEOPLE) sent += await send(h.id, p, { ...m, tag: "cat" }); }
    }
    return json({ sent });
  }
  return json({ error: "Nieznana akcja" }, 400);
}

if (!Deno.env.get("NOTIFY_TEST")) Deno.serve(handler);
