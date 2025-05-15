const mongoose = require('mongoose');
const { fGetSemester } = require('../middleware/semester-middleware/semester'); // Thay bằng đường dẫn thực tế
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

// Mock global.DBConnection.Semester
const mockSemesterModel = {
  findOne: jest.fn(),
};

describe('fGetSemester', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    // Khởi tạo mockReq
    mockReq = {
      params: {
        semesterId: '2023A',
      },
    };
    mockRes = mockResponse();
    // Mock global.DBConnection
    global.DBConnection = {
      Semester: mockSemesterModel,
    };
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // Test case 1: Thành công - Tìm thấy kỳ học
  test('should return semester when found', async () => {
    const mockSemester = {
      _id: new mongoose.Types.ObjectId(),
      semester_id: '2023A',
      name: 'Fall 2023',
    };

    mockSemesterModel.findOne.mockResolvedValue(mockSemester);

    await fGetSemester(mockReq, mockRes);

    expect(mockSemesterModel.findOne).toHaveBeenCalledWith({ semester_id: '2023A' });
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(RES_FORM).toHaveBeenCalledWith('Success', mockSemester);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Success', data: mockSemester });
  });

  // Test case 2: Thất bại - Không tìm thấy kỳ học
  test('should return 404 when semester is not found', async () => {
    mockSemesterModel.findOne.mockResolvedValue(null);

    await fGetSemester(mockReq, mockRes);

    expect(mockSemesterModel.findOne).toHaveBeenCalledWith({ semester_id: '2023A' });
    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(RES_FORM).toHaveBeenCalledWith('Error', 'Mã kỳ học không tồn tại');
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Error',
      data: 'Mã kỳ học không tồn tại',
    });
  });

  // Test case 3: Lỗi - Database query thất bại
  test('should throw error on database failure', async () => {
    mockSemesterModel.findOne.mockRejectedValue(new Error('Database error'));

    await expect(fGetSemester(mockReq, mockRes)).rejects.toThrow('Database error');
    expect(mockSemesterModel.findOne).toHaveBeenCalledWith({ semester_id: '2023A' });
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 4: Lỗi - global.DBConnection.Semester là undefined
  test('should throw error when Semester model is undefined', async () => {
    global.DBConnection = {}; // Không có Semester

    await expect(fGetSemester(mockReq, mockRes)).rejects.toThrow(
      'Cannot read properties of undefined (reading \'findOne\')'
    );
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 5: Edge case - semesterId là null
  test('should handle semesterId is null', async () => {
    mockReq.params.semesterId = null;
    mockSemesterModel.findOne.mockResolvedValue(null);

    await fGetSemester(mockReq, mockRes);

    expect(mockSemesterModel.findOne).toHaveBeenCalledWith({ semester_id: null });
    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(RES_FORM).toHaveBeenCalledWith('Error', 'Mã kỳ học không tồn tại');
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Error',
      data: 'Mã kỳ học không tồn tại',
    });
  });

  // Test case 6: Edge case - req.params.semesterId không tồn tại
  test('should throw error when semesterId is undefined', async () => {
    mockReq.params = {};

    await expect(fGetSemester(mockReq, mockRes)).rejects.toThrow(
      'Cannot read properties of undefined (reading \'semesterId\')'
    );
    expect(mockSemesterModel.findOne).not.toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 7: Edge case - semesterId là chuỗi rỗng
  test('should handle semesterId is empty string', async () => {
    mockReq.params.semesterId = '';
    mockSemesterModel.findOne.mockResolvedValue(null);

    await fGetSemester(mockReq, mockRes);

    expect(mockSemesterModel.findOne).toHaveBeenCalledWith({ semester_id: '' });
    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(RES_FORM).toHaveBeenCalledWith('Error', 'Mã kỳ học không tồn tại');
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Error',
      data: 'Mã kỳ học không tồn tại',
    });
  });
});