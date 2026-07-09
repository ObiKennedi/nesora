// components/fan/feed/GiftPanel.tsx
"use client"

import { useState, useEffect, useTransition } from "react"
import Image                                   from "next/image"
import { Loader2, Wallet, Plus, ShieldCheck, Gift as GiftIcon } from "lucide-react"
import {
    getGiftsAction,
    getCreatorForGiftAction,
    sendGiftAction,
    getFanWalletAction,
    initializePaystackAction,
    verifyPaystackPaymentAction,
} from "@/actions/fan/wallet"
import { SidePanel, useSidePanelClose } from "@/component/fan/ui/SidePanel"
import "@/styles/fan/GiftPanel.scss"

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
    creatorId:     string
    liveStreamId?: string
    onClose:       () => void
    onSent?:       (giftEmoji: string, giftName: string) => void
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

type ToastState = { message: string; type: "success" | "error" } | null

const PRESETS = [500, 1000, 2000, 5000, 10000]

// ── Content ───────────────────────────────────────────────────────────────────

type ContentProps = {
    creatorId:     string
    liveStreamId?: string
    onSent?:       (giftEmoji: string, giftName: string) => void
    onCreatorLoad: (c: Creator | null) => void
    onBalanceLoad: (n: number) => void
    balance:       number
    setBalance:    (updater: (b: number) => number) => void
}

const GiftPanelContent = ({
    creatorId, liveStreamId, onSent,
    onCreatorLoad, onBalanceLoad, balance, setBalance,
}: ContentProps) => {
    const closePanel = useSidePanelClose()

    const [gifts,       setGifts]       = useState<Gift[]>([])
    const [selectedId,  setSelectedId]  = useState<string | null>(null)
    const [quantity,    setQuantity]    = useState(1)
    const [loading,     setLoading]     = useState(true)
    const [toast,       setToast]       = useState<ToastState>(null)
    const [showTopUp,   setShowTopUp]   = useState(false)
    const [topUpAmount, setTopUpAmount] = useState<number | null>(null)
    const [isPending,   startTransition] = useTransition()

    // Load gifts, creator, wallet in parallel
    useEffect(() => {
        startTransition(async () => {
            const [giftsData, creatorData, walletData] = await Promise.all([
                getGiftsAction(),
                getCreatorForGiftAction(creatorId),
                getFanWalletAction(),
            ])
            setGifts(giftsData)
            onCreatorLoad(creatorData)
            onBalanceLoad(walletData.balance)
            if (giftsData.length > 0) setSelectedId(giftsData[0].id)
            setLoading(false)
        })
    }, [creatorId])

    const showToast = (message: string, type: "success" | "error") => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3500)
    }

    const selected  = gifts.find((g) => g.id === selectedId)
    const totalCost = selected ? selected.value * quantity : 0
    const canAfford = balance >= totalCost
    const shortfall = totalCost - balance

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
                setTimeout(closePanel, 1200)
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
                onCancel: () => showToast("Payment cancelled.", "error"),
            })
        })
    }

    if (loading) {
        return (
            <div className="side-panel__loading">
                <Loader2 size={24} className="spin" />
            </div>
        )
    }

    // ── Top-up view ───────────────────────────────────────────────────────────
    if (showTopUp) {
        return (
            <>
                <div className="side-panel__scroll">
                    <div className="gift-panel__topup">
                        <div className="gift-panel__topup-header">
                            <button
                                type="button"
                                className="gift-panel__back"
                                onClick={() => setShowTopUp(false)}
                            >
                                ← Back
                            </button>
                            <p className="gift-panel__topup-title">Top up wallet</p>
                        </div>

                        {shortfall > 0 && (
                            <div className="gift-panel__topup-hint">
                                You need <strong>₦{shortfall.toLocaleString()}</strong> more to send this gift.
                            </div>
                        )}

                        <div className="gift-panel__presets">
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

                        <div className="gift-panel__custom-amount">
                            <span className="gift-panel__currency">₦</span>
                            <input
                                type="number"
                                className="gift-panel__amount-input"
                                placeholder="Custom amount"
                                value={topUpAmount ?? ""}
                                onChange={(e) => setTopUpAmount(Number(e.target.value))}
                                min={100}
                            />
                        </div>
                    </div>
                </div>

                <div className="side-panel__footer">
                    <button
                        type="button"
                        className="gift-panel__pay-btn"
                        onClick={handleTopUp}
                        disabled={isPending || !topUpAmount || topUpAmount < 100}
                    >
                        {isPending
                            ? <><Loader2 size={15} className="spin" /> Processing…</>
                            : `Pay ₦${(topUpAmount ?? 0).toLocaleString()} via Paystack`
                        }
                    </button>
                </div>

                {toast && (
                    <div className={`side-panel__toast side-panel__toast--${toast.type}`}>
                        {toast.message}
                    </div>
                )}
            </>
        )
    }

    // ── Gift selection view ───────────────────────────────────────────────────
    return (
        <>
            <div className="side-panel__scroll">
                <div className="gift-panel__grid">
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
            </div>

            {selected && (
                <div className="side-panel__footer">
                    <div className="gift-panel__footer-row">
                        <div className="gift-panel__quantity">
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

                        <div className="gift-panel__total">
                            <span>Total</span>
                            <strong>₦{totalCost.toLocaleString()}</strong>
                        </div>
                    </div>

                    <button
                        type="button"
                        className={`gift-panel__send-btn ${!canAfford ? "gift-panel__send-btn--topup" : ""}`}
                        onClick={handleSend}
                        disabled={isPending}
                    >
                        {isPending ? (
                            <><Loader2 size={15} className="spin" /> Sending…</>
                        ) : !canAfford ? (
                            <><Plus size={14} /> Top up &amp; Send</>
                        ) : (
                            `Send ${selected.emoji} ${selected.name}`
                        )}
                    </button>
                </div>
            )}

            {toast && (
                <div className={`side-panel__toast side-panel__toast--${toast.type}`}>
                    {toast.message}
                </div>
            )}
        </>
    )
}

// ── GiftPanel ─────────────────────────────────────────────────────────────────

export const GiftPanel = ({ creatorId, liveStreamId, onClose, onSent }: Props) => {
    // Hoisted so they can render in the panel's subheader
    const [creator, setCreator] = useState<Creator | null>(null)
    const [balance, setBalanceState] = useState(0)

    const setBalance = (updater: (b: number) => number) =>
        setBalanceState((b) => updater(b))

    const subheader = (
        <div className="gift-panel__subheader">
            {creator && (
                <div className="gift-panel__to">
                    <span>to</span>
                    {creator.image ? (
                        <Image
                            src={creator.image}
                            alt={creator.displayName}
                            width={22}
                            height={22}
                            className="gift-panel__creator-avatar"
                        />
                    ) : (
                        <span className="gift-panel__creator-fallback">
                            {creator.displayName.charAt(0)}
                        </span>
                    )}
                    <span className="gift-panel__creator-name">
                        {creator.displayName}
                        {creator.isVerified && (
                            <ShieldCheck size={11} className="gift-panel__verified" />
                        )}
                    </span>
                </div>
            )}

            <div className="gift-panel__balance">
                <Wallet size={14} />
                <span>Balance: <strong>₦{balance.toLocaleString()}</strong></span>
            </div>
        </div>
    )

    return (
        <SidePanel
            onClose={onClose}
            ariaLabel="Send a gift"
            icon={<GiftIcon size={18} />}
            title="Send a Gift"
            subheader={subheader}
        >
            <GiftPanelContent
                creatorId={creatorId}
                liveStreamId={liveStreamId}
                onSent={onSent}
                onCreatorLoad={setCreator}
                onBalanceLoad={setBalanceState}
                balance={balance}
                setBalance={setBalance}
            />
        </SidePanel>
    )
}