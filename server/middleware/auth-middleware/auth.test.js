

const httpMocks = require('node-mocks-http');
const { validateToken, checkIsAdmin, validateLoginArgument, login, fForgetPassword } = require('./auth');
const Configs = require('./../../configs/Constants');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const smtpTransport = require('nodemailer-smtp-transport');
const { v4: uuidv4 } = require('uuid');

// Mock các module cần thiết
jest.mock('jsonwebtoken');
jest.mock('nodemailer');
jest.mock('nodemailer-smtp-transport');
jest.mock('uuid', () => ({ v4: jest.fn(() => 'new-random-password') }));
jest.mock('./../../configs/Constants', () => ({
  RES_FORM: jest.fn((type, message) => ({ type, message })),
  AUTH_STATE: {
    UNAUTHORIZED: 0,
    AUTHORIZED: 1,
    AUTHORIZE_EXPRIED: 2,
    INVALID_AUTHORIZED: 3,
  },
  SECRET_KEY: 'secret',
}));

describe('Unit Test - auth.js', () => {
  let req, res, next;

  beforeEach(() => {
    // Khởi tạo req, res, next
    req = httpMocks.createRequest();
    res = httpMocks.createResponse();
    next = jest.fn();

    // Mock DBConnection
    global.DBConnection = {
      User: { findOne: jest.fn() },
      LoginInfo: {
        findOne: jest.fn(),
        findOneAndUpdate: jest.fn(),
      },
    };

    // Reset mocks
    jest.clearAllMocks();

    // Mock jwt.sign
    jwt.sign.mockReturnValue('mocked-token');

    // Mock Configs.RES_FORM
    Configs.RES_FORM.mockImplementation((type, message) => ({ type, message }));
  });

  // Test validateToken
  describe('validateToken middleware', () => {
    beforeEach(() => {
      req.cookies = { token: 'valid-token' };
      global.DBConnection.LoginInfo.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          user_ref: { vnu_id: 'user123', role: 'user', name: 'Test User' },
        }),
      });
    });

    it('TC-01: Không có token trong cookie', async () => {
      req.cookies.token = undefined;

      await validateToken(req, res, next);

      expect(res.statusCode).toBe(404);
      expect(res._getData()).toEqual(Configs.RES_FORM('Error', { name: 'TokenNotFound', description: '' }));
      expect(next).not.toHaveBeenCalled();
    });
  });

  // Test checkIsAdmin
  describe('checkIsAdmin middleware', () => {
    it('TC-02: Người dùng là admin', () => {
      req.isAdmin = true;

      checkIsAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    });

    test("TC-03 - Người dùng không phải admin => chặn lại và trả lỗi", () => {
      req.isAdmin = false;
  
      // mock lại các method vì req.status() và req.json() không có sẵn
      req.status = jest.fn().mockReturnValue(req);
      req.json = jest.fn();
  
      checkIsAdmin(req, res, next);
  
      // Kiểm tra không được gọi next()
      expect(next).not.toBeCalled();
  
      // Kiểm tra status 400 được gửi
      expect(req.status).toBeCalledWith(400);
  
      // Kiểm tra nội dung thông báo lỗi được gửi
      expect(req.json).toBeCalledWith(
        Configs.RES_FORM("Error", "Cần quyền của quản trị viên để thực hiện thao tác này")
      );
    });
  });

  // Test validateLoginArgument
  describe('validateLoginArgument middleware', () => {
    beforeEach(() => {
      req.body = {};
    });

    it('TC-04: Đầy đủ username và password', () => {
      req.body = { username: 'user123', password: 'pass123' };

      validateLoginArgument(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    });

    it('TC-05: Thiếu username', () => {
      req.body = { password: 'pass123' };

      validateLoginArgument(req, res, next);

      expect(res.statusCode).toBe(400);
      expect(res._getJSONData()).toEqual(
        Configs.RES_FORM('Error', 'Username and password must be filled')
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('TC-06: Thiếu password', () => {
      req.body = { username: 'user123' };

      validateLoginArgument(req, res, next);

      expect(res.statusCode).toBe(400);
      expect(res._getJSONData()).toEqual(
        Configs.RES_FORM('Error', 'Username and password must be filled')
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('TC-07: Thiếu cả username và password', () => {
      req.body = {};

      validateLoginArgument(req, res, next);

      expect(res.statusCode).toBe(400);
      expect(res._getJSONData()).toEqual(
        Configs.RES_FORM('Error', 'Username and password must be filled')
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  // Test login
  describe('login function', () => {
    beforeEach(() => {
      req.body = { username: 'user123', password: 'pass123' };
    });

    it('TC-08: Không tìm thấy user', async () => {
      global.DBConnection.User.findOne.mockResolvedValue(null);

      await login(req, res);

      expect(res.statusCode).toBe(400);
      expect(res._getJSONData()).toEqual(
        Configs.RES_FORM('Error', 'Username hoặc Password chưa đúng')
      );
    });

    it('TC-09: Sai password', async () => {
      global.DBConnection.User.findOne.mockResolvedValue({ _id: 'user123' });
      global.DBConnection.LoginInfo.findOne.mockImplementation((query, callback) => {
        callback(null, null);
      });

      await login(req, res);

      expect(res.statusCode).toBe(400);
      expect(res._getJSONData()).toEqual(
        Configs.RES_FORM('Error', 'Username hoặc Password chưa đúng')
      );
    });

    it('TC-10: Đăng nhập thành công', async () => {
      const user = { _id: 'user123' };
      const instance = { user_ref: user._id, save: jest.fn(), current_token: null };
      global.DBConnection.User.findOne.mockResolvedValue(user);
      global.DBConnection.LoginInfo.findOne.mockImplementation((query, callback) => {
        callback(null, instance);
      });

      await login(req, res);

      expect(jwt.sign).toHaveBeenCalledWith(
        { id: user._id.toString(), createdDate: expect.any(Number) },
        Configs.SECRET_KEY,
        { expiresIn: '2 days' }
      );
      expect(instance.save).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res._getJSONData()).toEqual(
        Configs.RES_FORM('Logged In Success', { token: 'mocked-token' })
      );
    });

    it('TC-18: Lỗi DB trong LoginInfo.findOne', async () => {
      global.DBConnection.User.findOne.mockResolvedValue({ _id: 'user123' });
      global.DBConnection.LoginInfo.findOne.mockImplementation((query, callback) => {
        callback(new Error('DB error'), null);
      });

      await login(req, res);

      expect(res.statusCode).toBe(400);
      expect(res._getJSONData()).toEqual(
        Configs.RES_FORM('Error', 'Username hoặc Password chưa đúng')
      );
    });
  });

  // Test fForgetPassword
  describe('fForgetPassword function', () => {
    beforeEach(() => {
      req.body = { email: 'test@example.com' };
      nodemailer.createTransport.mockReturnValue({
        sendMail: jest.fn((options, cb) => cb(null, { response: 'OK' })),
      });
    });

    it('TC-11: Không tìm thấy email', async () => {
      global.DBConnection.User.findOne.mockResolvedValue(null);

      await fForgetPassword(req, res);

      expect(res.statusCode).toBe(404);
      expect(res._getJSONData()).toEqual(
        Configs.RES_FORM('Error', 'Email không tồn tại trong hệ thống')
      );
    });

    it('TC-12: Cập nhật mật khẩu thất bại', async () => {
      global.DBConnection.User.findOne.mockResolvedValue({ _id: 'user123', email: 'test@example.com' });
      global.DBConnection.LoginInfo.findOneAndUpdate.mockResolvedValue(null);

      await fForgetPassword(req, res);

      expect(res.statusCode).toBe(404);
      expect(res._getJSONData()).toEqual(Configs.RES_FORM('Error', 'Cập nhật mật khẩu thất bại. Có lỗi xảy ra'));
    });

    it('TC-13: Gửi email thất bại', async () => {
      global.DBConnection.User.findOne.mockResolvedValue({ _id: 'user123', email: 'test@example.com' });
      global.DBConnection.LoginInfo.findOneAndUpdate.mockResolvedValue({ user_ref: 'user123' });
      nodemailer.createTransport.mockReturnValue({
        sendMail: jest.fn((options, cb) => cb(new Error('Send Error'), null)),
      });

      await fForgetPassword(req, res);

      expect(res.statusCode).toBe(404);
      expect(res._getJSONData()).toEqual(Configs.RES_FORM('Error', 'Gửi email thất bại, có lỗi xảy ra'));
    });

    it('TC-14: Gửi email thành công', async () => {
      global.DBConnection.User.findOne.mockResolvedValue({ _id: 'user123', email: 'test@example.com' });
      global.DBConnection.LoginInfo.findOneAndUpdate.mockResolvedValue({ user_ref: 'user123' });

      await fForgetPassword(req, res);

      expect(uuidv4).toHaveBeenCalled();
      expect(nodemailer.createTransport).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res._getJSONData()).toEqual(Configs.RES_FORM('Success', 'Khôi phục thành công'));
    });
  });
});