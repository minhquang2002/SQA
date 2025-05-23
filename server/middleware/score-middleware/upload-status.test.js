const { fHandleUploadStatus } = require('../score-middleware/score');
const csv = require('csvtojson/v2');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const { RES_FORM } = require('../../configs/Constants');

// Mock global.DBConnection
const mockSave = jest.fn();
global.DBConnection = {
  User: { findOne: jest.fn() },
  ScoresTable: jest.fn().mockImplementation((data) => ({
    user_ref: data.user_ref,
    status: data.status || [],
    save: mockSave,
  })),
};

global.DBConnection.ScoresTable.findOne = jest.fn();

const mockFromFile = jest.fn();
jest.mock('csvtojson/v2', () => {
  return () => ({
    fromFile: mockFromFile,
  });
});

// Dữ liệu mẫu
const mockStatusList = [
  { vnu_id: '19020001', status: 'Chưa nộp học phí,Chưa đủ tín' },
  { vnu_id: '19020002', status: 'Đã nộp học phí' },
];

describe('Kiểm thử hàm fHandleUploadStatus trong file score.js', () => {
  let req, res;

  beforeEach(() => {
    // Mô phỏng req và res
    req = { fileUploadPath: 'mock/path/to/file.csv' };
    res = {
      statusCode: null,
      jsonData: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.jsonData = data;
      },
    };
    // Reset mocks
    mockFromFile.mockReset();
    global.DBConnection.User.findOne.mockReset();
    global.DBConnection.ScoresTable.findOne.mockReset();
    global.DBConnection.ScoresTable.mockReset();
    mockSave.mockReset();
  });

  test('TEST-42: Tất cả status thêm thành công (ScoresTable đã tồn tại)', async () => {
    // Mô phỏng file CSV trả về danh sách status hợp lệ
    mockFromFile.mockResolvedValue(mockStatusList);
    // Mô phỏng tìm sinh viên, trả về sinh viên hợp lệ
    global.DBConnection.User.findOne.mockImplementation(({ vnu_id }) => {
      return Promise.resolve({ _id: new ObjectId(), vnu_id });
    });
    // Mô phỏng ScoresTable tồn tại
    global.DBConnection.ScoresTable.findOne.mockResolvedValue({
      _id: new ObjectId(),
      status: [],
      save: mockSave.mockResolvedValue(true),
    });

    await fHandleUploadStatus(req, res);

    // Kiểm tra gọi đọc file CSV
    expect(mockFromFile).toHaveBeenCalledWith('mock/path/to/file.csv');
    // Kiểm tra mã trạng thái HTTP
    expect(res.statusCode).toBe(200);
    // Kiểm tra kết quả trả về
    expect(res.jsonData).toEqual({
      status: 'Success',
      message: {
        registered: [
          { ...mockStatusList[0], response: 'Thêm status thành công' },
          { ...mockStatusList[1], response: 'Thêm status thành công' },
        ],
        failed: [],
      },
    });
  });

  test('TEST-43: Tất cả status thêm thành công (ScoresTable được tạo mới)', async () => {
    // Mô phỏng file CSV trả về danh sách status hợp lệ
    mockFromFile.mockResolvedValue(mockStatusList);
    // Mô phỏng tìm sinh viên, trả về sinh viên hợp lệ
    global.DBConnection.User.findOne.mockImplementation(({ vnu_id }) => {
      return Promise.resolve({ _id: new ObjectId(), vnu_id });
    });
    // Mô phỏng ScoresTable không tồn tại
    global.DBConnection.ScoresTable.findOne.mockResolvedValue(null);
    // Mô phỏng lưu ScoresTable thành công
    mockSave.mockResolvedValue(true);

    await fHandleUploadStatus(req, res);

    expect(mockFromFile).toHaveBeenCalledWith('mock/path/to/file.csv');
    expect(res.statusCode).toBe(200);
    expect(res.jsonData).toEqual({
      status: 'Success',
      message: {
        registered: [
          { ...mockStatusList[0], response: 'Thêm status thành công' },
          { ...mockStatusList[1], response: 'Thêm status thành công' },
        ],
        failed: [],
      },
    });
  });

  test('TEST-44: Tất cả status thất bại do sinh viên không tồn tại', async () => {
    // Mô phỏng file CSV trả về danh sách status
    mockFromFile.mockResolvedValue(mockStatusList);
    // Mô phỏng tìm sinh viên, không tìm thấy
    global.DBConnection.User.findOne.mockResolvedValue(null);

    await fHandleUploadStatus(req, res);

    expect(mockFromFile).toHaveBeenCalledWith('mock/path/to/file.csv');
    expect(res.statusCode).toBe(200);
    expect(res.jsonData).toEqual({
      status: 'Success',
      message: {
        registered: [],
        failed: [
          { ...mockStatusList[0], error: 'Không tìm thấy sinh viên có VNU-ID: 19020001' },
          { ...mockStatusList[1], error: 'Không tìm thấy sinh viên có VNU-ID: 19020002' },
        ],
      },
    });
  });

  test('TEST-45: Một số status thành công, một số thất bại', async () => {
    // Mô phỏng file CSV trả về danh sách status
    mockFromFile.mockResolvedValue(mockStatusList);
    // Mô phỏng tìm sinh viên, chỉ tìm thấy sinh viên đầu tiên
    global.DBConnection.User.findOne.mockImplementation(({ vnu_id }) => {
      if (vnu_id === '19020001') {
        return Promise.resolve({ _id: new ObjectId(), vnu_id });
      }
      return Promise.resolve(null);
    });
    // Mô phỏng ScoresTable tồn tại
    global.DBConnection.ScoresTable.findOne.mockResolvedValue({
      _id: new ObjectId(),
      status: [],
      save: mockSave.mockResolvedValue(true),
    });

    await fHandleUploadStatus(req, res);

    expect(mockFromFile).toHaveBeenCalledWith('mock/path/to/file.csv');
    expect(res.statusCode).toBe(200);
    expect(res.jsonData).toEqual({
      status: 'Success',
      message: {
        registered: [{ ...mockStatusList[0], response: 'Thêm status thành công' }],
        failed: [{ ...mockStatusList[1], error: 'Không tìm thấy sinh viên có VNU-ID: 19020002' }],
      },
    });
  });

    test('TEST-46: File CSV rỗng => phải trả lỗi', async () => {
    // Mô phỏng file CSV rỗng
    mockFromFile.mockResolvedValue([]);

    await fHandleUploadStatus(req, res);

    expect(mockFromFile).toHaveBeenCalledWith('mock/path/to/file.csv');
    expect(res.statusCode).toBe(400);
    expect(res.jsonData).toEqual({
        status: 'Error',
        message: 'File CSV rỗng hoặc không có dữ liệu hợp lệ',
    });
    });

    test('TEST-47: Định dạng status không hợp lệ (rỗng hoặc quá dài) => phải đưa ra lỗi', async () => {
    // Dữ liệu mẫu với status không hợp lệ
    const invalidStatusList = [
        { vnu_id: '19020001', status: '' }, // Rỗng
        { vnu_id: '19020002', status: 'a'.repeat(1000) }, // Quá dài
    ];

    // Mô phỏng file CSV trả về danh sách status không hợp lệ
    mockFromFile.mockResolvedValue(invalidStatusList);

    // Mô phỏng tìm thấy user tương ứng
    global.DBConnection.User.findOne.mockResolvedValue({ _id: new ObjectId(), vnu_id: expect.any(String) });

    // Mô phỏng tồn tại bảng điểm và phương thức save
    global.DBConnection.ScoresTable.findOne.mockResolvedValue({
        _id: new ObjectId(),
        status: [],
        save: mockSave.mockResolvedValue(true),
    });

    await fHandleUploadStatus(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonData).toEqual({
        status: 'Error',
        message: 'File chứa status không hợp lệ. Vui lòng kiểm tra lại định dạng (không được rỗng, không quá dài)',
    });
    });


  test('TEST-48: File CSV lớn (kiểm tra hiệu suất)', async () => {
    // Tạo danh sách status lớn (1000 bản ghi)
    const largeStatusList = Array(1000).fill().map((_, i) => ({
      vnu_id: `1902${i.toString().padStart(4, '0')}`,
      status: 'Chưa nộp học phí',
    }));
    // Mô phỏng file CSV trả về danh sách lớn
    mockFromFile.mockResolvedValue(largeStatusList);
    // Mô phỏng tìm sinh viên hợp lệ
    global.DBConnection.User.findOne.mockResolvedValue({ _id: new ObjectId(), vnu_id: expect.any(String) });
    // Mô phỏng ScoresTable tồn tại
    global.DBConnection.ScoresTable.findOne.mockResolvedValue({
      _id: new ObjectId(),
      status: [],
      save: mockSave.mockResolvedValue(true),
    });

    await fHandleUploadStatus(req, res);

    expect(mockFromFile).toHaveBeenCalledWith('mock/path/to/file.csv');
    expect(res.statusCode).toBe(200);
    expect(res.jsonData.message.registered.length).toBe(1000);
    expect(res.jsonData.message.failed.length).toBe(0);
  });

});