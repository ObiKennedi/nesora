// components/fan/feed/GiftModal.tsx
"use client"

import { useState, useEffect, useTransition } from "react"
import Image                                   from "next/image"
import { X, Loader2, Wallet, Plus, ShieldCheck } from "lucide-react"
import {
    getGiftsAction,
    getCreatorForGiftAction,
    sendGiftAction,
    getFanWalletAction,
    initializePaystackAction,
    verifyPaystackPaymentAction,
} from "@/actions/fan/wallet"
import "@/styles/fan/GiftModal.scss"

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
    creatorId:    string
    liveStreamId?: string          // ← add
    onClose:      () => void
    onSent?:      (giftEmoji: string, giftName: string) => void
}

type Gift = {
    id:       string
    name:     string
    emoji:    string
    value:    number
    imageUrl: string | null
}

type Creator = {
    id:          string
    displayName: string
    handle:      string | null
    isVerified:  boolean
    image:       string | null
}
// ── Toast ─────────────────────────────────────────────────────────────────────

type ToastState = { message: string; type: "success" | "error" } | null

// ── GiftModal ─────────────────────────────────────────────────────────────────

export const GiftModal = ({ creatorId, liveStreamId, onClose, onSent }: Props) => {
    const [gifts,       setGifts]       = useState<Gift[]>([])
    const [creator,     setCreator]     = useState<Creator | null>(null)
    const [balance,     setBalance]     = useState(0)
    const [selectedId,  setSelectedId]  = useState<string | null>(null)
    const [quantity,    setQuantity]    = useState(1)
    const [loading,     setLoading]     = useState(true)
    const [toast,       setToast]       = useState<ToastState>(null)
    const [visible,     setVisible]     = useState(false)
    const [showTopUp,   setShowTopUp]   = useState(false)
    const [topUpAmount, setTopUpAmount] = useState<number | null>(null)
    const [isPending,   startTransition] = useTransition()

    const PRESETS = [500, 1000, 2000, 5000, 10000]
    // Slide-up animation
    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 10)
        return () => clearTimeout(t)
    }, [])

    // Load gifts, creator, wallet in parallel
    useEffect(() => {
        startTransition(async () => {
            const [giftsData, creatorData, walletData] = await Promise.all([
                getGiftsAction(),
                getCreatorForGiftAction(creatorId),
                getFanWalletAction(),
            ])
            setGifts(giftsData)
            setCreator(creatorData)
            setBalance(walletData.balance)
            if (giftsData.length > 0) setSelectedId(giftsData[0].id)
            setLoading(false)
        })
    }, [creatorId])

    const showToast = (message: string, type: "success" | "error") => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3500)
    }

    const handleClose = () => {
        setVisible(false)
        setTimeout(onClose, 280)
    }

    const selected     = gifts.find((g) => g.id === selectedId)
    const totalCost    = selected ? selected.value * quantity : 0
    const canAfford    = balance >= totalCost
    const shortfall    = totalCost - balance

    // ── Send gift ─────────────────────────────────────────────────────────────
    const handleSend = () => {
        if (!selectedId || !selected) return

        if (!canAfford) {
            setTopUpAmount(shortfall)
            setShowTopUp(true)
            return
        }

        startTransition(async () => {
            const res = await sendGiftAction({ creatorId, giftId: selectedId, quantity, liveStreamId })

            if (res?.error === "INSUFFICIENT_FUNDS") {
                setTopUpAmount(res.shortfall ?? shortfall)
                setShowTopUp(true)
                return
            }

            if (res?.error) {
                showToast(res.error, "error")
                return
            }

            if (res?.success) {
                setBalance((b) => b - totalCost)
                showToast(`${selected.emoji} ${selected.name} sent!`, "success")
                onSent?.(selected.emoji, selected.name)
                setTimeout(handleClose, 1200)
            }
        })
    }

    // ── Paystack top-up ───────────────────────────────────────────────────────
    const handleTopUp = async () => {
        const amount = topUpAmount ?? 500
        if (amount < 100) return

        startTransition(async () => {
            const res = await initializePaystackAction(amount)
            if (res?.error) { showToast(res.error, "error"); return }
            if (!res?.success || !res.accessCode) return

            // Load Paystack popup dynamically
            const PaystackPop = (await import("@paystack/inline-js")).default
            const handler     = new PaystackPop()

            handler.resumeTransaction(res.accessCode, {
                onSuccess: async (transaction: { reference: string }) => {
                    const verify = await verifyPaystackPaymentAction(transaction.reference)
                    if (verify?.success) {
                        setBalance((b) => b + amount)
                        showToast(`₦${amount.toLocaleString()} added to wallet!`, "success")
                        setShowTopUp(false)
                        setTopUpAmount(null)
                    } else {
                        showToast("Payment verification failed. Contact support.", "error")
                    }
                },
                onCancel: () => {
                    showToast("Payment cancelled.", "error")
                },
            })
        })
    }

    return (
        <>
            {/* Backdrop */}
            <div
                className={`gift-backdrop ${visible ? "gift-backdrop--visible" : ""}`}
                onClick={handleClose}
                aria-hidden="true"
            />

            {/* Modal */}
            <div
                className={`gift-modal ${visible ? "gift-modal--visible" : ""}`}
                role="dialog"
                aria-modal="true"
                aria-label="Send a gift"
            >
                {/* Handle */}
                <div className="gift-modal__handle" />

                {/* Header */}
                <div className="gift-modal__header">
                    <div className="gift-modal__title-row">
                        <h3>Send a Gift</h3>
                        {creator && (
                            <div className="gift-modal__to">
                                <span>to</span>
                                {creator.image ? (
                                    <Image
                                        src={creator.image}
                                        alt={creator.displayName}
                                        width={22} height={22}
                                        className="gift-modal__creator-avatar"
                                    />
                                ) : (
                                    <span className="gift-modal__creator-fallback">
                                        {creator.displayName.charAt(0)}
                                    </span>
                                )}
                                <span className="gift-modal__creator-name">
                                    {creator.displayName}
                                    {creator.isVerified && (
                                        <ShieldCheck size={11} className="gift-modal__verified" />
                                    )}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Wallet balance */}
                    <div className="gift-modal__balance">
                        <Wallet size={14} />
                        <span>Balance: <strong>₦{balance.toLocaleString()}</strong></span>
                        <button
                            type="button"
                            className="gift-modal__topup-link"
                            onClick={() => { setTopUpAmount(500); setShowTopUp(true) }}
                        >
                            <Plus size={11} /> Top up
                        </button>
                    </div>

                    <button
                        type="button"
                        className="gift-modal__close"
                        onClick={handleClose}
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                {loading ? (
                    <div className="gift-modal__loading">
                        <Loader2 size={24} className="spin" />
                    </div>
                ) : showTopUp ? (
                    /* ── Top-up view ── */
                    <div className="gift-modal__topup">
                        <div className="gift-modal__topup-header">
                            <button
                                type="button"
                                className="gift-modal__back"
                                onClick={() => setShowTopUp(false)}
                            >
                                ← Back
                            </button>
                            <p className="gift-modal__topup-title">Top up wallet</p>
                        </div>

                        {shortfall > 0 && (
                            <div className="gift-modal__topup-hint">
                                You need <strong>₦{shortfall.toLocaleString()}</strong> more to send this gift.
                            </div>
                        )}

                        <div className="gift-modal__presets">
                            {PRESETS.map((preset) => (
                                <button
                                    key={preset}
                                    type="button"
                                    className={`gift-preset ${topUpAmount === preset ? "gift-preset--active" : ""}`}
                                    onClick={() => setTopUpAmount(preset)}
                                >
                                    ₦{preset.toLocaleString()}
                                </button>
                            ))}
                        </div>

                        <div className="gift-modal__custom-amount">
                            <span className="gift-modal__currency">₦</span>
                            <input
                                type="number"
                                className="gift-modal__amount-input"
                                placeholder="Custom amount"
                                value={topUpAmount ?? ""}
                                onChange={(e) => setTopUpAmount(Number(e.target.value))}
                                min={100}
                            />
                        </div>

                        <button
                            type="button"
                            className="gift-modal__pay-btn"
                            onClick={handleTopUp}
                            disabled={isPending || !topUpAmount || topUpAmount < 100}
                        >
                            {isPending
                                ? <><Loader2 size={15} className="spin" /> Processing…</>
                                : `Pay ₦${(topUpAmount ?? 0).toLocaleString()} via Paystack`
                            }
                        </button>
                    </div>
                ) : (
                    /* ── Gift selection view ── */
                    <>
                        <div className="gift-modal__grid">
                            {gifts.map((gift) => (
                                <button
                                    key={gift.id}
                                    type="button"
                                    className={`gift-tile ${selectedId === gift.id ? "gift-tile--selected" : ""}`}
                                    onClick={() => setSelectedId(gift.id)}
                                >
                                    <span className="gift-tile__emoji">{gift.emoji}</span>
                                    <span className="gift-tile__name">{gift.name}</span>
                                    <span className="gift-tile__value">₦{gift.value.toLocaleString()}</span>
                                </button>
                            ))}
                        </div>

                        {/* Quantity + total */}
                        {selected && (
                            <div className="gift-modal__footer">
                                <div className="gift-modal__quantity">
                                    <button
                                        type="button"
                                        className="gift-qty-btn"
                                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                                        disabled={quantity <= 1}
                                    >−</button>
                                    <span className="gift-qty-val">{quantity}</span>
                                    <button
                                        type="button"
                                        className="gift-qty-btn"
                                        onClick={() => setQuantity((q) => Math.min(100, q + 1))}
                                        disabled={quantity >= 100}
                                    >+</button>
                                </div>

                                <div className="gift-modal__total">
                                    <span>Total</span>
                                    <strong>₦{totalCost.toLocaleString()}</strong>
                                </div>

                                <button
                                    type="button"
                                    className={`gift-modal__send-btn ${!canAfford ? "gift-modal__send-btn--topup" : ""}`}
                                    onClick={handleSend}
                                    disabled={isPending}
                                >
                                    {isPending ? (
                                        <><Loader2 size={15} className="spin" /> Sending…</>
                                    ) : !canAfford ? (
                                        <><Plus size={14} /> Top up & Send</>
                                    ) : (
                                        `Send ${selected.emoji} ${selected.name}`
                                    )}
                                </button>
                            </div>
                        )}
                    </>
                )}

                {/* Toast */}
                {toast && (
                    <div className={`gift-toast gift-toast--${toast.type}`}>
                        {toast.message}
                    </div>
                )}
            </div>
        </>
    )
}