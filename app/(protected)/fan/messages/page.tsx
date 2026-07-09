import { auth }              from "@/lib/auth"
import { redirect }          from "next/navigation"
import { FanMessagesClient } from "@/component/fan/messages/FanMessagesClient"

export default async function MessagesPage() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    return <FanMessagesClient currentUserId={session.user.id} />
}