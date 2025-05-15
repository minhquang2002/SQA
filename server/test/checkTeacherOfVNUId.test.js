const mongoose = require('mongoose');
const { checkTeacherOfVNUId } = require('../middleware/score-middleware/score'); // Thay bằng đường dẫn thực tế
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

// Mock next function
const mockNext = jest.fn();

// Mock global.DBConnection.User và global.DBConnection.Class
const mockUserModel = {
  findOne: jest.fn(),
};
const mockClassModel = {
  findOne: jest.fn(),
};

describe('checkTeacherOfVNUId', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    // Khởi tạo mockReq với dữ liệu hợp lệ
    mockReq = {
      senderInstance: {
        vnu_id: 'teacher123',
        _id: new mongoose.Types.ObjectId(),
      },
      params: {
        userId: 'student123',
      },
    };
    mockRes = mockResponse();
    mockNext.mockClear();
    // Mock global.DBConnection
    global.DBConnection = {
      User: mockUserModel,
      Class: mockClassModel,
    };
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // Test case 1: Thành công - targetVNUId là "me"
  test('should assign targetInstance and call next() when targetVNUId is "me"', async () => {
    mockReq.params.userId = 'me';

    await checkTeacherOfVNUId(mockReq, mockRes, mockNext);

    expect(mockUserModel.findOne).not.toHaveBeenCalled();
    expect(mockClassModel.findOne).not.toHaveBeenCalled();
    expect(mockReq.targetInstance).toEqual(mockReq.senderInstance);
    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 2: Thành công - targetVNUId khớp senderInstance.vnu_id
  test('should assign targetInstance and call next() when targetVNUId matches senderInstance.vnu_id', async () => {
    mockReq.params.userId = 'teacher123';

    await checkTeacherOfVNUId(mockReq, mockRes, mockNext);

    expect(mockUserModel.findOne).not.toHaveBeenCalled();
    expect(mockClassModel.findOne).toHaveBeenCalled(); // Vì logic vẫn kiểm tra Class
    expect(mockReq.targetInstance).toEqual(mockReq.senderInstance);
    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 3: Thành công - targetVNUId không phải "me" và tìm thấy classInstance
  test('should assign targetInstance and call next() when classInstance is found', async () => {
    const mockTargetInstance = {
      vnu_id: 'student123',
      _id: new mongoose.Types.ObjectId(),
    };
    const mockClassInstance = {
      class_members: [mockTargetInstance._id],
      class_teacher: mockReq.senderInstance._id,
    };

    mockUserModel.findOne.mockResolvedValue(mockTargetInstance);
    mockClassModel.findOne.mockResolvedValue(mockClassInstance);

    await checkTeacherOfVNUId(mockReq, mockRes, mockNext);

    expect(mockUserModel.findOne).toHaveBeenCalledWith({ vnu_id: 'student123' });
    expect(mockClassModel.findOne).toHaveBeenCalledWith({
      class_members: mockTargetInstance._id,
      class_teacher: mockReq.senderInstance._id,
    });
    expect(mockReq.targetInstance).toEqual(mockTargetInstance);
    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 4: Thất bại - targetInstance không tìm thấy
  test('should return 404 when targetInstance is not found', async () => {
    mockUserModel.findOne.mockResolvedValue(null);

    await checkTeacherOfVNUId(mockReq, mockRes, mockNext);

    expect(mockUserModel.findOne).toHaveBeenCalledWith({ vnu_id: 'student123' });
    expect(mockClassModel.findOne).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(RES_FORM).toHaveBeenCalledWith('Error', 'Target user not found');
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Error', data: 'Target user not found' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  // Test case 5: Thất bại - classInstance không tìm thấy
  test('should return 404 when classInstance is not found', async () => {
    const mockTargetInstance = {
      vnu_id: 'student123',
      _id: new mongoose.Types.ObjectId(),
    };
    mockUserModel.findOne.mockResolvedValue(mockTargetInstance);
    mockClassModel.findOne.mockResolvedValue(null);

    await checkTeacherOfVNUId(mockReq, mockRes, mockNext);

    expect(mockUserModel.findOne).toHaveBeenCalledWith({ vnu_id: 'student123' });
    expect(mockClassModel.findOne).toHaveBeenCalledWith({
      class_members: mockTargetInstance._id,
      class_teacher: mockReq.senderInstance._id,
    });
    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(RES_FORM).toHaveBeenCalledWith('Error', 'You are not teacher of this user');
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Error',
      data: 'You are not teacher of this user',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  // Test case 6: Lỗi - senderInstance là null
  test('should throw error when senderInstance is null', async () => {
    mockReq.senderInstance = null;

    await expect(checkTeacherOfVNUId(mockReq, mockRes, mockNext)).rejects.toThrow(
      'Cannot read properties of null (reading \'vnu_id\')'
    );
    expect(mockUserModel.findOne).not.toHaveBeenCalled();
    expect(mockClassModel.findOne).not.toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
    expect(mockNext).not.toHaveBeenCalled();
  });

  // Test case 7: Lỗi - targetVNUId là null
  test('should handle targetVNUId is null', async () => {
    mockReq.params.userId = null;

    const mockTargetInstance = {
      vnu_id: 'student123',
      _id: new mongoose.Types.ObjectId(),
    };
    mockUserModel.findOne.mockResolvedValue(mockTargetInstance);
    mockClassModel.findOne.mockResolvedValue({}); // Class tồn tại để vượt qua kiểm tra

    await checkTeacherOfVNUId(mockReq, mockRes, mockNext);

    expect(mockUserModel.findOne).toHaveBeenCalledWith({ vnu_id: null });
    expect(mockClassModel.findOne).toHaveBeenCalled();
    expect(mockReq.targetInstance).toEqual(mockTargetInstance);
    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 8: Lỗi - Database query thất bại (User.findOne)
  test('should throw error when User.findOne fails', async () => {
    mockUserModel.findOne.mockRejectedValue(new Error('Database error'));

    await expect(checkTeacherOfVNUId(mockReq, mockRes, mockNext)).rejects.toThrow('Database error');
    expect(mockUserModel.findOne).toHaveBeenCalledWith({ vnu_id: 'student123' });
    expect(mockClassModel.findOne).not.toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
    expect(mockNext).not.toHaveBeenCalled();
  });

  // Test case 9: Lỗi - Database query thất bại (Class.findOne)
  test('should throw error when Class.findOne fails', async () => {
    const mockTargetInstance = {
      vnu_id: 'student123',
      _id: new mongoose.Types.ObjectId(),
    };
    mockUserModel.findOne.mockResolvedValue(mockTargetInstance);
    mockClassModel.findOne.mockRejectedValue(new Error('Database error'));

    await expect(checkTeacherOfVNUId(mockReq, mockRes, mockNext)).rejects.toThrow('Database error');
    expect(mockUserModel.findOne).toHaveBeenCalledWith({ vnu_id: 'student123' });
    expect(mockClassModel.findOne).toHaveBeenCalledWith({
      class_members: mockTargetInstance._id,
      class_teacher: mockReq.senderInstance._id,
    });
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
    expect(mockNext).not.toHaveBeenCalled();
  });

  // Test case 10: Edge case - senderInstance.vnu_id là null
  test('should handle senderInstance.vnu_id is null', async () => {
    mockReq.senderInstance.vnu_id = null;
    mockReq.params.userId = 'student123';
    const mockTargetInstance = {
      vnu_id: 'student123',
      _id: new mongoose.Types.ObjectId(),
    };
    mockUserModel.findOne.mockResolvedValue(mockTargetInstance);
    mockClassModel.findOne.mockResolvedValue({}); // Class tồn tại

    await checkTeacherOfVNUId(mockReq, mockRes, mockNext);

    expect(mockUserModel.findOne).toHaveBeenCalledWith({ vnu_id: 'student123' });
    expect(mockClassModel.findOne).toHaveBeenCalled();
    expect(mockReq.targetInstance).toEqual(mockTargetInstance);
    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 11: Edge case - targetVNUId là chuỗi rỗng
  test('should handle targetVNUId is empty string', async () => {
    mockReq.params.userId = '';
    const mockTargetInstance = {
      vnu_id: '',
      _id: new mongoose.Types.ObjectId(),
    };
    mockUserModel.findOne.mockResolvedValue(mockTargetInstance);
    mockClassModel.findOne.mockResolvedValue({}); // Class tồn tại

    await checkTeacherOfVNUId(mockReq, mockRes, mockNext);

    expect(mockUserModel.findOne).toHaveBeenCalledWith({ vnu_id: '' });
    expect(mockClassModel.findOne).toHaveBeenCalled();
    expect(mockReq.targetInstance).toEqual(mockTargetInstance);
    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });
});