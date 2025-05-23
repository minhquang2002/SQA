const { fAddSemester, fGetSemester, fGetAllSemester, fHandleUploadSemester } = require('../semester-middleware/semester');
const { RES_FORM } = require('../../configs/Constants');
const csv = require('csvtojson/v2');

// Mock global.DBConnection.Semester
const mockSave = jest.fn();
const mockFindOne = jest.fn();
const mockFind = jest.fn();
global.DBConnection = {
  Semester: jest.fn().mockImplementation((data) => ({
    semester_name: data.semester_name,
    semester_id: data.semester_id,
    save: mockSave
  }))
};
global.DBConnection.Semester.findOne = mockFindOne;
global.DBConnection.Semester.find = mockFind;

// Mock csvtojson
const mockFromFile = jest.fn();
jest.mock('csvtojson/v2', () => {
  return () => ({
    fromFile: mockFromFile
  });
});

// Dữ liệu mẫu
const mockSemester = {
  semester_name: 'Học kỳ 1 2023-2024',
  semester_id: 'HK123'
};
const mockSemesterList = [
  { semester_name: 'Học kỳ 1 2023-2024', semester_id: 'HK123' },
  { semester_name: 'Học kỳ 2 2023-2024', semester_id: 'HK124' }
];

describe('Kiểm thử các hàm semester trong semester.js', () => {
  let req, res;

  beforeEach(() => {
    // Mô phỏng req và res
    req = { body: { ...mockSemester }, params: { semesterId: 'HK123' } };
    res = {
      statusCode: null,
      jsonData: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.jsonData = data;
      }
    };
    // Reset mocks
    mockSave.mockReset();
    mockFindOne.mockReset();
    mockFind.mockReset();
    mockFromFile.mockReset();
  });

  // Test fAddSemester
  describe('Test Thêm kỳ học vào CSDLvới Func fAddSemester', () => {
    test('TEST-20: Thêm kỳ học thành công', async () => {
      mockSave.mockResolvedValue();

      await fAddSemester(req, res);

      expect(global.DBConnection.Semester).toHaveBeenCalledWith({
        semester_name: 'Học kỳ 1 2023-2024',
        semester_id: 'HK123'
      });
      expect(mockSave).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res.jsonData).toEqual({
        status: 'Success',
        message: 'Đã thêm kỳ học HK123: Học kỳ 1 2023-2024'
      });
    });

    test('TEST-21: Lỗi trùng lặp mã kỳ học', async () => {
      mockSave.mockRejectedValue({ code: 11000 });

      await fAddSemester(req, res);

      expect(mockSave).toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
      expect(res.jsonData).toEqual({
        status: 'Error',
        message: 'Mã kỳ học đã tồn tại'
      });
    });

    test('TEST-22: Lỗi không xác định (thiếu trường)', async () => {
      const errorMessage = 'Missing required field';
      mockSave.mockRejectedValue(new Error(errorMessage));

      await fAddSemester(req, res);

      expect(mockSave).toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
      expect(res.jsonData).toEqual({
        status: 'Error',
        message: `Lỗi không xác định. Lỗi: Error: ${errorMessage}`
      });
    });
  });

  // Test fGetSemester
  describe('Test Thêm kỳ học vào CSDLvới Func fGetSemester', () => {
    test('TEST-23: Tìm thấy kỳ học', async () => {
      mockFindOne.mockResolvedValue(mockSemester);

      await fGetSemester(req, res);

      expect(mockFindOne).toHaveBeenCalledWith({ semester_id: 'HK123' });
      expect(res.statusCode).toBe(200);
      expect(res.jsonData).toEqual({
        status: 'Success',
        message: mockSemester
      });
    });

    test('TEST-24: Không tìm thấy kỳ học', async () => {
      mockFindOne.mockResolvedValue(null);

      await fGetSemester(req, res);

      expect(mockFindOne).toHaveBeenCalledWith({ semester_id: 'HK123' });
      expect(res.statusCode).toBe(404);
      expect(res.jsonData).toEqual({
        status: 'Error',
        message: 'Mã kỳ học không tồn tại'
      });
    });
  });

  // Test fGetAllSemester
  describe('Test Thêm kỳ học vào CSDLvới Func fGetAllSemester', () => {
    test('TEST-25: Lấy danh sách kỳ học không rỗng', async () => {
      mockFind.mockResolvedValue(mockSemesterList);

      await fGetAllSemester(req, res);

      expect(mockFind).toHaveBeenCalledWith({});
      expect(res.statusCode).toBe(200);
      expect(res.jsonData).toEqual({
        status: 'Success',
        message: mockSemesterList
      });
    });

    test('TEST-26: Lấy danh sách kỳ học thất bại - DB trả về null', async () => {
        mockFind.mockResolvedValue(null); // giả lập DB trả về null

        await fGetAllSemester(req, res);

        expect(mockFind).toHaveBeenCalledWith({});
        expect(res.statusCode).toBe(404);
        expect(res.jsonData).toEqual({
            status: 'Error',
            message: 'Mã kỳ học không tồn tại'
        });
        });

  });

  // Test fHandleUploadSemester
  describe('Test Thêm kỳ học vào CSDLvới Func fHandleUploadSemester', () => {
    beforeEach(() => {
      req = { fileUploadPath: 'mock/path/to/file.csv' };
    });

    test('TEST-27: Tất cả kỳ học thêm thành công', async () => {
      mockFromFile.mockResolvedValue(mockSemesterList);
      mockSave.mockResolvedValue();

      await fHandleUploadSemester(req, res);

      expect(mockFromFile).toHaveBeenCalledWith('mock/path/to/file.csv');
      expect(mockSave).toHaveBeenCalledTimes(2);
      expect(res.statusCode).toBe(200);
      expect(res.jsonData).toEqual({
        status: 'Success',
        message: {
          registered: [
            { ...mockSemesterList[0], response: 'Đã thêm kỳ học HK123: Học kỳ 1 2023-2024' },
            { ...mockSemesterList[1], response: 'Đã thêm kỳ học HK124: Học kỳ 2 2023-2024' }
          ],
          failed: []
        }
      });
    });

    test('TEST-28: Một số kỳ học thêm thất bại', async () => {
      mockFromFile.mockResolvedValue(mockSemesterList);
      mockSave
        .mockResolvedValueOnce() // HK123 thành công
        .mockRejectedValueOnce({ code: 11000 }); // HK124 thất bại

      await fHandleUploadSemester(req, res);

      expect(mockFromFile).toHaveBeenCalledWith('mock/path/to/file.csv');
      expect(mockSave).toHaveBeenCalledTimes(2);
      expect(res.statusCode).toBe(200);
      expect(res.jsonData).toEqual({
        status: 'Success',
        message: {
          registered: [
            { ...mockSemesterList[0], response: 'Đã thêm kỳ học HK123: Học kỳ 1 2023-2024' }
          ],
          failed: [
            { ...mockSemesterList[1], error: 'Mã kỳ học đã tồn tại' }
          ]
        }
      });
    });

    test('TEST-29: Tất cả kỳ học thêm thất bại', async () => {
      mockFromFile.mockResolvedValue(mockSemesterList);
      mockSave.mockRejectedValue({ code: 11000 });

      await fHandleUploadSemester(req, res);

      expect(mockFromFile).toHaveBeenCalledWith('mock/path/to/file.csv');
      expect(mockSave).toHaveBeenCalledTimes(2);
      expect(res.statusCode).toBe(200);
      expect(res.jsonData).toEqual({
        status: 'Success',
        message: {
          registered: [],
          failed: [
            { ...mockSemesterList[0], error: 'Mã kỳ học đã tồn tại' },
            { ...mockSemesterList[1], error: 'Mã kỳ học đã tồn tại' }
          ]
        }
      });
    });

    test('TEST-30: File CSV rỗng', async () => {
      mockFromFile.mockResolvedValue([]);

      await fHandleUploadSemester(req, res);

      expect(mockFromFile).toHaveBeenCalledWith('mock/path/to/file.csv');
      expect(mockSave).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res.jsonData).toEqual({
        status: 'Success',
        message: { registered: [], failed: [] }
      });
    });

test('TEST-31: Một số kỳ học thất bại với responseJson không có message', async () => {
    mockFromFile.mockResolvedValue(mockSemesterList);
    mockSave
      .mockResolvedValueOnce() // HK123 thành công
      .mockRejectedValueOnce(new Error('Lỗi không xác định')); // HK124 thất bại, không có message

    // Mock fAddSemester trả về responseJson không hợp lệ
    jest.spyOn(require('../semester-middleware/semester'), 'fAddSemester').mockImplementation(async (req, res) => {
      if (req.body.semester_id === 'HK123') {
        res.status(200);
        res.json(RES_FORM('Success', 'Đã thêm kỳ học HK123: Học kỳ 1 2023-2024'));
      } else {
        res.status(400);
        res.json(null); // responseJson là null
      }
    });

    await fHandleUploadSemester(req, res);

    expect(mockFromFile).toHaveBeenCalledWith('mock/path/to/file.csv');
    expect(res.statusCode).toBe(200);
    expect(res.jsonData).toEqual({
      status: 'Success',
      message: {
        registered: [
          { ...mockSemesterList[0], response: 'Đã thêm kỳ học HK123: Học kỳ 1 2023-2024' }
        ],
        failed: [
          { ...mockSemesterList[1] } // Không có error do responseJson là null
        ]
      }
    });
  });

  });
});
