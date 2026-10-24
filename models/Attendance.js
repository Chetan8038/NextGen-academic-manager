const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    studentId: { type: String, required: true },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
    subjectName: { type: String, required: true },
    date: { type: Date, default: Date.now }, // Jis din scan kiya
    status: { type: String, default: 'Present' }
});

module.exports = mongoose.model('Attendance', attendanceSchema);