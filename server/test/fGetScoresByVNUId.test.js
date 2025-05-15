const mongoose = require('mongoose');
const { fGetScoresByVNUId } = require('../middleware/score-middleware/score'); // Thay bằng đường dẫn thực tế
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
  findOne: jest.fn(),
};

describe('fGetScoresByVNUId', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    // Khởi tạo mockReq với dữ liệu hợp lệ
    mockReq = {
      targetInstance: {
        _id: new mongoose.Types.ObjectId(),
      },
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

  // Test case 1: Thành công - Tìm thấy bản ghi scores
  test('should return scores when data exists', async () => {
    const mockScores = {
      user_ref: mockReq.targetInstance._id,
      scores: [{ subject: { name: 'Math' }, score: 90 }],
    };

    // Mock Mongoose query chain
    const populateMock = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockScores),
    });
    mockScoresTable.findOne.mockReturnValue({
      populate: populateMock,
    });

    await fGetScoresByVNUId(mockReq, mockRes);

    expect(mockScoresTable.findOne).toHaveBeenCalledWith({ user_ref: mockReq.targetInstance._id });
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(RES_FORM).toHaveBeenCalledWith('Success', mockScores);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Success', data: mockScores });
  });

  // Test case 2: Thành công - Không tìm thấy bản ghi scores
  test('should return empty array when no scores found', async () => {
    const populateMock = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(null),
    });
    mockScoresTable.findOne.mockReturnValue({
      populate: populateMock,
    });

    await fGetScoresByVNUId(mockReq, mockRes);

    expect(mockScoresTable.findOne).toHaveBeenCalledWith({ user_ref: mockReq.targetInstance._id });
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(RES_FORM).toHaveBeenCalledWith('Success', []);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Success', data: [] });
  });

  // Test case 3: Lỗi - targetInstance là null
  test('should throw error when targetInstance is null', async () => {
    mockReq.targetInstance = null;

    await expect(fGetScoresByVNUId(mockReq, mockRes)).rejects.toThrow(
      'Cannot read properties of null (reading \'_id\')'
    );
    expect(mockScoresTable.findOne).not.toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 4: Lỗi - targetInstance._id là null
  test('should throw error when targetInstance._id is null', async () => {
    mockReq.targetInstance._id = null;

    await expect(fGetScoresByVNUId(mockReq, mockRes)).rejects.toThrow();
    expect(mockScoresTable.findOne).not.toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 5: Lỗi - Database query thất bại
  test('should throw error on database failure', async () => {
    const populateMock = jest.fn().mockReturnValue({
      populate: jest.fn().mockRejectedValue(new Error('Database error')),
    });
    mockScoresTable.findOne.mockReturnValue({
      populate: populateMock,
    });

    await expect(fGetScoresByVNUId(mockReq, mockRes)).rejects.toThrow('Database error');
    expect(mockScoresTable.findOne).toHaveBeenCalledWith({ user_ref: mockReq.targetInstance._id });
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 6: Kiểm tra populate được gọi đúng
  test('should call populate correctly', async () => {
    const mockScores = {
      user_ref: mockReq.targetInstance._id,
      scores: [{ subject: { name: 'Math' }, score: 90 }],
    };

    const populateMock = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockScores),
    });
    mockScoresTable.findOne.mockReturnValue({
      populate: populateMock,
    });

    await fGetScoresByVNUId(mockReq, mockRes);

    expect(populateMock).toHaveBeenCalledWith({
      path: 'scores',
      populate: { path: 'subject' },
    });
    expect(populateMock().populate).toHaveBeenCalledWith('user_ref');
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(RES_FORM).toHaveBeenCalledWith('Success', mockScores);
  });

  // Test case 7: Edge case - targetInstance._id không phải ObjectId hợp lệ
  test('should throw error when targetInstance._id is invalid', async () => {
    mockReq.targetInstance._id = 'invalid-id';

    await expect(fGetScoresByVNUId(mockReq, mockRes)).rejects.toThrow();
    expect(mockScoresTable.findOne).not.toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 8: Edge case - Populate trả về dữ liệu không đầy đủ
  test('should return scores even if populate data is incomplete', async () => {
    const mockScores = {
      user_ref: mockReq.targetInstance._id,
      scores: [{}], // Thiếu subject
    };

    const populateMock = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockScores),
    });
    mockScoresTable.findOne.mockReturnValue({
      populate: populateMock,
    });

    await fGetScoresByVNUId(mockReq, mockRes);

    expect(mockScoresTable.findOne).toHaveBeenCalledWith({ user_ref: mockReq.targetInstance._id });
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(RES_FORM).toHaveBeenCalledWith('Success', mockScores);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Success', data: mockScores });
  });
});