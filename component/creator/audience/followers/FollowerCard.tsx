// components/creator/audience/followers/FollowerCard.tsx
"use client"

import { useState, useTransition } from "react"
import Image from "next/image"
import { UserPlus, UserCheck, Star, Loader2 } from "lucide-react"
import { followBackAction } from "@/actions/creator/audience"
import { formatDistanceToNow } from "date-fns"
import "@/styles/creator/audience/FollowerCard.scss"

type Props = {
    follower: {
        id: string
        createdAt: Date
        isSubscriber: boolean
        creatorFollowsBack: boolean
        user: {
            id: string
            username: string | null
            firstName: string | null
            lastName: string | null
            image: string | null
        }
    }
}

export const FollowerCard = ({ follower }: Props) => {

    const [followedBack, setFollowedBack] = useState(follower.creatorFollowsBack)
    const [notCreator, setNotCreator] = useState(false)
    const [isPending, startTransition] = useTransition()

    const name = [follower.user.firstName, follower.user.lastName]
        .filter(Boolean).join(" ") || "Anonymous"

    const handle = follower.user.username
        ? `@${follower.user.username}`
        : null

    const handleFollowBack = () => {
        startTransition(async () => {
            const res = await followBackAction(follower.user.id)
            if (res?.success) setFollowedBack(true)
            if (res?.error === "This user is not a creator.") setNotCreator(true)
        })
    }

    return (
        <div className="follower-card">

            {/* Avatar */}
            <div className="follower-card__avatar">
                {follower.user.image ? (
                    <Image
                        src={follower.user.image}
                        alt={name}
                        width={44}
                        height={44}
                    />
                ) : (
                    <span>{name.charAt(0).toUpperCase()}</span>
                )}
                {follower.isSubscriber && (
                    <span className="follower-card__sub-badge" title="Subscriber">
                        <Star size={9} />
                    </span>
                )}
            </div>

            {/* Info */}
            <div className="follower-card__info">
                <p className="follower-card__name">{name}</p>
                {handle && (
                    <p className="follower-card__handle">{handle}</p>
                )}
                <p className="follower-card__since">
                    Followed {formatDistanceToNow(new Date(follower.createdAt), { addSuffix: true })}
                </p>
            </div>

            {/* Badges */}
            <div className="follower-card__badges">
                {follower.isSubscriber && (
                    <span className="follower-badge follower-badge--subscriber">
                        <Star size={10} /> Subscriber
                    </span>
                )}
            </div>

            {/* Follow back */}
            <div className="follower-card__action">
                {followedBack ? (
                    <span className="follower-card__following">
                        <UserCheck size={14} /> Following
                    </span>
                ) : notCreator ? (
                    <span className="follower-card__not-creator">
                        Not a creator
                    </span>
                ) : (
                    <button
                        className="follower-card__follow-btn"
                        onClick={handleFollowBack}
                        disabled={isPending}
                    >
                        {isPending
                            ? <Loader2 size={13} className="spin" />
                            : <UserPlus size={13} />
                        }
                        Follow Back
                    </button>
                )}
            </div>

        </div>
    )
}