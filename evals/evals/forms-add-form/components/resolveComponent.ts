import {
  ResolveComponentFunction,
  type ResolveComponentResult,
} from "@uniformdev/next-app-router";

import { DefaultNotFoundComponent } from "./DefaultNotFound";
import { HeroComponent } from "./Hero";
import { PageComponent } from "./Page";

export const resolveComponent: ResolveComponentFunction = ({ component }) => {
  let result: ResolveComponentResult | undefined;

  if (component.type === "page") {
    result = { component: PageComponent };
  } else if (component.type === "hero") {
    result = { component: HeroComponent };
  }

  return result || { component: DefaultNotFoundComponent };
};
