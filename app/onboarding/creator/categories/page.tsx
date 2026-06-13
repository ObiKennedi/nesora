// app/onboarding/creator/categories/page.tsx
"use client"

import { CategoryPicker } from "@/component/onboarding/CategoryPicker"
import { saveCreatorCategoriesAction } from "@/actions/creator/categories"
import { Category } from "@prisma/client"

export default function CreatorCategoriesPage() {
    return (
        <CategoryPicker
            heading="What do you create?"
            subHeading="Choose the categories that best describe your content. This helps fans find you and helps NESORA surface your work to the right audience."
            hint="Pick between 1 and 5 categories. You can update these anytime."
            min={1}
            max={5}
            submitLabel="Continue to Verification →"
            onSubmit={(cats: Category[]) => saveCreatorCategoriesAction(cats)}
        />
    )
}