const mongoose = require('mongoose');
const { fGetMemberBasicInfors } = require('../middleware/class-middleware/class'); // Thay bằng đường dẫn thực tế
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

describe('fGetMemberBasicInfors', () => {
  let mockReq, mockRes, mockMembers;

  beforeEach(() => {
    // Dữ liệu giả lập cho class_members
    mockMembers = [
      { _id: new mongoose.Types.ObjectId(), vnu_id: 'student1' },
      { _id: new mongoose.Types.ObjectId(), vnu_id: 'student2' },
      { _id: new mongoose.Types.ObjectId(), vnu_id: 'student3' },
    ];

    // Khởi tạo mockReq với dữ liệu hợp lệ
    mockReq = {
      classInstance: {
        populate: jest.fn().mockResolvedValue({
          class_members: mockMembers,
        }),
      },
      query: {
        limit: '2',
      },
    };
    mockRes = mockResponse();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // Test case 1: Thành công - limit hợp lệ
  test('should return limited members when limit is valid', async () => {
    const expectedMembers = mockMembers.slice(0, 2);

    await fGetMemberBasicInfors(mockReq, mockRes);

    expect(mockReq.classInstance.populate).toHaveBeenCalledWith('class_members');
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(Configs.RES_FORM).toHaveBeenCalledWith('Sucess', expectedMembers);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Sucess', data: expectedMembers });
  });

  // Test case 2: Thành công - limit lớn hơn số lượng class_members
  test('should return all members when limit exceeds class_members length', async () => {
    mockReq.query.limit = '5';
    const expectedMembers = mockMembers;

    await fGetMemberBasicInfors(mockReq, mockRes);

    expect(mockReq.classInstance.populate).toHaveBeenCalledWith('class_members');
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(Configs.RES_FORM).toHaveBeenCalledWith('Sucess', expectedMembers);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Sucess', data: expectedMembers });
  });

  // Test case 3: Thành công - limit không được cung cấp
  test('should handle undefined limit', async () => {
    mockReq.query = {};
    const expectedMembers = mockMembers.slice(0, undefined);

    await fGetMemberBasicInfors(mockReq, mockRes);

    expect(mockReq.classInstance.populate).toHaveBeenCalledWith('class_members');
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(Configs.RES_FORM).toHaveBeenCalledWith('Sucess', expectedMembers);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Sucess', data: expectedMembers });
  });

  // Test case 4: Lỗi - classInstance là null
  test('should throw error when classInstance is null', async () => {
    mockReq.classInstance = null;

    await expect(fGetMemberBasicInfors(mockReq, mockRes)).rejects.toThrow(
      'Cannot read properties of null (reading \'populate\')'
    );
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 5: Lỗi - class_members là null sau populate
  test('should throw error when class_members is null', async () => {
    mockReq.classInstance.populate.mockResolvedValue({
      class_members: null,
    });

    await expect(fGetMemberBasicInfors(mockReq, mockRes)).rejects.toThrow(
      'Cannot read properties of null (reading \'length\')'
    );
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 6: Lỗi - Populate thất bại
  test('should throw error on populate failure', async () => {
    mockReq.classInstance.populate.mockRejectedValue(new Error('Populate error'));

    await expect(fGetMemberBasicInfors(mockReq, mockRes)).rejects.toThrow('Populate error');
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 7: Edge case - limit là chuỗi không phải số
  test('should handle non-numeric limit', async () => {
    mockReq.query.limit = 'invalid';
    const expectedMembers = mockMembers.slice(0, NaN);

    await fGetMemberBasicInfors(mockReq, mockRes);

    expect(mockReq.classInstance.populate).toHaveBeenCalledWith('class_members');
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(Configs.RES_FORM).toHaveBeenCalledWith('Sucess', expectedMembers);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Sucess', data: expectedMembers });
  });

  // Test case 8: Edge case - limit là số âm
  test('should handle negative limit', async () => {
    mockReq.query.limit = '-1';
    const expectedMembers = mockMembers.slice(0, -1);

    await fGetMemberBasicInfors(mockReq, mockRes);

    expect(mockReq.classInstance.populate).toHaveBeenCalledWith('class_members');
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(Configs.RES_FORM).toHaveBeenCalledWith('Sucess', expectedMembers);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Sucess', data: expectedMembers });
  });

  // Test case 9: Edge case - limit là 0
  test('should return empty array when limit is 0', async () => {
    mockReq.query.limit = '0';
    const expectedMembers = [];

    await fGetMemberBasicInfors(mockReq, mockRes);

    expect(mockReq.classInstance.populate).toHaveBeenCalledWith('class_members');
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(Configs.RES_FORM).toHaveBeenCalledWith('Sucess', expectedMembers);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Sucess', data: expectedMembers });
  });

  // Test case 10: Edge case - class_members là mảng rỗng
  test('should return empty array when class_members is empty', async () => {
    mockReq.classInstance.populate.mockResolvedValue({
      class_members: [],
    });
    mockReq.query.limit = '2';
    const expectedMembers = [];

    await fGetMemberBasicInfors(mockReq, mockRes);

    expect(mockReq.classInstance.populate).toHaveBeenCalledWith('class_members');
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(Configs.RES_FORM).toHaveBeenCalledWith('Sucess', expectedMembers);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Sucess', data: expectedMembers });
  });

  // Test case 11: Lỗi - class_members là undefined sau populate
  test('should throw error when class_members is undefined', async () => {
    mockReq.classInstance.populate.mockResolvedValue({
      class_members: undefined,
    });

    await expect(fGetMemberBasicInfors(mockReq, mockRes)).rejects.toThrow(
      'Cannot read properties of undefined (reading \'length\')'
    );
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });
});