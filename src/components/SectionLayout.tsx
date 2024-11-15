import { isMobileResolution } from "../utils/responsive";

function SectionLayout({
  title,
  backgroundStyle = "light",
  children,
}: {
  children: React.ReactNode;
  title: React.ReactNode;
  backgroundStyle?: "dark" | "light";
}) {
  return (
    <section
      className={
        backgroundStyle === "light"
          ? "bg-gray-100"
          : "bg-gradient-to-b from-gray-800 via-gray-900 to-gray-950"
      }
    >
      <div
        className={`container mx-auto ${isMobileResolution() ? "py-16" : "py-32"}`}
      >
        <div
          className={
            isMobileResolution()
              ? "text-2xl text-center mb-12"
              : "text-4xl text-center mb-24"
          }
        >
          <div
            style={{ color: backgroundStyle === "dark" ? "white" : "black" }}
          >
            {title}
          </div>
        </div>

        {children}
      </div>
    </section>
  );
}

export default SectionLayout;
