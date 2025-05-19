const mongoose = require('mongoose');
const {
  fCreateClass,
  findClassByClassId,
  fFindClassByClassId,
  validateClassTeacher,
  validateClassMember,
  fGetMemberBasicInfors,
  fAddMembersToClass,
  fGetCurClasses,
  fDeleteMemberInClass,
  handleUploadMembers
} = require('./class');

// Mock dependencies
jest.mock('./../../configs/Constants', () => ({
  RES_FORM: (status, data) => ({ status, data })
}));
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mocked-uuid')
}));
jest.mock('csvtojson/v2', () => {
  return jest.fn().mockReturnValue({
    fromFile: jest.fn()
  });
});

describe('Class Functions', () => {
  let req, res, next, senderId, classId, classInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    senderId = new mongoose.Types.ObjectId();
    classId = 'mocked-uuid';

    // Mock Mongoose models
    classInstance = {
      _id: new mongoose.Types.ObjectId(),
      class_id: classId,
      class_name: 'Test Class',
      class_teacher: senderId,
      class_members: [],
      save: jest.fn().mockResolvedValue(),
      populate: jest.fn().mockImplementation(function () {
        return Promise.resolve(this);
      })
    };
    
    const saveMock = jest.fn().mockResolvedValue(true);
    const mockClassConstructor = jest.fn().mockImplementation((data) => ({
      ...data,
      save: saveMock
    }));

    global.DBConnection = {
      Class: mockClassConstructor,
      User: jest.fn(), // nếu cần mock constructor

      // Static methods của Class
      Class: Object.assign(mockClassConstructor, {
        findOne: jest.fn().mockResolvedValue(null),
        find: jest.fn().mockResolvedValue([])
      }),

      // Static methods của User
      User: Object.assign(jest.fn(), {
        find: jest.fn().mockResolvedValue([])
      })
    };


    // Mock req, res, next
    req = {
      senderInstance: { _id: senderId, role: 'teacher', vnu_id: 'teacher1' },
      senderVNUId: 'teacher1',
      classInstance,
      body: {},
      params: { classId },
      query: {},
      fileUploadPath: '/path/to/file.csv'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn()
    };
    next = jest.fn();
  });

  const printTestLog = (testName, expected, actual) => {
    process.stdout.write(`Test: ${testName}\n`);
    process.stdout.write(`Expected Output: ${JSON.stringify(expected, null, 2)}\n`);
    process.stdout.write(`Actual Output: ${JSON.stringify(actual, null, 2)}\n\n`);
  };

  describe('fCreateClass', () => {
    // Class01
    it('should create class successfully for teacher', async () => {
      req.body.class_name = 'Test Class';

      await fCreateClass(req, res);

      printTestLog(
        'should create class successfully for teacher',
        { status: 200, json: { status: 'Success', message: 'Tao lop thanh cong' } },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(global.DBConnection.Class).toHaveBeenCalledWith({
        class_id: 'mocked-uuid',
        class_name: 'Test Class',
        class_teacher: expect.any(mongoose.Types.ObjectId)
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Success',
        message: 'Tao lop thanh cong'
      });
    });
    // Class02
    it('should reject non-teacher role', async () => {
      req.senderInstance.role = 'student';

      await fCreateClass(req, res);

      printTestLog(
        'should reject non-teacher role',
        {
          status: 404,
          json: { status: 'Error', message: 'Khong tao lop duoc do role != teacher' }
        },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Error',
        message: 'Khong tao lop duoc do role != teacher'
      });
    });
    // Class03
    it('should handle empty class_name', async () => {
      req.body.class_name = '';

      await fCreateClass(req, res);

      printTestLog(
        'should handle empty class_name',
        { status: 400, json: { status: 'Error', message: 'Xay ra loi trong viec tao lop, ten lop hoc khong duoc de trong' } },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Error',
        message: 'Xay ra loi trong viec tao lop, ten lop hoc khong duoc de trong'
      });
    });
    // Class04
    it('should handle invalid senderInstance._id', async () => {
      req.senderInstance._id = 'invalid';
      req.body.class_name = 'Test Class';

      await fCreateClass(req, res);

      printTestLog(
        'should handle invalid senderInstance._id',
        { status: 400, json: { status: 'Error', message: 'Xay ra loi trong viec tao lop invalid senderInstance._id' } },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Error',
        message: 'Xay ra loi trong viec tao lop invalid senderInstance._id'
      });
    });

  });

  describe('findClassByClassId', () => {
    // Class05
    it('should find class and call next', async () => {
      global.DBConnection.Class.findOne.mockResolvedValue(classInstance);

      await findClassByClassId(req, res, next);

      printTestLog(
        'should find class and call next',
        { nextCalled: 1, classInstance: { class_id: classId } },
        {
          nextCalled: next.mock.calls.length,
          classInstance: req.classInstance ? { class_id: req.classInstance.class_id } : null
        }
      );

      expect(global.DBConnection.Class.findOne).toHaveBeenCalledWith({ class_id: classId });
      expect(req.classInstance).toBe(classInstance);
      expect(next).toHaveBeenCalled();
    });
    // Class06
    it('should handle class not found', async () => {
      global.DBConnection.Class.findOne.mockResolvedValue(null);

      await findClassByClassId(req, res, next);

      printTestLog(
        'should handle class not found',
        { status: 404, json: { status: 'Error', data: 'Class not found' } },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ status: 'Error', data: 'Class not found' });
    });
    // Class07
    it('should handle invalid classId', async () => {
      req.params.classId = '';

      await findClassByClassId(req, res, next);

      printTestLog(
        'should handle invalid classId',
        { status: 404, json: { status: 'Error', data: 'Class not found' } },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ status: 'Error', data: 'Class not found' });
    });
  });

  describe('fFindClassByClassId', () => {
    // Class08
    it('should return class with members', async () => {
      req.query = { without_member: false };

      await fFindClassByClassId(req, res, next);

      printTestLog(
        'should return class with members',
        { status: 200, json: classInstance },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(classInstance.populate).toHaveBeenCalledWith('class_teacher');
      expect(classInstance.populate).toHaveBeenCalledWith('class_members');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(classInstance);
    });
    // Class09
    it('should return class without members', async () => {
      req.query = { without_member: true };

      await fFindClassByClassId(req, res, next);

      printTestLog(
        'should return class without members',
        { status: 200, json: classInstance },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(classInstance.populate).toHaveBeenCalledWith('class_teacher');
      expect(classInstance.populate).not.toHaveBeenCalledWith('class_members');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(classInstance);
    });
    // Class10
    it('should return teacher only', async () => {
      req.query = { teacher: true };
      classInstance.class_teacher = { _id: senderId, vnu_id: 'teacher1' };

      await fFindClassByClassId(req, res, next);

      printTestLog(
        'should return teacher only',
        { status: 200, json: classInstance.class_teacher },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(classInstance.class_teacher);
    });

  });

  describe('validateClassTeacher', () => {
    // Class11
    it('should validate teacher and call next', async () => {
      classInstance.class_teacher = { vnu_id: 'teacher1' };

      await validateClassTeacher(req, res, next);

      printTestLog(
        'should validate teacher and call next',
        { nextCalled: 1 },
        { nextCalled: next.mock.calls.length }
      );

      expect(next).toHaveBeenCalled();
    });
    // Class12
    it('should reject non-teacher', async () => {
      classInstance.class_teacher = { vnu_id: 'teacher2' };

      await validateClassTeacher(req, res, next);

      printTestLog(
        'should reject non-teacher',
        { status: 400, json: { status: 'Error', data: 'You are not teacher in this class' } },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Error',
        data: 'You are not teacher in this class'
      });
    });


  });

  describe('validateClassMember', () => {
    // Class13
    it('should validate member and call next', async () => {
      classInstance.class_members = [senderId];

      validateClassMember(req, res, next);

      printTestLog(
        'should validate member and call next',
        { nextCalled: 1 },
        { nextCalled: next.mock.calls.length }
      );

      expect(next).toHaveBeenCalled();
    });
    // Class14
    it('should validate teacher as member', async () => {
      classInstance.class_teacher = senderId;
      classInstance.class_members = [];

      validateClassMember(req, res, next);

      printTestLog(
        'should validate teacher as member',
        { nextCalled: 1 },
        { nextCalled: next.mock.calls.length }
      );

      expect(next).toHaveBeenCalled();
    });
    // Class15
    it('should reject non-member', async () => {
      classInstance.class_members = [];
      classInstance.class_teacher = new mongoose.Types.ObjectId();

      validateClassMember(req, res, next);

      printTestLog(
        'should reject non-member',
        { status: 400, json: { status: 'Error', data: "You aren't a member in this class" } },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Error',
        data: "You aren't a member in this class"
      });
    });

  });

  describe('fGetMemberBasicInfors', () => {
    // Class16
    it('should return limited members', async () => {
      req.query.limit = 2;
      classInstance.class_members = [senderId, new mongoose.Types.ObjectId()];

      await fGetMemberBasicInfors(req, res);

      printTestLog(
        'should return limited members',
        { status: 200, json: { status: 'Sucess', data: classInstance.class_members } },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Sucess',
        data: classInstance.class_members
      });
    });
    // Class17
    it('should handle invalid limit', async () => {
      req.query.limit = -1;

      await fGetMemberBasicInfors(req, res);

      printTestLog(
        'should handle invalid limit',
        { status: 400, json: { status: 'Error', data: 'Invalid limit' } },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ status: 'Error', data: 'Invalid limit' });
    });

  });

  describe('fAddMembersToClass', () => {
    // Class18
    it('should add valid members', async () => {
      req.body.members = JSON.stringify(['student1@vnu.edu.vn']);
      const newMemberId = new mongoose.Types.ObjectId();
      global.DBConnection.User.find.mockResolvedValue([
        { _id: newMemberId, email: 'student1@vnu.edu.vn' }
      ]);

      await fAddMembersToClass(req, res);

      printTestLog(
        'should add valid members',
        {
          status: 200,
          json: {
            status: 'Success',
            data: { members: [newMemberId], registered: [{ email: 'student1@vnu.edu.vn' }], failed: [] }
          }
        },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Success',
        data: {
          members: [newMemberId],
          registered: [{ email: 'student1@vnu.edu.vn' }],
          failed: []
        }
      });
    });

    // Class19
    it('should handle non-existent emails', async () => {
      req.body.members = JSON.stringify(['nonexistent@vnu.edu.vn']);
      global.DBConnection.User.find.mockResolvedValue([]);

      await fAddMembersToClass(req, res);

      printTestLog(
        'should handle non-existent emails',
        {
          status: 200,
          json: {
            status: 'Success',
            data: {
              members: [],
              registered: [],
              failed: [{ email: 'nonexistent@vnu.edu.vn', error: 'Email không tồn tại trong hệ thống' }]
            }
          }
        },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Success',
        data: {
          members: [],
          registered: [],
          failed: [{ email: 'nonexistent@vnu.edu.vn', error: 'Email không tồn tại trong hệ thống' }]
        }
      });
    });
    // Class20
    it('should handle existing members', async () => {
      req.body.members = JSON.stringify(['student1@vnu.edu.vn']);
      classInstance.class_members = [senderId];
      global.DBConnection.User.find.mockResolvedValue([
        { _id: senderId, email: 'student1@vnu.edu.vn' }
      ]);

      await fAddMembersToClass(req, res);

      printTestLog(
        'should handle existing members',
        {
          status: 200,
          json: {
            status: 'Success',
            data: {
              members: [senderId],
              registered: [],
              failed: [{ email: 'student1@vnu.edu.vn', error: 'Email đã được thêm rồi' }]
            }
          }
        },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Success',
        data: {
          members: [senderId],
          registered: [],
          failed: [{ email: 'student1@vnu.edu.vn', error: 'Email đã được thêm rồi' }]
        }
      });
    });
    // Class21
    it('should handle missing members', async () => {
      req.body.members = undefined;

      await fAddMembersToClass(req, res);

      printTestLog(
        'should handle missing members',
        { status: 400, json: { status: 'Error', message: 'Members list is required' } },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Error',
        message: 'Members list is required'
      });
    });

  });
  // Class22
  describe('fGetCurClasses', () => {
    it('should return classes for teacher', async () => {
      global.DBConnection.Class.find.mockResolvedValue([classInstance]);

      await fGetCurClasses(req, res);

      printTestLog(
        'should return classes for teacher',
        { status: 200, json: { status: 'Success', data: [classInstance] } },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(global.DBConnection.Class.find).toHaveBeenCalledWith({ class_teacher: senderId });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'Success', data: [classInstance] });
    });
    // Class23
    it('should return classes for student', async () => {
      req.senderInstance.role = 'student';
      global.DBConnection.Class.find.mockResolvedValue([classInstance]);

      await fGetCurClasses(req, res);

      printTestLog(
        'should return classes for student',
        { status: 200, json: { status: 'Success', data: [classInstance] } },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(global.DBConnection.Class.find).toHaveBeenCalledWith({ class_members: senderId });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'Success', data: [classInstance] });
    });
    // Class24
    it('should handle invalid role', async () => {
      req.senderInstance.role = 'admin';

      await fGetCurClasses(req, res);

      printTestLog(
        'should handle invalid role',
        { status: 400, json: { status: 'Error', data: 'Invalid role' } },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ status: 'Error', data: 'Invalid role' });
    });

  });

  describe('fDeleteMemberInClass', () => {
    // Class25
    it('should delete members', async () => {
      req.body.members = JSON.stringify(['student1']);
      classInstance.class_members = [{ _id: senderId, vnu_id: 'student1' }];

      await fDeleteMemberInClass(req, res);

      printTestLog(
        'should delete members',
        {
          status: 200,
          json: { status: 'Success', data: { deleted: [{ _id: senderId, vnu_id: 'student1' }], failed: [] } }
        },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Success',
        data: { deleted: [{ _id: senderId, vnu_id: 'student1' }], failed: [] }
      });
    });
    
    // Class26
    it('should handle non-existent members', async () => {
      req.body.members = JSON.stringify(['nonexistent']);
      classInstance.class_members = [{ _id: senderId, vnu_id: 'student1' }];

      await fDeleteMemberInClass(req, res);

      printTestLog(
        'should handle non-existent members',
        {
          status: 400,
          json: {
            status: 'eror',message: 'non existent member',
            data: { deleted: [], failed: ['nonexistent'] }
          }
        },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'eror',message: 'non existent member',
        data: { deleted: [], failed: ['nonexistent'] }
      });
    });
    // Class27
    it('should handle missing members', async () => {
      req.body.members = undefined;

      await fDeleteMemberInClass(req, res);

      printTestLog(
        'should handle missing members',
        { status: 400, json: { status: 'Error', message: 'Members list is required' } },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Error',
        message: 'Members list is required'
      });
    });

  });

  describe('handleUploadMembers', () => {
    // Class28
    it('should parse CSV and set members', async () => {
      require('csvtojson/v2')().fromFile.mockResolvedValue([{ email: 'student1@vnu.edu.vn' }]);

      await handleUploadMembers(req, res, next);

      printTestLog(
        'should parse CSV and set members',
        { nextCalled: 1, members: JSON.stringify(['student1@vnu.edu.vn']) },
        { nextCalled: next.mock.calls.length, members: req.body.members }
      );

      expect(next).toHaveBeenCalled();
      expect(req.body.members).toBe(JSON.stringify(['student1@vnu.edu.vn']));
    });
    
    // Class29
    it('should handle empty CSV', async () => {
      require('csvtojson/v2')().fromFile.mockResolvedValue([]);

      await handleUploadMembers(req, res, next);

      printTestLog(
        'should handle empty CSV',
        { status: 400, json: { status: 'Error', message: 'CSV file is empty' } },
        { status: res.status.mock.calls[0]?.[0], json: res.json.mock.calls[0]?.[0] }
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'Error',
        message: 'CSV file is empty'
      });
      expect(next).not.toHaveBeenCalled(); 
    });

  });
});
