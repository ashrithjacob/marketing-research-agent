/**
 * The store is asynchronous: a write whose promise nobody awaits can land after
 * the read that needs it, or fail with nobody told; a promise read as a value is
 * always truthy, spreads to `{}`, and serialises to `{}`. tsc flags none of these,
 * so this does. `void` marks a promise dropped on purpose.
 */
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

class PromiseUse {
  private readonly program: ts.Program;
  private readonly checker: ts.TypeChecker;

  constructor() {
    const configPath = join(ROOT, "tsconfig.test.json");
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, ROOT);
    this.program = ts.createProgram(parsed.fileNames, parsed.options);
    this.checker = this.program.getTypeChecker();
  }

  misused(): string[] {
    const found: string[] = [];
    for (const file of this.program.getSourceFiles()) {
      if (file.isDeclarationFile || file.fileName.includes("node_modules")) continue;
      const visit = (node: ts.Node): void => {
        const why = this.problem(node);
        if (why) {
          const { line } = file.getLineAndCharacterOfPosition(node.getStart());
          found.push(`${relative(ROOT, file.fileName)}:${line + 1} ${why}  ${node.getText().slice(0, 90)}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(file);
    }
    return found;
  }

  private problem(node: ts.Node): string {
    if (ts.isExpressionStatement(node)) {
      const expression = node.expression;
      const stored = ts.isBinaryExpression(expression) && PromiseUse.assigns(expression);
      if (!stored && !ts.isVoidExpression(expression) && !ts.isAwaitExpression(expression) && this.isPromise(expression)) return "dropped";
    }
    if ((ts.isSpreadElement(node) || ts.isSpreadAssignment(node)) && this.isPromise(node.expression)) return "spread";
    if (ts.isCallExpression(node) && !ts.isExpressionStatement(node.parent) && this.isPromise(node) && !this.handled(node)) return "used as a value";
    return "";
  }

  private handled(node: ts.Expression): boolean {
    const p = node.parent;
    if (ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || ts.isNonNullExpression(p)) return this.handled(p);
    if (ts.isConditionalExpression(p) && p.condition !== node) return this.handled(p);
    if (ts.isBinaryExpression(p) && PromiseUse.LOGICAL.has(p.operatorToken.kind)) return this.handled(p);
    if (ts.isAwaitExpression(p) || ts.isReturnStatement(p) || ts.isVoidExpression(p) || ts.isExpressionStatement(p)) return true;
    if (ts.isArrowFunction(p) && p.body === node) return true;
    if (ts.isVariableDeclaration(p) || ts.isPropertyDeclaration(p) || ts.isArrayLiteralExpression(p)) return true;
    if (ts.isBinaryExpression(p) && p.right === node && PromiseUse.assigns(p)) return true;
    if (ts.isPropertyAccessExpression(p) && PromiseUse.CHAINED.has(p.name.text)) return true;
    if (ts.isCallExpression(p) && p.expression !== node) return this.wantsPromise(p, node);
    return false;
  }

  private wantsPromise(call: ts.CallExpression, arg: ts.Expression): boolean {
    const callee = call.expression.getText();
    if (callee === "expect" || callee.startsWith("Promise.")) return true;
    const declaration = this.checker.getResolvedSignature(call)?.getDeclaration();
    if (!declaration || !("parameters" in declaration)) return false;
    const index = Math.min(call.arguments.indexOf(arg), declaration.parameters.length - 1);
    const typeNode = declaration.parameters[index]?.type;
    if (!typeNode) return false;
    const declared = this.checker.getTypeFromTypeNode(typeNode);
    return !(declared.flags & ts.TypeFlags.TypeParameter) && PromiseUse.thenable(declared);
  }

  private isPromise(node: ts.Node): boolean {
    return PromiseUse.promiseType(this.checker.getTypeAtLocation(node));
  }

  private static readonly LOGICAL = new Set([ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandToken]);
  private static readonly CHAINED = new Set(["then", "catch", "finally"]);

  private static assigns(expression: ts.BinaryExpression): boolean {
    return expression.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && expression.operatorToken.kind <= ts.SyntaxKind.LastAssignment;
  }

  private static promiseType(type: ts.Type): boolean {
    return type.isUnion() ? type.types.some(PromiseUse.promiseType) : type.getSymbol()?.getName() === "Promise";
  }

  private static thenable(type: ts.Type): boolean {
    return type.isUnion() ? type.types.some(PromiseUse.thenable) : Boolean(type.getProperty("then"));
  }
}

describe("promises", () => {
  it("are awaited, returned, stored, or explicitly voided — never dropped, spread, or read as a value", () => {
    expect(new PromiseUse().misused()).toEqual([]);
  }, 60_000);
});
