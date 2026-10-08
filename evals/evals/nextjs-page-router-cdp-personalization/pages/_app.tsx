import { UniformContext } from "@uniformdev/context-react";
import type { UniformAppProps } from "@uniformdev/context-next";
import { createUniformContext } from "@/lib/uniform/createUniformContext";
import "@/components/uniformComponents";

const clientContext = createUniformContext();

export default function App({ Component, pageProps, serverUniformContext }: UniformAppProps) {
  return (
    <UniformContext context={serverUniformContext ?? clientContext} outputType="standard">
      <Component {...pageProps} />
    </UniformContext>
  );
}
