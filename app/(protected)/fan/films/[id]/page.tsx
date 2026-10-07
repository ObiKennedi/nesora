import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getFilmsAction, getFilmByIdAction } from "@/actions/fan/films"
import { FilmsClient } from "@/component/fan/films/FilmsClient"

export default async function FilmDetailPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const { id } = await params
    const [data, specificFilm] = await Promise.all([
        getFilmsAction(),
        getFilmByIdAction(id),
    ])

    return (
        <FilmsClient
            heroFilm={specificFilm ?? data.heroFilm}
            newThisWeek={data.newThisWeek}
            trendingNow={data.trendingNow}
            creatorFilms={data.creatorFilms}
            allFilms={data.films}
            currentUserId={session.user.id}
        />
    )
}
