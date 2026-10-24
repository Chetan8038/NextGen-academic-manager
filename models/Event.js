const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    profId: { type: String, required: true },
    title: { type: String, required: true },
    eventType: { type: String, required: true }, // e.g., Workshop, Seminar, Hackathon
    eventDate: { type: Date, required: true }
});

module.exports = mongoose.model('Event', eventSchema);