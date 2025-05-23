import { Card, CardFooter } from "@nextui-org/react";
import { useRef } from "react";
import { useScroll, motion, useTransform } from "framer-motion";
import { assetsConfig } from "./assetsConfig";
import { isMobileResolution } from "../../utils/responsive";
import SectionLayout from "../SectionLayout";

const getColumns = (groupNum: number) => {
  const groupItemsCount = assetsConfig.length / groupNum;
  const result = [];

  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < groupNum; i++) {
    const offset = i * groupItemsCount;
    const config = assetsConfig
      .slice(offset, offset + groupItemsCount)
      .map(({ Comp, text }) => ({
        icon: ({ width, height }: { width: number; height: number }) => (
          <Comp width={width} height={height} />
        ),
        text,
      }));
    result.push(config);
  }

  return result;
};

const CONTAINER_HEIGHT = isMobileResolution()
  ? window.innerHeight - 128 - 32 - 48
  : window.innerHeight - 256 - 40 - 96;
const CONTENT_HEIGHT = 2220;

const COLUMNS = isMobileResolution() ? getColumns(3) : getColumns(5);

function TechStacks() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const moveY = useTransform(
    scrollYProgress,
    [0, 1],
    [0, -(CONTENT_HEIGHT - CONTAINER_HEIGHT)]
  );
  const moveReverseY = useTransform(
    scrollYProgress,
    [0, 1],
    [-CONTENT_HEIGHT, CONTAINER_HEIGHT]
  );

  const CARD_SIZE = isMobileResolution() ? 100 : 200;
  const ICON_SIZE = isMobileResolution() ? 70 : 170;

  return (
    <SectionLayout title="My Technical Stacks">
      <div
        ref={ref}
        style={{ height: CONTAINER_HEIGHT }}
        className="overflow-hidden px-8"
      >
        <div className="flex justify-between py-[50px]">
          {COLUMNS.map((column, index) => (
            <motion.div
              // eslint-disable-next-line react/no-array-index-key
              key={`key-${index}`}
              className="relative"
              style={{ y: index % 2 ? moveY : moveReverseY }}
            >
              {column.map((item) => (
                <Card
                  key={item.text}
                  isFooterBlurred
                  radius="lg"
                  className="border-none my-8 bg-gray-50"
                  style={{ width: CARD_SIZE, height: CARD_SIZE }}
                >
                  <div
                    className="flex justify-center items-center"
                    style={{ paddingTop: (CARD_SIZE - ICON_SIZE) / 2 }}
                  >
                    {item.icon({ width: ICON_SIZE, height: ICON_SIZE })}
                  </div>
                  <CardFooter
                    className={`justify-center before:bg-white/10 border-white/20 overflow-hidden absolute before:rounded-xl rounded-large bottom-0 shadow-small z-10 ${isMobileResolution() ? "p-1" : "p-3"}`}
                  >
                    <div className="font-medium text-black">
                      <div
                        className={isMobileResolution() ? "text-sm" : "text-md"}
                      >
                        {item.text}
                      </div>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </motion.div>
          ))}
        </div>
      </div>
    </SectionLayout>
  );
}

export default TechStacks;
