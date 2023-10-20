import * as fs from 'fs';
import * as us from 'underscore.string';
import * as vscode from 'vscode';
import { renameAndReplaceFilesAndDirectories } from './renamer';

const LABELS = {
	renameFiles: 'Rename files',
	renameFile: 'Rename file',
	renameDirectories: 'Rename directories',
	replaceInFiles: 'Replace in files',
	replaceInFile: 'Replace in file',
};

const modesDirectory = [
	{
		label: LABELS.renameFiles,
		picked: true,
		description: 'Rename files matching then given pattern',
	},
	{
		label: LABELS.renameDirectories,
		picked: true,
		description: 'Rename directories matching the given pattern',
	},
	{
		label: LABELS.replaceInFiles,
		picked: true,
		description: 'Replace strings in files matching the given pattern',
	},
];

const modesFile = [
	{
		label: LABELS.renameFile,
		picked: true,
		description: 'Rename file',
	},
	{
		label: LABELS.replaceInFile,
		picked: true,
		description: 'Replace strings in the file',
	},
];

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand('smartrenameandreplace.smartRenameAndReplace', async (selectedFolderOrFile) => {
		let selectedPath = selectedFolderOrFile ? selectedFolderOrFile.path : undefined;
		let cancelled = false;

		if (!selectedPath && vscode.window.activeTextEditor) {
			selectedPath = vscode.window.activeTextEditor.document.uri.path;
		}

		let readablePath = selectedPath;

		if (vscode.workspace.workspaceFolders !== undefined) {
			let f = vscode.workspace.workspaceFolders[0].uri.fsPath;
			if (selectedPath && selectedPath.startsWith(f)) {
				readablePath = selectedPath.substring(f.length + 1);
			}
		}

		const isFolder = fs.lstatSync(selectedPath).isDirectory();

		const find = await vscode.window.showInputBox({
			title: `Smart Rename and Replace`,
			placeHolder: 'Search for...',
			prompt: `Replace in ${isFolder ? 'folder' : 'file'} ${readablePath}`,
			value: '',
		});

		if (find) {
			const replace = await vscode.window.showInputBox({
				title: `Smart Rename and Replace`,
				prompt: `Replace in ${isFolder ? 'folder' : 'file'} ${readablePath}`,
				placeHolder: 'Replace with...',
				value: '',
			});

			if (replace) {
				const globPattern = isFolder
					? await vscode.window.showInputBox({
							prompt: 'Matching pattern or empty for all files',
							placeHolder: '*.js',
							value: '',
							title: 'Files matching pattern',
					  })
					: '';

				const modes = await vscode.window.showQuickPick(isFolder ? modesDirectory : modesFile, {
					ignoreFocusOut: true,
					matchOnDescription: true,
					canPickMany: true,
					title: 'Rename, replace or both?',
				});

				const replaceOn = modes?.some((m) => m.label === LABELS.replaceInFiles || m.label === LABELS.replaceInFile) || false;
				const renameFilesOn = modes?.some((m) => m.label === LABELS.renameFiles || m.label === LABELS.renameFile) || false;
				const renameDirectoriesOn = modes?.some((m) => m.label === LABELS.renameDirectories) || false;

				let findCases = getCases(find);
				let replaceCases = getCases(replace);
				let titleCases = findCases.map((s, i) => s + ' -> ' + replaceCases[i]);

				[findCases, replaceCases, titleCases] = removeDuplicatesByIndex(findCases, replaceCases, titleCases);

				const selections = await vscode.window.showQuickPick(
					titleCases.map((s, i) => ({
						index: i,
						label: s,
						picked: true,
					})),
					{
						ignoreFocusOut: true,
						matchOnDescription: true,
						canPickMany: true,
						title: 'Select replacements',
					}
				);

				if (selections && selections.length > 0) {
					await executeRenameAndReplace(
						selectedPath,
						selections.map((o) => findCases[o.index]),
						selections.map((o) => replaceCases[o.index]),
						{
							renameFilesOn,
							renameDirectoriesOn,
							replaceOn,
							globPattern,
							renameFunc: async (fromPath, toPath) => {
								await vscode.workspace.fs.rename(vscode.Uri.file(fromPath), vscode.Uri.file(toPath), {
									overwrite: false,
								});
							},
						}
					);
					vscode.window.showInformationMessage('Replaced ' + find + ' with ' + replace + ' in ' + readablePath);
				} else {
					cancelled = true;
				}
			} else {
				cancelled = true;
			}
		} else {
			cancelled = true;
		}
		if (cancelled) {
			vscode.window.showInformationMessage('Replace cancelled.');
		}
	});

	context.subscriptions.push(disposable);
}

/**
 * Run the actual rename and replace based on given options.
 *
 * @param rootPath path to the root folder
 * @param find array of strings to find
 * @param replace array of strings to replace
 * @param options options for the rename and replace
 */
export async function executeRenameAndReplace(
	rootPath: string,
	find: string[],
	replace: string[],
	options: {
		renameFilesOn: boolean;
		renameDirectoriesOn: boolean;
		replaceOn: boolean;
		globPattern?: string | undefined;
		renameFunc?: (src: string, dest: string) => Promise<void>;
		replaceFunc?: (filepath: string, find: string[], replace: string[]) => Promise<void>;
	} = {
		renameFilesOn: true,
		renameDirectoriesOn: true,
		replaceOn: true,
	}
) {
	await renameAndReplaceFilesAndDirectories(rootPath, find, replace, options);
}

/**
 * Get updated arrays with duplicate items removed.
 *
 * @param findCases array of strings to find
 * @param replaceCases array of strings to replace
 * @param titleCases array of strings to display in the quick pick
 * @returns
 */
function removeDuplicatesByIndex(findCases: string[], replaceCases: string[], titleCases: string[]): [string[], string[], string[]] {
	const duplicates: Set<string> = new Set(); // to store duplicate titles
	const indicesToRemove: number[] = []; // to store indices of duplicate items

	// find duplicates in titleCases array
	for (let i = 0; i < titleCases.length - 1; i++) {
		if (!duplicates.has(titleCases[i])) {
			for (let j = i + 1; j < titleCases.length; j++) {
				if (titleCases[i] === titleCases[j]) {
					// add duplicate indices to the array except the first occurrence
					indicesToRemove.push(j);
					duplicates.add(titleCases[j]);
				}
			}
		}
	}

	// create new arrays with items removed
	const updatedFindCases: string[] = findCases.filter((_, index) => !indicesToRemove.includes(index));
	const updatedReplaceCases: string[] = replaceCases.filter((_, index) => !indicesToRemove.includes(index));
	const updatedTitleCases: string[] = titleCases.filter((_, index) => !indicesToRemove.includes(index));

	return [updatedFindCases, updatedReplaceCases, updatedTitleCases];
}

/**
 * Get a list of different cases (camel, underscored, uppercase etc.) for given string.
 *
 * @param s string for which we want different casing
 */
function getCases(s: string): string[] {
	s = s
		.replace(/[-_]+|(?<=[a-zA-Z])(?=[A-Z])/g, ' ')
		.replace(/\b\w/g, (s) => s.toUpperCase())
		.replace(' ', '');
	let result: string[] = [];
	result.push(
		s,
		us.camelize(s),
		us.camelize(s, true),
		us.capitalize(s),
		us.capitalize(s.toLowerCase()),
		us.decapitalize(s),
		us.underscored(s),
		us.classify(s),
		us.slugify(s),
		us.dasherize(s).startsWith('-') ? us.dasherize(s).substring(1) : us.dasherize(s),
		us.titleize(s),
		us.clean(s.replace(/([A-Z])/g, ' $1')),
		us.clean(s.replace(/([A-Z])/g, ' $1').toLowerCase()),
		s.toLowerCase(),
		s.toUpperCase(),
		us.underscored(s).toUpperCase(),
		us.clean(s.replace(/([A-Z])/g, ' $1').toUpperCase())
	);
	return result;
}

// This method is called when your extension is deactivated
export function deactivate() {}
