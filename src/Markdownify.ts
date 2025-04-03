import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import os from "os";
import { fileURLToPath } from "url";

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type MarkdownResult = {
  path: string;
  text: string;
};

export class Markdownify {
  private static async _markitdown(
    filePath: string,
    projectRoot: string,
    uvPath: string,
  ): Promise<string> {
    const venvPath = path.join(projectRoot, ".venv");
    const markitdownPath = path.join(venvPath, "bin", "markitdown");

    if (!fs.existsSync(markitdownPath)) {
      throw new Error("markitdown executable not found");
    }

    const { stdout, stderr } = await execAsync(
      `${uvPath} run ${markitdownPath} "${filePath}"`,
    );

    if (stderr) {
      throw new Error(`Error executing command: ${stderr}`);
    }

    return stdout;
  }

  private static async _youtubeToMarkdown(url: string): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(`npx @anaisbetts/mcp-youtube "${url}"`);
      if (stderr) {
        throw new Error(`Error executing YouTube conversion: ${stderr}`);
      }
      return stdout;
    } catch (error) {
      throw new Error(`Failed to convert YouTube video: ${error}`);
    }
  }

  private static async saveToTempFile(content: string): Promise<string> {
    const tempOutputPath = path.join(
      os.tmpdir(),
      `markdown_output_${Date.now()}.md`,
    );
    fs.writeFileSync(tempOutputPath, content);
    return tempOutputPath;
  }

  static async toMarkdown({
    filePath,
    url,
    projectRoot = path.resolve(__dirname, ".."),
    uvPath = "~/.local/bin/uv",
  }: {
    filePath?: string;
    url?: string;
    projectRoot?: string;
    uvPath?: string;
  }): Promise<MarkdownResult> {
    try {
      let text: string;

      if (url) {
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
          text = await this._youtubeToMarkdown(url);
        } else {
          const response = await fetch(url);
          text = await response.text();
        }
      } else if (filePath) {
        text = await this._markitdown(filePath, projectRoot, uvPath);
      } else {
        throw new Error("Either filePath or url must be provided");
      }

      const outputPath = await this.saveToTempFile(text);
      return { path: outputPath, text };
    } catch (e: unknown) {
      if (e instanceof Error) {
        throw new Error(`Error processing to Markdown: ${e.message}`);
      } else {
        throw new Error("Error processing to Markdown: Unknown error occurred");
      }
    }
  }

  static async get({
    filePath,
  }: {
    filePath: string;
  }): Promise<MarkdownResult> {
    if (!fs.existsSync(filePath)) {
      throw new Error("File does not exist");
    }

    const text = await fs.promises.readFile(filePath, "utf-8");

    return {
      path: filePath,
      text: text,
    };
  }
}
