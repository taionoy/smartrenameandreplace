const CustomerAccess = require('./CustomerAccess');

/**
 * Customer Access test class
 */
class CustomerAccessTest {
	static runTest() {
		const customerAccess = new CustomerAccess.CustomerAccess('admin', 'password');
		// Assert that initially user is not logged in
		console.assert(!customerAccess.getIsLoggedIn(), 'Initially user should not be logged in');
		// Test login functionality
		customerAccess.login();
		console.assert(customerAccess.getIsLoggedIn(), 'After login, user should be logged in');
		// Test logout functionality
		customerAccess.logout();
		console.assert(!customerAccess.getIsLoggedIn(), 'After logout, user should not be logged in');
		console.log('All tests passed!');
	}
	static run() {
		try {
			CustomerAccessTest.runTest();
		} catch (error) {
			console.error(`Test failed: ${error}`);
		}
	}
}
// Run the tests
CustomerAccessTest.run();
