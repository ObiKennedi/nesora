"use client";

import { signIn } from "next-auth/react";
import { FcGoogle } from "react-icons/fc";
import "@/styles/auth/ContinueWithGoogle.scss";

const ContinueWithGoogle = () => {
    return (
        <button
            className="continue-with-google"
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
        >
            <FcGoogle />
            Continue with Google
        </button>
    );
};

export default ContinueWithGoogle;