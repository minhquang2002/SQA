const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { findClassByClassId } = require('../middleware/class-middleware/class'); // Điều chỉnh path
const Configs = require('../configs/Constants'); // Điều chỉnh path

// Mock global.DBConnection
jest.mock('../middleware/class-middleware/class', () => {
    const originalModule = jest.requireActual('../middleware/class-middleware/class');
    // Đảm bảo global.DBConnection được định nghĩa
    if (!global.DBConnection) {
        global.DBConnection = {};
    }
    global.DBConnection.Class = {
        findOne: jest.fn()
    };
    return {
        ...originalModule,
        global: {
            ...originalModule.global,
            DBConnection: global.DBConnection
        }
    };
});

describe('findClassByClassId', () => {
    let app;
    let findOneSpy;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        // Middleware giả lập authentication và gán user instance
        app.use((req, res, next) => {
            req.user = { id: 'user123' }; // Giả lập user đã authenticate
            req.senderInstance = { id: 'user123', role: 'teacher' }; // Giả lập instance user
            next();
        });
        app.get('/class/:classId', findClassByClassId, (req, res) => {
            res.status(200).json({ classInstance: req.classInstance });
        });

        // Mock Configs.RES_FORM
        Configs.RES_FORM = jest.fn((status, message) => ({
            status,
            message
        }));

        // Lấy spy từ global.DBConnection.Class.findOne
        findOneSpy = global.DBConnection.Class.findOne;
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    // Test case 1: Thành công - Tìm thấy lớp với classId hợp lệ
    test('should find class and call next() when classId is valid', async () => {
        const mockClassInstance = { class_id: 'CLASS123', name: 'Test Class' };
        findOneSpy.mockResolvedValue(mockClassInstance);

        const response = await request(app)
            .get('/class/CLASS123');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ classInstance: mockClassInstance });
        expect(findOneSpy).toHaveBeenCalledWith({ class_id: 'CLASS123' });
    });

    // Test case 2: Thất bại - Không tìm thấy lớp
    test('should return 404 when class is not found', async () => {
        findOneSpy.mockResolvedValue(null);

        const response = await request(app)
            .get('/class/NOTFOUND123');

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
            status: 'Error',
            message: 'Class not found'
        });
        expect(findOneSpy).toHaveBeenCalledWith({ class_id: 'NOTFOUND123' });
    });

    // Test case 3: Thất bại - Lỗi database (throw exception)
    test('should handle database error and return UnknownError', async () => {
        const errorMessage = 'Database connection failed';
        findOneSpy.mockRejectedValue(new Error(errorMessage));

        const response = await request(app)
            .get('/class/CLASS123');

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
            status: 'Error',
            message: 'UnknownError'
        });
        expect(findOneSpy).toHaveBeenCalledWith({ class_id: 'CLASS123' });
    });

    // Test case 4: Lỗi - classId là undefined
    test('should handle undefined classId', async () => {
        findOneSpy.mockResolvedValue(null);

        const response = await request(app)
            .get('/class/undefined');

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
            status: 'Error',
            message: 'Class not found'
        });
        expect(findOneSpy).toHaveBeenCalledWith({ class_id: undefined });
    });

    // Test case 5: Lỗi - classId là chuỗi rỗng
    test('should handle empty classId', async () => {
        findOneSpy.mockResolvedValue(null);

        const response = await request(app)
            .get('/class/');

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
            status: 'Error',
            message: 'Class not found'
        });
        expect(findOneSpy).toHaveBeenCalledWith({ class_id: '' });
    });

    // Test case 6: Lỗi - classId chứa ký tự đặc biệt (kiểm tra injection)
    test('should handle classId with special characters', async () => {
        const maliciousClassId = 'CLASS123; DROP TABLE Classes; --';
        findOneSpy.mockResolvedValue(null);

        const response = await request(app)
            .get(`/class/${maliciousClassId}`);

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
            status: 'Error',
            message: 'Class not found'
        });
        expect(findOneSpy).toHaveBeenCalledWith({ class_id: maliciousClassId });
    });

    // Test case 7: Lỗi - global.DBConnection không được định nghĩa
    test('should handle undefined global.DBConnection', async () => {
        const originalDBConnection = global.DBConnection;
        delete global.DBConnection;

        const response = await request(app)
            .get('/class/CLASS123');

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
            status: 'Error',
            message: 'UnknownError'
        });

        global.DBConnection = originalDBConnection;
    });

    // Test case 8: Lỗi - global.DBConnection.Class không được định nghĩa
    test('should handle undefined global.DBConnection.Class', async () => {
        const originalDBConnection = global.DBConnection;
        global.DBConnection = {};

        const response = await request(app)
            .get('/class/CLASS123');

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
            status: 'Error',
            message: 'UnknownError'
        });

        global.DBConnection = originalDBConnection;
    });

    // Test case 9: Lỗi - Không có middleware tiếp theo (next() không có handler)
    test('should handle missing next handler', async () => {
        const appWithoutNext = express();
        appWithoutNext.use((req, res, next) => {
            req.user = { id: 'user123' };
            req.senderInstance = { id: 'user123', role: 'teacher' };
            next();
        });
        appWithoutNext.get('/class/:classId', findClassByClassId);

        const mockClassInstance = { class_id: 'CLASS123', name: 'Test Class' };
        findOneSpy.mockResolvedValue(mockClassInstance);

        const response = await request(appWithoutNext)
            .get('/class/CLASS123');

        expect(response.status).toBe(404);
        expect(findOneSpy).toHaveBeenCalledWith({ class_id: 'CLASS123' });
    });

    // Test case 10: Lỗi - Configs.RES_FORM không được định nghĩa
    test('should handle undefined Configs.RES_FORM', async () => {
        const originalRES_FORM = Configs.RES_FORM;
        Configs.RES_FORM = undefined;

        findOneSpy.mockResolvedValue(null);

        const response = await request(app)
            .get('/class/CLASS123');

        expect(response.status).toBe(500);
        expect(response.text).toContain('TypeError');

        Configs.RES_FORM = originalRES_FORM;
    });

    // Test case 11: Lỗi - Thiếu authentication (không có req.user)
    test('should still proceed without checking req.user', async () => {
        const appNoAuth = express();
        appNoAuth.use(express.json());
        appNoAuth.use((req, res, next) => {
            req.senderInstance = { id: 'user123', role: 'teacher' };
            next();
        });
        appNoAuth.get('/class/:classId', findClassByClassId, (req, res) => {
            res.status(200).json({ classInstance: req.classInstance });
        });

        const mockClassInstance = { class_id: 'CLASS123', name: 'Test Class' };
        findOneSpy.mockResolvedValue(mockClassInstance);

        const response = await request(appNoAuth)
            .get('/class/CLASS123');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ classInstance: mockClassInstance });
        expect(findOneSpy).toHaveBeenCalledWith({ class_id: 'CLASS123' });
    });

    // Test case 12: Lỗi - Thiếu instance user (không có req.senderInstance)
    test('should still proceed without checking req.senderInstance', async () => {
        const appNoInstance = express();
        appNoInstance.use(express.json());
        appNoInstance.use((req, res, next) => {
            req.user = { id: 'user123' };
            next();
        });
        appNoInstance.get('/class/:classId', findClassByClassId, (req, res) => {
            res.status(200).json({ classInstance: req.classInstance });
        });

        const mockClassInstance = { class_id: 'CLASS123', name: 'Test Class' };
        findOneSpy.mockResolvedValue(mockClassInstance);

        const response = await request(appNoInstance)
            .get('/class/CLASS123');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ classInstance: mockClassInstance });
        expect(findOneSpy).toHaveBeenCalledWith({ class_id: 'CLASS123' });
    });
});