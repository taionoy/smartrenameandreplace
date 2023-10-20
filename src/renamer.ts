import { promises as fspromises } from 'fs';
import * as path from 'path';
import { minimatch } from 'minimatch';

/**
 * Rename and replace files.
 *
 * @param rootPath Directory or file path to start renaming from.
 * @param find Array of strings to find.
 * @param replace Array of strings to replace with.
 * @param options Options for the rename and replace operation.
 */
export async function renameAndReplaceFilesAndDirectories(
	rootPath: string,
	find: string[],
	replace: string[],
	options: {
		renameFilesOn?: boolean;
		renameDirectoriesOn?: boolean;
		replaceOn?: boolean;
		globPattern?: string | undefined;
		dryRun?: boolean;
		renameFunc?: (src: string, dest: string) => Promise<void>;
		replaceFunc?: (filepath: string, find: string[], replace: string[]) => Promise<void>;
	} = {
		renameFilesOn: true,
		renameDirectoriesOn: true,
		replaceOn: false,
		globPattern: undefined,
		dryRun: false,
		renameFunc: renameInFilesystem,
		replaceFunc: replaceInFile,
	}
) {
	try {
		if (options.renameFunc === undefined) {
			options.renameFunc = renameInFilesystem;
		}

		if (options.replaceFunc === undefined) {
			options.replaceFunc = replaceInFile;
		}

		let renamedBaseName = path.basename(rootPath);
		let renamed = false;

		// Check root directory itself
		for (let i = 0; i < find.length; i++) {
			if (renamedBaseName.includes(find[i])) {
				renamedBaseName = renamedBaseName.replace(find[i], replace[i]);
				renamed = true;
			}
		}

		const stat = await fspromises.stat(rootPath);

		// Handle root directory or file
		if (
			renamed &&
			((stat.isDirectory() && options.renameDirectoriesOn) ||
				(stat.isFile() &&
					options.renameFilesOn &&
					(!options.globPattern || minimatch(rootPath, options.globPattern, { matchBase: true }))))
		) {
			let parentDir = path.dirname(rootPath);
			let renamedRootPath = path.join(parentDir, renamedBaseName);
			if (!options.dryRun && options.renameFunc) {
				await options.renameFunc(rootPath, renamedRootPath);
				rootPath = renamedRootPath;
			}
		}

		const files = stat.isDirectory() ? await fspromises.readdir(rootPath) : [path.basename(rootPath)];

		if (stat.isFile()) {
			rootPath = path.dirname(rootPath);
		}

		for (const fileOrDir of files) {
			let newFileOrDir = fileOrDir;
			const fromPath = path.join(rootPath, fileOrDir);

			const stat = await fspromises.stat(fromPath);

			if (
				(stat.isDirectory() && options.renameDirectoriesOn) ||
				(stat.isFile() &&
					options.renameFilesOn &&
					(!options.globPattern || minimatch(rootPath, options.globPattern, { matchBase: true })))
			) {
				for (let i = 0; i < find.length; i++) {
					newFileOrDir = newFileOrDir.replace(find[i], replace[i]);
				}
			}

			let newPath = path.join(rootPath, newFileOrDir);

			if (fileOrDir !== newFileOrDir) {
				if (!options.dryRun && options.renameFunc) {
					await options.renameFunc(fromPath, newPath);
				} else {
					newPath = fromPath;
				}
			}

			if (stat.isDirectory()) {
				await renameAndReplaceFilesAndDirectories(newPath, find, replace, options);
			} else if (
				stat.isFile() &&
				options.replaceOn &&
				(!options.globPattern || minimatch(newPath, options.globPattern, { matchBase: true }))
			) {
				if (!options.dryRun && options.replaceFunc) {
					options.replaceFunc(newPath, find, replace);
				} else {
					console.log('Skipping replace: dryRun=' + options.dryRun, 'replaceFunc=' + options.replaceFunc);
				}
			}
		}
	} catch (err) {
		throw err;
	}
}

/**
 * Replace strings in a buffer.
 *
 * @param buf Replace in this buffer
 * @param source text to find
 * @param target text to replace with
 * @returns modified buffer and boolean indicating if any change has taken place
 */
async function replaceInBuffer(buf: Buffer, source: Buffer, target: Buffer): Promise<[Buffer, boolean]> {
	let matchIndex = buf.indexOf(source);
	let result = Buffer.from(buf);
	let hasChanged = false;

	while (matchIndex !== -1) {
		hasChanged = true;
		const before = result.subarray(0, matchIndex);
		const after = result.subarray(matchIndex + source.length);
		result = Buffer.concat([before, target, after]);
		matchIndex = result.indexOf(source, matchIndex + target.length);
	}

	return [result, hasChanged]; // Now return if any change has taken place along with the result buffer.
}

/**
 * Default implementation for renaming the files. Uses the Node.js fs.rename function.
 *
 * @param src source path
 * @param dest destination path
 * @returns promise that resolves when the rename is complete
 */
async function renameInFilesystem(src: string, dest: string) {
	return fspromises.rename(src, dest);
}

/**
 * Default implementation for replacing strings in a file. Reads the file, replaces the strings, and writes the file back.
 * Uses the Node.js fs.readFile and fs.writeFile functions.
 *
 * @param filePath path to file to replace in
 * @param find array of strings to find
 * @param replace array of strings to replace with
 */
async function replaceInFile(filePath: string, find: string[], replace: string[]) {
	// If it's a file, read its contents
	let content = await fspromises.readFile(filePath);
	let hasChanged = false;

	// Replace all occurrences of the 'find' strings in the content of the file
	for (let i = 0; i < find.length; i++) {
		const [newContent, changed] = await replaceInBuffer(content, Buffer.from(find[i]), Buffer.from(replace[i]));
		content = newContent;
		hasChanged = hasChanged || changed;
	}

	// Write the modified content back to the file only if changes have been made.
	if (hasChanged) {
		await fspromises.writeFile(filePath, content);
	}
}
