require("dotenv").config();
const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
const bodyParser = require('body-parser');
const connectDB = require('./config/db');
const User = require('./models/User');
const Hotel = require('./models/Hotel');
const Room = require('./models/Room');
const Booking = require('./models/Booking');

const app = express();
connectDB(); 

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
const MongoStore = require('connect-mongo');
const { error } = require("console");

app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({ mongoUrl: process.env.DATABASE_URL })
})); 

app.set('view engine', 'ejs');
app.use(express.static('public'));

// Render login page
app.get('/', (req, res) => {
    res.render('login', {
        message: '',
        messageType: '' // Specify the type of the message
    });
}); 

 
// Signup page route
app.get('/signup', (req, res) => { 
    res.render('signup', {
        message: ' ',
        messageType: ' '  
    });
   
}); 
 
// Handle signup
app.post('/signup', async (req, res) => {
    const { username, password, email } = req.body;

    try {
        // Validate username
        const usernameRegex = /^[a-zA-Z]+$/;
        if (!usernameRegex.test(username)) {
            return res.render('signup', {
                message: 'Username can only contain alphabetic characters!',
                messageType: 'error',
            });
        }

        // Validate email (only .com domains)
        const emailRegex = /^[^\s@]+@[^\s@]+\.com$/;
        if (!emailRegex.test(email)) {
            return res.render('signup', {
                message: 'Email must be a valid .com domain!',
                messageType: 'error',
            });
        }

        // Check if username or email already exists
        const existingUser = await User.findOne({ $or: [{ name: username }, { email }] });
        if (existingUser) {
            return res.render('signup', {
                message: existingUser.email === email 
                    ? 'Email already exists!' 
                    : 'Username already exists!',
                messageType: 'error',
            });
        }

        // Hash password and save user
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const newUser = new User({ name: username, password: hashedPassword, email });
        await newUser.save();

        res.render('login', {
            message: 'Your Account Created Successfully!',
            messageType: 'success' // Specify the type of the message
        });
    } catch (error) {
        console.error('Error during signup:', error);
        res.render('signup', {
            message: 'An error occurred during signup. Please try again later.',
            messageType: 'error',
        });
    }
});
 
//reset password
app.get('/forgot', (req, res) => {
    res.render('forgot',{
        message: '',
        messageType: ''  
    })
    
});
app.post('/forgot', async(req, res) => {
    const { username, newPassword , email } = req.body;
 
    try {
        // Find the user by name and school
        const user = await User.findOne({ name:username, email });
        if (!user) {
            return res.render('forgot',{
                message: 'Username or Email is wrong?',
                messageType: 'error'  
            })
           
        }
 
        // Hash the new password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update the user's password
        user.password = hashedPassword;
        await user.save();
        res.render('login', {
            message: 'Password has been successfully updated. Please log in with your new password.',
            messageType: 'success' // Specify the type of the message
        });
        
         
    } catch (error) {
        console.error('Error in forget route:', error);
        res.send('An error occurred. Please try again later.');
    }
});
  
// Route to render room edit form
app.get('/edit-room/:roomNumber', isAuthenticated, async (req, res) => {
    const roomNumber = req.params.roomNumber;

    try {
        // Fetch the room by room number and user ID
        const room = await Room.findOne({ roomNumber, userId: req.session.user._id });
        if (!room) {
            return res.status(404).send('Room not found');
        }

        // Render the edit form with the room details
        res.render('edit-room', { room });
    } catch (error) {
        console.error('Error retrieving room:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Handle room edit submission
app.post('/edit-room/:roomNumber', isAuthenticated, async (req, res) => {
    const roomNumber = req.params.roomNumber;
    const { status, price } = req.body;

    try {
        // Find the room by room number and user ID
        const room = await Room.findOne({ roomNumber, userId: req.session.user._id });
        if (!room) {
            return res.status(404).send('Room not found');
        }

        // Update the room details
        room.status = status;
        room.price = price;
        
        await room.save();

        // Redirect to the home page after updating the room
        res.redirect('/home');
    } catch (error) {
        console.error('Error updating room:', error);
        res.status(500).send('Internal Server Error');
    }
});



// Handle login 
 
app.post('/home', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ name: username });
    
    if (!user || !await bcrypt.compare(password, user.password)) {
        return res.render('login', {
            message: 'Invalid username or password!',
            messageType: 'error' // Specify the type of the message
        });
        
    }
     
    req.session.user = user;
    res.redirect('/home');
});

 
// Check if the user is logged in
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    } else {
        res.redirect('/');
    }
}



// Dashboard Route
app.get('/home', isAuthenticated, async (req, res) => {
    try {
        const { name, email } = req.session.user;

      
        const userHotels = await Hotel.find({ userId: req.session.user._id });
        const lastHotel = userHotels.length ? userHotels[userHotels.length - 1] : null;

        // Fetch only rooms that belong to the logged-in user
        const rooms = await Room.find({ userId: req.session.user._id });

        const availableRooms = rooms.filter(room => room.status === 'Available').length;
        const bookedRooms = rooms.filter(room => room.status === 'Booked').length;

        // Fetch bookings for all rooms
        const bookings = await Booking.find({ userId: req.session.user._id });

        // Map room booking data into the rooms
        const roomsWithBooking = rooms.map(room => {
            const booking = bookings.find(b => b.roomNumber === room.roomNumber);
            return {
                ...room.toObject(),
                booking: booking || null // Attach booking if it exists
            };
        });

        res.render('home', {
            user: req.session.user,
            hotel: lastHotel,
            availableRooms,
            bookedRooms,
            rooms: roomsWithBooking,
            name, // Send only the user's name
            email, // Pass rooms with booking info
        });
    } catch (error) {
        console.error("Error retrieving hotels:", error);
        res.status(500).send("Internal Server Error");
    }
});


// Render settings page (for adding hotel)
app.get('/settings', isAuthenticated, async (req, res) => {
    // Fetch the user's hotels
    const userHotels = await Hotel.find({ userId: req.session.user._id });

    // Get the last hotel if available
    const lastHotel = userHotels.length ? userHotels[userHotels.length - 1] : null;
 
    // Check if lastHotel and hotelname are available
    const hotelname = lastHotel ? lastHotel.hotelname : null;

    // Render the settings page, passing hotelname or null
    res.render('settings', { hotel:  hotelname});
}); 



// Handle hotel form submission
app.post('/settings', isAuthenticated, async (req, res) => {
    const { hotelname, totalRooms } = req.body;

    // Create a new hotel
    const newHotel = new Hotel({ hotelname, totelrooms: totalRooms, userId: req.session.user._id });
    try {
        await newHotel.save();

        // Get the existing rooms for the user
        const existingRooms = await Room.find({ userId: req.session.user._id });

        // Calculate the starting room number
        const startingRoomNumber = existingRooms.length > 0 ? Math.max(...existingRooms.map(room => room.roomNumber)) + 1 : 1;

        // Create rooms for the new hotel
        for (let i = 0; i < totalRooms; i++) {
            const room = new Room({
                roomNumber: startingRoomNumber + i, // Start from the next available index


                status: 'Available',
                userId: req.session.user._id // Associate room with the current user
            });
            await room.save();
        }

        // Update the hotel's total number of rooms
        newHotel.totelrooms = existingRooms.length + parseInt(totalRooms);
        await newHotel.save();

        res.redirect('/home');
    } catch (error) {
        console.error("Error saving hotel data or creating rooms:", error);
        res.status(500).send("Internal Server Error");
    }
});
 
// Example Express route to get room details
app.get('/room/:roomNumber', async (req, res) => {
    const roomNumber = req.params.roomNumber;

    try {
        // Fetch the room details from your database
        const room = await Room.findOne({ roomNumber: roomNumber }); // Ensure `Room` is defined and imported

        if (!room) {
            return res.status(404).send('Room not found');
        }

        // Render the room details page
        res.render('roomDetails', { room }); // Make sure `room` is passed to the view
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

 
// View booking details route
app.get('/view-booking/:id', isAuthenticated, async (req, res) => {
    try {
        const userHotels = await Hotel.find({ userId: req.session.user._id });
        const lastHotel = userHotels.length ? userHotels[userHotels.length - 1] : null;
        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).send('Booking not found');
        }
        res.render('view-booking', { booking ,hotel: lastHotel,}); // Render the view-booking template with booking data
    } catch (error) {
        res.status(500).send('Server error');
    }
});
 
app.get('/book-room', isAuthenticated, (req, res) => {
    res.render('book-room',{
        message: '',
        messageType: ''});
 
});
 
// Book a room by room number
app.post('/book-room', isAuthenticated, async (req, res) => {
    const { guestName, guestMobile, roomNumber, checkIn, checkOut, guestCount, roomprice, paymentStatus } = req.body;

    // Validation for guestName: Only alphabets
    const nameRegex = /^[a-zA-Z\s]+$/;
    if (!nameRegex.test(guestName)) {
        return res.render('book-room', {
            message: 'Invalid guest name. Please use only alphabets and spaces.',
            messageType: 'error',
        });
    }

    // Validation for guestMobile: Indian mobile number format
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(guestMobile)) {
        return res.render('book-room', {
            message: 'Invalid mobile number. Please provide a valid 10-digit Indian mobile number.',
            messageType: 'error',
        });
    }

    // Find the room by the provided room number
    const room = await Room.findOne({ roomNumber, userId: req.session.user._id });

    if (!room || room.status !== 'Available') {
      
        return res.render('book-room', {
            message: 'Room not found or not available for booking.',
            messageType: 'error',
        });
    }

    try {
        // Create a new booking
        const booking = new Booking({
            guestName,
            guestMobile,
            roomNumber,
            checkIn,
            checkOut,
            guestCount,
            roomprice,
            paymentStatus, // Use the unified payment field
            userId: req.session.user._id, // Associate booking with the logged-in user
        });
        await booking.save();

        // Update the room status to 'Booked'
        await Room.findOneAndUpdate({ roomNumber, userId: req.session.user._id }, { status: 'Booked' });
        return res.render('book-room', {
            message: 'Room is booked successfully',
            messageType: 'success',
        });
       
    } catch (error) {
      
        return res.render('book-room', {
            message: 'Internal Server Error', 
            messageType: 'error',
        }); 
    }
});




// Render the edit form for a booking
app.get('/edit-booking/:id', isAuthenticated, async (req, res) => {
    const bookingId = req.params.id;

    try {
        // Find the booking by its ID
        const booking = await Booking.findById(bookingId);
        if (!booking || booking.userId.toString() !== req.session.user._id.toString()) {
            return res.status(404).send("Booking not found or access denied.");
        }

        res.render('edit-booking', { booking });
    } catch (error) {
        console.error('Error retrieving booking for editing:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Handle booking edit submission
app.post('/edit-booking/:id', isAuthenticated, async (req, res) => {
    const bookingId = req.params.id;
    const { guestName, guestMobile, roomNumber, checkIn, checkOut, guestCount, roomprice, paymentStatus } = req.body;

    try {
        // Find and update the booking
        const booking = await Booking.findById(bookingId);
        if (!booking || booking.userId.toString() !== req.session.user._id.toString()) {
            return res.status(404).send("Booking not found or access denied.");
        }

        // Update booking fields
        booking.guestName = guestName;
        booking.guestMobile = guestMobile;
        booking.roomNumber = roomNumber;
        booking.checkIn = new Date(checkIn);
        booking.checkOut = new Date(checkOut);
        booking.guestCount = guestCount;
        booking.roomprice = roomprice;
        booking.paymentStatus = paymentStatus;

        await booking.save();

        res.redirect('/bookings');
    } catch (error) {
        console.error('Error updating booking:', error);
        res.status(500).send('Internal Server Error');
    }
});


// Delete a booking
app.post('/delete-booking/:id', isAuthenticated, async (req, res) => {
    const bookingId = req.params.id;

    try {
        const booking = await Booking.findById(bookingId);
        if (!booking || booking.userId.toString() !== req.session.user._id.toString()) {
            return res.status(404).send("Booking not found or access denied.");
        }

        // Delete the booking
        await Booking.findByIdAndDelete(bookingId);

        // Update the room status to 'Available'
        await Room.findOneAndUpdate({ roomNumber: booking.roomNumber, userId: req.session.user._id }, { status: 'Available' });

        res.redirect('/bookings');
    } catch (error) {
        console.error('Error deleting booking:', error);
        res.status(500).send('Internal Server Error');
    }
});

   
 
// View all bookings
app.get('/bookings', isAuthenticated, async (req, res) => {
    try {
        const bookings = await Booking.find({ userId: req.session.user._id });

        res.render('bookings', { bookings });
    } catch (error) { 
        console.error("Error retrieving bookings:", error);
        res.status(500).send("Internal Server Error");
    }
});
 
app.post('/delete-room', isAuthenticated, async (req, res) => {
    const { roomNumber } = req.body;



    try {
        // Find and delete the room
        const deletedRoom = await Room.findOneAndDelete({ roomNumber, userId: req.session.user._id });

        if (!deletedRoom) {
            console.log("Room not found or does not belong to the user.");
            return res.status(404).send('Room not found or does not belong to the user.');
        }

        // After deleting the room, update the hotel's total rooms
        const hotel = await Hotel.findOne({ userId: req.session.user._id });
        if (hotel) {
            hotel.totelrooms = hotel.totelrooms - 1; // Reduce the total rooms count
            await hotel.save();
        }

        res.redirect('/home');
    } catch (error) {
        console.error('Error deleting room:', error);
        res.status(500).send('Internal Server Error');
    }
});

 
// Logout Route
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send("Logout failed.");
        }
        res.render('login', {
            message: 'Logout Successfully!',
            messageType: 'success' // Specify the type of the message
        });
    });
});
 


 

 
 
 
const PORT = process.env.PORT||5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
