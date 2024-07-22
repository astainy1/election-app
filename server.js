// Create a server that will listen to a port 
// Create three routs:
    // Login - Get route
    // Login - Post route
    // Dashboard - Get route
// Use ejs as your file engine

const express = require('express');
const path = require('path');
const port = 5000;
const app = express();
const body = require('body-parser');

app.use(express.static(path.join(__dirname, 'views')));
app.set('views engine', 'ejs');

app.use(express.static(path.join(__dirname, 'public')));
app.get('/public', express.static('public'))

const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database('./election.db')

let userInfo = []
db.serialize(() => {

    db.run( `CREATE TABLE IF NOT EXISTS auth (id INT AUTO_INCREMENT PRIMARY KEY,username VARCHAR(50) NOT NULL,user_Id INT NOT NULL);`);

    db.run(`CREATE TABLE IF NOT EXISTS candidates(id  INT AUTO_INCREMENT PRIMARY KEY,fname VARCHAR(50) NOT NULL,mname VARCHAR(50) NULL,lname VARCHAR(50) NOT NULL,position_id VARCHAR(50) NOT NULL,party_id    VARCHAR(50) NOT NULL,photo BLOB NOT NULL);`);
        

    db.run(`CREATE TABLE IF NOT EXISTS parties(id INT AUTO_INCREMENT PRIMARY KEY,party VARCHAR(50) NOT NULL,logo BLOB NOT NULL);`);

    db.run(`CREATE TABLE IF NOT EXISTS roles(user_Id INT AUTO_INCREMENT PRIMARY KEY,role VARCHAR(50) NOT NULL);`);

    db.run(`CREATE TABLE IF NOT EXISTS user(id  INT  AUTO_INCREMENT PRIMARY KEY,fname VARCHAR(50) NOT NULL,mname VARCHAR(50) NULL,lname VARCHAR(50) NOT NULL,dob DATE NOT NULL,photo BLOG NOT NULL)`);
    
//   db.run('CREATE TABLE lorem (info TEXT)')
//   const stmt = db.prepare('INSERT INTO lorem VALUES (?)')

//   for (let i = 0; i < 10; i++) {
//     stmt.run(`Ipsum ${i}`)
//   }

//   stmt.finalize()


  db.each('SELECT * FROM user', (err, row) => {
    console.log(row)
  })
})

// db.close()


app.use(body.urlencoded({extended: true}));
//Registration - Get route
app.get('/register', (request, response) => {

    response.render('voter-registration.ejs');
});

//Registration - Post route
app.post('/', (request, response) => {
    //Create a destructuring
    const {fName, mName, lName, dob, photo} = request.body;
    //Insert user information into user table
    const userInfo = 'INSERT INTO  user(fname,mname,lname,dob,photo) VALUES(?,?,?,?,?)';
    const userPersonData = [fName, mName, lName, dob, photo];
    db.run(userInfo, userPersonData, (err) => {
        if(err){
            console.error(err.message);
        }

        console.log(`New row inserted ${this.changes}`)
    });



    response.redirect('/');
});

// Login - Get route
app.get('/', (request, response) => {
    response.render('login.ejs');
});

// Login - Post route
app.post('/dashboard', (request, response) => {
    const {username, password} = request.body;

    const userData ={
        username,
        password
    }
    response.redirect('/dashboard');
});

// Dashboard - get route
app.get('/dashboard', (request, response) => {
    response.render('dashboard.ejs')
});


//Listen to port
app.listen(port, () =>{
    console.log(`Http response! Status: Listening on port: ${port}`);
});







