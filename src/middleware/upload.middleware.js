
// src/middleware/upload.middleware.js
const multer = require('multer');

const TIPOS_VALIDOS = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (TIPOS_VALIDOS.includes(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error('Solo se aceptan archivos .xlsx o .xls'));
  },
});

module.exports = { upload };