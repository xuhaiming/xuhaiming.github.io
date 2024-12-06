import { isMobileResolution } from "../utils/responsive";

const getBgStyle = (backgroundStyle: "dark" | "light" | "special") => {
  if (backgroundStyle === "dark") {
    return "bg-gradient-to-b from-gray-800 via-gray-900 to-gray-950";
  }

  if (backgroundStyle === "special") {
    return "bg-gradient-to-b from-stone-100 to-indigo-950";
  }

  return "bg-gray-100";
};

function SectionLayout({
  title,
  backgroundStyle = "light",
  children,
}: {
  children: React.ReactNode;
  title: React.ReactNode;
  backgroundStyle?: "dark" | "light" | "special";
}) {
  const bgStyle = getBgStyle(backgroundStyle);

  return (
    <section className={bgStyle}>
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
