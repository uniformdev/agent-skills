import {
  ResolveComponentFunction,
  type ResolveComponentResult,
} from "@uniformdev/next-app-router";

import { DefaultNotFoundComponent } from "./DefaultNotFound";
import { PageComponent } from "./Page";

export const resolveComponent: ResolveComponentFunction = ({ component }) => {
  let result: ResolveComponentResult | undefined;

  if (component.type === "page") {
    result = { component: PageComponent };
  }

  return result || { component: DefaultNotFoundComponent };
};
