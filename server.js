// Create three routs:
    // Login - Get route
    // Login - Post route
    // Dashboard route

const express = require('express');
const path = require('path');
const app = express();
const port = 5000;

app.use(express.static(path.join(__dirname, 'views')));
app.set('views engine', 'ejs');

app.get('/', (request, response) => {
    // response.send('<h2> Hello there! I am learning NodeJs at ODC. </h2>')
    // response.sendFile(path.join(__dirname, 'public', 'login.ejs'));
    response.render('login.ejs');
})

app.post('/login', (request, response) => {
    response.redirect('dashboard.ejs');
})

app.get('/dashboard', (request, response) => {
    // response.sendFile(path.join(__dirname, 'public', 'dashboard.ejs'));
    response.render('login.ejs')
})

app.listen(port, () => {
    console.log(`Http response! Status: Listening on port ${port}`);
})


