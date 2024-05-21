const express = require('express');
const expressHandlebars = require('express-handlebars');
const session = require('express-session');
const canvas = require('canvas');
const { createCanvas } = require('canvas');


//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Configuration and Setup
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

const app = express();
const PORT = 3000;

/*
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    Handlebars Helpers

    Handlebars helpers are custom functions that can be used within the templates 
    to perform specific tasks. They enhance the functionality of templates and 
    help simplify data manipulation directly within the view files.

    In this project, two helpers are provided:
    
    1. toLowerCase:
       - Converts a given string to lowercase.
       - Usage example: {{toLowerCase 'SAMPLE STRING'}} -> 'sample string'

    2. ifCond:
       - Compares two values for equality and returns a block of content based on 
         the comparison result.
       - Usage example: 
            {{#ifCond value1 value2}}
                <!-- Content if value1 equals value2 -->
            {{else}}
                <!-- Content if value1 does not equal value2 -->
            {{/ifCond}}
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/

// Set up Handlebars view engine with custom helpers
//
app.engine(
    'handlebars',
    expressHandlebars.engine({
        helpers: {
            toLowerCase: function (str) {
                return str.toLowerCase();
            },
            ifCond: function (v1, v2, options) {
                if (v1 === v2) {
                    return options.fn(this);
                }
                return options.inverse(this);
            },
        },
    })
);

app.set('view engine', 'handlebars');
app.set('views', './views');

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Middleware
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

app.use(
    session({
        secret: 'oneringtorulethemall',     // Secret key to sign the session ID cookie
        resave: false,                      // Don't save session if unmodified
        saveUninitialized: false,           // Don't create session until something stored
        cookie: { secure: false },          // True if using https. Set to false for development without https
    })
);

// Replace any of these variables below with constants for your application. These variables
// should be used in your template files. 
// 
app.use((req, res, next) => {
    res.locals.appName = 'Hiking Trail Blog';
    res.locals.copyrightYear = 2024;
    res.locals.postNeoType = 'Post';
    res.locals.loggedIn = req.session.loggedIn || false;
    res.locals.userId = req.session.userId || '';
    next();
});

app.use(express.static('public'));                  // Serve static files
app.use(express.urlencoded({ extended: true }));    // Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.json());                            // Parse JSON bodies (as sent by API clients)

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Routes
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Home route: render home view with posts and user
// We pass the posts and user variables into the home
// template
//
app.get('/', (req, res) => {
    const posts = getPosts();
    const user = getCurrentUser(req) || {};

    //console.log(posts.length);

    res.render('home', { posts, user});
});

// Register GET route is used for error response from registration
//
app.get('/register', (req, res) => {
    res.render('loginRegister', { regError: req.query.error });
});

// Login route GET route is used for error response from login
//
app.get('/login', (req, res) => {
    res.render('loginRegister', { loginError: req.query.error });
});

// Error route: render error page
//
app.get('/error', (req, res) => {
    res.render('error');
});

// Additional routes that you must implement


app.get('/post/:id', (req, res) => {
    // TODO: Render post detail page

});
app.post('/posts', (req, res) => {
    console.log(req.session.userId);
    addPost(req.body.title, req.body.content, getCurrentUser(req));
    res.redirect('/');
});
app.post('/like/:id', (req, res) => {
    // TODO: Update post likes
});
app.get('/profile', isAuthenticated, (req, res) => {
    // TODO: Render profile page
});

//Will generate each time the page is refreshed 
//Should be presistant not sure how to impelement right now
app.get('/avatar/:username', (req, res) => {

    console.log("User requesting avatar: " + req.params.username);

    const avatar = handleAvatar(req,res);

    res.setHeader('Content-Type', 'image/png');
    res.send(avatar);
});

//Register post route to add user name to registered user name list
//
app.post('/register', (req, res) => {
    if(!findUserByUsername(req.body.userName)){
        registerUser(req, res);
        res.redirect('/register'); //Return to login/reg page, user has been added
    }
    else{
        res.redirect('/register?error=Already%20Registered'); //Return to log/reg page with error
    }
});

app.post('/login', (req, res) => {
    if(findUserByUsername(req.body.userName)){
        loginUser(req, res);
        res.redirect('/');
    }
    else{
        res.redirect('/login?error=Not%20Found');
    }
});
app.get('/logout', (req, res) => {
    logoutUser(req,res);
    res.redirect('/');
});
app.post('/delete/:id', isAuthenticated, (req, res) => {
    // TODO: Delete a post if the current user is the owner
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Server Activation
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Support Functions and Variables
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Example data for posts and users
let posts = [
    { id: 1, title: 'Sample Post', content: 'This is a sample post.', username: 'SampleUser', timestamp: '2024-01-01 10:00', likes: 0 },
    { id: 2, title: 'Another Post', content: 'This is another sample post.', username: 'AnotherUser', timestamp: '2024-01-02 12:00', likes: 0 },
];

const test1 = generateAvatar('S');
const test2 = generateAvatar('A');
let users = [
    { id: 1, username: 'SampleUser', avatar_url: test1, memberSince: '2024-01-01 08:00' },
    { id: 2, username: 'AnotherUser', avatar_url: test2, memberSince: '2024-01-02 09:00' },
];

// Function to find a user by username
function findUserByUsername(username) {
    for(let user of users){
        if(user.username === username){
            return user;
        }
    }
    return false;
}

// Function to find a user by user ID
function findUserById(userId) {
    for(let user of users){
        if(user.id === userId){
            return user;
        }
    }
    return false;
}

// Function to add a new user
function addUser(username) {
    tempUser = {
        id: users[users.length-1].id+1, 
        username: username, 
        avatar_url: generateAvatar(getFirstLetter(username)), 
        memberSince: new Date()
    };
    users.push(tempUser);
}

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    console.log(req.session.userId);
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Function to register a user
function registerUser(req, res) {
    addUser(req.body.userName);
}

// Function to login a user
function loginUser(req, res) {
    const user = findUserByUsername(req.body.userName);
    req.session.userId = user.id;
    req.session.loggedIn = true;
    req.session.username = user.username;
    req.session.avatar_url = user.avatar_url;
    //req.session.memberSince = user.memberSince;
}

// Function to logout a user
function logoutUser(req, res) {
    req.session.userId = undefined;
    req.session.loggedIn = false;
    req.session.username = undefined;
    req.session.avatar_url =  undefined;
    //req.session.memberSince = user.memberSince;
}

// Function to render the profile page
function renderProfile(req, res) {
    // TODO: Fetch user posts and render the profile page
}

// Function to update post likes
function updatePostLikes(req, res) {
    // TODO: Increment post likes if conditions are met
}

//Function to find the first letter of a username
function getFirstLetter(username){
    const letters = username.match(/[a-zA-z]/) //Array of letters matching regExp

    if(letters){
        return letters[0];
    }
    else{
        return 'A'; //Default if username contains no letters
    }
}

// Function to handle avatar generation and serving
// Function to handle avatar generation and serving
function handleAvatar(req, res) {
    if(findUserByUsername(req.params.username).avatar_url === undefined){
        findUserByUsername(req.params.username).avatar_url = generateAvatar(getFirstLetter(req.session.username));
        return findUserByUsername(req.params.username).avatar_url;
    }
    else{
        return findUserByUsername(req.params.username).avatar_url;
    }
}


// Function to get the current user from session
function getCurrentUser(req) {
    return findUserById(req.session.userId);
}

// Function to get all posts, sorted by latest first
function getPosts() {
    return posts.slice().reverse();
}

// Function to add a new post
function addPost(title, content, user) {
    console.log("USER POSTING: "+user.username);

    const date = new Date();

    const day = date.getDay();
    const month = date.getMonth();
    const year = date.getFullYear();

    const hour = date.getHours();
    const minutes = date.getMinutes();

    const fullDate = year+'-'+month+'-'+day+'  '+hour+':'+minutes;

    const tempPost = {
        id: user.id,
        title: title,
        content: content,
        username: user.username,
        timestamp: fullDate,
        likes: 0
    };
    posts.push(tempPost);
}

// Function to generate an image avatar
function generateAvatar(letter, width = 100, height = 100) {
    const colorScheme = ["#4369D9", "#C2E0F2", "#95A617", "#D9C355", "#BFAB6F"];

    if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) {
        throw new Error('Invalid width or height values');
    }

    //generate canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    //background
    ctx.fillStyle = colorScheme[Math.floor(Math.random() * 5)];
    roundedRect(ctx, 0, 0, width, height, 10);
    ctx.fill();

    //text
    ctx.fillStyle = '#000000';
    ctx.font = `${Math.min(width, height) * 0.6}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter.toUpperCase(), width / 2, height / 2);

    //Return the avatar as a PNG buffer
    return canvas.toBuffer('image/png');
}

//Source: https://www.youtube.com/watch?v=nVal6k08pQY
// Function to draw a rounded rectangle
function roundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
}