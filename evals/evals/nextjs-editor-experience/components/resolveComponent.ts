import {
  ResolveComponentFunction,
  type ResolveComponentResult,
} from "@uniformdev/next-app-router";

import { AccordionComponent } from "./Accordion";
import { AccordionItemComponent } from "./AccordionItem";
import { ButtonComponent } from "./Button";
import { CarouselComponent } from "./Carousel";
import { DefaultNotFoundComponent } from "./DefaultNotFound";
import { HeroComponent } from "./Hero";
import { ImageComponent } from "./Image";
import { PageComponent } from "./Page";
import { RichTextComponent } from "./RichText";
import { SectionComponent } from "./Section";
import { TabComponent } from "./Tab";
import { TabsComponent } from "./Tabs";

const components: Record<string, ResolveComponentResult["component"]> = {
  page: PageComponent,
  hero: HeroComponent,
  section: SectionComponent,
  button: ButtonComponent,
  image: ImageComponent,
  richText: RichTextComponent,
  carousel: CarouselComponent,
  accordion: AccordionComponent,
  accordionItem: AccordionItemComponent,
  tabs: TabsComponent,
  tab: TabComponent,
};

export const resolveComponent: ResolveComponentFunction = ({ component }) => ({
  component: components[component.type] ?? DefaultNotFoundComponent,
});
