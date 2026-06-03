import { Footer } from "@/component/landing-page/Footer";
import Navbar from "@/component/landing-page/NavBar";

const LandingPage = ({ children }: { children: React.ReactNode }) => {
    return (
        <>
            <Navbar />
            {children}
            <Footer />
        </>
    )
}

export default LandingPage;