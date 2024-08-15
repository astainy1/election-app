// Create a server that will listen to a port 
// Create three routs:
    // Login - Get route
    // Login - Post route
    // Registration - Get route
    // Registration - Post route
    // Dashboard - Get route
// Use ejs as your file engine

const express = require('express');
const path = require('path');
const port = 5000;
const app = express();
const body = require('body-parser');
const flash = require('connect-flash');
const session = require('express-session');
const { Module } = require('module');

//Variables for password hashing in database
const bcrypt = require('bcrypt');
const saltRounds = 12;

//Variable for refreshing web page upon change to code
const liveReload = require('livereload');
const connectLiveReload = require('connect-livereload');
const { hash } = require('crypto');

//database connection
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./election.db');

//Auto refresh the browser during chances
const liveReloadServer = liveReload.createServer();
liveReloadServer.server.once('connection', () => {
    setTimeout(() =>{
        liveReloadServer.refresh('/');
    }, 100)
});
app.use(connectLiveReload());
app.use(flash());
app.use(express.static(path.join(__dirname, 'views')));
app.set('views engine', 'ejs');

// Create session
app.use(session({
    secret: 'votin_gapp',
    saveUninitialized: true,
    resave: true
}))

app.use(express.static(path.join(__dirname, 'public')));
app.get('/public', express.static('public'));

//Serialize database
db.serialize(() => {

    db.run( `CREATE TABLE IF NOT EXISTS auth (id INTEGER PRIMARY KEY AUTOINCREMENT,username VARCHAR(50) NOT NULL,password VARCHAR(50) NOT NULL,user_id INTEGER NOT NULL);`);

    db.run(`CREATE TABLE IF NOT EXISTS candidates(id  INTEGER PRIMARY KEY AUTOINCREMENT,fname VARCHAR(50) NOT NULL,mname VARCHAR(50) NULL,lname VARCHAR(50) NOT NULL,position_id VARCHAR(50) NOT NULL,party_id    VARCHAR(50) NOT NULL,photo BLOB NOT NULL);`);
        

    db.run(`CREATE TABLE IF NOT EXISTS parties(id INTEGER PRIMARY KEY AUTOINCREMENT,party VARCHAR(50) NOT NULL,logo BLOB NOT NULL);`);

    db.run(`CREATE TABLE IF NOT EXISTS roles(user_Id INTEGER PRIMARY KEY AUTOINCREMENT,role VARCHAR(50) NOT NULL);`);

    // Insert into roles table
    db.run(`INSERT INTO     roles (role) VALUES('Admin'), ('Candidate'), ('Voter')`);
    db.run(
        `DELETE FROM roles
        WHERE rowid NOT IN (
        SELECT MIN(rowid)
        FROM roles
        GROUP BY role)`
    );
    db.run(`CREATE TABLE IF NOT EXISTS user(id  INTEGER  PRIMARY KEY AUTOINCREMENT,fname VARCHAR(50) NOT NULL,mname VARCHAR(50) NULL,lname VARCHAR(50) NOT NULL,dob DATE NOT NULL,photo BLOG NOT NULL)`);
    
//   db.run('CREATE TABLE lorem (info TEXT)')
//   const stmt = db.prepare('INSERT INTO lorem VALUES (?)')

//   for (let i = 0; i < 10; i++) {
//     stmt.run(`Ipsum ${i}`)
//   }

//   stmt.finalize()

//   db.each('SELECT * FROM user', (err, row) => {
//     console.log(row)
//   })
})

// db.close()

app.use(body.urlencoded({extended: true}));

//Registration - Get route
app.get('/register', (request, response) => {

    //query data from the roles table
    const retrieveData = 'SELECT role FROM roles';

    db.all(retrieveData,  (err, row) => {
        if(err){
            console.error(err.message);
        }
        console.log(row);

        // const roles = {
        //     title: "Role",
        //     items: ["Admin", "Candidate", "Voter"]
        // };
        // console.log(`${row.roles}`)
        //render the queried data into the registratio form upon http response.
        response.render('register.ejs', {module : row});
    });
});

//Registration - Post route
app.post('/', (request, response) => {
    
    //Create a destructuring
    const {fName, mName, lName, dob, photo, username, password} = request.body;

    //Insert user information into user table
    const userInfo = 'INSERT INTO  user(fname,mname,lname,dob,photo) VALUES(?,?,?,?,?)';
    const userPersonalData = [fName, mName, lName, dob, photo];
    
    db.run(userInfo, userPersonalData, function(err) {
        if(err){
            console.error(err.message);
        }

        console.log(`New Data added into user table ${this.lastID}`);

        const userId = this.lastID;

        //Insert user information into auth table
        const userLoginDetail = `INSERT INTO auth(username, password, user_id) VALUES(?,?,?)`;

        //Hash user password
        bcrypt.hash(password, saltRounds, (err, hash) => {
            if(err){
                console.error(err.message);
            }else{
                        
                const validPassword = hash; //Store hashed password 
                const userAuthData = [username, validPassword, userId];
                // console.log(validPassword);//log hash password
                
                db.run(userLoginDetail, userAuthData, (err) => {
                    if(err){
                        console.error(err.message);
                    }
        
                    console.log('Data Inserted into user and auth tables')
                })
            }
        })    
    });

    response.redirect('/');
});

//Forget password get route
app.get('/forgot-password', (req, res) => {
    res.render('forgot-password.ejs')
});

//Forget password post route
app.post('/recover-account', (req, res) => {
    res.redirect('/recover-account')
})

// Login - Get route
app.get('/', (request, response) => {
    response.render('login.ejs', {errorMessage: ''});
});

//Recover Account - Get route
app.get('/recover-account', (req, res) => {
    res.render('recover-password.ejs');
})

//Recover Account - Post route
app.post('/', (req, res) => {
    res.redirect('/');
})

// Login - Post route
app.post('/dashboard', (request, response) => {
    const {username, password} = request.body;

    //query to access username and prevent SQL injection
    const authData = `SELECT username, password FROM auth WHERE username = ?`;

    db.get(authData, [username], (err, row) => {

        if (err) {
            console.error(err.message);
            const serverErrorMsg = 'Server error. Please try again later.'
            return response.status(500).render('login.ejs', {errorMessage: serverErrorMsg});
        }

        if (!row) {
            // User not found
            const invalidUser = 'User not found.'
            return response.status(401).render('login.ejs', {errorMessage: invalidUser});
        }

        // Retrieve the stored hashed password from the database
        const storedHash = row.password;

        // Compare the entered password with the stored hash
        bcrypt.compare(password, storedHash, (err, result) => {

            if (err) {
                console.error(err.message);
                const serverErrMsg = 'Server error.';
                return response.status(500).render('login.ejs', {errorMessage: serverErrMsg});
            }

            if (result) {
                // Passwords match
                console.log('login successful');

                const successMsg = "Login successful!"
                console.log(username)
                request.session.username = username;
                return response.redirect('/dashboard');
            } else {
                // Passwords do not match
                const errorMsg = 'Invalid password.';
                console.log('Password does not match');

                // request.flash('message', "Password does not match")
                return response.status(401).render('login.ejs', {errorMessage: errorMsg});
                
            }
        });
    });
});

// Dashboard - get route
app.get('/dashboard', (request, response) => {
    //Get username from session
    const loginUserName = request.session.username;
    console.log(loginUserName)

    if(request.session.username){
        response.render('dashboard.ejs', {LoginedUsername: request.session.username})
    }else{
        console.log('Login failed!')
    }
});

//Listen to port
app.listen(port, () =>{
    console.log(`Http response! Status: Listening on port: ${port} (http://localhost:${port})`);
});







