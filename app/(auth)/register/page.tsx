import { RegisterForm } from "@/component/auth/RegisterForm"
import { Loader } from "@/component/essentials/Loader"
import { Suspense } from "react"

const RegisterPage = () => {
    return (
        <Suspense fallback={<Loader fullscreen={false} />}>
            <RegisterForm />
        </Suspense>
    )
}

export default RegisterPage