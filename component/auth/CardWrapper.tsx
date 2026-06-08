import { RedirectButton } from "@/component/essentials/LinkButton"
import { FormHeader } from "./FormHeader";
import ContinueWithGoogle from "./ContinueWithGoogle";

import "@/styles/auth/CardWrapper.scss"

type CardWrapperProps = {
    children: React.ReactNode;
    heading: string;
    subHeading: string;
    showSocials?: boolean;
    showButton?: boolean;
    buttonLabel?: string;
    buttonLink: string;
};

export const CardWrapper = ({
    children,
    heading,
    subHeading,
    showSocials,
    showButton,
    buttonLabel,
    buttonLink,
}: CardWrapperProps) => {
    return (
        <div className="card-wrapper">
            <FormHeader heading={heading} subHeading={subHeading} />
            <main className="card-wrapper-contents">
                {children}
                <div className="auth-divider">
                    <span>or</span>
                </div>
                {
                    showSocials && (
                        <ContinueWithGoogle />
                    )
                }
            </main>
            <footer className="card-ooter">
                {
                    showButton && (
                        <RedirectButton
                            path={buttonLink}
                            className="redirect-button"
                        >{buttonLabel}</RedirectButton>
                    )
                }
            </footer>
        </div>
    )
}