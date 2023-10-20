import * as assert from 'assert';
import * as extension from '../../extension';
import * as path from 'path';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Rename and Replace', async () => {
		const options = {
			renameFilesOn: true,
			renameDirectoriesOn: true,
			replaceOn: true,
			renameFunc: async (fromPath: string, toPath: string) => {
				fromPath = path.resolve(fromPath);
				toPath = path.resolve(toPath);
				await vscode.workspace.fs.rename(vscode.Uri.file(fromPath), vscode.Uri.file(toPath), {
					overwrite: false,
				});
			},
		};
		await extension.executeRenameAndReplace(
			'testfiles/customeraccess',
			['CustomerAccess', 'customerAccess', 'customer_access', 'customeraccess', 'Customer Access'],
			['ClientAccess', 'clientAccess', 'client_access', 'clientaccess', 'Client Access'],
			options
		);
		await extension.executeRenameAndReplace(
			'testfiles/clientaccess',
			['ClientAccess', 'clientAccess', 'client_access', 'clientaccess', 'Client Access'],
			['CustomerAccess', 'customerAccess', 'customer_access', 'customeraccess', 'Customer Access'],
			options
		);
	});
});
