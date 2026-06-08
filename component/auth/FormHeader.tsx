import "@/styles/auth/FormHeader.scss";

type FormHeaderProps = {
    heading: string;
    subHeading: string;
}

export const FormHeader = ({
    heading,
    subHeading
}: FormHeaderProps) => {
    return (
        <header className="card-heading">
            <h2>{heading}</h2>
            <p>{subHeading}</p>
        </header>
    )
}