"use client"

import { CategoryPicker } from "@/component/onboarding/CategoryPicker"
import { saveFanCategoriesAction } from "@/actions/creator/categories"
import { Category } from "@prisma/client"

export default function FanCategoriesPage() {
    return (
        <CategoryPicker
            heading="What are you into?"
            subHeading="Pick the categories you love. We'll use these to recommend creators worth following."
            hint="Pick between 1 and 10 categories. You can update these anytime."
            min={1}
            max={10}
            submitLabel="Continue →"
            onSubmit={(cats: Category[]) => saveFanCategoriesAction(cats)}
        />
    )
}