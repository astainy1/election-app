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
const multer = require('multer');
const { Module } = require('module');
const fs = require('fs');

//Variables for password hashing in database
const bcrypt = require('bcrypt');
const saltRounds = 12;

//Variable for refreshing web page upon change to code
const liveReload = require('livereload');
const connectLiveReload = require('connect-livereload');
const { hash } = require('crypto');
const { request } = require('http');
const { errorMonitor } = require('events');

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

// Define the path to the 'uploads' directory
const uploadsDir = path.join(__dirname, 'uploads');

const upload = multer({desk: 'uploads/'})
// Check if the directory exists, and create it if it does not
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Uploads directory created');
}
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
    db.run(`CREATE TABLE IF NOT EXISTS user(id  INTEGER  PRIMARY KEY AUTOINCREMENT,fname VARCHAR(50) NOT NULL,mname VARCHAR(50) NULL,lname VARCHAR(50) NOT NULL,dob DATE NOT NULL,photo BLOG NOT NULL,role VARCHAR(50) NOT NULL)`);
    
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

        //render the queried data into the registratio form upon http response.
        response.render('register.ejs', {module : row, pageTitle : 'Register'});
    });
});

//Registration - Post route
app.post('/', upload.single('image'), (request, response) => {
    
    //Create a destructuring
    const {fName, mName, lName, dob, photo, role, username, password} = request.body;
    const imagePath = request.file ? request.file.path : null;
    //Read user data into the database
    const image = imagePath ? fs.readFile(imagePath) : null;
    //Insert user information into user table
    const userInfo = 'INSERT INTO  user(fname,mname,lname,dob,photo,role) VALUES(?,?,?,?,?,?)';
    const userPersonalData = [fName, mName, lName, dob, photo, role];
    
    console.log(role);
    db.run(userInfo, userPersonalData, function(err) {

        console.log(`New Data added into user table ${this.lastID}`);

        const userId = this.lastID;

        // Remove the temporary file
        if(imagePath){
            const image = fs.unlinkSync(imagePath);
            }
            if(err){
                console.error(err.message);
            }

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
    res.render('forgot-password.ejs', {pageTitle : 'Forgot Password'})
});

//Forget password post route
app.post('/recover-account', (req, res) => {
    res.redirect('/recover-account')
})

// Login - Get route
app.get('/', (request, response) => {
    response.render('login.ejs', {errorMessage: '', pageTitle : 'Login'});
});

//Recover Account - Get route
app.get('/recover-account', (req, res) => {
    res.render('recover-password.ejs', {pageTitle : 'Reset Password'});
})

//Recover Account - Post route
app.post('/', (req, res) => {
    res.redirect('/');
})

// Login - Post route
app.post('/dashboard', (req, res) => {
    const { username, password } = req.body;

    // Query to access username and prevent SQL injection
    const authData = `SELECT id, username, password FROM auth WHERE username = ?`;

    db.get(authData, [username], (err, row) => {
        if (err) {
            console.error(err.message);
            return res.status(500).render('login.ejs', { errorMessage: 'Server error. Please try again later.', pageTitle : 'Login' });
        }

        if (!row) {
            // User not found
            return res.status(401).render('login.ejs', { errorMessage: 'User not found.', pageTitle : 'Login' });
        }

        // Retrieve the stored hashed password from the database
        const storedHashedPwd = row.password;

        // Compare the entered password with the stored hashed password
        bcrypt.compare(password, storedHashedPwd, (err, result) => {
            if (err) {
                console.error(err.message);
                return res.status(500).render('login.ejs', { errorMessage: 'Server error.', pageTitle : 'Login' });
            }

            if (result) {
                // Passwords match

                // Store username in session
                req.session.username = username;

                // Retrieve the user's image from the images table
                const userImageQuery = `SELECT photo FROM user WHERE id = ?`;

                db.get(userImageQuery, [row.id], (err, imageRow) => {
                    if (err) {
                        return res.status(500).send('Error retrieving image');
                    }

                    console.log(imageRow)
                    // Convert image BLOB to base64 for display
                    const imageBase64 = imageRow ? imageRow : null;

                    console.log(imageBase64)
                    // Redirect to dashboard with image and username in query params
                    // res.redirect(`/dashboard?username=${encodeURIComponent(username)}&image=${encodeURIComponent(imageBase64 || '')}`);
                    res.redirect('/dashboard');
                });
            } else {
                // Passwords do not match
                return res.status(401).render('login.ejs', { errorMessage: 'Invalid password.', pageTitle : 'Login' });
            }
        });
    });
});

// Dashboard - get route
app.get('/dashboard', (request, response) => {

    //Query user image
    //Get username from session
    const loginUserName = request.session.username;

    if(request.session.username){
        response.render('dashboard.ejs', {LoginedUsername: request.session.username, image: request.query.photo, pageTitle : '', moduleName : 'Dashboard'})
    }else{
        response.render('login.ejs', {errorMessage : 'Login failed! Please try again.', pageTitle : 'Login'})
    }
});
//Dashboard - get route ends

//Contestants - get route starts
app.get('/contestants', (request, response) => {
    response.render('contestants.ejs', {LoginedUsername: request.session.username, image: request.query.photo, pageTitle : '', moduleName : 'Contestants'})
});

//Contestants - get route ends

// Contestants - post route starts
app.post('/contestnats', (request, response) => {
    response.redirect('/contestants')
})

//Listen to port
app.listen(port, () =>{
    console.log(`Http response! Status: Listening on port: ${port} (http://localhost:${port})`);
});







