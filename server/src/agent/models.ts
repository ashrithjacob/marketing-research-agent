import { createModels, type Models } from "@earendil-works/pi-ai";
import { openrouterProvider } from "@earendil-works/pi-ai/providers/openrouter";

import { Trace } from "../trace/index.js";

export type LlmCatalogue = Models;

/** pi-ai's model catalogue, with OpenRouter as the one provider. */
export class LlmModels {
  static openrouter(): Models {
    Trace.line(import.meta.url, "LlmModels.openrouter");
    const models = createModels();
    models.setProvider(openrouterProvider());
    return models;
  }
}
