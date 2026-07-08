// lib/paystack-transfers.ts
import "server-only"

const PAYSTACK_BASE = "https://api.paystack.co"
const SECRET = process.env.PAYSTACK_SECRET_KEY!

type PaystackResponse<T> = {
    status: boolean
    message: string
    data: T
}

async function paystack<T>(path: string, init?: RequestInit): Promise<PaystackResponse<T>> {
    const res = await fetch(`${PAYSTACK_BASE}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${SECRET}`,
            "Content-Type": "application/json",
            ...init?.headers,
        },
        cache: "no-store",
    })

    const json = (await res.json()) as PaystackResponse<T>

    if (!res.ok || !json.status) {
        throw new PaystackError(json.message ?? `Paystack request failed (${res.status})`)
    }

    return json
}

export class PaystackError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "PaystackError"
    }
}

// ── Transfer recipient ────────────────────────────────────────────────────────

export async function createTransferRecipient(params: {
    accountName:   string
    accountNumber: string
    bankCode:      string
}) {
    const res = await paystack<{ recipient_code: string }>("/transferrecipient", {
        method: "POST",
        body: JSON.stringify({
            type:           "nuban",
            name:           params.accountName,
            account_number: params.accountNumber,
            bank_code:      params.bankCode,
            currency:       "NGN",
        }),
    })

    return res.data.recipient_code
}

// ── Transfer initiation ───────────────────────────────────────────────────────

export async function initiateTransfer(params: {
    amountNaira:   number  // netAmount in Naira — converted to kobo here
    recipientCode: string
    reference:     string  // our idempotency key — Paystack dedupes on this
    reason?:       string
}) {
    const res = await paystack<{ transfer_code: string; status: string }>("/transfer", {
        method: "POST",
        body: JSON.stringify({
            source:    "balance",
            amount:    Math.round(params.amountNaira * 100), // kobo
            recipient: params.recipientCode,
            reference: params.reference,
            reason:    params.reason ?? "NESORA creator payout",
        }),
    })

    return { transferCode: res.data.transfer_code, status: res.data.status }
}