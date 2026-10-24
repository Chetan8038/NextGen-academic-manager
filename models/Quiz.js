const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
    title: { type: String, required: true },
    duration: { type: Number, required: true }, // in minutes
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    maxTabSwitches: { type: Number, default: 3 },
    questions: [{
        questionText: String,
        options: [String],
        correctOptionIndex: Number // 0, 1, 2, or 3
    }],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Quiz', quizSchema);