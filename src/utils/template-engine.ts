import { readFileSync } from "fs";
import { join } from "path";

export interface TemplateContext {
  [key: string]: any;
}

export class TemplateEngine {
  private templateCache = new Map<string, string>();
  private templatesDir: string;

  constructor(templatesDir: string = "src/templates") {
    this.templatesDir = templatesDir;
  }

  private loadTemplate(templateName: string): string {
    if (!this.templateCache.has(templateName)) {
      const templatePath = join(this.templatesDir, templateName);
      const template = readFileSync(templatePath, "utf-8");
      this.templateCache.set(templateName, template);
    }
    return this.templateCache.get(templateName)!;
  }

  render(templateName: string, context: TemplateContext = {}): string {
    const template = this.loadTemplate(templateName);
    return this.interpolate(template, context);
  }

  private interpolate(template: string, context: TemplateContext): string {
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
      const value = this.getNestedProperty(context, path);
      return value !== undefined ? String(value) : match;
    });
  }

  private getNestedProperty(obj: any, path: string): any {
    return path.split(".").reduce((current, prop) => current?.[prop], obj);
  }

  clearCache(): void {
    this.templateCache.clear();
  }
}

export const templateEngine = new TemplateEngine();
