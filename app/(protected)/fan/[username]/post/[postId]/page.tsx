// app/(fan)/fan/[username]/post/[postId]/page.tsx

import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"
import { getPostPageAction } from "@/actions/post-page"
import PostFeedClient from "@/component/post-page/PostFeedClient"

type Props = {
    params: Promise<{ username: string; postId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    // Deliberately generic — never leak gated titles/bodies into link previews
    const { username } = await params
    return {
        title:       `Post by @${username} • NESORA`,
        description: `See what @${username} is sharing on NESORA.`,
    }
}

export default async function PostPage({ params }: Props) {
    const { username, postId } = await params

    const result = await getPostPageAction(postId)
    if (result.status !== "success") notFound()

    if (result.creator.username !== username) {
        redirect(`/fan/${result.creator.username}/post/${postId}`)
    }

    return (
        <PostFeedClient
            initialPost={result.post}
            creator={result.creator}
            viewerAuthenticated={result.viewer.authenticated}
        />
    )
}