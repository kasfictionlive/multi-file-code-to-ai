import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface Prompt {
	name: string;
	instruction: string;
	files: string[];
}

let prompts: Prompt[] = [];
let extensionContext: vscode.ExtensionContext;

class PromptsProvider implements vscode.TreeDataProvider<PromptItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<PromptItem | undefined | null | void> = new vscode.EventEmitter<PromptItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<PromptItem | undefined | null | void> = this._onDidChangeTreeData.event;

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: PromptItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: PromptItem): Thenable<PromptItem[]> {
		if (element) {
			return Promise.resolve([]);
		} else {
			return Promise.resolve(prompts.map(p => new PromptItem(p.name, p.instruction, vscode.TreeItemCollapsibleState.None)));
		}
	}
}

class PromptItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		private instruction: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState
	) {
		super(label, collapsibleState);
		this.tooltip = `${this.label}: ${this.instruction}`;
		this.description = this.instruction;
		this.command = {
			command: 'extension.editPrompt',
			title: 'Edit Prompt',
			arguments: [this.label]
		};
	}
}

export function activate(context: vscode.ExtensionContext) {
	extensionContext = context;

	// Ensure .vscode/prompt directory exists
	const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
	if (!workspaceRoot) {
		vscode.window.showErrorMessage('No workspace folder open');
		return;
	}
	const promptsFolder = path.join(workspaceRoot, '.vscode', 'prompt');
	if (!fs.existsSync(promptsFolder)) {
		fs.mkdirSync(promptsFolder, { recursive: true });
	}

	// Load saved prompts
	loadPrompts(promptsFolder);

	const promptsProvider = new PromptsProvider();
	vscode.window.registerTreeDataProvider('promptsList', promptsProvider);

	// Register commands
	context.subscriptions.push(
		vscode.commands.registerCommand('extension.addNewPrompt', () => addNewPrompt(promptsProvider)),
		vscode.commands.registerCommand('extension.editPrompt', (promptName: string) => editPrompt(promptName, promptsProvider)),
		vscode.commands.registerCommand('extension.deletePrompt', (item: PromptItem) => deletePrompt(item, promptsProvider)),
		vscode.commands.registerCommand('extension.generatePrompt', (item: PromptItem) => generatePrompt(item))
	);

	// Watch for changes in prompt files
	const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(promptsFolder, '*.yml'));
	context.subscriptions.push(watcher);

	watcher.onDidChange(async (uri) => {
		const promptName = path.basename(uri.fsPath, '.yml');
		const content = await vscode.workspace.fs.readFile(uri);
		const updatedPrompt: Prompt = yaml.load(content.toString()) as Prompt;
		const index = prompts.findIndex(p => p.name === promptName);
		if (index !== -1) {
			prompts[index] = updatedPrompt;
			promptsProvider.refresh();
		}
	});
}

function loadPrompts(promptsFolder: string) {
	prompts = [];
	const files = fs.readdirSync(promptsFolder);
	for (const file of files) {
		if (path.extname(file) === '.yml') {
			const filePath = path.join(promptsFolder, file);
			const content = fs.readFileSync(filePath, 'utf8');
			const prompt = yaml.load(content) as Prompt;
			prompts.push(prompt);
		}
	}
}

async function addNewPrompt(provider: PromptsProvider) {
	const name = await vscode.window.showInputBox({ prompt: 'Enter a name for the new prompt' });
	if (!name) return;

	const instruction = await vscode.window.showInputBox({ prompt: 'Enter the instruction for the prompt' });
	if (!instruction) return;

	const newPrompt: Prompt = { name, instruction, files: [] };
	prompts.push(newPrompt);
	await savePrompt(newPrompt);
	provider.refresh();
	editPrompt(name, provider);
}

async function editPrompt(promptName: string, provider: PromptsProvider) {
	const prompt = prompts.find(p => p.name === promptName);
	if (!prompt) return;

	const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
	if (!workspaceRoot) return;

	const promptsFolder = path.join(workspaceRoot, '.vscode', 'prompt');
	const filePath = path.join(promptsFolder, `${promptName}.yml`);

	const yamlContent = yaml.dump(prompt);
	fs.writeFileSync(filePath, yamlContent);

	const document = await vscode.workspace.openTextDocument(filePath);
	await vscode.window.showTextDocument(document);
}

async function deletePrompt(item: PromptItem, provider: PromptsProvider) {
	const confirm = await vscode.window.showQuickPick(['Yes', 'No'], { placeHolder: `Are you sure you want to delete "${item.label}"?` });
	if (confirm === 'Yes') {
		prompts = prompts.filter(p => p.name !== item.label);
		provider.refresh();
		vscode.window.showInformationMessage(`Prompt "${item.label}" deleted`);

		const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
		if (!workspaceRoot) return;

		const promptsFolder = path.join(workspaceRoot, '.vscode', 'prompt');
		const filePath = path.join(promptsFolder, `${item.label}.yml`);
		if (fs.existsSync(filePath)) {
			fs.unlinkSync(filePath);
		}
	}
}

async function generatePrompt(item: PromptItem) {
	const prompt = prompts.find(p => p.name === item.label);
	if (!prompt) return;

	const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath || '';
	let generatedPrompt = `# ${prompt.name}\n\n## Instructions\n\n${prompt.instruction}\n\n## Files\n\n`;

	for (const file of prompt.files) {
		generatedPrompt += `### ${file}\n\n`;
		try {
			const absolutePath = path.join(workspaceRoot, file);
			const content = fs.readFileSync(absolutePath, 'utf8');
			generatedPrompt += `\`\`\`\n${content}\n\`\`\`\n\n`;
		} catch (err) {
			console.error(`Error reading file ${file}: ${err}`);
			generatedPrompt += `Error reading file: ${err}\n\n`;
		}
	}

	generatedPrompt += "---\n\nEnd of prompt";

	vscode.env.clipboard.writeText(generatedPrompt);
	vscode.window.showInformationMessage('Prompt generated and copied to clipboard!');
}

async function savePrompt(prompt: Prompt) {
	const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
	if (!workspaceRoot) return;

	const promptsFolder = path.join(workspaceRoot, '.vscode', 'prompt');
	const filePath = path.join(promptsFolder, `${prompt.name}.yml`);

	const yamlContent = yaml.dump(prompt);
	fs.writeFileSync(filePath, yamlContent);
}

export function deactivate() { }