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
    school:{
        type: String,
        require:true,
    }
});

module.exports = mongoose.model('User', UserSchema);
