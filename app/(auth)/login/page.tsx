import { LoginForm } from "@/component/auth/LoginForm"
import { Loader } from "@/component/essentials/Loader"
import { Suspense } from "react"

export default function LoginPage() {
    return (
        <Suspense fallback={<Loader fullscreen={false} />}>
            <LoginForm />
        </Suspense>
    )
}