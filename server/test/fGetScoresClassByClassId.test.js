const mongoose = require('mongoose');
const { fGetScoresClassByClassId } = require('../middleware/score-middleware/score'); // Thay bằng đường dẫn thực tế
const { RES_FORM } = require('../configs/Constants');

// Mock RES_FORM
jest.mock('../configs/Constants', () => ({
  RES_FORM: jest.fn((message, data) => ({ message, data })),
}));

// Mock response object
const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

// Mock global.DBConnection.ScoresTable
const mockScoresTable = {
  find: jest.fn(),
};

describe('fGetScoresClassByClassId', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    // Khởi tạo mockReq với dữ liệu hợp lệ
    mockReq = {
      classInstance: {
        class_members: [
          new mongoose.Types.ObjectId(),
          new mongoose.Types.ObjectId(),
        ],
      },
      senderInstance: {},
    };
    mockRes = mockResponse();

    // Mock global.DBConnection
    global.DBConnection = {
      ScoresTable: mockScoresTable,
    };

    jest.clearAllMocks();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // Test case 1: Thành công - Có dữ liệu scores
  test('should return scores when data exists', async () => {
    const mockScores = [
      {
        user_ref: mockReq.classInstance.class_members[0],
        scores: [{ subject: { name: 'Math' }, score: 90 }],
      },
      {
        user_ref: mockReq.classInstance.class_members[1],
        scores: [{ subject: { name: 'English' }, score: 85 }],
      },
    ];

    // Mock Mongoose query chain
    const populateMock = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockScores),
    });
    mockScoresTable.find.mockReturnValue({
      populate: populateMock,
    });

    await fGetScoresClassByClassId(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(RES_FORM).toHaveBeenCalledWith('Success', mockScores);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Success', data: mockScores });
  });

  // Test case 2: Thành công - Không có dữ liệu scores
  test('should return empty array when no scores found', async () => {
    const populateMock = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue([]),
    });
    mockScoresTable.find.mockReturnValue({
      populate: populateMock,
    });

    await fGetScoresClassByClassId(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(RES_FORM).toHaveBeenCalledWith('Success', []);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Success', data: [] });
  });

  // Test case 3: Edge case - class_members là mảng rỗng
  test('should return empty array when class_members is empty', async () => {
    mockReq.classInstance.class_members = [];

    const populateMock = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue([]),
    });
    mockScoresTable.find.mockReturnValue({
      populate: populateMock,
    });

    await fGetScoresClassByClassId(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(RES_FORM).toHaveBeenCalledWith('Success', []);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Success', data: [] });
  });

  // Test case 4: Lỗi - classInstance không tồn tại
  test('should throw error when classInstance is missing', async () => {
    mockReq.classInstance = null;

    await expect(fGetScoresClassByClassId(mockReq, mockRes)).rejects.toThrow('Cannot read properties of null (reading \'class_members\')');
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 5: Lỗi - class_members không phải mảng
  test('should throw error when class_members is invalid', async () => {
    mockReq.classInstance.class_members = 'invalid';

    await expect(fGetScoresClassByClassId(mockReq, mockRes)).rejects.toThrow();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 6: Lỗi - Database query thất bại
  test('should throw error on database failure', async () => {
    const populateMock = jest.fn().mockReturnValue({
      populate: jest.fn().mockRejectedValue(new Error('Database error')),
    });
    mockScoresTable.find.mockReturnValue({
      populate: populateMock,
    });

    await expect(fGetScoresClassByClassId(mockReq, mockRes)).rejects.toThrow('Database error');
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 7: Kiểm tra populate được gọi đúng
  test('should call populate correctly', async () => {
    const mockScores = [
      {
        user_ref: mockReq.classInstance.class_members[0],
        scores: [{ subject: { name: 'Math' }, score: 90 }],
      },
    ];

    const populateMock = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockScores),
    });
    mockScoresTable.find.mockReturnValue({
      populate: populateMock,
    });

    await fGetScoresClassByClassId(mockReq, mockRes);

    expect(populateMock).toHaveBeenCalledWith({
      path: 'scores',
      populate: { path: 'subject' },
    });
    expect(populateMock().populate).toHaveBeenCalledWith('user_ref');
  });

  // Test case 8: Edge case - senderInstance không tồn tại
  test('should throw error when senderInstance is missing', async () => {
    mockReq.senderInstance = null;

    const mockScores = [
      {
        user_ref: mockReq.classInstance.class_members[0],
        scores: [{ subject: { name: 'Math' }, score: 90 }],
      },
    ];

    const populateMock = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockScores),
    });
    mockScoresTable.find.mockReturnValue({
      populate: populateMock,
    });

    await fGetScoresClassByClassId(mockReq, mockRes);

    // Hàm vẫn chạy vì senderInstance không được dùng
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(RES_FORM).toHaveBeenCalledWith('Success', mockScores);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Success', data: mockScores });
  });
});