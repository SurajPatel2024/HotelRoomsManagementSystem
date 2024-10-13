const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    roomNumber: { type: Number, required: true },
    
    status: { type: String, default: 'Available' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Add userId to track the owner
});

const Room = mongoose.model('Room', roomSchema);
module.exports = Room;
