const mongoose = require('mongoose');
const { fGetAllSemester } = require('../middleware/semester-middleware/semester'); // Thay bằng đường dẫn thực tế
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
  find: jest.fn(),
};

describe('fGetAllSemester', () => {
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

  // Test case 1: Thành công - Tìm thấy danh sách kỳ học
  test('should return semesters when data exists', async () => {
    const mockSemesters = [
      { _id: new mongoose.Types.ObjectId(), name: '2023A' },
      { _id: new mongoose.Types.ObjectId(), name: '2023B' },
    ];

    mockSemesterModel.find.mockResolvedValue(mockSemesters);

    await fGetAllSemester(mockReq, mockRes);

    expect(mockSemesterModel.find).toHaveBeenCalledWith({});
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(RES_FORM).toHaveBeenCalledWith('Success', mockSemesters);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Success', data: mockSemesters });
  });

  // Test case 2: Thất bại - Truy vấn trả về mảng rỗng
  test('should return semesters even when empty array is returned', async () => {
    mockSemesterModel.find.mockResolvedValue([]);

    await fGetAllSemester(mockReq, mockRes);

    expect(mockSemesterModel.find).toHaveBeenCalledWith({});
    expect(mockRes.status).toHaveBeenCalledWith(200); // Vì [] là truthy
    expect(RES_FORM).toHaveBeenCalledWith('Success', []);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Success', data: [] });
  });

  // Test case 3: Lỗi - Database query thất bại
  test('should throw error on database failure', async () => {
    mockSemesterModel.find.mockRejectedValue(new Error('Database error'));

    await expect(fGetAllSemester(mockReq, mockRes)).rejects.toThrow('Database error');
    expect(mockSemesterModel.find).toHaveBeenCalledWith({});
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 4: Lỗi - global.DBConnection.Semester là undefined
  test('should throw error when Semester model is undefined', async () => {
    global.DBConnection = {}; // Không có Semester

    await expect(fGetAllSemester(mockReq, mockRes)).rejects.toThrow(
      'Cannot read properties of undefined (reading \'find\')'
    );
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 5: Edge case - semesterId là null
  test('should return semesters when semesterId is null', async () => {
    mockReq.params.semesterId = null;
    const mockSemesters = [
      { _id: new mongoose.Types.ObjectId(), name: '2023A' },
    ];

    mockSemesterModel.find.mockResolvedValue(mockSemesters);

    await fGetAllSemester(mockReq, mockRes);

    expect(mockSemesterModel.find).toHaveBeenCalledWith({});
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(RES_FORM).toHaveBeenCalledWith('Success', mockSemesters);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Success', data: mockSemesters });
  });

  // Test case 6: Edge case - req.params.semesterId không tồn tại
  test('should return semesters when semesterId is undefined', async () => {
    mockReq.params = {};
    const mockSemesters = [
      { _id: new mongoose.Types.ObjectId(), name: '2023A' },
    ];

    mockSemesterModel.find.mockResolvedValue(mockSemesters);

    await fGetAllSemester(mockReq, mockRes);

    expect(mockSemesterModel.find).toHaveBeenCalledWith({});
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(RES_FORM).toHaveBeenCalledWith('Success', mockSemesters);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Success', data: mockSemesters });
  });

  // Test case 7: Edge case - semesterId là chuỗi rỗng
  test('should return semesters when semesterId is empty string', async () => {
    mockReq.params.semesterId = '';
    const mockSemesters = [
      { _id: new mongoose.Types.ObjectId(), name: '2023A' },
    ];

    mockSemesterModel.find.mockResolvedValue(mockSemesters);

    await fGetAllSemester(mockReq, mockRes);

    expect(mockSemesterModel.find).toHaveBeenCalledWith({});
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(RES_FORM).toHaveBeenCalledWith('Success', mockSemesters);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Success', data: mockSemesters });
  });
});