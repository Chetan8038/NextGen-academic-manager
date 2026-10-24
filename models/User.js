const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, required: true }, // 'student' ya 'professor'
    branch: { type: String }, // Sirf student ke liye
    semester: { type: String }, // NAYA: Semester save karne ke liye
    registeredDevice: { type: String } // Anti-proxy ke liye mobile bind
});

module.exports = mongoose.model('User', userSchema);