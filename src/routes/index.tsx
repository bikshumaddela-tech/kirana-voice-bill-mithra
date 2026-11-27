import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Volume2, Trash2, Plus, Send, Receipt, History, Sparkles } from "lucide-react";
import { billTotal, parseBillText, type BillItem } from "@/lib/bill-parser";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kirana Mithra – Speak & Bill" },
      { name: "description", content: "Voice-first billing for Kirana shopkeepers in Telugu and English." },
      { property: "og:title", content: "Kirana Mithra – Speak & Bill" },
      { property: "og:description", content: "Voice-first billing for Kirana shopkeepers in Telugu and English." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Lang = "te" | "en";
interface SavedBill { id: string; at: string; items: BillItem[]; total: number }

const T = {
  en: {
    tagline: "Speak. Bill. Done.", speak: "Tap & Speak Items", listening: "Listening… tap to stop",
    samples: "Try Sample Voice Command", bill: "Current Bill", item: "Item", qty: "Qty", price: "Price ₹",
    total: "Total Amount", empty: "No items yet. Tap the mic and say e.g. “2 kg Rice 120 rupees”.",
    add: "Add item", speakTotal: "Speak Bill Total", save: "Save & WhatsApp Receipt", newBill: "New bill",
    tabBill: "Billing", tabKhata: "Today's Sales / Khata", todayTotal: "Today's total", bills: "bills",
    noSales: "No sales saved today.", heard: "Heard", noMic: "Voice input isn't supported or was blocked in this browser. Use the samples below or type.",
    typeHere: "Or type items here…", addText: "Add", summary: "Bill saved!", share: "Send on WhatsApp", close: "Close",
  },
  te: {
    tagline: "మాట్లాడండి. బిల్లు సిద్ధం.", speak: "నొక్కి మాట్లాడండి", listening: "వింటున్నాం… ఆపడానికి నొక్కండి",
    samples: "నమూనా వాయిస్ కమాండ్", bill: "ప్రస్తుత బిల్లు", item: "వస్తువు", qty: "పరిమాణం", price: "ధర ₹",
    total: "మొత్తం", empty: "ఇంకా వస్తువులు లేవు. మైక్ నొక్కి “2 కిలో బియ్యం 120 రూపాయలు” అనండి.",
    add: "వస్తువు జోడించు", speakTotal: "బిల్లు వినిపించు", save: "సేవ్ & వాట్సాప్ రసీదు", newBill: "కొత్త బిల్లు",
    tabBill: "బిల్లింగ్", tabKhata: "నేటి అమ్మకాలు / ఖాతా", todayTotal: "నేటి మొత్తం", bills: "బిల్లులు",
    noSales: "ఈరోజు అమ్మకాలు లేవు.", heard: "విన్నది", noMic: "ఈ బ్రౌజర్‌లో మైక్ పనిచేయడం లేదు. క్రింది నమూనాలు వాడండి లేదా టైప్ చేయండి.",
    typeHere: "లేదా ఇక్కడ టైప్ చేయండి…", addText: "జోడించు", summary: "బిల్లు సేవ్ అయింది!", share: "వాట్సాప్‌లో పంపండి", close: "మూసివేయి",
  },
} as const;

const SAMPLES = [
  "2 kg Rice 120 rupees, 1 liter Sunflower Oil 150 rupees, 1 kg Sugar 45 rupees",
  "2 కిలో బియ్యం 120 రూపాయలు, 1 లీటర్ నూనె 150 రూపాయలు, అర కిలో కందిపప్పు 70 రూపాయలు",
  "5 packets Milk 150 rupees and 1 dozen Eggs 84 rupees",
];

const STORE_KEY = "kirana-mithra-bills";
const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

function receiptText(b: SavedBill) {
  const lines = b.items.map((i, n) => `${n + 1}. ${i.name} – ${i.quantity}${i.unit ? " " + i.unit : ""} – ${inr(i.price)}`);
  return `🛒 *Kirana Mithra Bill*\n${new Date(b.at).toLocaleString("en-IN")}\n\n${lines.join("\n")}\n\n*Total: ${inr(b.total)}*\nThank you! / ధన్యవాదాలు 🙏`;
}

// Minimal typing for the Web Speech API
type SR = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };

function Index() {
  const [lang, setLang] = useState<Lang>("te");
  const t = T[lang];
  const [tab, setTab] = useState<"bill" | "khata">("bill");
  const [items, setItems] = useState<BillItem[]>([]);
  const [bills, setBills] = useState<SavedBill[]>([]);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [micError, setMicError] = useState(false);
  const [typed, setTyped] = useState("");
  const [saved, setSaved] = useState<SavedBill | null>(null);
  const recRef = useRef<SR | null>(null);

  useEffect(() => {
    try { const raw = localStorage.getItem(STORE_KEY); if (raw) setBills(JSON.parse(raw) as SavedBill[]); } catch { /* ignore */ }
  }, []);
  const persist = (next: SavedBill[]) => { setBills(next); localStorage.setItem(STORE_KEY, JSON.stringify(next)); };

  const addText = (text: string) => {
    setHeard(text);
    const parsed = parseBillText(text);
    if (parsed.length) setItems((prev) => [...prev, ...parsed]);
  };

  const toggleMic = () => {
    if (listening) { recRef.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) { setMicError(true); return; }
    const rec = new Ctor();
    rec.lang = lang === "te" ? "te-IN" : "en-IN";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        const txt = r?.[0]?.transcript ?? "";
        if (r?.isFinal) finalText += txt + " "; else interim += txt;
      }
      setHeard((finalText + interim).trim());
    };
    rec.onerror = (e) => { if (e.error === "not-allowed" || e.error === "service-not-allowed") setMicError(true); };
    rec.onend = () => { setListening(false); if (finalText.trim()) addText(finalText.trim()); };
    recRef.current = rec;
    setMicError(false);
    try { rec.start(); setListening(true); } catch { setMicError(true); }
  };

  const total = billTotal(items);
  const update = (id: string, patch: Partial<BillItem>) => setItems((p) => p.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const speakTotal = () => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const amt = Math.round(total * 100) / 100;
    const u = new SpeechSynthesisUtterance(
      lang === "te" ? `మొత్తం బిల్లు ${amt} రూపాయలు. ${items.length} వస్తువులు.` : `Your total bill is ${amt} rupees for ${items.length} items.`,
    );
    u.lang = lang === "te" ? "te-IN" : "en-IN";
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  };

  const saveBill = () => {
    if (!items.length) return;
    const b: SavedBill = { id: `b${Date.now()}`, at: new Date().toISOString(), items, total };
    persist([b, ...bills]);
    setSaved(b);
    setItems([]);
    setHeard("");
  };

  const today = bills.filter((b) => isToday(b.at));
  const todayTotal = today.reduce((s, b) => s + b.total, 0);

  return (
    <div className="min-h-screen bg-background pb-36">
      <header className="sticky top-0 z-20 bg-secondary text-secondary-foreground shadow-md">
        <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-extrabold tracking-tight">
              <span className="text-primary-glow">Kirana</span> Mithra
            </h1>
            <p className="truncate text-sm opacity-90">{t.tagline}</p>
          </div>
          <div className="flex shrink-0 rounded-full bg-secondary-foreground/15 p-1" role="group" aria-label="Language">
            {(["te", "en"] as const).map((l) => (
              <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l}
                className={`rounded-full px-3 py-2 text-sm font-bold transition ${lang === l ? "bg-primary text-primary-foreground" : "text-secondary-foreground"}`}>
                {l === "te" ? "తెలుగు" : "English"}
              </button>
            ))}
          </div>
        </div>
        <nav className="mx-auto grid max-w-3xl grid-cols-2 px-2">
          {(["bill", "khata"] as const).map((k) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex items-center justify-center gap-2 border-b-4 py-3 text-base font-bold ${tab === k ? "border-primary-glow" : "border-transparent opacity-75"}`}>
              {k === "bill" ? <Receipt className="size-5" /> : <History className="size-5" />}
              {k === "bill" ? t.tabBill : t.tabKhata}
              {k === "khata" && today.length > 0 && <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">{today.length}</span>}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4">
        {tab === "bill" ? (
          <>
            <section className="flex flex-col items-center py-8">
              <div className="relative flex size-44 items-center justify-center">
                <span className="mic-ring absolute inset-0 rounded-full bg-primary" aria-hidden />
                {listening && <span className="mic-ring absolute inset-0 rounded-full bg-primary [animation-delay:0.6s]" aria-hidden />}
                <button onClick={toggleMic} aria-label={listening ? t.listening : `${t.speak} (మాట్లాడండి)`}
                  className={`relative flex size-40 items-center justify-center rounded-full text-primary-foreground shadow-(--shadow-mic) transition active:scale-95 ${listening ? "bg-destructive" : "bg-(image:--gradient-saffron)"}`}>
                  {listening ? <MicOff className="size-16" /> : <Mic className="size-16" />}
                </button>
              </div>
              <p className="mt-5 text-center text-xl font-extrabold text-foreground">
                {listening ? t.listening : <>{t.speak} <span className="text-primary">(మాట్లాడండి)</span></>}
              </p>
              {heard && <p className="mt-3 w-full rounded-xl bg-muted px-4 py-3 text-center text-base"><b>{t.heard}:</b> “{heard}”</p>}
              {micError && <p className="mt-3 w-full rounded-xl border-2 border-destructive px-4 py-3 text-center text-sm font-semibold text-destructive">{t.noMic}</p>}
            </section>

            <section className="rounded-2xl border-2 border-dashed border-primary/50 bg-card p-4">
              <h2 className="mb-3 flex items-center gap-2 font-bold"><Sparkles className="size-5 text-primary" />{t.samples}</h2>
              <div className="flex flex-col gap-2">
                {SAMPLES.map((s) => (
                  <button key={s} onClick={() => addText(s)}
                    className="rounded-xl bg-accent px-4 py-3 text-left text-sm font-semibold text-accent-foreground active:scale-[0.99]">▶ {s}</button>
                ))}
              </div>
              <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (typed.trim()) { addText(typed.trim()); setTyped(""); } }}>
                <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={t.typeHere}
                  className="min-w-0 flex-1 rounded-xl border-2 border-input bg-background px-3 py-3 text-base" />
                <button className="shrink-0 rounded-xl bg-secondary px-4 font-bold text-secondary-foreground">{t.addText}</button>
              </form>
            </section>

            <section className="mt-6 overflow-hidden rounded-2xl border-2 border-border bg-card shadow-sm">
              <div className="flex items-center justify-between bg-muted px-4 py-3">
                <h2 className="text-lg font-extrabold">{t.bill}</h2>
                {items.length > 0 && <button onClick={() => setItems([])} className="text-sm font-bold text-destructive">{t.newBill}</button>}
              </div>
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-muted-foreground">{t.empty}</p>
              ) : (
                <ul className="divide-y divide-border">
                  <li className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_2.75rem] gap-2 px-3 py-2 text-xs font-bold uppercase text-muted-foreground">
                    <span>{t.item}</span><span>{t.qty}</span><span>{t.price}</span><span />
                  </li>
                  {items.map((it) => (
                    <li key={it.id} className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_2.75rem] items-center gap-2 px-3 py-2">
                      <input aria-label={t.item} value={it.name} onChange={(e) => update(it.id, { name: e.target.value })}
                        className="min-w-0 rounded-lg border border-input bg-background px-2 py-2 font-semibold" />
                      <div className="flex items-center rounded-lg border border-input bg-background">
                        <input aria-label={t.qty} type="number" inputMode="decimal" value={it.quantity}
                          onChange={(e) => update(it.id, { quantity: Number(e.target.value) })} className="w-full min-w-0 bg-transparent px-2 py-2" />
                        <span className="pr-1 text-xs text-muted-foreground">{it.unit}</span>
                      </div>
                      <input aria-label={t.price} type="number" inputMode="decimal" value={it.price}
                        onChange={(e) => update(it.id, { price: Number(e.target.value) })}
                        className="min-w-0 rounded-lg border border-input bg-background px-2 py-2 font-bold" />
                      <button aria-label="Delete" onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))}
                        className="flex size-11 items-center justify-center rounded-lg text-destructive active:bg-destructive/10"><Trash2 className="size-5" /></button>
                    </li>
                  ))}
                </ul>
              )}
              <button onClick={() => setItems((p) => [...p, { id: `m${Date.now()}`, name: "", quantity: 1, unit: "", price: 0 }])}
                className="flex w-full items-center justify-center gap-2 border-t border-border py-3 font-bold text-secondary"><Plus className="size-5" />{t.add}</button>
            </section>
          </>
        ) : (
          <section className="py-6">
            <div className="rounded-2xl bg-secondary p-5 text-secondary-foreground">
              <p className="text-sm opacity-90">{t.todayTotal}</p>
              <p className="text-4xl font-extrabold">{inr(todayTotal)}</p>
              <p className="text-sm opacity-90">{today.length} {t.bills}</p>
            </div>
            {today.length === 0 ? <p className="py-10 text-center text-muted-foreground">{t.noSales}</p> : (
              <ul className="mt-4 space-y-3">
                {today.map((b) => (
                  <li key={b.id} className="rounded-2xl border-2 border-border bg-card p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{new Date(b.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                      <span className="text-xl font-extrabold text-primary">{inr(b.total)}</span>
                    </div>
                    <p className="mt-1 text-sm">{b.items.map((i) => i.name).join(", ")}</p>
                    <button onClick={() => setSaved(b)} className="mt-2 text-sm font-bold text-secondary">Receipt →</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>

      {tab === "bill" && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-border bg-card shadow-[0_-8px_24px_-12px_var(--color-foreground)]">
          <div className="mx-auto max-w-3xl px-4 py-3">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="font-bold text-muted-foreground">{t.total}</span>
              <span className="text-3xl font-extrabold text-foreground">{inr(total)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={speakTotal} disabled={!items.length}
                className="flex items-center justify-center gap-2 rounded-xl border-2 border-secondary py-3 text-sm font-extrabold text-secondary disabled:opacity-40">
                <Volume2 className="size-5 shrink-0" />{t.speakTotal}</button>
              <button onClick={saveBill} disabled={!items.length}
                className="flex items-center justify-center gap-2 rounded-xl bg-secondary py-3 text-sm font-extrabold text-secondary-foreground disabled:opacity-40">
                <Send className="size-5 shrink-0" />{t.save}</button>
            </div>
          </div>
        </div>
      )}

      {saved && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-foreground/60 p-4 sm:items-center" role="dialog" aria-label={t.summary}>
          <div className="w-full max-w-md rounded-2xl bg-card p-5">
            <h2 className="text-center text-xl font-extrabold text-secondary">✅ {t.summary}</h2>
            <pre className="mt-4 max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-xl bg-muted p-4 font-sans text-sm">{receiptText(saved).replace(/\*/g, "")}</pre>
            <a href={`https://wa.me/?text=${encodeURIComponent(receiptText(saved))}`} target="_blank" rel="noreferrer"
              className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-secondary py-4 text-lg font-extrabold text-secondary-foreground">
              <Send className="size-5" />{t.share}</a>
            <button onClick={() => setSaved(null)} className="mt-2 w-full py-3 font-bold text-muted-foreground">{t.close}</button>
          </div>
        </div>
      )}
    </div>
  );
}
