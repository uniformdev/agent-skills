import type { AppProps } from "next/app";
import "@/components/uniformComponents";
import "@/styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
