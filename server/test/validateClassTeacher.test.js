const mongoose = require('mongoose');
const { validateClassTeacher } = require('../middleware/class-middleware/class'); // Thay bằng đường dẫn thực tế
const Configs = require('../configs/Constants');

// Mock Configs.RES_FORM
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

// Mock next function
const mockNext = jest.fn();

describe('validateClassTeacher', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    // Khởi tạo mockReq với dữ liệu hợp lệ
    mockReq = {
      classInstance: {
        populate: jest.fn().mockResolvedValue({
          class_teacher: {
            vnu_id: 'teacher123',
          },
        }),
      },
      senderVNUId: 'teacher123',
    };
    mockRes = mockResponse();
    mockNext.mockClear();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // Test case 1: Thành công - senderVNUId khớp với class_teacher.vnu_id
  test('should call next() when senderVNUId matches class_teacher.vnu_id', async () => {
    await validateClassTeacher(mockReq, mockRes, mockNext);

    expect(mockReq.classInstance.populate).toHaveBeenCalledWith('class_teacher');
    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 2: Thất bại - senderVNUId không khớp
  test('should return 400 when senderVNUId does not match', async () => {
    mockReq.senderVNUId = 'student123';

    await validateClassTeacher(mockReq, mockRes, mockNext);

    expect(mockReq.classInstance.populate).toHaveBeenCalledWith('class_teacher');
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(Configs.RES_FORM).toHaveBeenCalledWith('Error', 'You are not teacher in this class');
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Error',
      data: 'You are not teacher in this class',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  // Test case 3: Lỗi - classInstance là null
  test('should throw error when classInstance is null', async () => {
    mockReq.classInstance = null;

    await expect(validateClassTeacher(mockReq, mockRes, mockNext)).rejects.toThrow(
      'Cannot read properties of null (reading \'populate\')'
    );
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
    expect(mockNext).not.toHaveBeenCalled();
  });

  // Test case 4: Lỗi - class_teacher là null sau populate
  test('should throw error when class_teacher is null', async () => {
    mockReq.classInstance.populate.mockResolvedValue({
      class_teacher: null,
    });

    await expect(validateClassTeacher(mockReq, mockRes, mockNext)).rejects.toThrow(
      'Cannot read properties of null (reading \'vnu_id\')'
    );
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
    expect(mockNext).not.toHaveBeenCalled();
  });

  // Test case 5: Lỗi - senderVNUId là null
  test('should handle senderVNUId is null', async () => {
    mockReq.senderVNUId = null;

    await validateClassTeacher(mockReq, mockRes, mockNext);

    // Vì dùng ==, null == undefined có thể dẫn đến hành vi không mong muốn
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(Configs.RES_FORM).toHaveBeenCalledWith('Error', 'You are not teacher in this class');
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Error',
      data: 'You are not teacher in this class',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  // Test case 6: Lỗi - Populate thất bại
  test('should throw error on populate failure', async () => {
    mockReq.classInstance.populate.mockRejectedValue(new Error('Populate error'));

    await expect(validateClassTeacher(mockReq, mockRes, mockNext)).rejects.toThrow('Populate error');
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
    expect(mockNext).not.toHaveBeenCalled();
  });

  // Test case 7: Edge case - class_teacher.vnu_id là chuỗi rỗng
  test('should return 400 when class_teacher.vnu_id is empty string', async () => {
    mockReq.classInstance.populate.mockResolvedValue({
      class_teacher: { vnu_id: '' },
    });
    mockReq.senderVNUId = 'teacher123';

    await validateClassTeacher(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(Configs.RES_FORM).toHaveBeenCalledWith('Error', 'You are not teacher in this class');
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Error',
      data: 'You are not teacher in this class',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  // Test case 8: Edge case - senderVNUId là chuỗi rỗng
  test('should return 400 when senderVNUId is empty string', async () => {
    mockReq.senderVNUId = '';

    await validateClassTeacher(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(Configs.RES_FORM).toHaveBeenCalledWith('Error', 'You are not teacher in this class');
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Error',
      data: 'You are not teacher in this class',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  // Test case 9: Edge case - class_teacher thiếu vnu_id
  test('should throw error when class_teacher lacks vnu_id', async () => {
    mockReq.classInstance.populate.mockResolvedValue({
      class_teacher: {},
    });

    await expect(validateClassTeacher(mockReq, mockRes, mockNext)).rejects.toThrow(
      'Cannot read properties of undefined (reading \'vnu_id\')'
    );
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
    expect(mockNext).not.toHaveBeenCalled();
  });
});