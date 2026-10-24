const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
    profId: { type: String, required: true },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
    subjectName: { type: String, required: true },
    dayOfWeek: { type: String, required: true }, // e.g., "Monday", "Tuesday"
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    room: { type: String, required: true }
});

module.exports = mongoose.model('Schedule', scheduleSchema);