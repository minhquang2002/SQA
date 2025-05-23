const { fHandleUploadScore } = require('../score-middleware/score');
const { RES_FORM } = require('../../configs/Constants');
const csv = require('csvtojson/v2');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

// Mock global.DBConnection
const mockSave = jest.fn();
global.DBConnection = {
  User: { findOne: jest.fn() },
  Subject: { findOne: jest.fn() },
  Semester: { findOne: jest.fn() },
  ScoresTable: jest.fn(), // Định nghĩa ScoresTable là mock function
  Score: jest.fn().mockImplementation((data) => ({
    score: data.score,
    subject: data.subject,
    semester_id: data.semester_id,
    save: mockSave,
  })),
};

// Mock findOne cho ScoresTable
global.DBConnection.ScoresTable.findOne = jest.fn();

// Mock csvtojson
const mockFromFile = jest.fn();
jest.mock('csvtojson/v2', () => {
  return () => ({
    fromFile: mockFromFile,
  });
});

// Dữ liệu mẫu
const mockScoreList = [
  { vnu_id: '19020056', subject_code: 'MAT1093', score: 8, semester_id: '20212' },
  { vnu_id: '19020047', subject_code: 'FLF2104', score: 7, semester_id: '20212' },
];

// Mock ObjectId
const mockObjectId = new ObjectId();

describe('Test function fHandleUploadScore trong file score.js', () => {
  let req, res;

  beforeEach(() => {
    // Mô phỏng req và res
    req = { fileUploadPath: 'mock/path/to/file.csv' };
    res = {
      statusCode: null,
      jsonData: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.jsonData = data;
      },
    };
    // Reset mocks
    mockFromFile.mockReset();
    mockSave.mockReset();
    global.DBConnection.User.findOne.mockReset();
    global.DBConnection.Subject.findOne.mockReset();
    global.DBConnection.Semester.findOne.mockReset();
    global.DBConnection.ScoresTable.findOne.mockReset();
    global.DBConnection.ScoresTable.mockReset();
  });

  test('TEST-32: Tất cả điểm thêm thành công ', async () => {
    mockFromFile.mockResolvedValue(mockScoreList);

    // Mock User.findOne
    global.DBConnection.User.findOne.mockImplementation(({ vnu_id }) => {
      if (vnu_id === '19020056' || vnu_id === '19020047') {
        return Promise.resolve({ _id: mockObjectId, vnu_id });
      }
      return Promise.resolve(null);
    });

    // Mock Subject.findOne
    global.DBConnection.Subject.findOne.mockImplementation(({ subject_code }) => {
      if (subject_code === 'MAT1093' || subject_code === 'FLF2104') {
        return Promise.resolve({ _id: mockObjectId, subject_code });
      }
      return Promise.resolve(null);
    });

    // Mock Semester.findOne
    global.DBConnection.Semester.findOne.mockImplementation(({ semester_id }) => {
      if (semester_id === '20212') {
        return Promise.resolve({ _id: mockObjectId, semester_id });
      }
      return Promise.resolve(null);
    });

    // Mock ScoresTable.findOne trả về bảng điểm rỗng
    global.DBConnection.ScoresTable.findOne.mockResolvedValue({
      _id: mockObjectId,
      scores: [],
      populate: jest.fn().mockResolvedValue({ scores: [] }),
      save: jest.fn().mockResolvedValue(true),
    });

    // Mock Score.save
    mockSave.mockResolvedValue(true);

    await fHandleUploadScore(req, res);

    expect(mockFromFile).toHaveBeenCalledWith('mock/path/to/file.csv');
    expect(res.statusCode).toBe(200);
    expect(res.jsonData).toEqual({
      status: 'Success',
      message: {
        registered: [
          { ...mockScoreList[0], response: 'Đã thêm môn học MAT1093 = 8 vào bảng điểm 19020056 ' },
          { ...mockScoreList[1], response: 'Đã thêm môn học FLF2104 = 7 vào bảng điểm 19020047 ' },
        ],
        failed: [],
      },
    });
  });

  test('TEST-33: Thất bại do sinh viên không tồn tại', async () => {
    mockFromFile.mockResolvedValue(mockScoreList);
    global.DBConnection.User.findOne.mockResolvedValue(null);

    await fHandleUploadScore(req, res);

    expect(mockFromFile).toHaveBeenCalledWith('mock/path/to/file.csv');
    expect(res.statusCode).toBe(404);
    expect(res.jsonData).toEqual({
      status: 'Success',
      message: {
        registered: [],
        failed: [
          { ...mockScoreList[0], error: 'Không tìm được VNU-ID19020056' },
          { ...mockScoreList[1], error: 'Không tìm được VNU-ID19020047' },
        ],
      },
    });
  });

  test('TEST-34: Thất bại do không tìm thấy môn học', async () => {
    mockFromFile.mockResolvedValue(mockScoreList);
    global.DBConnection.User.findOne.mockResolvedValue({ _id: mockObjectId, vnu_id: '19020056' });
    global.DBConnection.Semester.findOne.mockResolvedValue({ _id: mockObjectId, semester_id: '20212' });
    global.DBConnection.Subject.findOne.mockResolvedValue(null);

    await fHandleUploadScore(req, res);

    expect(mockFromFile).toHaveBeenCalledWith('mock/path/to/file.csv');
    expect(res.statusCode).toBe(200);
    expect(res.jsonData).toEqual({
      status: 'Success',
      message: {
        registered: [],
        failed: [
          { ...mockScoreList[0], error: 'Không tìm thấy môn họcMAT1093' },
          { ...mockScoreList[1], error: 'Không tìm thấy môn họcFLF2104' },
        ],
      },
    });
  });

  test('TEST-35: Thất bại do không tìm thấy học kỳ', async () => {
    mockFromFile.mockResolvedValue(mockScoreList);
    global.DBConnection.User.findOne.mockResolvedValue({ _id: mockObjectId, vnu_id: '19020056' });
    global.DBConnection.Subject.findOne.mockResolvedValue({ _id: mockObjectId, subject_code: 'MAT1093' });
    global.DBConnection.Semester.findOne.mockResolvedValue(null);

    await fHandleUploadScore(req, res);

    expect(mockFromFile).toHaveBeenCalledWith('mock/path/to/file.csv');
    expect(res.statusCode).toBe(200);
    expect(res.jsonData).toEqual({
      status: 'Success',
      message: {
        registered: [],
        failed: [
          { ...mockScoreList[0], error: 'Không tìm thấy kỳ học 20212' },
          { ...mockScoreList[1], error: 'Không tìm thấy kỳ học 20212' },
        ],
      },
    });
  });

  test('TEST-36: Thất bại do điểm đã tồn tại', async () => {
    mockFromFile.mockResolvedValue(mockScoreList);
    global.DBConnection.User.findOne.mockResolvedValue({ _id: mockObjectId, vnu_id: '19020056' });
    global.DBConnection.Subject.findOne.mockResolvedValue({ _id: mockObjectId, subject_code: 'MAT1093' });
    global.DBConnection.Semester.findOne.mockResolvedValue({ _id: mockObjectId, semester_id: '20212' });
    global.DBConnection.ScoresTable.findOne.mockResolvedValue({
      _id: mockObjectId,
      scores: [{ subject: { subject_code: 'MAT1093' } }],
      populate: jest.fn().mockResolvedValue({
        scores: [{ subject: { subject_code: 'MAT1093' } }],
      }),
    });

    await fHandleUploadScore(req, res);

    expect(mockFromFile).toHaveBeenCalledWith('mock/path/to/file.csv');
    expect(res.statusCode).toBe(200);
    expect(res.jsonData).toEqual({
      status: 'Success',
      message: {
        registered: [],
        failed: [
          { ...mockScoreList[0], error: 'Điểm cho môn học này đã tồn tại trong bảng điểm' },
          { ...mockScoreList[1], error: 'Điểm cho môn học này đã tồn tại trong bảng điểm' },
        ],
      },
    });
  });

  test('TEST-37: Thất bại do lỗi tạo ScoresTable', async () => {
    mockFromFile.mockResolvedValue(mockScoreList);
    global.DBConnection.User.findOne.mockResolvedValue({ _id: mockObjectId, vnu_id: '19020056' });
    global.DBConnection.Subject.findOne.mockResolvedValue({ _id: mockObjectId, subject_code: 'MAT1093' });
    global.DBConnection.Semester.findOne.mockResolvedValue({ _id: mockObjectId, semester_id: '20212' });
    global.DBConnection.ScoresTable.findOne.mockResolvedValue(null);

    // Mock ScoresTable constructor
    global.DBConnection.ScoresTable.mockImplementation(() => ({
      user_ref: mockObjectId,
      scores: [],
      save: jest.fn().mockRejectedValue(new Error('Database error')),
    }));

    await fHandleUploadScore(req, res);

    expect(mockFromFile).toHaveBeenCalledWith('mock/path/to/file.csv');
    expect(res.statusCode).toBe(500);
    expect(res.jsonData).toEqual({
      status: 'Success',
      message: {
        registered: [],
        failed: [
          { ...mockScoreList[0], error: 'Lỗi khi khởi tạo bảng điểm lần đầu' },
          { ...mockScoreList[1], error: 'Lỗi khi khởi tạo bảng điểm lần đầu' },
        ],
      },
    });
  });

  test('TEST-38: Thất bại do lỗi tạo Score trong fAddScoreToScoresTable', async () => {
    mockFromFile.mockResolvedValue(mockScoreList);
    global.DBConnection.User.findOne.mockResolvedValue({ _id: mockObjectId, vnu_id: '19020056' });
    global.DBConnection.Subject.findOne.mockResolvedValue({ _id: mockObjectId, subject_code: 'MAT1093' });
    global.DBConnection.Semester.findOne.mockResolvedValue({ _id: mockObjectId, semester_id: '20212' });
    global.DBConnection.ScoresTable.findOne.mockResolvedValue({
      _id: mockObjectId,
      scores: [],
      populate: jest.fn().mockResolvedValue({ scores: [] }),
      save: jest.fn().mockResolvedValue(true),
    });
    mockSave.mockRejectedValue(new Error('Score save error'));

    await fHandleUploadScore(req, res);

    expect(mockFromFile).toHaveBeenCalledWith('mock/path/to/file.csv');
    expect(res.statusCode).toBe(500);
    expect(res.jsonData).toEqual({
      status: 'Success',
      message: {
        registered: [],
        failed: [
          {
            ...mockScoreList[0],
            error: expect.stringContaining('Lỗi khi khởi tạo dữ liệu điểm'),
          },
          {
            ...mockScoreList[1],
            error: expect.stringContaining('Lỗi khi khởi tạo dữ liệu điểm'),
          },
        ],
      },
    });
  });

  test('TEST-39: Thất bại do lỗi lưu ScoresTable trong fAddScoreToScoresTable', async () => {
    mockFromFile.mockResolvedValue(mockScoreList);
    global.DBConnection.User.findOne.mockResolvedValue({ _id: mockObjectId, vnu_id: '19020056' });
    global.DBConnection.Subject.findOne.mockResolvedValue({ _id: mockObjectId, subject_code: 'MAT1093' });
    global.DBConnection.Semester.findOne.mockResolvedValue({ _id: mockObjectId, semester_id: '20212' });
    global.DBConnection.ScoresTable.findOne.mockResolvedValue({
      _id: mockObjectId,
      scores: [],
      populate: jest.fn().mockResolvedValue({ scores: [] }),
      save: jest.fn().mockRejectedValue(new Error('Save error')),
    });
    mockSave.mockResolvedValue(true);

    await fHandleUploadScore(req, res);

    expect(mockFromFile).toHaveBeenCalledWith('mock/path/to/file.csv');
    expect(res.statusCode).toBe(500);
    expect(res.jsonData).toEqual({
      status: 'Success',
      message: {
        registered: [],
        failed: [
          {
            ...mockScoreList[0],
            error: expect.stringContaining('Lỗi khi nhập dữ liệu điểm vào bảng điểm'),
          },
          {
            ...mockScoreList[1],
            error: expect.stringContaining('Lỗi khi nhập dữ liệu điểm vào bảng điểm'),
          },
        ],
      },
    });
  });

  test('TEST-40: Kiểm tra một số điểm thành công, một số thất bại', async () => {
    mockFromFile.mockResolvedValue(mockScoreList);
    global.DBConnection.User.findOne.mockImplementation(({ vnu_id }) => {
      if (vnu_id === '19020056') {
        return Promise.resolve({ _id: mockObjectId, vnu_id });
      }
      return Promise.resolve(null);
    });
    global.DBConnection.Subject.findOne.mockResolvedValue({ _id: mockObjectId, subject_code: 'MAT1093' });
    global.DBConnection.Semester.findOne.mockResolvedValue({ _id: mockObjectId, semester_id: '20212' });
    global.DBConnection.ScoresTable.findOne.mockResolvedValue({
      _id: mockObjectId,
      scores: [],
      populate: jest.fn().mockResolvedValue({ scores: [] }),
      save: jest.fn().mockResolvedValue(true),
    });
    mockSave.mockResolvedValue(true);

    await fHandleUploadScore(req, res);

    expect(mockFromFile).toHaveBeenCalledWith('mock/path/to/file.csv');
    expect(res.statusCode).toBe(200);
    expect(res.jsonData).toEqual({
      status: 'Success',
      message: {
        registered: [
          { ...mockScoreList[0], response: 'Đã thêm môn học MAT1093 = 8 vào bảng điểm 19020056 ' },
        ],
        failed: [{ ...mockScoreList[1], error: 'Không tìm được VNU-ID19020047' }],
      },
    });
  });

  test('TEST-41: File CSV rỗng', async () => {
    mockFromFile.mockResolvedValue([]);

    await fHandleUploadScore(req, res);

    expect(mockFromFile).toHaveBeenCalledWith('mock/path/to/file.csv');
    expect(res.statusCode).toBe(200);
    expect(res.jsonData).toEqual({
      status: 'Success',
      message: { registered: [], failed: [] },
    });
  });

  test('ADD-04: File CSV lớn được xử lý thành công', async () => {
    // Tạo 1000 dòng dữ liệu điểm giả lập
    const largeMockScoreList = Array.from({ length: 1000 }, (_, i) => ({
      vnu_id: `19020${100 + i}`,
      subject_code: `SUBJ${i}`,
      semester_id: '20222',
      score: 9
    }));

    mockFromFile.mockResolvedValue(largeMockScoreList);

    // Giả lập các findOne luôn trả về hợp lệ
    global.DBConnection.User.findOne.mockResolvedValue({ _id: mockObjectId });
    global.DBConnection.Subject.findOne.mockResolvedValue({ _id: mockObjectId });
    global.DBConnection.Semester.findOne.mockResolvedValue({ _id: mockObjectId });
    global.DBConnection.ScoresTable.findOne.mockResolvedValue({
      _id: mockObjectId,
      scores: [],
      populate: jest.fn().mockResolvedValue({ scores: [] }),
      save: jest.fn().mockResolvedValue(true),
    });

    // Giả lập save điểm thành công
    mockSave.mockResolvedValue(true);

    await fHandleUploadScore(req, res);

    expect(mockFromFile).toHaveBeenCalledWith('mock/path/to/file.csv');
    expect(res.statusCode).toBe(200);
    expect(res.jsonData.status).toBe('Success');
    expect(res.jsonData.message.registered.length).toBe(1000);
    expect(res.jsonData.message.failed.length).toBe(0);
  });

});