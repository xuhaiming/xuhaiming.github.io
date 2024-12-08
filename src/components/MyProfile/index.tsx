import { Carousel } from "react-responsive-3d-carousel";
import SectionLayout from "../SectionLayout";

import "react-responsive-3d-carousel/dist/styles.css";

import profile1 from "./assets/my_profile_1.png";
import profile2 from "./assets/my_profile_2.png";
import profile3 from "./assets/my_profile_3.png";
import profile4 from "./assets/my_profile_4.png";
import profile5 from "./assets/my_profile_5.png";

const items = [
  <img src={profile1} alt="profile1" />,
  <img src={profile2} alt="profile2" />,
  <img src={profile3} alt="profile3" />,
  <img src={profile4} alt="profile4" />,
  <img src={profile5} alt="profile5" />,
];

function MyProfile() {
  return (
    <SectionLayout title="My AI Profile" backgroundStyle="dark">
      <div className="text-center text-white text-lg mb-24">
        My AI Profile images crafted using the Flux model with LoRA training
      </div>

      <Carousel
        containerHeight="400px"
        items={items}
        startIndex={0}
        showArrows={false}
        showStatus={false}
        width="auto"
      />
    </SectionLayout>
  );
}

export default MyProfile;
