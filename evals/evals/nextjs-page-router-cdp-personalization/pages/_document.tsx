import { enableNextSsr } from "@uniformdev/context-next";
import Document, { Head, Html, Main, NextScript, type DocumentContext, type DocumentInitialProps } from "next/document";
import { createUniformContext } from "@/lib/uniform/createUniformContext";

export default class UniformDocument extends Document {
  static async getInitialProps(ctx: DocumentContext): Promise<DocumentInitialProps> {
    const serverTracker = createUniformContext(ctx);
    enableNextSsr(ctx, serverTracker);
    return await Document.getInitialProps(ctx);
  }

  render() {
    return (
      <Html lang="en">
        <Head />
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
