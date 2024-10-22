const express = require('express');
const session = require('express-session');
const app = express();
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const conn = require('./conn.js');

// Middleware setup
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.urlencoded({ extended: true }));

// Session setup
app.use(session({
    secret: 'your-secret-key', // Change this to a secure random string
    resave: false,
    saveUninitialized: true,
    cookie: {secure: false,maxAge: 30 * 60 * 1000}
}));

// Insert event
app.post('/addevent', isAuthenticated, (req, res) => {
    if (!req.session.user || !req.session.user.id) {
        return res.status(401).send("User  not authenticated");
    }

    const userId = req.session.user.id; // Get userId from session
    console.log("Attempting to insert event for userId:", userId); // Debugging output

    const title = req.body.title;
    const description = req.body.description;
    const startDate = req.body.startDate;
    const startTime = req.body.startTime;
    const endTime = req.body.endTime;



    // Check if userId exists in users table (for debugging)
    const checkUser_Sql = `SELECT * FROM users WHERE userId = ?`;
    conn.query(checkUser_Sql, [userId], (err, results) => {
        if (err) {
            console.error("Error checking user:", err);
            return res.status(500).send("Internal Server Error");
        }

        if (results.length === 0) {
            console.error("User  ID does not exist in users table:", userId);
            return res.status(400).send("User  ID does not exist");
        }

        // Proceed with inserting the event
        const sql = `INSERT INTO events (userId, title, description, startDate, startTime, endTime) VALUES ( ?, ?, ?, ?, ?, ?)`;
        conn.query(sql, [userId, title, description, startDate, startTime, endTime], (err, result) => {
            if (err) {
                console.error("Error inserting event:", err);
                return res.status(500).send("Internal Server Error");
            }
            console.log('New Event Inserted');
            res.send(`
                <script>
                    alert("1 Event Successfully Added!");
                    window.location.href="/";
                </script>
            `);
        });
    });
});



// Middleware to attach user to request
app.use((req, res, next) => {
    if (req.session.user) {
        conn.query('SELECT * FROM users WHERE userId = ?', [req.session.user.id], (err, result) => {
            if (err) {
                console.error("Error fetching user:", err);
                return next();
            }
            if (result.length > 0) {
                req.user = result[0];
            }
            next();
        });
    } else {
        next();
    }
});

// Insert note
app.post('/addnote', isAuthenticated, (req, res) => {
    if (!req.session.user || !req.session.user.id) {
        return res.status(401).send("User not authenticated");
    }

    const userId = req.session.user.id; // Get userId from session
    console.log("Attempting to insert note for userId:", userId); // Debugging output

    const noteTitle = req.body.noteTitle;
    const noteDescription = req.body.noteDescription;
    const noteLabel = req.body.noteLabel;
    const dueDate = req.body.dueDate;

    if (!noteTitle || !noteDescription || !noteLabel || !dueDate) {
        return res.status(400).send("All fields are required");
    }

    // Check if userId exists in users table (for debugging)
    const checkUserSql = `SELECT * FROM users WHERE userId = ?`;
    conn.query(checkUserSql, [userId], (err, results) => {
        if (err) {
            console.error("Error checking user:", err);
            return res.status(500).send("Internal Server Error");
        }

        if (results.length === 0) {
            console.error("User ID does not exist in users table:", userId);
            return res.status(400).send("User ID does not exist");
        }

        // Proceed with inserting the note
        const sql = `INSERT INTO notes (userId, noteTitle, noteDescription, noteLabel, dueDate) VALUES (?, ?, ?, ?, ?)`;
        
        conn.query(sql, [userId, noteTitle, noteDescription, noteLabel, dueDate], (err, result) => {
            if (err) {
                console.error("Error inserting note:", err);
                return res.status(500).send("Internal Server Error");
            }
            console.log('New Note Inserted');
            res.send(`
                <script>
                    alert("1 Note Successfully Added!");
                    window.location.href="/";
                </script>
            `);
        });
    });
});

// Display dashboard events and notes
// Display dashboard events and notes// Display dashboard events and notes
app.get('/', isAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const getEvents = `SELECT * FROM events WHERE userId = ?`;
    const getNotes = `SELECT * FROM notes WHERE userId = ?`;
    const dates = `SELECT startDate FROM events WHERE userId = ?`;
    const time = `SELECT startTime, endTime FROM events WHERE userId = ?`;

    conn.query(getEvents, [userId], (err, eventData) => {
        if (err) {
            console.error("Error fetching events:", err);
            return res.status(500).send("Internal Server Error");
        }

        conn.query(getNotes, [userId], (err, mydata) => {
            if (err) {
                console.error("Error fetching notes:", err);
                return res.status(500).send("Internal Server Error");
            }

            conn.query(dates, [userId], (err, dateRows) => {
                if (err) {
                    console.error("Error fetching dates:", err);
                    return res.status(500).send("Internal Server Error");
                }

                conn.query(time, [userId], (err, timedata) => {
                    if (err) {
                        console.error("Error fetching time data:", err);
                        return res.status(500).send("Internal Server Error");
                    }

                    // Calculate minutes for each event
                    const getMinutesDifference = (startTime, endTime) => {
                        const startParts = startTime.split(':').map(Number);
                        const endParts = endTime.split(':').map(Number);

                        const startDate = new Date();
                        startDate.setHours(startParts[0], startParts[1], startParts[2]);

                        const endDate = new Date();
                        endDate.setHours(endParts[0], endParts[1], endParts[2]);

                        // If end time is earlier than start time, assume it is the next day
                        if (endDate < startDate) {
                            endDate.setDate(endDate.getDate() + 1);
                        }

                        const differenceInMillis = endDate - startDate;
                        return Math.floor(differenceInMillis / (1000 * 60)); // Convert to minutes
                    };

                    // Calculate minutes for each event in the timedata
                    const minutesData = timedata.map(item => {
                        return getMinutesDifference(item.startTime, item.endTime);
                    });

                    // Format the fetched dates
                    const formattedDates = dateRows.map(row => {
                        const date = new Date(row.startDate);
                        // Check if the date is valid
                        if (date instanceof Date && !isNaN(date)) {
                            return date.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
                        } else {
                            console.error("Invalid date:", row.startDate);
                            return null; // or handle invalid date as needed
                        }
                    }).filter(date => date !== null);
                
                    // Fetched Dates
                    const fetchedDates = formattedDates;

                    // Create the formatted data array
                    const formattedData = [['Date', 'Minutes']].concat(
                        fetchedDates.map((date, index) => [date, minutesData[index]])
                    );

                    // Output the formatted data
                    console.log(formattedData);
                    const formatdata = formattedData;

                    // Render the dashboard with the calculated data
                    res.render('index.ejs', {
                        title: "PlanITSmart",
                        action: 'list',
                        events: eventData,
                        sampledata: mydata,
                        userName: req.session.user.name,
                        user: req.user,
                        formattedData: formatdata
                    });
                });
            });
        });
    });
});
  
  

//  charts
app.get('/charts', isAuthenticated, (req, res) => {
    // Check if userId exists in users table (for debugging)
    const checkUser_Sql = `SELECT * FROM users WHERE userId = ?`;
    const userId = req.session.user.id;
    conn.query(checkUser_Sql, [userId], (err, userName) => {
        if (err) {
            console.error("Error checking user:", err);
            return res.status(500).send("Internal Server Error");
        }
    res.render('chart.ejs', {
        title: "Charts",
        userName: req.session.user.name,
        sample2: userName
    });
});// This will render anotherFile.ejs
});


// Route to handle profile update
app.post('/updateprofile', isAuthenticated, async (req, res) => {
    const { name, email, password, confirmPassword } = req.body;
    const userId = req.session.user.id;

    // Start with basic validation
    if (password !== confirmPassword) {
        return res.status(400).send("Passwords do not match");
    }

    try {
        let updateFields = { name, email };
        let updateQuery = 'UPDATE users SET ? WHERE userId = ?';

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateFields.password = hashedPassword;
        }

        conn.query(updateQuery, [updateFields, userId], (err, result) => {
            if (err) {
                console.error("Error updating user:", err);
                return res.status(500).send("Failed to update profile");
            }

            req.session.user = { ...req.session.user, ...updateFields };
            res.redirect('/'); // Redirect back to the index page
        });
    } catch (err) {
        console.error("Error updating user:", err);
        res.status(500).send("Failed to update profile");
    }
});






// Display notes
app.get('/noteoptions', (req, res) => {
    const userId = req.session.user.id;
    const getNotes = `SELECT * FROM notes WHERE userId = ?`;

    conn.query(getNotes, [userId], (err, mydata) => {
        if (err) throw err;

        console.log("Data Displayed Successfully!");
        res.render('noteoptions', {
            title: "PlanITSmart",
            action: 'list',
            sampledata: mydata,
            userName: req.session.user.name
        });
    });
});

//display events
app.get('/eventoptions', isAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const getEvents = `SELECT * FROM events WHERE userId = ?`;

    conn.query(getEvents, [userId], (err, mydata) => {
        if (err) throw err;
            console.log("Data Displayed Successfully!");
            res.render('eventoptions', {
                title: "PlanITSmart",
                action: 'list',
                sampledata: mydata,
                userName: req.session.user.name
            });
        });
});



// Insert event
// Insert event
app.post('/addevent', isAuthenticated, (req, res) => {
    // Check if the user is authenticated and retrieve userId from session
    if (!req.session.user || !req.session.user.id) {
        return res.status(401).send("User  not authenticated");
    }

    const userId = req.session.user.id; // Get userId from session
    const title = req.body.title;
    const description = req.body.description;
    const startDate = req.body.startDate;
    const startTime = req.body.startTime;
    const endTime = req.body.endTime;

    // SQL query to insert the event
    const sql = `INSERT INTO events (userId, title, description, startDate, startTime, endTime) VALUES (?, ?, ?, ?, ?, ?)`;
    
    // Execute the query
    conn.query(sql, [userId, title, description, startDate, startTime, endTime], (err, result) => {
        if (err) {
            console.error("Error inserting event:", err);
            return res.status(500).send("Internal Server Error");
        }
        console.log('New Event Inserted');
        res.send(`
            <script>
                alert("1 Event Successfully Added!");
                window.location.href="/"; // Redirect to home or another page
            </script>
        `);
    });
});

// Insert note
app.post('/addnote', isAuthenticated, (req, res) => {
    const userId = req.session.user.id; // Get userId from session
    const noteTitle = req.body.noteTitle;
    const noteDescription = req.body.noteDescription;
    const noteLabel = req.body.noteLabel;
    const dueDate = req.body.dueDate;
    const reminder =req.body.reminder;

    const sql = `INSERT INTO notes (userId, noteTitle, noteDescription, noteLabel, dueDate,reminder) VALUES (?, ?, ?, ?, ?, ?)`;
    
    conn.query(sql, [userId, noteTitle, noteDescription, noteLabel, dueDate], (err, result) => {
        if (err) {
            console.error("Error inserting note:", err);
            return res.status(500).send("Internal Server Error");
        }
        console.log('New Note Inserted');
        res.send(`
            <script>
                alert("1 Note Successfully Added!");
                window.location.href="/";
            </script>
        `);
    });
});

// Update notes
app.post('/noteoptions/updatenotes/:id', isAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const upd_id = req.params.id;
    const noteTitle = req.body.noteTitle;
    const noteDescription = req.body.noteDescription;
    const noteLabel = req.body.noteLabel;
    const dueDate = req.body.dueDate;

    const toUpdate = `UPDATE notes SET noteTitle=?, noteDescription=?, noteLabel=?, dueDate=? WHERE id = ? AND userId = ?`;
    conn.query(toUpdate, [noteTitle, noteDescription, noteLabel, dueDate, upd_id, userId], (err, result) => {
        if (err) {
            console.error("Error updating note:", err);
            return res.status(500).send("Internal Server Error");
        }
        console.log('Note Updated Successfully');
        res.send(`
            <script>
                alert("Note Updated Successfully!");
                window.location.href="/noteoptions";
            </script>
        `);
    });
});

// Update events
app.post('/eventoptions/updateevents/:id', isAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const upd_id = req.params.id;
    const title = req.body.title;
    const description = req.body.description;
    const startDate = req.body.startDate;
    const startTime = req.body.startTime;
    const endTime = req.body.endTime;

    const toUpdate = `UPDATE events SET title=?, description=?, startDate=?, startTime=?, endTime=? WHERE id = ? AND userId = ?`;
    conn.query(toUpdate, [title, description, startDate, startTime, endTime, upd_id, userId], (err, result) => {
        if (err) {
            console.error("Error updating event:", err);
            return res.status(500 ).send("Internal Server Error");
        }
        console.log('Event Updated Successfully');
        res.send(`
            <script>
                alert("Event Updated Successfully!");
                window.location.href="/eventoptions";
            </script>
        `);
    });
});

// Delete notes
app.get('/noteoptions/deletenotes/:id', isAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const del_id = req.params.id;

    const toDelete = `DELETE FROM notes WHERE id = ? AND userId = ?`;
    conn.query(toDelete, [del_id, userId], (err, result) => {
        if (err) {
            console.error("Error deleting note:", err);
            return res.status(500).send("Internal Server Error");
        }
        console.log('Note Deleted Successfully');
        res.send(`
            <script>
                alert("Note Deleted Successfully!");
                window.location.href="/noteoptions";
            </script>
        `);
    });
});

// Delete events
app.get('/eventoptions/deleteevents/:id', isAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const del_id = req.params.id;

    const toDelete = `DELETE FROM events WHERE id = ? AND userId = ?`;
    conn.query(toDelete, [del_id, userId], (err, result) => {
        if (err) {
            console.error("Error deleting event:", err);
            return res.status(500).send("Internal Server Error");
        }
        console.log('Event Deleted Successfully');
        res.send(`
            <script>
                alert("Event Deleted Successfully!");
                window.location.href="/eventoptions";
            </script>
        `);
    });
});
app.get('/login', (req, res) => {
    res.render('login'); // This will render anotherFile.ejs
});

app.get('/register',(req, res)=>{
    res.render('register.ejs');
});


app.get('/updateprofile',(req, res)=>{
    res.render('manageprofile');
});


app.post('/signup', async (req, res) => {
    const signup_name = req.body.signup_name;
    const signup_email = req.body.signup_email;
    const signup_password = req.body.signup_password;

    try {
        // Hash the password before storing it
        const hashedPassword = await bcrypt.hash(signup_password, 10);

        // Prepare the insert query
        const insert_user = `INSERT INTO users (name, email, pass) VALUES (?, ?, ?)`;

        // Execute the query
        conn.query(insert_user, [signup_name, signup_email, hashedPassword], (err, result) => {
            if (err) {
                console.error("Error inserting data:", err);
                return res.status(500).send("Internal Server Error");
            }
            console.log('Registered Successfully!');
            res.send(`
                <script>
                    alert("Registered Successfully. Congrats!");
                    window.location.href="/login"; // Redirect to login page
                </script>
            `);
        });
    } catch (error) {
        console.error("Error hashing password:", error);
        return res.status(500).send("Internal Server Error");
    }
});

// Login route
app.post('/login', (req, res) => {
    const login_email = req.body.login_email;
    const login_password = req.body.login_password;

    const get_login = `SELECT * FROM users WHERE email = ?`;

    conn.query(get_login, [login_email], async (err, result) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).send("Internal Server Error");
        }

        if (result.length > 0) {
            const user = result[0];
            const isPasswordValid = await bcrypt.compare(login_password, user.pass);

            if (isPasswordValid) {
                // Store user name in session
                req.session.user = { id: user.userId, name: user.name }; // Ensure this is done after successful login 
                console.log("Login Successfully");
                res.send(`
                    <script>
                        alert("Login Successfully!");
                        window.location.href = "/";
                    </script>
                `);
            } else {
                res.send(`
                    <script>
                        alert("Wrong username or password!");
                        window.location.href = "/login"; // Redirect back to login
                    </script>
                `);
            }
        } else {
            res.send(`
                <script>
                    alert("Wrong username or password!");
                    window.location.href = "/login"; // Redirect back to login
                </script>
            `);
        }
    });
});


// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        next(); // User is authenticated
    } else {
        res.redirect('/login'); // Redirect to login page if not authenticated
    }
}

// Start the server
app.listen(3000, (req, res) => {
    console.log("listening at port 3000...");
});