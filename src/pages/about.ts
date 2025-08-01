import { htmlHead } from "../components/htmlHead";
import { siteHeaderGenerator } from "../components/siteHeader";
import { siteFooterGenerator } from "../components/siteFooter";
import { templateEngine } from "../utils/template-engine";

export function generateAboutHTML(): string {
  const headData = htmlHead("Om eventyrsamlingen");
  const siteHeader = siteHeaderGenerator();
  const siteFooter = siteFooterGenerator();

  return templateEngine.renderWithLayout("about-page.html", {
    ...headData,
    siteHeader,
    siteFooter,
  });
}
