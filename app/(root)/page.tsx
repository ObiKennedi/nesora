import { AboutSection } from "@/component/landing-page/AboutSection";
import { ContactSection } from "@/component/landing-page/ContactForm";
import { CreatorsSection } from "@/component/landing-page/CreatorsSection";
import { FAQSection } from "@/component/landing-page/Faq";
import { FeaturesSection } from "@/component/landing-page/Features";
import { HeroSection } from "@/component/landing-page/HeroSection";

const RootPage = () => {
    return (
        <main>
            <HeroSection />
            <AboutSection />
            <FeaturesSection />
            <CreatorsSection />
            <FAQSection />
            <ContactSection />
        </main>
    );
};

export default RootPage;