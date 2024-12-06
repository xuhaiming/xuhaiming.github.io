import { Carousel } from "react-responsive-3d-carousel";
import SectionLayout from "../SectionLayout";

import "react-responsive-3d-carousel/dist/styles.css";

import thoughtworksImg from "../threeModels/assets/thoughtworks.jpeg";
import epamImg from "../threeModels/assets/epam.jpeg";
import tencentImg from "../threeModels/assets/tencent.jpeg";
import shopeeImg from "../threeModels/assets/shopee.jpeg";
import trustanaImg from "../threeModels/assets/trustana.jpeg";

const items = [
  <img src={thoughtworksImg} alt="thoughtworks" />,
  <img src={epamImg} alt="epam" />,
  <img src={tencentImg} alt="tencent" />,
  <img src={shopeeImg} alt="shopee" />,
  <img src={trustanaImg} alt="trustana" />,
];

function MyProfile() {
  return (
    <SectionLayout title="My AI Profile" backgroundStyle="dark">
      <div className="text-center text-white text-lg mb-24">
        My AI Profile images crafted using the Flux model with Lora training
      </div>

      <Carousel
        items={items}
        startIndex={0}
        showArrows={false}
        showStatus={false}
      />
    </SectionLayout>
  );
}

export default MyProfile;
