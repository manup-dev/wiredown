// extension.js: Markdown preview plugin + diagnostics + a preview for .wiremark files.
import * as vscode from 'vscode';
import { extendMarkdownIt, previewHtml } from './markdown.mjs';
import { diagnosticsFor } from './diagnostics.mjs';

export function activate(context) {
  const collection = vscode.languages.createDiagnosticCollection('wiremark');
  const timers = new Map();
  const check = (doc) => {
    if (doc.languageId !== 'markdown' && doc.languageId !== 'wiremark') return;
    clearTimeout(timers.get(doc.uri.toString()));
    timers.set(doc.uri.toString(), setTimeout(() => {
      collection.set(doc.uri, diagnosticsFor(doc.getText(), doc.languageId).map((d) => {
        const line = Math.min(d.line0, doc.lineCount - 1);
        const diag = new vscode.Diagnostic(new vscode.Range(line, d.col0, line, Math.max(d.endCol0, doc.lineAt(line).text.length)), d.message,
          d.severity === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning);
        diag.code = d.code; diag.source = 'wiremark';
        return diag;
      }));
    }, 300));
  };
  context.subscriptions.push(collection,
    vscode.workspace.onDidOpenTextDocument(check), vscode.workspace.onDidChangeTextDocument((e) => check(e.document)),
    vscode.workspace.onDidCloseTextDocument((d) => {
      const key = d.uri.toString();
      clearTimeout(timers.get(key)); timers.delete(key); collection.delete(d.uri);
    }),
    { dispose: () => { timers.forEach((t) => clearTimeout(t)); timers.clear(); } },
    vscode.commands.registerCommand('wiremark.openPreview', () => openPreview()));
  vscode.workspace.textDocuments.forEach(check);
  return { extendMarkdownIt };
}

function openPreview() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const doc = editor.document;
  if (doc.languageId !== 'markdown' && doc.languageId !== 'wiremark') {
    vscode.window.showInformationMessage('wiremark: open a markdown or .wiremark file first.');
    return;
  }
  const panel = vscode.window.createWebviewPanel('wiremark', 'wiremark preview', vscode.ViewColumn.Beside, { enableScripts: false });
  const draw = () => { panel.webview.html = previewHtml(doc.getText(), doc.languageId); };
  draw();
  const subs = [
    vscode.workspace.onDidChangeTextDocument((e) => { if (e.document === doc) draw(); }),
    vscode.workspace.onDidCloseTextDocument((d) => { if (d === doc) panel.dispose(); }),
  ];
  panel.onDidDispose(() => subs.forEach((s) => s.dispose()));
}

export function deactivate() {}
