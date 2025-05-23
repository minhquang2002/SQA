const { fAddSubject } = require('../subject-middleware/subject');
const { RES_FORM } = require('../../configs/Constants');

// Mock global.DBConnection.Subject
const mockSave = jest.fn();
global.DBConnection = {
  Subject: jest.fn().mockImplementation((data) => ({
    subject_name: data.subject_name,
    subject_code: data.subject_code,
    credits_number: data.credits_number,
    save: mockSave
  }))
};

// Dữ liệu mẫu
const mockSubject = {
  subject_name: 'Giải tích 4',
  subject_code: 'INT10022',
  credits_number: 3
};

describe('TEST func: fAddSubject', () => {
  let req, res;

  beforeEach(() => {
    // Mô phỏng req và res
    req = {
      body: { ...mockSubject }
    };
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
  });

  // Test trường hợp thành công
  test('TEST-17: Thêm môn học thành công', async () => {
    // Mô phỏng save thành công
    mockSave.mockResolvedValue();

    await fAddSubject(req, res);

    expect(global.DBConnection.Subject).toHaveBeenCalledWith({
      subject_name: 'Giải tích 4',
      subject_code: 'INT10022',
      credits_number: 3
    });
    expect(mockSave).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.jsonData).toEqual({
      status: 'Success',
      message: 'Added INT10022 -> Giải tích 4 -> 3'
    });
  });

  // Test lỗi trùng lặp (code 11000)
  test('TEST-18: Lỗi trùng lặp subject_code hoặc subject_name', async () => {
    // Mô phỏng lỗi trùng lặp
    mockSave.mockRejectedValue({ code: 11000 });

    await fAddSubject(req, res);

    expect(mockSave).toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.jsonData).toEqual({
      status: 'Error',
      message: 'Subject code or subject name existed'
    });
  });

  // Test lỗi không xác định
  test('TEST-19: Lỗi không xác định (thiếu trường bắt buộc)', async () => {
    // Mô phỏng lỗi khác
    const errorMessage = 'Missing required field';
    mockSave.mockRejectedValue(new Error(errorMessage));

    await fAddSubject(req, res);

    expect(mockSave).toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.jsonData).toEqual({
      status: 'Error',
      message: `Unknown error. Maybe required field not found. Err message: Error: ${errorMessage}`
    });
  });

    // ADD-01: Test file rỗng (thiếu toàn bộ trường => báo lỗi)
  test('ADD-01: Dữ liệu rỗng (không có subject_name, subject_code, credits_number)', async () => {
    // Xóa hết dữ liệu trong req.body
    req.body = {};

    // Mô phỏng lỗi do thiếu trường
    const error = new Error("Missing required fields");
    mockSave.mockRejectedValue(error);

    await fAddSubject(req, res);

    expect(mockSave).toHaveBeenCalled(); // vẫn gọi nhưng thất bại
    expect(res.statusCode).toBe(400);
    expect(res.jsonData).toEqual({
      status: 'Error',
      message: `Unknown error. Maybe required field not found. Err message: Error: ${error.message}`
    });
  });

  // ADD-02: Test thêm nhiều môn học liên tiếp (batch insert)
  test('ADD-02: Thêm nhiều môn học liên tiếp', async () => {
    const subjectList = [
      { subject_name: 'Toán cao cấp', subject_code: 'MATH101', credits_number: 3 },
      { subject_name: 'Vật lý đại cương', subject_code: 'PHYS102', credits_number: 4 },
      { subject_name: 'Hóa học cơ bản', subject_code: 'CHEM103', credits_number: 2 }
    ];

    for (const subject of subjectList) {
      req.body = subject;
      mockSave.mockResolvedValueOnce();

      await fAddSubject(req, res);

      expect(global.DBConnection.Subject).toHaveBeenCalledWith(subject);
      expect(mockSave).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res.jsonData).toEqual({
        status: 'Success',
        message: `Added ${subject.subject_code} -> ${subject.subject_name} -> ${subject.credits_number}`
      });
    }
  });

});