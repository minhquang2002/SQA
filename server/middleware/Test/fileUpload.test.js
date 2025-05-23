

const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { handleUploadFile, fHandleUploadFile, fHandleUploadDSSV, fHandleUploadDSCV, fHandleUploadDSMH } = require('../upload-middleware/upload');
const httpMocks = require('node-mocks-http');
const csv = require('csvtojson');
const { register } = require('../auth-middleware/register');
const { fAddSubject } = require('../subject-middleware/subject');
const { RES_FORM } = require('../../configs/Constants');

// Mock uuid
jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

// Mock csvtojson
const mockFromFile = jest.fn();
jest.mock('csvtojson', () => {
  return () => ({
    fromFile: mockFromFile
  });
});

// Mock dependencies
jest.mock('../auth-middleware/register', () => ({
  register: jest.fn()
}));
jest.mock('../subject-middleware/subject', () => ({
  fAddSubject: jest.fn()
}));

// Dữ liệu mẫu
const mockCSVData = [
  { email: 'sv1@mail.com', name: 'Student 1' },
  { email: 'sv2@mail.com', name: 'Student 2' },
  { email: 'sv3@mail.com', name: 'Student 3' }
];

const mockCSVDataSubjects = [
  { subject_name: 'Giải tích 4', subject_code: 'INT10022', credits_number: 3 },
  { subject_name: 'Lập trình', subject_code: 'INT10023', credits_number: 4 }
];

const mockCSVDataTeachers = [
  {
    date_of_birth: '2001-01-19T00:00:00Z',
    email: 'hoanghuubach@gmail.com',
    location: 'Nam Từ Liêm',
    name: 'Hoàng Hữu Bách',
    role: 'teacher',
    vnu_id: '19029999',
    username: 'bachgv',
    password: 'bach',
    gender: 'male',
    phone_number: '02103748902'
  },
  {
    date_of_birth: '1995-05-20T00:00:00Z',
    email: 'tranvanc@example.com',
    location: 'Cầu Giấy',
    name: 'Trần Văn C',
    role: 'teacher',
    vnu_id: '19030000',
    username: 'tranvc',
    password: 'tran',
    gender: 'male',
    phone_number: '0987654321'
  }
];

describe('Kiểm thử upload file', () => {
  // Test handleUploadFile
  describe('Test handleUploadFile', () => {
    test('TEST-01: Không có file upload => trả về mã lỗi 400', () => {
      const req = httpMocks.createRequest({ method: 'POST', files: {} });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      handleUploadFile(req, res, next);

      expect(res.statusCode).toBe(400);
      expect(res._getData()).toBe('No files were uploaded.');
      expect(next).not.toBeCalled();
    });

    test('TEST-02: File có đuôi mở rộng => gán đúng fileName, filePath, gọi next()', done => {
      const mvMock = jest.fn((path, cb) => cb(null));
      const fileMock = { name: 'myfile.csv', mv: mvMock };
      const req = httpMocks.createRequest({ method: 'POST', files: { file: fileMock } });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      handleUploadFile(req, res, next);

      setTimeout(() => {
        expect(req.fileName).toBe('mock-uuid.csv');
        expect(req.fileUploadPath).toContain('mock-uuid.csv');
        expect(mvMock).toBeCalledWith(expect.stringContaining('mock-uuid.csv'), expect.any(Function));
        expect(next).toBeCalled();
        done();
      }, 10);
    });

    test('TEST-03: File không có đuôi mở rộng => trả lỗi "File sai định dạng"', () => {
      const mvMock = jest.fn((path, cb) => cb(null));
      const fileMock = { name: 'myfile', mv: mvMock };
      const req = httpMocks.createRequest({ method: 'POST', files: { file: fileMock } });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      handleUploadFile(req, res, next);

      expect(res.statusCode).toBe(400);
      expect(res._getData()).toBe('File sai định dạng, chỉ chấp nhận file .csv'); // text instead of JSON
      expect(next).not.toBeCalled();
    });

    test('TEST-04: Gặp lỗi khi lưu file => trả về mã lỗi 500', done => {
      const mvMock = jest.fn((path, cb) => cb('Lỗi giả lập khi lưu'));
      const fileMock = { name: 'data.csv', mv: mvMock };
      const req = httpMocks.createRequest({ method: 'POST', files: { file: fileMock } });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      handleUploadFile(req, res, next);

      setTimeout(() => {
        expect(res.statusCode).toBe(500);
        expect(res._getData()).toBe('Lỗi giả lập khi lưu');
        expect(next).not.toBeCalled();
        done();
      }, 10);
    });
  });

  // Test fHandleUploadFile
  describe('Test fHandleUploadFile', () => {
    test('TEST-05: Trả về JSON với link file hợp lệ', () => {
      const req = httpMocks.createRequest({ method: 'POST', fileName: 'mock-uuid.csv' });
      const res = httpMocks.createResponse();

      fHandleUploadFile(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._getJSONData()).toEqual({
        status: 'Success',
        message: { link: '/public/data/mock-uuid.csv' }
      });
    });
  });

  // Test fHandleUploadDSSV
  describe('Test function fHandleUploadDSSV trong file upload.js', () => {
    let req, res;

    beforeEach(() => {
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
        }
      };
    });

    test('TEST-06: Tất cả sinh viên đăng ký thành công', async () => {
      mockFromFile.mockResolvedValue(mockCSVData);
      register.mockImplementation(async (req, res) => {
        res.status(200);
      });

      await fHandleUploadDSSV(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.status).toBe('Success');
      expect(res.jsonData.message.registered.length).toBe(3);
      expect(res.jsonData.message.failed.length).toBe(0);
    });

    test('TEST-07: Một vài sinh viên đăng ký thất bại', async () => {
      mockFromFile.mockResolvedValue(mockCSVData);
      register.mockImplementation(async (req, res) => {
        if (req.body.email === 'sv2@mail.com') {
          res.status(400);
          res.json({ message: 'Email đã tồn tại' });
        } else {
          res.status(200);
        }
      });

      await fHandleUploadDSSV(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.message.registered.length).toBe(2);
      expect(res.jsonData.message.failed.length).toBe(1);
      expect(res.jsonData.message.failed[0].email).toBe('sv2@mail.com');
      expect(res.jsonData.message.failed[0].error).toBe('Email đã tồn tại');
    });

    test('TEST-08: Tất cả sinh viên đăng ký thất bại', async () => {
      mockFromFile.mockResolvedValue(mockCSVData);
      register.mockImplementation(async (req, res) => {
        res.status(400);
        res.json({ message: 'Lỗi đăng ký' });
      });

      await fHandleUploadDSSV(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.message.registered.length).toBe(0);
      expect(res.jsonData.message.failed.length).toBe(3);
      expect(res.jsonData.message.failed[0].error).toBe('Lỗi đăng ký');
    });

    test('TEST-09: File CSV rỗng', async () => {
      mockFromFile.mockResolvedValue([]);

      await fHandleUploadDSSV(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.message.registered.length).toBe(0);
      expect(res.jsonData.message.failed.length).toBe(0);
    });

    test('ADD-03: Upload file CSV lớn với nhiều sinh viên (1000+)', async () => {
      // Tạo danh sách 1000 sinh viên
      const largeMockCSVData = Array.from({ length: 1000 }, (_, i) => ({
        full_name: `Sinh Vien ${i + 1}`,
        email: `sv${i + 1}@mail.com`,
        vnu_id: `19020${String(i + 1).padStart(4, '0')}`,
        password: '123456'
      }));

      mockFromFile.mockResolvedValue(largeMockCSVData);

      // Mô phỏng tất cả sinh viên đều được đăng ký thành công
      register.mockImplementation(async (req, res) => {
        res.status(200);
      });

      await fHandleUploadDSSV(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.status).toBe('Success');
      expect(res.jsonData.message.registered.length).toBe(1000);
      expect(res.jsonData.message.failed.length).toBe(0);
    });

  });

  // Test fHandleUploadDSMH
  describe('Test function fHandleUploadDSMH trong file upload.js', () => {
    let req, res;

    beforeEach(() => {
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
        }
      };
    });

    test('TEST-10: Tất cả môn học thêm thành công', async () => {
      mockFromFile.mockResolvedValue(mockCSVDataSubjects);
      fAddSubject.mockImplementation(async (req, res) => {
        res.status(200);
      });

      await fHandleUploadDSMH(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.message.registered.length).toBe(2);
      expect(res.jsonData.message.failed.length).toBe(0);
    });

    test('TEST-11: Một số môn học thêm thất bại', async () => {
      mockFromFile.mockResolvedValue(mockCSVDataSubjects);
      fAddSubject.mockImplementation(async (req, res) => {
        if (req.body.subject_code === 'INT10023') {
          res.status(400);
          res.json({ message: 'Mã đã tồn tại' });
        } else {
          res.status(200);
        }
      });

      await fHandleUploadDSMH(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.message.registered.length).toBe(1);
      expect(res.jsonData.message.failed.length).toBe(1);
      expect(res.jsonData.message.failed[0].subject_code).toBe('INT10023');
      expect(res.jsonData.message.failed[0].error).toBe('Mã đã tồn tại');
    });

    test('TEST-12: Tất cả môn học thêm thất bại', async () => {
      mockFromFile.mockResolvedValue(mockCSVDataSubjects);
      fAddSubject.mockImplementation(async (req, res) => {
        res.status(400);
        res.json({ message: 'Lỗi thêm môn học' });
      });

      await fHandleUploadDSMH(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.message.registered.length).toBe(0);
      expect(res.jsonData.message.failed.length).toBe(2);
      expect(res.jsonData.message.failed[0].error).toBe('Lỗi thêm môn học');
    });

    test('TEST-13: File CSV rỗng', async () => {
      mockFromFile.mockResolvedValue([]);

      await fHandleUploadDSMH(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.message.registered.length).toBe(0);
      expect(res.jsonData.message.failed.length).toBe(0);
    });
  });

describe('Test fHandleUploadDSCV trong file upload.js', () => {
  let req, res;
  const mockFromFile = csv().fromFile;

  beforeEach(() => {
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
      }
    };
    jest.clearAllMocks();
    mockFromFile.mockReset();
    register.mockReset();
  });

  test('TEST-14: Đăng ký thành công cho tất cả cố vấn', async () => {
    // Mô tả: Kiểm tra khi tất cả bản ghi trong file CSV được đăng ký thành công, vai trò được gán là "teacher"
    mockFromFile.mockResolvedValue(mockCSVDataTeachers);
    register.mockImplementation(async (req, res) => {
      res.status(200);
      res.json({ message: 'OK' });
    });

    await fHandleUploadDSCV(req, res);

    expect(mockFromFile).toHaveBeenCalledWith('mock/path/to/file.csv');
    expect(register).toHaveBeenCalledTimes(2);
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.objectContaining({ role: 'teacher' }) }),
      expect.anything()
    );
    expect(res.statusCode).toBe(200);
    expect(res.jsonData).toEqual(
      RES_FORM('Success', {
        registered: mockCSVDataTeachers.map(item => ({ ...item, role: 'teacher' })),
        failed: []
      })
    );
  });

test('TEST-15: Đăng ký thất bại do VNU-ID trùng', async () => {
    // Đảm bảo dữ liệu đầu vào đúng
    const mockCSVDataTeachers = [
        {
            date_of_birth: '2001-01-19T00:00:00Z',
            email: 'hoanghuubach@gmail.com',
            location: 'Nam Từ Liêm',
            name: 'Hoàng Hữu Bách',
            vnu_id: '19029999',
            username: 'bachgv',
            password: 'bach',
            gender: 'male',
            phone_number: '02103748902'
        },
        {
            date_of_birth: '1995-05-20T00:00:00Z',
            email: 'tranvanc@example.com',
            location: 'Cầu Giấy',
            name: 'Trần Văn C',
            vnu_id: '19030000',
            username: 'tranvc',
            password: 'tran',
            gender: 'male',
            phone_number: '0987654321'
        }
    ];

    // Mock csvtojson để trả về dữ liệu
    mockFromFile.mockResolvedValue(mockCSVDataTeachers);

    // Mock register để luôn trả về lỗi VNU-ID trùng
    register.mockImplementation(async (req, res) => {
        expect(req.body.vnu_id).toBeDefined(); // Kiểm tra vnu_id có trong body
        res.status(409);
        res.json({ status: 'Error', message: 'VNU-ID is already registered by someone' });
    });

    // Gọi hàm fHandleUploadDSCV
    await fHandleUploadDSCV(req, res);

    // Kiểm tra các lời gọi hàm
    expect(mockFromFile).toHaveBeenCalledWith('mock/path/to/file.csv');
    expect(register).toHaveBeenCalledTimes(2);
    expect(register).toHaveBeenCalledWith(
        expect.objectContaining({
            body: expect.objectContaining({
                role: 'teacher',
                vnu_id: expect.any(String)
            })
        }),
        expect.any(Object)
    );

    // Kiểm tra kết quả
    expect(res.statusCode).toBe(200);
    expect(res.jsonData).toEqual(
        RES_FORM('Success', {
            registered: [], // Phải rỗng vì tất cả đều thất bại
            failed: mockCSVDataTeachers.map(item => ({
                ...item,
                role: 'teacher',
                error: 'VNU-ID is already registered by someone'
            }))
        })
    );

    // Kiểm tra rằng register luôn được gọi với status 409
    expect(register.mock.calls.every((call) => {
        const fakeRes = call[1];
        return fakeRes.statusCode === 409;
    })).toBe(true);
});

  test('ADD-05: File CSV rỗng', async () => {
    // Mô tả: Kiểm tra khi file CSV không chứa bản ghi nào
    mockFromFile.mockResolvedValue([]);

    await fHandleUploadDSCV(req, res);

    expect(mockFromFile).toHaveBeenCalledWith('mock/path/to/file.csv');
    expect(register).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.jsonData).toEqual(
      RES_FORM('Error', {
        registered: [],
        failed: [],
        message: 'File CSV rỗng'
      })
    );
  });

  test('ADD-06: File CSV lớn (1000 bản ghi)', async () => {
    // Mô tả: Kiểm tra hiệu suất khi xử lý file CSV lớn
    const largeCSVData = Array(1000).fill().map((_, i) => ({
      date_of_birth: `2000-${String(i % 12 + 1).padStart(2, '0')}-01T00:00:00Z`,
      email: `teacher${i}@example.com`,
      location: 'Hà Nội',
      name: `Teacher ${i}`,
      role: 'teacher',
      vnu_id: `190${String(30000 + i).padStart(5, '0')}`,
      username: `teacher${i}`,
      password: `pass${i}`,
      gender: i % 2 === 0 ? 'male' : 'female',
      phone_number: `09${String(87654321 + i).padStart(8, '0')}`
    }));
    mockFromFile.mockResolvedValue(largeCSVData);
    register.mockImplementation(async (req, res) => {
      res.status(200);
      res.json({ message: 'OK' });
    });

    await fHandleUploadDSCV(req, res);

    expect(mockFromFile).toHaveBeenCalledWith('mock/path/to/file.csv');
    expect(register).toHaveBeenCalledTimes(1000);
    expect(res.statusCode).toBe(200);
    expect(res.jsonData).toEqual(
      RES_FORM('Success', {
        registered: largeCSVData.map(item => ({ ...item, role: 'teacher' })),
        failed: []
      })
    );
  });

  test('ADD-07: Một số bản ghi thành công, một số thất bại do VNU-ID trùng', async () => {
    // Mô tả: Kiểm tra khi file CSV có một số bản ghi đăng ký thành công, một số thất bại do VNU-ID trùng
    mockFromFile.mockResolvedValue(mockCSVDataTeachers);
    register
      .mockImplementationOnce(async (req, res) => {
        res.status(200);
        res.json({ message: 'OK' });
      })
      .mockImplementationOnce(async (req, res) => {
        res.status(409);
        res.json({ message: 'VNU-ID is already registered by someone' });
      });

    await fHandleUploadDSCV(req, res);

    expect(mockFromFile).toHaveBeenCalledWith('mock/path/to/file.csv');
    expect(register).toHaveBeenCalledTimes(2);
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.objectContaining({ role: 'teacher' }) }),
      expect.anything()
    );
    expect(res.statusCode).toBe(200);
    expect(res.jsonData).toEqual(
      RES_FORM('Success', {
        registered: [
          {
            date_of_birth: '2001-01-19T00:00:00Z',
            email: 'hoanghuubach@gmail.com',
            location: 'Nam Từ Liêm',
            name: 'Hoàng Hữu Bách',
            role: 'teacher',
            vnu_id: '19029999',
            username: 'bachgv',
            password: 'bach',
            gender: 'male',
            phone_number: '02103748902'
          }
        ],
        failed: [
          {
            date_of_birth: '1995-05-20T00:00:00Z',
            email: 'tranvanc@example.com',
            location: 'Cầu Giấy',
            name: 'Trần Văn C',
            role: 'teacher',
            vnu_id: '19030000',
            username: 'tranvc',
            password: 'tran',
            gender: 'male',
            phone_number: '0987654321',
            error: 'VNU-ID is already registered by someone'
          }
        ]
      })
    );
  });

});
});