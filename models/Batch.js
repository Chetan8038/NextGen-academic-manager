const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
    batchName: { type: String, required: true },
    subjectName: { type: String, required: true },
    branch: { type: String, required: true },
    semester: { type: String, required: true }, // NAYA: Semester
    section: { type: String, required: true },
    profId: { type: String, required: true },
    profName: { type: String, required: true },
    students: [{ type: String }],
    totalClasses: { type: Number, default: 0 } 
});

module.exports = mongoose.model('Batch', batchSchema);