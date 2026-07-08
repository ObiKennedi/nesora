// app/(creator)/creator/calls/page.tsx
import { auth }        from "@/lib/auth"
import { redirect }    from "next/navigation"
import { prisma }      from "@/lib/prisma"
import { CallHistory } from "@/component/calls/CallHistory"

export default async function CreatorCallsPage() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await prisma.creator.findUnique({
        where:  { userId: session.user.id },
        select: { id: true },
    })
    if (!creator) redirect("/onboarding")

    return <CallHistory perspective="creator" />
}