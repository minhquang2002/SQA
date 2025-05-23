const { register } = require('./register');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Configs = require('./../../configs/Constants');
const { v4: uuidv4 } = require('uuid');

// Mock các module cần thiết
jest.mock('jsonwebtoken');
jest.mock('uuid');
jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose');
  return {
    ...actualMongoose,
    Types: {
      ObjectId: jest.fn((id) => id || 'mockedObjectId'),
    },
  };
});

describe('Test Register Function từ file register.js', () => {
  let req, res;

  // Dữ liệu mẫu mặc định cho req.body
  const defaultReqBody = {
    vnu_id: 'vnu123',
    name: 'Test User',
    gender: 'male',
    phone_number: '0123456789',
    role: 'student',
    email: 'test@example.com',
    location: 'Hanoi',
    dateOfBirth: '2000-01-01',
    password: 'secret',
  };

  beforeEach(() => {
    // Reset req, res và mocks trước mỗi test
    req = { body: { ...defaultReqBody } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    // Mock global.DBConnection
    global.DBConnection = {
      User: jest.fn().mockImplementation(() => ({
        save: jest.fn().mockResolvedValue({ _id: 'user123', vnu_id: req.body.vnu_id || 'mocked-uuid' }),
      })),
      LoginInfo: jest.fn().mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(true),
        current_token: 'mocked-token',
      })),
    };

    // Mock findOne riêng cho User
    global.DBConnection.User.findOne = jest.fn().mockResolvedValue(null);

    // Mock jwt.sign và uuidv4
    jwt.sign.mockReturnValue('mocked-token');
    uuidv4.mockReturnValue('mocked-uuid');
  });

  // Test case DK-01: VNU-ID đã tồn tại
  it('DK-01: Đăng ký với VNU-ID bị trùng', async () => {
    global.DBConnection.User.findOne.mockResolvedValue({ vnu_id: 'vnu123' });

    await register(req, res);

    expect(global.DBConnection.User.findOne).toHaveBeenCalledWith({ vnu_id: 'vnu123' });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(Configs.RES_FORM('Error', 'VNU-ID is already registered by someone'));
  });

  // Test case DK-02: Đăng ký thành công
  it('DK-02: Đăng ký thành công', async () => {
    await register(req, res);

    expect(global.DBConnection.User.findOne).toHaveBeenCalledWith({ vnu_id: 'vnu123' });
    expect(global.DBConnection.User).toHaveBeenCalledWith({
      vnu_id: 'vnu123',
      name: 'Test User',
      gender: 'male',
      phone_number: '0123456789',
      role: 'student',
      email: 'test@example.com',
      location: 'Hanoi',
      date_of_birth: '2000-01-01',
    });
    expect(jwt.sign).toHaveBeenCalledWith(
      { vnu_id: 'vnu123', createdDate: expect.any(Number) },
      Configs.SECRET_KEY,
      { expiresIn: 3600 }
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(Configs.RES_FORM('Success', { token: 'mocked-token' }));
  });

  // Test case DK-03: Lỗi khi lưu User
  it('DK-03: Lỗi xảy ra khi save User', async () => {
    global.DBConnection.User.mockImplementation(() => ({
      save: jest.fn().mockRejectedValue(new Error('Failed to save user')),
    }));

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(Configs.RES_FORM('Error', 'Failed to save user'));
  });

  // Test case DK-04: Lỗi khi lưu LoginInfo
  it('DK-04: Lỗi xảy ra khi save LoginInfo', async () => {
    global.DBConnection.LoginInfo.mockImplementation(() => ({
      save: jest.fn().mockRejectedValue(new Error('Failed to save login info')),
    }));

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(Configs.RES_FORM('Error', 'Failed to save login info'));
  });

  // Test case DK-05: Đăng ký không cung cấp VNU-ID (tạo UUID)
  it('DK-05: Đăng ký với VNU-ID không cung cấp', async () => {
    req.body.vnu_id = undefined;

    await register(req, res);

    expect(uuidv4).toHaveBeenCalled();
    expect(global.DBConnection.User).toHaveBeenCalledWith(
      expect.objectContaining({ vnu_id: 'mocked-uuid' })
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(Configs.RES_FORM('Error', 'VNU-ID is required'));
  });

  // Test case DK-06: Thiếu trường bắt buộc (password)
  it('DK-06: Thiếu trường password bắt buộc', async () => {
    delete req.body.password;

    global.DBConnection.LoginInfo.mockImplementation(() => ({
      save: jest.fn().mockRejectedValue(new Error('Password is required')),
    }));

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(Configs.RES_FORM('Error', 'Password is required'));
  });
});