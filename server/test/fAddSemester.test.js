const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { fAddSemester } = require('../middleware/semester-middleware/semester'); // Điều chỉnh path phù hợp

// Mock DBConnection
jest.mock('mongoose', () => {
    const mockSave = jest.fn();
    const mockSemester = jest.fn().mockImplementation(() => ({
        save: mockSave
    }));
    
    return {
        ...jest.requireActual('mongoose'),
        connection: {
            Semester: mockSemester
        }
    };
});

describe('fAddSemester', () => {
    let app;
    
    beforeAll(() => {
        // Thiết lập Express app cho testing
        app = express();
        app.use(express.json());
        app.post('/semester', fAddSemester);
        
        // Mock global.DBConnection
        global.DBConnection = {
            Semester: mongoose.connection.Semester
        };
        
        // Mock RES_FORM
        global.RES_FORM = jest.fn((status, message) => ({
            status,
            message
        }));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should add new semester successfully', async () => {
        // Mock save method
        global.DBConnection.Semester().save.mockResolvedValue({});
        
        const response = await request(app)
            .post('/semester')
            .send({
                semester_name: 'Học kỳ 1',
                semester_id: 'HK1'
            });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            status: 'Success',
            message: 'Đã thêm kỳ học HK1: Học kỳ 1'
        });
        expect(global.DBConnection.Semester).toHaveBeenCalledWith({
            semester_name: 'Học kỳ 1',
            semester_id: 'HK1'
        });
        expect(global.DBConnection.Semester().save).toHaveBeenCalled();
    });

    test('should return error when semester_id already exists', async () => {
        // Mock save method để throw duplicate key error
        global.DBConnection.Semester().save.mockRejectedValue({ code: 11000 });
        
        const response = await request(app)
            .post('/semester')
            .send({
                semester_name: 'Học kỳ 1',
                semester_id: 'HK1'
            });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            status: 'Error',
            message: 'Mã kỳ học đã tồn tại'
        });
    });

    test('should return error for unexpected errors', async () => {
        // Mock save method để throw lỗi chung
        const errorMessage = 'Database connection failed';
        global.DBConnection.Semester().save.mockRejectedValue(new Error(errorMessage));
        
        const response = await request(app)
            .post('/semester')
            .send({
                semester_name: 'Học kỳ 1',
                semester_id: 'HK1'
            });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            status: 'Error',
            message: `Lỗi không xác định. Lỗi: Error: ${errorMessage}`
        });
    });

    test('should handle missing required fields', async () => {
        const response = await request(app)
            .post('/semester')
            .send({}); // Không gửi semester_name và semester_id

        expect(response.status).toBe(400);
        expect(response.body.status).toBe('Error');
    });
});