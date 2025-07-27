import { htmlHead } from "../components/htmlHead";
import { siteHeaderGenerator } from "../components/siteHeader";
import { siteFooterGenerator } from "../components/siteFooter";
import type { createPathHelper } from "../utils/paths";
import { templateEngine } from "../utils/template-engine";

type PathHelper = ReturnType<typeof createPathHelper>;

export function generateAboutHTML(pathHelper: PathHelper): string {
  const headData = htmlHead("Om Eventyrsamlingen", pathHelper);
  const siteHeader = siteHeaderGenerator(pathHelper);
  const siteFooter = siteFooterGenerator(pathHelper);

  return templateEngine.renderWithLayout("about-page.html", {
    ...headData,
    siteHeader,
    siteFooter,
  });
}