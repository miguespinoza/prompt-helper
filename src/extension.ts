// src/extension.ts
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  let promptText: string = ""; // Store the prompt text
  let markdownFileUri: vscode.Uri | undefined = undefined; // Store the URI of the markdown file

  // Load the prompt text from storage
  promptText = context.globalState.get("promptText", "");

  let disposable = vscode.commands.registerCommand(
    "myExtension.sendToPrompt",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const selection = editor.selection;
        const code = editor.document.getText(selection);
        const filePath = editor.document.uri.fsPath;

        // Append to the prompt text
        promptText = `\n---\nCode from: ${filePath}\n\`\`\`${code}\`\`\``;

        // Update the markdown file
        await updateMarkdownFile(promptText, context);
      } else {
        vscode.window.showWarningMessage("No active text editor.");
      }
    }
  );

  context.subscriptions.push(disposable);

  async function updateMarkdownFile(
    text: string,
    context: vscode.ExtensionContext
  ) {
    // If the markdown file doesn't exist, create it
    if (!markdownFileUri) {
      // Ask the user where to save the file
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage(
          "Please open a workspace before using this extension."
        );
        return;
      }

      const defaultUri = vscode.Uri.joinPath(
        workspaceFolders[0].uri,
        "prompt.md"
      );

      const fileUri = await vscode.window.showSaveDialog({
        defaultUri: defaultUri,
        filters: {
          "Markdown files": ["md"],
        },
      });

      if (!fileUri) {
        // User cancelled the save dialog
        return;
      }

      markdownFileUri = fileUri;

      // Initialize the Markdown file with sections
      const initialContent = `# Goal\n\n# Return Format\n\n# Warnings\n\n# Context\n`;
      await vscode.workspace.fs.writeFile(
        markdownFileUri,
        Buffer.from(initialContent, "utf8")
      );
      promptText = ""; // Reset promptText after initializing the file
    }

    if (markdownFileUri) {
      try {
        // Read the existing content
        const existingContent = (
          await vscode.workspace.fs.readFile(markdownFileUri)
        ).toString();

        // Find the "Context" section
        const contextSectionStart = existingContent.indexOf("# Context");
        if (contextSectionStart === -1) {
          vscode.window.showErrorMessage(
            "Could not find # Context section in the Markdown file."
          );
          return;
        }

        // Append the new text to the "Context" section
        const updatedContent =
          existingContent.substring(0, contextSectionStart + 10) +
          "\n" +
          text +
          existingContent.substring(contextSectionStart + 10);

        // Write the updated content to the markdown file
        await vscode.workspace.fs.writeFile(
          markdownFileUri,
          Buffer.from(updatedContent, "utf8")
        );

        // Open the markdown file
        vscode.workspace.openTextDocument(markdownFileUri).then((doc) => {
          vscode.window.showTextDocument(doc);
        });

        // Store the prompt text
        context.globalState.update("promptText", text);
      } catch (error: any) {
        vscode.window.showErrorMessage(
          `Error writing to file: ${error.message}`
        );
      }
    }
  }

  // Load the markdown file on activation if it exists
  vscode.commands.registerCommand("myExtension.loadMarkdownFile", async () => {
    if (!markdownFileUri) {
      // Ask the user to select the markdown file
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage(
          "Please open a workspace before using this extension."
        );
        return;
      }

      const fileUris = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: {
          "Markdown files": ["md"],
        },
        defaultUri: workspaceFolders[0].uri,
      });

      if (fileUris && fileUris.length > 0) {
        markdownFileUri = fileUris[0];
      } else {
        return;
      }
    }

    if (markdownFileUri) {
      try {
        const document = await vscode.workspace.openTextDocument(
          markdownFileUri
        );
        await vscode.window.showTextDocument(document);
      } catch (error: any) {
        vscode.window.showErrorMessage(`Error opening file: ${error.message}`);
      }
    }
  });

  context.subscriptions.push(
    vscode.commands.registerCommand("myExtension.clearPrompt", async () => {
      promptText = "";
      await updateMarkdownFile(promptText, context);
    })
  );

  // Load the markdown file on activation if it exists
  if (context.globalState.get("markdownFileUri")) {
    markdownFileUri = vscode.Uri.parse(
      context.globalState.get("markdownFileUri") as string
    );
    vscode.commands.executeCommand("myExtension.loadMarkdownFile");
  }
}

export function deactivate() {}
