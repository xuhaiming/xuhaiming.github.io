import { Card, CardFooter } from "@nextui-org/react";
import { useRef } from "react";
import { useScroll, motion, useTransform } from "framer-motion";
import { assetsConfig } from "./assetsConfig";

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

const CONTAINER_HEIGHT = 600;
const CONTENT_HEIGHT = 2220;

const COLUMNS = getColumns(5);

function TechStacks() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const moveY = useTransform(
    () => -scrollYProgress.get() * (CONTENT_HEIGHT - CONTAINER_HEIGHT)
  );
  const moveReverseY = useTransform(
    () =>
      -CONTENT_HEIGHT +
      scrollYProgress.get() * (CONTENT_HEIGHT + CONTAINER_HEIGHT)
  );

  const CARD_SIZE = 200;
  const ICON_SIZE = 170;

  return (
    <section className="bg-red">
      <div className="container mx-auto py-32">
        <div className="text-4xl text-center mb-24">My Technical Stacks</div>

        <div
          ref={ref}
          style={{ height: CONTAINER_HEIGHT }}
          className="overflow-hidden px-8"
        >
          <div className="flex justify-between py-[50px]">
            {COLUMNS.map((column, index) => (
              <motion.div
                key={Math.random().toString()}
                className="relative"
                style={{ y: index % 2 ? moveY : moveReverseY }}
              >
                {column.map((item) => (
                  <Card
                    key={Math.random().toString()}
                    isFooterBlurred
                    radius="lg"
                    className="border-none my-8"
                    style={{ width: CARD_SIZE, height: CARD_SIZE }}
                  >
                    <div
                      className="flex justify-center items-center"
                      style={{ paddingTop: (CARD_SIZE - ICON_SIZE) / 2 }}
                    >
                      {item.icon({ width: ICON_SIZE, height: ICON_SIZE })}
                    </div>
                    <CardFooter className="justify-center before:bg-white/10 border-white/20 overflow-hidden absolute before:rounded-xl rounded-large bottom-0 shadow-small z-10">
                      <p className="text-md font-medium text-black">
                        {item.text}
                      </p>
                    </CardFooter>
                  </Card>
                ))}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default TechStacks;
