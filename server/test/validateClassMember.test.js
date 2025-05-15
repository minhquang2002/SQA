const mongoose = require('mongoose');
const { validateClassMember } = require('../middleware/class-middleware/class'); // Thay bằng đường dẫn thực tế
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

describe('validateClassMember', () => {
  let mockReq, mockRes, mockSenderId, mockTeacherId, mockMembers;

  beforeEach(() => {
    // Dữ liệu giả lập
    mockSenderId = new mongoose.Types.ObjectId();
    mockTeacherId = new mongoose.Types.ObjectId();
    mockMembers = [
      new mongoose.Types.ObjectId(),
      mockSenderId, // sender là thành viên
      new mongoose.Types.ObjectId(),
    ];

    // Khởi tạo mockReq với dữ liệu hợp lệ
    mockReq = {
      classInstance: {
        class_members: mockMembers,
        class_teacher: mockTeacherId,
      },
      senderInstance: {
        _id: mockSenderId,
      },
    };
    mockRes = mockResponse();
    mockNext.mockClear();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // Test case 1: Thành công - senderInstance._id có trong class_members
  test('should call next when sender is a class member', () => {
    validateClassMember(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 2: Thành công - senderInstance._id là class_teacher
  test('should call next when sender is the class teacher', () => {
    mockReq.senderInstance._id = mockTeacherId;

    validateClassMember(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 3: Thành công - sender là cả member và teacher
  test('should call next when sender is both member and teacher', () => {
    mockReq.senderInstance._id = mockTeacherId;
    mockReq.classInstance.class_members = [mockTeacherId];

    validateClassMember(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 4: Thất bại - sender không phải member hoặc teacher
  test('should return 400 when sender is neither member nor teacher', () => {
    mockReq.senderInstance._id = new mongoose.Types.ObjectId(); // ID không có trong class_members hoặc class_teacher

    validateClassMember(mockReq, mockRes, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(Configs.RES_FORM).toHaveBeenCalledWith('Error', 'You aren\'t a member in this class');
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Error',
      data: 'You aren\'t a member in this class',
    });
  });

  // Test case 5: Lỗi - classInstance là null
  test('should throw error when classInstance is null', () => {
    mockReq.classInstance = null;

    expect(() => validateClassMember(mockReq, mockRes, mockNext)).toThrow(
      'Cannot read properties of null (reading \'class_members\')'
    );
    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 6: Lỗi - senderInstance là null
  test('should throw error when senderInstance is null', () => {
    mockReq.senderInstance = null;

    expect(() => validateClassMember(mockReq, mockRes, mockNext)).toThrow(
      'Cannot read properties of null (reading \'_id\')'
    );
    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 7: Lỗi - class_members là null
  test('should throw error when class_members is null', () => {
    mockReq.classInstance.class_members = null;

    expect(() => validateClassMember(mockReq, mockRes, mockNext)).toThrow(
      'class_members.includes is not a function'
    );
    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 8: Lỗi - class_teacher là null
  test('should throw error when class_teacher is null', () => {
    mockReq.classInstance.class_members = []; // Không có sender trong members
    mockReq.classInstance.class_teacher = null;

    expect(() => validateClassMember(mockReq, mockRes, mockNext)).toThrow(
      'Cannot read properties of null (reading \'equals\')'
    );
    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 9: Edge case - class_members là mảng rỗng
  test('should return 400 when class_members is empty and sender is not teacher', () => {
    mockReq.classInstance.class_members = [];
    mockReq.senderInstance._id = new mongoose.Types.ObjectId(); // Không phải teacher

    validateClassMember(mockReq, mockRes, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(Configs.RES_FORM).toHaveBeenCalledWith('Error', 'You aren\'t a member in this class');
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Error',
      data: 'You aren\'t a member in this class',
    });
  });

  // Test case 10: Edge case - class_members là undefined
  test('should throw error when class_members is undefined', () => {
    mockReq.classInstance.class_members = undefined;

    expect(() => validateClassMember(mockReq, mockRes, mockNext)).toThrow(
      'class_members.includes is not a function'
    );
    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 11: Edge case - class_teacher là undefined
  test('should throw error when class_teacher is undefined', () => {
    mockReq.classInstance.class_members = []; // Không có sender trong members
    mockReq.classInstance.class_teacher = undefined;

    expect(() => validateClassMember(mockReq, mockRes, mockNext)).toThrow(
      'Cannot read properties of undefined (reading \'equals\')'
    );
    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });
});