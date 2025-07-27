import { readFileSync } from "fs";
import { join } from "path";

export interface TemplateContext {
  [key: string]: any;
}

export interface TemplateEngine {
  render: (templateName: string, context?: TemplateContext) => string;
  renderWithLayout: (
    templateName: string,
    context?: TemplateContext,
    layoutName?: string,
  ) => string;
  clearCache: () => void;
}

const getNestedProperty = (obj: any, path: string): any =>
  path.split(".").reduce((current, prop) => current?.[prop], obj);

const interpolate = (template: string, context: TemplateContext): string =>
  template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
    const value = getNestedProperty(context, path);
    return value !== undefined ? String(value) : match;
  });

// Factory function that creates a template engine
export const createTemplateEngine = (
  templatesDir: string = "src/templates",
): TemplateEngine => {
  const templateCache = new Map<string, string>();

  const loadTemplate = (templateName: string): string => {
    if (!templateCache.has(templateName)) {
      const templatePath = join(templatesDir, templateName);
      const template = readFileSync(templatePath, "utf-8");
      templateCache.set(templateName, template);
    }
    return templateCache.get(templateName)!;
  };

  const render = (
    templateName: string,
    context: TemplateContext = {},
  ): string => {
    const template = loadTemplate(templateName);
    return interpolate(template, context);
  };

  const renderWithLayout = (
    templateName: string,
    context: TemplateContext = {},
    layoutName: string = "layout.html",
  ): string => {
    const contentTemplate = loadTemplate(templateName);
    const renderedContent = interpolate(contentTemplate, context);

    const layoutTemplate = loadTemplate(layoutName);
    const layoutContext = { ...context, content: renderedContent };
    return interpolate(layoutTemplate, layoutContext);
  };

  const clearCache = (): void => {
    templateCache.clear();
  };

  return {
    render,
    renderWithLayout,
    clearCache,
  };
};

export const templateEngine = createTemplateEngine();
