import ts from "typescript";

export interface CoveredFunction {
  node: ts.FunctionLikeDeclaration;
  name: string;
  line: number;
}

type FunctionNode =
  | ts.ConstructorDeclaration
  | ts.MethodDeclaration
  | ts.AccessorDeclaration
  | ts.ArrowFunction
  | ts.FunctionExpression
  | ts.FunctionDeclaration;

const TRACE_CALLS = new Set(["Trace.line", "Trace.tick"]);

/**
 * Which functions must write a trace line, what each is called, and whether it
 * does. Shared by the architecture rule and the codemod that inserted the lines,
 * so the two cannot disagree about either.
 */
export class TraceCoverage {
  static functions(file: ts.SourceFile): CoveredFunction[] {
    const found: CoveredFunction[] = [];
    const add = (node: FunctionNode, name: string): void => {
      found.push({ node, name, line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1 });
    };
    const visit = (node: ts.Node, owner: string | null, className: string | null): void => {
      if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
        const cls = node.name?.text ?? "anonymous";
        for (const member of node.members) {
          const named = TraceCoverage.memberName(member, file);
          if (ts.isConstructorDeclaration(member) && member.body && member.body.statements.length > 0) {
            add(member, `${cls}.constructor`);
            visit(member.body, `${cls}.constructor`, cls);
          } else if (
            (ts.isMethodDeclaration(member) || ts.isGetAccessor(member) || ts.isSetAccessor(member)) &&
            member.body
          ) {
            add(member, `${cls}.${named}`);
            visit(member.body, `${cls}.${named}`, cls);
          } else if (ts.isPropertyDeclaration(member) && member.initializer && TraceCoverage.isFunction(member.initializer)) {
            add(member.initializer, `${cls}.${named}`);
            visit(member.initializer.body, `${cls}.${named}`, cls);
          } else {
            ts.forEachChild(member, (child) => visit(child, owner, cls));
          }
        }
        return;
      }
      if (ts.isFunctionDeclaration(node) && node.name && node.body) {
        add(node, node.name.text);
        visit(node.body, node.name.text, className);
        return;
      }
      if (ts.isObjectLiteralExpression(node)) {
        for (const property of node.properties) {
          const named = property.name ? TraceCoverage.propertyName(property.name, file) : "";
          const prefix = owner ? `${owner}.` : "";
          if (ts.isMethodDeclaration(property) && property.body) {
            add(property, `${prefix}${named}`);
            visit(property.body, `${prefix}${named}`, className);
          } else if (
            ts.isPropertyAssignment(property) &&
            TraceCoverage.isFunction(property.initializer) &&
            ts.isBlock(property.initializer.body)
          ) {
            add(property.initializer, `${prefix}${named}`);
            visit(property.initializer.body, `${prefix}${named}`, className);
          } else {
            ts.forEachChild(property, (child) => visit(child, owner, className));
          }
        }
        return;
      }
      ts.forEachChild(node, (child) => visit(child, owner, className));
    };
    visit(file, null, null);
    return found;
  }

  static problems(file: ts.SourceFile): string[] {
    const covered = TraceCoverage.functions(file);
    const nested = new Set<ts.Node>(covered.map((c) => c.node));
    const out: string[] = [];
    for (const fn of covered) {
      const where = `line ${fn.line}: ${fn.name}`;
      const body = fn.node.body;
      if (!body || !ts.isBlock(body)) {
        out.push(`${where} needs a block body so it can start with its trace line`);
        continue;
      }
      const first = TraceCoverage.firstOwnStatement(body);
      const call = first ? TraceCoverage.traceCall(first) : null;
      if (!call) {
        out.push(`${where} does not start with Trace.line(import.meta.url, "${fn.name}", …)`);
        continue;
      }
      if (call.file !== "import.meta.url" || call.name !== fn.name) {
        out.push(`${where} traces as (${call.file}, "${call.name}"), expected (import.meta.url, "${fn.name}")`);
      }
      const count = TraceCoverage.countCalls(body, nested);
      if (count !== 1) out.push(`${where} writes ${count} trace lines; one per function`);
    }
    return out;
  }

  static traceCall(statement: ts.Statement): { file: string; name: string } | null {
    if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) return null;
    const call = statement.expression;
    if (!TRACE_CALLS.has(call.expression.getText())) return null;
    const [file, name] = call.arguments;
    return {
      file: file?.getText() ?? "",
      name: name && ts.isStringLiteralLike(name) ? name.text : (name?.getText() ?? ""),
    };
  }

  private static firstOwnStatement(body: ts.Block): ts.Statement | undefined {
    const [first, second] = body.statements;
    const isSuper =
      first &&
      ts.isExpressionStatement(first) &&
      ts.isCallExpression(first.expression) &&
      first.expression.expression.kind === ts.SyntaxKind.SuperKeyword;
    return isSuper ? second : first;
  }

  private static countCalls(body: ts.Node, nested: Set<ts.Node>): number {
    let count = 0;
    const walk = (node: ts.Node): void => {
      if (nested.has(node)) return;
      if (ts.isCallExpression(node) && TRACE_CALLS.has(node.expression.getText())) count += 1;
      ts.forEachChild(node, walk);
    };
    ts.forEachChild(body, walk);
    return count;
  }

  private static isFunction(node: ts.Node): node is ts.ArrowFunction | ts.FunctionExpression {
    return ts.isArrowFunction(node) || ts.isFunctionExpression(node);
  }

  private static memberName(member: ts.ClassElement, file: ts.SourceFile): string {
    return member.name ? TraceCoverage.propertyName(member.name, file) : "constructor";
  }

  private static propertyName(name: ts.PropertyName, file: ts.SourceFile): string {
    if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name) || ts.isStringLiteral(name)) return name.text;
    return name.getText(file);
  }
}
