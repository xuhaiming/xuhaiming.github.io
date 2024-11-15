import bg from "./assets/haiming_linkedin.png";
import SectionLayout from "../SectionLayout";

function AboutMe() {
  return (
    <SectionLayout title="About Me">
      <div className="container mx-auto">
        <div className="mt-32 flex flex-wrap items-center">
          <div className="mx-auto w-full px-4 md:w-5/12">
            <div className="mb-3 font-bold text-gray-800">
              Working with me is a pleasure
            </div>

            <div className="mb-8 font-normal text-gray-800">
              Do not let your uses guess by attaching tooltips and popoves to
              any element. Just make sure you enable them first via JavaScript.
              <br />
              <br />
              The kit comes with three pre-built pages to help you get started
              faster. You can change the text and images and you are good to go.
              Just make sure you enable them first via JavaScript.
            </div>
          </div>
          <div className="mx-auto mt-24 flex w-full justify-center px-4 md:w-4/12 lg:mt-0">
            <div className="shadow-lg border shadow-gray-500/10 rounded-lg">
              <div className="relative h-56">
                <img
                  alt="Card"
                  src={bg}
                  className="h-full w-full min-w-[400px] min-h-[400px]"
                />
              </div>
              <div>
                <div color="blue-gray" className="mb-3 mt-2 font-bold">
                  My LinkedIn QR Code
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionLayout>
  );
}

export default AboutMe;
