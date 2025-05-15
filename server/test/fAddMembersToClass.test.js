const mongoose = require('mongoose');
const { fAddMembersToClass } = require('../middleware/class-middleware/class'); // Cập nhật đường dẫn nếu cần
const Configs = require('../configs/Constants');

// Mock Configs.RES_FORM
jest.mock('../configs/Constants', () => ({
  RES_FORM: jest.fn((message, data) => ({ message, data })),
}));

// Mock global.DBConnection.User
const mockUserModel = {
  find: jest.fn(),
};
global.DBConnection = {
  User: mockUserModel,
};

// Mock response object
const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('fAddMembersToClass', () => {
  let mockReq, mockRes, mockMembers, mockUsers;

  beforeEach(() => {
    // Dữ liệu giả lập cho class_members
    mockMembers = [
      { _id: new mongoose.Types.ObjectId(), email: 'existing1@vnu.edu.vn' },
      { _id: new mongoose.Types.ObjectId(), email: 'existing2@vnu.edu.vn' },
    ];

    // Dữ liệu giả lập cho User.find
    mockUsers = [
      { _id: new mongoose.Types.ObjectId(), email: 'user1@vnu.edu.vn' },
      { _id: new mongoose.Types.ObjectId(), email: 'user2@vnu.edu.vn' },
    ];

    // Khởi tạo mockReq với dữ liệu hợp lệ
    mockReq = {
      classInstance: {
        class_members: mockMembers.map(m => m._id),
        populate: jest.fn().mockImplementation(() => {
          console.log('Populate called, class_members:', mockReq.classInstance.class_members);
          return Promise.resolve({ class_members: mockReq.classInstance.class_members });
        }),
        save: jest.fn().mockResolvedValue(true),
      },
      body: {
        members: JSON.stringify(['user1@vnu.edu.vn', 'user2@vnu.edu.vn', 'notfound@vnu.edu.vn']),
      },
    };
    mockRes = mockResponse();

    // Mock User.find
    mockUserModel.find.mockImplementation(({ email }) => {
      console.log('User.find called with:', email);
      return Promise.resolve(mockUsers.filter(u => email.$in.includes(u.email)));
    });

    jest.clearAllMocks();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // Test case 1: Thành công - Thêm một số email hợp lệ, một số không tồn tại
  test('should add valid emails and return registered and failed', async () => {
    const expectedAdded = [
      { email: 'user1@vnu.edu.vn' },
      { email: 'user2@vnu.edu.vn' },
    ];
    const expectedFailed = [
      { email: 'notfound@vnu.edu.vn', error: 'Email không tồn tại trong hệ thống hoặc đã được thêm rồi' },
    ];
    const expectedMembers = [...mockMembers, ...mockUsers];

    await fAddMembersToClass(mockReq, mockRes);

    console.log('Test 1 class_members:', mockReq.classInstance.class_members);
    expect(mockUserModel.find).toHaveBeenCalledWith({ email: { $in: ['user1@vnu.edu.vn', 'user2@vnu.edu.vn', 'notfound@vnu.edu.vn'] } });
    expect(mockReq.classInstance.populate).toHaveBeenCalledWith('class_members');
    expect(mockReq.classInstance.save).toHaveBeenCalled();
    expect(mockReq.classInstance.class_members).toEqual(expectedMembers.map(m => m._id));
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(Configs.RES_FORM).toHaveBeenCalledWith('Success', {
      members: expectedMembers.map(m => m._id.toHexString()),
      registered: expectedAdded,
      failed: expectedFailed,
    });
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Success',
      data: { members: expectedMembers.map(m => m._id.toHexString()), registered: expectedAdded, failed: expectedFailed },
    });
  });

  // Test case 2: Thành công - Thêm tất cả email hợp lệ
  test('should add all valid emails and return empty failed', async () => {
    mockReq.body.members = JSON.stringify(['user1@vnu.edu.vn', 'user2@vnu.edu.vn']);
    const expectedAdded = [
      { email: 'user1@vnu.edu.vn' },
      { email: 'user2@vnu.edu.vn' },
    ];
    const expectedFailed = [];
    const expectedMembers = [...mockMembers, ...mockUsers];

    await fAddMembersToClass(mockReq, mockRes);

    console.log('Test 2 class_members:', mockReq.classInstance.class_members);
    expect(mockUserModel.find).toHaveBeenCalledWith({ email: { $in: ['user1@vnu.edu.vn', 'user2@vnu.edu.vn'] } });
    expect(mockReq.classInstance.populate).toHaveBeenCalledWith('class_members');
    expect(mockReq.classInstance.save).toHaveBeenCalled();
    expect(mockReq.classInstance.class_members).toEqual(expectedMembers.map(m => m._id));
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(Configs.RES_FORM).toHaveBeenCalledWith('Success', {
      members: expectedMembers.map(m => m._id.toHexString()),
      registered: expectedAdded,
      failed: expectedFailed,
    });
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Success',
      data: { members: expectedMembers.map(m => m._id.toHexString()), registered: expectedAdded, failed: expectedFailed },
    });
  });

  // Test case 3: Thành công - membersVNUEmails chứa email không tồn tại
  test('should handle non-existent emails and return failed', async () => {
    mockReq.body.members = JSON.stringify(['notfound1@vnu.edu.vn', 'notfound2@vnu.edu.vn']);
    mockUserModel.find.mockResolvedValue([]);
    const expectedAdded = [];
    const expectedFailed = [
      { email: 'notfound1@vnu.edu.vn', error: 'Email không tồn tại trong hệ thống hoặc đã được thêm rồi' },
      { email: 'notfound2@vnu.edu.vn', error: 'Email không tồn tại trong hệ thống hoặc đã được thêm rồi' },
    ];
    const expectedMembers = mockMembers;

    await fAddMembersToClass(mockReq, mockRes);

    console.log('Test 3 class_members:', mockReq.classInstance.class_members);
    expect(mockUserModel.find).toHaveBeenCalledWith({ email: { $in: ['notfound1@vnu.edu.vn', 'notfound2@vnu.edu.vn'] } });
    expect(mockReq.classInstance.populate).toHaveBeenCalledWith('class_members');
    expect(mockReq.classInstance.save).toHaveBeenCalled();
    expect(mockReq.classInstance.class_members).toEqual(expectedMembers.map(m => m._id));
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(Configs.RES_FORM).toHaveBeenCalledWith('Success', {
      members: expectedMembers.map(m => m._id.toHexString()),
      registered: expectedAdded,
      failed: expectedFailed,
    });
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Success',
      data: { members: expectedMembers.map(m => m._id.toHexString()), registered: expectedAdded, failed: expectedFailed },
    });
  });

  // Test case 4: Thành công - membersVNUEmails là mảng rỗng
  test('should handle empty members array', async () => {
    mockReq.body.members = JSON.stringify([]);
    const expectedAdded = [];
    const expectedFailed = [];
    const expectedMembers = mockMembers;

    await fAddMembersToClass(mockReq, mockRes);

    console.log('Test 4 class_members:', mockReq.classInstance.class_members);
    expect(mockUserModel.find).toHaveBeenCalledWith({ email: { $in: [] } });
    expect(mockReq.classInstance.populate).toHaveBeenCalledWith('class_members');
    expect(mockReq.classInstance.save).toHaveBeenCalled();
    expect(mockReq.classInstance.class_members).toEqual(expectedMembers.map(m => m._id));
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(Configs.RES_FORM).toHaveBeenCalledWith('Success', {
      members: expectedMembers.map(m => m._id.toHexString()),
      registered: expectedAdded,
      failed: expectedFailed,
    });
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Success',
      data: { members: expectedMembers.map(m => m._id.toHexString()), registered: expectedAdded, failed: expectedFailed },
    });
  });

  // Test case 5: Lỗi - members không phải JSON hợp lệ
  test('should throw error for invalid JSON members', async () => {
    mockReq.body.members = 'invalid_json';

    await expect(fAddMembersToClass(mockReq, mockRes)).rejects.toThrow('membersVNUEmails is not iterable');
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      Status: 'Error',
      Message: 'Array Members Invalid',
    });
    expect(mockUserModel.find).not.toHaveBeenCalled();
    expect(mockReq.classInstance.save).not.toHaveBeenCalled();
    expect(mockReq.classInstance.populate).not.toHaveBeenCalled();
  });

  // Test case 6: Lỗi - classInstance là null
  test('should throw error when classInstance is null', async () => {
    mockReq.classInstance = null;

    await expect(fAddMembersToClass(mockReq, mockRes)).rejects.toThrow(
      'Cannot read properties of null (reading \'class_members\')'
    );
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
    expect(mockUserModel.find).not.toHaveBeenCalled();
  });

  // Test case 7: Lỗi - class_members là null
  test('should throw error when class_members is null', async () => {
    mockReq.classInstance.class_members = null;

    await expect(fAddMembersToClass(mockReq, mockRes)).rejects.toThrow(
      'Cannot read properties of null (reading \'length\')'
    );
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
    expect(mockUserModel.find).not.toHaveBeenCalled();
    expect(mockReq.classInstance.save).not.toHaveBeenCalled();
  });

  // Test case 8: Lỗi - Populate thất bại
  test('should throw error on populate failure', async () => {
    mockReq.classInstance.populate.mockRejectedValue(new Error('Populate error'));

    await expect(fAddMembersToClass(mockReq, mockRes)).rejects.toThrow('Populate error');
    expect(mockUserModel.find).toHaveBeenCalled();
    expect(mockReq.classInstance.save).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 9: Lỗi - Save thất bại
  test('should throw error on save failure', async () => {
    mockReq.classInstance.save.mockRejectedValue(new Error('Save error'));

    await expect(fAddMembersToClass(mockReq, mockRes)).rejects.toThrow('Save error');
    expect(mockUserModel.find).toHaveBeenCalled();
    expect(mockReq.classInstance.populate).not.toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  // Test case 10: Edge case - membersVNUEmails chứa giá trị không phải chuỗi
  test('should handle non-string membersVNUEmails', async () => {
    mockReq.body.members = JSON.stringify(['user1@vnu.edu.vn', 123, { email: 'user2@vnu.edu.vn' }]);
    const expectedAdded = [{ email: 'user1@vnu.edu.vn' }];
    const expectedFailed = [
      { email: 123, error: 'Email không tồn tại trong hệ thống hoặc đã được thêm rồi' },
      { email: { email: 'user2@vnu.edu.vn' }, error: 'Email không tồn tại trong hệ thống hoặc đã được thêm rồi' },
    ];
    const expectedMembers = [...mockMembers, mockUsers[0]];

    await fAddMembersToClass(mockReq, mockRes);

    console.log('Test 10 class_members:', mockReq.classInstance.class_members);
    expect(mockUserModel.find).toHaveBeenCalledWith({ email: { $in: ['user1@vnu.edu.vn', 123, { email: 'user2@vnu.edu.vn' }] } });
    expect(mockReq.classInstance.populate).toHaveBeenCalledWith('class_members');
    expect(mockReq.classInstance.save).toHaveBeenCalled();
    expect(mockReq.classInstance.class_members).toEqual(expectedMembers.map(m => m._id));
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(Configs.RES_FORM).toHaveBeenCalledWith('Success', {
      members: expectedMembers.map(m => m._id.toHexString()),
      registered: expectedAdded,
      failed: expectedFailed,
    });
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Success',
      data: { members: expectedMembers.map(m => m._id.toHexString()), registered: expectedAdded, failed: expectedFailed },
    });
  });

  // Test case 11: Edge case - class_members là mảng rỗng
  test('should handle empty class_members', async () => {
    mockReq.classInstance.class_members = [];
    mockReq.classInstance.populate.mockImplementation(() => {
      console.log('Test 11 populate, class_members:', mockReq.classInstance.class_members);
      return Promise.resolve({ class_members: mockReq.classInstance.class_members });
    });
    const expectedAdded = [
      { email: 'user1@vnu.edu.vn' },
      { email: 'user2@vnu.edu.vn' },
    ];
    const expectedFailed = [
      { email: 'notfound@vnu.edu.vn', error: 'Email không tồn tại trong hệ thống hoặc đã được thêm rồi' },
    ];
    const expectedMembers = mockUsers;

    await fAddMembersToClass(mockReq, mockRes);

    console.log('Test 11 class_members:', mockReq.classInstance.class_members);
    expect(mockUserModel.find).toHaveBeenCalledWith({ email: { $in: ['user1@vnu.edu.vn', 'user2@vnu.edu.vn', 'notfound@vnu.edu.vn'] } });
    expect(mockReq.classInstance.populate).toHaveBeenCalledWith('class_members');
    expect(mockReq.classInstance.save).toHaveBeenCalled();
    expect(mockReq.classInstance.class_members).toEqual(expectedMembers.map(m => m._id));
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(Configs.RES_FORM).toHaveBeenCalledWith('Success', {
      members: expectedMembers.map(m => m._id.toHexString()),
      registered: expectedAdded,
      failed: expectedFailed,
    });
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Success',
      data: { members: expectedMembers.map(m => m._id.toHexString()), registered: expectedAdded, failed: expectedFailed },
    });
  });

  // Test case 12: Edge case - req.body.members là undefined
  test('should throw error when members is undefined', async () => {
    mockReq.body = {};

    await expect(fAddMembersToClass(mockReq, mockRes)).rejects.toThrow('membersVNUEmails is not iterable');
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      Status: 'Error',
      Message: 'Array Members Invalid',
    });
    expect(mockUserModel.find).not.toHaveBeenCalled();
    expect(mockReq.classInstance.save).not.toHaveBeenCalled();
    expect(mockReq.classInstance.populate).not.toHaveBeenCalled();
  });
});