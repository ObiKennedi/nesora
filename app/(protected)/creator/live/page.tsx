import { auth }     from "@/lib/auth"
import { prisma }   from "@/lib/prisma"
import { redirect } from "next/navigation"
import GoLiveClient from "@/component/creator/live/GoLiveClient"

export default async function GoLivePage() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await prisma.creator.findUnique({
        where:  { userId: session.user.id },
        select: { id: true },
    })
    if (!creator) redirect("/onboarding")

   return <GoLiveClient creatorId={creator.id} currentUserId={session.user.id} />
}