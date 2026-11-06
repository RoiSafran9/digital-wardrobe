import { Composition } from "remotion";
import { DURATION, FPS, HEIGHT, WIDTH } from "./film/config";
import { Film } from "./film/Film";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="KipsLaunchV16" component={Film} durationInFrames={DURATION} fps={FPS} width={WIDTH} height={HEIGHT}
      defaultProps={{ opening: "logo" as const }} />
    <Composition id="KipsLaunchV16-Question" component={Film} durationInFrames={DURATION} fps={FPS} width={WIDTH} height={HEIGHT}
      defaultProps={{ opening: "question" as const }} />
  </>
);
