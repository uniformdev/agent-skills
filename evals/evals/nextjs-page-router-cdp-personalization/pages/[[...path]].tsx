import type { UniformCompositionNextPage } from "@uniformdev/canvas-next";
import { withUniformGetServerSideProps } from "@uniformdev/canvas-next/route";
import { UniformComposition } from "@uniformdev/canvas-react";

export const getServerSideProps = withUniformGetServerSideProps();

const page: UniformCompositionNextPage = ({ data, matchedRoute, dynamicInputs }) => {
  return (
    <UniformComposition
      data={data}
      matchedRoute={matchedRoute}
      dynamicInputs={dynamicInputs}
    />
  );
};

export { page as default };
