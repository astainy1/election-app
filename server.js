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

//Create upload directory if not exist
const uploadsDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Uploads directory created');
}

//Create contestants directory if not exist in upload directory
const contestantsDir = path.join(__dirname, 'uploads/contestants');
if(!fs.existsSync(contestantsDir)){
    fs.mkdirSync(contestantsDir, { recursive: true });
    console.log('contestants directory is created')
}
// Set up multer for file uploads from voter registration form
const upload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, 'uploads/');
        },
        filename: function (req, file, cb) {
            cb(null, Date.now() + path.extname(file.originalname)); // Unique file name
        }
    })
}); // form photo input field name

//Set up multer of file uploads from contestants registration form
const contestantPhoto = multer({
    storage: multer.diskStorage({
        destination: function(req, file, cb) {
            cb(null, 'uploads/contestants');
        },
        filename: function(req, file, cb) {
            cb(null, Date.now() + path.extname(file.originalname));
        }
    })
});

//Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads/contestants', express.static(path.join(__dirname, 'uploads/contestants')));

app.use(express.static(path.join(__dirname, 'public')));
app.get('/public', express.static('public'));

// Serve static files like images




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
    db.run(`CREATE TABLE IF NOT EXISTS user(id  INTEGER  PRIMARY KEY AUTOINCREMENT,fname VARCHAR(50) NOT NULL,mname VARCHAR(50) NULL,lname VARCHAR(50) NOT NULL,dob DATE NOT NULL,photo BLOG NOT NULL,role VARCHAR(50) NOT NULL, voted)`);
    
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
    //query all role from roles table
    const userRole = `SELECT role FROM roles`
    db.all(userRole, (err, row) =>{
        if(err){
            console.error(err.message);
        }else{

            response.render('voter-registration.ejs', {module : row, errorMessage: '', pageTitle : 'Register'});
        }
    })
    //render the queried data into the registratio form upon http response.
});

// Registration - Post route
app.post('/', upload.single('photo'), (request, response) => {
    const { fName, mName, lName, dob, role, username, password } = request.body;
    const imagePath = request.file ? request.file.path : null;

    // Insert user information into the user table
    const userInfo = 'INSERT INTO user (fname, mname, lname, dob, photo, role) VALUES (?, ?, ?, ?, ?, ?)';
    const userPersonalData = [fName, mName, lName, dob, imagePath, role]; //values for database placeholder

    if (!request.file) {
        return response.status(400).send(`<h1>No file received. Please try again.</h1>`);
    } console.log('File received:', request.file);

    db.run(userInfo, userPersonalData, function(err) {
        if (err) {
            console.error(err.message);
            return response.status(500).send('Database error. Please try again later.');
        }

        console.log(`New Data added into user table with ID: ${this.lastID}`);

        // Insert user information into auth table
        const userLoginDetail = 'INSERT INTO auth (username, password, user_id) VALUES (?, ?, ?)';
        
        // Hash user password
        bcrypt.hash(password, saltRounds, (err, hash) => {
            if (err) {
                console.error(err.message);
                return response.status(500).render('voter-registration.ejs', {errorMessage: 'Error hashing password.', pageTitle : 'register'});
            }

            const userAuthData = [username, hash, this.lastID];

            db.run(userLoginDetail, userAuthData, (err) => {
                if (err) {
                    console.error(err.message);
                    return response.status(500).render('voter-registration.ejs', {errorMessage: 'Database error. Please try again later.', pageTitle : 'register'});
                }
                if(fName === '' || fName === null){

                    console.log(fName);
                    return response.render('voter-registration.ejs', {errorMessage: 'Please check you input fields.', pageTitle : 'register'})
                }
                else if(dob === '' || dob === null){

                    console.log(dob);
                    return response.render('voter-registration.ejs', {errorMessage: 'Please check you input fields.', pageTitle : 'register'})
                }
                else if(password.length === '' || mName === null){

                    console.log(mName);
                    return response.render('voter-registration.ejs', {errorMessage: 'Please check you input fields.', pageTitle : 'register'})
                }

                else{

                    console.log('Data Inserted into user and auth tables');
                    response.redirect('/');
                }
            });
        });
    });
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
    const { role, username, password } = req.body;

    // Query to access username and prevent SQL injection
    const authData = `SELECT id, username, password FROM auth WHERE username = ?`;

    db.get(authData, [username], (err, row) => {
        if (err) {
            console.error(err.message);
            return res.status(500).render('login.ejs', { errorMessage: 'Server error. Please try again later.', pageTitle: 'Login' });
        }

        if (!row) {
            // User not found
            return res.status(401).render('login.ejs', { errorMessage: 'User not found.', pageTitle: 'Login' });
        }

        // Retrieve the stored hashed password from the database
        const storedHashedPwd = row.password;

        // Compare the entered password with the stored hashed password
        bcrypt.compare(password, storedHashedPwd, (err, result) => {
            if (err) {
                console.error(err.message);
                return res.status(500).render('login.ejs', { errorMessage: 'Server error.', pageTitle: 'Login' });
            }

            if (result) {
                // Passwords match

                // Store username in session
                req.session.username = username;

                // Retrieve the user's image path from the user table
                const userImageQuery = `SELECT photo FROM user WHERE id = ?`;

                db.get(userImageQuery, [row.id], (err, imageRow) => {
                    if (err) {
                        console.error(err.message);
                        return res.status(500).send('Error retrieving image');
                    }

                    // Get the image path from the database
                    const imagePath = imageRow ? imageRow.photo : null;

                    // Store the image path in the session
                    req.session.imagePath = imagePath;

                    //Retrive user role from role table
                    const activeUserRole = 'SELECT role FROM user WHERE id = ?';
                    
                    db.get(activeUserRole, [row.id], (err, roleResult) => {

                        if(err){
                            console.error(err.message);
                        }
                        if(roleResult.role === 'Admin'){

                            console.log('Admin has loggedin!')

                            // Redirect to admin dashboard
                            res.redirect('/dashboard');

                        }else if(roleResult.role === 'Candidate'){

                            console.log('Candidate has logged in')
                            res.render('candidate-dashboard.ejs', {LoginedUsername: username, image: imagePath ? `/uploads/${path.basename(imagePath)}` : null, pageTitle: 'Dashboard', moduleName: 'Dashboard', message: 'Welcome to Candidate dashboard', pageTitle: 'Dashboard'});

                        }else if(roleResult.role === 'Voter'){

                            console.log('Voter has logged in!')
                            res.render('vote.ejs', {LoginedUsername: username, image: imagePath ? `/uploads/${path.basename(imagePath)}` : null, pageTitle: 'Dashboard', moduleName: 'Dashboard', message: 'Welcome to Voter dashboard', pageTitle: 'Dashboard'})

                        }else{

                            res.render('login.ejs', {errorMessage: 'Role was not selected!', pageTitle: 'Login'})

                        }
                    })
 
                });
            } else {
                // Passwords do not match
                return res.status(401).render('login.ejs', { errorMessage: 'Invalid password.', pageTitle: 'Login' });
            }
        });
    });
});

// Admin Dashboard - GET route
app.get('/dashboard', (request, response) => {

    // Get username and image path from session
    const username = request.session.username;
    const imagePath = request.session.imagePath; // Retrieve the image path from session
    
    if (username) {
 //query the total number of voter from role column in user table
        const retrieveData = `SELECT COUNT(*) AS total_voters FROM user WHERE role = 'Voter'`; 
        db.get(retrieveData, [], (err, row) => {
            if(err){
                console.error('Error counting role: ', err.message);
            }
            if(row){
                const userDashboard = 'Admin Electorial Dashboard'
                console.log('Total voters: ', row.total_voters);
                response.render('admin-dashboard.ejs', {message: userDashboard, totalVotes: row, LoginedUsername: username, image: imagePath ? `/uploads/${path.basename(imagePath)}` : null, pageTitle: 'Dashboard', moduleName: 'Dashboard'});
            }
        });

        // Render the dashboard page with user data
    } else {
        // Redirect to login if user is not authenticated
        response.render('login.ejs', {errorMessage: 'Login failed! Please try again.', pageTitle: 'Login' 
        });
    }
});

//voter - Get route
app.get('/voter', (request, response) => {
    response.send('Welcome to voter dashboard');
});

//Candidate - Get route
app.get('/candidate', (request, response) => {
    response.send('Welcome to candidate dashboard')
})


//Contestants - get route starts
app.get('/contestants', (request, response) => {

    //Get image path
    const imagePath = request.session.imagePath;

    response.render('contestants.ejs', {LoginedUsername: request.session.username, image: imagePath ? `/uploads/${path.basename(imagePath)}` : null, pageTitle : '', moduleName : 'Contestants'})
});

// Contestants - post route starts
app.post('/contestants', contestantPhoto.single('contestants-photo'), (request, response) => {
    //Destructure user input data
    const {fName, mName, lName, position, party} = request.body;

    //Get user photo store 
    const imagePath = request.file ? request.file.path : null;

    //Insert contestants data into contestant table
    const contestantsData = `INSERT INTO candidates(fname, mname, lname, position_id, party_id, photo) VALUES(?,?,?,?,?,?)`

    console.log(imagePath)

    //Store values into array
    const databaseValues = [fName, mName, lName, position, imagePath, party];

    if (!request.file) {
        return response.status(400).send(`<h1>No file received. Please try again.</h1>`);
    } console.log('File received:', request.file);

    db.run(contestantsData, databaseValues, (err) => {
        if(err){
            console.log(`Error inserting data into contestants table: ${err.message}`)
        }console.log('Data inserted into contestants table')
    })
    // response.redirect('/contestants')
});

//Party registration - Get Route
app.get('/party', (request, response) => {
    //Get image path
    const imagePath = request.session.imagePath;

    response.render('party-registration.ejs', {LoginedUsername: request.session.username, image: imagePath ? `/uploads/${path.basename(imagePath)}` : null, pageTitle : '', moduleName : 'Contestants'})
});

//Party registration - Post Route
app.post('/party', (request, response) => {
    //insert data into party table
    const {partyName, logo} = request.body;

    const partyData = `INSERT INTO parties(party, logo) VALUES(?, ?)`;

    const partyDetails = [partyName, logo];

    db.run(partyData, partyDetails, (err) => {
        if(err){
            console.error(`Error inserting data: ${err.message}`);
        }else{
            console.log('Party data inserted successfully!', partyDetails);
            response.redirect('/party');
        }
    })
});

// Positioin - Get Route
app.get('/position', (request, response) => {
    const imagePath = request.session.imagePath;
    response.render('404.ejs', {LoginedUsername: request.session.username, image: imagePath ? `/uploads/${path.basename(imagePath)}` : null, pageTitle : '', moduleName : 'Contestants'});
});

//Positon - Post Route
app.post('/position', (request, response) => {
    response.redirect('/position');
   
});

//Election - Get Route
app.get('/election', (request, response) => {
    const imagePath = request.session.imagePath;
    response.render('404.ejs', {LoginedUsername: request.session.username, image: imagePath ? `/uploads/${path.basename(imagePath)}` : null, pageTitle : '', moduleName : 'Contestants'});
});

//Election - Post Route
app.post('/election', (request, response) => {
    response.redirect('/election')
});

//Vote list - Get Route
app.get('/vote-list', (request, response) => {
    const imagePath = request.session.imagePath;
    response.render('404.ejs', {LoginedUsername: request.session.username, image: imagePath ? `/uploads/${path.basename(imagePath)}` : null, pageTitle : '', moduleName : 'Contestants'});
})
//Vote list - Post Route
app.post('/vote-list', (request, response) => {
    const imagePath = request.session.imagePath;
    response.render('404.ejs', {LoginedUsername: request.session.username, image: imagePath ? `/uploads/${path.basename(imagePath)}` : null, pageTitle : '', moduleName : 'Contestants'});
})

//users - Get Route
app.post('/users', (request, response) => {
    const imagePath = request.session.imagePath;
    response.render('404.ejs', {LoginedUsername: request.session.username, image: imagePath ? `/uploads/${path.basename(imagePath)}` : null, pageTitle : '', moduleName : 'Contestants'});
})

//user - Post Route
app.post('/users', (request, response) => {
    const imagePath = request.session.imagePath;
    response.render('404.ejs', {LoginedUsername: request.session.username, image: imagePath ? `/uploads/${path.basename(imagePath)}` : null, pageTitle : '', moduleName : 'Contestants'});
})

//Listen to port
app.listen(port, () =>{
    console.log(`Http response! Status: Listening on port: ${port} (http://localhost:${port})`);
});
