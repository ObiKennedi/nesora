import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getFilmsAction } from "@/actions/fan/films"
import { FilmsClient } from "@/component/fan/films/FilmsClient"

export const metadata = {
    title: "Films | NESORA",
    description: "Watch cinematic creator films, series, and documentaries on NESORA.",
}

export default async function FilmsPage() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const data = await getFilmsAction()

    return (
        <FilmsClient
            heroFilm={data.heroFilm}
            newThisWeek={data.newThisWeek}
            trendingNow={data.trendingNow}
            creatorFilms={data.creatorFilms}
            allFilms={data.films}
            currentUserId={session.user.id}
        />
    )
}
