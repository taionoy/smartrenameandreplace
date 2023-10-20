
/**
 * Customer Access class
 */
export class CustomerAccess {
    constructor(username, password) {
        this.username = username;
        this.password = password;
        this.isLoggedIn = false;
    }
    login() {
        // Simulating login logic
        if (this.username === 'admin' && this.password === 'password') {
            this.isLoggedIn = true;
            console.log('Login successful!');
        }
        else {
            console.log('Invalid username or password.');
        }
    }
    logout() {
        this.isLoggedIn = false;
        console.log('Logged out successfully.');
    }
    getIsLoggedIn() {
        return this.isLoggedIn;
    }
}
