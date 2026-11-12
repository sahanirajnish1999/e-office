import { File } from '../models/file.model.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.util.js';

export const uploadSingleFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please send a file in the "file" field',
      });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    // Persist file metadata in MongoDB
    const fileRecord = await File.create({
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      url: fileUrl,
    });

    res.status(201).json({
      success: true,
      message: 'File uploaded and recorded successfully',
      data: fileRecord,
    });
  } catch (error) {
    next(error);
  }
};

export const listFiles = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = getPaginationParams(req.query);

    const [total, files] = await Promise.all([
      File.countDocuments(),
      File.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
    ]);

    res.status(200).json(
      formatPaginatedResponse({
        total,
        page,
        pageSize,
        data: files,
      })
    );
  } catch (error) {
    next(error);
  }
};
