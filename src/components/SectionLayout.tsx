import { isMobileResolution } from "../utils/responsive";

function SectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-gray-100">
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
          My Technical Stacks
        </div>

        {children}
      </div>
    </section>
  );
}

export default SectionLayout;
