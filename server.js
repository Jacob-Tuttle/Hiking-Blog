const express = require('express');
const expressHandlebars = require('express-handlebars');
const session = require('express-session');
const canvas = require('canvas');
const { createCanvas } = require('canvas');
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');


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
app.get('/', async (req, res) => {
    const posts = await getPosts();
    const user = getCurrentUser(req) || {};

    console.log("POST LENGTH: ", posts.length);
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

app.post('/posts', (req, res) => {
    addPost(req.body.title, req.body.content, getCurrentUser(req));
    res.redirect('/');
});
app.post('/like/:id', (req, res) => {
    if(req.session.username !== undefined){
        updatePostLikes(req,res);
    }
    res.redirect('/');
});
app.get('/profile', isAuthenticated, (req, res) => {
    // TODO: Render profile page
    const user = getCurrentUser(req);
    const posts = renderProfile(req, res)
    res.render('profile', {posts, user})
});


//Reuturns a user avatar based on a username
//
app.get('/avatar/:username', async (req, res) => {
    const avatar = await handleAvatar(req,res);
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

//Sets session variables and redirects to homepage
//
app.post('/login', (req, res) => {
    if(findUserByUsername(req.body.userName)){
        loginUser(req, res);
        res.redirect('/');
    }
    else{
        res.redirect('/login?error=Not%20Found');
    }
});
//Clears session variables and redirects to homepage
//
app.get('/logout', (req, res) => {
    logoutUser(req,res);
    res.redirect('/');
});

//Deletes a post based on a post id
//
app.post('/delete/:id', isAuthenticated, (req, res) => {
    deletePost(req,res);
    res.redirect('/');
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Server Activation
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//Initlize DB
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

const dbFileName = 'websiteData.db';

async function initializeDB() {
    const db = await sqlite.open({ filename: dbFileName, driver: sqlite3.Database });

    // Check if users and posts tables exist
    const usersTableExists = await db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='users';`);
    const postsTableExists = await db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='posts';`);

    if (usersTableExists && postsTableExists) {
        console.log('Database tables already exist. Skipping initialization.');
        await db.close();
        return;
    }

    // If tables don't exist, initialize them and populate with sample data
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            hashedGoogleId TEXT NOT NULL UNIQUE,
            avatar_url TEXT,
            memberSince DATETIME NOT NULL
        );

        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            username TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            likes INTEGER NOT NULL
        );
    `);

    const test1 = generateAvatar('S');
    const test2 = generateAvatar('A');
    // Sample data - Replace these arrays with your own data
    const users = [
        { username: 'user1', hashedGoogleId: 'hashedGoogleId1', avatar_url: test1, memberSince: '2024-01-01 12:00:00' },
        { username: 'user2', hashedGoogleId: 'hashedGoogleId2', avatar_url: test2, memberSince: '2024-01-02 12:00:00' }
    ];

    const posts = [
        { title: 'First Post', content: 'This is the first post', username: 'user1', timestamp: '2024-01-01 12:30:00', likes: 0 },
        { title: 'Second Post', content: 'This is the second post', username: 'user2', timestamp: '2024-01-02 12:30:00', likes: 0 }
    ];

    // Insert sample data into the database
    await Promise.all(users.map(user => {
        return db.run(
            'INSERT INTO users (username, hashedGoogleId, avatar_url, memberSince) VALUES (?, ?, ?, ?)',
            [user.username, user.hashedGoogleId, user.avatar_url, user.memberSince]
        );
    }));

    await Promise.all(posts.map(post => {
        return db.run(
            'INSERT INTO posts (title, content, username, timestamp, likes) VALUES (?, ?, ?, ?, ?)',
            [post.title, post.content, post.username, post.timestamp, post.likes]
        );
    }));

    console.log('Database initialized with sample data.');
    await db.close();
}

initializeDB().catch(err => {
    console.error('Error initializing database:', err);
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Support Functions and Variables
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

const test1 = generateAvatar('S');
const test2 = generateAvatar('A');
let users = [
    { id: 1, username: 'SampleUser', avatar_url: test1, memberSince: '2024-01-01 08:00' },
    { id: 2, username: 'AnotherUser', avatar_url: test2, memberSince: '2024-01-02 09:00' },
];

// Function to find a user by username

async function findUserByUsername(username) {
    try {
        const db = await sqlite.open({ filename: dbFileName, driver: sqlite3.Database });

        console.log('Opening database file:', dbFileName);

        // Check if the users table exists
        const usersTableExists = await db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='users';`);
        if (!usersTableExists) {
            console.log('Users table does not exist.');
            await db.close();
            return false;
        }

        const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
        await db.close();

        if (user) {
            console.log('User found:', user.username);
            return user;
        } else {
            console.log('User not found.');
            return false;
        }
    } catch (error) {
        console.error('Error finding user:', error);
        return false;
    }
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

//get the current date and format it
function getDate(){
    const date = new Date();

    const day = date.getDay();
    const month = date.getMonth();
    const year = date.getFullYear();

    const hour = date.getHours();
    const minutes = date.getMinutes();

    return year+'-'+month+'-'+day+'  '+hour+':'+minutes;
}

// Function to add a new user
function addUser(username) {
    tempUser = {
        id: users[users.length-1].id+1, 
        username: username, 
        avatar_url: generateAvatar(getFirstLetter(username)), 
        memberSince: getDate(),
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
    req.session.memberSince = user.memberSince;
}

// Function to logout a user
function logoutUser(req, res) {
    req.session.userId = undefined;
    req.session.loggedIn = false;
    req.session.username = undefined;
    req.session.avatar_url =  undefined;
    req.session.memberSince = undefined;
}

// Function to render the profile page
function renderProfile(req, res) {
    let filteredPosts = [];
    for(let post of posts){
        if(post.username === req.session.username){
            filteredPosts.push(post);
        }
    }
    return filteredPosts;
}

// Function to update post likes
function updatePostLikes(req, res) {
    for(let post of posts){
        if(String(post.id) === req.params.id){
            post.likes += 1;
            return;
        }
    }
    return;
}

//Function to find the first letter of a username
function getFirstLetter(username){

    console.log("FIRST LETTER: ", username);    
    const letters = username.match(/[a-zA-z]/) //Array of letters matching regExp

    if(letters){
        return letters[0];
    }
    else{
        return 'A'; //Default if username contains no letters
    }
}

// Function to handle avatar generation and serving
async function handleAvatar(req, res) {
    let user = await findUserByUsername(req.params.username);
    if (user) {
        console.log(user.username);
        if (user.avatar_url === undefined) {
            user.avatar_url = generateAvatar(getFirstLetter(req.session.username));
            return user.avatar_url;
        } else {
            return user.avatar_url;
        }
    } else {
        // Handle case where user is not found
        console.log("User not found");
        return null;
    }
}

// Function to get the current user from session
function getCurrentUser(req) {
    return findUserById(req.session.userId);
}

// Function to get all posts, sorted by latest first

//will need to fetch from db and then build a array to return

async function getPosts() {
    const db = await sqlite.open({ filename: dbFileName, driver: sqlite3.Database });

    console.log('Opening database file:', dbFileName);

    let userPosts  = [];

    const postsTableExists = await db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='posts';`);
    if (postsTableExists) {
        console.log('Posts table exists.');
        const posts = await db.all('SELECT * FROM posts');
        if (posts.length > 0) {
            posts.forEach(post => {
                userPosts.push(post);
            });
        } else {
            console.log('No posts found.');
        }
    } else {
        console.log('Posts table does not exist.');
    }

    await db.close();
    console.log("Posts: ");
    for(let post of userPosts){
        console.log(post);
    }

    return userPosts;
}

// Function to add a new post
function addPost(title, content, user) {
    let ID;
    if(posts.length === 0){
        ID = 1;
    }
    else{
        ID = posts[posts.length-1].id+1;
    }
    const tempPost = {
        id: ID,
        title: title,
        content: content,
        username: user.username,
        timestamp: getDate(),
        likes: 0
    };
    posts.push(tempPost);
}

//Function to delete a post
function deletePost(req,res){
    if(verifyOwner(req)){
        let index = -1;
        for(let x = 0; x<posts.length; x++){
            if(req.params.id === String(posts[x].id)){
                index = x;
                break;
            }
        }
        posts.splice(index,1);
    }
}

//Verify that post from the requested id has 
//matching username with the currently logged in user
function verifyOwner(req){
    for(let post of posts){
        if(String(post.id) === req.params.id){
            if(post.username === req.session.username)
                return true;
        }
    }
    return false;
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