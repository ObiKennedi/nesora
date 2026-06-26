// app/onboarding/fan/who-to-follow/page.tsx
import { getSuggestedCreatorsAction } from "@/actions/fan/creators"
import { WhoToFollowClient }          from "@/component/onboarding/WhoToFollowClient"

export default async function WhoToFollowPage() {
    const { creators, categories } = await getSuggestedCreatorsAction()

    return (
        <WhoToFollowClient
            initialCreators={creators}
            categories={categories}
        />
    )
}