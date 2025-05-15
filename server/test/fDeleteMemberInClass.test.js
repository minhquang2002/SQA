const mongoose = require('mongoose');
const { fDeleteMemberInClass } = require('../middleware/class-middleware/class'); // Thay bằng đường dẫn thực tế
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

describe('fDeleteMemberInClass', () => {
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
        class_members: mockMembers,
        save: jest.fn().mockResolvedValue(true),
      },
      body: {
        members: JSON.stringify(['student1', 'student2', 'student4']),
      },
    };
    mockRes = mockResponse();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // Test case 1: Thành công - Xóa một số thành viên hợp lệ
  test('should delete valid members and return deleted and failed', async () => {
    const expectedDeleted = mockMembers.slice(0, 2); // student1, student2
    const expectedFailed = ['student4'];

    await fDeleteMemberInClass(mockReq, mockRes);

    expect(mockReq.classInstance.populate).toHaveBeenCalledWith('class_members');
    expect(mockReq.classInstance.save).toHaveBeenCalled();
    expect(mockReq.classInstance.class_members).toEqual([mockMembers[2]._id]);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(Configs.RES_FORM).toHaveBeenCalledWith('Success', {
      deleted: expectedDeleted,
      failed: expectedFailed,
    });
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Success',
      data: { deleted: expectedDeleted, failed: expectedFailed },
    });
  });

  // Test case 2: Thành công - Xóa tất cả thành viên trong membersVNUId
  test('should delete all members and return empty failed', async () => {
    mockReq.body.members = JSON.stringify(['student1', 'student2', 'student3']);
    const expectedDeleted = mockMembers;
    const expectedFailed = [];

    await fDeleteMemberInClass(mockReq, mockRes);

    expect(mockReq.classInstance.populate).toHaveBeenCalledWith('class_members');
    expect(mockReq.classInstance.save).toHaveBeenCalled();
    expect(mockReq.classInstance.class_members).toEqual([]);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(Configs.RES_FORM).toHaveBeenCalledWith('Success', {
      deleted: expectedDeleted,
      failed: expectedFailed,
    });
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Success',
      data: { deleted: expectedDeleted, failed: expectedFailed },
    });
  });

  // Test case 3: Thành công - membersVNUId chứa ID không tồn tại
  test('should handle non-existent member IDs and return failed', async () => {
    mockReq.body.members = JSON.stringify(['student4', 'student5']);
    const expectedDeleted = [];
    const expectedFailed = ['student4', 'student5'];

    await fDeleteMemberInClass(mockReq, mockRes);

    expect(mockReq.classInstance.populate).toHaveBeenCalledWith('class_members');
    expect(mockReq.classInstance.save).toHaveBeenCalled();
    expect(mockReq.classInstance.class_members).toEqual(mockMembers.map(m => m._id));
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(Configs.RES_FORM).toHaveBeenCalledWith('Success', {
      deleted: expectedDeleted,
      failed: expectedFailed,
    });
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Success',
      data: { deleted: expectedDeleted, failed: expectedFailed },
    });
  });

  // Test case 4: Thành công - membersVNUId là mảng rỗng
  test('should handle empty members array', async () => {
    mockReq.body.members = JSON.stringify([]);
    const expectedDeleted = [];
    const expectedFailed = [];

    await fDeleteMemberInClass(mockReq, mockRes);

    expect(mockReq.classInstance.populate).toHaveBeenCalledWith('class_members');
    expect(mockReq.classInstance.save).toHaveBeenCalled();
    expect(mockReq.classInstance.class_members).toEqual(mockMembers.map(m => m._id));
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(Configs.RES_FORM).toHaveBeenCalledWith('Success', {
      deleted: expectedDeleted,
      failed: expectedFailed,
    });
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Success',
      data: { deleted: expectedDeleted, failed: expectedFailed },
    });
  });

  // Test case 5: Thất bại - members không phải JSON hợp lệ
  test('should return 400 for invalid JSON members', async () => {
    mockReq.body.members = 'invalid_json';

    await fDeleteMemberInClass(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(Configs.RES_FORM).toHaveBeenCalledWith('Error', 'Array members invalid');
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Error',
      data: 'Array members invalid',
    });
    expect(mockReq.classInstance.populate).not.toHaveBeenCalled();
    expect(mockReq.classInstance.save).not.toHaveBeenCalled();
  });

  // Test case 6: Lỗi - classInstance là null
  test('should throw error when classInstance is null', async () => {
    mockReq.classInstance = null;

    await expect(fDeleteMemberInClass(mockReq, mockRes)).rejects.toThrow(
      'Cannot read properties of null (reading \'populate\')'
    );
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 7: Lỗi - class_members là null sau populate
  test('should throw error when class_members is null', async () => {
    mockReq.classInstance.populate.mockResolvedValue({
      class_members: null,
    });
    mockReq.classInstance.class_members = null;

    await expect(fDeleteMemberInClass(mockReq, mockRes)).rejects.toThrow('curMembers is not iterable');
    expect(mockReq.classInstance.populate).toHaveBeenCalledWith('class_members');
    expect(mockReq.classInstance.save).not.toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 8: Lỗi - Populate thất bại
  test('should throw error on populate failure', async () => {
    mockReq.classInstance.populate.mockRejectedValue(new Error('Populate error'));

    await expect(fDeleteMemberInClass(mockReq, mockRes)).rejects.toThrow('Populate error');
    expect(mockReq.classInstance.save).not.toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 9: Lỗi - Save thất bại
  test('should throw error on save failure', async () => {
    mockReq.classInstance.save.mockRejectedValue(new Error('Save error'));

    await expect(fDeleteMemberInClass(mockReq, mockRes)).rejects.toThrow('Save error');
    expect(mockReq.classInstance.populate).toHaveBeenCalledWith('class_members');
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 10: Edge case - membersVNUId chứa giá trị không phải chuỗi
  test('should handle non-string membersVNUId', async () => {
    mockReq.body.members = JSON.stringify(['student1', 123, { id: 'student2' }]);
    const expectedDeleted = [mockMembers[0]];
    const expectedFailed = [123, { id: 'student2' }];

    await fDeleteMemberInClass(mockReq, mockRes);

    expect(mockReq.classInstance.populate).toHaveBeenCalledWith('class_members');
    expect(mockReq.classInstance.save).toHaveBeenCalled();
    expect(mockReq.classInstance.class_members).toEqual([mockMembers[1]._id, mockMembers[2]._id]);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(Configs.RES_FORM).toHaveBeenCalledWith('Success', {
      deleted: expectedDeleted,
      failed: expectedFailed,
    });
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Success',
      data: { deleted: expectedDeleted, failed: expectedFailed },
    });
  });

  // Test case 11: Edge case - class_members là mảng rỗng
  test('should handle empty class_members', async () => {
    mockReq.classInstance.populate.mockResolvedValue({
      class_members: [],
    });
    mockReq.classInstance.class_members = [];
    const expectedDeleted = [];
    const expectedFailed = ['student1', 'student2', 'student4'];

    await fDeleteMemberInClass(mockReq, mockRes);

    expect(mockReq.classInstance.populate).toHaveBeenCalledWith('class_members');
    expect(mockReq.classInstance.save).toHaveBeenCalled();
    expect(mockReq.classInstance.class_members).toEqual([]);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(Configs.RES_FORM).toHaveBeenCalledWith('Success', {
      deleted: expectedDeleted,
      failed: expectedFailed,
    });
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Success',
      data: { deleted: expectedDeleted, failed: expectedFailed },
    });
  });

  // Test case 12: Edge case - req.body.members là undefined
  test('should throw error when members is undefined', async () => {
    mockReq.body = {};

    await expect(fDeleteMemberInClass(mockReq, mockRes)).rejects.toThrow(
      'Cannot read properties of undefined (reading \'members\')'
    );
    expect(mockReq.classInstance.populate).not.toHaveBeenCalled();
    expect(mockReq.classInstance.save).not.toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });
});