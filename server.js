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
const flash = require('connect-flash'); //For sending error to the front end
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
const db = new sqlite3.Database('./elections.db');

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
    resave: true,
    cookie: {secure: false}
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

//Create logo directory if not exist in upload directory
const logoDir = path.join(__dirname, 'uploads/logo');
if(!fs.existsSync(logoDir)){
    fs.mkdirSync(logoDir, { recursive: true });
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

// Set up multer for uploading contestants picture from the contestant registration form
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

// Set up multer for uploading party logo from the contestant registration form
const partyLogo = multer({
    storage: multer.diskStorage({
        destination: function(req, file, cb) {
            cb(null, 'uploads/logo');
        },
        filename: function(req, file, cb) {
            cb(null, Date.now() + path.extname(file.originalname));
        }
    })
});

//Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/public', express.static('public'));

//Create all necessary tables
    // Using serialize to run many sqlite command at once
db.serialize(() => {

    db.run( `CREATE TABLE IF NOT EXISTS auth (id INTEGER PRIMARY KEY AUTOINCREMENT,username VARCHAR(50) NOT NULL,password VARCHAR(50) NOT NULL,user_id INTEGER NOT NULL);`);

    db.run(`CREATE TABLE IF NOT EXISTS candidates(id  INTEGER PRIMARY KEY AUTOINCREMENT,fname VARCHAR(50) NOT NULL,mname VARCHAR(50) NULL,lname VARCHAR(50) NOT NULL,position_id VARCHAR(50) NOT NULL,party_id VARCHAR(50) NOT NULL,photo BLOB NOT NULL);`);
        

    db.run(`CREATE TABLE IF NOT EXISTS parties(id INTEGER PRIMARY KEY AUTOINCREMENT,party VARCHAR(50) NOT NULL,logo BLOB);`);
    
    db.run(`CREATE TABLE IF NOT EXISTS positions(id INTEGER PRIMARY KEY AUTOINCREMENT,position VARCHAR(50) NOT NULL,election VARCHAR(50) NOT NULL);`);
    
    db.run(`CREATE TABLE IF NOT EXISTS elections(id INTEGER PRIMARY KEY AUTOINCREMENT,election VARCHAR(50) NOT NULL);`);

    db.run(`CREATE TABLE IF NOT EXISTS userRole(id INTEGER PRIMARY KEY AUTOINCREMENT,user VARCHAR(50) NOT NULL);`);

    db.run(`CREATE TABLE IF NOT EXISTS roles(user_Id INTEGER PRIMARY KEY AUTOINCREMENT,role VARCHAR(50) NOT NULL);`);

    // Insert into roles table
    db.run(`INSERT INTO     roles (role) VALUES('Admin'), ('Candidate'), ('Voter')`);
    db.run(
        `DELETE FROM roles WHERE rowid NOT IN (SELECT MIN(rowid) FROM roles GROUP BY role)`
    );

    db.run(`CREATE TABLE IF NOT EXISTS user(id  INTEGER  PRIMARY KEY AUTOINCREMENT,fname VARCHAR(50) NOT NULL,mname VARCHAR(50) NULL,lname VARCHAR(50) NOT NULL,dob DATE NOT NULL,photo BLOB,role VARCHAR(50) NOT NULL, voted TEXT DEFAULT 'Has not voted!')`);

    db.run(`CREATE TABLE IF NOT EXISTS votes(id INTEGER PRIMARY KEY AUTOINCREMENT,candidate_id TEXT,vote TEXT,user_id TEXT);`);
    
})

app.use(body.urlencoded({extended: true})); //Get input fields value using body-parser

//Function to authenticate user login; securing the various routes
function isAuthenticate(request, response, next){
    if(request.session && request.session.isLoggedIn){
        //if user has successfully loggedin, allow user to the next route
        return next();
    }else{
        //else redirect user to the login route.
        response.redirect('/');
    }
}


// Voter list - Post Route 2
app.post('/vote-list', upload.single('photo'), (request, response) => {
    const { fName, mName, lName, dob, role, username, password } = request.body;
    console.log(fName);
    console.log('Add voter form is displayed:');

    let userImagePath;

    if(request.file){
        console.log('user image received!')
        userImagePath = request.file.path;
    }else{
        console.log('No image. Therefore, default image will be used');
        userImagePath = './uploads/pngegg.png'
    }

    // Insert user information into the user table
    const userInfo = 'INSERT INTO user (fname, mname, lname, dob, photo, role) VALUES (?, ?, ?, ?, ?, ?)';
    const userPersonalData = [fName, mName, lName, dob, userImagePath, role]; //values for database placeholder

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
                return response.status(500).render('table.ejs', {errorMessage: 'Error hashing password.', pageTitle : 'register'});
            }

            const userAuthData = [username, hash, this.lastID];
            
            db.run(userLoginDetail, userAuthData, (err) => {
                if (err) {
                    console.error(err.message);
                    return response.status(500).render('table.ejs', {module: row, totalVoterList: voterListing, LoginedUsername: request.session.username, image: imagePath ? `/uploads/${path.basename(imagePath)}` : null, pageTitle : '', moduleName : 'Voter Listing'});
                }else{
                    console.log('Data Inserted into user and auth tables');
                    response.redirect('/vote-list');
                };
            });
        });
    });
});

// Login - Get route
app.get('/', (request, response) => {
    response.render('login.ejs', {errorMessage: '', pageTitle : 'Login'});
});

// Logout - Get route
app.get('/logout', (request, response) => {
    request.session.destroy((err) => {
        if(err){
            return response.redirect('/dashboard');
        }else{
            // Destory cookies
            response.clearCookie('connect.sid'); 

            response.redirect('/');
        }
    })
})

// Login - Post route
app.post('/dashboard', (req, res) => {
    const { role, username, password } = req.body;

    // Query to access username and prevent SQL injection
    const authData = `SELECT * FROM auth WHERE username = ?`;

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
                //Store user id in session
                req.session.user_id = row.user_id;
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
                            //is authenticated
                            req.session.isLoggedIn = true;

                            console.log('Admin has loggedin!')

                            // Redirect to admin dashboard
                            res.redirect('/dashboard');

                        }else if(roleResult.role === 'Candidate'){
                            //is authenticated
                            req.session.isLoggedIn = true;

                            console.log('Candidate has logged in')
                            res.render('candidate-dashboard.ejs', {LoginedUsername: username, image: imagePath ? `/uploads/${path.basename(imagePath)}` : null, pageTitle: 'Dashboard', moduleName: 'Dashboard', message: 'Welcome to Candidate dashboard', pageTitle: 'Dashboard'});

                        }else if(roleResult.role === 'Voter'){
                            //is authenticated
                            req.session.isLoggedIn = true;
                            //Get user id and store into session
                            console.log(req.session.user_id); //testing the logic

                            console.log('Voter has logged in!')
                            res.redirect('/vote')

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

//Dashboard - Get route
app.get('/dashboard', isAuthenticate, (request, response) => {
    const username = request.session.username;
    const imagePath = request.session.imagePath;

    if (username) {
        const retrieveData = `SELECT COUNT(*) AS total_voters FROM user WHERE role = 'Voter'`;

        db.get(retrieveData, [], (err, row) => {
            if (err) {
                console.error('Error counting voters: ', err.message);
                return response.status(500).render('admin-dashboard.ejs', { 
                    message: 'Error loading dashboard', 
                    totalVoters: null, 
                    LoginedUsername: username, 
                    image: imagePath ? `/uploads/${path.basename(imagePath)}` : null, 
                    pageTitle: 'Dashboard', 
                    moduleName: 'Dashboard'
                });
            } 

            // Get total votes
            const totalUserVotes = `SELECT COUNT(*) AS total_votes FROM votes WHERE vote = 1`;

            db.get(totalUserVotes, [], (err, result) => {
                if(err){
                    console.error('Error retrieving total votes: ', err.message);
                    return response.status(500).render('admin-dashboard.ejs', { 
                        message: 'Error loading dashboard', 
                        totalVoters: row, 
                        totalVotes: null, 
                        LoginedUsername: username, 
                        image: imagePath ? `/uploads/${path.basename(imagePath)}` : null, 
                        pageTitle: 'Dashboard', 
                        moduleName: 'Dashboard'
                    });
                }
                // Get total votes for each candidate
                const candidateVotes = `
                    SELECT c.id, c.fname, c.mname, c.lname, c.position_id, c.party_id, c.photo, COUNT(v.vote) AS totalCandidateVote, COUNT((v.id) * 100.0 / (SELECT COUNT(*) FROM votes)) AS votePercentage
                    FROM candidates c
                    LEFT JOIN votes v ON c.id = v.candidate_id
                    GROUP BY c.id
                `;

                db.all(candidateVotes, [], (err, rows) => {
                    if(err){
                        console.error('Error retrieving candidate votes: ', err.message);
                        return response.status(500).render('admin-dashboard.ejs', { 
                            message: 'Error loading dashboard', 
                            totalVoters: row, 
                            totalVotes: result, 
                            candidatesData: null,
                            LoginedUsername: username, 
                            image: imagePath ? `/uploads/${path.basename(imagePath)}` : null, 
                            pageTitle: 'Dashboard', 
                            moduleName: 'Dashboard'
                        });
                    }

                    const userDashboard = 'Admin Electoral Dashboard';
                    
                    response.render('admin-dashboard.ejs', { 
                        module: '',
                        positionModel: '', 
                        partiesModel: '',
                        message: userDashboard, 
                        totalVoters: row,
                        totalVotes: result, 
                        candidatesData: rows, 
                        LoginedUsername: username, 
                        image: imagePath ? `/uploads/${path.basename(imagePath)}` : null, 
                        pageTitle: 'Dashboard', 
                        moduleName: 'Dashboard'
            })
            
                });
            });
        });
    } else {
        response.render('login.ejs', { 
            errorMessage: 'Login failed! Please try again.', 
            pageTitle: 'Login'
        });
    }
});

//voter - Get route
app.get('/voter', isAuthenticate, (request, response) => {
    response.send('Welcome to voter dashboard');
});

//Candidate - Get route
app.get('/candidate', isAuthenticate, (request, response) => {
    response.send('Welcome to candidate dashboard')
})

//Contestants - get route starts// Contestants - get route starts
app.get('/contestants', isAuthenticate, (request, response) => {
    // Get image path from session
    const imagePath = request.session.imagePath;

    // Get data from positions table
    const contestantPosition = `SELECT position FROM positions`;

    db.serialize(() => {
        db.all(contestantPosition, (err, allPosition) => {
            if (err) {
                console.error(`Error retrieving position from table: ${err.message}`);
                return response.status(500).send('Error retrieving positions.');
            }

            console.log('Successfully retrieved data from position table: ', allPosition);

            const electionType = `SELECT party FROM parties`;

            db.all(electionType, (err, allParties) => {
                if (err) {
                    console.error(`Error retrieving parties: ${err.message}`);
                    return response.status(500).send('Error retrieving parties.');
                }

                console.log('Successfully retrieved data from parties: ', allParties);

                const userRole = `SELECT role FROM roles WHERE role = 'Candidate'`;

                db.all(userRole, [], (err, candidateRole) => {
                    if (err) {
                        console.error(`Error retrieving candidate role: ${err.message}`);
                        return response.status(500).send('Error retrieving candidate role.');
                    }

                    console.log('Successfully retrieved candidate role: ', candidateRole);

                    const registeredCandidate = `SELECT * FROM candidates`;

                    db.all(registeredCandidate, [], (err, candidateDetails) => {
                        if (err) {
                            console.error(`Error retrieving all candidate details from candidates table: ${err.message}`);
                            return response.status(500).send('Error retrieving candidates.');
                        }

                        console.log('Successfully retrieved candidate details: ', candidateDetails);

                        response.render('contestants.ejs', {
                            allCandidate: candidateDetails,
                            module: candidateRole,
                            positionModel: allPosition,
                            partiesModel: allParties,
                            LoginedUsername: request.session.username,
                            image: imagePath ? `/uploads/${path.basename(imagePath)}` : null,
                            pageTitle: '',
                            moduleName: 'Contestants'
                        });
                    });
                });
            });
        });
    });
});


// Contestants - post route starts// Contestants - post route starts
app.post('/contestants', contestantPhoto.single('contestants-photo'), (request, response) => {
    // Destructure user input data
    const { fName, mName, lName, position, party, username, password } = request.body;

    // Get user photo store 
    const imagePath = request.file ? request.file.path : null;

    // If file not received, send error message
    if (!request.file) {
        return response.status(400).send(`<h1>No file received. Please try again.</h1>`);
    } 
    console.log('File received:', request.file);

    // Insert contestants data into the contestants table
    const contestantsData = `INSERT INTO candidates(fname, mname, lname, position_id, party_id, photo) VALUES(?,?,?,?,?,?)`;

    // Store values into array
    const databaseValues = [fName, mName, lName, position, party, imagePath];

    db.run(contestantsData, databaseValues, function(err) {
        if (err) {
            console.log(`Error inserting data into contestants table: ${err.message}`);
            return response.status(500).send('Error inserting contestant data.');
        }

        const newCandidateId = this.lastID; // Get the ID of the newly inserted contestant
        console.log(`New Data added into candidates table with ID: ${newCandidateId}`);

        // Insert user information into the auth table
        const candidateLoginDetail = 'INSERT INTO auth (username, password, user_id) VALUES (?, ?, ?)';

        // Hash user password
        bcrypt.hash(password, saltRounds, (err, hash) => {
            if (err) {
                console.error(err.message);
                // return response.status(500).render('voter-registration.ejs', { errorMessage: 'Error hashing password.', pageTitle: 'register' });
                return response.status(500).send('Error hashing password.');
            }

            const candidateAuthData = [username, hash, newCandidateId];
            db.run(candidateLoginDetail, candidateAuthData, (err) => {
                if (err) {
                    console.error(`Error inserting data into auth table: ${err.message}`);
                    return response.status(500).send('Error inserting auth data.');
                }
                console.log('Data inserted into auth and candidates tables');
                response.redirect('/contestants');
            });
        });
    });
});


//Registration - Get route
app.get('/admi-nreg', (request, response) => {
    //query all role from roles table
    const userRole = `SELECT role FROM roles`
    db.all(userRole, (err, row) =>{
        if(err){
           return console.error(`Error querying role: ${err.message}`);
        }else{
            response.render('voter-registration.ejs', {module : row, errorMessage: '', pageTitle : 'Register'});
            //render the queried data into the registratio form upon http response.
        }
    })
});

// Registration - Post route
app.post('/', upload.single('photo'), (request, response) => {
    const { fName, mName, lName, dob, role, username, password } = request.body;
    
    let userImagePath;

    if(request.file){
        console.log('user image received!')
        userImagePath = request.file.path;
    }else{
        console.log('No image. Therefore, default image will be used');
        userImagePath = './uploads/pngegg.png'
    }

    // Insert user information into the user table
    const userInfo = 'INSERT INTO user (fname, mname, lname, dob, photo, role) VALUES (?, ?, ?, ?, ?, ?)';
    const userPersonalData = [fName, mName, lName, dob, userImagePath, role]; //values for database placeholder

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
                }else{
                    console.log('Data Inserted into user and auth tables');
                    response.redirect('/');
                };
            });
        });
    });
});


//Party registration - Get Route
app.get('/party', isAuthenticate, (request, response) => {
    //Get image path
    const imagePath = request.session.imagePath;

    //Query all data from party table
    const parties = `SELECT * FROM parties`;

    db.all(parties, (err, rows) => {
        if(err){
            console.error(`Error retrieving parties from table: ${err.message}`);
        }console.log(`Successfully retrieved all parties: ${rows}`)
        response.render('party-registration.ejs', {module: '', positionModel: '', partiesModel: '', parties: rows, LoginedUsername: request.session.username, image: imagePath ? `/uploads/${path.basename(imagePath)}` : null, pageTitle : '', moduleName : 'Contestants'})

    })


});

//Party registration - Post Route
app.post('/party', partyLogo.single('logo'), (request, response) => {
    //insert data into party table
    const {partyName} = request.body;

    let partyLogo;

    if(request.file){
        partyLogo = request.file.path;
    }else{
        console.log('Default logo will be used')
        partyLogo = './uploads/logo/old_logo.png';
    }

    const partyData = `INSERT INTO parties(party, logo) VALUES(?, ?)`;

    const partyDetails = [partyName, partyLogo];
    
    if(!request.file || !request.file.path){
        console.log('Error requesting file');
    }else{
        console.log('File uploaded successfully', request.file)
    }
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
app.get('/position', isAuthenticate, (request, response) => {
    const imagePath = request.session.imagePath;
    
    //Get all election from election table
    const retrievedElectionData = `SELECT election FROM elections`;
    db.all(retrievedElectionData, (err, row) => {
        if(err){
            console.error(`Error retrieving election: ${err.message}`);
        }else{
            console.log('Successfully retrieve data:', row);
            response.render('position.ejs', {module: '', positionModel: '', partiesModel: '', electionType: row, LoginedUsername: request.session.username, image: imagePath ? `/uploads/${path.basename(imagePath)}` : null, pageTitle : '', moduleName : 'Contestants'});
        }
    })

});

//Positon - Post Route
app.post('/position', (request, response) => {

    //Destructure input field value
    const {positionName, election} = request.body;
    console.log(election)
    //Insert all data into position table
    const positionData = `INSERT INTO positions(position, election) VALUES(?,?)`;
    const positionFormData = [positionName, election];

    db.run(positionData, positionFormData, (err) => {
        if(err){
            console.error('Error inserting data into position table:', err.message)
        }else{
            console.log('Successfully added new position!')
            response.redirect('/position');
        }
    })
});

//Election - Get Route
app.get('/election', isAuthenticate, (request, response) => {
    const imagePath = request.session.imagePath;
    response.render('elections.ejs', {module: '', positionModel: '', partiesModel: '', LoginedUsername: request.session.username, image: imagePath ? `/uploads/${path.basename(imagePath)}` : null, pageTitle : '', moduleName : 'Contestants'});
});

//Election - Post Route
app.post('/election', (request, response) => {

    const {electionName} = request.body;
    //data into election table
    const electionData = `INSERT INTO elections(election) VALUES(?)`;
    const electionFormData = [electionName];

    db.run(electionData, electionFormData, (err) => {
        if(err){
            console.error(`Error inserting data into election table: ${err.message}`);
        }else{
            console.log('Data inserted into election table successfully!');
            response.redirect('/election')
        }
    })
});

//Vote list - Get Route
app.get('/vote-list', isAuthenticate, (request, response) => {
    const imagePath = request.session.imagePath;

    //query all role from roles table
    const userRole = `SELECT role FROM roles WHERE role = 'Voter' `;
    db.all(userRole, (err, row) =>{
        if(err){
           return console.error(`Error querying role: ${err.message}`);
        }
            //render the queried data into the registratio form upon http response.
            //Query all registered voters from users table
            const allVoters = `SELECT u.id, u.fname, u.mname, u.lname, u.voted, u.dob, u.photo, a.username FROM user u  JOIN auth a ON u.id = a.user_id WHERE role = 'Voter'`;

            db.all(allVoters, [], (err, voterListing) => {

                if(err){
                    console.error(`Error getting voter list from users table: ${err.message}`)
                }

                for(const voterRole of row){
                    console.log(`Voter role: ${voterRole.role}`)
                };

                // console.log(voterListing);
                response.render('table.ejs', {module: row, positionModel: '', partiesModel: '', totalVoterList: voterListing, LoginedUsername: request.session.username, image: imagePath ? `/uploads/${path.basename(imagePath)}` : null, pageTitle : '', moduleName : 'Voter Listing'});
            });
        })
})

// //Vote list - Post Route
// app.post('/vote-list', (request, response) => {
//     const imagePath = request.session.imagePath;
//     response.redirect('/voter-list', {LoginedUsername: request.session.username, image: imagePath ? `/uploads/${path.basename(imagePath)}` : null, pageTitle : '', moduleName : 'Contestants'});
// });



//users - Get Route
app.get('/users', isAuthenticate, (request, response) => {
    const imagePath = request.session.imagePath;
    response.render('404.ejs', {module: '', positionModel: '', partiesModel: '', LoginedUsername: request.session.username, image: imagePath ? `/uploads/${path.basename(imagePath)}` : null, pageTitle : '', moduleName : 'Contestants'});
})

//user - Post Route
app.post('/users', (request, response) => {
    const imagePath = request.session.imagePath;
    response.render('404.ejs', {LoginedUsername: request.session.username, image: imagePath ? `/uploads/${path.basename(imagePath)}` : null, pageTitle : '', moduleName : 'Contestants'});
});

//Vote - Get route
app.get('/vote', isAuthenticate, (request, response) => {
    const imagePath = request.session.imagePath;
    // const candidateId = request.body.candidate_id;
    const userId = request.session.user_id;
    //Get all candidates from candidates table
    const contestantsData = `SELECT * FROM candidates`;
    db.all(contestantsData, [], (err, result) => {
    
        //Get username and user image from session upon a successful login.
        const username = request.session.username;
        const imagePath = request.session.imagePath;
        if(err){
            //if error
            console.error(err.message);
        }else{
            
            //Get user id from votes table
            const checkUserVoteStatus = `SELECT * FROM votes WHERE user_id = ?`;

            db.get(checkUserVoteStatus, [userId], (err, row) => {
                //Check for error
                if(err){
                    console.error('Error getting user id', err.message);
                    response.status(500).send('Internal server error');
                }

                //If no error, get the result from the table and check if user has voted
                if(row){
                    console.log('user has already voted');
                    return response.render('voted.ejs', {module: '', positionModel: '', partiesModel: '', contestant: result, LoginedUsername: username, image: imagePath ? `/uploads/${path.basename(imagePath)}` : null, pageTitle: 'Dashboard', moduleName: 'Dashboard', message: 'Welcome to Voter dashboard', pageTitle: 'Dashboard'});

                }

                 //Query total number of contestants

                 const totalContestant = `SELECT COUNT(*) AS totalResult FROM candidates`
                 db.get(totalContestant, [], (err, candidateResult) => {
                    if(err){
                        console.error(`Error getting total number of candidate: ${err.message}`);
                    }
                    console.log('Total candidate: ', candidateResult.totalResult)
                    //if no error display candidates information in the user dashboard
                    console.log('All candidates have been displayed');
                    response.render('vote.ejs', {module: '', positionModel: '', partiesModel: '', totalCandidates: candidateResult, contestant: result, LoginedUsername: username, image: imagePath ? `/uploads/${path.basename(imagePath)}` : null, pageTitle: 'Dashboard', moduleName: 'Dashboard', message: 'Welcome to Voter dashboard', pageTitle: 'Dashboard'});
                })
            })}
        
    })
});

//Vote - Post route
app.post('/vote', (request, response) => {

    const {candidate_id} = request.body;
    //Get candidate id and user id
    // const candidateId = request.body.candidate_id;
    const userId = request.session.user_id;

    //Check if there is error in getting user id
    if(!userId){

        console.log(candidate_id);
        console.log('Error getting user id. You must login first')
    }
    
    //Get user id from votes table
    const checkUserVoteStatus = `SELECT * FROM votes WHERE user_id = ?`;

    db.get(checkUserVoteStatus, [userId], (err, row) => {
        //Check for error
        if(err){
            console.error('Error getting user id', err.message);
            response.status(500).send('Internal server error');
        }

        //If no error, get the result from the table and check if user has voted
        if(row){

            console.log('user has already voted');
            return response.render('voted.ejs')
           
        }else{
            console.log('Someone has voted for candidate', candidate_id);
            const voteStatus = 1;
            //Now, update the vote table if there is no vote
            const castUserVote = `INSERT INTO votes(candidate_id, vote, user_id) VALUES(?,?,?)`;
            db.run(castUserVote, [candidate_id, voteStatus, userId], (err) => {
                if(err){
                    console.log('Error casting user vote');
                    return response.status(500).send('Internal server error')

                }else{

                    //Update the voted column of the user table
                    const updateVoted = `UPDATE user SET voted = 'Has Voted' WHERE id = ?`
                    db.run(updateVoted, [userId], (err) => {
                        if(err){
                            console.error(`Problem updated voted column in user table: ${err.message}`);
                        }
                        console.log(candidate_id);
                        console.log(userId);
                        console.log('vote cast successfully')
                        response.redirect('/vote')
                    })
                   
                }
            })
        }

    })
        //If the loggined user has already voted, display has already voted to such user.

});


// Edit Candidate Route (GET)
app.get('/edit-candidate/:id', isAuthenticate, (request, response) => {
    const candidateId = request.params.id;

    // Fetch candidate details by ID to pre-fill the edit form
    const getCandidateQuery = `SELECT * FROM candidates WHERE id = ?`;
    db.get(getCandidateQuery, candidateId, (err, candidate) => {
        if (err) {
            console.error(`Error retrieving candidate with ID ${candidateId}: ${err.message}`);
            return response.status(500).send('Error retrieving candidate.');
        }

        console.log(`Candidate edit data: ${candidate}`)
        response.render('contestants.ejs', {candidate, allCandidate: candidateDetails,
            module: candidateRole,
            positionModel: allPosition,
            partiesModel: allParties,
            LoginedUsername: request.session.username,
            image: imagePath ? `/uploads/${path.basename(imagePath)}` : null,
            pageTitle: '',
            moduleName: 'Contestants'});
    });
});

// Edit Candidate Route (POST)
app.post('/edit-candidate/:id', isAuthenticate, (request, response) => {
    const candidateId = request.params.id;
    const { fName, mName, lName, username, party, position } = request.body;

    const updateCandidateQuery = `
        UPDATE candidates
        SET fname = ?, mname = ?, lname = ?, username = ?, party_id = ?, position_id = ?
        WHERE id = ?
    `;
    const updateValues = [fName, mName, lName, username, party, position, candidateId];

    db.run(updateCandidateQuery, updateValues, (err) => {
        if (err) {
            console.error(`Error updating candidate with ID ${candidateId}: ${err.message}`);
            return response.status(500).send('Error updating candidate.');
        }

        response.redirect('/contestants'); // Redirect back to the contestants list or any other page
    });
});



// Delete Candidate Route (POST)
app.post('/delete-candidate/:id', isAuthenticate, (request, response) => {
    const candidateId = request.params.id;

    const deleteCandidateQuery = `DELETE FROM candidates WHERE id = ?`;

    db.run(deleteCandidateQuery, candidateId, function(err) {
        if (err) {
            console.error(`Error deleting candidate with ID ${candidateId}: ${err.message}`);
            return response.status(500).send('Error deleting candidate.');
        }

        console.log(`Candidate with ID ${candidateId} deleted successfully.`);
        response.redirect('/contestants');
    });
});


// Edit Voter Route (GET)
app.get('/edit-voter/:id', isAuthenticate, (request, response) => {
    const voterId = request.params.id;

    // Fetch voter details by ID to pre-fill the edit form
    const getVoterQuery = `SELECT * FROM voters WHERE id = ?`;
    db.get(getVoterQuery, voterId, (err, voter) => {
        if (err) {
            console.error(`Error retrieving voter with ID ${voterId}: ${err.message}`);
            return response.status(500).send('Error retrieving voter.');
        }

        response.render('/vote-list', { voter });
    });
});

// Edit Voter Route (POST)
app.post('/edit-voter/:id', isAuthenticate, (request, response) => {
    const voterId = request.params.id;
    const { fName, mName, lName, username } = request.body;

    const updateVoterQuery = `UPDATE voters SET fname = ?, mname = ?, lname = ?, username = ? WHERE id = ?`;
    const values = [fName, mName, lName, username, voterId];

    db.run(updateVoterQuery, values, function(err) {
        if (err) {
            console.error(`Error updating voter with ID ${voterId}: ${err.message}`);
            return response.status(500).send('Error updating voter.');
        }

        console.log(`Voter with ID ${voterId} updated successfully.`);
        response.redirect('/vote-list');
    });
});


// Delete Voter Route (POST)
app.post('/delete-voter/:id', isAuthenticate, (request, response) => {
    const voterId = request.params.id;

    const deleteVoterQuery = `DELETE FROM user WHERE id = ?`;

    db.run(deleteVoterQuery, voterId, function(err) {
        if (err) {
            console.error(`Error deleting voter with ID ${voterId}: ${err.message}`);
            return response.status(500).send('Error deleting voter.');
        }

        console.log(`Voter with ID ${voterId} deleted successfully.`);
        response.redirect('/vote-list');
    });
});







//404 route
app.use((request, response, next) => {
    response.status(404).render('error404.ejs', {pageTitle: 404})
}); // use this same method  to display other error messsages changing the error code and pages to be rendered.

//Listen to port
app.listen(port, () =>{
    console.log(`Http response! Status: Listening on port: ${port} (http://localhost:${port})`);
});
