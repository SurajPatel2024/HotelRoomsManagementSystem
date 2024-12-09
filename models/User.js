const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,  // Ensure email is unique
        lowercase: true,  // Convert email to lowercase
        match: [/\S+@\S+\.\S+/, 'Please enter a valid email address'], // Email validation regex
      },
});

module.exports = mongoose.model('User', UserSchema);
