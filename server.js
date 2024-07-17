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

app.use(express.static(path.join(__dirname, 'views')));
app.set('views engine', 'ejs');

const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database('./election.db')

db.serialize(() => {

    db.run( `CREATE TABLE IF NOT EXISTS auth (id INT AUTO_INCREMENT PRIMARY KEY,username VARCHAR(50) NOT NULL,user_Id INT NOT NULL);`);

    db.run(`CREATE TABLE IF NOT EXISTS candidates(id  INT AUTO_INCREMENT PRIMARY KEY,fname VARCHAR(50) NOT NULL,mname VARCHAR(50) NULL,lname VARCHAR(50) NOT NULL,position_id VARCHAR(50) NOT NULL,party_id    VARCHAR(50) NOT NULL,photo BLOB NOT NULL);`);
        

    db.run(`CREATE TABLE IF NOT EXISTS parties(id INT AUTO_INCREMENT PRIMARY KEY,party VARCHAR(50) NOT NULL,logo BLOB NOT NULL);`);

    db.run(`CREATE TABLE IF NOT EXISTS roles(user_Id INT AUTO_INCREMENT PRIMARY KEY,role VARCHAR(50) NOT NULL);`);

    db.run(`CREATE TABLE IF NOT EXISTS user(id  INT  AUTO_INCREMENT PRIMARY KEY,fname VARCHAR(50) NOT NULL,mname   VARCHAR(50) NULL,lname VARCHAR(50) NOT NULL,dob DATE    NOT NULL,role_id INT NOT NULL,photo BLOG NOT NULL)`);
    
//   db.run('CREATE TABLE lorem (info TEXT)')
//   const stmt = db.prepare('INSERT INTO lorem VALUES (?)')

//   for (let i = 0; i < 10; i++) {
//     stmt.run(`Ipsum ${i}`)
//   }

//   stmt.finalize()

  db.each('SELECT * FROM auth', (err, row) => {
    console.log(row)
  })
})

db.close()



// Login - Get route
app.get('/login', (request, response) => {
    response.render('login.ejs');
})

// Login - Post route
app.post('/login', (request, response) => {
    response.redirect('/dashboard');
})

// Dashboard - get route
app.get('/dashboard', (request, response) => {
    response.render('dashboard.ejs')
})

//Listen to port
app.listen(port, () =>{
    console.log(`Http response! Status: Listening on port: ${port}`);
})







