const mongoose = require('mongoose');
const { fDownloadScoresClassByClassId } = require('../middleware/score-middleware/score');
const Configs = require('../configs/Constants');
const fs = require('fs');
const path = require('path');

// Mock json2xls trực tiếp trong jest.mock để tránh hoisting
jest.mock('json2xls', () => {
  const mockFn = jest.fn(data => {
    console.log('json2xls called with:', JSON.stringify(data, null, 2));
    if (!Array.isArray(data)) throw new Error('json2xls expects an array');
    return Buffer.from(JSON.stringify(data));
  });
  return mockFn;
});

// Mock Configs
jest.mock('../configs/Constants', () => ({
  RES_FORM: jest.fn((message, data) => ({ message, data })),
}));

// Mock toàn bộ module fs
jest.mock('fs', () => ({
  writeFileSync: jest.fn((filePath, data) => {
    console.log('fs.writeFileSync called with:', { filePath, data: data.toString() });
    if (typeof filePath !== 'string') throw new Error('filePath must be a string');
  }),
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

// Mock toàn bộ module path
jest.mock('path', () => ({
  resolve: jest.fn((...args) => {
    console.log('path.resolve called with:', args);
    const normalizedPath = args.reduce((acc, curr) => {
      if (acc.endsWith('/') || curr.startsWith('/')) return acc + curr;
      return acc + '/' + curr;
    }).replace(/\/+/g, '/');
    console.log('path.resolve returns:', normalizedPath);
    return normalizedPath;
  }),
  join: jest.fn((...args) => args.join('/').replace(/\/+/g, '/')),
  dirname: jest.fn(() => '/mock/path/public/data'),
  basename: jest.fn(() => 'Class101.xls'),
}));

const mockSemesterModel = { findOne: jest.fn() };
const mockScoresTableModel = { find: jest.fn() };
global.DBConnection = {
  Semester: mockSemesterModel,
  ScoresTable: mockScoresTableModel,
};

// Mock response object
const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.xls = jest.fn().mockReturnValue(res);
  return res;
};

describe('fDownloadScoresClassByClassId', () => {
  let mockReq, mockRes, mockMembers, mockSemester, mockScores;

  beforeEach(() => {
    jest.clearAllMocks();

    // Dữ liệu giả lập mặc định
    mockMembers = [new mongoose.Types.ObjectId()];
    mockSemester = {
      _id: new mongoose.Types.ObjectId(),
      semester_id: 'SEM123',
      semester_name: 'Fall 2023',
    };
    mockScores = [
      {
        user_ref: {
          _id: mockMembers[0],
          vnu_id: 'SV001',
          name: 'Nguyen Van A',
        },
        scores: [
          {
            semester_id: mockSemester._id,
            subject: {
              subject_name: 'Math',
              subject_code: 'MATH101',
              credits_number: 3,
            },
            score: 8.5,
          },
        ],
      },
    ];

    // Khởi tạo mockReq mặc định
    mockReq = {
      classInstance: {
        class_name: 'Class101',
        class_members: mockMembers,
      },
      senderInstance: { _id: new mongoose.Types.ObjectId() },
      params: { semesterId: 'SEM123' },
    };
    mockRes = mockResponse();

    // Mock DB queries mặc định
    mockSemesterModel.findOne.mockResolvedValue(mockSemester);
    const populateMock2 = jest.fn().mockResolvedValue(mockScores);
    const populateMock1 = jest.fn().mockReturnValue({ populate: populateMock2 });
    mockScoresTableModel.find.mockReturnValue({ populate: populateMock1 });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // Test case 1: Thành công - Có điểm, xuất file .xls
  test('should return scores and write xls file when data is valid', async () => {
    const expectedResult = [
      {
        'Mã sinh viên': 'SV001',
        'Họ và tên': 'Nguyen Van A',
        'Môn học:': 'Math',
        'Mã môn học': 'MATH101',
        'Số tín chỉ': 3,
        'Điểm': 8.5,
      },
    ];

    await fDownloadScoresClassByClassId(mockReq, mockRes);

    const json2xlsMock = require('json2xls');
    expect(mockSemesterModel.findOne).toHaveBeenCalledWith({ semester_id: 'SEM123' });
    expect(mockScoresTableModel.find).toHaveBeenCalledWith({ user_ref: { $in: mockMembers } });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('Class101.xls'),
      expect.any(Buffer)
    );
    expect(json2xlsMock).toHaveBeenCalledWith(expectedResult);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.xls).toHaveBeenCalledWith('Class101.xls', expectedResult);
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 2: Thất bại - semesterId không hợp lệ
  test('should return error when semesterId is invalid', async () => {
    mockReq.params.semesterId = 'INVALID_SEMESTER';
    mockSemesterModel.findOne.mockResolvedValue(null);

    await fDownloadScoresClassByClassId(mockReq, mockRes);

    expect(mockSemesterModel.findOne).toHaveBeenCalledWith({ semester_id: 'INVALID_SEMESTER' });
    expect(mockScoresTableModel.find).not.toHaveBeenCalled();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('semester') })
    );
  });

  // Test case 3: Thất bại - classInstance thiếu hoặc không hợp lệ
  test('should throw TypeError when classInstance is missing (BUG DETECTED)', async () => {
    mockReq.classInstance = null;

    // BUG: Hàm không kiểm tra req.classInstance, dẫn đến TypeError
    await expect(fDownloadScoresClassByClassId(mockReq, mockRes)).rejects.toThrow(
      /Cannot read properties of null \(reading 'class_members'\)/
    );

    expect(mockSemesterModel.findOne).not.toHaveBeenCalled();
    expect(mockScoresTableModel.find).not.toHaveBeenCalled();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 4: Trường hợp biên - class_members rỗng
  test('should handle empty class_members', async () => {
    mockReq.classInstance.class_members = [];
    mockScoresTableModel.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue([]),
      }),
    });

    await fDownloadScoresClassByClassId(mockReq, mockRes);

    expect(mockSemesterModel.findOne).toHaveBeenCalledWith({ semester_id: 'SEM123' });
    expect(mockScoresTableModel.find).toHaveBeenCalledWith({ user_ref: { $in: [] } });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('Class101.xls'),
      expect.any(Buffer)
    );
    expect(require('json2xls')).toHaveBeenCalledWith([]);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.xls).toHaveBeenCalledWith('Class101.xls', []);
  });

  // Test case 5: Thất bại - Không có điểm nào được tìm thấy
  test('should handle no scores found', async () => {
    mockScoresTableModel.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue([]),
      }),
    });

    await fDownloadScoresClassByClassId(mockReq, mockRes);

    expect(mockSemesterModel.findOne).toHaveBeenCalledWith({ semester_id: 'SEM123' });
    expect(mockScoresTableModel.find).toHaveBeenCalledWith({ user_ref: { $in: mockMembers } });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('Class101.xls'),
      expect.any(Buffer)
    );
    expect(require('json2xls')).toHaveBeenCalledWith([]);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.xls).toHaveBeenCalledWith('Class101.xls', []);
  });

  // Test case 6: Thất bại - json2xls ném lỗi
  test('should throw error when json2xls fails (BUG DETECTED)', async () => {
    const json2xlsMock = require('json2xls');
    json2xlsMock.mockImplementationOnce(() => {
      throw new Error('json2xls failed');
    });

    // BUG: Hàm không xử lý lỗi từ json2xls, dẫn đến crash
    await expect(fDownloadScoresClassByClassId(mockReq, mockRes)).rejects.toThrow('json2xls failed');

    expect(mockSemesterModel.findOne).toHaveBeenCalledWith({ semester_id: 'SEM123' });
    expect(mockScoresTableModel.find).toHaveBeenCalledWith({ user_ref: { $in: mockMembers } });
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 7: Thất bại - fs.writeFileSync ném lỗi
  test('should throw error when fs.writeFileSync fails (BUG DETECTED)', async () => {
    fs.writeFileSync.mockImplementationOnce(() => {
      throw new Error('writeFileSync failed');
    });

    // BUG: Hàm không xử lý lỗi từ fs.writeFileSync, dẫn đến crash
    await expect(fDownloadScoresClassByClassId(mockReq, mockRes)).rejects.toThrow('writeFileSync failed');

    expect(mockSemesterModel.findOne).toHaveBeenCalledWith({ semester_id: 'SEM123' });
    expect(mockScoresTableModel.find).toHaveBeenCalledWith({ user_ref: { $in: mockMembers } });
    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 8: Trường hợp biên - Dữ liệu scores không đầy đủ
  test('should handle incomplete scores data', async () => {
    mockScores = [
      {
        user_ref: {
          _id: mockMembers[0],
          vnu_id: 'SV001',
          // Thiếu name
        },
        scores: [
          {
            semester_id: mockSemester._id,
            subject: {
              subject_name: 'Math',
              // Thiếu subject_code và credits_number
            },
            score: 8.5,
          },
        ],
      },
    ];
    mockScoresTableModel.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockScores),
      }),
    });

    const expectedResult = [
      {
        'Mã sinh viên': 'SV001',
        'Họ và tên': undefined, // Hàm không xử lý giá trị mặc định cho name
        'Môn học:': 'Math',
        'Mã môn học': undefined, // Hàm không xử lý giá trị mặc định cho subject_code
        'Số tín chỉ': undefined, // Hàm không xử lý giá trị mặc định cho credits_number
        'Điểm': 8.5,
      },
    ];

    await fDownloadScoresClassByClassId(mockReq, mockRes);

    expect(mockSemesterModel.findOne).toHaveBeenCalledWith({ semester_id: 'SEM123' });
    expect(mockScoresTableModel.find).toHaveBeenCalledWith({ user_ref: { $in: mockMembers } });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('Class101.xls'),
      expect.any(Buffer)
    );
    expect(require('json2xls')).toHaveBeenCalledWith(expectedResult);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.xls).toHaveBeenCalledWith('Class101.xls', expectedResult);
  });
});