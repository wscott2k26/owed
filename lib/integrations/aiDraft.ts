export interface DraftRequest {
  templateKey: string; tone: number; customerName: string; invoiceNumber: string;
  amountCents: number; daysOverdue: number; businessName?: string; toneMemory?: string | null; allowAi?: boolean;
}
export type DraftResult = { ok: true; text: string; source: "template-fallback" | "openai" } | { ok: false; error: string };
type OpenAIContent = { text?: string; output_text?: string };
type OpenAIOutputItem = { content?: OpenAIContent[] };
type OpenAIResponse = { output_text?: string; output?: OpenAIOutputItem[]; error?: { message?: string } };
const env = (name: string) => (process.env[name] ?? "").trim();
export const isAiConfigured = () => !!env("OPENAI_API_KEY");
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function fallback(req: DraftRequest): string {
  const days = Math.max(0, Math.floor(req.daysOverdue));
  const overdue = days === 0 ? "due now" : `${days} day${days === 1 ? "" : "s"} overdue`;
  const amount = money(req.amountCents);
  const signoff = req.businessName?.trim() ? `\n\nThanks,\n${req.businessName.trim()}` : "";
  if (req.tone < 34) return `Hi ${req.customerName}, just a friendly nudge — invoice ${req.invoiceNumber} for ${amount} is ${overdue}. Let us know if you need anything from us to get it settled.${signoff}`;
  if (req.tone <= 66) return `Hello ${req.customerName}, this is a reminder that invoice ${req.invoiceNumber} for ${amount} is ${overdue}. Please arrange payment at your earliest convenience or reply with an expected payment date.${signoff}`;
  return `Hello ${req.customerName}, invoice ${req.invoiceNumber} for ${amount} is ${overdue}. Please arrange payment promptly or reply today with a payment date so we can resolve the balance.${signoff}`;
}

export async function draftMessage(req: DraftRequest): Promise<DraftResult> {
  if (!req.templateKey?.trim() || !req.customerName?.trim() || !req.invoiceNumber?.trim()) return { ok: false, error: "Draft request is missing required invoice or customer details." };
  if (!Number.isFinite(req.amountCents) || req.amountCents <= 0) return { ok: false, error: "Invoice amount must be positive." };
  if (!Number.isFinite(req.tone) || req.tone < 0 || req.tone > 100) return { ok: false, error: "Tone must be between 0 and 100." };
  if (req.allowAi === false || !isAiConfigured()) return { ok: true, text: fallback(req), source: "template-fallback" };

  const instructions = [
    "You write concise, professional invoice-payment reminders for a small service business.",
    "Never invent fees, collection actions, legal threats, service stoppages, or contract terms.",
    "Do not shame, harass, or imply consequences that were not provided.",
    "Match the requested tone from friendly (0) to firm (100).",
    "Return only the message body, no analysis or markdown.",
  ].join(" ");
  const input = `Template: ${req.templateKey}\nTone: ${req.tone}/100\nCustomer: ${req.customerName}\nInvoice: ${req.invoiceNumber}\nAmount: ${money(req.amountCents)}\nDays overdue: ${Math.max(0, Math.floor(req.daysOverdue))}\nBusiness: ${req.businessName || "the sender"}\nTone memory: ${req.toneMemory || "none"}`;
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: env("OPENAI_DRAFT_MODEL") || "gpt-5.6-luna", instructions, input, max_output_tokens: 250 }),
      cache: "no-store",
    });
    const data = await response.json() as OpenAIResponse;
    if (!response.ok) return { ok: false, error: data?.error?.message || `OpenAI returned HTTP ${response.status}.` };
    let text = typeof data.output_text === "string" ? data.output_text.trim() : "";
    if (!text && Array.isArray(data.output)) {
      text = data.output.flatMap((item) => Array.isArray(item.content) ? item.content : []).map((content) => content.text || content.output_text || "").join("\n").trim();
    }
    if (!text) return { ok: true, text: fallback(req), source: "template-fallback" };
    return { ok: true, text, source: "openai" };
  } catch {
    return { ok: true, text: fallback(req), source: "template-fallback" };
  }
}
