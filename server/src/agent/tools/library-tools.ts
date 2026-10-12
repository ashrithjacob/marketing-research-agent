import type { AgentTool } from "@earendil-works/pi-agent-core";

import { DocumentSections, Scope, type DocumentLibrary } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { libraryIndexParameters, libraryReadParameters } from "./parameters.js";

/** The workspace's library, read the way a person reads a book they own: the contents page first, then only the section needed. */
export class LibraryTools {
  static readonly SECTION_CHARS = 8000;

  private readonly scope: Scope;

  constructor(
    private readonly library: DocumentLibrary,
    workspaceId: string,
  ) {
    Trace.line(import.meta.url, "LibraryTools.constructor", { workspaceId });
    this.scope = Scope.of(workspaceId);
  }

  index(): AgentTool<typeof libraryIndexParameters> {
    Trace.line(import.meta.url, "LibraryTools.index");
    const self = this;
    return {
      name: "library_index",
      label: "Library contents",
      description:
        "List the strategy documents and playbooks the owner uploaded, each with its id and its numbered sections. " +
        "Use library_read to read a section.",
      parameters: libraryIndexParameters,
      async execute() {
        Trace.line(import.meta.url, "LibraryTools.index.execute");
        const text = await self.contents();
        return { content: [{ type: "text", text }], details: {} };
      },
    };
  }

  read(): AgentTool<typeof libraryReadParameters> {
    Trace.line(import.meta.url, "LibraryTools.read");
    const self = this;
    return {
      name: "library_read",
      label: "Library section",
      description: "Read one numbered section of a library document, as markdown. Guidance on method: never cite it as a source.",
      parameters: libraryReadParameters,
      async execute(_id, params) {
        Trace.line(import.meta.url, "LibraryTools.read.execute", { params });
        const text = await self.section(params.document_id, Math.trunc(params.section));
        return { content: [{ type: "text", text }], details: { document_id: params.document_id, section: params.section } };
      },
    };
  }

  /** The tools for a workspace, or null while it has no document ready to read. */
  static async forWorkspace(library: DocumentLibrary, workspaceId: string): Promise<LibraryTools | null> {
    Trace.line(import.meta.url, "LibraryTools.forWorkspace", { workspaceId });
    const ready = (await library.list(Scope.of(workspaceId))).some((document) => document.status === "ready");
    return ready ? new LibraryTools(library, workspaceId) : null;
  }

  private async contents(): Promise<string> {
    Trace.line(import.meta.url, "LibraryTools.contents");
    const documents = (await this.library.list(this.scope)).filter((document) => document.status === "ready");
    if (documents.length === 0) return "The library is empty.";
    const blocks: string[] = [];
    for (const document of documents) {
      const markdown = (await this.library.markdown(this.scope, document.id)) ?? "";
      const sections = DocumentSections.of(markdown, LibraryTools.SECTION_CHARS);
      blocks.push(
        [`## ${document.title} — id ${document.id}, ${document.pages} pages`, ...sections.map((s) => `${s.index}. ${s.heading} (${s.chars} chars)`)].join("\n"),
      );
    }
    return blocks.join("\n\n");
  }

  private async section(documentId: string, index: number): Promise<string> {
    Trace.line(import.meta.url, "LibraryTools.section", { documentId, index });
    const markdown = await this.library.markdown(this.scope, documentId);
    if (markdown === null) throw new Error(`no document ${documentId} in the library; library_index lists the ids`);
    const sections = DocumentSections.of(markdown, LibraryTools.SECTION_CHARS);
    const found = sections[index];
    if (!found) throw new Error(`document ${documentId} has sections 0 to ${sections.length - 1}; ${index} is not one`);
    return found.text;
  }
}
